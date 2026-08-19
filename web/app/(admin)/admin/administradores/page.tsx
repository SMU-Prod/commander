import { BotaoEnviar } from "@/components/ui/botao-enviar"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoSelect } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { atualizarPapelAdmin, conceberPapelAdmin } from "@/lib/acoes/admin-papeis"
import { exigirCeo } from "@/lib/admin"
import { carregarAdministradores, carregarCandidatosAdmin } from "@/lib/consultas-admin"
import { carregarTaxonomia, itensDoTipo } from "@/lib/consultas-marketplace"
import { ESCOPO_PAPEL, exigeRegioes, PAPEIS_ADMIN, ROTULO_PAPEL } from "@/lib/domain/admin-papeis"

/**
 * §21 — "O CEO/Super Admin é a conta-mãe que cria e gerencia os demais
 * administradores." Esta tela é só do CEO (`exigirCeo`), e a RLS da migration
 * 049 nega insert/update de `admin_papeis` pra qualquer outro papel.
 *
 * O escopo regional do Vistoriador é escolhido aqui, mas quem o FAZ VALER é a
 * RLS: `vistoriador_ve_regiao()` entra nas policies do Gold, então um
 * vistoriador de Angra não consegue nem selecionar uma vistoria de Salvador —
 * não é filtro de tela.
 */
export default async function AdminAdministradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirCeo()
  const { ok, erro } = await searchParams
  const [administradores, candidatos, taxonomia] = await Promise.all([
    carregarAdministradores(),
    carregarCandidatosAdmin(),
    carregarTaxonomia(),
  ])
  const regioes = itensDoTipo(taxonomia, "regiao")

  return (
    <main>
      {/* ONDA 93 — o "Voltar" desta tela era um `<Link>` de 16px de altura: a
          onda 54 já tinha consertado exatamente isso nas ~46 telas de `(app)`
          pelo `CabecalhoDetalhe`, mas o Admin nunca entrou na varredura (o
          usuário de teste não é admin) e ficou com a cópia antiga. */}
      <CabecalhoDetalhe
        voltarHref="/admin"
        voltarRotulo="Admin Commander"
        titulo="Administradores"
        descricao="Cada função abre exatamente o que o PRD descreve — nada além. Suspender uma função corta o acesso na hora e mantém o histórico de quem teve acesso a quê."
      />

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <SecaoPagina>Conceder função</SecaoPagina>
      <form action={conceberPapelAdmin} className="sombra-1 space-y-3 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <CampoSelect label="Pessoa" id="usuario_id" name="usuario_id" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </CampoSelect>

        <CampoSelect label="Função" id="papel" name="papel" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {PAPEIS_ADMIN.map((p) => (
            <option key={p} value={p}>{ROTULO_PAPEL[p]}</option>
          ))}
        </CampoSelect>

        <div className="rounded-[var(--raio-cartao)] border border-line bg-panel2 p-3">
          <p className="rotulo mb-1.5 text-dim">O que cada função abre</p>
          <ul className="space-y-1.5">
            {PAPEIS_ADMIN.map((p) => (
              <li key={p} className="apoio text-dim">
                <span className="font-medium text-fg">{ROTULO_PAPEL[p]}</span> — {ESCOPO_PAPEL[p]}
              </li>
            ))}
          </ul>
        </div>

        <Regioes regioes={regioes} />

        <Campo label="Observação (opcional)" id="observacao" name="observacao" placeholder="Por que esta pessoa recebeu a função" />
        {/* Conceder papel é a gravação mais séria do Admin, e o botão não
            mudava um pixel ao ser tocado: quem achasse que não pegou tocava
            de novo e a action rodava duas vezes. */}
        <BotaoEnviar rotulo="Conceder função" larguraCheia />
      </form>

      <SecaoPagina className="mt-8">Funções concedidas</SecaoPagina>
      {administradores.length === 0 ? (
        <EstadoVazio
          icone="pessoas"
          titulo="Nenhuma função concedida ainda"
          descricao="Você é a conta-mãe. Conceda Suporte, Comercial ou Vistoriador acima conforme for montando o time."
        />
      ) : (
        <div className="space-y-3">
          {administradores.map((a) => (
            <form key={a.papel.id} action={atualizarPapelAdmin} className="sombra-1 space-y-2 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <input type="hidden" name="id" value={a.papel.id} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="corpo truncate font-medium">{a.nome}</p>
                  <p className="apoio text-dim">{ROTULO_PAPEL[a.papel.papel]}</p>
                </div>
                {/* O ALVO É O `<label>`, E ELE NÃO DECLARAVA ALTURA NENHUMA.
                    A caixa desenhada tem 16px e o texto ao lado, 18 — o que o
                    dedo encontrava era um alvo de ~18px para SUSPENDER a função
                    de um administrador, que é das gravações mais sérias do
                    Admin. `size-4` continua sendo o DESENHO da caixa; quem
                    carrega a régua é o elemento clicável em volta, exatamente
                    como `ALVO_ACAO` faz com a pílula de 30px
                    (lib/ui/acoes.ts). `--altura-controle` e não um 44 cravado:
                    a onda 94 tirou o último número solto do app justamente
                    porque a régua copiada à mão é como se chega a nove alturas
                    de alvo. */}
                <label className="apoio inline-flex min-h-[var(--altura-controle)] shrink-0 items-center gap-1.5 text-dim">
                  <input type="checkbox" name="ativo" defaultChecked={a.papel.ativo} className="size-4 accent-[var(--acao)]" /> Ativa
                </label>
              </div>

              {a.papel.papel === "ceo" && (
                <p className="apoio text-dim">Conta-mãe: acesso total e gestão dos demais administradores.</p>
              )}

              {exigeRegioes(a.papel.papel) && (
                <>
                  <p className="apoio text-dim">
                    {a.regioes.length === 0
                      ? "Sem região autorizada — este vistoriador não enxerga vistoria nenhuma."
                      : `Regiões autorizadas: ${a.regioes.map((r) => r.nome).join(", ")}.`}
                  </p>
                  <Regioes regioes={regioes} marcadas={a.regioes.map((r) => r.id)} id={a.papel.id} />
                  <p className="apoio text-dim">
                    Região concedida não é removida por aqui — o histórico de escopo fica preservado. Para tirar o
                    acesso, suspenda a função.
                  </p>
                </>
              )}

              <Campo
                label="Observação"
                id={`obs_${a.papel.id}`}
                name="observacao"
                defaultValue={a.papel.observacao ?? ""}
              />
              <BotaoEnviar rotulo="Salvar" variante="contorno" larguraCheia />
            </form>
          ))}
        </div>
      )}
    </main>
  )
}

/** Lista de regiões do §21 ("somente às regiões autorizadas"). Aparece sempre;
 *  a action ignora o que for marcado quando o papel não é Vistoriador, porque
 *  guardar região num Suporte sugeriria um limite que ele não tem. */
function Regioes({
  regioes,
  marcadas = [],
  id = "novo",
}: {
  regioes: { id: string; nome: string; uf: string | null }[]
  marcadas?: string[]
  id?: string
}) {
  return (
    <fieldset className="rounded-[var(--raio-cartao)] border border-line bg-panel2 p-3">
      <legend className="rotulo px-1 text-dim">Regiões autorizadas (só para Vistoriador)</legend>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {/* Mesma régua do rótulo "Ativa" lá em cima, e aqui ela pesa mais: são
            N caixas lado a lado num grid de duas colunas, o caso em que errar o
            alvo marca a região do vizinho. Quem clica é o `<label>`, então é
            ele que carrega os 44px. */}
        {regioes.map((r) => (
          <label key={r.id} className="apoio inline-flex min-h-[var(--altura-controle)] items-center gap-1.5">
            <input
              type="checkbox"
              name="regioes"
              value={r.id}
              defaultChecked={marcadas.includes(r.id)}
              className="size-4 accent-[var(--acao)]"
              id={`regiao_${id}_${r.id}`}
            />
            <span className="truncate">{r.uf ? `${r.nome} · ${r.uf}` : r.nome}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

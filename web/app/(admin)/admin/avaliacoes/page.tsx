import { Estrelas } from "@/components/avaliacoes/estrelas"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { TOQUE } from "@/lib/ui/acoes"
import { moderarAvaliacao } from "@/lib/acoes/avaliacoes-admin"
import { exigirAreaAdmin } from "@/lib/admin"
import { carregarContestacoesPendentes } from "@/lib/consultas-avaliacoes"
import { textoDoMotivo } from "@/lib/domain/avaliacoes"

/**
 * Admin > Contestações (PRD §14: "Admin analisa e pode Manter ou Ocultar por
 * violação. Admin nunca altera a nota").
 *
 * Repare no que esta tela NÃO tem: campo de nota. Não é disciplina — o banco
 * não concede update na coluna `nota` a ninguém além do autor, e a RPC de
 * moderação não a menciona (migration 050). Aqui só existem os dois botões
 * que o §14 autoriza.
 *
 * Área do SUPORTE (§21): contestação é atendimento a cliente, não gestão
 * comercial — quem vende destaque pro parceiro não decide se a nota ruim dele
 * fica no ar. `exigirAreaAdmin("avaliacoes")` fecha a porta antes da tela: com
 * o `exigirAdmin()` genérico, um vistoriador entrava e via lista vazia (a RLS
 * filtrava), o que parece app quebrado em vez de acesso negado.
 */
export default async function AdminAvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>
}) {
  await exigirAreaAdmin("avaliacoes")
  const { ok, erro } = await searchParams
  const fila = await carregarContestacoesPendentes()

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/admin"
        voltarRotulo="Admin"
        titulo="Contestações de avaliação"
        descricao="Manter ou ocultar por violação. A nota que o cliente deu nunca é alterada — nem aqui, nem no banco."
      />

      {ok && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-ok/40 bg-ok/10 px-3 py-2">{ok}</p>}
      {erro && <p className="corpo mt-3 rounded-[var(--raio-controle)] border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {fila.length === 0 ? (
        <EstadoVazio
          className="mt-6"
          icone="estrela"
          titulo="Nenhuma contestação aguardando análise"
          descricao="Quando um Partner contestar uma avaliação, ela aparece aqui para decisão."
        />
      ) : (
        <div className="mt-4 space-y-3">
          {fila.map(({ contestacao, avaliacao }) => (
            <div key={contestacao.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <Estrelas nota={avaliacao.nota} />
                <span className="apoio text-dim">
                  {new Date(avaliacao.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="apoio mt-1 text-dim">
                {avaliacao.avaliador_nome} avaliou {avaliacao.avaliado_nome}
              </p>
              {avaliacao.comentario && (
                <p className="corpo mt-2 whitespace-pre-line rounded-[var(--raio-controle)] border border-line bg-panel2 px-3 py-2">
                  {avaliacao.comentario}
                </p>
              )}

              <p className="rotulo mt-3 text-dim">Contestação</p>
              <p className="corpo">{textoDoMotivo(contestacao.motivo_codigo)}</p>
              {contestacao.detalhe && <p className="apoio mt-1 text-dim">{contestacao.detalhe}</p>}

              <form action={moderarAvaliacao} className="mt-3 space-y-2">
                <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
                {/* A caixa era a string de `lib/ui/form.ts` copiada letra por
                    letra — e uma cópia congela: quando a onda 94 pôs o piso de
                    altura em `--altura-campo`, esta ficou pra trás. Pior que
                    isso, ela não tinha rótulo: o único nome que um leitor de
                    tela recebia vinha do placeholder, que some na primeira
                    letra digitada, justo num campo cujo texto vira registro
                    permanente. `CampoTextarea` veste a classe compartilhada e
                    entrega o rótulo de verdade; a condição "obrigatório para
                    ocultar" desce pra dica, que continua visível com o campo
                    já preenchido. */}
                <CampoTextarea
                  label="Motivo da decisão"
                  id={`nota_${contestacao.id}`}
                  name="nota_admin"
                  rows={2}
                  maxLength={600}
                  dica="Obrigatório para ocultar por violação."
                />
                {/* Os dois botões carregam `name`/`value` — é o par que diz à
                    action QUAL decisão foi tomada —, e `BotaoEnviar` não
                    repassa esses atributos. Por isso aqui não entra o aviso de
                    envio; o que dá pra trazer do sistema é a forma (pílula de
                    contorno, `lib/ui/acoes.ts`) e a confirmação de toque. */}
                <div className="flex gap-2">
                  <button
                    name="decisao" value="manter"
                    className={`h-11 flex-1 rounded-[var(--raio-pilula)] border border-line bg-panel2 text-sm font-medium ${TOQUE}`}
                  >
                    Manter
                  </button>
                  <button
                    name="decisao" value="ocultar"
                    className={`h-11 flex-1 rounded-[var(--raio-pilula)] border border-crit/40 text-sm font-medium text-crit ${TOQUE}`}
                  >
                    Ocultar por violação
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

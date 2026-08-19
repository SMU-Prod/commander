import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Campo, CampoTextarea } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { Selo } from "@/components/ui/selo"
import { registrarRetorno, registrarSaida } from "@/lib/acoes/patio"
import { carregarPainel } from "@/lib/consultas"
import { carregarPatio } from "@/lib/consultas-patio"
import { ehJet, linhaDaComparacao, textoDuracao, duracaoHoras } from "@/lib/domain/patio"
import { podeEditar } from "@/lib/domain/permissoes"
import { ROTULO_TIPO_EMBARCACAO } from "@/lib/domain/tipo-embarcacao"
import { ACAO_NAO_ESTICA } from "@/lib/ui/superficies"

/**
 * A HOME DE CAMPO (onda 70b — PRD-UPGRADE-3-COTAS §6).
 *
 * O §6 abre com a régua que desenha esta tela inteira: *"Home de campo deve
 * ser rápida, com botões grandes e poucos passos."* Quem usa isto é o
 * funcionário do pátio, de pé, com a unidade na rampa e o cotista esperando.
 *
 * Daí as três decisões visíveis aqui:
 *
 *   1. A TELA TEM UM ESTADO SÓ POR VEZ. Ou a unidade está fora (e a tela
 *      inteira é o check-in) ou está no pátio (e a tela inteira é o
 *      check-out). Mostrar os dois formulários juntos criaria a chance de
 *      alguém preencher o errado com pressa.
 *
 *   2. NENHUM CAMPO É OBRIGATÓRIO além do gesto. Horas, combustível e estado
 *      entram se a pessoa souber. O que falta vira `null` e a comparação diz
 *      só o que dá pra dizer (`linhaDaComparacao`, com teste).
 *
 *   3. O PROBLEMA NO RETORNO É UMA CAIXA, NÃO UMA DEDUÇÃO. O §6 pede
 *      "transformar imediatamente em avaria" — e quem transforma é a marcação
 *      da pessoa. O app não deduz avaria de queda de combustível: deduzir
 *      abriria avaria fantasma toda vez que alguém navegasse bastante, e o
 *      pátio pararia de confiar no aviso.
 */
export default async function PatioPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  // Movimento de pátio é registro de saída e retorno — mesma natureza do
  // Diário, e é dessa área que ele tira a permissão (migration 060).
  const editavel = podeEditar(painel.permissoes, "diario")
  const patio = await carregarPatio()
  if (!patio) redirect("/onboarding")

  const { aberto, historico, nomePorId } = patio
  const unidade = painel.embarcacao
  const nomeDe = (id: string | null) => (id ? nomePorId.get(id) ?? null : null)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/hoje"
        voltarRotulo="Início"
        titulo="Pátio"
        descricao={
          ehJet(unidade.tipo)
            ? "Saída e retorno do Jet — o que saiu, como voltou."
            : "Saída e retorno da unidade — o que saiu, como voltou."
        }
        selo={
          aberto
            ? <Selo estado="atencao">Fora</Selo>
            : <Selo estado="ok">No pátio</Selo>
        }
      />
      {/* Só `erro` aqui. O `?ok=` é do `Toast` global (components/toast.tsx),
          que toda tela do app já herda do layout — renderizar os dois fazia
          "Saída registrada" aparecer duas vezes na mesma tela (achado na
          prova visual desta onda). */}
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      {/* O cartão da unidade: nome, tipo e horímetro atual. É o que confirma
          pra pessoa do pátio que ela está no barco certo antes de tocar em
          qualquer botão. */}
      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="titulo-card">{unidade.nome}</p>
        <p className="apoio mt-0.5 text-dim">
          {unidade.tipo ? ROTULO_TIPO_EMBARCACAO[unidade.tipo] : "Unidade"}
          {aberto?.saida_em && (
            <>
              {" · fora há "}
              <span className="font-mono-instr tabular-nums">
                {textoDuracao(
                  duracaoHoras({ saidaEm: aberto.saida_em, retornoEm: new Date().toISOString() }),
                ) ?? "pouco"}
              </span>
            </>
          )}
        </p>
      </div>

      {!editavel ? (
        <EstadoVazio
          icone="pessoas"
          titulo="Seu acesso não registra movimentação"
          descricao="Quem registra saída e retorno é quem tem permissão de editar o Diário desta unidade."
          className="mt-4"
        />
      ) : aberto ? (
        /* ---------------------------------------------------------------
           ESTADO 1 — a unidade está fora. A tela inteira é o check-in.
           --------------------------------------------------------------- */
        <>
          <SecaoPagina icone="ancora">Registrar retorno</SecaoPagina>
          <form action={registrarRetorno} className="space-y-4">
            <input type="hidden" name="movimento_id" value={aberto.id} />
            <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
              {/* O que foi anotado na saída, à vista: o §6 chama isso de
                  "comparação com check-out", e comparar de cabeça com o
                  formulário aberto é como se erra o horímetro. */}
              <div className="rounded-[var(--raio-controle)] border border-line bg-panel2 p-3">
                <p className="rotulo text-dim">Na saída</p>
                <p className="apoio mt-1">
                  {[
                    aberto.saida_horas != null ? `${aberto.saida_horas.toLocaleString("pt-BR")} h` : null,
                    aberto.saida_combustivel_pct != null ? `${aberto.saida_combustivel_pct}% de combustível` : null,
                    nomeDe(aberto.responsavel_id),
                  ].filter(Boolean).join(" · ") || "Nada anotado além do horário"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo
                  label="Horas na chegada"
                  id="retorno_horas"
                  name="retorno_horas"
                  inputMode="decimal"
                  className="font-mono-instr tabular-nums"
                />
                <Campo
                  label="Combustível (%)"
                  id="retorno_combustivel_pct"
                  name="retorno_combustivel_pct"
                  inputMode="numeric"
                  className="font-mono-instr tabular-nums"
                />
              </div>
              <CampoTextarea
                label="Como voltou"
                id="retorno_estado"
                name="retorno_estado"
                rows={3}
                placeholder="Ex.: tudo normal. Ou: barulho na turbina acima de 4.000 rpm."
              />

              {/* Ver o cabeçalho, decisão 3: caixa, não dedução. */}
              <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--raio-controle)] border border-line bg-campo px-3.5 py-2.5">
                <input type="checkbox" name="houve_problema" className="mt-1 size-4 shrink-0 accent-[var(--crit)]" />
                <span className="min-w-0">
                  <span className="corpo block font-medium">Houve problema nesta saída</span>
                  <span className="apoio block text-dim">
                    Abre uma ocorrência com o que você escreveu acima, na hora.
                  </span>
                </span>
              </label>
            </div>
            <button className={`${ACAO_NAO_ESTICA} rounded-xl bg-accent py-3.5 font-semibold text-acao-texto`}>
              Registrar retorno
            </button>
          </form>
        </>
      ) : (
        /* ---------------------------------------------------------------
           ESTADO 2 — a unidade está no pátio. A tela inteira é o check-out.
           --------------------------------------------------------------- */
        <>
          <SecaoPagina icone="embarcacao">Registrar saída</SecaoPagina>
          <form action={registrarSaida} className="space-y-4">
            <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  label="Horas na saída"
                  id="saida_horas"
                  name="saida_horas"
                  inputMode="decimal"
                  className="font-mono-instr tabular-nums"
                />
                <Campo
                  label="Combustível (%)"
                  id="saida_combustivel_pct"
                  name="saida_combustivel_pct"
                  inputMode="numeric"
                  className="font-mono-instr tabular-nums"
                />
              </div>
              <CampoTextarea
                label="Condição antes de sair"
                id="saida_estado"
                name="saida_estado"
                rows={2}
                placeholder="Ex.: casco limpo, sem avaria aparente."
                dica="O horário e o seu nome entram sozinhos."
              />
            </div>
            <button className={`${ACAO_NAO_ESTICA} rounded-xl bg-accent py-3.5 font-semibold text-acao-texto`}>
              Registrar saída
            </button>
          </form>
        </>
      )}

      <SecaoPagina icone="calendario">Últimas movimentações</SecaoPagina>
      {historico.length === 0 ? (
        <EstadoVazio
          variant="linha"
          icone="calendario"
          titulo="Nenhuma movimentação registrada ainda"
          descricao={editavel ? "A primeira saída registrada abre o histórico desta unidade." : undefined}
        />
      ) : (
        <div className="space-y-2">
          {historico.map((m) => {
            const comparacao = linhaDaComparacao({
              saidaEm: m.saida_em,
              saidaHoras: m.saida_horas,
              saidaCombustivelPct: m.saida_combustivel_pct,
              retornoEm: m.retorno_em,
              retornoHoras: m.retorno_horas,
              retornoCombustivelPct: m.retorno_combustivel_pct,
            })
            const quem = [nomeDe(m.responsavel_id), nomeDe(m.retorno_responsavel_id)]
              .filter(Boolean)
            // Quem tirou pode não ser quem devolveu — quando forem dois, a
            // linha diz os dois; quando for um, não repete o nome.
            const linhaQuem = quem.length === 2 && quem[0] !== quem[1]
              ? `${quem[0]} → ${quem[1]}`
              : quem[0] ?? null

            return (
              <div key={m.id} className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5">
                <div className="flex items-center gap-2">
                  <p className="titulo-card min-w-0 flex-1">
                    {new Date(m.saida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                  {m.ocorrencia_id && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-crit">
                      <Icone nome="alerta" className="size-4" />
                      <span className="apoio">ocorrência</span>
                    </span>
                  )}
                </div>
                {comparacao && <p className="apoio mt-1 font-mono-instr text-dim">{comparacao}</p>}
                {linhaQuem && <p className="apoio mt-1 text-dim">{linhaQuem}</p>}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

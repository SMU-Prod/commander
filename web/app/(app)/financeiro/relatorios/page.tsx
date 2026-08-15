import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { AcoesUniversais, FinanceiroNav } from "@/components/ui/financeiro-nav"
import { Campo } from "@/components/ui/campo"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  compararPeriodos, periodoAnterior, periodoAnual, periodoMensal, periodoPersonalizado,
  resumoFinanceiro, type Periodo,
} from "@/lib/domain/financeiro"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { LancamentoFinanceiro } from "@/lib/db/types"

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Financeiro · Relatórios (PRD FINAL §9.3): "Mensal, anual e período
 * personalizado. Despesas, entradas, saldo, recorrentes, variáveis,
 * categoria, média mensal, maior categoria e comparação entre períodos."
 * Os nove itens estão nesta tela, cada um saindo de `resumoFinanceiro`.
 *
 * O que o PRD pede e NÃO está aqui: "Commander Pro: visão consolidada de
 * todas as embarcações". Commander Pro é um dos sete planos do PRD §2 e o
 * código ainda tem um nível pago só — implementar o consolidado agora
 * exigiria decidir plano, que é decisão de produto em aberto.
 */
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; ano?: string; mes?: string; de?: string; ate?: string }>
}) {
  const sp = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }

  const hoje = hojeISO()
  const [anoHoje, mesHoje] = hoje.split("-").map(Number)
  const modo = sp.modo === "anual" || sp.modo === "livre" ? sp.modo : "mensal"

  let periodo: Periodo
  if (modo === "anual") {
    const ano = Number(sp.ano) || anoHoje
    periodo = periodoAnual(ano)
  } else if (modo === "livre" && ISO.test(sp.de ?? "") && ISO.test(sp.ate ?? "") && sp.de! <= sp.ate!) {
    periodo = periodoPersonalizado(sp.de!, sp.ate!)
  } else if (modo === "livre") {
    // Período livre sem datas válidas ainda: mostra o mês corrente e deixa o
    // formulário aberto — melhor que uma tela vazia sem explicação.
    periodo = periodoMensal(anoHoje, mesHoje)
  } else {
    const ano = Number(sp.ano) || anoHoje
    const mes = Number(sp.mes) || mesHoje
    periodo = periodoMensal(ano, mes >= 1 && mes <= 12 ? mes : mesHoje)
  }
  const anterior = periodoAnterior(periodo)

  const supabase = await supabaseServer()
  const { data: brutos, error } = await supabase.from("lancamentos_financeiros")
    .select("*").eq("embarcacao_id", painel.embarcacao.id)
    .gte("data", anterior.de).lte("data", periodo.ate)
  if (error) throw new Error("Não foi possível carregar o relatório. Recarregue a página.")

  const paraResumo = ((brutos ?? []) as LancamentoFinanceiro[]).map((l) => ({
    tipo: l.tipo, categoria: l.categoria, valorCentavos: l.valor_centavos,
    data: l.data, status: l.status, recorrente: l.recorrencia_id != null,
  }))
  const r = resumoFinanceiro(paraResumo, periodo)
  const rAnterior = resumoFinanceiro(paraResumo, anterior)
  const c = compararPeriodos(r, rAnterior)

  const anos = [anoHoje, anoHoje - 1, anoHoje - 2]
  const meses = Array.from({ length: 12 }, (_, i) => i + 1)
  const anoSelecionado = Number(sp.ano) || anoHoje
  const mesSelecionado = modo === "mensal" ? (Number(sp.mes) || mesHoje) : mesHoje

  return (
    <main>
      <h1 className="titulo-pagina">Financeiro</h1>
      <p className="apoio mt-1 text-dim">Fecha o mês, o ano ou o período que você escolher.</p>

      <FinanceiroNav atual="relatorios" className="mt-4" />
      <AcoesUniversais className="mt-3" />

      <div className="mt-4 flex gap-1.5">
        {([["mensal", "Mensal"], ["anual", "Anual"], ["livre", "Período"]] as const).map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={`/financeiro/relatorios?modo=${valor}`}
            className={`flex h-10 flex-1 items-center justify-center rounded-full border text-sm font-medium ${
              modo === valor ? "border-accent bg-accent text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {rotulo}
          </Link>
        ))}
      </div>

      {modo === "mensal" && (
        <form className="mt-3 flex gap-2">
          <input type="hidden" name="modo" value="mensal" />
          <select name="mes" defaultValue={mesSelecionado}
            className="h-11 flex-1 rounded-[10px] border border-line bg-campo px-3 text-base">
            {meses.map((m) => (
              <option key={m} value={m}>{periodoMensal(anoSelecionado, m).rotulo.split(" de ")[0]}</option>
            ))}
          </select>
          <select name="ano" defaultValue={anoSelecionado}
            className="h-11 w-28 rounded-[10px] border border-line bg-campo px-3 text-base">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="h-11 rounded-[10px] border border-line px-4 text-sm font-semibold">Ver</button>
        </form>
      )}

      {modo === "anual" && (
        <form className="mt-3 flex gap-2">
          <input type="hidden" name="modo" value="anual" />
          <select name="ano" defaultValue={anoSelecionado}
            className="h-11 flex-1 rounded-[10px] border border-line bg-campo px-3 text-base">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="h-11 rounded-[10px] border border-line px-4 text-sm font-semibold">Ver</button>
        </form>
      )}

      {modo === "livre" && (
        <form className="mt-3 space-y-3">
          <input type="hidden" name="modo" value="livre" />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="De" id="de" name="de" type="date" defaultValue={sp.de ?? periodo.de} />
            <Campo label="Até" id="ate" name="ate" type="date" defaultValue={sp.ate ?? periodo.ate} />
          </div>
          <button className="h-11 w-full rounded-[10px] border border-line text-sm font-semibold">Ver período</button>
        </form>
      )}

      <SecaoPagina icone="relatorio">{periodo.rotulo}</SecaoPagina>

      {r.totalLancamentos === 0 ? (
        <EstadoVazio
          icone="cifrao"
          titulo="Nenhum lançamento neste período"
          descricao="Escolha outro período acima, ou registre uma despesa/entrada."
        />
      ) : (
        <>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="rotulo text-dim">Despesas</p>
                <p className="mt-0.5 font-mono-instr text-xl tabular-nums">{formatarReais(r.despesasCentavos)}</p>
                {c.despesasPercentual != null && (
                  <p className={`apoio mt-0.5 inline-flex items-center gap-0.5 ${
                    c.despesasPercentual > 0 ? "text-crit" : c.despesasPercentual < 0 ? "text-ok" : "text-dim"
                  }`}>
                    <Icone nome="chevron" className={`size-3 ${c.despesasPercentual >= 0 ? "-rotate-90" : "rotate-90"}`} />
                    {Math.abs(c.despesasPercentual)}%
                  </p>
                )}
              </div>
              <div>
                <p className="rotulo text-dim">Entradas</p>
                <p className="mt-0.5 font-mono-instr text-xl tabular-nums text-ok">{formatarReais(r.entradasCentavos)}</p>
                {c.entradasPercentual != null && (
                  <p className={`apoio mt-0.5 inline-flex items-center gap-0.5 ${
                    c.entradasPercentual >= 0 ? "text-ok" : "text-crit"
                  }`}>
                    <Icone nome="chevron" className={`size-3 ${c.entradasPercentual >= 0 ? "-rotate-90" : "rotate-90"}`} />
                    {Math.abs(c.entradasPercentual)}%
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <p className="corpo flex justify-between">
                <span className="text-dim">Saldo do período</span>
                <span className={`font-mono-instr font-semibold tabular-nums ${r.saldoCentavos < 0 ? "text-crit" : "text-ok"}`}>
                  {formatarReais(r.saldoCentavos)}
                </span>
              </p>
              <p className="corpo mt-1 flex justify-between">
                <span className="text-dim">Média mensal de despesa</span>
                <span className="font-mono-instr tabular-nums">{formatarReais(r.mediaMensalDespesasCentavos)}</span>
              </p>
              <p className="corpo mt-1 flex justify-between">
                <span className="text-dim">Maior categoria</span>
                <span className="text-right">{r.maiorCategoria ? r.maiorCategoria.rotulo : "—"}</span>
              </p>
              {(r.aPagarCentavos > 0 || r.aReceberCentavos > 0) && (
                <p className="apoio mt-2 text-dim">
                  Fora do saldo: {formatarReais(r.aPagarCentavos)} a pagar e {formatarReais(r.aReceberCentavos)} a receber
                  (pendentes não entram como dinheiro que já circulou).
                </p>
              )}
            </div>
          </div>

          <SecaoPagina icone="repetir">Recorrentes e variáveis</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            <LinhaLista titulo="Recorrentes" subtitulo="Vencimentos de séries" valor={formatarReais(r.recorrentesCentavos)} />
            <LinhaLista titulo="Variáveis" subtitulo="Lançamentos avulsos" valor={formatarReais(r.variaveisCentavos)} />
          </div>

          <SecaoPagina icone="grafico">Por categoria</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {r.porCategoria.map((cat) => (
              <LinhaLista
                key={cat.categoria}
                titulo={cat.rotulo}
                subtitulo={cat.entradasCentavos > 0 ? `Entradas: ${formatarReais(cat.entradasCentavos)}` : undefined}
                valor={formatarReais(cat.despesasCentavos)}
                valorSecundario={r.despesasCentavos > 0
                  ? `${Math.round((cat.despesasCentavos / r.despesasCentavos) * 100)}%`
                  : undefined}
              />
            ))}
          </div>

          <SecaoPagina>Comparado com {anterior.rotulo}</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            <LinhaLista
              titulo="Despesas"
              subtitulo={`Antes: ${formatarReais(rAnterior.despesasCentavos)}`}
              valor={`${c.despesasDiferencaCentavos >= 0 ? "+" : "−"} ${formatarReais(Math.abs(c.despesasDiferencaCentavos))}`}
              valorClassName={c.despesasDiferencaCentavos > 0 ? "text-crit" : "text-ok"}
            />
            <LinhaLista
              titulo="Entradas"
              subtitulo={`Antes: ${formatarReais(rAnterior.entradasCentavos)}`}
              valor={`${c.entradasDiferencaCentavos >= 0 ? "+" : "−"} ${formatarReais(Math.abs(c.entradasDiferencaCentavos))}`}
              valorClassName={c.entradasDiferencaCentavos >= 0 ? "text-ok" : "text-crit"}
            />
          </div>
        </>
      )}
    </main>
  )
}

import { redirect } from "next/navigation"
import { GraficoMesesGastos } from "@/components/grafico-meses-gastos"
import { Icone } from "@/components/icone"
import { AcoesUniversais, FinanceiroNav } from "@/components/ui/financeiro-nav"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { LinhaLista } from "@/components/ui/linha-lista"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  ROTULO_CATEGORIA, compararPeriodos, formatarDataBr, periodoAnterior, periodoMensal,
  proximoVencimento, resumoFinanceiro, rotuloStatus,
} from "@/lib/domain/financeiro"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { LancamentoFinanceiro, RecorrenciaFinanceira } from "@/lib/db/types"

/**
 * Financeiro · Visão Geral (PRD FINAL §9.1). O panorama do mês: quanto saiu,
 * quanto entrou, o que ainda vence e para onde o dinheiro está indo.
 *
 * Lê SÓ de `lancamentos_financeiros` — `eventos.custo_centavos` continua
 * existindo como histórico do evento no Diário, mas somar as duas fontes
 * contaria o mesmo gasto duas vezes (ver migration 042).
 */
export default async function FinanceiroPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }

  const hoje = hojeISO()
  const [ano, mes] = hoje.split("-").map(Number)
  const periodo = periodoMensal(ano, mes)
  const anterior = periodoAnterior(periodo)
  // Janela de 13 meses: cobre o gráfico de 6 meses e o mês anterior da
  // comparação com folga, sem puxar o extrato inteiro da embarcação.
  const inicioJanela = periodoMensal(ano - 1, mes).de

  const supabase = await supabaseServer()
  const [{ data: brutos, error }, { data: recorrentes }] = await Promise.all([
    supabase.from("lancamentos_financeiros").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).gte("data", inicioJanela)
      .order("data", { ascending: false }),
    supabase.from("recorrencias_financeiras").select("*")
      .eq("embarcacao_id", painel.embarcacao.id).eq("ativa", true),
  ])
  if (error) throw new Error("Não foi possível carregar o Financeiro. Recarregue a página.")

  const lancamentos = (brutos ?? []) as LancamentoFinanceiro[]
  const paraResumo = lancamentos.map((l) => ({
    tipo: l.tipo, categoria: l.categoria, valorCentavos: l.valor_centavos,
    data: l.data, status: l.status, recorrente: l.recorrencia_id != null,
  }))
  const r = resumoFinanceiro(paraResumo, periodo)
  const comparacao = compararPeriodos(r, resumoFinanceiro(paraResumo, anterior))

  // Barras dos 6 meses reaproveitam `resumoGastos` (onda 8) — mesma leitura
  // visual do cartão de /hoje, agora alimentada pelo Financeiro.
  const seisMeses = resumoGastos(
    lancamentos
      .filter((l) => l.tipo === "despesa" && l.status === "pago")
      .map((l) => ({ data: l.data, custoCentavos: l.valor_centavos, grupo: ROTULO_CATEGORIA[l.categoria] })),
    hoje,
  )

  // Próximos vencimentos das séries ativas — o que ainda vai vencer, não o
  // que já foi lançado (PRD §9.2: vencimento não é pago até alguém marcar).
  const proximos = ((recorrentes ?? []) as RecorrenciaFinanceira[])
    .map((rec) => ({ rec, data: proximoVencimento({ inicio: rec.inicio, fim: rec.fim, frequencia: rec.frequencia }, hoje) }))
    .filter((x): x is { rec: RecorrenciaFinanceira; data: string } => x.data != null)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 4)

  const pendentes = lancamentos
    .filter((l) => l.status === "pendente")
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5)

  return (
    <main>
      <h1 className="titulo-pagina">Financeiro</h1>
      <p className="apoio mt-1 text-dim">O dinheiro do barco: o que saiu, o que entrou e o que ainda vence.</p>

      <FinanceiroNav atual="visao" className="mt-4" />
      <AcoesUniversais className="mt-3" />

      <SecaoPagina icone="cifrao">{periodo.rotulo}</SecaoPagina>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="rotulo text-dim">Despesas pagas</p>
          {comparacao.despesasPercentual != null && (
            <span className={`apoio inline-flex items-center gap-0.5 ${
              comparacao.despesasPercentual > 0 ? "text-crit" : comparacao.despesasPercentual < 0 ? "text-ok" : "text-dim"
            }`}>
              <Icone nome="chevron" className={`size-3 ${comparacao.despesasPercentual >= 0 ? "-rotate-90" : "rotate-90"}`} />
              {Math.abs(comparacao.despesasPercentual)}% vs. mês anterior
            </span>
          )}
        </div>
        <p className="mt-1 font-mono-instr text-3xl tabular-nums">{formatarReais(r.despesasCentavos)}</p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="rotulo text-dim">Entradas</p>
            <p className="mt-0.5 font-mono-instr text-lg tabular-nums text-ok">{formatarReais(r.entradasCentavos)}</p>
          </div>
          <div>
            <p className="rotulo text-dim">Saldo do mês</p>
            <p className={`mt-0.5 font-mono-instr text-lg tabular-nums ${r.saldoCentavos < 0 ? "text-crit" : ""}`}>
              {formatarReais(r.saldoCentavos)}
            </p>
          </div>
        </div>

        {(r.aPagarCentavos > 0 || r.aReceberCentavos > 0) && (
          <div className="mt-4 border-t border-line pt-3">
            {r.aPagarCentavos > 0 && (
              <p className="corpo flex justify-between">
                <span className="text-dim">A pagar</span>
                <span className="font-mono-instr tabular-nums">{formatarReais(r.aPagarCentavos)}</span>
              </p>
            )}
            {r.aReceberCentavos > 0 && (
              <p className="corpo mt-1 flex justify-between">
                <span className="text-dim">A receber</span>
                <span className="font-mono-instr tabular-nums">{formatarReais(r.aReceberCentavos)}</span>
              </p>
            )}
            {/* O PRD é taxativo: orçamento/proposta não é despesa. "Pendente"
                aqui é conta já assumida — por isso não entra no total pago. */}
            <p className="apoio mt-2 text-dim">Pendente é conta assumida que ainda não foi paga — não entra no total acima.</p>
          </div>
        )}
      </div>

      {r.totalLancamentos === 0 && (
        <EstadoVazio
          className="mt-4"
          icone="cifrao"
          titulo="Nada lançado neste mês ainda"
          descricao="Use + Despesa ou + Entrada acima. O Financeiro funciona sozinho, sem depender de nenhuma outra tela."
        />
      )}

      <SecaoPagina icone="grafico">Despesas dos últimos 6 meses</SecaoPagina>
      <GraficoMesesGastos meses={seisMeses.meses} mesAtual={hoje.slice(0, 7)} />

      {r.porCategoria.length > 0 && (
        <>
          <SecaoPagina icone="relatorio" acao={{ href: "/financeiro/relatorios", rotulo: "Relatórios" }}>
            Por categoria no mês
          </SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {r.porCategoria.map((c) => (
              <LinhaLista
                key={c.categoria}
                titulo={c.rotulo}
                subtitulo={c.entradasCentavos > 0 ? `Entradas: ${formatarReais(c.entradasCentavos)}` : undefined}
                valor={formatarReais(c.despesasCentavos)}
              />
            ))}
          </div>
        </>
      )}

      {proximos.length > 0 && (
        <>
          <SecaoPagina icone="repetir" acao={{ href: "/financeiro/recorrentes", rotulo: "Ver todas" }}>
            Próximos vencimentos
          </SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {proximos.map(({ rec, data }) => (
              <LinhaLista
                key={rec.id}
                href={`/financeiro/recorrentes/${rec.id}`}
                titulo={rec.descricao}
                subtitulo={`${ROTULO_CATEGORIA[rec.categoria]} · vence ${formatarDataBr(data)}`}
                valor={formatarReais(rec.valor_centavos)}
              />
            ))}
          </div>
        </>
      )}

      {pendentes.length > 0 && (
        <>
          <SecaoPagina icone="alerta">Aguardando pagamento</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {pendentes.map((l) => (
              <LinhaLista
                key={l.id}
                href={`/financeiro/lancamentos/${l.id}`}
                titulo={l.descricao}
                subtitulo={`${formatarDataBr(l.data)} · ${rotuloStatus(l.tipo, l.status)}`}
                valor={formatarReais(l.valor_centavos)}
                valorClassName={l.tipo === "entrada" ? "text-ok" : ""}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}

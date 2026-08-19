import Link from "next/link"
import { redirect } from "next/navigation"
import { BarraCapacidade } from "@/components/ui/barra-capacidade"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
import { GraficoBarras } from "@/components/ui/grafico-barras"
import { SecaoPagina } from "@/components/ui/secao-pagina"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import {
  consolidarFrota, inicioDoPeriodo, origensQuePesaram, PERIODOS_FROTA,
  ROTULO_ORIGEM, ROTULO_PERIODO, type CustoLancado, type OrigemCusto, type PeriodoFrota,
} from "@/lib/domain/financeiro-frota"
import { formatarReais } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * CUSTO DA FROTA (onda 78 — PRD §12).
 *
 * Responde a pergunta do ADM em três níveis, de cima pra baixo: quanto a
 * frota custou no período, em que isso foi gasto, e quais unidades puxaram o
 * total. As unidades vêm ordenadas por maior custo — numa frota de 40, quem
 * está no topo é quem merece a próxima conversa.
 *
 * O que esta tela NÃO mostra, por decisão do §12: receita, margem, cobrança
 * de cotista. É custo operacional e só.
 */
export default async function FrotaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const { periodo: periodoBruto } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui o Financeiro.")}`)
  }

  const periodo = (PERIODOS_FROTA as readonly string[]).includes(periodoBruto ?? "")
    ? (periodoBruto as PeriodoFrota)
    : "mes"
  const desde = inicioDoPeriodo(periodo, hojeISO())

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("lancamentos_financeiros")
    .select("embarcacao_id, origem, valor_centavos")
    .eq("tipo", "despesa")
    .gte("data", desde)
    .in("embarcacao_id", painel.embarcacoes.map((e) => e.id))

  // Lançamento sem origem é o que existia antes da onda 74 — entra como
  // "manual" na leitura, sem gravar nada: marcar em massa no banco seria
  // inventar procedência (ver migration 065).
  const lancamentos: CustoLancado[] = (data ?? []).map((l: {
    embarcacao_id: string; origem: OrigemCusto | null; valor_centavos: number
  }) => ({
    embarcacaoId: l.embarcacao_id,
    origem: l.origem ?? "manual",
    valorCentavos: l.valor_centavos,
  }))

  const r = consolidarFrota(painel.embarcacoes, lancamentos)
  const origens = origensQuePesaram(r.porOrigem)

  return (
    <main>
      <CabecalhoDetalhe
        voltarHref="/financeiro"
        voltarRotulo="Financeiro"
        titulo="Custo da frota"
        descricao="Quanto cada unidade custou para operar — e em quê."
      />

      <ChipLinha className="mt-4">
        {PERIODOS_FROTA.map((p) => (
          <Chip key={p} href={p === "mes" ? "/frota" : `/frota?periodo=${p}`} ativo={p === periodo}>
            {ROTULO_PERIODO[p]}
          </Chip>
        ))}
      </ChipLinha>

      <div className="sombra-1 mt-4 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
        <p className="rotulo text-dim">Total da frota</p>
        <p className="mt-1 font-mono-instr text-2xl font-semibold tabular-nums">
          {formatarReais(r.totalCentavos)}
        </p>
        <p className="apoio mt-1 text-dim">
          {painel.embarcacoes.length === 1 ? "1 unidade" : `${painel.embarcacoes.length} unidades`}
          {" · desde "}
          <span className="font-mono-instr tabular-nums">{desde.split("-").reverse().join("/")}</span>
        </p>
      </div>

      {origens.length > 0 && (
        <>
          {/* Onda 79 (instrumentos) — a lista virou `GraficoBarras` (spec §2
              item 5, "Fleet Utilization Trend"): a origem que mais pesou
              entra em destaque (tooltip já aberto), igual à barra do dia
              atual na referência — aqui não há "hoje", então o destaque vai
              para quem mais custou, que é a pergunta que esta seção
              responde. `cor="var(--dado)"` e não o dourado padrão do
              componente: a onda 63 já corrigiu esse mesmo erro em
              `GraficoMesesGastos` (dourado é ação/marca, não dado), e usar o
              padrão aqui reabriria o mesmo defeito. */}
          <SecaoPagina icone="relatorio">Em quê</SecaoPagina>
          <div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-4">
            <GraficoBarras
              pontos={origens.map((o) => ({
                rotulo: ROTULO_ORIGEM[o],
                valor: r.porOrigem[o] / 100,
                apoio: `${Math.round((r.porOrigem[o] / r.totalCentavos) * 100)}% do total`,
                destaque: o === origens[0],
              }))}
              cor="var(--dado)"
              metrica="R$"
              rotulo="Custo por origem"
            />
          </div>
        </>
      )}

      <SecaoPagina icone="embarcacao">Por unidade</SecaoPagina>
      {r.unidades.length === 0 ? (
        <EstadoVazio variant="linha" icone="embarcacao" titulo="Nenhuma unidade cadastrada" />
      ) : (
        <div className="space-y-2">
          {r.unidades.map((u) => (
            <Link
              key={u.embarcacaoId}
              href="/financeiro"
              className="sombra-1 block rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5"
            >
              <p className="titulo-card min-w-0 truncate">{u.nome}</p>
              {/* Onda 79 (instrumentos) — a barra fina + texto separado virou
                  `BarraCapacidade` (spec §2 item 3): o mesmo par número/barra
                  da referência, agora com chip de % e cor por faixa. `total`
                  é o custo da FROTA inteira, não um teto arbitrário — a
                  pergunta que a barra responde continua sendo "que fatia do
                  gasto total é desta unidade", a mesma da barra antiga.
                  `unidadeAntes`: "R$" vem antes do número em português.
                  Zero cai em `neutro` por conta própria (nunca "ok"), o que
                  já é a leitura certa: unidade parada não é uma boa notícia,
                  só não é uma leitura ruim ainda. */}
              <BarraCapacidade
                className="mt-2"
                usado={u.totalCentavos / 100}
                total={r.totalCentavos / 100}
                unidade="R$"
                unidadeAntes
                rotulo={
                  u.totalCentavos === 0
                    // Zero é informação — costuma significar unidade parada,
                    // que é o que o ADM quer notar (§12).
                    ? "Nenhum custo no período"
                    : `${u.percentualDaFrota}% do custo da frota · ${
                        origensQuePesaram(u.porOrigem).slice(0, 2).map((o) => ROTULO_ORIGEM[o]).join(", ")
                      }`
                }
              />
            </Link>
          ))}
        </div>
      )}

      <p className="apoio mt-4 text-dim">
        Só custo operacional. Cobrança de cotista, venda de cota e receita da administradora não
        passam pelo Commander.
      </p>
    </main>
  )
}

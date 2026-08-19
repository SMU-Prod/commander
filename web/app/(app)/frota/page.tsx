import Link from "next/link"
import { redirect } from "next/navigation"
import { CabecalhoDetalhe } from "@/components/ui/cabecalho-detalhe"
import { Chip, ChipLinha } from "@/components/ui/chip"
import { EstadoVazio } from "@/components/ui/estado-vazio"
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
          <SecaoPagina icone="relatorio">Em quê</SecaoPagina>
          <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
            {origens.map((o) => (
              <div key={o} className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0">
                <span className="corpo min-w-0 truncate">{ROTULO_ORIGEM[o]}</span>
                <span className="shrink-0 font-mono-instr text-sm tabular-nums">
                  {formatarReais(r.porOrigem[o])}
                </span>
              </div>
            ))}
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
              <div className="flex items-baseline justify-between gap-2">
                <p className="titulo-card min-w-0 truncate">{u.nome}</p>
                <span className="shrink-0 font-mono-instr text-sm font-semibold tabular-nums">
                  {formatarReais(u.totalCentavos)}
                </span>
              </div>
              {/* Barra proporcional: numa frota de 40, o olho pega a
                  diferença antes de ler qualquer número. */}
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel2">
                <div className="h-full rounded-full bg-dado" style={{ width: `${u.percentualDaFrota}%` }} />
              </div>
              <p className="apoio mt-1.5 text-dim">
                {u.totalCentavos === 0
                  // Zero é informação — costuma significar unidade parada,
                  // que é o que o ADM quer notar (§12).
                  ? "Nenhum custo no período"
                  : `${u.percentualDaFrota}% do custo da frota · ${
                      origensQuePesaram(u.porOrigem).slice(0, 2).map((o) => ROTULO_ORIGEM[o]).join(", ")
                    }`}
              </p>
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

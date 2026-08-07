import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { grupoDoEvento, TIPO_ROTULO } from "@/lib/domain/diario"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

export default async function GastosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "gastos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os gastos."))
  const hoje = hojeISO()
  const inicioJanela = `${Number(hoje.slice(0, 4)) - 1}-01-01`
  const supabase = await supabaseServer()
  const { data: eventos, error } = await supabase.from("eventos")
    .select("*").eq("embarcacao_id", painel.embarcacao.id)
    .not("custo_centavos", "is", null).gte("data", inicioJanela)
    .order("data", { ascending: false })
  if (error) throw new Error("Não foi possível carregar os gastos. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))
  const comCusto = ((eventos ?? []) as Evento[]).filter((e) => (e.custo_centavos ?? 0) > 0)
  const entradas = comCusto.map((e) => ({
    data: e.data,
    custoCentavos: e.custo_centavos as number,
    grupo: grupoDoEvento({
      tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
      tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
    }),
  }))
  const r = resumoGastos(entradas, hoje)
  const maiorMes = Math.max(1, ...r.meses.map((m) => m.totalCentavos))

  return (
    <main>
      <a href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </a>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="titulo-pagina">Gastos</h1>
        <Link href="/diario/novo" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">
          <span className="inline-flex items-center gap-1">
            <Icone nome="mais" className="size-4" /> Lançamento
          </span>
        </Link>
      </div>

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel p-4">
        <p className="rotulo text-dim inline-flex items-center gap-1.5">
          <Icone nome="cifrao" className="size-3.5" /> Total do mês
        </p>
        <p className="mt-1 font-mono-instr text-3xl tabular-nums">{formatarReais(r.totalMesCentavos)}</p>
        {r.porGrupo.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {r.porGrupo.map((g) => (
              <div key={g.grupo} className="corpo flex justify-between">
                <span className="text-dim">{g.grupo}</span>
                <span className="font-mono-instr tabular-nums">{formatarReais(g.totalCentavos)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="rotulo text-dim mt-6 mb-2 inline-flex items-center gap-1.5">
        <Icone nome="grafico" className="size-3.5" /> Últimos 6 meses
      </p>
      <div className="sombra-1 flex items-end gap-2 rounded-[14px] border border-line bg-panel p-4" style={{ height: 132 }}>
        {r.meses.map((m) => (
          <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
            <div
              className={`w-full rounded-t ${m.mes === hoje.slice(0, 7) ? "bg-accent-forte" : "bg-panel2 border border-line"}`}
              style={{ height: `${Math.round((m.totalCentavos / maiorMes) * 100)}%`, minHeight: m.totalCentavos > 0 ? 4 : 1 }}
            />
            <span className="font-mono-instr text-[10px] uppercase text-dim">{m.rotulo}</span>
          </div>
        ))}
      </div>

      <p className="rotulo text-dim mt-6 mb-2">Lançamentos recentes</p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {comCusto.length === 0 && (
          <p className="corpo py-4 text-dim">
            Nenhum gasto registrado. Registre custos nos eventos do diário e eles aparecem aqui.
          </p>
        )}
        {comCusto.slice(0, 20).map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="titulo-card">{e.descricao ?? TIPO_ROTULO[e.tipo] ?? e.tipo}</p>
              <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
                {e.data.split("-").reverse().join("/")}
              </p>
            </div>
            <span className="font-mono-instr text-sm tabular-nums">{formatarReais(e.custo_centavos as number)}</span>
          </div>
        ))}
      </div>
    </main>
  )
}

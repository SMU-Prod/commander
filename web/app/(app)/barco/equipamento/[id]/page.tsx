import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, PESO } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import { formatarReais } from "@/lib/domain/gastos"

export default async function EquipamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) notFound()

  const hoje = hojeISO()
  const itens = painel.itens
    .filter((i) => i.equipamento_id === id)
    .map((i) => ({ item: i, r: calcularSemaforo(itemMonitoradoToItemCalc(i), equipamento.horas_atuais ?? null, hoje) }))
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])
  const statusGeral = itens[0]?.r.status ?? "ok"

  const supabase = await supabaseServer()
  const { data: eventos } = await supabase.from("eventos")
    .select("id, data, tipo, descricao, horas_no_momento, custo_centavos")
    .eq("equipamento_id", id).order("data", { ascending: false }).limit(10)

  return (
    <main>
      <Link href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">
        ‹ Barco
      </Link>
      <div className="mt-3">
        <Horimetro
          rotulo={`Motor ${equipamento.posicao ?? ""} — ${[equipamento.marca, equipamento.modelo].filter(Boolean).join(" ")}`}
          horas={equipamento.horas_atuais ?? 0}
          status={statusGeral}
          grande
        />
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Itens monitorados</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {itens.map(({ item, r }) => (
          <div key={item.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <Farol status={r.status} />
            <div className="flex-1">
              <p className="text-sm">{item.nome}</p>
              <p className="text-xs text-dim">
                {item.intervalo_horas != null && `a cada ${item.intervalo_horas} h`}
                {item.intervalo_horas != null && item.intervalo_meses != null && " ou "}
                {item.intervalo_meses != null && `${item.intervalo_meses} meses`}
              </p>
            </div>
            <span className="font-mono-instr text-xs tabular-nums text-dim">
              {r.status === "vencido"
                ? "vencido"
                : r.horasRestantes != null
                  ? `${Math.round(r.horasRestantes)} h`
                  : r.diasRestantes != null
                    ? `${r.diasRestantes} d`
                    : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <p className="font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Histórico</p>
        <Link href={`/diario/novo?alvo=${encodeURIComponent(`eq:${id}`)}`} className="text-sm text-accent-forte">
          Registrar serviço
        </Link>
      </div>
      <div className="mt-2 rounded-[14px] border border-line bg-panel px-4">
        {(eventos ?? []).length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum serviço registrado neste equipamento ainda.</p>
        )}
        {(eventos ?? []).map((e) => (
          <div key={e.id} className="border-b border-line py-3 last:border-0">
            <p className="text-sm font-medium">{e.descricao ?? e.tipo}</p>
            <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
              {e.data.split("-").reverse().join("/")}
              {e.horas_no_momento != null ? ` · ${e.horas_no_momento.toLocaleString("pt-BR")} h` : ""}
              {e.custo_centavos != null ? ` · ${formatarReais(e.custo_centavos)}` : ""}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}

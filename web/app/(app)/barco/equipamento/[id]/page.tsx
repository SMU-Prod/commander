import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"

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

  return (
    <main>
      <Link href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent">
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
    </main>
  )
}

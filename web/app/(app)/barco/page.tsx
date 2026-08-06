import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"

const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

export default async function BarcoPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const statusDoEquipamento = (eqId: string): StatusFarol =>
    itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const motores = equipamentos.filter((e) => e.tipo === "motor")
  const documentos = itens.filter((i) => i.equipamento_id === null)

  return (
    <main>
      <h1 className="text-xl font-semibold">{embarcacao.nome}</h1>
      <p className="text-sm text-dim">
        {[embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")}
      </p>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Motores</p>
      <div className="grid grid-cols-2 gap-2">
        {motores.map((m) => (
          <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
            <Horimetro
              rotulo={m.posicao ?? "Motor"}
              horas={m.horas_atuais ?? 0}
              status={statusDoEquipamento(m.id)}
            />
          </Link>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Documentos e embarcação</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum vencimento cadastrado ainda.</p>
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <span className="flex-1 text-sm">{i.nome}</span>
              <span className="font-mono-instr text-xs tabular-nums text-dim">
                {r.diasRestantes != null
                  ? r.diasRestantes < 0
                    ? `vencido há ${-r.diasRestantes} d`
                    : `${r.diasRestantes} dias`
                  : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </main>
  )
}

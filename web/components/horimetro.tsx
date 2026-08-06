import { Farol } from "@/components/farol"
import type { StatusFarol } from "@/lib/domain/semaforo"

export function Horimetro({
  rotulo,
  horas,
  status,
  grande = false,
}: {
  rotulo: string
  horas: number
  status: StatusFarol
  grande?: boolean
}) {
  const texto = horas.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (
    <div className="rounded-[10px] border border-line bg-meter text-meter-texto px-3 py-2 font-mono-instr tabular-nums">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[.14em] text-meter-dim">
        {rotulo} <Farol status={status} />
      </div>
      <div className={grande ? "text-4xl" : "text-2xl"}>
        {texto} <small className="text-sm text-meter-dim">h</small>
      </div>
    </div>
  )
}

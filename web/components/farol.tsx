import type { StatusFarol } from "@/lib/domain/semaforo"

const COR: Record<StatusFarol, string> = {
  ok: "bg-ok shadow-[0_0_6px_rgba(47,208,122,.7)]",
  atencao: "bg-warn shadow-[0_0_6px_rgba(255,176,32,.7)]",
  vencido: "bg-crit shadow-[0_0_6px_rgba(255,92,92,.7)]",
}

export function Farol({ status }: { status: StatusFarol }) {
  return <span aria-label={status} className={`inline-block size-2 shrink-0 rounded-full ${COR[status]}`} />
}

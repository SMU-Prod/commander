import { faroDoEstado, ROTULO_ESTADO, type EstadoOcorrencia } from "@/lib/domain/ocorrencias"
import type { StatusFarol } from "@/lib/domain/semaforo"

const COR: Record<StatusFarol, string> = {
  ok: "bg-ok shadow-[0_0_6px_rgba(47,208,122,.7)]",
  atencao: "bg-warn shadow-[0_0_6px_rgba(255,176,32,.7)]",
  vencido: "bg-crit shadow-[0_0_6px_rgba(255,92,92,.7)]",
}

export function Farol({ status }: { status: StatusFarol }) {
  return <span aria-label={status} className={`inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] ${COR[status]}`} />
}

/**
 * Farol de uma OCORRÊNCIA — existe porque "anulada" (onda 44, PRD §7) não
 * tem cor de farol: `faroDoEstado` devolve null nesse caso. Um ponto verde
 * ao lado de "Anulada" diria "foi resolvido", e não foi — ninguém consertou
 * nada, o registro é que não valia. Aqui vira um ponto neutro, apagado,
 * sem brilho: presente no histórico, mas visivelmente fora de jogo.
 *
 * Toda tela que mostra estado de ocorrência usa este componente em vez de
 * `<Farol status={faroDoEstado(...)} />`, pra que a decisão visual do
 * "anulada" more num lugar só.
 */
export function FarolOcorrencia({ estado }: { estado: EstadoOcorrencia }) {
  const status = faroDoEstado(estado)
  if (status) return <Farol status={status} />
  return (
    <span
      aria-label={ROTULO_ESTADO[estado]}
      className="inline-block size-2 shrink-0 rounded-[var(--raio-pilula)] border border-dim/60 bg-transparent"
    />
  )
}

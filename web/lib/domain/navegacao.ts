import { haversineNm } from "@/lib/domain/geo"

/** Navegacao ponto-a-ponto do navegador de bordo. Puro e testavel. */

export function msParaNos(ms: number | null): number | null {
  if (ms == null) return null
  return ms * 1.9438445
}

/** Rumo verdadeiro inicial (great circle) em graus 0-360. */
export function rumoGraus(de: { la: number; lo: number }, para: { la: number; lo: number }): number {
  const f1 = (de.la * Math.PI) / 180
  const f2 = (para.la * Math.PI) / 180
  const dl = ((para.lo - de.lo) * Math.PI) / 180
  const y = Math.sin(dl) * Math.cos(f2)
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

/** ETA em minutos; null abaixo de meio no (parado/garrando, eta nao faz sentido). */
export function etaMinutos(distanciaNm: number, velKt: number): number | null {
  if (velKt < 0.5) return null
  return Math.round((distanciaNm / velKt) * 60)
}

export function foraDoRaio(
  ancora: { la: number; lo: number },
  atual: { la: number; lo: number },
  raioM: number,
): boolean {
  return haversineNm(ancora, atual) * 1852 > raioM
}

/** "ha 3 dias" / "ha 2 h" / "ha 30 min" / "agora ha pouco" — para o card do parceiro. */
export function tempoDesde(iso: string, agoraIso: string): string {
  const ms = new Date(agoraIso).getTime() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 5) return "agora há pouco"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? "há 1 dia" : `há ${d} dias`
}

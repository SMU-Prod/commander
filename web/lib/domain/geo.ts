export interface PontoTrilha {
  t: number
  la: number
  lo: number
}

const RAIO_TERRA_NM = 3440.065
const LIMIAR_MOVIMENTO_KT = 2
export const MAX_PONTOS_TRILHA = 4000

export function haversineNm(a: { la: number; lo: number }, b: { la: number; lo: number }): number {
  const rad = Math.PI / 180
  const dLa = (b.la - a.la) * rad
  const dLo = (b.lo - a.lo) * rad
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(a.la * rad) * Math.cos(b.la * rad) * Math.sin(dLo / 2) ** 2
  return 2 * RAIO_TERRA_NM * Math.asin(Math.sqrt(h))
}

export interface ResumoTrilha {
  distanciaNm: number
  duracaoH: number
  tempoMovimentoH: number
  velMediaKt: number
  velMaxKt: number
}

export function resumoTrilha(pontos: PontoTrilha[]): ResumoTrilha {
  if (pontos.length < 2) {
    return { distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 }
  }
  let distanciaNm = 0
  let tempoMovimentoH = 0
  let velMaxKt = 0
  for (let i = 1; i < pontos.length; i++) {
    const dNm = haversineNm(pontos[i - 1], pontos[i])
    const dtH = (pontos[i].t - pontos[i - 1].t) / 3600
    if (dtH <= 0) continue
    const vKt = dNm / dtH
    distanciaNm += dNm
    if (vKt > LIMIAR_MOVIMENTO_KT) {
      tempoMovimentoH += dtH
      if (vKt > velMaxKt) velMaxKt = vKt
    }
  }
  const duracaoH = (pontos[pontos.length - 1].t - pontos[0].t) / 3600
  const velMediaKt = tempoMovimentoH > 0 ? distanciaNm / tempoMovimentoH : 0
  return { distanciaNm, duracaoH, tempoMovimentoH, velMediaKt, velMaxKt }
}

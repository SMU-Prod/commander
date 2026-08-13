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

/** Chave de uma grade de células geográficas de `tamanhoGraus`° de lado —
 *  usada pra política de cache do painel de tempo (onda 20, ver
 *  web/components/mapa/tempo-painel.tsx): duas posições na MESMA célula
 *  reaproveitam o último boletim buscado, em vez de bater na API a cada tick
 *  do GPS. `Math.floor` (não arredondamento) garante que a mesma célula
 *  sempre produz a mesma chave, sem depender de onde dentro dela o ponto cai. */
export function celulaGeografica(la: number, lo: number, tamanhoGraus: number): string {
  const cLa = Math.floor(la / tamanhoGraus)
  const cLo = Math.floor(lo / tamanhoGraus)
  return `${cLa}:${cLo}`
}

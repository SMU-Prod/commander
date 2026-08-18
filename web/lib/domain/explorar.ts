import { haversineNm } from "@/lib/domain/geo"

/**
 * EXPLORAR — a folha de "mais próximos" do mapa (canvas tela-3h, onda 62).
 *
 * O canvas é "metade carta, metade lista": embaixo do mapa vive uma folha com
 * os parceiros mais próximos e a distância "sempre em MN, sempre em mono".
 * A conta mora aqui, pura e testável — a tela só pergunta "quais são os N
 * mais próximos deste centro?" e desenha a resposta.
 *
 * Reusa `haversineNm` de geo.ts (a MESMA milha náutica da trilha e da rota) —
 * uma segunda fórmula de distância seria uma segunda verdade.
 */

export interface PontoGeografico {
  lat: number
  lng: number
}

/** "0,4 MN", "11,8 MN" — vírgula de pt-BR, uma casa decimal (mais que isso é
 *  falsa precisão numa distância de haversine), e a unidade que o canvas
 *  fixou: MN, milha náutica em português. Acima de 100 a casa decimal deixa
 *  de informar e vira ruído — sai. */
export function formatarMN(nm: number): string {
  if (!Number.isFinite(nm) || nm < 0) return "— MN"
  if (nm >= 100) return `${Math.round(nm)} MN`
  return `${nm.toFixed(1).replace(".", ",")} MN`
}

/**
 * Os `n` pontos mais próximos do centro, cada um com a distância já
 * calculada. Não muta a lista de entrada; empate de distância preserva a
 * ordem original (sort estável) — determinístico entre renderizações.
 */
export function maisProximos<T extends PontoGeografico>(
  pontos: readonly T[],
  centro: PontoGeografico,
  n: number,
): (T & { distanciaNm: number })[] {
  return pontos
    .map((p) => ({
      ...p,
      distanciaNm: haversineNm({ la: centro.lat, lo: centro.lng }, { la: p.lat, lo: p.lng }),
    }))
    .sort((a, b) => a.distanciaNm - b.distanciaNm)
    .slice(0, Math.max(0, n))
}

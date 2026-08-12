// Onda 23 — a rota "engessada": o A* anda em celulas de grade (3,6 km na
// nacional), entao o CAMINHO calculado tem segmentos retos longos e quinas
// duras nas viradas — matematicamente correto (e o corredor navegavel de
// verdade), mas feio de olhar num app "de ponta". Este modulo NAO mexe no
// caminho: e so um redesenho da LINHA na hora de desenhar no mapa. O
// corredor navegavel continua sendo exatamente o que `lib/domain/rota.ts`
// (A* + `suavizar` string-pulling, intocados) devolveu — nenhuma celula
// muda, nenhum teste de dominio muda. So os PIXELS da curva ficam macios.
//
// Algoritmo: Chaikin (corner-cutting), a tecnica classica de suavizacao de
// polilinha usada em apps de navegacao serios (curvas suaves sem inflar a
// forma geral do tracado). Cada passada substitui cada segmento [P,Q] por
// dois pontos a 25% e 75% do caminho entre eles — "corta a quina" sem
// afastar a curva do desenho original. 2-3 passadas bastam pra amaciar uma
// grade de 3,6 km sem transformar a rota numa forma irreconhecivel.
//
// Extremos preservados de proposito: origem e destino (as pontas da rota,
// onde o navegante realmente esta ou vai chegar) NUNCA se movem — so as
// quinas INTERNAS (viradas) sao arredondadas. Por isso o primeiro e o
// ultimo ponto de cada passada saem sem corte, e so os segmentos entre eles
// sao cortados.

/** Um ponto no plano — aqui, coordenadas GeoJSON [longitude, latitude], a
 *  mesma ordem que `LineString.coordinates` usa (ver navegar-mapa.tsx). A
 *  funcao e agnostica de unidade: funciona igual pra qualquer par [x, y]. */
export type Ponto = readonly [number, number]

/** Uma passada de Chaikin: cada segmento interno [pontos[i], pontos[i+1]]
 *  vira dois pontos (25%/75% do caminho); o primeiro e o ultimo ponto da
 *  entrada sao copiados sem alteracao pro resultado. */
function umaPassadaChaikin(pontos: readonly Ponto[]): Ponto[] {
  const resultado: Ponto[] = [pontos[0]]
  for (let i = 0; i < pontos.length - 1; i++) {
    const [x0, y0] = pontos[i]
    const [x1, y1] = pontos[i + 1]
    resultado.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25])
    resultado.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75])
  }
  resultado.push(pontos[pontos.length - 1])
  return resultado
}

/** Numero de passadas padrao — 2 amacia o suficiente pra tirar a aparencia
 *  "poligono de grade" das rotas nacionais sem custar mais que um punhado de
 *  multiplicacoes por ponto (a rota mais longa da area tem poucas dezenas de
 *  waypoints depois do string-pulling de `suavizar`, nunca milhares). */
const PASSADAS_PADRAO = 2

/** Suaviza uma polilinha SO visualmente (Chaikin corner-cutting), pra
 *  desenhar no mapa. Funcao pura: nao muta `pontos`, nao consulta grade nem
 *  agua/terra — e so geometria sobre os pontos que ja foram calculados. Com
 *  menos de 3 pontos nao ha quina nenhuma pra cortar (uma linha reta ja e
 *  "suave"): devolve uma copia sem alteracao, extremos incluidos. */
export function suavizarChaikin(pontos: readonly Ponto[], passadas: number = PASSADAS_PADRAO): Ponto[] {
  if (pontos.length < 3 || passadas <= 0) return pontos.map((p) => [...p] as unknown as Ponto)
  let atual: readonly Ponto[] = pontos
  for (let i = 0; i < passadas; i++) atual = umaPassadaChaikin(atual)
  return atual as Ponto[]
}

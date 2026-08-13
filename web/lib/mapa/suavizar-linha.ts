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
//
// Onda 27 — corner-cutting perto da costa pode raspar terra: caso real de
// producao (13/08/2026, print do dono), rota longa terminando perto de
// Mangaratiba/baia de Ilha Grande. O caminho CRU (A-estrela + string-pulling
// de lib/domain/rota.ts) nunca toca terra — cada segmento dele ja e
// validado (linha de visao livre contra a mascara). O problema e geometrico
// e especifico do Chaikin: cortar a quina EXATAMENTE onde a rota faz uma
// curva fechada pra contornar uma ponta de terra pode desenhar um "atalho"
// que raspa a propria ponta que a rota estava contornando — os dois pontos
// cortados (perto da quina, um de cada lado) podem individualmente cair em
// agua, mas a RETA entre eles cruzar terra. `suavizarChaikinComAgua` resolve
// isso validando exatamente esse atalho (nao os pontos isolados) e voltando
// a quina ORIGINAL (sem corte) quando o atalho nao e seguro.

/** Um ponto no plano — aqui, coordenadas GeoJSON [longitude, latitude], a
 *  mesma ordem que `LineString.coordinates` usa (ver navegar-mapa.tsx). A
 *  funcao e agnostica de unidade: funciona igual pra qualquer par [x, y]. */
export type Ponto = readonly [number, number]

function pontoNoSegmento(a: Ponto, b: Ponto, t: number): Ponto {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Uma passada de Chaikin. `segmentoSeguro` (onda 27, opcional) recebe o
 *  ATALHO que a passada introduziria num vertice INTERNO (o segmento entre
 *  o corte final de um lado da quina e o corte inicial do outro) e devolve
 *  se ele e seguro pra desenhar; `undefined`/omitido = sempre corta, mesmo
 *  comportamento de antes desta onda.
 *
 *  Por que so o ATALHO precisa de checagem, nao os pontos individuais: os
 *  dois pontos de corte de um segmento [pontos[i], pontos[i+1]] (a 25% e
 *  75%) ficam SOBRE esse mesmo segmento — qualquer sub-trecho de uma reta ja
 *  validada (o segmento de entrada, herdado de uma passada anterior ou do
 *  caminho original de lib/domain/rota.ts) e automaticamente seguro, nao
 *  precisa checar de novo. O UNICO trecho NOVO que a passada introduz e o
 *  atalho entre o corte final do segmento [i-1,i] e o corte inicial do
 *  segmento [i,i+1] — a reta que de fato substitui a quina no vertice
 *  interno `pontos[i]`. E so esse atalho que pode cruzar terra (a quina
 *  existe pra CONTORNAR alguma coisa; cortar ela e o que pode raspar nisso).
 *  Quando o atalho nao e seguro, a quina original (`pontos[i]`, ja validada)
 *  e preservada sem corte nessa passada — nas passadas seguintes ela volta a
 *  ser candidata (contra os pontos vizinhos, ja possivelmente cortados). */
function umaPassadaChaikin(pontos: readonly Ponto[], segmentoSeguro?: (a: Ponto, b: Ponto) => boolean): Ponto[] {
  const n = pontos.length
  if (n < 2) return pontos.map((p) => [...p] as unknown as Ponto)

  const cortes = pontos.slice(0, n - 1).map((p, i) => ({
    q1: pontoNoSegmento(p, pontos[i + 1], 0.25),
    q2: pontoNoSegmento(p, pontos[i + 1], 0.75),
  }))

  const resultado: Ponto[] = [pontos[0], cortes[0].q1]
  for (let i = 1; i < n - 1; i++) {
    const atalhoA = cortes[i - 1].q2
    const atalhoB = cortes[i].q1
    if (!segmentoSeguro || segmentoSeguro(atalhoA, atalhoB)) {
      resultado.push(atalhoA, atalhoB) // corta a quina normalmente
    } else {
      resultado.push(pontos[i]) // atalho cruzaria terra: preserva a quina original
    }
  }
  resultado.push(cortes[n - 2].q2, pontos[n - 1])
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

/** Mesma suavizacao de `suavizarChaikin`, mas com verificacao de agua (onda
 *  27) — ver a docstring de `umaPassadaChaikin` pro problema exato que isso
 *  resolve (o ATALHO de uma quina cortada raspando terra, nao os pontos
 *  isolados). `segmentoSeguro(a, b)` recebe dois pontos [lon, lat] (mesmo
 *  formato de `Ponto`) e devolve `true` se a RETA entre eles e navegavel;
 *  quem chama decide contra qual grade validar isso (o worker, que tem a(s)
 *  grade(s) carregada(s) — este modulo continua agnostico de grade/agua, so
 *  orquestra a chamada, idealmente reusando a mesma logica de linha-de-
 *  visao-livre que o A* ja usa — ver `segmentoEmAgua` em lib/domain/rota.ts).
 *  Com menos de 3 pontos ou 0 passadas, devolve copia sem alteracao — mesma
 *  regra de `suavizarChaikin`, nada ha pra verificar. */
export function suavizarChaikinComAgua(
  pontos: readonly Ponto[],
  segmentoSeguro: (a: Ponto, b: Ponto) => boolean,
  passadas: number = PASSADAS_PADRAO,
): Ponto[] {
  if (pontos.length < 3 || passadas <= 0) return pontos.map((p) => [...p] as unknown as Ponto)
  let atual: readonly Ponto[] = pontos
  for (let i = 0; i < passadas; i++) atual = umaPassadaChaikin(atual, segmentoSeguro)
  return atual as Ponto[]
}

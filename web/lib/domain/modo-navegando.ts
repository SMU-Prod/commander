import { haversineNm } from "@/lib/domain/geo"
import type { Coord } from "@/lib/domain/rota"

/** Matematica pura do "modo navegando" (onda 26) — o Waze do Commander: a
 *  camera passa a perseguir a embarcacao (proa pra cima) enquanto ela
 *  navega, com um painel de bordo mostrando proxima virada/distancia
 *  restante/ETA. Este modulo NAO desenha nada — quem chama (`NavegarMapa`,
 *  web/components/mapa/navegar-mapa.tsx) e quem move o `map.easeTo` de
 *  verdade. Aqui so os limiares e as contas, cada um com teste. */

// ---------------------------------------------------------------------------
// Entrada/saida do modo
// ---------------------------------------------------------------------------

/** Nos abaixo disso = "atracado balançando", nao "navegando". Mesmo valor de
 *  `LIMIAR_MOVIMENTO_KT` em web/lib/domain/geo.ts (o filtro que decide se um
 *  trecho da trilha conta como "em movimento" pra velocidade media) — e o
 *  mesmo julgamento ("isso e navegacao de verdade, nao balanco de doca")
 *  aplicado aqui pra decidir se entra no modo. Repetido (nao importado) de
 *  proposito: geo.ts nao exporta a constante, e os dois limiares podem um
 *  dia divergir por motivos proprios sem acoplar os dois arquivos. */
const LIMIAR_ENTRADA_NAVEGANDO_KT = 2

/** true = velocidade real o bastante pra entrar no modo navegando sozinho.
 *  `null` (sem SOG do GPS ainda) nunca conta como movimento — mesma regra
 *  honesta do resto do app: sem dado, nao finge. A SAIDA do modo NAO usa
 *  esta funcao (ver comentario grande em `NavegarMapa`): uma vez dentro,
 *  parar de andar (farol vermelho, espera numa poita) nao expulsa ninguem —
 *  so chegada, toque manual ou destino cancelado saem, o mesmo
 *  comportamento de qualquer app de navegacao serio. */
export function emMovimento(velKt: number | null): boolean {
  return velKt != null && velKt >= LIMIAR_ENTRADA_NAVEGANDO_KT
}

/** Raio de chegada — maior que o padrao do alarme de ancora (40 m, ver
 *  RAIO_PADRAO_M em navegar-mapa.tsx): ali a embarcacao esta parada e
 *  precisa) de um raio apertado pra pegar garrio cedo; aqui ela ainda esta
 *  em movimento na aproximacao final, e tanto o comprimento do proprio
 *  barco quanto o jitter de GPS crescem um pouco a margem que conta como
 *  "chegou". */
export const RAIO_CHEGADA_DESTINO_M = 50

/** true = a distancia restante ATE O DESTINO FINAL (nao so a proxima
 *  virada — ver `ProgressoRota.distanciaRestanteNm`) ja esta dentro do raio
 *  de chegada. */
export function chegouAoDestino(distanciaRestanteNm: number): boolean {
  return distanciaRestanteNm * 1852 <= RAIO_CHEGADA_DESTINO_M
}

// ---------------------------------------------------------------------------
// Zoom que respira com a velocidade
// ---------------------------------------------------------------------------

/** Zoom parado/bem devagar — perto o bastante pra ler uma boia ou um
 *  parceiro perto da proa. */
const ZOOM_PARADO = 16.5
/** Piso do zoom em alta velocidade — afastado o bastante pra enxergar o que
 *  vem pela frente numa lancha a 25-30 kt sem sair correndo atras do mapa. */
const ZOOM_MINIMO = 12.5
/** Curva em raiz quadrada (nao linear): a diferenca de zoom entre 0 e 5 kt
 *  e bem maior que entre 20 e 25 kt — a maior parte do "respiro" acontece
 *  logo que o barco sai da doca, onde afastar rapido importa mais; em alta
 *  velocidade o zoom already esta perto do piso e nao precisa continuar
 *  caindo na mesma taxa. Valor escolhido testando visualmente contra os
 *  breakpoints de velocidade tipicos de uma lancha (parado, 5 kt de
 *  cruzeiro leve, 15 kt de cruzeiro, 30+ kt planando) — ver teste. */
const FATOR_ZOOM_VELOCIDADE = 0.7

/** Velocidade (nos) -> zoom do Mapbox. Pura, sem numero magico espalhado na
 *  UI (pedido explicito da task) — `NavegarMapa` so chama isto e passa o
 *  resultado pro `map.easeTo`. `null`/velocidade invalida cai no zoom de
 *  parado — nunca afasta o mapa por falta de dado. */
export function zoomPorVelocidade(velKt: number | null): number {
  const v = velKt != null && velKt > 0 ? velKt : 0
  const zoom = ZOOM_PARADO - FATOR_ZOOM_VELOCIDADE * Math.sqrt(v)
  return Math.min(ZOOM_PARADO, Math.max(ZOOM_MINIMO, zoom))
}

// ---------------------------------------------------------------------------
// Amortecimento de rumo (proa pra cima sem tremer)
// ---------------------------------------------------------------------------

/** Menor diferenca angular de `a` pra `b`, em graus, no intervalo [-180,
 *  180). Positivo = `b` esta no sentido horario de `a` (o "caminho curto"
 *  passando por cima, ex.: 359 -> 2 = +3, nao -357); negativo = sentido
 *  anti-horario. E a peca que faz a virada 359°->0° funcionar: sem isso,
 *  amortecer uma media ingenua entre 359 e 2 iria pra ~180 (o lado ERRADO
 *  do circulo). */
export function diferencaAngular(a: number, b: number): number {
  let d = (b - a) % 360
  if (d < -180) d += 360
  if (d >= 180) d -= 360
  return d
}

/** Filtro exponencial simples sobre o rumo: o valor exibido anda so uma
 *  fracao (`fator`, 0-1) do caminho ate a leitura nova a cada chamada, em
 *  vez de saltar pra ela — e o que tira o tremor do jitter de rumo do GPS
 *  da camera (headingGraus troca a cada tick do watcher, e leituras
 *  consecutivas variam alguns graus por ruido mesmo em rumo constante).
 *  `fator` maior = responde mais rapido a uma virada real, mas filtra menos
 *  ruido; menor = mais suave, mais atraso. Sempre anda pelo caminho CURTO
 *  (via `diferencaAngular`), entao atravessar 0°/360° nunca faz a camera
 *  girar o barco inteiro pro lado errado. Resultado sempre normalizado pra
 *  [0, 360). */
export function amortecerRumo(rumoSuavizado: number, rumoNovo: number, fator: number): number {
  const delta = diferencaAngular(rumoSuavizado, rumoNovo)
  const resultado = rumoSuavizado + delta * fator
  return ((resultado % 360) + 360) % 360
}

// ---------------------------------------------------------------------------
// Proxima virada / distancia restante (projecao da posicao na rota)
// ---------------------------------------------------------------------------

export interface ProgressoRota {
  /** Indice do PRIMEIRO ponto do segmento onde a posicao atual projeta mais
   *  perto — ex.: 0 = entre pernas[0] e pernas[1]. */
  indiceSegmentoAtual: number
  /** Distancia real (posicao atual -> fim do segmento atual) — o "vire em
   *  1,2 MN" da task. Quando `ultimoSegmento` e true, isto e a distancia
   *  ate o proprio destino final, nao uma virada de verdade (nao ha mais
   *  pra onde virar). */
  proximaViradaNm: number
  /** proximaViradaNm + soma dos segmentos restantes ate o fim da rota —
   *  distancia total que falta percorrer, seguindo a rota (nao a reta ate o
   *  destino). */
  distanciaRestanteNm: number
  /** true = a posicao projeta no ULTIMO segmento da rota — a "proxima
   *  virada" e, na pratica, a chegada. */
  ultimoSegmento: boolean
}

/** 1 grau de latitude em metros — mesma aproximacao (WGS84 medio) ja usada
 *  em `pontosCirculo`, web/components/mapa/navegar-mapa.tsx, pro circulo do
 *  alarme de ancora. Repetida aqui (nao importada) porque aquela funcao e
 *  privada ao componente — nao vale abrir um import so por uma constante. */
const METROS_POR_GRAU_LAT = 111_320

/** Achata um ponto lat/lon num plano local em METROS, centrado em `latRef`
 *  (a longitude e escalada por cos(latRef) pra nao esticar o plano fora do
 *  equador). Aproximacao deliberada: as pernas de uma rota aqui (grade de
 *  A* com celulas de dezenas de metros a poucos km) nunca sao longas o
 *  bastante pra a curvatura da Terra importar na hora de so ESCOLHER qual
 *  segmento esta mais perto — as distancias finais mostradas na tela usam
 *  `haversineNm` de verdade (esferico), nunca este plano. */
function paraPlanoLocalM(p: Coord, latRef: number): { x: number; y: number } {
  return {
    x: p.lo * METROS_POR_GRAU_LAT * Math.cos((latRef * Math.PI) / 180),
    y: p.la * METROS_POR_GRAU_LAT,
  }
}

/** Distancia AO QUADRADO (em m²) de um ponto ate o segmento [a,b], todos ja
 *  no plano local — ao quadrado porque so serve pra COMPARAR segmentos entre
 *  si (achar o mais perto), nunca e exibida; poupa a raiz quadrada em cada
 *  segmento da rota a cada tick do GPS. */
function distanciaQuadPontoSegmento(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimentoQuad = dx * dx + dy * dy
  if (comprimentoQuad === 0) {
    const ddx = p.x - a.x
    const ddy = p.y - a.y
    return ddx * ddx + ddy * ddy
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimentoQuad))
  const ddx = p.x - (a.x + t * dx)
  const ddy = p.y - (a.y + t * dy)
  return ddx * ddx + ddy * ddy
}

/** Acha em que perna da rota a posicao atual esta (por projecao — a
 *  posicao real do GPS quase nunca cai EXATAMENTE em cima da linha) e
 *  deriva proxima virada + distancia restante a partir dali. `pernas` e
 *  qualquer lista ordenada de pontos origem->destino: tanto a rota pela
 *  agua do A* (`estadoRota.pernas`, ja com varias curvas reais) quanto o
 *  fallback de rumo direto (`[posAtual, destino]`, uma perna so) — quem
 *  chama nao precisa saber qual dos dois é, a funcao trata os dois casos
 *  igual. `null` com menos de 2 pontos (sem rota nenhuma pra projetar). */
export function progressoNaRota(pernas: Coord[], posAtual: Coord): ProgressoRota | null {
  if (pernas.length < 2) return null

  const p = paraPlanoLocalM(posAtual, posAtual.la)
  let melhorIndice = 0
  let melhorDistanciaQuad = Infinity
  for (let i = 0; i < pernas.length - 1; i++) {
    const a = paraPlanoLocalM(pernas[i], posAtual.la)
    const b = paraPlanoLocalM(pernas[i + 1], posAtual.la)
    const d = distanciaQuadPontoSegmento(p, a, b)
    if (d < melhorDistanciaQuad) {
      melhorDistanciaQuad = d
      melhorIndice = i
    }
  }

  const fimSegmento = pernas[melhorIndice + 1]
  const proximaViradaNm = haversineNm(posAtual, fimSegmento)
  let distanciaRestanteNm = proximaViradaNm
  for (let i = melhorIndice + 1; i < pernas.length - 1; i++) {
    distanciaRestanteNm += haversineNm(pernas[i], pernas[i + 1])
  }

  return {
    indiceSegmentoAtual: melhorIndice,
    proximaViradaNm,
    distanciaRestanteNm,
    ultimoSegmento: melhorIndice === pernas.length - 2,
  }
}

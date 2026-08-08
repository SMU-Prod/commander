import { haversineNm } from "@/lib/domain/geo"

export interface Coord {
  la: number
  lo: number
}

export interface Celula {
  x: number
  y: number
}

export interface Grade {
  largura: number
  altura: number
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  /** 1 = agua navegavel, 0 = terra. Indexado por y*largura+x (linha 0 = latMax, como um PNG). */
  agua: Uint8Array
}

/** Nos expandidos antes de desistir. Salvaguarda de runtime p/ nunca travar o navegador
 *  em grades reais de milhoes de celulas — nao e um limite de qualidade da rota, e
 *  protecao contra um caminho patologico (ou grade corrompida) rodar para sempre. */
const LIMITE_NOS_EXPANDIDOS = 2_000_000

/** Raio padrao de snap usado por acharCaminho: ~20 celulas, equivalente a ~1km na
 *  mascara real de costa (~80m/celula) — suficiente pra tirar um ponto perto da praia
 *  de cima de terra sem "teleportar" a origem/destino pra longe do que o usuario pediu. */
const RAIO_SNAP_PADRAO_CELULAS = 20

// custo octile: D para passo ortogonal, D2 para diagonal
const D = 1
const D2 = Math.SQRT2

export function ehAgua(g: Grade, c: Celula): boolean {
  if (c.x < 0 || c.x >= g.largura || c.y < 0 || c.y >= g.altura) return false
  return g.agua[c.y * g.largura + c.x] === 1
}

function aguaNoIndice(g: Grade, idx: number): boolean {
  return g.agua[idx] === 1
}

/** Converte uma coordenada geografica pra celula da grade. Linha 0 = latMax (norte no topo). */
export function paraCelula(g: Grade, p: Coord): Celula {
  const x = Math.floor(((p.lo - g.lngMin) / (g.lngMax - g.lngMin)) * g.largura)
  const y = Math.floor(((g.latMax - p.la) / (g.latMax - g.latMin)) * g.altura)
  return { x, y }
}

/** Converte uma celula pro centro geografico dela (inverso de paraCelula). */
export function paraCoord(g: Grade, c: Celula): Coord {
  const lo = g.lngMin + ((c.x + 0.5) / g.largura) * (g.lngMax - g.lngMin)
  const la = g.latMax - ((c.y + 0.5) / g.altura) * (g.latMax - g.latMin)
  return { la, lo }
}

/** Visita as celulas validas do anel quadrado (distancia de Chebyshev == r) ao redor de (cx,cy). */
function paraCadaCelulaDoAnel(g: Grade, cx: number, cy: number, r: number, visitar: (c: Celula) => void): void {
  const xMin = cx - r
  const xMax = cx + r
  const yMin = cy - r
  const yMax = cy + r
  const considerar = (x: number, y: number) => {
    if (x < 0 || x >= g.largura || y < 0 || y >= g.altura) return
    const c = { x, y }
    if (ehAgua(g, c)) visitar(c)
  }
  for (let x = xMin; x <= xMax; x++) {
    considerar(x, yMin)
    considerar(x, yMax)
  }
  for (let y = yMin + 1; y <= yMax - 1; y++) {
    considerar(xMin, y)
    considerar(xMax, y)
  }
}

/** Busca em aneis crescentes (spiral) pela celula de agua mais proxima, ate `raioCelulas`. */
export function snapParaAgua(g: Grade, p: Coord, raioCelulas: number): Celula | null {
  const base = paraCelula(g, p)
  const cx = Math.min(Math.max(base.x, 0), g.largura - 1)
  const cy = Math.min(Math.max(base.y, 0), g.altura - 1)
  const centro = { x: cx, y: cy }
  if (ehAgua(g, centro)) return centro

  let melhor: Celula | null = null
  let melhorDist = Infinity

  for (let r = 1; r <= raioCelulas; r++) {
    // nenhum anel mais distante consegue vencer um candidato ja achado (min. do anel r e r)
    if (melhor && r > melhorDist) break
    paraCadaCelulaDoAnel(g, cx, cy, r, (c) => {
      const dx = c.x - cx
      const dy = c.y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < melhorDist) {
        melhorDist = dist
        melhor = c
      }
    })
  }
  return melhor
}

/** Heap binario minimo de indices de celula, priorizado pelo fScore (array compartilhado e vivo:
 *  quando um fScore melhora, entradas antigas do mesmo indice no heap passam a "ver" o valor novo
 *  automaticamente, o que dispensa decrease-key explicito). */
class FilaPrioridade {
  private heap: Int32Array
  private tam = 0

  constructor(
    private readonly fScore: Float64Array,
    capacidadeInicial: number,
  ) {
    this.heap = new Int32Array(Math.max(16, capacidadeInicial))
  }

  get vazia(): boolean {
    return this.tam === 0
  }

  private garantirCapacidade(): void {
    if (this.tam < this.heap.length) return
    const maior = new Int32Array(this.heap.length * 2)
    maior.set(this.heap)
    this.heap = maior
  }

  inserir(idx: number): void {
    this.garantirCapacidade()
    let i = this.tam++
    this.heap[i] = idx
    while (i > 0) {
      const pai = (i - 1) >> 1
      if (this.fScore[this.heap[pai]] <= this.fScore[this.heap[i]]) break
      const tmp = this.heap[pai]
      this.heap[pai] = this.heap[i]
      this.heap[i] = tmp
      i = pai
    }
  }

  remover(): number {
    const topo = this.heap[0]
    this.tam--
    this.heap[0] = this.heap[this.tam]
    let i = 0
    for (;;) {
      const esq = 2 * i + 1
      const dir = 2 * i + 2
      let menor = i
      if (esq < this.tam && this.fScore[this.heap[esq]] < this.fScore[this.heap[menor]]) menor = esq
      if (dir < this.tam && this.fScore[this.heap[dir]] < this.fScore[this.heap[menor]]) menor = dir
      if (menor === i) break
      const tmp = this.heap[menor]
      this.heap[menor] = this.heap[i]
      this.heap[i] = tmp
      i = menor
    }
    return topo
  }
}

function heuristicaOctile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy)
}

function reconstruirCaminho(pai: Int32Array, destinoIdx: number, largura: number): Celula[] {
  const caminho: Celula[] = []
  let atual = destinoIdx
  while (atual !== -1) {
    const x = atual % largura
    const y = (atual - x) / largura
    caminho.push({ x, y })
    atual = pai[atual]
  }
  return caminho.reverse()
}

const VIZINHOS_DX = [1, -1, 0, 0, 1, 1, -1, -1]
const VIZINHOS_DY = [0, 0, 1, -1, 1, -1, 1, -1]

/** A* 8-conectado sobre indices de celula. Origem e destino ja precisam ser agua. */
function acharCaminhoEmCelulas(g: Grade, origem: Celula, destino: Celula): Celula[] | null {
  const { largura, altura } = g
  const n = largura * altura
  const idxOrigem = origem.y * largura + origem.x
  const idxDestino = destino.y * largura + destino.x

  if (idxOrigem === idxDestino) return [origem]

  const gScore = new Float64Array(n).fill(Infinity)
  const fScore = new Float64Array(n).fill(Infinity)
  const pai = new Int32Array(n).fill(-1)
  const fechado = new Uint8Array(n)

  gScore[idxOrigem] = 0
  fScore[idxOrigem] = heuristicaOctile(origem.x, origem.y, destino.x, destino.y)

  const fila = new FilaPrioridade(fScore, Math.min(n, LIMITE_NOS_EXPANDIDOS) + 16)
  fila.inserir(idxOrigem)

  let nosExpandidos = 0

  while (!fila.vazia) {
    const atual = fila.remover()
    if (fechado[atual]) continue // entrada obsoleta (celula ja fechada por um pop anterior)
    if (atual === idxDestino) return reconstruirCaminho(pai, atual, largura)

    fechado[atual] = 1
    nosExpandidos++
    if (nosExpandidos > LIMITE_NOS_EXPANDIDOS) return null

    const ax = atual % largura
    const ay = (atual - ax) / largura

    for (let k = 0; k < 8; k++) {
      const dx = VIZINHOS_DX[k]
      const dy = VIZINHOS_DY[k]
      const bx = ax + dx
      const by = ay + dy
      if (bx < 0 || bx >= largura || by < 0 || by >= altura) continue

      const bIdx = by * largura + bx
      if (fechado[bIdx]) continue
      if (!aguaNoIndice(g, bIdx)) continue

      if (dx !== 0 && dy !== 0) {
        // sem cortar quina: as duas ortogonais adjacentes tambem precisam ser agua
        const ortoA = ay * largura + bx
        const ortoB = by * largura + ax
        if (!aguaNoIndice(g, ortoA) || !aguaNoIndice(g, ortoB)) continue
      }

      const custoMovimento = dx !== 0 && dy !== 0 ? D2 : D
      const gTentativo = gScore[atual] + custoMovimento
      if (gTentativo < gScore[bIdx]) {
        pai[bIdx] = atual
        gScore[bIdx] = gTentativo
        fScore[bIdx] = gTentativo + heuristicaOctile(bx, by, destino.x, destino.y)
        fila.inserir(bIdx)
      }
    }
  }

  return null
}

/** Faz snap da origem e do destino pra agua e roda o A*. `null` se algum snap falhar
 *  ou se nao houver caminho navegavel entre eles. */
export function acharCaminho(g: Grade, de: Coord, para: Coord): Coord[] | null {
  const origemCelula = snapParaAgua(g, de, RAIO_SNAP_PADRAO_CELULAS)
  const destinoCelula = snapParaAgua(g, para, RAIO_SNAP_PADRAO_CELULAS)
  if (!origemCelula || !destinoCelula) return null

  const caminhoCelulas = acharCaminhoEmCelulas(g, origemCelula, destinoCelula)
  if (!caminhoCelulas) return null

  return caminhoCelulas.map((c) => paraCoord(g, c))
}

/** Linha de visao livre entre duas celulas via Bresenham, conferindo agua em toda celula do
 *  tracado (inclusive as duas pontas) e aplicando a mesma regra de "nao corta quina" do A*
 *  nos passos diagonais. */
function linhaDeVisaoLivre(g: Grade, a: Celula, b: Celula): boolean {
  let x0 = a.x
  let y0 = a.y
  const x1 = b.x
  const y1 = b.y
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy

  if (!ehAgua(g, { x: x0, y: y0 })) return false

  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err
    const movX = e2 >= dy
    const movY = e2 <= dx

    if (movX && movY) {
      // passo diagonal do Bresenham: mesma checagem de quina do A*
      if (!ehAgua(g, { x: x0 + sx, y: y0 }) || !ehAgua(g, { x: x0, y: y0 + sy })) return false
    }
    if (movX) {
      err += dy
      x0 += sx
    }
    if (movY) {
      err += dx
      y0 += sy
    }
    if (!ehAgua(g, { x: x0, y: y0 })) return false
  }
  return true
}

/** String-pulling: do ponto atual, avanca ate o ponto mais distante com linha de visao livre,
 *  cria a perna ali, repete. Preserva o primeiro e o ultimo ponto exatamente. */
export function suavizar(g: Grade, caminho: Coord[]): Coord[] {
  if (caminho.length <= 2) return caminho.slice()

  const celulas = caminho.map((p) => paraCelula(g, p))
  const resultado: Coord[] = [caminho[0]]

  let atual = 0
  while (atual < celulas.length - 1) {
    let proximo = atual + 1
    for (let candidato = celulas.length - 1; candidato > atual; candidato--) {
      if (linhaDeVisaoLivre(g, celulas[atual], celulas[candidato])) {
        proximo = candidato
        break
      }
    }
    resultado.push(caminho[proximo])
    atual = proximo
  }

  return resultado
}

/** Soma as pernas (haversine) do caminho, em milhas nauticas. */
export function distanciaDaRota(pontos: Coord[]): number {
  let total = 0
  for (let i = 1; i < pontos.length; i++) total += haversineNm(pontos[i - 1], pontos[i])
  return total
}

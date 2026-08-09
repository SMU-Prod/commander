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
  /** Resolucao real da mascara. Presente nas grades de verdade (vem do JSON);
   *  ausente nas grades sinteticas dos testes, que mapeiam grau 1:1 com celula. */
  metrosPorCelula?: number
}

/** Nos expandidos antes de desistir. Salvaguarda de runtime p/ nunca travar o navegador
 *  em grades reais de milhoes de celulas — nao e um limite de qualidade da rota, e
 *  protecao contra um caminho patologico (ou grade corrompida) rodar para sempre. */
const LIMITE_NOS_EXPANDIDOS = 2_000_000

/** Alcance do snap em METROS, nao em celulas: o plano fixou ~1 km, e um raio em
 *  celulas silenciosamente virava 2 km quando a mascara passou de 80 pra 100 m.
 *  Em metros a regra vale para qualquer resolucao. Alem de 1 km o snap deixaria
 *  de "tirar o ponto de cima da praia" e passaria a teleportar a origem/destino
 *  pra outra enseada — mudando a rota sem o usuario pedir. */
const RAIO_SNAP_METROS = 1000

/** Fallback para grades sinteticas (testes), que nao tem resolucao metrica. */
const RAIO_SNAP_CELULAS_SEM_ESCALA = 20

/** Alcance do snap em celulas, a partir da resolucao real da grade. */
function raioSnapCelulas(g: Grade): number {
  if (!g.metrosPorCelula) return RAIO_SNAP_CELULAS_SEM_ESCALA
  return Math.max(1, Math.round(RAIO_SNAP_METROS / g.metrosPorCelula))
}

// custo octile: D para passo ortogonal, D2 para diagonal
const D = 1
const D2 = Math.SQRT2

// ---------------------------------------------------------------------------
// Onda 12 — rota por calado: grade de profundidade + bloqueio/penalidade.
// Equivalente ao "Auto Guidance+" do Navionics: a rota evita agua rasa
// demais pro calado do barco, preferindo agua mais funda quando o desvio e
// barato. Ver scripts/gerar-grade-profundidade.mjs pra como o PNG e gerado
// e docs/OPERACAO.md § Rota por calado pro desenho completo.
// ---------------------------------------------------------------------------

/** Grade de profundidade: profundidade em METROS por celula (nao agua/terra
 *  binario). Resolucao e bbox podem ser DIFERENTES da Grade de agua/terra —
 *  a grade fina de agua vem de linha de costa OSM a 100 m/celula; a de
 *  profundidade vem de elevacao ETOPO a ~450 m/celula (fina) ou ~3,6 km
 *  (nacional). Por isso a profundidade e amostrada por COORDENADA
 *  (`profundidadeEm`), nunca pelo mesmo indice da grade de agua. */
export interface GradeProfundidade {
  largura: number
  altura: number
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  /** Metros, ja decodificados do PNG (piso conservador do bucket — ver
   *  scripts/gerar-grade-profundidade.mjs). `Number.POSITIVE_INFINITY` marca
   *  terra/sem-dado NESSA grade — nunca bloqueia por profundidade sozinho (a
   *  grade de agua/terra ja cobre terra; ausencia de dado de profundidade
   *  tambem nao pode travar uma rota que a grade de agua permite). Indexado
   *  y*largura+x, linha 0 = latMax (mesma convencao de Grade.agua). */
  profundidadeM: Float32Array
}

/** Amostra a profundidade (metros) na coordenada mais proxima (nearest
 *  neighbor — a grade de profundidade normalmente e mais grossa que a de
 *  agua, entao varias celulas de agua caem na mesma celula de profundidade,
 *  o que e esperado). Fora do bbox da grade de profundidade devolve
 *  +Infinity: SEM COBERTURA NAO E TRATADO COMO RASO. Bloquear por ausencia
 *  de dado quebraria rotas em qualquer regiao fora do bbox mais apertado
 *  (ex.: usar a grade fina de profundidade — regiao de operacao historica —
 *  numa rota que a grade de AGUA nacional ja cobre mais longe da costa). */
export function profundidadeEm(gp: GradeProfundidade, p: Coord): number {
  if (p.lo < gp.lngMin || p.lo > gp.lngMax || p.la < gp.latMin || p.la > gp.latMax) {
    return Number.POSITIVE_INFINITY
  }
  const x = Math.min(gp.largura - 1, Math.max(0, Math.floor(((p.lo - gp.lngMin) / (gp.lngMax - gp.lngMin)) * gp.largura)))
  const y = Math.min(gp.altura - 1, Math.max(0, Math.floor(((gp.latMax - p.la) / (gp.latMax - gp.latMin)) * gp.altura)))
  return gp.profundidadeM[y * gp.largura + x]
}

/** Margem de seguranca PADRAO pra lancha, em metros: 0,5 m de folga sob a
 *  quilha (praxe de navegacao costeira pra qualquer embarcacao de recreio)
 *  + 0,5 m pra cobrir o quanto a mare pode baixar abaixo do nivel medio que
 *  o dado de elevacao usa como referencia (mares de sizigia na costa SE
 *  brasileira — regiao de operacao do Commander — costumam ficar entre
 *  1,0 e 1,5 m de amplitude; metade disso e uma estimativa razoavel de
 *  quanto o nivel cai abaixo da media = ~0,5-0,75 m, arredondado pra baixo
 *  pra nao inflar demais o numero "padrao"). Total: 1,0 m. NAO e dado de
 *  mare real (o Commander nao consulta tabua de mare) — e uma folga fixa e
 *  conservadora; quem navega numa regiao de mare maior deve aumentar. */
export const MARGEM_SEGURANCA_PADRAO_M = 1

/** Fator multiplicativo maximo de custo pra uma celula na zona de
 *  penalidade (bem no limiar de bloqueio) — 4x o custo normal. Alto o
 *  suficiente pra fazer o A* preferir um desvio de ate ~3x a distancia
 *  direta na zona rasa antes de aceitar atravessa-la; nao e "infinito"
 *  (isso seria bloqueio, nao penalidade) pra ainda permitir a rota rasa
 *  quando NAO ha alternativa mais funda por perto. */
const PENALIDADE_MAXIMA = 4

/** Configuracao de calado pro A*: celulas com profundidade abaixo de
 *  `caladoM + margemSegurancaM` sao intransponiveis (como terra); celulas
 *  na faixa `[limiar, limiar + zonaPenalidadeM)` ainda passam, mas custam
 *  mais caro (interpolado ate PENALIDADE_MAXIMA bem no limiar) — o que faz
 *  o A* preferir agua mais funda quando o desvio pra chegar la e barato. */
export interface ConfigCalado {
  caladoM: number
  margemSegurancaM: number
  /** Largura (metros) da faixa de penalidade acima do limiar de bloqueio.
   *  Default: a propria margemSegurancaM (nao ha um numero "certo"
   *  documentado separado disso — reusar a margem evita inventar uma
   *  terceira constante sem base nenhuma). */
  zonaPenalidadeM?: number
  profundidade: GradeProfundidade
}

/** Fator de custo [1, PENALIDADE_MAXIMA] pra uma profundidade `profundidadeM`
 *  dado o limiar de bloqueio e a largura da zona de penalidade acima dele.
 *  1.0 (sem penalidade) a partir de `limiarBloqueioM + zonaPenalidadeM`;
 *  interpola ate PENALIDADE_MAXIMA exatamente no limiar. Celulas ABAIXO do
 *  limiar nunca chegam aqui — sao bloqueadas antes (ver acharCaminhoEmCelulas). */
function fatorPenalidadeProfundidade(profundidadeM: number, limiarBloqueioM: number, zonaPenalidadeM: number): number {
  if (zonaPenalidadeM <= 0) return 1
  const acimaDoLimiar = profundidadeM - limiarBloqueioM
  if (acimaDoLimiar >= zonaPenalidadeM) return 1
  const t = Math.max(0, acimaDoLimiar) / zonaPenalidadeM // 0 no limiar (penalidade maxima), 1 na borda da zona
  return PENALIDADE_MAXIMA - (PENALIDADE_MAXIMA - 1) * t
}

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

/** Heap binario minimo de (idx, fScore), com o fScore capturado no momento da insercao
 *  (nao um array global do tamanho da grade). Isso e o que permite eliminar o array
 *  fScore de tamanho n: em vez de "decrease-key" num array vivo compartilhado, cada
 *  melhoria de custo insere uma NOVA entrada com o f atualizado; entradas antigas do
 *  mesmo indice ficam obsoletas no heap e sao descartadas na remocao (`fechado[idx]`
 *  ja cobre esse caso — é o dele mesmo padrao de lazy-deletion do Dijkstra/A* classico).
 *  Capacidade limitada por LIMITE_NOS_EXPANDIDOS: nao cresce com o tamanho da grade. */
class FilaPrioridade {
  private heapIdx: Int32Array
  private heapF: Float32Array
  private tam = 0

  constructor(capacidadeInicial: number) {
    const cap = Math.max(16, capacidadeInicial)
    this.heapIdx = new Int32Array(cap)
    this.heapF = new Float32Array(cap)
  }

  get vazia(): boolean {
    return this.tam === 0
  }

  private garantirCapacidade(): void {
    if (this.tam < this.heapIdx.length) return
    const maiorIdx = new Int32Array(this.heapIdx.length * 2)
    maiorIdx.set(this.heapIdx)
    this.heapIdx = maiorIdx
    const maiorF = new Float32Array(this.heapF.length * 2)
    maiorF.set(this.heapF)
    this.heapF = maiorF
  }

  private trocar(a: number, b: number): void {
    const ti = this.heapIdx[a]
    this.heapIdx[a] = this.heapIdx[b]
    this.heapIdx[b] = ti
    const tf = this.heapF[a]
    this.heapF[a] = this.heapF[b]
    this.heapF[b] = tf
  }

  inserir(idx: number, f: number): void {
    this.garantirCapacidade()
    let i = this.tam++
    this.heapIdx[i] = idx
    this.heapF[i] = f
    while (i > 0) {
      const pai = (i - 1) >> 1
      if (this.heapF[pai] <= this.heapF[i]) break
      this.trocar(pai, i)
      i = pai
    }
  }

  /** Remove e devolve o (idx, f) de menor f. */
  remover(): { idx: number; f: number } {
    const idxTopo = this.heapIdx[0]
    const fTopo = this.heapF[0]
    this.tam--
    this.heapIdx[0] = this.heapIdx[this.tam]
    this.heapF[0] = this.heapF[this.tam]
    let i = 0
    for (;;) {
      const esq = 2 * i + 1
      const dir = 2 * i + 2
      let menor = i
      if (esq < this.tam && this.heapF[esq] < this.heapF[menor]) menor = esq
      if (dir < this.tam && this.heapF[dir] < this.heapF[menor]) menor = dir
      if (menor === i) break
      this.trocar(menor, i)
      i = menor
    }
    return { idx: idxTopo, f: fTopo }
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

/** A* 8-conectado sobre indices de celula. Origem e destino ja precisam ser agua.
 *  `config` (onda 12): quando presente, celulas rasas demais pro calado+margem
 *  sao tratadas como terra (skip, igual ao check de agua), e celulas na zona
 *  de penalidade tem o custo do movimento multiplicado — ver
 *  `fatorPenalidadeProfundidade`. O check de profundidade se aplica so a
 *  celula DE DESTINO do movimento (bIdx), nao as duas ortogonais do
 *  anti-corner-cutting — a grade de profundidade e tipicamente mais grossa
 *  que a de agua, entao esse refinamento extra nao muda o resultado na
 *  pratica e simplifica o codigo. */
function acharCaminhoEmCelulas(g: Grade, origem: Celula, destino: Celula, config?: ConfigCalado): Celula[] | null {
  const { largura, altura } = g
  const n = largura * altura
  const idxOrigem = origem.y * largura + origem.x
  const idxDestino = destino.y * largura + destino.x

  if (idxOrigem === idxDestino) return [origem]

  const limiarBloqueioM = config ? config.caladoM + config.margemSegurancaM : 0
  const zonaPenalidadeM = config ? (config.zonaPenalidadeM ?? config.margemSegurancaM) : 0

  // gScore em Float32: a precisao de float32 (~7 digitos significativos) sobra pra
  // custos de celula (octile, no maximo alguns milhares numa grade de milhoes de
  // celulas) — reduz pela metade o maior consumidor de memoria por celula.
  // Nao existe mais um fScore do tamanho da grade: o f de cada entrada vive dentro
  // do heap (FilaPrioridade), que e limitado por LIMITE_NOS_EXPANDIDOS, nao por n.
  const gScore = new Float32Array(n).fill(Infinity)
  const pai = new Int32Array(n).fill(-1)
  const fechado = new Uint8Array(n)

  gScore[idxOrigem] = 0
  const fOrigem = heuristicaOctile(origem.x, origem.y, destino.x, destino.y)

  const fila = new FilaPrioridade(Math.min(n, LIMITE_NOS_EXPANDIDOS) + 16)
  fila.inserir(idxOrigem, fOrigem)

  let nosExpandidos = 0

  while (!fila.vazia) {
    const { idx: atual } = fila.remover()
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

      let custoMovimento = dx !== 0 && dy !== 0 ? D2 : D
      // Origem e destino ficam ISENTOS do check de profundidade: o barco pode
      // estar numa marina rasa (origem) ou ir pra uma (destino) — a restricao
      // de calado vale pro CAMINHO entre eles, nao pros extremos que o
      // usuario/snap ja escolheu. Sem essa isencao, um destino em agua rasa
      // (marina tipica) ficaria PERMANENTEMENTE inalcancavel com calado
      // configurado, de qualquer direcao que se tentasse chegar nele.
      if (config && bIdx !== idxDestino && bIdx !== idxOrigem) {
        const profundidadeAqui = profundidadeEm(config.profundidade, paraCoord(g, { x: bx, y: by }))
        if (profundidadeAqui < limiarBloqueioM) continue // rasa demais pro calado: intransponivel, como terra
        custoMovimento *= fatorPenalidadeProfundidade(profundidadeAqui, limiarBloqueioM, zonaPenalidadeM)
      }
      const gTentativo = gScore[atual] + custoMovimento
      if (gTentativo < gScore[bIdx]) {
        pai[bIdx] = atual
        gScore[bIdx] = gTentativo
        const fTentativo = gTentativo + heuristicaOctile(bx, by, destino.x, destino.y)
        fila.inserir(bIdx, fTentativo)
      }
    }
  }

  return null
}

/** Faz snap da origem e do destino pra agua e roda o A*. `null` se algum snap falhar
 *  ou se nao houver caminho navegavel entre eles. `config` (onda 12, opcional):
 *  roda o A* respeitando o calado do barco — ver `ConfigCalado` e
 *  `acharCaminhoEmCelulas`. O snap em si NAO considera profundidade: a
 *  origem/destino podem estar numa marina rasa (e e la que o barco esta/vai),
 *  a restricao vale pro CAMINHO entre eles, nao pros extremos. */
export function acharCaminho(g: Grade, de: Coord, para: Coord, config?: ConfigCalado): Coord[] | null {
  const raio = raioSnapCelulas(g)
  const origemCelula = snapParaAgua(g, de, raio)
  const destinoCelula = snapParaAgua(g, para, raio)
  if (!origemCelula || !destinoCelula) return null

  const caminhoCelulas = acharCaminhoEmCelulas(g, origemCelula, destinoCelula, config)
  if (!caminhoCelulas) return null

  return caminhoCelulas.map((c) => paraCoord(g, c))
}

/** Celula passa no check de agua E (se `config` presente) de calado — MESMO
 *  limiar do A* (`caladoM + margemSegurancaM`), mas sem a penalidade suave:
 *  aqui e binario (passa ou nao), porque string-pulling nao otimiza custo,
 *  so decide se uma linha reta pode substituir um trecho do caminho. Sem
 *  isso, `suavizar` poderia "atalhar" de volta por cima de uma celula rasa
 *  que o A* desviou de proposito (ela e AGUA, entao passaria no check antigo
 *  — so o check de profundidade barra). */
function passaNoCalado(g: Grade, c: Celula, config: ConfigCalado | undefined): boolean {
  if (!ehAgua(g, c)) return false
  if (!config) return true
  const profundidade = profundidadeEm(config.profundidade, paraCoord(g, c))
  return profundidade >= config.caladoM + config.margemSegurancaM
}

/** Linha de visao livre entre duas celulas via Bresenham, conferindo agua (e calado, se
 *  `config` presente) em toda celula do tracado (inclusive as duas pontas) e aplicando a
 *  mesma regra de "nao corta quina" do A* nos passos diagonais. */
function linhaDeVisaoLivre(g: Grade, a: Celula, b: Celula, config?: ConfigCalado): boolean {
  let x0 = a.x
  let y0 = a.y
  const x1 = b.x
  const y1 = b.y
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy

  if (!passaNoCalado(g, { x: x0, y: y0 }, config)) return false

  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err
    const movX = e2 >= dy
    const movY = e2 <= dx

    if (movX && movY) {
      // passo diagonal do Bresenham: mesma checagem de quina do A*
      if (!passaNoCalado(g, { x: x0 + sx, y: y0 }, config) || !passaNoCalado(g, { x: x0, y: y0 + sy }, config)) return false
    }
    if (movX) {
      err += dy
      x0 += sx
    }
    if (movY) {
      err += dx
      y0 += sy
    }
    if (!passaNoCalado(g, { x: x0, y: y0 }, config)) return false
  }
  return true
}

/** String-pulling: do ponto atual, avanca ate o ponto mais distante com linha de visao livre,
 *  cria a perna ali, repete. Preserva o primeiro e o ultimo ponto exatamente. `config` (onda
 *  12, opcional): a linha reta tambem respeita calado, nao so agua/terra — ver `passaNoCalado`. */
export function suavizar(g: Grade, caminho: Coord[], config?: ConfigCalado): Coord[] {
  if (caminho.length <= 2) return caminho.slice()

  const celulas = caminho.map((p) => paraCelula(g, p))
  const resultado: Coord[] = [caminho[0]]

  let atual = 0
  while (atual < celulas.length - 1) {
    let proximo = atual + 1
    for (let candidato = celulas.length - 1; candidato > atual; candidato--) {
      if (linhaDeVisaoLivre(g, celulas[atual], celulas[candidato], config)) {
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

// ---------------------------------------------------------------------------
// Onda 11 — rota nacional: grade ampla (grossa, Brasil inteiro) + recorte por
// trecho + escolha entre fina/ampla. Ver docs/OPERACAO.md § Máscara nacional.
// ---------------------------------------------------------------------------

export interface Bbox {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
}

/** Confere se uma coordenada cai dentro do bbox coberto pela grade — barato o
 *  suficiente pra checar antes de chamar acharCaminho num ponto fora da area
 *  mapeada, sem precisar montar celula nenhuma. Movida de lib/mapa/mascara.ts
 *  (onda 11): e geometria pura sobre Grade/Coord, pertence ao dominio — mascara.ts
 *  reexporta pra nao quebrar quem ja importava de la. */
export function dentroDaGrade(g: Grade, p: Coord): boolean {
  return p.lo >= g.lngMin && p.lo <= g.lngMax && p.la >= g.latMin && p.la <= g.latMax
}

// Folga do recorte: fracao da diagonal origem-destino, com piso. O piso evita
// um recorte minusculo demais pra rodear qualquer obstaculo quando os dois
// pontos estao proximos (ou coincidem) — 0.2 grau ~= 22 km de folga minima em
// cada direcao, suficiente pra contornar uma reentrancia de costa tipica sem
// esbarrar na borda do recorte.
const FRACAO_FOLGA_RECORTE = 0.25
const FOLGA_MINIMA_GRAUS = 0.2

/** Bbox que contem origem e destino, com folga proporcional a diagonal entre
 *  eles (piso pra trechos curtos). E o retangulo que `recortarGrade` usa pra
 *  recortar a grade ampla ANTES do A* — memoria do calculo passa a depender do
 *  TRECHO da viagem, nao da cobertura inteira da grade. */
export function bboxComFolga(de: Coord, para: Coord): Bbox {
  const lngMin0 = Math.min(de.lo, para.lo)
  const lngMax0 = Math.max(de.lo, para.lo)
  const latMin0 = Math.min(de.la, para.la)
  const latMax0 = Math.max(de.la, para.la)
  const diagonalGraus = Math.hypot(lngMax0 - lngMin0, latMax0 - latMin0)
  const folga = Math.max(diagonalGraus * FRACAO_FOLGA_RECORTE, FOLGA_MINIMA_GRAUS)
  return {
    lngMin: lngMin0 - folga,
    latMin: latMin0 - folga,
    lngMax: lngMax0 + folga,
    latMax: latMax0 + folga,
  }
}

/** Recorta uma grade ao retangulo `bbox` (coordenadas geograficas), alinhado a
 *  celula. `bbox` e clampado aos limites da propria grade antes de converter
 *  pra indices — um bbox parcialmente (ou totalmente) fora da grade so recorta
 *  a parte que existe. As novas bordas geograficas (lngMin/latMin/lngMax/latMax)
 *  sao recalculadas a partir do tamanho real da celula da grade original, entao
 *  paraCelula/paraCoord continuam corretos na grade recortada. */
export function recortarGrade(g: Grade, bbox: Bbox): Grade {
  const larguraCelulaGraus = (g.lngMax - g.lngMin) / g.largura
  const alturaCelulaGraus = (g.latMax - g.latMin) / g.altura

  const bboxClampado = {
    lngMin: Math.max(bbox.lngMin, g.lngMin),
    latMin: Math.max(bbox.latMin, g.latMin),
    lngMax: Math.min(bbox.lngMax, g.lngMax),
    latMax: Math.min(bbox.latMax, g.latMax),
  }

  const clampCol = (c: number) => Math.min(g.largura - 1, Math.max(0, c))
  const clampRow = (r: number) => Math.min(g.altura - 1, Math.max(0, r))

  const colMin = clampCol(Math.floor((bboxClampado.lngMin - g.lngMin) / larguraCelulaGraus))
  const colMax = Math.max(colMin, clampCol(Math.floor((bboxClampado.lngMax - g.lngMin) / larguraCelulaGraus)))
  // linha 0 = norte (latMax) — mesma convencao de paraCelula
  const rowMin = clampRow(Math.floor((g.latMax - bboxClampado.latMax) / alturaCelulaGraus))
  const rowMax = Math.max(rowMin, clampRow(Math.floor((g.latMax - bboxClampado.latMin) / alturaCelulaGraus)))

  const largura = colMax - colMin + 1
  const altura = rowMax - rowMin + 1

  const agua = new Uint8Array(largura * altura)
  for (let r = 0; r < altura; r++) {
    const origemLinha = (r + rowMin) * g.largura
    const destinoLinha = r * largura
    for (let c = 0; c < largura; c++) {
      agua[destinoLinha + c] = g.agua[origemLinha + (c + colMin)]
    }
  }

  return {
    largura,
    altura,
    lngMin: g.lngMin + colMin * larguraCelulaGraus,
    lngMax: g.lngMin + (colMax + 1) * larguraCelulaGraus,
    latMax: g.latMax - rowMin * alturaCelulaGraus,
    latMin: g.latMax - (rowMax + 1) * alturaCelulaGraus,
    agua,
    metrosPorCelula: g.metrosPorCelula,
  }
}

export type TipoGrade = "fina" | "nacional"

/** Regra de escolha de grade (onda 11): se origem E destino cabem na grade
 *  fina (mais detalhe, area de operacao historica), usa ela. Senao, se os dois
 *  cabem na grade nacional (grossa, Brasil inteiro), usa a nacional — quem
 *  chama e responsavel por recortar (`recortarGrade`+`bboxComFolga`) antes de
 *  rodar o A*, isso aqui so decide QUAL grade. `null` quando nenhuma das duas
 *  cobre os dois pontos ao mesmo tempo — so nesse caso a tela deve mostrar
 *  "fora da area". */
export function escolherGrade(
  fina: Grade | null,
  nacional: Grade | null,
  de: Coord,
  para: Coord,
): { grade: Grade; tipo: TipoGrade } | null {
  if (fina && dentroDaGrade(fina, de) && dentroDaGrade(fina, para)) {
    return { grade: fina, tipo: "fina" }
  }
  if (nacional && dentroDaGrade(nacional, de) && dentroDaGrade(nacional, para)) {
    return { grade: nacional, tipo: "nacional" }
  }
  return null
}

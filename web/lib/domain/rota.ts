import { haversineNm } from "@/lib/domain/geo"
import { celulaId } from "@/lib/domain/sondagem"

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

/** Alcance do snap em celulas, a partir da resolucao real da grade.
 *  Piso de 2 celulas (nao 1): na grade nacional (3,6 km/celula) o raio de
 *  1 km arredondava pra UMA celula e quem pedia rota de casa (terra firme,
 *  primeiro teste real de iPhone em producao, 12/08/2026) nunca alcancava a
 *  agua — "sem caminho" mentiroso. Duas celulas dao ~7 km na grade grossa,
 *  o bastante pra sair de um bairro costeiro ate o mar; a fina nao muda
 *  (10 celulas de 100 m). Exportada pra teste. */
export function raioSnapCelulas(g: Grade): number {
  if (!g.metrosPorCelula) return RAIO_SNAP_CELULAS_SEM_ESCALA
  return Math.max(2, Math.round(RAIO_SNAP_METROS / g.metrosPorCelula))
}

/** Alcance do snap do DESTINO, em metros, especificamente na grade NACIONAL —
 *  bem mais generoso que RAIO_SNAP_METROS (usado pra origem e pra qualquer
 *  snap na fina). Onda 22, segundo print de producao (12/08, 02:29): pino em
 *  Vitoria/ES (-20.32,-40.28) media EXATAMENTE 2 celulas (~7,27 km) de agua
 *  mais proxima na mascara nacional real — bem NO LIMITE do piso de 2
 *  celulas de `raioSnapCelulas` (7,27 km), falhando por qualquer folga de
 *  arredondamento. A origem raramente sofre disso (normalmente e o GPS do
 *  barco, ja em agua ou perto — o piso de 2 celulas de `raioSnapCelulas` ja
 *  resolve o caso "casa em terra firme" da onda original); o DESTINO e o
 *  ponto que o usuario TOCA no mapa, e gente tocando destino tende a tocar
 *  bem na costa/no porto — exatamente a faixa que a dilatacao de seguranca
 *  da nacional (~7,4 km, MARGEM_CELULAS_TERRA em scripts/gerar-mascara-
 *  nacional.mjs) engole como terra. Medido tambem contra o proprio caso
 *  original da task (costa da Bahia, -13.5,-39.05, um recuo de baia): 6
 *  celulas (~21,8 km) foram necessarias pra achar agua real na mascara
 *  nacional. 30 km da folga confortavel sobre os dois casos medidos sem
 *  abrir mao do carater LOCAL do snap — ainda nao "qualquer agua do
 *  Atlantico", so uma vizinhanca costeira ampliada. Quando o raio padrao
 *  (raioSnapCelulas) já bastaria, o resultado do snap é o MESMO — este raio
 *  só é mais permissivo, nunca mais restritivo (ver uso condicionado a
 *  `destinoAproximado` em `acharCaminhoNacionalComDestinoGeneroso`). */
const RAIO_SNAP_DESTINO_NACIONAL_METROS = 30_000

/** Raio de snap (em celulas) do DESTINO, generoso, SO pra grade NACIONAL —
 *  ver `RAIO_SNAP_DESTINO_NACIONAL_METROS`. Nunca menor que `raioSnapCelulas`
 *  (o generoso so amplia, nunca reduz o alcance padrao). */
export function raioSnapDestinoNacionalCelulas(g: Grade): number {
  const padrao = raioSnapCelulas(g)
  if (!g.metrosPorCelula) return padrao
  return Math.max(padrao, Math.round(RAIO_SNAP_DESTINO_NACIONAL_METROS / g.metrosPorCelula))
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

// ---------------------------------------------------------------------------
// Onda 17 — corredores ("Strava do Mar"): toda trilha GPS gravada
// (web/lib/acoes/trilha.ts, salvarTrilha) ensina o mapa — onde um barco de
// verdade passou e caminho comprovado. O A* passa a PREFERIR essas celulas
// (fatorCorredor abaixo), nunca desbloquear: o check de agua (aguaNoIndice)
// e de calado (config, se presente) rodam ANTES, na mesma volta do loop —
// corredor so multiplica o custo de um movimento que JA passou nos dois.
// Mesmo desenho de agregacao por celula da sondagem colaborativa (onda 13,
// web/lib/domain/sondagem.ts) — reusa a MESMA funcao `celulaId`, so com
// resolucao PROPRIA (ver RESOLUCAO_CELULA_CORREDOR_M): sondagem precisa de
// granularidade fina (15 m) porque profundidade varia muito em poucos
// metros; corredor e preferencia de ROTA, so importa na resolucao em que o
// A* decide entre celulas vizinhas — a da mascara fina de agua (100 m/celula,
// ver web/lib/mapa/mascara.ts). Ver docs/OPERACAO.md § Corredores.
// ---------------------------------------------------------------------------

/** Resolucao da celula de corredor, em metros — a MESMA da mascara fina de
 *  agua/terra (100 m/celula, scripts/gerar-mascara-agua.mjs), NAO a da
 *  sondagem colaborativa (15 m, RESOLUCAO_CELULA_M em sondagem.ts). Uma
 *  celula de 15 m seria ruido puro pra decisao de rota (erro tipico de GPS
 *  civil e maior que isso) sem ganhar precisao nenhuma — so infla a tabela e
 *  a busca no mapa. 100 m tambem casa com o raio de snap (RAIO_SNAP_METROS,
 *  1 km = 10 celulas) e com a resolucao que o A* de fato enxerga na grade
 *  fina, que e a unica onde corredor faz diferenca perceptivel (a nacional,
 *  ~3,6 km/celula, e grossa demais pra um redutor de custo por celula
 *  importar no resultado). */
export const RESOLUCAO_CELULA_CORREDOR_M = 100

/** Corredores conhecidos, indexados pela MESMA chave de celula que a tabela
 *  `corredores` grava (`celulaId(lat, lon, RESOLUCAO_CELULA_CORREDOR_M)`).
 *  Intensidade normalizada [0,1] — 0 nunca deveria aparecer como valor (uma
 *  celula sem passagem simplesmente nao entra no mapa), mas o codigo trata
 *  ausencia da chave (`.get` devolvendo `undefined`) do mesmo jeito: sem
 *  efeito no custo. Normalizacao (passagens brutas -> [0,1]) acontece FORA
 *  do dominio, em quem monta este mapa a partir da resposta do endpoint
 *  (web/lib/mapa/corredores.ts) — mesmo desenho de GradeProfundidade, que
 *  recebe metros ja decodificados do PNG, nunca o byte cru. */
export interface CorredoresPorCelula {
  porCelula: Map<string, number>
}

/** Redutor de custo MAXIMO pra uma celula de corredor com intensidade
 *  saturada (1.0) — 0.8 = o A* aceita desviar ate ~25% mais caro pra pegar
 *  um corredor plenamente comprovado, mas o corredor nunca fica "de graca":
 *  forte o bastante pra desempatar entre dois caminhos de custo parecido
 *  (ver teste "vence com passagens reais"), fraco o bastante pra nunca fazer
 *  o A* dar uma volta absurda so por causa de 1 passagem historica isolada.
 *  Mesma ordem de grandeza (long do PENALIDADE_MAXIMA=4x da onda 12), mas
 *  mais suave de proposito: ali o "prêmio" por evitar e sobre SEGURANCA
 *  (calado), aqui e sobre uma PREFERENCIA estatistica — passagem historica
 *  nao e garantia de profundidade (ver honestidade na tela, navegar-mapa.tsx). */
const REDUTOR_CORREDOR_MAXIMO = 0.8

/** Fator de custo [REDUTOR_CORREDOR_MAXIMO, 1] pra uma intensidade [0,1] —
 *  interpolacao linear: 0 (sem corredor) devolve 1 (sem efeito no custo), 1
 *  (corredor saturado) devolve REDUTOR_CORREDOR_MAXIMO. */
function fatorCorredor(intensidade: number): number {
  const i = Math.max(0, Math.min(1, intensidade))
  return 1 - (1 - REDUTOR_CORREDOR_MAXIMO) * i
}

/** Intensidade [0,1] do corredor na coordenada `p` — 0 quando a celula (na
 *  resolucao de corredor) nao tem passagem nenhuma conhecida. Nunca lanca:
 *  chave ausente e o caso normal (a grande maioria da agua do planeta nunca
 *  teve uma trilha gravada) e tem que ser barata de checar (roda por
 *  movimento candidato do A*, potencialmente milhoes de vezes). */
function intensidadeCorredorEm(corredores: CorredoresPorCelula, p: Coord): number {
  return corredores.porCelula.get(celulaId(p.la, p.lo, RESOLUCAO_CELULA_CORREDOR_M)) ?? 0
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
 *  pratica e simplifica o codigo. `corredores` (onda 17, opcional): quando
 *  presente, o custo de cada movimento e multiplicado por `fatorCorredor` da
 *  intensidade na celula DE DESTINO — roda DEPOIS do check de agua/calado
 *  (que so aceita o `continue` acima), entao um corredor nunca torna
 *  transponivel uma celula que ja seria rejeitada por eles. Sem `corredores`
 *  (ou com o Map vazio), o comportamento e IDENTICO ao de antes desta onda —
 *  ver teste de regressao explicito em rota.test.ts. */
function acharCaminhoEmCelulas(
  g: Grade,
  origem: Celula,
  destino: Celula,
  config?: ConfigCalado,
  corredores?: CorredoresPorCelula,
): Celula[] | null {
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
      // Corredor (onda 17): so TORCE a preferencia entre movimentos ja
      // validos (chegou aqui = passou nos checks de agua e calado acima) —
      // nunca desbloqueia nada. `intensidade === 0` (celula sem passagem
      // conhecida, o caso comum) pula a multiplicacao — nao muda o valor
      // (fatorCorredor(0) === 1), so evita o custo de chamar a funcao.
      if (corredores) {
        const intensidade = intensidadeCorredorEm(corredores, paraCoord(g, { x: bx, y: by }))
        if (intensidade > 0) custoMovimento *= fatorCorredor(intensidade)
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

/** Motivo pelo qual `acharCaminhoDetalhado` nao achou rota — onda 22 (rota
 *  costurada): antes disso o dominio so devolvia `null`, sem dizer POR QUE, e
 *  a tela mostrava sempre o mesmo "sem caminho" generico mesmo quando o
 *  problema era o usuario ter tocado longe da agua (ou estar em terra firme
 *  longe dela). `"origem-longe-da-agua"` / `"destino-longe-da-agua"`: o SNAP
 *  falhou pra aquele extremo (nao ha agua no raio de busca). `"sem-caminho"`:
 *  os dois extremos snaparam, mas nao ha rota navegavel conectando-os (ou,
 *  na costura, uma falha estrutural interna — ver `acharCaminhoCosturado`). */
export type MotivoFalhaRota = "origem-longe-da-agua" | "destino-longe-da-agua" | "sem-caminho"

export interface ResultadoCaminho {
  /** `null` junto de `motivoFalha` != null; nunca os dois null/nao-null ao mesmo tempo. */
  caminho: Coord[] | null
  motivoFalha: MotivoFalhaRota | null
}

/** Faz snap da origem e do destino pra agua e roda o A*, expondo QUAL dos
 *  dois snaps falhou (ou se os dois deram certo mas nao ha rota entre eles)
 *  — onda 22. `raioOrigemCelulas`/`raioDestinoCelulas` (opcionais) sobrescrevem
 *  o raio padrao (`raioSnapCelulas(g)`) SO pro extremo correspondente; omitir
 *  os dois reproduz exatamente o comportamento de sempre (usado pelo wrapper
 *  `acharCaminho` e por qualquer chamada fora da costura). `config`/`corredores`:
 *  ver `acharCaminhoEmCelulas`. */
export function acharCaminhoDetalhado(
  g: Grade,
  de: Coord,
  para: Coord,
  config?: ConfigCalado,
  corredores?: CorredoresPorCelula,
  raioOrigemCelulas?: number,
  raioDestinoCelulas?: number,
): ResultadoCaminho {
  const raioOrigem = raioOrigemCelulas ?? raioSnapCelulas(g)
  const raioDestino = raioDestinoCelulas ?? raioSnapCelulas(g)

  const origemCelula = snapParaAgua(g, de, raioOrigem)
  if (!origemCelula) return { caminho: null, motivoFalha: "origem-longe-da-agua" }

  const destinoCelula = snapParaAgua(g, para, raioDestino)
  if (!destinoCelula) return { caminho: null, motivoFalha: "destino-longe-da-agua" }

  const caminhoCelulas = acharCaminhoEmCelulas(g, origemCelula, destinoCelula, config, corredores)
  if (!caminhoCelulas) return { caminho: null, motivoFalha: "sem-caminho" }

  return { caminho: caminhoCelulas.map((c) => paraCoord(g, c)), motivoFalha: null }
}

/** Faz snap da origem e do destino pra agua e roda o A*. `null` se algum snap falhar
 *  ou se nao houver caminho navegavel entre eles. `config` (onda 12, opcional):
 *  roda o A* respeitando o calado do barco — ver `ConfigCalado` e
 *  `acharCaminhoEmCelulas`. O snap em si NAO considera profundidade: a
 *  origem/destino podem estar numa marina rasa (e e la que o barco esta/vai),
 *  a restricao vale pro CAMINHO entre eles, nao pros extremos. `corredores`
 *  (onda 17, opcional): preferencia por celulas com passagens reais — ver
 *  `CorredoresPorCelula`. Omitir (ou passar um Map vazio) da a MESMA rota de
 *  antes desta onda. Onda 22: wrapper compativel sobre `acharCaminhoDetalhado`
 *  — mesma assinatura e mesmo resultado de sempre, so descarta o motivo. */
export function acharCaminho(
  g: Grade,
  de: Coord,
  para: Coord,
  config?: ConfigCalado,
  corredores?: CorredoresPorCelula,
): Coord[] | null {
  return acharCaminhoDetalhado(g, de, para, config, corredores).caminho
}

/** Roda o A* numa grade NACIONAL com o DESTINO tratado com snap mais generoso
 *  que a origem — onda 22, ver `raioSnapDestinoNacionalCelulas`. Usado tanto
 *  pra rota nacional PURA quanto pra perna nacional da costura que termina no
 *  destino real do usuario (nunca na origem, nem na perna que termina num
 *  ponto de costura interno — ver `acharCaminhoCosturado`).
 *  `destinoAproximado`: `true` quando o raio PADRAO (o mesmo da origem) NAO
 *  teria bastado — so o generoso achou agua. Sinal honesto pra tela: a rota
 *  termina "na altura do" destino pedido, o trecho final ate o ponto exato
 *  fica por conta do navegante, nunca finge precisao que a mascara nacional
 *  (~3,6 km/celula) nao tem. */
export interface ResultadoRotaNacionalGenerosa {
  caminho: Coord[] | null
  motivoFalha: MotivoFalhaRota | null
  destinoAproximado: boolean
}

export function acharCaminhoNacionalComDestinoGeneroso(
  g: Grade,
  de: Coord,
  para: Coord,
  config?: ConfigCalado,
  corredores?: CorredoresPorCelula,
): ResultadoRotaNacionalGenerosa {
  const raioDestinoPadrao = raioSnapCelulas(g)
  const resultado = acharCaminhoDetalhado(g, de, para, config, corredores, undefined, raioSnapDestinoNacionalCelulas(g))
  const destinoAproximado = resultado.caminho != null && snapParaAgua(g, para, raioDestinoPadrao) === null
  return { caminho: resultado.caminho, motivoFalha: resultado.motivoFalha, destinoAproximado }
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

/** Resultado de `escolherGrade` (onda 22: ganhou o terceiro caso, "costura").
 *  `"fina"`/`"nacional"`: os dois pontos cabem SO naquela grade — comportamento
 *  identico a antes da onda 22 (rotas puras, ver regressao em rota-real.test.ts).
 *  `"costura"`: EXATAMENTE um dos dois pontos cabe na fina, o outro fica fora
 *  dela mas dentro da nacional — o caso que a onda 22 existe pra resolver (ver
 *  `acharCaminhoCosturado`). `extremoNaFina` diz qual dos dois (`de` ou `para`)
 *  e o que esta dentro da fina. */
export type EscolhaGrade =
  | { tipo: "fina"; grade: Grade }
  | { tipo: "nacional"; grade: Grade }
  | { tipo: "costura"; fina: Grade; nacional: Grade; extremoNaFina: "origem" | "destino" }

/** Regra de escolha de grade: se origem E destino cabem na grade fina (mais
 *  detalhe, area de operacao historica), usa ela. Senao, se os dois cabem na
 *  grade nacional (grossa, Brasil inteiro): se EXATAMENTE um dos pontos
 *  tambem cabe na fina, usa costura (perna fina + perna nacional emendadas,
 *  onda 22 — ver `acharCaminhoCosturado`); senao (nenhum cabe na fina, ou a
 *  fina nem existe), usa a nacional pura, como sempre. Quem chama e
 *  responsavel por recortar (`recortarGrade`+`bboxComFolga`) a nacional antes
 *  de rodar o A* nos casos "nacional"/"costura" — isso aqui so decide a
 *  ESTRATEGIA. `null` quando nenhuma grade cobre os dois pontos ao mesmo
 *  tempo — so nesse caso a tela deve mostrar "fora da area".
 *
 *  Onda 22 — por que a costura existe: antes, "um dos pontos fora da fina"
 *  caia direto na nacional pura, mesmo que o outro ponto estivesse bem
 *  dentro da area historica (Ilhabela<->Buzios) — mas a dilatacao de
 *  seguranca da nacional (~7,4 km, MARGEM_CELULAS_TERRA em
 *  scripts/gerar-mascara-nacional.mjs) engole baias e estreitos inteiros
 *  (Guanabara, Sepetiba, canais de Ilha Grande viram terra nela), entao a
 *  ORIGEM/DESTINO dentro da fina podia falhar o snap mesmo estando em agua de
 *  verdade — caso real de producao, 12/08/2026. */
export function escolherGrade(fina: Grade | null, nacional: Grade | null, de: Coord, para: Coord): EscolhaGrade | null {
  const deNaFina = !!fina && dentroDaGrade(fina, de)
  const paraNaFina = !!fina && dentroDaGrade(fina, para)
  if (deNaFina && paraNaFina) {
    return { tipo: "fina", grade: fina! }
  }

  const deNaNacional = !!nacional && dentroDaGrade(nacional, de)
  const paraNaNacional = !!nacional && dentroDaGrade(nacional, para)
  if (deNaNacional && paraNaNacional) {
    if (fina && deNaFina !== paraNaFina) {
      return { tipo: "costura", fina, nacional: nacional!, extremoNaFina: deNaFina ? "origem" : "destino" }
    }
    return { tipo: "nacional", grade: nacional! }
  }

  return null
}

// ---------------------------------------------------------------------------
// Onda 22 — rota costurada: quando exatamente um extremo (origem OU destino)
// esta dentro da grade fina e o outro fora dela (mas dentro da nacional),
// nenhuma das duas grades sozinha resolve honestamente — a fina nao cobre o
// ponto de fora, e a nacional (dilatacao ~7,4 km) engole baias/estreitos
// inteiros que a origem/destino de DENTRO da fina podem estar. A correcao NAO
// e afrouxar a dilatacao da nacional (ela e planejador de mar aberto por
// design — margem menor so muda qual estreito morre); e COSTURAR: perna 1
// pela fina do extremo interno ate um PONTO DE COSTURA (agua nas duas
// grades), perna 2 pela nacional recortada do ponto de costura ate o extremo
// externo. Ver docs/OPERACAO.md § Rota costurada.
// ---------------------------------------------------------------------------

/** Ponto onde o raio de `de` em direcao a `para` sai do retangulo `bbox` —
 *  geometria pura (nao depende de agua/terra), usada pra achar o ponto da
 *  BORDA da grade fina mais alinhado com a direcao do extremo de fora (perna
 *  1 da costura, ver `acharCaminhoCosturado`). Assume `de` DENTRO do bbox
 *  (precondicao de quem chama: so roda quando ha costura, ou seja, o
 *  "pontoDentro" e por definicao interno a fina) — nesse caso sempre existe
 *  um t>0 de saida, entao o fallback (devolver `de`) so existe por
 *  seguranca de tipo, nunca deveria disparar na pratica. */
export function pontoDaBordaNaDirecao(bbox: Bbox, de: Coord, para: Coord): Coord {
  const dLo = para.lo - de.lo
  const dLa = para.la - de.la
  if (dLo === 0 && dLa === 0) return de

  const EPS = 1e-9
  let melhorT = Infinity
  const candidatosT: number[] = []
  if (dLo !== 0) {
    candidatosT.push((bbox.lngMin - de.lo) / dLo)
    candidatosT.push((bbox.lngMax - de.lo) / dLo)
  }
  if (dLa !== 0) {
    candidatosT.push((bbox.latMin - de.la) / dLa)
    candidatosT.push((bbox.latMax - de.la) / dLa)
  }
  for (const t of candidatosT) {
    if (t <= 0) continue
    const lo = de.lo + t * dLo
    const la = de.la + t * dLa
    if (lo < bbox.lngMin - EPS || lo > bbox.lngMax + EPS || la < bbox.latMin - EPS || la > bbox.latMax + EPS) continue
    if (t < melhorT) melhorT = t
  }
  if (!Number.isFinite(melhorT)) return de

  return { lo: de.lo + melhorT * dLo, la: de.la + melhorT * dLa }
}

/** Leque de direcoes (graus, relativos a direcao pontoDentro->pontoFora) pra
 *  buscar o ponto de costura quando o alinhamento direto falha — ver
 *  `candidatosBordaNaDirecao`. 0 primeiro (o alinhamento direto, preferido:
 *  o caminho mais curto costeando pra fora); os demais em leque cobrindo
 *  todo o resto do horizonte, do mais proximo do alinhamento direto ao
 *  oposto (180). Achado real (onda 22, teste RJ->Salvador): quando
 *  `pontoDentro` esta perto de uma BORDA da fina que fica ao longo da costa
 *  (nao mar adentro), o alinhamento direto ate a borda so anda um pouco
 *  colado na costa — e a faixa costeira e EXATAMENTE o que a dilatacao da
 *  nacional engole, entao nenhum ponto desse trecho curto e agua na
 *  nacional. Outras direcoes (ex.: reto pra mar aberto) escapam da faixa
 *  costeira mesmo sem apontar pro destino — a perna 2 (nacional) encontra o
 *  caminho ate o destino de qualquer jeito a partir dali. */
const LEQUE_DIRECOES_BORDA_GRAUS = [0, 45, -45, 90, -90, 135, -135, 180]

/** Gera um candidato a ponto de costura pra cada direcao do leque (ver
 *  `LEQUE_DIRECOES_BORDA_GRAUS`), em ordem de preferencia (a direcao direta
 *  primeiro). Cada candidato e o ponto onde aquela direcao, partindo de
 *  `de`, sai do bbox `g` (`pontoDaBordaNaDirecao`) — a distancia usada pra
 *  definir a direcao (1000 graus) e arbitraria, so importa o ANGULO. */
function candidatosBordaNaDirecao(g: Bbox, de: Coord, para: Coord): Coord[] {
  const anguloBase = Math.atan2(para.la - de.la, para.lo - de.lo)
  return LEQUE_DIRECOES_BORDA_GRAUS.map((graus) => {
    const angulo = anguloBase + (graus * Math.PI) / 180
    const longe: Coord = { la: de.la + Math.sin(angulo) * 1000, lo: de.lo + Math.cos(angulo) * 1000 }
    return pontoDaBordaNaDirecao(g, de, longe)
  })
}

/** Alcance do snap (em celulas da grade FINA) pro ponto da BORDA usado como
 *  alvo intermediario da perna 1 da costura — mais generoso que
 *  `raioSnapCelulas` porque o ponto da borda e geometria pura (onde o raio
 *  pontoDentro->pontoFora sai do bbox), pode cair em terra sem nenhuma
 *  relacao com uma coordenada que o usuario de fato pediu. 4 km (100 m/celula
 *  = 40 celulas) da folga pra costa recortada perto da borda sem risco de
 *  pular pra uma enseada totalmente diferente (o bbox da fina tem ~400x155
 *  km — 4 km ainda e bem local). */
const RAIO_SNAP_BORDA_METROS = 4_000

function raioSnapBordaCelulas(g: Grade): number {
  const padrao = raioSnapCelulas(g)
  if (!g.metrosPorCelula) return padrao * 2
  return Math.max(padrao, Math.round(RAIO_SNAP_BORDA_METROS / g.metrosPorCelula))
}

/** Corrige o `motivoFalha` de uma falha DENTRO da perna 1 (fina) pro motivo
 *  correto do ponto de vista da rota INTEIRA. Perna 1 sempre roda como
 *  `acharCaminhoDetalhado(fina, pontoDentro, bordaAlvo, ...)` — pontoDentro
 *  no papel de "origem" da SUBCHAMADA, mesmo quando ele e o DESTINO real da
 *  rota (caso `extremoNaFina === "destino"`, ver `acharCaminhoCosturado`).
 *  Sem essa correcao, "pontoDentro nao alcanca agua" sempre sairia rotulado
 *  "origem-longe-da-agua", mentindo pro usuario quando o problema era o
 *  DESTINO dele. Falha no alvo da borda (geometria interna, nao pedida pelo
 *  usuario) ou no A* entre eles vira o generico "sem-caminho" — nao e culpa
 *  nem da origem nem do destino reais, e a costura que nao emendou. */
function motivoPerna1ParaRotaInteira(motivo: MotivoFalhaRota, extremoNaFina: "origem" | "destino"): MotivoFalhaRota {
  if (motivo !== "origem-longe-da-agua") return "sem-caminho"
  return extremoNaFina === "origem" ? "origem-longe-da-agua" : "destino-longe-da-agua"
}

/** Mesma ideia que `motivoPerna1ParaRotaInteira`, pra perna 2 (nacional). Os
 *  papeis "de"/"para" da SUBCHAMADA variam com `extremoNaFina` (ver
 *  `acharCaminhoCosturado`): quando `"origem"`, a subchamada e
 *  costura->pontoFora(destino real) — so a falha de DESTINO é do usuario;
 *  quando `"destino"`, a subchamada e pontoFora(origem real)->costura — so a
 *  falha de ORIGEM é do usuario. A outra ponta de cada subchamada e sempre o
 *  ponto de costura (interno) — falha ali vira "sem-caminho" honesto. */
function motivoPerna2ParaRotaInteira(motivo: MotivoFalhaRota, extremoNaFina: "origem" | "destino"): MotivoFalhaRota {
  if (extremoNaFina === "origem") {
    return motivo === "destino-longe-da-agua" ? "destino-longe-da-agua" : "sem-caminho"
  }
  return motivo === "origem-longe-da-agua" ? "origem-longe-da-agua" : "sem-caminho"
}

export interface ParametrosCostura {
  fina: Grade
  nacional: Grade
  de: Coord
  para: Coord
  /** Qual extremo (`de` ou `para`) esta dentro da fina — vem de `escolherGrade`. */
  extremoNaFina: "origem" | "destino"
  configFina?: ConfigCalado
  configNacional?: ConfigCalado
  corredores?: CorredoresPorCelula
}

export interface ResultadoCostura {
  /** Rota completa (as duas pernas ja suavizadas e emendadas, SEM duplicar o
   *  ponto de costura), ordem origem->destino. `null` se a costura falhou —
   *  ver `motivoFalha`. */
  pernas: Coord[] | null
  /** Caminho BRUTO (pre-suavizacao) das duas pernas emendado, mesma ordem —
   *  quem chama usa isso pra checar corredores (onda 17: precisa do caminho
   *  ANTES do string-pulling, igual ao fluxo sem costura). `null` junto de `pernas`. */
  caminhoBruto: Coord[] | null
  motivoFalha: MotivoFalhaRota | null
  /** Ver `ResultadoRotaNacionalGenerosa.destinoAproximado`. So pode ser
   *  `true` quando `extremoNaFina === "origem"` (a perna nacional termina no
   *  DESTINO real — a unica perna/extremo onde o snap generoso se aplica). */
  destinoAproximado: boolean
}

const SEM_ROTA: ResultadoCostura = { pernas: null, caminhoBruto: null, motivoFalha: null, destinoAproximado: false }

/** Costura perna fina + perna nacional numa rota so — ver o cabecalho da
 *  secao "Onda 22" pra o problema que isso resolve.
 *
 *  Desenho (perna 1, fina): traca a rota, na fina, do extremo INTERNO
 *  (`pontoDentro`) ate o ponto onde uma direcao sai do bbox da fina
 *  (`pontoDaBordaNaDirecao`, com snap generoso ali — `raioSnapBordaCelulas`).
 *  Tenta primeiro a direcao ALINHADA com `pontoFora` (o caminho mais curto);
 *  se o caminho ate ela nao tiver NENHUM ponto que tambem seja agua na
 *  nacional (achado real, onda 22: quando `pontoDentro` fica perto de uma
 *  borda que corre ao longo da costa, o trecho ate ela pode ficar colado na
 *  faixa costeira que a dilatacao da nacional engole inteira), tenta as
 *  outras direcoes do leque (`LEQUE_DIRECOES_BORDA_GRAUS`) em ordem de
 *  proximidade angular ate uma funcionar. Pra cada tentativa que teve
 *  caminho, caminha o caminho bruto do FIM (borda) pro COMECO (pontoDentro)
 *  e para na PRIMEIRA coordenada que tambem e agua na grade NACIONAL — esse
 *  e o ponto de costura (garante que a perna 2 pode comecar ali sem precisar
 *  de snap). Se NENHUMA direcao do leque acha um ponto de costura, a costura
 *  falha honestamente (`motivoFalha`).
 *
 *  Perna 2 (nacional recortada): do ponto de costura ate `pontoFora`, com
 *  `recortarGrade`+`bboxComFolga`, exatamente como a rota nacional pura de
 *  sempre — exceto que o extremo que e o DESTINO REAL do usuario ganha o
 *  snap generoso (`acharCaminhoNacionalComDestinoGeneroso`); o ponto de
 *  costura (ja confirmado agua) e o extremo interno da rota nacional pura
 *  nunca ganham o generoso, so o destino real ganha.
 *
 *  Resultado: uma rota concatenada, sem duplicar o ponto de costura. */
export function acharCaminhoCosturado(p: ParametrosCostura): ResultadoCostura {
  const { fina, nacional, de, para, extremoNaFina, configFina, configNacional, corredores } = p
  const pontoDentro = extremoNaFina === "origem" ? de : para
  const pontoFora = extremoNaFina === "origem" ? para : de

  const raioBorda = raioSnapBordaCelulas(fina)
  let perna1Bruta: ResultadoCaminho | null = null
  let idxCostura = -1
  let primeiraFalhaSnap: MotivoFalhaRota | null = null
  for (const bordaAlvo of candidatosBordaNaDirecao(fina, pontoDentro, pontoFora)) {
    const tentativa = acharCaminhoDetalhado(fina, pontoDentro, bordaAlvo, configFina, corredores, undefined, raioBorda)
    if (!tentativa.caminho) {
      // so guarda a PRIMEIRA falha de snap da origem (pontoDentro) — as
      // direcoes seguintes reusam o MESMO pontoDentro, entao um eventual
      // "origem-longe-da-agua" seria identico em todas; guardar so a
      // primeira evita sobrescrever com a falha (irrelevante) da BORDA em
      // si numa direcao tentada depois.
      if (!primeiraFalhaSnap) primeiraFalhaSnap = tentativa.motivoFalha
      continue
    }
    for (let i = tentativa.caminho.length - 1; i >= 0; i--) {
      if (ehAgua(nacional, paraCelula(nacional, tentativa.caminho[i]))) {
        perna1Bruta = tentativa
        idxCostura = i
        break
      }
    }
    if (perna1Bruta) break
  }
  if (!perna1Bruta || idxCostura === -1) {
    const motivo = primeiraFalhaSnap ? motivoPerna1ParaRotaInteira(primeiraFalhaSnap, extremoNaFina) : "sem-caminho"
    return { ...SEM_ROTA, motivoFalha: motivo }
  }
  const costuraCoord = perna1Bruta.caminho![idxCostura]
  const perna1CaminhoBruto = perna1Bruta.caminho!.slice(0, idxCostura + 1)

  const nacionalRecortada = recortarGrade(nacional, bboxComFolga(costuraCoord, pontoFora))
  // so a subchamada que termina no DESTINO REAL (extremoNaFina === "origem")
  // usa o snap generoso — ver docstring da funcao.
  const perna2De = extremoNaFina === "origem" ? costuraCoord : pontoFora
  const perna2Para = extremoNaFina === "origem" ? pontoFora : costuraCoord

  let perna2Caminho: Coord[] | null
  let perna2Motivo: MotivoFalhaRota | null
  let destinoAproximado = false
  if (extremoNaFina === "origem") {
    const generoso = acharCaminhoNacionalComDestinoGeneroso(nacionalRecortada, perna2De, perna2Para, configNacional, corredores)
    perna2Caminho = generoso.caminho
    perna2Motivo = generoso.motivoFalha
    destinoAproximado = generoso.destinoAproximado
  } else {
    const padrao = acharCaminhoDetalhado(nacionalRecortada, perna2De, perna2Para, configNacional, corredores)
    perna2Caminho = padrao.caminho
    perna2Motivo = padrao.motivoFalha
  }
  if (!perna2Caminho) {
    return { ...SEM_ROTA, motivoFalha: motivoPerna2ParaRotaInteira(perna2Motivo!, extremoNaFina) }
  }

  const perna1Suave = suavizar(fina, perna1CaminhoBruto, configFina)
  const perna2Suave = suavizar(nacionalRecortada, perna2Caminho, configNacional)

  const pernas =
    extremoNaFina === "origem"
      ? [...perna1Suave, ...perna2Suave.slice(1)]
      : [...perna2Suave, ...[...perna1Suave].reverse().slice(1)]
  const caminhoBruto =
    extremoNaFina === "origem"
      ? [...perna1CaminhoBruto, ...perna2Caminho.slice(1)]
      : [...perna2Caminho, ...[...perna1CaminhoBruto].reverse().slice(1)]

  return { pernas, caminhoBruto, motivoFalha: null, destinoAproximado }
}

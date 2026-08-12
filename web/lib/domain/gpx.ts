import { MAX_PONTOS_TRILHA, type PontoTrilha } from "./geo"

/**
 * Parser de GPX (onda 21 — importar do plotter). Le `<trk>`/`<trkseg>`/`<trkpt>`
 * (lat/lon/time), ignora `<rte>`/`<wpt>` (fora de escopo v1, so conta pra avisar
 * na previa) e nunca lanca excecao — arquivo malformado ou mentiroso vira
 * `erro` honesto, nunca um crash.
 *
 * NAO usa `DOMParser`: o ambiente onde os testes rodam (Node puro, via
 * vitest) nao tem DOM nenhum, e adicionar jsdom/happy-dom pra suprir isso
 * seria uma dependencia nova so pra parser de teste — contra a regra "sem
 * dependencia nova" desta onda. GPX e um subconjunto de XML simples o
 * bastante (trk/trkseg/trkpt/rte/rtept/wpt nunca aninham a si mesmos) pra um
 * scanner por regex ser confiavel, e assim o MESMO codigo roda identico no
 * navegador e nos testes — um unico caminho, nao dois.
 */

export interface PontoGpx {
  la: number
  lo: number
  /** epoch em segundos, ou `null` quando o `<trkpt>` original nao tinha `<time>` valido. */
  t: number | null
}

export interface TrilhaGpx {
  nome: string | null
  /** pontos ja ordenados por tempo (quando ha horario) e reduzidos ao limite. */
  pontos: PontoGpx[]
  /** true quando PELO MENOS UM ponto valido nao tinha `<time>` parseavel — sem
   *  meio-termo honesto: a saida inteira fica sem hora, nunca so um trecho. */
  semHorario: boolean
  /** quantidade de pontos validos (coordenadas dentro do intervalo) ANTES de
   *  qualquer amostragem por limite. */
  pontosOriginais: number
  /** != null (e igual a `pontos.length`) SO quando `pontosOriginais` excedia
   *  `MAX_PONTOS_TRILHA` e a trilha foi resumida por amostragem uniforme. */
  pontosResumidosPara: number | null
  /** pontos descartados por coordenada ausente ou fora do intervalo valido
   *  (mesma regua de `web/lib/acoes/trilha.ts`: lat em [-90,90], lon em [-180,180]). */
  pontosDescartados: number
  /** fingerprint estavel da trilha (ver `hashTrilhaGpx`) — usado pra detectar
   *  reimportacao do mesmo arquivo. */
  hash: string
}

export interface ResultadoParseGpx {
  trilhas: TrilhaGpx[]
  /** `<trk>` que nao sobrou nenhum ponto valido depois do descarte — nunca
   *  aparecem em `trilhas`, mas a previa avisa quantas foram assim. */
  trilhasVaziasIgnoradas: number
  /** `<rte>` (rotas planejadas) — fora de escopo v1, nunca viram saida. */
  rotasIgnoradas: number
  /** `<wpt>` (waypoints) — fora de escopo v1, nunca viram saida. */
  waypointsIgnorados: number
  /** preenchido SO quando o arquivo inteiro nao pode ser interpretado
   *  (vazio, sem tag `<gpx>`, ou sem nenhum trk/rte/wpt reconhecivel). */
  erro: string | null
}

interface BlocoTag {
  abertura: string
  conteudo: string
}

/** Extrai todos os blocos de primeiro nivel com o nome `tag` dentro de `xml`
 *  (nao lida com aninhamento do mesmo nome — GPX nunca aninha trk-em-trk,
 *  trkseg-em-trkseg, etc., entao isso e seguro pro subconjunto que lemos).
 *  Tolerante a tag nao fechada: ignora o bloco em vez de travar o arquivo
 *  inteiro. */
function extrairBlocos(xml: string, tag: string): BlocoTag[] {
  const blocos: BlocoTag[] = []
  const reAbertura = new RegExp(`<(?:\\w+:)?${tag}(\\s[^>]*?)?(\\/?)>`, "gi")
  let m: RegExpExecArray | null
  while ((m = reAbertura.exec(xml)) !== null) {
    const abertura = m[0]
    const autoFechado = m[2] === "/"
    if (autoFechado) {
      blocos.push({ abertura, conteudo: "" })
      continue
    }
    const inicioConteudo = m.index + abertura.length
    const restante = xml.slice(inicioConteudo)
    const fech = restante.match(new RegExp(`<\\/(?:\\w+:)?${tag}\\s*>`, "i"))
    if (!fech || fech.index === undefined) {
      // tag nunca fechada — malformado, mas nao trava o resto do arquivo.
      continue
    }
    blocos.push({ abertura, conteudo: restante.slice(0, fech.index) })
    reAbertura.lastIndex = inicioConteudo + fech.index + fech[0].length
  }
  return blocos
}

function atributo(abertura: string, nome: string): string | null {
  const comAspasDuplas = abertura.match(new RegExp(`${nome}\\s*=\\s*"([^"]*)"`, "i"))
  if (comAspasDuplas) return comAspasDuplas[1]
  const comAspasSimples = abertura.match(new RegExp(`${nome}\\s*=\\s*'([^']*)'`, "i"))
  return comAspasSimples ? comAspasSimples[1] : null
}

function textoDaTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)<\\/(?:\\w+:)?${tag}\\s*>`, "i"))
  return m ? m[1].trim() : null
}

/** Coordenada valida = numero finito dentro do intervalo geografico real —
 *  MESMA regua de `web/lib/acoes/trilha.ts` (nao inventa uma nova aqui). */
function coordenadaValida(v: string | null, min: number, max: number): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

function tempoValido(v: string | null): number | null {
  if (v == null) return null
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

function pontosDoTrk(blocoTrk: string): { pontos: PontoGpx[]; descartados: number } {
  const segmentos = extrairBlocos(blocoTrk, "trkseg")
  // Tolerante a GPX fora do padrao com trkpt direto em trk (sem trkseg) —
  // plotters variam, e recusar por causa disso seria dogmatico demais pro
  // que a onda pede (Garmin/Raymarine/Navionics, "todos exportam GPX").
  const blocosPt = segmentos.length > 0
    ? segmentos.flatMap((s) => extrairBlocos(s.conteudo, "trkpt"))
    : extrairBlocos(blocoTrk, "trkpt")

  const pontos: PontoGpx[] = []
  let descartados = 0
  for (const pt of blocosPt) {
    const la = coordenadaValida(atributo(pt.abertura, "lat"), -90, 90)
    const lo = coordenadaValida(atributo(pt.abertura, "lon"), -180, 180)
    if (la === null || lo === null) {
      descartados++
      continue
    }
    const t = tempoValido(textoDaTag(pt.conteudo, "time"))
    pontos.push({ la, lo, t })
  }
  return { pontos, descartados }
}

/** Amostragem uniforme: preserva primeiro e ultimo ponto reais e distribui o
 *  resto em passos iguais — reduz sem enviesar pra um trecho so da trilha. */
function amostraUniforme<T>(itens: T[], max: number): T[] {
  if (itens.length <= max) return itens
  if (max <= 1) return [itens[0]]
  const passo = (itens.length - 1) / (max - 1)
  const resultado: T[] = []
  const vistos = new Set<number>()
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * passo)
    if (vistos.has(idx)) continue
    vistos.add(idx)
    resultado.push(itens[idx])
  }
  return resultado
}

function fnv1a(texto: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Fingerprint estavel da trilha — usado pra detectar reimportacao do mesmo
 *  arquivo (idempotencia pratica, ver `web/lib/acoes/importar-gpx.ts`).
 *
 * Por que nao hash de TODOS os pontos: (1) e caro de calcular e comparar pra
 * trilhas de milhares de pontos; (2) reduziria estabilidade se a amostragem
 * uniforme mudar de algoritmo no futuro (o hash e calculado ANTES da
 * reducao, sobre os pontos originais, entao sobrevive a isso); (3) o proprio
 * roteiro desta onda define o criterio como "mesma embarcacao [ja garantido
 * pela query, que filtra por embarcacao_id] + mesmo inicio/fim/quantidade de
 * pontos" — e exatamente isso que a chave abaixo captura, nem mais nem
 * menos. */
export function hashTrilhaGpx(pontos: PontoGpx[]): string {
  if (pontos.length === 0) return ""
  const a = pontos[0]
  const b = pontos[pontos.length - 1]
  const chave = [
    pontos.length,
    a.la.toFixed(5), a.lo.toFixed(5), a.t ?? "",
    b.la.toFixed(5), b.lo.toFixed(5), b.t ?? "",
  ].join("|")
  return fnv1a(chave)
}

/** Converte pontos do parser (t pode ser `null`) pro formato de armazenamento
 *  (`PontoTrilha`, t sempre numero) — chamado SO no momento de gravar/somar
 *  distancia. Quando a trilha nao tem horario real, `t` vira um INDICE
 *  sequencial (0,1,2,...) so pra manter a ordem: nunca use esses valores pra
 *  calcular duracao ou velocidade (`resumoTrilha` fabricaria numeros com
 *  eles) — so a distancia (soma de haversine entre pontos consecutivos)
 *  continua honesta, porque nao depende de `t`. A tela da saida esconde os
 *  campos de tempo quando a trilha esta marcada sem horario, exatamente por
 *  isso (ver `trilha_sem_horario` em `web/lib/acoes/importar-gpx.ts`). */
export function paraPontosArmazenaveis(pontos: PontoGpx[]): PontoTrilha[] {
  return pontos.map((p, i) => ({ la: p.la, lo: p.lo, t: p.t ?? i }))
}

export function parseGpx(conteudo: string): ResultadoParseGpx {
  const vazio: ResultadoParseGpx = {
    trilhas: [], trilhasVaziasIgnoradas: 0, rotasIgnoradas: 0, waypointsIgnorados: 0, erro: null,
  }

  if (typeof conteudo !== "string" || conteudo.trim() === "") {
    return { ...vazio, erro: "Arquivo vazio — escolha um GPX exportado do plotter." }
  }
  if (!/<gpx[\s>]/i.test(conteudo)) {
    return { ...vazio, erro: "Este arquivo não parece um GPX — falta a tag <gpx>." }
  }

  try {
    const blocosTrk = extrairBlocos(conteudo, "trk")
    const blocosRte = extrairBlocos(conteudo, "rte")
    const blocosWpt = extrairBlocos(conteudo, "wpt")

    if (blocosTrk.length === 0 && blocosRte.length === 0 && blocosWpt.length === 0) {
      return { ...vazio, erro: "Nenhuma trilha, rota ou waypoint encontrado neste arquivo." }
    }

    const trilhas: TrilhaGpx[] = []
    let trilhasVaziasIgnoradas = 0

    for (const blocoTrk of blocosTrk) {
      const nome = textoDaTag(blocoTrk.conteudo, "name")
      const { pontos, descartados } = pontosDoTrk(blocoTrk.conteudo)
      if (pontos.length === 0) {
        trilhasVaziasIgnoradas++
        continue
      }

      const semHorario = pontos.some((p) => p.t === null)
      const ordenados = semHorario
        ? pontos
        : [...pontos].sort((a, b) => (a.t as number) - (b.t as number))

      const hash = hashTrilhaGpx(ordenados)
      const reduzidos = amostraUniforme(ordenados, MAX_PONTOS_TRILHA)

      trilhas.push({
        nome,
        pontos: reduzidos,
        semHorario,
        pontosOriginais: ordenados.length,
        pontosResumidosPara: reduzidos.length < ordenados.length ? reduzidos.length : null,
        pontosDescartados: descartados,
        hash,
      })
    }

    if (trilhas.length === 0 && trilhasVaziasIgnoradas === 0 && blocosTrk.length === 0) {
      // Sem <trk> nenhum, so rte/wpt — nao e erro (o arquivo e valido e foi
      // lido), so nao ha nada pra importar; a previa mostra os avisos.
      return { ...vazio, rotasIgnoradas: blocosRte.length, waypointsIgnorados: blocosWpt.length }
    }

    return {
      trilhas,
      trilhasVaziasIgnoradas,
      rotasIgnoradas: blocosRte.length,
      waypointsIgnorados: blocosWpt.length,
      erro: null,
    }
  } catch {
    return { ...vazio, erro: "Não foi possível interpretar este arquivo GPX. Confira se ele não está corrompido." }
  }
}

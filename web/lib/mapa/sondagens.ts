import type { ExpressionSpecification } from "mapbox-gl"
import type { Bbox } from "@/lib/domain/rota"

/**
 * Sondagens da comunidade no mapa (auditoria 360 de 20/08/2026, recomendação
 * nº 3) — a parte PURA e testável do fechamento do loop coleta→mapa: o dado
 * de profundidade crowdsourced já era coletado (`sondagem-painel.tsx`),
 * validado (`lib/domain/sondagem.ts`) e guardado (migration 025), mas nunca
 * voltava pra tela. Este módulo converte o agregado por célula em GeoJSON e
 * monta a rampa de cor; o hook que liga isso ao Mapbox vive em
 * `components/mapa/camada-sondagens.ts` (mesma divisão lib puro / hook
 * interface de `usar-cores-mapa.ts`).
 *
 * PRIVACIDADE: tudo aqui consome SOMENTE o agregado anônimo por célula que a
 * função security definer `sondagens_por_celula` (migration 025) devolve —
 * centroide, mediana, contagem. Nunca a linha bruta de ninguém, nunca
 * embarcacao_id/usuario_id. A consulta passa por `/api/sondagens`
 * (autenticada, com teto e rate limit), nunca pela tabela direto.
 */

/** Linha do agregado como ela viaja de `/api/sondagens` até a camada — o
 *  subconjunto de `CelulaSondagemAgregada` (lib/db/types.ts) que o desenho
 *  precisa. `ultima_leitura` fica de fora DE PROPÓSITO: carimbo de hora
 *  cruzado com célula de 15 m estreita o anonimato de graça — exatamente a
 *  mesma decisão documentada em `CorredorAgregado`. */
export interface CelulaSondagemMapa {
  celula_id: string
  lat: number
  lon: number
  profundidade_m: number
  leituras: number
}

/** Resposta de `/api/sondagens`: as células do bbox e a verdade sobre corte —
 *  `cortado: true` significa que havia MAIS células que o teto e a resposta
 *  veio incompleta (quem consome loga isso honestamente, nunca finge que o
 *  mapa está completo). */
export interface RespostaSondagensMapa {
  celulas: CelulaSondagemMapa[]
  cortado: boolean
}

/** Nunca mais células que isso numa resposta — mesma lógica defensiva do
 *  `LIMITE_LINHAS` de `/api/corredores`: um bbox gigante (zoom lá longe numa
 *  área muito mapeada) não pode virar payload sem teto. O servidor ordena por
 *  `leituras` DESC antes de cortar, então o que sobrevive ao corte são as
 *  células mais confirmadas — e o corte é reportado (`cortado`), nunca mudo. */
export const TETO_CELULAS_POR_CONSULTA = 4000

/**
 * Rampa de cor por profundidade — as MESMAS âncoras da batimetria fina
 * (scripts/gerar-batimetria.mjs, camada costeira): a camada de sondagens
 * conta a mesma história ("quão fundo é aqui") e por isso fala a MESMA
 * língua de cor, não uma paleta nova. Valores copiados byte a byte das
 * âncoras de lá (0/5/10/20/50 m + a âncora funda de 150 m = o navy do
 * produto). O que NÃO foi copiado é o alfa decrescente: lá, água funda
 * dissolve no mapa porque a camada é um fundo contínuo; aqui cada círculo é
 * uma MEDIÇÃO real de alguém — sumir com as fundas seria esconder dado. A
 * opacidade constante fica no paint da camada, não na rampa.
 *
 * String de cor literal em `.ts` é o padrão aceito da casa pra canvas do
 * Mapbox sem token por perto (mesma situação da paleta curada de
 * `lib/mapa/pino-parceiro.ts` — ver o mapa de exceções em
 * `lib/ui/tokens.test.ts`); não existe custom property da rampa de
 * batimetria pra ler do documento.
 */
export const ANCORAS_RAMPA_SONDAGEM: { profundidadeM: number; cor: string }[] = [
  { profundidadeM: 0, cor: "rgb(127, 209, 236)" },
  { profundidadeM: 5, cor: "rgb(86, 178, 219)" },
  { profundidadeM: 10, cor: "rgb(59, 154, 199)" },
  { profundidadeM: 20, cor: "rgb(38, 120, 172)" },
  { profundidadeM: 50, cor: "rgb(27, 100, 148)" },
  { profundidadeM: 150, cor: "rgb(20, 76, 118)" },
]

/** A rampa acima no formato de expressão do Mapbox (`interpolate` linear
 *  sobre a propriedade `profundidade_m` de cada círculo) — mesmo
 *  comportamento do gradiente contínuo da batimetria, só que resolvido pela
 *  GPU por feature em vez de pré-pintado num PNG. O `as unknown as` é o
 *  preço de montar a expressão a partir das âncoras (uma fonte só de
 *  verdade) em vez de um literal contextualmente tipado — o teste de
 *  estrutura em `sondagens.test.ts` é quem garante o formato. */
export function expressaoCorSondagem(): ExpressionSpecification {
  const paradas: (number | string)[] = []
  for (const a of ANCORAS_RAMPA_SONDAGEM) paradas.push(a.profundidadeM, a.cor)
  return ["interpolate", ["linear"], ["get", "profundidade_m"], ...paradas] as unknown as ExpressionSpecification
}

/** O formato estrutural que `GeoJSONSource#setData` espera — literal, sem
 *  nomear tipos do pacote `geojson` (que não é dependência do projeto; mesma
 *  decisão do `colecaoVazia()` de navegar-mapa.tsx). */
export interface ColecaoSondagens {
  type: "FeatureCollection"
  features: {
    type: "Feature"
    properties: { profundidade_m: number; leituras: number }
    geometry: { type: "Point"; coordinates: [number, number] }
  }[]
}

export function colecaoSondagensVazia(): ColecaoSondagens {
  return { type: "FeatureCollection", features: [] }
}

/** Converte as células agregadas em GeoJSON de pontos pro Mapbox. Célula com
 *  número quebrado (lat/lon/profundidade não-finitos, fora de faixa) é
 *  DESCARTADA, não "consertada": um círculo pintado no lugar errado ou com a
 *  cor de outra profundidade é pior que círculo nenhum — mesma filosofia do
 *  parser NMEA em lib/domain/sondagem.ts, que nunca inventa um número. */
export function celulasParaGeoJSON(celulas: CelulaSondagemMapa[]): ColecaoSondagens {
  const features: ColecaoSondagens["features"] = []
  for (const c of celulas) {
    const valida =
      Number.isFinite(c?.lat) && c.lat >= -90 && c.lat <= 90 &&
      Number.isFinite(c?.lon) && c.lon >= -180 && c.lon <= 180 &&
      Number.isFinite(c?.profundidade_m) && c.profundidade_m > 0
    if (!valida) continue
    features.push({
      type: "Feature",
      properties: {
        profundidade_m: c.profundidade_m,
        leituras: Number.isFinite(c?.leituras) && c.leituras > 0 ? c.leituras : 1,
      },
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
    })
  }
  return { type: "FeatureCollection", features }
}

const RESPOSTA_VAZIA: RespostaSondagensMapa = { celulas: [], cortado: false }

/** Busca o agregado de sondagens no bbox do viewport — endpoint leve
 *  (`/api/sondagens`, ver web/app/api/sondagens/route.ts) por cima da função
 *  security definer da migration 025. Falha de rede/servidor NUNCA aparece
 *  na tela como erro: devolve vazio e a camada simplesmente não pinta nada
 *  desta vez — mesma filosofia de degrade silencioso de `buscarCorredores`
 *  (lib/mapa/corredores.ts). */
export async function buscarSondagens(bbox: Bbox): Promise<RespostaSondagensMapa> {
  try {
    const params = new URLSearchParams({
      lngMin: String(bbox.lngMin),
      latMin: String(bbox.latMin),
      lngMax: String(bbox.lngMax),
      latMax: String(bbox.latMax),
    })
    const resposta = await fetch(`/api/sondagens?${params.toString()}`)
    if (!resposta.ok) return RESPOSTA_VAZIA
    const corpo = (await resposta.json()) as Partial<RespostaSondagensMapa> | null
    if (!corpo || !Array.isArray(corpo.celulas)) return RESPOSTA_VAZIA
    return { celulas: corpo.celulas, cortado: corpo.cortado === true }
  } catch {
    return RESPOSTA_VAZIA
  }
}

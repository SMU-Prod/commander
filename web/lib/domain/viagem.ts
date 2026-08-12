import { distanciaDaRota, type Coord } from "@/lib/domain/rota"
import { resumoTrilha, type PontoTrilha } from "@/lib/domain/geo"
import { etaMinutos } from "@/lib/domain/navegacao"

// ---------------------------------------------------------------------------
// Onda 19 — planejar viagem ("Strava do Mar"): uma viagem é uma sequência
// ordenada de PARADAS (origem -> parada 1 -> ... -> destino final — nunca
// "waypoint"/"trip" na UI, ver glossário em docs/CONTRIBUTING.md). Este
// módulo NUNCA calcula caminho pela água — isso é o motor existente
// (web/lib/domain/rota.ts, `acharCaminho`, rodado no Worker
// web/components/mapa/rota.worker.ts). Aqui só SOMA o que o motor já
// calculou por perna (distância via `distanciaDaRota`) e deriva ETA a partir
// de uma velocidade de cruzeiro — nunca inventa nem o caminho nem a
// velocidade.
// ---------------------------------------------------------------------------

export interface Parada {
  nome: string
  la: number
  lo: number
}

/** Velocidade de cruzeiro já resolvida, com o texto PRONTO pra tela dizer de
 *  onde ela veio — nunca um número mudo (regra de honestidade da onda). */
export interface OrigemVelocidade {
  kt: number
  texto: string
}

export interface EventoComTrilha {
  trilha: PontoTrilha[] | null
}

/** Ordem de honestidade, passo (a): média das MÉDIAS de velocidade das
 *  saídas que têm trilha GPS real — não a média ponderada pela distância
 *  (uma saída longa não deve "pesar mais" que uma curta só por ser mais
 *  longa; cada saída representa igualmente o jeito que o dono cruza). `null`
 *  quando não há nenhuma saída com trilha (>= 2 pontos) — quem chama cai
 *  pro passo (b), `velocidadeCruzeiroInformada`. */
export function velocidadeCruzeiroHistorica(eventos: EventoComTrilha[]): OrigemVelocidade | null {
  const medias = eventos
    .filter((e): e is { trilha: PontoTrilha[] } => Array.isArray(e.trilha) && e.trilha.length >= 2)
    .map((e) => resumoTrilha(e.trilha).velMediaKt)
    .filter((v) => v > 0)
  if (medias.length === 0) return null
  const media = medias.reduce((a, b) => a + b, 0) / medias.length
  return {
    kt: media,
    texto: `pela sua média de ${media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`,
  }
}

/** Ordem de honestidade, passo (b): velocidade de cruzeiro informada na hora
 *  do planejamento (sem histórico de saída com trilha). Não persiste nesta
 *  onda — é usada só pra calcular o ETA na tela, na hora. */
export function velocidadeCruzeiroInformada(kt: number): OrigemVelocidade {
  return {
    kt,
    texto: `pela velocidade de cruzeiro informada (${kt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt)`,
  }
}

/** Uma perna da viagem: da parada anterior até esta. `pontos` é o caminho
 *  pela água já calculado pelo motor (mesmo formato que o Worker devolve —
 *  ver `RespostaRota` em rota.worker.ts); `null` quando o A* não achou
 *  caminho pra esse trecho (calado, fora da área) — a perna continua
 *  aparecendo na lista, honestamente, sem distância/ETA nenhuma inventada. */
export interface PernaViagem {
  de: Parada
  para: Parada
  pontos: Coord[] | null
  distanciaNm: number | null
  etaMin: number | null
}

export interface Viagem {
  paradas: Parada[]
  pernas: PernaViagem[]
  /** Soma só das pernas COM caminho — uma perna sem caminho não entra
   *  disfarçada de zero, ela simplesmente não soma (ver `completa`). */
  distanciaTotalNm: number
  /** `null` quando nenhuma perna tem ETA (sem velocidade, ou nenhum caminho
   *  achado) — nunca um total inventado. */
  etaTotalMin: number | null
  /** `true` só quando TODAS as pernas têm caminho — `false` é o sinal pra
   *  tela dizer que a viagem está incompleta (uma perna sem rota pela água),
   *  em vez de fingir um total inteiro. */
  completa: boolean
}

/** Monta a viagem a partir das paradas (em ordem: origem -> ... -> destino)
 *  e dos caminhos JÁ CALCULADOS pelo motor pra cada perna —
 *  `caminhosPorPerna[i]` é o caminho de `paradas[i]` pra `paradas[i+1]`, ou
 *  `null` se o A* não achou rota pra esse trecho. `velocidade` é o que
 *  `velocidadeCruzeiroHistorica`/`velocidadeCruzeiroInformada` devolveram —
 *  `null` quando ainda não há nenhuma das duas (a tela não deve inventar
 *  ETA nesse caso, só mostrar a distância). */
export function montarViagem(
  paradas: Parada[],
  caminhosPorPerna: (Coord[] | null)[],
  velocidade: OrigemVelocidade | null,
): Viagem {
  const pernas: PernaViagem[] = []
  let distanciaTotalNm = 0
  let etaTotalMin = 0
  let temEta = false
  let completa = true

  for (let i = 0; i < paradas.length - 1; i++) {
    const de = paradas[i]
    const para = paradas[i + 1]
    const pontos = caminhosPorPerna[i] ?? null
    if (!pontos) {
      completa = false
      pernas.push({ de, para, pontos: null, distanciaNm: null, etaMin: null })
      continue
    }
    const distanciaNm = distanciaDaRota(pontos)
    const etaMin = velocidade ? etaMinutos(distanciaNm, velocidade.kt) : null
    distanciaTotalNm += distanciaNm
    if (etaMin != null) {
      etaTotalMin += etaMin
      temEta = true
    }
    pernas.push({ de, para, pontos, distanciaNm, etaMin })
  }

  return {
    paradas,
    pernas,
    distanciaTotalNm,
    etaTotalMin: temEta ? etaTotalMin : null,
    completa,
  }
}

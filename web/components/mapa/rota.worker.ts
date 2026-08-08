/// <reference lib="webworker" />
// Web Worker do calculo de rota maritima. Medido no navegador (Task 4 da Onda 5):
// a rota mais longa da area coberta (Marina da Gloria -> Buzios) leva ~340ms de
// A* + suavizacao no thread principal — acima do limite de ~300ms combinado no
// plano. Rodar aqui evita congelar a tela (toques, scroll do mapa) durante o
// calculo; o carregamento/decodificacao da mascara (~186ms na primeira vez)
// tambem fica aqui, memoizado, entao só paga esse custo uma vez por sessao.
import { carregarGrade, dentroDaGrade } from "@/lib/mapa/mascara"
import { acharCaminho, distanciaDaRota, suavizar, type Coord } from "@/lib/domain/rota"

export interface PedidoRota {
  id: number
  de: Coord
  para: Coord
}

export type RespostaRota =
  | { id: number; tipo: "rota"; pernas: Coord[]; distanciaNm: number }
  | { id: number; tipo: "fora-da-area" }
  | { id: number; tipo: "sem-caminho" }
  | { id: number; tipo: "sem-mascara" }

self.onmessage = async (e: MessageEvent<PedidoRota>) => {
  const { id, de, para } = e.data
  const grade = await carregarGrade()
  if (!grade) {
    postMessage({ id, tipo: "sem-mascara" } satisfies RespostaRota)
    return
  }
  if (!dentroDaGrade(grade, de) || !dentroDaGrade(grade, para)) {
    postMessage({ id, tipo: "fora-da-area" } satisfies RespostaRota)
    return
  }
  const caminho = acharCaminho(grade, de, para)
  if (!caminho) {
    postMessage({ id, tipo: "sem-caminho" } satisfies RespostaRota)
    return
  }
  const pernas = suavizar(grade, caminho)
  postMessage({ id, tipo: "rota", pernas, distanciaNm: distanciaDaRota(pernas) } satisfies RespostaRota)
}

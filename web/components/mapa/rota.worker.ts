/// <reference lib="webworker" />
// Web Worker do calculo de rota maritima. Medido no navegador (Task 4 da Onda 5):
// a rota mais longa da area coberta (Marina da Gloria -> Buzios) leva ~340ms de
// A* + suavizacao no thread principal — acima do limite de ~300ms combinado no
// plano. Rodar aqui evita congelar a tela (toques, scroll do mapa) durante o
// calculo; o carregamento/decodificacao da mascara (~186ms na primeira vez)
// tambem fica aqui, memoizado, entao só paga esse custo uma vez por sessao.
//
// Onda 11 (rota nacional): DUAS mascaras agora — a fina (100 m/celula, o
// circuito historico Ilhabela<->Buzios) e a nacional (~3,6 km/celula, costa
// brasileira inteira). `escolherGrade` decide qual usar (fina se origem E
// destino cabem nela — melhor detalhe; senao a nacional, se os dois cabem
// nela). A nacional so e RECORTADA (`bboxComFolga`+`recortarGrade`) ao
// trecho da viagem antes do A* — e o que torna cobrir o Brasil inteiro
// viavel em memoria de celular: o custo depende do TRECHO, nao da cobertura.
// A nacional so e BUSCADA (fetch) quando a fina nao cobre os dois pontos —
// poupa banda/memoria no caso comum (navegando perto de casa).
import { carregarGrade, carregarGradeNacional, dentroDaGrade } from "@/lib/mapa/mascara"
import { acharCaminho, bboxComFolga, distanciaDaRota, escolherGrade, recortarGrade, suavizar, type Coord, type TipoGrade } from "@/lib/domain/rota"

export interface PedidoRota {
  id: number
  de: Coord
  para: Coord
}

export type RespostaRota =
  | { id: number; tipo: "rota"; pernas: Coord[]; distanciaNm: number; precisao: TipoGrade }
  | { id: number; tipo: "fora-da-area" }
  | { id: number; tipo: "sem-caminho" }
  | { id: number; tipo: "sem-mascara" }

self.onmessage = async (e: MessageEvent<PedidoRota>) => {
  const { id, de, para } = e.data
  const gradeFina = await carregarGrade()

  // Caminho rapido: se a fina ja cobre os dois pontos, nem busca a nacional —
  // e o caso comum (navegando perto de casa) e evita fetch/decode a toa.
  const gradeNacional =
    gradeFina && dentroDaGrade(gradeFina, de) && dentroDaGrade(gradeFina, para) ? null : await carregarGradeNacional()

  if (!gradeFina && !gradeNacional) {
    postMessage({ id, tipo: "sem-mascara" } satisfies RespostaRota)
    return
  }

  const escolha = escolherGrade(gradeFina, gradeNacional, de, para)
  if (!escolha) {
    postMessage({ id, tipo: "fora-da-area" } satisfies RespostaRota)
    return
  }

  // So recorta a nacional (grossa, cobertura nacional) — a fina ja e pequena
  // o bastante pra rodar o A* nela inteira, e recortar mudaria a precisao/
  // distancia de rotas que ja funcionavam (regressao que a task pediu pra
  // provar que NAO acontece).
  const gradeParaRota = escolha.tipo === "nacional" ? recortarGrade(escolha.grade, bboxComFolga(de, para)) : escolha.grade

  const caminho = acharCaminho(gradeParaRota, de, para)
  if (!caminho) {
    postMessage({ id, tipo: "sem-caminho" } satisfies RespostaRota)
    return
  }
  const pernas = suavizar(gradeParaRota, caminho)
  postMessage({
    id,
    tipo: "rota",
    pernas,
    distanciaNm: distanciaDaRota(pernas),
    precisao: escolha.tipo,
  } satisfies RespostaRota)
}

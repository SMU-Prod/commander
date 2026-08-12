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
//
// Onda 12 (rota por calado): quando o pedido traz `caladoM` (calado da
// embarcacao ativa, cadastrado em /barco/editar), a rota passa a respeitar
// profundidade — carrega a GRADE DE PROFUNDIDADE que casa com a grade de
// agua escolhida (fina ou nacional) e roda o A*/suavizacao com
// `ConfigCalado`. Degrada com HONESTIDADE, nunca em silencio absoluto: se a
// grade de profundidade nao carregar, o calado NAO e aplicado e a resposta
// avisa isso via `caladoM: null` (a tela distingue "sem calado cadastrado"
// de "calado cadastrado mas nao pude aplicar agora" comparando com o que ELA
// mesma pediu). Se nao houver caminho respeitando o calado mas houver sem
// essa restricao, a resposta marca `semCaminhoPorCalado: true` — a tela
// explica "nao achei caminho com o calado do seu barco" em vez de um
// generico "sem caminho".
//
// Onda 17 (corredores — "Strava do Mar"): busca as passagens reais
// conhecidas no bbox da viagem (`buscarCorredores`, endpoint leve
// `/api/corredores`) e passa pro A* como PREFERENCIA (nunca restricao — ver
// `CorredoresPorCelula` em lib/domain/rota.ts). Falha de rede/servidor
// degrada em silencio pra `CorredoresPorCelula` vazio (mesma filosofia da
// mascara/grade de profundidade acima): a rota continua saindo normal, so
// sem a preferencia. `usouCorredores` na resposta e HONESTO — so vira `true`
// se a rota calculada de fato passou por alguma celula com passagem
// conhecida, nao so "havia corredor perto" (ver navegar-mapa.tsx pro texto
// que isso habilita, e o cuidado de NUNCA dizer "validada"/"segura").
import {
  carregarGrade,
  carregarGradeNacional,
  carregarGradeProfundidade,
  carregarGradeProfundidadeNacional,
  dentroDaGrade,
} from "@/lib/mapa/mascara"
import { buscarCorredores } from "@/lib/mapa/corredores"
import {
  acharCaminho,
  bboxComFolga,
  distanciaDaRota,
  escolherGrade,
  MARGEM_SEGURANCA_PADRAO_M,
  RESOLUCAO_CELULA_CORREDOR_M,
  recortarGrade,
  suavizar,
  type Coord,
  type ConfigCalado,
  type CorredoresPorCelula,
  type TipoGrade,
} from "@/lib/domain/rota"
import { celulaId } from "@/lib/domain/sondagem"

export interface PedidoRota {
  id: number
  de: Coord
  para: Coord
  /** Calado da embarcacao ativa, em metros (onda 12). `null`/ausente = barco
   *  sem calado cadastrado — o worker roteia sem restricao de profundidade;
   *  a TELA e quem decide o que mostrar sobre isso (ver navegar-mapa.tsx). */
  caladoM?: number | null
}

export type RespostaRota =
  | {
      id: number
      tipo: "rota"
      pernas: Coord[]
      distanciaNm: number
      precisao: TipoGrade
      /** Calado EFETIVAMENTE aplicado no calculo desta rota — `null` quando
       *  NAO foi aplicado (pedido sem calado, OU grade de profundidade
       *  indisponivel: degrada pra rota sem restricao). Comparar com o
       *  calado que a tela pediu e o que decide qual aviso mostrar. */
      caladoM: number | null
      /** true = a rota calculada passa por pelo menos UMA celula com
       *  passagem real conhecida (onda 17). Honesto: nao significa "corredor
       *  disponivel na area", significa "esta rota especifica usou um". */
      usouCorredores: boolean
    }
  | { id: number; tipo: "fora-da-area" }
  | {
      id: number
      tipo: "sem-caminho"
      /** true = existe rota SEM considerar o calado pedido, so nao COM ele —
       *  a tela troca o texto generico por "nao achei caminho com o calado
       *  do seu barco". false = nem sem calado ha caminho (ou calado nem foi
       *  pedido). */
      semCaminhoPorCalado: boolean
    }
  | { id: number; tipo: "sem-mascara" }

self.onmessage = async (e: MessageEvent<PedidoRota>) => {
  const { id, de, para, caladoM } = e.data
  // Corredores (onda 17) buscados EM PARALELO com a mascara — nao faz
  // sentido esperar a grade carregar pra so entao pedir o bbox, os dois sao
  // independentes. `buscarCorredores` nunca rejeita (falha vira mapa vazio).
  const corredoresPromessa = buscarCorredores(bboxComFolga(de, para))
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

  // Grade de profundidade so e buscada quando ha calado pra aplicar — mesma
  // economia de banda/memoria da nacional acima. A grade de profundidade
  // NUNCA precisa ser recortada (diferente da de agua): `profundidadeEm`
  // amostra por coordenada, nao por indice compartilhado com `gradeParaRota`.
  let config: ConfigCalado | undefined
  let caladoAplicado: number | null = null
  if (caladoM != null && caladoM > 0) {
    const gradeProfundidade =
      escolha.tipo === "nacional" ? await carregarGradeProfundidadeNacional() : await carregarGradeProfundidade()
    if (gradeProfundidade) {
      config = { caladoM, margemSegurancaM: MARGEM_SEGURANCA_PADRAO_M, profundidade: gradeProfundidade }
      caladoAplicado = caladoM
    }
    // gradeProfundidade null (rede, etc.): degrada em silencio pra rota sem
    // calado, igual ao resto do app faz com mascara ausente — `caladoM: null`
    // na resposta e quem avisa a tela que a restricao nao foi aplicada.
  }

  const corredores: CorredoresPorCelula = await corredoresPromessa

  const caminho = acharCaminho(gradeParaRota, de, para, config, corredores)
  if (!caminho) {
    // Se havia config de calado, confere se EXISTIRIA caminho sem essa
    // restricao — e o que decide a mensagem "nao achei com o calado do seu
    // barco" (existe rota, so nao pra esse calado) vs o generico "sem
    // caminho" (nao ha rota nem sem restricao nenhuma).
    const semCaminhoPorCalado = config != null && acharCaminho(gradeParaRota, de, para) != null
    postMessage({ id, tipo: "sem-caminho", semCaminhoPorCalado } satisfies RespostaRota)
    return
  }
  const pernas = suavizar(gradeParaRota, caminho, config)
  // Honestidade (onda 17): so afirma "usou corredores" se a rota calculada
  // de fato passa por uma celula com passagem conhecida — checa o caminho
  // BRUTO do A* (antes do string-pulling de `suavizar`, que so remove
  // pontos intermediarios pra desenho, nao muda por onde a rota passou).
  const usouCorredores = corredores.porCelula.size > 0 && caminho.some((c) => corredores.porCelula.has(celulaId(c.la, c.lo, RESOLUCAO_CELULA_CORREDOR_M)))
  postMessage({
    id,
    tipo: "rota",
    pernas,
    distanciaNm: distanciaDaRota(pernas),
    precisao: escolha.tipo,
    caladoM: caladoAplicado,
    usouCorredores,
  } satisfies RespostaRota)
}

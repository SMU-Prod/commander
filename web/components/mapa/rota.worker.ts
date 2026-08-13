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
//
// Onda 22 (rota costurada): `escolherGrade` ganhou um terceiro caso —
// "costura" — quando EXATAMENTE um extremo (origem OU destino) esta dentro
// da fina e o outro fora dela (mas dentro da nacional). Antes desta onda
// esse caso caia direto na nacional PURA, e a dilatacao de seguranca dela
// (~7,4 km) engole baias/estreitos inteiros (Guanabara, Sepetiba, canais de
// Ilha Grande) — um ponto dentro da fina podia falhar o snap mesmo estando
// em agua de verdade (caso real de producao, 12/08/2026). A costura (ver
// `acharCaminhoCosturado` em lib/domain/rota.ts) resolve tracando UMA perna
// pela fina (do extremo interno ate um ponto de costura — agua nas duas
// grades) + UMA perna pela nacional recortada (do ponto de costura ate o
// extremo externo), emendadas sem duplicar o ponto de costura. A resposta
// marca `precisao: "mista"` nesse caso — a tela avisa que so o trecho
// costeiro tem o detalhe da fina, o resto e grosseiro (nacional).
//
// Onda 22 tambem: o DESTINO (nunca a origem) ganha snap mais generoso na
// grade nacional (`acharCaminhoNacionalComDestinoGeneroso`) — segundo print
// de producao (pino em Vitoria/ES, "nao achei caminho"): o ponto que o
// usuario TOCA no mapa tende a cair bem na costa, exatamente a faixa que a
// dilatacao da nacional engole. Quando so o raio generoso resolveu,
// `destinoAproximado: true` avisa a tela pra nao fingir que a rota chega no
// ponto exato — "chega na altura do destino", nao nele.
import {
  carregarGrade,
  carregarGradeNacional,
  carregarGradeProfundidade,
  carregarGradeProfundidadeNacional,
  dentroDaGrade,
} from "@/lib/mapa/mascara"
import { buscarCorredores } from "@/lib/mapa/corredores"
import {
  acharCaminhoCosturado,
  acharCaminhoDetalhado,
  acharCaminhoNacionalComDestinoGeneroso,
  bboxComFolga,
  distanciaDaRota,
  escolherGrade,
  MARGEM_SEGURANCA_PADRAO_M,
  RESOLUCAO_CELULA_CORREDOR_M,
  recortarGrade,
  segmentoEmAgua,
  suavizar,
  type Coord,
  type ConfigCalado,
  type CorredoresPorCelula,
  type Grade,
  type MotivoFalhaRota,
} from "@/lib/domain/rota"
import { celulaId } from "@/lib/domain/sondagem"
import { suavizarChaikinComAgua, type Ponto } from "@/lib/mapa/suavizar-linha"

export interface PedidoRota {
  id: number
  de: Coord
  para: Coord
  /** Calado da embarcacao ativa, em metros (onda 12). `null`/ausente = barco
   *  sem calado cadastrado — o worker roteia sem restricao de profundidade;
   *  a TELA e quem decide o que mostrar sobre isso (ver navegar-mapa.tsx). */
  caladoM?: number | null
}

/** Precisao da rota devolvida — onda 22 ganhou `"mista"` (rota costurada:
 *  trecho costeiro na fina, resto na nacional grosseira). */
export type Precisao = "fina" | "nacional" | "mista"

export type RespostaRota =
  | {
      id: number
      tipo: "rota"
      pernas: Coord[]
      distanciaNm: number
      precisao: Precisao
      /** Calado EFETIVAMENTE aplicado no calculo desta rota — `null` quando
       *  NAO foi aplicado (pedido sem calado, OU grade de profundidade
       *  indisponivel: degrada pra rota sem restricao). Comparar com o
       *  calado que a tela pediu e o que decide qual aviso mostrar. */
      caladoM: number | null
      /** true = a rota calculada passa por pelo menos UMA celula com
       *  passagem real conhecida (onda 17). Honesto: nao significa "corredor
       *  disponivel na area", significa "esta rota especifica usou um". */
      usouCorredores: boolean
      /** Onda 22: true = o destino so foi alcancado com o snap GENEROSO da
       *  nacional (`acharCaminhoNacionalComDestinoGeneroso`) — a rota termina
       *  "na altura do" destino pedido, nao literalmente nele. So pode vir
       *  `true` quando `precisao` e `"nacional"` ou `"mista"` (a fina nunca
       *  usa o snap generoso). */
      destinoAproximado: boolean
      /** Onda 27: coordenadas PRONTAS pra desenhar a linha da rota — `pernas`
       *  (acima) ja passou pela suavizacao visual Chaikin (`suavizarChaikin-
       *  ComAgua`, lib/mapa/suavizar-linha.ts) com verificacao de agua contra
       *  a(s) grade(s) usada(s) nesta rota. Calculado AQUI (worker), nao no
       *  componente, porque e aqui que a grade ja esta carregada — caso real
       *  de producao (13/08/2026): a suavizacao Chaikin sem essa checagem
       *  podia desenhar um atalho por cima de terra numa curva fechada perto
       *  da costa, mesmo com `pernas` (o caminho cru) inteiramente na agua. A
       *  tela deve desenhar ISSO, nao chamar `suavizarChaikin` de novo sobre
       *  `pernas`. */
      linhaSuave: Coord[]
    }
  | { id: number; tipo: "fora-da-area" }
  | {
      id: number
      tipo: "sem-caminho"
      /** Onda 22: POR QUE nao achou — snap da origem, snap do destino, ou
       *  pathfinding mesmo (os dois snaps deram certo, mas nao ha rota
       *  navegavel conectando-os). Ver `MotivoFalhaRota` em lib/domain/rota.ts. */
      motivo: MotivoFalhaRota
      /** true = existe rota SEM considerar o calado pedido, so nao COM ele —
       *  a tela troca o texto generico por "nao achei caminho com o calado
       *  do seu barco". false = nem sem calado ha caminho (ou calado nem foi
       *  pedido, ou o motivo nem tem a ver com calado — snap longe da agua). */
      semCaminhoPorCalado: boolean
    }
  | { id: number; tipo: "sem-mascara" }

/** Monta o `ConfigCalado` pra UMA grade de agua (fina OU nacional), se `caladoM`
 *  foi pedido e a grade de profundidade correspondente carregou. `null` cobre
 *  os dois casos honestos de "nao aplicar": sem calado pedido, ou grade de
 *  profundidade indisponivel agora (rede etc.) — quem chama decide o que
 *  fazer (ver `RespostaRota.caladoM`). */
async function construirConfigCalado(caladoM: number, tipoGradeAgua: "fina" | "nacional"): Promise<ConfigCalado | null> {
  const gradeProfundidade =
    tipoGradeAgua === "nacional" ? await carregarGradeProfundidadeNacional() : await carregarGradeProfundidade()
  if (!gradeProfundidade) return null
  return { caladoM, margemSegurancaM: MARGEM_SEGURANCA_PADRAO_M, profundidade: gradeProfundidade }
}

/** `usouCorredores` honesto (onda 17): checa o caminho BRUTO (pre-suavizacao)
 *  — `suavizar` so remove pontos intermediarios pro desenho, nao muda por
 *  onde a rota passou, mas testar no bruto e o que garante que a celula com
 *  passagem real de fato fez parte do caminho encontrado, nao so "ficou perto". */
function calcularUsouCorredores(caminhoBruto: Coord[], corredores: CorredoresPorCelula): boolean {
  return (
    corredores.porCelula.size > 0 &&
    caminhoBruto.some((c) => corredores.porCelula.has(celulaId(c.la, c.lo, RESOLUCAO_CELULA_CORREDOR_M)))
  )
}

/** Water-check pra `calcularLinhaSuave` (onda 27) — SO pro redesenho VISUAL
 *  da linha, nunca pro A-estrela/string-pulling (esses ja sao sempre
 *  validados). A fina e a autoridade quando os DOIS extremos do segmento
 *  cabem nela (mais precisa, 100 m/celula); senao cai pra nacional se os
 *  dois cabem nela; fora das duas (segmento cruzando a fronteira de
 *  cobertura, ou mar aberto sem mascara nenhuma), nao bloqueia — sem dado
 *  nao e terra, mesma filosofia honesta de `profundidadeEm` em
 *  lib/domain/rota.ts. */
function segmentoSeguroParaLinha(fina: Grade | null, nacional: Grade | null, a: Coord, b: Coord): boolean {
  if (fina && dentroDaGrade(fina, a) && dentroDaGrade(fina, b)) return segmentoEmAgua(fina, a, b)
  if (nacional && dentroDaGrade(nacional, a) && dentroDaGrade(nacional, b)) return segmentoEmAgua(nacional, a, b)
  return true
}

/** Suavizacao Chaikin (visual) de `pernas` com verificacao de agua — onda
 *  27, ver a docstring de `linhaSuave` em `RespostaRota`. Roda AQUI (no
 *  worker), nao no componente React: e aqui que `fina`/`nacional` ja estao
 *  carregadas, sem precisar buscar/decodificar a mascara de novo no thread
 *  principal so pra essa checagem. */
function calcularLinhaSuave(pernas: Coord[], fina: Grade | null, nacional: Grade | null): Coord[] {
  const suave = suavizarChaikinComAgua(
    pernas.map((p): Ponto => [p.lo, p.la]),
    ([loA, laA], [loB, laB]) => segmentoSeguroParaLinha(fina, nacional, { la: laA, lo: loA }, { la: laB, lo: loB }),
  )
  return suave.map(([lo, la]) => ({ la, lo }))
}

self.onmessage = async (e: MessageEvent<PedidoRota>) => {
  const { id, de, para, caladoM } = e.data
  // Corredores (onda 17) buscados EM PARALELO com a mascara — nao faz
  // sentido esperar a grade carregar pra so entao pedir o bbox, os dois sao
  // independentes. `buscarCorredores` nunca rejeita (falha vira mapa vazio).
  const corredoresPromessa = buscarCorredores(bboxComFolga(de, para))
  const gradeFina = await carregarGrade()

  // Caminho rapido: se a fina ja cobre os dois pontos, nem busca a nacional —
  // e o caso comum (navegando perto de casa) e evita fetch/decode a toa. Se
  // NAO cobre os dois (um dos dois fora, ou nenhum), busca a nacional — e o
  // MESMO fetch que ja cobria a nacional pura, so que agora tambem cobre o
  // caso de costura (onda 22): precisa das DUAS grades quando exatamente um
  // extremo esta na fina.
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

  const corredores: CorredoresPorCelula = await corredoresPromessa

  if (escolha.tipo === "costura") {
    // Onda 22: precisa da grade de profundidade das DUAS grades (fina e
    // nacional) se ha calado a aplicar — filosofia "tudo ou nada" (mesma de
    // sempre): se so UMA carregar, nao da pra proteger a rota inteira, entao
    // nao aplica calado nenhum (melhor um `caladoM: null` honesto do que uma
    // perna protegida e a outra nao, sem a tela conseguir explicar por que).
    let configFina: ConfigCalado | undefined
    let configNacional: ConfigCalado | undefined
    let caladoAplicado: number | null = null
    if (caladoM != null && caladoM > 0) {
      const [cf, cn] = await Promise.all([construirConfigCalado(caladoM, "fina"), construirConfigCalado(caladoM, "nacional")])
      if (cf && cn) {
        configFina = cf
        configNacional = cn
        caladoAplicado = caladoM
      }
    }

    const resultado = acharCaminhoCosturado({
      fina: escolha.fina,
      nacional: escolha.nacional,
      de,
      para,
      extremoNaFina: escolha.extremoNaFina,
      configFina,
      configNacional,
      corredores,
    })
    if (!resultado.pernas || !resultado.caminhoBruto) {
      const semCaminhoPorCalado =
        resultado.motivoFalha === "sem-caminho" &&
        (configFina != null || configNacional != null) &&
        acharCaminhoCosturado({ fina: escolha.fina, nacional: escolha.nacional, de, para, extremoNaFina: escolha.extremoNaFina, corredores })
          .pernas != null
      postMessage({ id, tipo: "sem-caminho", motivo: resultado.motivoFalha ?? "sem-caminho", semCaminhoPorCalado } satisfies RespostaRota)
      return
    }
    postMessage({
      id,
      tipo: "rota",
      pernas: resultado.pernas,
      distanciaNm: distanciaDaRota(resultado.pernas),
      precisao: "mista",
      caladoM: caladoAplicado,
      usouCorredores: calcularUsouCorredores(resultado.caminhoBruto, corredores),
      destinoAproximado: resultado.destinoAproximado,
      linhaSuave: calcularLinhaSuave(resultado.pernas, gradeFina, gradeNacional),
    } satisfies RespostaRota)
    return
  }

  // "fina" ou "nacional" pura — mesmo fluxo de sempre. So a nacional (grossa,
  // cobertura nacional) e RECORTADA — a fina ja e pequena o bastante pra
  // rodar o A* nela inteira, e recortar mudaria a precisao/distancia de
  // rotas que ja funcionavam (regressao que a onda 11 provou que NAO acontece).
  const gradeParaRota: Grade = escolha.tipo === "nacional" ? recortarGrade(escolha.grade, bboxComFolga(de, para)) : escolha.grade

  const config: ConfigCalado | undefined =
    caladoM != null && caladoM > 0 ? ((await construirConfigCalado(caladoM, escolha.tipo)) ?? undefined) : undefined
  const caladoAplicado = config ? caladoM! : null

  // Onda 22: so a grade NACIONAL usa o snap generoso pro destino — a fina
  // (100 m/celula, sem dilatacao de seguranca comparavel) segue com o snap
  // padrao de sempre (raioSnapCelulas), simetrico pra origem/destino.
  const motivoOrigemDestino =
    escolha.tipo === "nacional"
      ? acharCaminhoNacionalComDestinoGeneroso(gradeParaRota, de, para, config, corredores)
      : { ...acharCaminhoDetalhado(gradeParaRota, de, para, config, corredores), destinoAproximado: false }

  if (!motivoOrigemDestino.caminho) {
    // Se havia config de calado, confere se EXISTIRIA caminho sem essa
    // restricao — e o que decide a mensagem "nao achei com o calado do seu
    // barco" (existe rota, so nao pra esse calado) vs o generico "sem
    // caminho". So faz sentido checar isso quando o motivo e "sem-caminho"
    // (os dois snaps deram certo) — se o motivo e snap longe da agua, calado
    // nao tem nada a ver com a falha.
    const semCaminhoPorCalado =
      motivoOrigemDestino.motivoFalha === "sem-caminho" &&
      config != null &&
      acharCaminhoDetalhado(gradeParaRota, de, para).caminho != null
    postMessage({
      id,
      tipo: "sem-caminho",
      motivo: motivoOrigemDestino.motivoFalha ?? "sem-caminho",
      semCaminhoPorCalado,
    } satisfies RespostaRota)
    return
  }

  const caminho = motivoOrigemDestino.caminho
  const pernas = suavizar(gradeParaRota, caminho, config)
  postMessage({
    id,
    tipo: "rota",
    pernas,
    distanciaNm: distanciaDaRota(pernas),
    precisao: escolha.tipo,
    caladoM: caladoAplicado,
    usouCorredores: calcularUsouCorredores(caminho, corredores),
    destinoAproximado: motivoOrigemDestino.destinoAproximado,
    linhaSuave: calcularLinhaSuave(pernas, gradeFina, gradeNacional),
  } satisfies RespostaRota)
}

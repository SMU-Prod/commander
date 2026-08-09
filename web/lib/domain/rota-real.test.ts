import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import { beforeAll, describe, expect, it } from "vitest"
import {
  acharCaminho,
  bboxComFolga,
  distanciaDaRota,
  ehAgua,
  escolherGrade,
  paraCelula,
  recortarGrade,
  suavizar,
  type Coord,
  type Grade,
} from "./rota"

/**
 * O GATE da onda 5: prova, com a mascara real da costa do Rio gerada por
 * scripts/gerar-mascara-agua.mjs (web/public/mapa/mascara-agua.{png,json}),
 * que a rota de barco contorna a Ilha Grande em vez de atravessa-la, e que o
 * canal entre a ilha e o continente esta de fato aberto na mascara.
 *
 * Le o PNG e o JSON direto do disco (sem servidor, sem fetch) — caminho
 * resolvido a partir da URL deste proprio arquivo de teste, nao do cwd do
 * vitest, pra funcionar igual não importa de onde `npm test` for chamado.
 */
const CAMINHO_PNG = fileURLToPath(new URL("../../public/mapa/mascara-agua.png", import.meta.url))
const CAMINHO_JSON = fileURLToPath(new URL("../../public/mapa/mascara-agua.json", import.meta.url))
// Onda 11: grade nacional (grossa, costa brasileira inteira) — gerada por
// scripts/gerar-mascara-nacional.mjs. Mesmo formato de PNG/JSON da fina.
const CAMINHO_PNG_NACIONAL = fileURLToPath(new URL("../../public/mapa/mascara-nacional.png", import.meta.url))
const CAMINHO_JSON_NACIONAL = fileURLToPath(new URL("../../public/mapa/mascara-nacional.json", import.meta.url))

interface MascaraMetadados {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  largura: number
  altura: number
  metrosPorCelula: number
}

function carregarGradeDeArquivo(caminhoPng: string, caminhoJson: string): Grade {
  const metadados = JSON.parse(readFileSync(caminhoJson, "utf8")) as MascaraMetadados
  const png = PNG.sync.read(readFileSync(caminhoPng))

  // pngjs sempre normaliza pra RGBA (4 bytes/pixel) na leitura, mesmo o PNG em
  // disco sendo grayscale — mesma convencao que web/lib/mapa/mascara.ts usa
  // lendo o ImageData do canvas no navegador. R>127 = agua (255 no arquivo),
  // <=127 = terra (0 no arquivo): binario limpo, sem zona cinzenta real.
  const agua = new Uint8Array(png.width * png.height)
  for (let i = 0; i < png.width * png.height; i++) {
    agua[i] = png.data[i * 4] > 127 ? 1 : 0
  }

  // Grade usa largura/altura do PNG decodificado (nao do JSON) e o bbox do
  // JSON — mesma regra de montagem de web/lib/mapa/mascara.ts. paraCelula (de
  // ./rota, ja testado na Task 2) e quem faz toda a conversao coordenada<->
  // celula por interpolacao linear do bbox; este teste nao reimplementa essa
  // conta, só monta a Grade e delega pra ele.
  const g: Grade = {
    largura: png.width,
    altura: png.height,
    lngMin: metadados.lngMin,
    latMin: metadados.latMin,
    lngMax: metadados.lngMax,
    latMax: metadados.latMax,
    agua,
    metrosPorCelula: metadados.metrosPorCelula,
  }

  // sanidade: o PNG decodificado tem que bater com o que o JSON diz que ele e.
  expect(g.largura).toBe(metadados.largura)
  expect(g.altura).toBe(metadados.altura)
  return g
}

let grade: Grade
let gradeNacional: Grade

beforeAll(() => {
  grade = carregarGradeDeArquivo(CAMINHO_PNG, CAMINHO_JSON)
  gradeNacional = carregarGradeDeArquivo(CAMINHO_PNG_NACIONAL, CAMINHO_JSON_NACIONAL)
})

// Coordenadas reais da costa do Rio (mesmo sistema la/lo de Coord).
const ABRAAO: Coord = { la: -23.1375, lo: -44.1706 } // Vila do Abraao, Ilha Grande
const ANGRA: Coord = { la: -23.0067, lo: -44.3181 } // Angra dos Reis
const MARINA_DA_GLORIA: Coord = { la: -22.9186, lo: -43.1686 } // Marina da Gloria, Rio
const BUZIOS: Coord = { la: -22.7469, lo: -41.8817 } // Buzios
const PONTO_EM_TERRA = { la: -23.05, lo: -44.3 } // interior de Angra dos Reis, claramente terra

/**
 * Anda de A a B em passos de celula (Bresenham), com a MESMA regra de "nao corta
 * quina" do A* (passo diagonal so vale se as duas celulas ortogonais adjacentes
 * tambem forem agua), e confere que TODA celula do tracado esta em agua — nao so
 * os vertices da perna. Reimplementada aqui de proposito, independente da
 * `linhaDeVisaoLivre` interna de rota.ts: o achado 2 da revisao e que `suavizar`
 * nunca foi testado contra a costa real, entao o teste nao pode validar o
 * resultado usando o mesmo criterio que o produziu.
 */
function pernaInteiramenteNaAgua(g: Grade, a: Coord, b: Coord): boolean {
  let x0 = paraCelula(g, a).x
  let y0 = paraCelula(g, a).y
  const { x: x1, y: y1 } = paraCelula(g, b)
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
      // passo diagonal: as duas ortogonais adjacentes tambem tem que ser agua,
      // senao a linha desenhada na tela corta a quina de um pedaco de terra
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

/**
 * Roda `suavizar` sobre o caminho bruto de um caso real e afirma o que o achado 2
 * da revisao pedia: cada vertice da perna esta em agua, o traçado INTEIRO entre
 * pernas consecutivas fica em agua (nao so os vertices), o primeiro e o ultimo
 * ponto do caminho bruto sao preservados, e ha menos pernas que pontos no
 * caminho bruto (senao suavizar nao suavizou nada).
 */
function assertSuavizacaoNaAgua(g: Grade, caminho: Coord[]) {
  const pernas = suavizar(g, caminho)

  for (const p of pernas) {
    expect(ehAgua(g, paraCelula(g, p))).toBe(true)
  }
  for (let i = 1; i < pernas.length; i++) {
    expect(pernaInteiramenteNaAgua(g, pernas[i - 1], pernas[i])).toBe(true)
  }
  expect(pernas[0]).toEqual(caminho[0])
  expect(pernas[pernas.length - 1]).toEqual(caminho[caminho.length - 1])
  expect(pernas.length).toBeLessThan(caminho.length)
}

function medirRota(rotulo: string, de: Coord, para: Coord) {
  const inicio = performance.now()
  const caminho = acharCaminho(grade, de, para)
  const ms = performance.now() - inicio
  const distancia = caminho ? distanciaDaRota(caminho) : null
  console.log(
    `[rota-real] ${rotulo}: ${ms.toFixed(1)}ms` +
      (caminho ? `, ${caminho.length} pontos, ${distancia!.toFixed(2)} MN` : ", sem rota"),
  )
  return { caminho, ms, distancia }
}

// ---------------------------------------------------------------------------
// Onda 11 — gate: travessias longas, so possiveis com a grade nacional +
// recorte por trecho (web/lib/domain/rota.ts: escolherGrade/bboxComFolga/
// recortarGrade). Reproduz EXATAMENTE o fluxo do worker
// (web/components/mapa/rota.worker.ts): escolhe a grade, recorta se for a
// nacional, roda o A* no recorte — e mede tempo + memoria estimada da
// alocacao do A* (gScore Float32 + pai Int32 + fechado Uint8 = 9 bytes por
// celula da grade EFETIVAMENTE usada, ver docs/OPERACAO.md § Mascara de agua).
// ---------------------------------------------------------------------------

const BYTES_POR_CELULA_ASTAR = 9 // gScore(4) + pai(4) + fechado(1), ver rota.ts

// Pontos ao largo (mar aberto), nao dentro de baias fechadas — a grade
// nacional deriva de elevacao ETOPO a ~3,6 km/celula (ver
// scripts/gerar-mascara-nacional.mjs) e, com a dilatacao de seguranca de 2
// celulas, baias estreitas como Guanabara ou o canal da Ilha Grande NAO
// resolvem como agua nessa resolucao (viram terra) — rotas que ficam dentro
// delas continuam usando a grade FINA (ambos os pontos cabem nela). Os
// pontos abaixo representam os trechos de mar aberto de cada cidade, onde a
// nacional resolve corretamente.
const RJ_AO_LARGO: Coord = { la: -23.15, lo: -43.05 }
const SALVADOR_AO_LARGO: Coord = { la: -13.1, lo: -38.35 }
const FLORIPA_AO_LARGO: Coord = { la: -27.6, lo: -48.3 }

/** Reproduz o fluxo de decisao do worker: escolhe fina/nacional
 *  (`escolherGrade`), recorta a nacional ao trecho (`bboxComFolga`+
 *  `recortarGrade` — a fina NUNCA e recortada, ela ja e pequena e recortar
 *  mudaria a precisao de rotas que ja funcionavam), roda o A* e mede tempo +
 *  memoria estimada da grade efetivamente usada. */
function rotearComEscolha(rotulo: string, de: Coord, para: Coord) {
  const escolha = escolherGrade(grade, gradeNacional, de, para)
  expect(escolha).not.toBeNull()
  const { grade: gradeEscolhida, tipo } = escolha!
  const gradeParaRota = tipo === "nacional" ? recortarGrade(gradeEscolhida, bboxComFolga(de, para)) : gradeEscolhida

  const celulas = gradeParaRota.largura * gradeParaRota.altura
  const memoriaEstimadaMb = (celulas * BYTES_POR_CELULA_ASTAR) / (1024 * 1024)

  const inicio = performance.now()
  const caminho = acharCaminho(gradeParaRota, de, para)
  const ms = performance.now() - inicio
  const distancia = caminho ? distanciaDaRota(caminho) : null

  console.log(
    `[rota-nacional] ${rotulo}: grade=${tipo} ${gradeParaRota.largura}x${gradeParaRota.altura} ` +
      `(${celulas.toLocaleString("pt-BR")} celulas, ~${memoriaEstimadaMb.toFixed(2)} MB) em ${ms.toFixed(1)}ms` +
      (caminho ? `, ${caminho.length} pontos, ${distancia!.toFixed(1)} MN` : ", sem rota"),
  )

  return { tipo, gradeParaRota, caminho, ms, distancia, memoriaEstimadaMb, celulas }
}

describe("rota nacional (gate da onda 11)", () => {
  it(
    "Rio de Janeiro -> Salvador: existe rota pela grade nacional, nenhum ponto em terra, mais longa que a reta",
    { timeout: 30000 },
    () => {
      const { tipo, gradeParaRota, caminho, distancia } = rotearComEscolha("RJ -> Salvador", RJ_AO_LARGO, SALVADOR_AO_LARGO)
      expect(tipo).toBe("nacional") // prova que a travessia longa usa a grade nacional, nao a fina
      expect(caminho).not.toBeNull()
      expect(caminho!.every((p) => ehAgua(gradeParaRota, paraCelula(gradeParaRota, p)))).toBe(true)
      const reta = distanciaDaRota([RJ_AO_LARGO, SALVADOR_AO_LARGO])
      expect(distancia!).toBeGreaterThan(reta) // contornou a costa, nao foi uma reta perfeita
      // faixa sa: reta ~660 MN: rota real segue a costa (RJ->Cabo Frio->Bahia),
      // mais longa que a reta mas nao um circum-navegacao absurda
      expect(distancia!).toBeGreaterThan(500)
      expect(distancia!).toBeLessThan(1200)
    },
  )

  it(
    "Florianopolis -> Rio de Janeiro: existe rota pela grade nacional, nenhum ponto em terra, mais longa que a reta",
    { timeout: 30000 },
    () => {
      const { tipo, gradeParaRota, caminho, distancia } = rotearComEscolha("Floripa -> RJ", FLORIPA_AO_LARGO, RJ_AO_LARGO)
      expect(tipo).toBe("nacional")
      expect(caminho).not.toBeNull()
      expect(caminho!.every((p) => ehAgua(gradeParaRota, paraCelula(gradeParaRota, p)))).toBe(true)
      const reta = distanciaDaRota([FLORIPA_AO_LARGO, RJ_AO_LARGO])
      expect(distancia!).toBeGreaterThan(reta)
      expect(distancia!).toBeGreaterThan(300)
      expect(distancia!).toBeLessThan(700)
    },
  )

  it(
    "Abraao -> Angra continua na grade FINA (prova de nao-regressao: mesma precisao/distancia de hoje)",
    { timeout: 30000 },
    () => {
      const { tipo, distancia } = rotearComEscolha("Abraao -> Angra (regressao)", ABRAAO, ANGRA)
      expect(tipo).toBe("fina") // os dois pontos cabem na fina -> tem que usar ela, nao a nacional
      // MESMO teto do teste original da onda 5 (rota real, gate) — prova que
      // introduzir a grade nacional nao mudou o comportamento da fina.
      expect(distancia!).not.toBeNull()
      expect(distancia!).toBeLessThan(25)
      expect(distancia!).toBeGreaterThan(distanciaDaRota([ABRAAO, ANGRA]) * 1.05)
    },
  )
})

describe("rota na costa real (gate da onda 5)", () => {
  it(
    "Abraao -> Angra dos Reis: existe rota, fica toda na agua, e prova o canal (< 25 MN)",
    { timeout: 30000 },
    () => {
      const { caminho, distancia } = medirRota("Abraao -> Angra", ABRAAO, ANGRA)
      expect(caminho).not.toBeNull()
      expect(caminho!.every((p) => ehAgua(grade, paraCelula(grade, p)))).toBe(true)
      // se o canal entre a Ilha Grande e o continente estivesse bloqueado na
      // mascara, a rota daria a volta na ilha inteira (~60+ MN) em vez de
      // atravessar o canal (~15 MN em linha reta) — este teto e o assert que
      // prova que o canal esta aberto.
      expect(distancia!).toBeLessThan(25)
      // achado 1 da revisao: com uma mascara toda-agua (sem terra nenhuma) os
      // asserts acima passariam do mesmo jeito — este e o que prova que a rota
      // de fato desviou de terra em vez de so ter dado sorte de nao cruzar nada.
      expect(distancia!).toBeGreaterThan(distanciaDaRota([ABRAAO, ANGRA]) * 1.05)
      assertSuavizacaoNaAgua(grade, caminho!)
    },
  )

  it(
    "Marina da Gloria -> Abraao: existe rota, fica toda na agua, distancia entre 55 e 120 MN",
    { timeout: 30000 },
    () => {
      const { caminho, distancia } = medirRota("Marina -> Abraao", MARINA_DA_GLORIA, ABRAAO)
      expect(caminho).not.toBeNull()
      expect(caminho!.every((p) => ehAgua(grade, paraCelula(grade, p)))).toBe(true)
      expect(distancia!).toBeGreaterThan(55)
      expect(distancia!).toBeLessThan(120)
      // achado 1: prova que a rota desviou, nao so ficou por sorte fora de terra
      expect(distancia!).toBeGreaterThan(distanciaDaRota([MARINA_DA_GLORIA, ABRAAO]) * 1.05)
      assertSuavizacaoNaAgua(grade, caminho!)
    },
  )

  it(
    "Marina da Gloria -> Buzios: existe rota e fica toda na agua",
    { timeout: 30000 },
    () => {
      const { caminho, distancia } = medirRota("Marina -> Buzios", MARINA_DA_GLORIA, BUZIOS)
      expect(caminho).not.toBeNull()
      expect(caminho!.every((p) => ehAgua(grade, paraCelula(grade, p)))).toBe(true)
      // achado 1: prova que a rota desviou, nao so ficou por sorte fora de terra
      expect(distancia!).toBeGreaterThan(distanciaDaRota([MARINA_DA_GLORIA, BUZIOS]) * 1.05)
      assertSuavizacaoNaAgua(grade, caminho!)
    },
  )

  it(
    "destino em terra firme (interior de Angra): o snap resolve e a rota termina na agua",
    { timeout: 30000 },
    () => {
      const { caminho } = medirRota("Marina -> Angra (terra)", MARINA_DA_GLORIA, PONTO_EM_TERRA)
      expect(caminho).not.toBeNull()
      const ultimoPonto = caminho![caminho!.length - 1]
      expect(ehAgua(grade, paraCelula(grade, ultimoPonto))).toBe(true)
    },
  )
})

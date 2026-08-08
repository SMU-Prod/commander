import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import { beforeAll, describe, expect, it } from "vitest"
import { acharCaminho, distanciaDaRota, ehAgua, paraCelula, suavizar, type Coord, type Grade } from "./rota"

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

interface MascaraMetadados {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  largura: number
  altura: number
}

let grade: Grade

beforeAll(() => {
  const metadados = JSON.parse(readFileSync(CAMINHO_JSON, "utf8")) as MascaraMetadados
  const png = PNG.sync.read(readFileSync(CAMINHO_PNG))

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
  grade = {
    largura: png.width,
    altura: png.height,
    lngMin: metadados.lngMin,
    latMin: metadados.latMin,
    lngMax: metadados.lngMax,
    latMax: metadados.latMax,
    agua,
  }

  // sanidade: o PNG decodificado tem que bater com o que o JSON diz que ele e.
  expect(grade.largura).toBe(metadados.largura)
  expect(grade.altura).toBe(metadados.altura)
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

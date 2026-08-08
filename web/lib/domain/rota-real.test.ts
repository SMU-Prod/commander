import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { PNG } from "pngjs"
import { beforeAll, describe, expect, it } from "vitest"
import { acharCaminho, distanciaDaRota, ehAgua, paraCelula, type Coord, type Grade } from "./rota"

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
    },
  )

  it(
    "Marina da Gloria -> Buzios: existe rota e fica toda na agua",
    { timeout: 30000 },
    () => {
      const { caminho } = medirRota("Marina -> Buzios", MARINA_DA_GLORIA, BUZIOS)
      expect(caminho).not.toBeNull()
      expect(caminho!.every((p) => ehAgua(grade, paraCelula(grade, p)))).toBe(true)
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

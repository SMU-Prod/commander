import type { Coord, Grade } from "@/lib/domain/rota"

/** Metadados de `mascara-agua.json` (gerado por scripts/gerar-mascara-agua.mjs). */
interface MascaraMetadados {
  lngMin: number
  latMin: number
  lngMax: number
  latMax: number
  largura: number
  altura: number
  metrosPorCelula: number
  margemCelulas: number
}

const URL_JSON = "/mapa/mascara-agua.json"
const URL_PNG = "/mapa/mascara-agua.png"

/** Memoiza a promessa de carga: decodificar ~4.5M pixels e um custo que nao vale
 *  pagar duas vezes. `null` (sucesso mas sem grade) tambem fica memoizado —
 *  se a mascara nao existe no servidor, nao adianta tentar de novo a cada chamada. */
let promessaGrade: Promise<Grade | null> | null = null

/** Desenha o bitmap num canvas (OffscreenCanvas quando disponivel, <canvas> comum
 *  como fallback) e devolve o ImageData decodificado — mesma leitura de pixel em
 *  ambos os caminhos, so muda o tipo de canvas usado pra chegar la. */
function obterImageData(bitmap: ImageBitmap): ImageData {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("sem contexto 2d (OffscreenCanvas)")
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  }

  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("sem contexto 2d (canvas)")
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

/** Le o canal R de cada pixel (255 = agua, 0 = terra na mascara gerada pelo script;
 *  o limiar 127 da folga contra qualquer artefato de recompressao). */
function paraCanalAgua(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData
  const agua = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    agua[i] = data[i * 4] > 127 ? 1 : 0
  }
  return agua
}

async function decodificarGrade(metadados: MascaraMetadados, imagemBlob: Blob): Promise<Grade> {
  const bitmap = await createImageBitmap(imagemBlob)
  try {
    const imageData = obterImageData(bitmap)
    return {
      // largura/altura vem do bitmap decodificado, nao do JSON: assim o array
      // `agua` (width*height) nunca pode ficar fora de sincronia com as dimensoes
      // declaradas na Grade, mesmo se o JSON e o PNG um dia se desencontrarem.
      largura: imageData.width,
      altura: imageData.height,
      lngMin: metadados.lngMin,
      latMin: metadados.latMin,
      lngMax: metadados.lngMax,
      latMax: metadados.latMax,
      agua: paraCanalAgua(imageData),
    }
  } finally {
    bitmap.close()
  }
}

/** Busca a mascara agua/terra da costa e monta a `Grade` usada por acharCaminho.
 *  Memoizada num modulo-level: chamadas subsequentes reusam a mesma promessa.
 *  Qualquer falha (rede, decode, PNG ausente) devolve `null` — quem chama cai
 *  pro rumo direto em vez de mostrar erro pro usuario. */
export function carregarGrade(): Promise<Grade | null> {
  if (!promessaGrade) {
    promessaGrade = (async () => {
      try {
        const [respostaJson, respostaPng] = await Promise.all([fetch(URL_JSON), fetch(URL_PNG)])
        if (!respostaJson.ok || !respostaPng.ok) return null

        const metadados = (await respostaJson.json()) as MascaraMetadados
        const imagemBlob = await respostaPng.blob()
        return await decodificarGrade(metadados, imagemBlob)
      } catch {
        return null
      }
    })()
  }
  return promessaGrade
}

/** Confere se uma coordenada cai dentro do bbox coberto pela grade — barato o
 *  suficiente pra checar antes de chamar acharCaminho num ponto fora da costa
 *  mapeada (RJ/Angra/Buzios), sem precisar montar celula nenhuma. */
export function dentroDaGrade(g: Grade, p: Coord): boolean {
  return p.lo >= g.lngMin && p.lo <= g.lngMax && p.la >= g.latMin && p.la <= g.latMax
}

import type { Grade } from "@/lib/domain/rota"

/** `dentroDaGrade` mudou de casa na onda 11 (agora vive em lib/domain/rota.ts —
 *  e geometria pura sobre Grade/Coord, pertence ao dominio). Reexportada aqui
 *  pra nao quebrar quem ja importa `dentroDaGrade` de "@/lib/mapa/mascara"
 *  (rota.worker.ts). */
export { dentroDaGrade } from "@/lib/domain/rota"

/** Metadados de `mascara-agua.json`/`mascara-nacional.json` (gerados por
 *  scripts/gerar-mascara-agua.mjs e scripts/gerar-mascara-nacional.mjs — mesmo
 *  formato pras duas). */
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

const URL_JSON_FINA = "/mapa/mascara-agua.json"
const URL_PNG_FINA = "/mapa/mascara-agua.png"
const URL_JSON_NACIONAL = "/mapa/mascara-nacional.json"
const URL_PNG_NACIONAL = "/mapa/mascara-nacional.png"

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
      metrosPorCelula: metadados.metrosPorCelula,
    }
  } finally {
    bitmap.close()
  }
}

/** Fabrica um carregador memoizado pra uma mascara (fina OU nacional — mesmo
 *  formato de PNG/JSON pras duas, so muda a URL). Cada carregador tem sua
 *  PROPRIA promessa (closure), entao a fina e a nacional nunca compartilham
 *  memoizacao uma da outra. Regras de memoizacao (onda 5, preservadas aqui):
 *  chamadas subsequentes reusam a mesma promessa — mas so quando ela terminou
 *  em SUCESSO (PNG/JSON ausentes contam como sucesso: `null` e uma resposta
 *  valida, "esta mascara nao existe"). Numa falha real (rede fora do ar no
 *  boot, decode do PNG explodindo, timeout) a promessa memoizada e limpa antes
 *  de propagar `null`, pra proxima chamada tentar de novo em vez de a sessao
 *  inteira ficar sem essa mascara por causa de um erro transitorio. */
function criarCarregadorDeGrade(urlJson: string, urlPng: string): () => Promise<Grade | null> {
  let promessa: Promise<Grade | null> | null = null
  return function carregar(): Promise<Grade | null> {
    if (!promessa) {
      promessa = (async () => {
        try {
          const [respostaJson, respostaPng] = await Promise.all([fetch(urlJson), fetch(urlPng)])
          if (!respostaJson.ok || !respostaPng.ok) return null

          const metadados = (await respostaJson.json()) as MascaraMetadados
          const imagemBlob = await respostaPng.blob()
          return await decodificarGrade(metadados, imagemBlob)
        } catch {
          promessa = null // falha nao memoiza: proxima chamada tenta de novo
          return null
        }
      })()
    }
    return promessa
  }
}

/** Mascara fina (100 m/celula): Ilhabela/Sao Sebastiao -> Buzios, o circuito
 *  historico de operacao — melhor detalhe perto de casa. Nome mantido
 *  (`carregarGrade`, sem sufixo) por compatibilidade com quem ja importava. */
export const carregarGrade = criarCarregadorDeGrade(URL_JSON_FINA, URL_PNG_FINA)

/** Mascara nacional (~3,6 km/celula, onda 11): costa brasileira inteira, pra
 *  quando origem OU destino caem fora da fina. Recorte por trecho
 *  (`recortarGrade`+`bboxComFolga` em lib/domain/rota.ts) e feito pelo
 *  chamador ANTES do A* — aqui so carrega a grade inteira (~1,4 MB
 *  decodificados, cabe em memoria tranquilo; e o A* sobre ela sem recorte que
 *  não caberia). */
export const carregarGradeNacional = criarCarregadorDeGrade(URL_JSON_NACIONAL, URL_PNG_NACIONAL)

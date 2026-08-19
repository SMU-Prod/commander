import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { ARQUIVO_SESSAO } from "./global-setup"

// TEMPORÁRIO — sonda do defeito relatado "algumas letras isoladas saem com cor
// diferente do resto da palavra" (o "a" de Financeiro, o "e" de Carteira).
// Mede a cor MÉDIA DE TINTA de cada glifo no pixel renderizado. Apagar depois.
const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})
test.skip(!temSessao, "sem sessão")

// O CONTROLE: a mesma medida com densidade de tela de celular (DSF 3). Se o
// fringe for do rasterizador (ClearType/DirectWrite do Windows, que pinta
// subpixel), ele cai junto com a densidade; se fosse CSS, não cairia.
const DSF = Number(process.env.MEDIDA_DSF ?? "1")

test(`cor por letra em /meu-barco 390x844 dsf=${DSF}`, async ({ browser }) => {
  test.setTimeout(180_000)
  const contexto = await browser.newContext({
    storageState: ARQUIVO_SESSAO,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DSF,
  })
  const page = await contexto.newPage()
  await page.goto("/meu-barco", { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForLoadState("networkidle", { timeout: 40_000 }).catch(() => {})
  await page.evaluate(() => {
    const w = window as unknown as { $RV?: (b: unknown) => void; $RB?: unknown }
    if (typeof w.$RV === "function") { try { w.$RV(w.$RB) } catch { /* já promovido */ } }
  })
  await page.waitForTimeout(1200)

  const resultados: unknown[] = []
  for (const palavra of ["Financeiro", "Carteira da Tripulação"]) {
    const alvo = page.locator("main p", { hasText: new RegExp(`^${palavra}$`) }).first()
    const tiro = await alvo.screenshot()
    const dataUrl = `data:image/png;base64,${tiro.toString("base64")}`

    const medida = await page.evaluate(
      async ({ palavra, dataUrl, dsf }) => {
        const el = Array.from(document.querySelectorAll("main p"))
          .find((n) => (n.textContent ?? "").trim() === palavra)!
        const caixa = el.getBoundingClientRect()
        const no = el.firstChild as Text

        // Cada glifo vira um Range próprio, em coordenadas relativas ao recorte.
        const letras: { letra: string; x0: number; x1: number }[] = []
        for (let i = 0; i < no.length; i++) {
          const r = document.createRange()
          r.setStart(no, i)
          r.setEnd(no, i + 1)
          const rc = r.getBoundingClientRect()
          if (rc.width <= 0) continue
          // `* dsf`: a captura do elemento sai em pixels FÍSICOS, o Range mede
          // em CSS. Sem a escala, a DSF 3 leria só o primeiro terço da palavra.
          letras.push({
            letra: no.data[i],
            x0: (rc.left - caixa.left) * dsf,
            x1: (rc.right - caixa.left) * dsf,
          })
        }

        const img = new Image()
        await new Promise<void>((ok, falha) => {
          img.onload = () => ok()
          img.onerror = () => falha(new Error("imagem não carregou"))
          img.src = dataUrl
        })
        const cv = document.createElement("canvas")
        cv.width = img.width
        cv.height = img.height
        const ctx = cv.getContext("2d")!
        ctx.drawImage(img, 0, 0)
        const px = ctx.getImageData(0, 0, cv.width, cv.height).data

        // "Tinta" = pixel claramente mais claro que o fundo do painel. Só eles
        // entram na média; contar o fundo diluiria toda diferença a zero.
        const luz = (i: number) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
        let fundo = 255
        for (let i = 0; i < px.length; i += 4) fundo = Math.min(fundo, luz(i))

        let cromaticosTotal = 0
        let tintaTotal = 0
        const porLetra = letras.map(({ letra, x0, x1 }) => {
          let n = 0, r = 0, g = 0, b = 0, cromaticos = 0, maxDelta = 0
          for (let y = 0; y < cv.height; y++) {
            for (let x = Math.max(0, Math.floor(x0)); x < Math.min(cv.width, Math.ceil(x1)); x++) {
              const i = (y * cv.width + x) * 4
              if (luz(i) < fundo + 60) continue // fundo e antialias fraco fora
              n++
              r += px[i]; g += px[i + 1]; b += px[i + 2]
              const d = Math.max(Math.abs(px[i] - px[i + 1]), Math.abs(px[i + 1] - px[i + 2]), Math.abs(px[i] - px[i + 2]))
              if (d > 6) cromaticos++
              maxDelta = Math.max(maxDelta, d)
            }
          }
          tintaTotal += n
          cromaticosTotal += cromaticos
          return n === 0
            ? { letra, pixels: 0 }
            : {
                letra,
                pixels: n,
                media: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
                pixelsCromaticos: cromaticos,
                maiorDeltaCanal: maxDelta,
              }
        })

        return {
          palavra,
          recorte: [cv.width, cv.height],
          luzDoFundo: Math.round(fundo),
          pixelsDeTinta: tintaTotal,
          pixelsCromaticos: cromaticosTotal,
          porLetra,
        }
      },
      { palavra, dataUrl, dsf: DSF },
    )
    resultados.push(medida)
    const m = medida as { pixelsDeTinta: number; pixelsCromaticos: number; porLetra: { letra: string; media?: number[] }[] }
    console.log(`\n=== ${palavra} (dsf ${DSF}) ===`)
    console.log(`tinta ${m.pixelsDeTinta}px · cromáticos ${m.pixelsCromaticos}px (${Math.round(100 * m.pixelsCromaticos / m.pixelsDeTinta)}%)`)
    for (const l of m.porLetra) console.log(`  "${l.letra}" ${l.media ? l.media.join(",") : "—"}`)
  }

  const saida = path.resolve(__dirname, "../.medida-menu")
  fs.mkdirSync(saida, { recursive: true })
  fs.writeFileSync(path.join(saida, `letras-coloridas-dsf${DSF}.json`), JSON.stringify(resultados, null, 2), "utf-8")
  await contexto.close()
  expect(resultados.length).toBe(2)
})

import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { ARQUIVO_SESSAO } from "./global-setup"

// TEMPORÁRIO — sonda do grau `denso` do EstadoVazio (onda 103). Mede, cartão a
// cartão, a altura da SEÇÃO e a altura do BLOCO VAZIO dentro dela, a 390px.
// Apagar depois de reportar. Marca a rodada com MEDIDA_MARCA=antes|depois.
const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})
test.skip(!temSessao, "sem sessão")

test("medida dos vazios em /hoje 390x844", async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/hoje", { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForLoadState("networkidle", { timeout: 40_000 }).catch(() => {})
  // React 19 promove a fronteira de Suspense por requestAnimationFrame, que não
  // dispara em documento oculto — sem isto a sonda mede o esqueleto.
  await page.evaluate(() => {
    const w = window as unknown as { $RV?: (b: unknown) => void; $RB?: unknown }
    if (typeof w.$RV === "function") { try { w.$RV(w.$RB) } catch { /* já promovido */ } }
  })
  await page.waitForTimeout(1200)

  const m = await page.evaluate(() => {
    const main = document.querySelector("main")!
    const alt = (el: Element) => Math.round(el.getBoundingClientRect().height)

    // O bloco vazio é o descendente do <section> que carrega um <svg> de ícone,
    // um <p> de título e (quando há) o link da ação — e nada mais. Achado pelo
    // <p> de título, subindo até o filho direto da seção: essa cadeia não
    // depende de nenhuma classe, então mede igual antes e depois da mudança.
    const secoes = Array.from(main.querySelectorAll("section")).map((s) => {
      const titulo = s.querySelector("h2")?.textContent?.trim() ?? "(sem título)"
      let vazio: HTMLElement | null = null
      for (const p of Array.from(s.querySelectorAll<HTMLElement>("p"))) {
        let no: HTMLElement | null = p
        while (no && no.parentElement !== s) no = no.parentElement
        if (!no) continue
        if (no.querySelector("svg") && no.querySelectorAll("p").length >= 1 && no.tagName === "DIV") {
          vazio = no
          break
        }
      }
      return {
        titulo,
        secao: alt(s),
        vazio: vazio ? alt(vazio) : null,
        vazioTexto: vazio ? (vazio.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60) : null,
        alvosPequenos: vazio
          ? Array.from(vazio.querySelectorAll<HTMLElement>("a[href],button"))
              .map((a) => ({ t: (a.textContent ?? "").trim().slice(0, 24), h: alt(a) }))
              .filter((x) => x.h > 0 && x.h < 44)
          : [],
      }
    })

    return {
      alturaPagina: document.documentElement.scrollHeight,
      telas: +(document.documentElement.scrollHeight / 844).toFixed(2),
      secoes,
    }
  })

  const marca = process.env.MEDIDA_MARCA ?? "x"
  const saida = path.resolve(__dirname, "../.refino")
  fs.mkdirSync(saida, { recursive: true })
  fs.writeFileSync(path.join(saida, `vazio-${marca}.json`), JSON.stringify(m, null, 2), "utf-8")
  await page.screenshot({ path: path.join(saida, `vazio-${marca}.png`), fullPage: true })

  console.log(`\n=== /hoje vazios (${marca}) === altura ${m.alturaPagina}px (${m.telas} telas)`)
  for (const s of m.secoes) {
    const v = s.vazio == null ? "   —" : `${String(s.vazio).padStart(4)}px`
    console.log(`  secao ${String(s.secao).padStart(4)}px · vazio ${v}  ${s.titulo}`)
    if (s.alvosPequenos.length) console.log(`        alvos <44px: ${s.alvosPequenos.map((a) => `${a.t}=${a.h}`).join(" | ")}`)
  }
  expect(m.alturaPagina).toBeGreaterThan(0)
})

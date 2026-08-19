import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { ARQUIVO_SESSAO } from "./global-setup"

// TEMPORÁRIO — sonda de medição da onda /barco. Apagar depois de reportar.
const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})
test.skip(!temSessao, "sem sessão")

test("medida /barco 390x844", async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/barco", { waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForLoadState("networkidle", { timeout: 40_000 }).catch(() => {})
  // React 19 promove a fronteira de Suspense com requestAnimationFrame, que não
  // dispara em documento oculto — sem isto a foto sai do esqueleto.
  await page.evaluate(() => {
    const w = window as unknown as { $RV?: (b: unknown) => void; $RB?: unknown }
    if (typeof w.$RV === "function") { try { w.$RV(w.$RB) } catch { /* já promovido */ } }
  })
  await page.waitForTimeout(1200)

  const m = await page.evaluate(() => {
    const alturaPagina = document.documentElement.scrollHeight
    const main = document.querySelector("main")
    const alturaMain = main ? main.getBoundingClientRect().height : 0

    // "Cartão" = caixa com borda visível E raio >= 12px E fundo próprio.
    const caixas = Array.from(document.querySelectorAll("main *")).filter((el) => {
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width < 80 || r.height < 24) return false
      const raio = parseFloat(s.borderTopLeftRadius) || 0
      const borda = parseFloat(s.borderTopWidth) || 0
      const temSombra = s.boxShadow !== "none"
      return raio >= 12 && (borda >= 1 || temSombra)
    })
    const cartoes = caixas
      .filter((el) => !caixas.some((o) => o !== el && o.contains(el)))
      .map((el) => ({
        texto: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 42),
        alt: Math.round(el.getBoundingClientRect().height),
      }))

    const nav = document.querySelector('nav[aria-label="Seções desta tela"]')
    const abas = nav
      ? {
          scrollWidth: nav.scrollWidth,
          clientWidth: nav.clientWidth,
          itens: Array.from(nav.querySelectorAll("a")).map((a) => (a.textContent ?? "").trim()),
        }
      : null

    const titulos = Array.from(document.querySelectorAll("main h1, main h2, main h3")).map(
      (h) => `${h.tagName}:${(h.textContent ?? "").trim().slice(0, 34)}`,
    )

    return {
      alturaPagina,
      alturaMain,
      telas: +(alturaPagina / 844).toFixed(2),
      qtdCartoes: cartoes.length,
      cartoes,
      abas,
      titulos,
      svgs: document.querySelectorAll("main svg").length,
      links: document.querySelectorAll("main a[href]").length,
    }
  })

  const saida = path.resolve(__dirname, "../.medida-barco")
  fs.mkdirSync(saida, { recursive: true })
  const marca = process.env.MEDIDA_MARCA ?? "x"
  fs.writeFileSync(path.join(saida, `barco-${marca}.json`), JSON.stringify(m, null, 2), "utf-8")
  await page.screenshot({ path: path.join(saida, `barco-${marca}.png`), fullPage: true })
  console.log(`\n=== /barco (${marca}) ===`)
  console.log(`altura ${m.alturaPagina}px (${m.telas} telas) · ${m.qtdCartoes} cartões · ${m.svgs} svg · ${m.links} links`)
  console.log(`abas: ${m.abas ? `${m.abas.scrollWidth}/${m.abas.clientWidth} — ${m.abas.itens.join(" | ")}` : "nenhuma"}`)
  console.log(`títulos: ${m.titulos.join(" · ")}`)
  for (const c of m.cartoes) console.log(`  ${String(c.alt).padStart(4)}px  ${c.texto}`)
  expect(m.alturaPagina).toBeGreaterThan(0)
})

import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { ARQUIVO_SESSAO } from "./global-setup"

// TEMPORÁRIO — sonda de medição do Menu (onda 103). Apagar depois de reportar.
const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})
test.skip(!temSessao, "sem sessão")

const ROTAS = (process.env.MEDIDA_ROTAS ?? "/menu").split(",")

for (const rota of ROTAS) {
  test(`medida ${rota} 390x844`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 60_000 })
    await page.waitForLoadState("networkidle", { timeout: 40_000 }).catch(() => {})
    // React 19 promove a fronteira de Suspense com requestAnimationFrame, que
    // não dispara em documento oculto — sem isto a foto sai do esqueleto.
    await page.evaluate(() => {
      const w = window as unknown as { $RV?: (b: unknown) => void; $RB?: unknown }
      if (typeof w.$RV === "function") { try { w.$RV(w.$RB) } catch { /* já promovido */ } }
    })
    await page.waitForTimeout(1200)

    const m = await page.evaluate(() => {
      const alturaPagina = document.documentElement.scrollHeight
      const main = document.querySelector("main")
      const alturaMain = main ? main.getBoundingClientRect().height : 0

      const links = Array.from(document.querySelectorAll("main a[href]")).map((a) => ({
        href: a.getAttribute("href") ?? "",
        texto: (a.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60),
        alt: Math.round(a.getBoundingClientRect().height),
      }))

      // ---------------------------------------------------------------------
      // O DEFEITO DAS "LETRAS COLORIDAS" — medido, não olhado.
      // Três suspeitos possíveis: `::first-letter` com cor própria,
      // `background-clip: text` (+ gradiente) e `-webkit-text-fill-color`.
      // ---------------------------------------------------------------------
      const suspeitos: unknown[] = []
      for (const el of Array.from(document.querySelectorAll("main *"))) {
        const s = getComputedStyle(el)
        const p = getComputedStyle(el, "::first-letter")
        const pl = getComputedStyle(el, "::first-line")
        const texto = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)
        const anomalia: string[] = []
        if (p.color !== s.color) anomalia.push(`first-letter color ${p.color} != ${s.color}`)
        if (pl.color !== s.color) anomalia.push(`first-line color ${pl.color} != ${s.color}`)
        if (s.backgroundImage !== "none" && s.backgroundImage.includes("gradient")) {
          anomalia.push(`background-image ${s.backgroundImage.slice(0, 60)}`)
        }
        const clip = (s as unknown as Record<string, string>).webkitBackgroundClip ?? s.backgroundClip
        if (clip === "text") anomalia.push("background-clip: text")
        const fill = (s as unknown as Record<string, string>).webkitTextFillColor
        if (fill && fill !== s.color) anomalia.push(`text-fill-color ${fill} != ${s.color}`)
        if (s.mixBlendMode !== "normal") anomalia.push(`mix-blend-mode ${s.mixBlendMode}`)
        if (anomalia.length > 0) suspeitos.push({ tag: el.tagName, texto, anomalia })
      }

      // As duas palavras que o dono apontou, letra por letra: cada glifo vira
      // um Range próprio e o `color` do container é o mesmo para todos — o que
      // varia (se variar) tem que aparecer aqui.
      const alvos = ["Financeiro", "Carteira da Tripulação", "Meu barco", "Serviços"]
      const porPalavra = alvos.map((palavra) => {
        const el = Array.from(document.querySelectorAll("main p, main h1, main h2, main span"))
          .find((n) => (n.textContent ?? "").trim() === palavra)
        if (!el) return { palavra, achou: false }
        const s = getComputedStyle(el)
        return {
          palavra,
          achou: true,
          color: s.color,
          fontFamily: s.fontFamily.slice(0, 40),
          fontWeight: s.fontWeight,
          fontSize: s.fontSize,
          webkitFontSmoothing: (s as unknown as Record<string, string>).webkitFontSmoothing,
          textRendering: s.textRendering,
          filhosElemento: el.children.length,
          html: el.innerHTML.slice(0, 120),
        }
      })

      return {
        alturaPagina,
        alturaMain,
        telas: +(alturaPagina / 844).toFixed(2),
        qtdLinks: links.length,
        links,
        suspeitos,
        porPalavra,
      }
    })

    const saida = path.resolve(__dirname, "../.medida-menu")
    fs.mkdirSync(saida, { recursive: true })
    const marca = process.env.MEDIDA_MARCA ?? "x"
    const slug = rota.replace(/\//g, "_") || "_raiz"
    fs.writeFileSync(path.join(saida, `${slug}-${marca}.json`), JSON.stringify(m, null, 2), "utf-8")
    await page.screenshot({ path: path.join(saida, `${slug}-${marca}.png`), fullPage: true })
    console.log(`\n=== ${rota} (${marca}) ===`)
    console.log(`altura ${m.alturaPagina}px (${m.telas} telas) · main ${Math.round(m.alturaMain)}px · ${m.qtdLinks} links`)
    for (const l of m.links) console.log(`  ${String(l.alt).padStart(4)}px  ${l.href}  —  ${l.texto}`)
    console.log(`suspeitos de cor: ${m.suspeitos.length}`)
    for (const s of m.suspeitos) console.log(`  ${JSON.stringify(s)}`)
    for (const p of m.porPalavra) console.log(`  palavra: ${JSON.stringify(p)}`)
    expect(m.alturaPagina).toBeGreaterThan(0)
  })
}

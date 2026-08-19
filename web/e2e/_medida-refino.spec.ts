import { test, expect } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { ARQUIVO_SESSAO } from "./global-setup"

// TEMPORÁRIO — sonda do passe de refino de 19/08 (/hoje e /barco a 390px).
// Mede o que a revisão humana cobra e os testes não medem: degraus de fonte em
// uso, altura de rolagem, quantos objetos são pintados de dourado, quantas
// superfícies diferentes a tela tem e a altura de cada cartão. Apagar depois de
// reportar. Marca a rodada com MEDIDA_MARCA=antes|depois.
const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})
test.skip(!temSessao, "sem sessão")

const TELAS = [
  { rota: "/hoje", nome: "hoje" },
  { rota: "/barco", nome: "barco" },
]

for (const { rota, nome } of TELAS) {
  test(`medida ${rota} 390x844`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 60_000 })
    await page.waitForLoadState("networkidle", { timeout: 40_000 }).catch(() => {})
    // React 19 promove a fronteira de Suspense por requestAnimationFrame, que
    // não dispara em documento oculto — sem isto a sonda mede o esqueleto.
    await page.evaluate(() => {
      const w = window as unknown as { $RV?: (b: unknown) => void; $RB?: unknown }
      if (typeof w.$RV === "function") { try { w.$RV(w.$RB) } catch { /* já promovido */ } }
    })
    await page.waitForTimeout(1200)

    const m = await page.evaluate(() => {
      const main = document.querySelector("main")!
      const folhas = Array.from(main.querySelectorAll<HTMLElement>("*")).filter((el) => {
        const filhos = Array.from(el.childNodes)
        return filhos.some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0)
      })

      const porTamanho = new Map<number, number>()
      for (const el of folhas) {
        const px = Math.round(parseFloat(getComputedStyle(el).fontSize))
        porTamanho.set(px, (porTamanho.get(px) ?? 0) + 1)
      }

      // Dourado PINTADO — cor de texto, de fundo ou de borda que caia na faixa
      // do ouro (matiz 35–55°, saturação > 25%). Conta objeto, não declaração.
      const ehOuro = (cor: string) => {
        const m2 = cor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/)
        if (!m2) return false
        const [r, g, b] = [+m2[1], +m2[2], +m2[3]]
        const a = m2[4] == null ? 1 : +m2[4]
        if (a < 0.25) return false
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if (max === 0 || (max - min) / max < 0.25) return false
        if (max !== r) return false
        const h = (60 * ((g - b) / (max - min)) + 360) % 360
        return h >= 30 && h <= 60
      }
      const dourados: string[] = []
      for (const el of Array.from(main.querySelectorAll<HTMLElement>("*"))) {
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        const alvos = [s.color, s.backgroundColor, s.borderTopColor, s.fill]
        if (alvos.some(ehOuro)) {
          dourados.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 22)}"`)
        }
      }

      const superficies = new Map<string, number>()
      const caixas = Array.from(main.querySelectorAll<HTMLElement>("*")).filter((el) => {
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        if (r.width < 80 || r.height < 24) return false
        const raio = parseFloat(s.borderTopLeftRadius) || 0
        const borda = parseFloat(s.borderTopWidth) || 0
        return raio >= 12 && (borda >= 1 || s.boxShadow !== "none")
      })
      for (const el of caixas) {
        const bg = getComputedStyle(el).backgroundColor
        superficies.set(bg, (superficies.get(bg) ?? 0) + 1)
      }
      const cartoes = caixas
        .filter((el) => !caixas.some((o) => o !== el && o.contains(el)))
        .map((el) => ({
          texto: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
          alt: Math.round(el.getBoundingClientRect().height),
        }))

      const alvosPequenos = Array.from(main.querySelectorAll<HTMLElement>("a[href],button"))
        .map((el) => ({ t: (el.textContent ?? "").trim().slice(0, 24), h: Math.round(el.getBoundingClientRect().height) }))
        .filter((x) => x.h > 0 && x.h < 44)

      // O herói: a caixa que carrega o <h1> com o nome do barco.
      const h1 = main.querySelector("h1")
      const heroi = h1?.closest("div.raio-painel, div.rounded-\\[var\\(--raio-cartao\\)\\], main > div")
      const alturaHeroi = heroi ? Math.round(heroi.getBoundingClientRect().height) : null
      const nomeDoBarco = h1
        ? (() => { const s = getComputedStyle(h1); return `${Math.round(parseFloat(s.fontSize))}px/${s.fontWeight} ls=${s.letterSpacing}` })()
        : null

      // Quantos tons diferentes os cartuchos de hub pintam (0 = grade cinza).
      const cartuchos = [...new Set(
        Array.from(main.querySelectorAll<HTMLElement>("h2")).map((h) => {
          const c = h.previousElementSibling as HTMLElement | null
          return c ? getComputedStyle(c).backgroundColor : ""
        }).filter((c) => c && c !== "rgba(0, 0, 0, 0)"),
      )]

      return {
        alturaHeroi,
        nomeDoBarco,
        tonsDeCartucho: cartuchos.length,
        cartuchos,
        alturaPagina: document.documentElement.scrollHeight,
        telas: +(document.documentElement.scrollHeight / 844).toFixed(2),
        degraus: [...porTamanho.entries()].sort((a, b) => a[0] - b[0]).map(([px, n]) => `${px}px×${n}`),
        elementosDeTexto: folhas.length,
        dourados,
        qtdDourados: dourados.length,
        superficiesDeCartao: [...superficies.entries()].map(([c, n]) => `${c}×${n}`),
        qtdCartoes: cartoes.length,
        cartoes,
        alvosAbaixoDe44: alvosPequenos,
        svgs: main.querySelectorAll("svg").length,
      }
    })

    const marca = process.env.MEDIDA_MARCA ?? "x"
    const saida = path.resolve(__dirname, "../.refino")
    fs.mkdirSync(saida, { recursive: true })
    fs.writeFileSync(path.join(saida, `${nome}-${marca}.json`), JSON.stringify(m, null, 2), "utf-8")
    await page.screenshot({ path: path.join(saida, `${nome}-${marca}.png`), fullPage: true })
    // O tema CLARO existe pro sol na marina e é onde os tons novos de hub
    // podem falhar sem ninguém ver (eles têm escada própria lá).
    await page.evaluate(() => { document.documentElement.dataset.theme = "light" })
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(saida, `${nome}-${marca}-claro.png`), fullPage: true })
    await page.evaluate(() => { document.documentElement.dataset.theme = "dark" })
    console.log(`\n=== ${rota} (${marca}) ===`)
    console.log(`altura ${m.alturaPagina}px (${m.telas} telas) · ${m.qtdCartoes} cartões · ${m.qtdDourados} dourados · ${m.svgs} svg`)
    console.log(`herói ${m.alturaHeroi}px · nome ${m.nomeDoBarco} · tons de cartucho ${m.tonsDeCartucho}`)
    console.log(`degraus: ${m.degraus.join(" ")}`)
    console.log(`superfícies: ${m.superficiesDeCartao.join(" ")}`)
    console.log(`dourados: ${m.dourados.join(" | ")}`)
    console.log(`alvos <44px: ${m.alvosAbaixoDe44.map((a) => `${a.t}=${a.h}`).join(" | ") || "nenhum"}`)
    for (const c of m.cartoes) console.log(`  ${String(c.alt).padStart(4)}px  ${c.texto}`)
    expect(m.alturaPagina).toBeGreaterThan(0)
  })
}

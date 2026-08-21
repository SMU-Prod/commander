import { existsSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { ARQUIVO_SESSAO } from "./global-setup"

/**
 * ONDA 146 — A PROVA DA FICHA DO EQUIPAMENTO E DA GAVETA.
 * ===========================================================================
 * A prova visual principal fotografa rotas ESTÁTICAS; a ficha vive em
 * /barco/equipamento/[id] e a gaveta de "Registrar manutenção" só existe
 * depois de um clique — as duas coisas que a imagem 12 do guia desenha e que
 * nenhuma captura cobria. Este spec navega como gente: entra no hub Motores,
 * toca no primeiro motor, fotografa a ficha, abre a gaveta e fotografa de
 * novo. É o que impede a gaveta de regredir sem ninguém ver.
 */
const PASTA = process.env.PROVA_DIR ?? ".prova"
const ESTADO = ARQUIVO_SESSAO

test.describe("prova visual da ficha", () => {
  test.skip(!existsSync(ESTADO), "sem sessão de teste — ver global-setup")
  test.use({ storageState: ESTADO, viewport: { width: 390, height: 844 } })

  test("ficha do motor e gaveta de manutenção", async ({ page }) => {
    // A primeira visita compila a rota no dev server do webServer — folga.
    test.setTimeout(120_000)
    await page.goto("/barco/motores", { waitUntil: "networkidle" })
    // O primeiro cartão de motor da Visão geral leva à ficha. `:not(novo)`
    // porque o "+ Motor" do cabeçalho também começa com esse href — e vem
    // antes no DOM (foi o primeiro tombo desta prova).
    await page.locator('a[href^="/barco/equipamento/"]:not([href*="novo"])').first().click()
    // O h1 do HUB continua visível durante a navegação de cliente — esperar
    // por ele fotografava a tela errada. A URL é o sinal inequívoco.
    await page.waitForURL(/\/barco\/equipamento\/(?!novo)/, { timeout: 60_000 })
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await page.screenshot({ path: path.join(PASTA, "17-ficha-motor.png"), fullPage: true })

    // A gaveta abre por URL (?registrar=1) — o toque no CTA é o caminho real.
    await page.getByRole("link", { name: /registrar manutenção/i }).first().click()
    // O painel da gaveta é um dialog; a prova espera o título dele.
    await expect(page.getByText("Registrar manutenção").nth(1)).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(600) // fim da animação de entrada
    await page.screenshot({ path: path.join(PASTA, "18-ficha-gaveta.png") })
  })
})

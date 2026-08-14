import { expect, test } from "@playwright/test"

test.describe("/parceiros (público)", () => {
  test("carrega sem sessão", async ({ page }) => {
    await page.goto("/parceiros")

    await expect(page.getByRole("heading", { name: /Seu ponto no mapa/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /Já é parceiro\? Entrar/i })).toBeVisible()
  })
})

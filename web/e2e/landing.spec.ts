import { expect, test } from "@playwright/test"

test.describe("landing pública", () => {
  test("carrega e mostra os links principais", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { name: "O dossiê do seu barco." })).toBeVisible()
    await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: /para marinas, pousadas e restaurantes/i })).toBeVisible()

    // Termos/privacidade podem não existir ainda (produto recente) — o
    // teste não pode quebrar por isso. Só confirma que, SE existirem,
    // apontam pra algum lugar de verdade.
    const termos = page.getByRole("link", { name: /termos de uso/i })
    if ((await termos.count()) > 0) {
      await expect(termos.first()).toHaveAttribute("href", /.+/)
    }
    const privacidade = page.getByRole("link", { name: /privacidade/i })
    if ((await privacidade.count()) > 0) {
      await expect(privacidade.first()).toHaveAttribute("href", /.+/)
    }
  })
})

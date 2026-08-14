import { expect, test } from "@playwright/test"

test.describe("/login", () => {
  test("renderiza o formulário de entrar", async ({ page }) => {
    await page.goto("/login")

    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible()
    await expect(page.getByLabel("E-mail")).toBeVisible()
    await expect(page.getByLabel("Senha")).toBeVisible()
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible()
  })

  test("valida campo vazio antes de submeter", async ({ page }) => {
    await page.goto("/login")

    await page.getByRole("button", { name: "Entrar" }).click()

    // Validação HTML5 (`required` no input) bloqueia o submit no navegador
    // — a página nunca navega pra fora de /login, e o campo fica inválido.
    await expect(page).toHaveURL(/\/login$/)
    const emailValido = await page.getByLabel("E-mail").evaluate((el: HTMLInputElement) => el.checkValidity())
    expect(emailValido).toBe(false)
  })
})

import { expect, test } from "@playwright/test"

test.describe("rota protegida sem sessão", () => {
  test("redireciona pro login preservando o destino", async ({ page }) => {
    await page.goto("/hoje")

    // middleware.ts: sem `user`, redireciona pra /login?volta=<pathname>.
    await expect(page).toHaveURL(/\/login\?volta=%2Fhoje/)
    await expect(page.getByRole("heading", { name: "Entre na sua conta" })).toBeVisible()
  })
})

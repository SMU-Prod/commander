import { test, expect } from "@playwright/test"
import fs from "node:fs"
import { ARQUIVO_SESSAO } from "./global-setup"

/**
 * ONDA 54 — REGRESSÃO DOS TRÊS BECOS QUE A VARREDURA ACHOU.
 *
 * Vive num arquivo separado de `varredura-mobile.spec.ts` de propósito: a
 * varredura MEDE (grava relatório, não falha), este aqui COBRA. Um mede o
 * app inteiro raso, o outro afunda em três pontos e quebra a suíte se
 * voltarem.
 *
 * Os três, todos na largura em que o app é usado (390×844):
 *
 * 1. URL morta era o 404 do Next, em inglês e sem UM link. No navegador de
 *    mesa a pessoa aperta "voltar"; no app instalado não existe esse botão
 *    — a tela era literalmente sem saída.
 * 2. O "+ Registrar" flutuava por cima de campo de formulário
 *    (`/barco/itens/novo`: em cima de "Horas no último serviço").
 * 3. O botão de salvar do formulário ficava embaixo da barra de baixo. A
 *    folga do conteúdo era um `pb-36` fixo, que só fecha a conta com
 *    safe-area zero — não é o caso de nenhum celular com barra de gestos.
 *
 * O item 3 é medido ROLANDO ATÉ O FIM primeiro. É a diferença entre "está
 * coberto agora" (normal com barra fixa, some ao rolar) e "está coberto
 * mesmo depois de rolar tudo", que é o bug de verdade.
 */

const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO, viewport: { width: 390, height: 844 } } : { viewport: { width: 390, height: 844 } })

test("URL que não existe mostra 404 em português e com saída", async ({ page }) => {
  await page.goto("/financeiro/nova", { waitUntil: "domcontentloaded" })

  await expect(page.getByRole("heading", { name: /esta página não existe/i })).toBeVisible()
  await expect(page.getByRole("button", { name: "Voltar" })).toBeVisible()
  await expect(page.getByRole("link", { name: /início/i })).toHaveAttribute("href", "/hoje")

  // O 404 padrão do Next é este texto; se ele voltar, o `not-found.tsx`
  // deixou de ser encontrado (mudança de rota/route group, por exemplo).
  await expect(page.locator("body")).not.toContainText("This page could not be found")
})

test.describe("formulário no celular", () => {
  test.skip(!temSessao, "sem SUPABASE_SERVICE_ROLE_KEY — precisa de sessão real")

  test("o FAB '+ Registrar' não aparece em tela de criação", async ({ page }) => {
    // Onde ele DEVE aparecer (hub de leitura) — âncora do teste: sem isto,
    // o teste passaria também se o botão sumisse do app inteiro.
    await page.goto("/barco", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    await expect(page.getByRole("button", { name: "+ Registrar" })).toBeVisible()

    for (const rota of ["/barco/itens/novo", "/barco/equipamento/novo", "/barco/editar", "/barco/local"]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})
      await expect(page.getByRole("button", { name: "+ Registrar" }), rota).toHaveCount(0)
    }
  })

  test("a folga inferior existe de verdade e acompanha o FAB", async ({ page }) => {
    // Guarda de compilação: `FOLGA_COM_FAB`/`FOLGA_SEM_FAB` são classes
    // arbitrárias do Tailwind com `calc()` e `env()`. Se a sintaxe quebrar
    // (underscore virando espaço, parêntese, o que for), a classe some
    // silenciosamente e o padding vira 0 — exatamente o bug que esta onda
    // conserta, de volta e sem aviso. Medir o valor computado é o único
    // jeito de saber que a classe existe.
    const folga = async (rota: string) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})
      return page.evaluate(() => {
        const nav = document.querySelector("nav.fixed")
        const moldura = nav?.parentElement // a moldura de `(app)` envolve a bottom-nav
        return moldura ? parseFloat(getComputedStyle(moldura).paddingBottom) : -1
      })
    }

    // hub com FAB: precisa caber o botão flutuante inteiro (128px + safe-area)
    const comFab = await folga("/barco")
    expect(comFab).toBeGreaterThanOrEqual(144)

    // formulário: sem FAB, só a barra de baixo — folga menor, mas nunca zero
    const semFab = await folga("/barco/itens/novo")
    expect(semFab).toBeGreaterThanOrEqual(76)
    expect(semFab).toBeLessThan(comFab)
  })

  test("o botão de salvar fica livre da barra de baixo com a página no fim", async ({ page }) => {
    for (const [rota, botao] of [
      ["/barco/itens/novo", "Criar manutenção"],
      ["/barco/equipamento/novo", "Criar equipamento"],
    ] as const) {
      await page.goto(rota, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(300)

      const salvar = page.getByRole("button", { name: botao })
      const nav = page.locator("nav.fixed").first()
      const rSalvar = await salvar.boundingBox()
      const rNav = await nav.boundingBox()
      expect(rSalvar, `${rota}: botão "${botao}" não encontrado`).not.toBeNull()
      expect(rNav, `${rota}: barra de baixo não encontrada`).not.toBeNull()

      // Rolado até o fim, a base do botão tem de estar ACIMA do topo da
      // barra. É a conta que o `pb-36` fixo não fechava no aparelho real.
      expect(
        rSalvar!.y + rSalvar!.height,
        `${rota}: "${botao}" continua embaixo da barra de baixo mesmo com a página rolada até o fim`,
      ).toBeLessThanOrEqual(rNav!.y)
    }
  })
})

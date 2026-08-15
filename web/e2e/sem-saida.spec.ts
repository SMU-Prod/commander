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
        // `data-moldura` é o gancho estável da `<div>` de conteúdo (ver
        // `components/moldura-app.tsx`) — achar por ele não depende de
        // quantos `nav.fixed` existem na página nem da ordem deles.
        const moldura = document.querySelector("[data-moldura]")
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
      // `:visible` porque a página agora tem dois `nav.fixed` (a bottom-nav
      // e o trilho de desktop, escondido em mobile via `hidden lg:flex`) —
      // sem o filtro, `.first()` dependeria da ordem deles no DOM em vez de
      // pegar a barra de baixo, que é a única visível nesta largura.
      const nav = page.locator("nav.fixed:visible").first()
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

/**
 * ONDA 57 (revisão) — A CASCA DO DESKTOP, MEDIDA.
 *
 * Dois valores que a leitura de código não consegue provar e que, se
 * quebrarem, quebram TODO o desktop de uma vez — sem a varredura reclamar,
 * porque nenhum dos dois é sobreposição, estouro ou alvo pequeno:
 *
 * 1. `OFFSET_TRILHO` (`lg:pl-[88px]`) tem que vencer o `px-4` da mesma
 *    `<div>`. Se perder, o padding-left cai pra 16px e o conteúdo passa POR
 *    BAIXO do trilho de 72px em toda tela a partir de 1024px.
 * 2. A ação flutuante ("+ Registrar", "Exportar PDF") mora a 5rem do rodapé
 *    no celular porque a barra de baixo ocupa esse espaço. No desktop a barra
 *    é `lg:hidden`, e o botão ficava pairando sobre 80px de nada.
 *
 * 1440×900 e não 1024: 1024 é a fronteira do breakpoint e um teste em cima
 * dela mede o caso limite, não o caso comum. O `data-moldura` é o mesmo
 * gancho estável usado acima.
 */
test.describe("casca no desktop", () => {
  test.skip(!temSessao, "sem SUPABASE_SERVICE_ROLE_KEY — precisa de sessão real")
  test.use({ viewport: { width: 1440, height: 900 } })

  test("o conteúdo não passa por baixo do trilho: o pl do trilho vence o px-4", async ({ page }) => {
    await page.goto("/barco", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})

    const caixa = await page.evaluate(() => {
      const moldura = document.querySelector("[data-moldura]")
      if (!moldura) return null
      const cs = getComputedStyle(moldura)
      return {
        esquerda: parseFloat(cs.paddingLeft),
        direita: parseFloat(cs.paddingRight),
      }
    })
    expect(caixa, "[data-moldura] não encontrada").not.toBeNull()
    // 88 = 72 do trilho + 16 de gutter (ver `OFFSET_TRILHO`). Se o `px-4`
    // vencesse, este número seria 16 e o conteúdo estaria embaixo do trilho.
    expect(caixa!.esquerda, "lg:pl-[88px] perdeu do px-4").toBe(88)
    expect(caixa!.direita).toBe(16)

    // O trilho de fato ocupa a faixa que o padding reserva.
    const trilho = await page.locator('nav[aria-label="Navegação principal"]').boundingBox()
    expect(trilho, "trilho não encontrado a 1440px").not.toBeNull()
    expect(trilho!.x + trilho!.width).toBeLessThanOrEqual(caixa!.esquerda)
  })

  test("a ação flutuante não paira sobre a barra que não existe no desktop", async ({ page }) => {
    await page.goto("/barco", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})

    const fab = page.getByRole("button", { name: "+ Registrar" })
    await expect(fab).toBeVisible()
    const folga = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => x.textContent?.trim() === "+ Registrar")
      return b ? window.innerHeight - b.getBoundingClientRect().bottom : -1
    })
    // 24px é o que `SLOT_ACAO_FLUTUANTE` reserva a partir de `lg`. O valor de
    // celular (80px) é a regressão que este teste existe pra pegar; a folga
    // de 0 seria o outro extremo (botão colado no rodapé).
    expect(folga, "o FAB voltou a flutuar à altura da bottom-nav no desktop").toBeLessThanOrEqual(32)
    expect(folga).toBeGreaterThanOrEqual(16)
  })
})

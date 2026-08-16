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
 * 2. O FAB global "+ Registrar" flutuava por cima de campo de formulário
 *    (`/barco/itens/novo`: em cima de "Horas no último serviço"). ONDA 60:
 *    o dono aposentou o FAB do app inteiro (cada tela já tem sua ação no
 *    lugar certo — ver `lib/ui/superficies.ts`), então o teste que cobrava
 *    "não aparece em tela de criação" hoje cobra "não existe em lugar
 *    nenhum". A única ação flutuante que sobra é a da própria tela de
 *    `/barco/resumos` (o "Exportar PDF").
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

  test("o FAB global não existe em lugar nenhum — só a ação própria de /barco/resumos flutua", async ({ page }) => {
    // Âncora do teste: o slot de ação flutuante continua FUNCIONANDO — o
    // "Exportar PDF" de /barco/resumos é o único morador que sobrou. Sem
    // esta âncora, o teste passaria também se o slot inteiro quebrasse.
    await page.goto("/barco/resumos", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    await expect(page.getByRole("button", { name: "Exportar PDF" })).toBeVisible()

    // O FAB "+ Registrar" aposentou (onda 60). Hub, lista, Início e
    // formulário: em nenhum lugar ele volta — se voltar, alguém remontou o
    // gatilho global e esta é a linha que avisa.
    for (const rota of ["/hoje", "/barco", "/diario", "/financeiro", "/barco/itens/novo"]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" })
      await page.waitForLoadState("networkidle").catch(() => {})
      await expect(page.getByRole("button", { name: "+ Registrar" }), rota).toHaveCount(0)
    }
  })

  test("a folga inferior existe de verdade e cresce onde uma ação flutuante mora", async ({ page }) => {
    // Guarda de compilação: `FOLGA_BASE`/`FOLGA_COM_ACAO_FLUTUANTE` são
    // classes arbitrárias do Tailwind com `calc()` e `env()`. Se a sintaxe
    // quebrar (underscore virando espaço, parêntese, o que for), a classe
    // some silenciosamente e o padding vira 0 — exatamente o bug da onda
    // 54, de volta e sem aviso. Medir o valor computado é o único jeito de
    // saber que a classe existe.
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

    // hub comum: só a bottom-nav flutua — a folga base cobre os ~58px dela
    // e nunca pode ser zero
    const hub = await folga("/barco")
    expect(hub).toBeGreaterThanOrEqual(76)

    // formulário: sem o FAB global não há mais distinção por rota — mesma
    // folga base, e o botão de salvar continua protegido (teste abaixo)
    const formulario = await folga("/barco/itens/novo")
    expect(formulario).toBeGreaterThanOrEqual(76)

    // /barco/resumos: a única tela com ação flutuante própria (o "Exportar
    // PDF") — precisa caber o botão inteiro (topo a 128px + safe-area)
    const comAcaoFlutuante = await folga("/barco/resumos")
    expect(comAcaoFlutuante).toBeGreaterThanOrEqual(144)
    expect(comAcaoFlutuante).toBeGreaterThan(hub)
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
 * 2. A ação flutuante (hoje só o "Exportar PDF" de `/barco/resumos`) mora a
 *    5rem do rodapé no celular porque a barra de baixo ocupa esse espaço. No
 *    desktop a barra é `lg:hidden`, e o botão ficava pairando sobre 80px de
 *    nada.
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
    // Desde a onda 60 a única ação flutuante do app é o "Exportar PDF" de
    // /barco/resumos — é nela que o SLOT_ACAO_FLUTUANTE é medido agora.
    await page.goto("/barco/resumos", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})

    const botao = page.getByRole("button", { name: "Exportar PDF" })
    await expect(botao).toBeVisible()
    const folga = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => (x.textContent ?? "").trim() === "Exportar PDF")
      return b ? window.innerHeight - b.getBoundingClientRect().bottom : -1
    })
    // 24px é o que `SLOT_ACAO_FLUTUANTE` reserva a partir de `lg`. O valor de
    // celular (80px) é a regressão que este teste existe pra pegar; a folga
    // de 0 seria o outro extremo (botão colado no rodapé).
    expect(folga, "a ação flutuante voltou a flutuar à altura da bottom-nav no desktop").toBeLessThanOrEqual(32)
    expect(folga).toBeGreaterThanOrEqual(16)
  })
})

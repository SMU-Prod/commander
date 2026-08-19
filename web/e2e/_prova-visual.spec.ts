// TEMPORÁRIO — captura das telas refeitas nas ondas 101/102 para o dono ver.
// Apagado depois de gerar os PNGs.
import { test, expect } from "@playwright/test"

// O arquivo de sessão é criado pelo `global-setup`, que roda DEPOIS deste
// módulo ser carregado — checar existência aqui em cima sempre dá falso e
// pula tudo. Foi o que aconteceu na primeira execução.
const ESTADO = "e2e/.auth/usuario-teste.json"

const TELAS: { rota: string; nome: string }[] = [
  { rota: "/hoje", nome: "1-inicio" },
  { rota: "/barco", nome: "2-meu-barco" },
  { rota: "/menu", nome: "3-menu" },
  { rota: "/notificacoes", nome: "4-avisos" },
  // Onda 7 — Serviços entrou na barra de baixo, então precisa de prova visual
  // como as outras quatro: sem captura não há como comparar antes e depois.
  { rota: "/servicos", nome: "5-servicos" },
]

// Onda 7 — a pasta sai por variável pra o MESMO comando gravar o "antes" e o
// "depois" sem sobrescrever um com o outro (era o furo da rodada anterior: só
// existia um jogo de PNGs e ele virava o estado mais recente).
const PASTA = process.env.PROVA_DIR ?? ".prova"

test.describe("prova visual 390px", () => {
  test.use({ storageState: ESTADO, viewport: { width: 390, height: 844 } })

  for (const { rota, nome } of TELAS) {
    test(`captura ${rota}`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "networkidle" })

      // O React 19 revela a fronteira de Suspense por `requestAnimationFrame`,
      // que NÃO dispara em documento oculto — e o navegador automatizado
      // reporta `hidden` mesmo em primeiro plano. Sem isto a captura fotografa
      // o esqueleto, que foi o que invalidou a evidência de uma auditoria hoje.
      await page.evaluate(() => {
        const w = window as unknown as { $RB?: unknown[]; $RV?: (b: unknown) => void }
        if (typeof w.$RV === "function" && w.$RB) w.$RV(w.$RB)
      })
      await page.waitForTimeout(600)

      const texto = (await page.locator("body").innerText()).trim()
      expect(texto.length, `tela ${rota} veio vazia — provavelmente esqueleto`).toBeGreaterThan(200)

      // DUAS CAPTURAS, e a diferença entre elas não é cosmética.
      //
      // `fullPage: true` estica a altura da página e desenha o elemento
      // `position: fixed` UMA VEZ, na posição que ele ocupava na primeira
      // tela — então a barra inferior aparece no MEIO de uma captura de
      // 1.900px. O dono olhou a imagem e perguntou por que o menu estava no
      // meio da tela: não estava. A captura é que mente sobre elemento fixo.
      //
      // A de viewport é a que se manda para uma pessoa olhar (é o que ela
      // veria); a de página inteira serve para MEDIR altura de rolagem e
      // conferir o que está abaixo da dobra. Uma não substitui a outra.
      await page.screenshot({ path: `${PASTA}/${nome}-tela.png` })
      await page.screenshot({ path: `${PASTA}/${nome}.png`, fullPage: true })
    })
  }
})

/**
 * Onda 7 — a casca mudou nos DOIS lados, então a prova precisa dos dois.
 * O cabeçalho desceu para o celular e o estado do barco subiu para `lg`; a
 * barra de baixo trocou uma aba e o trilho não. Medir só 390 deixaria o
 * desktop sem evidência justamente na onda em que a moldura foi mexida.
 * Além da foto, mede o estouro horizontal — a única falha de layout que uma
 * captura estática esconde bem (a página rola de lado e a imagem não mostra).
 */
test.describe("prova visual 1440px", () => {
  test.use({ storageState: ESTADO, viewport: { width: 1440, height: 900 } })

  for (const { rota, nome } of TELAS.slice(0, 2).concat(TELAS.slice(4))) {
    test(`captura desktop ${rota}`, async ({ page }) => {
      await page.goto(rota, { waitUntil: "networkidle" })
      await page.evaluate(() => {
        const w = window as unknown as { $RB?: unknown[]; $RV?: (b: unknown) => void }
        if (typeof w.$RV === "function" && w.$RB) w.$RV(w.$RB)
      })
      await page.waitForTimeout(600)

      const estouro = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(estouro, `tela ${rota} rola de lado a 1440px`).toBeLessThanOrEqual(0)

      await page.screenshot({ path: `${PASTA}/${nome}-desktop.png` })
    })
  }
})

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
  // Onda 104 — DUAS telas de hub, e duas de propósito. A identidade por hub
  // (§8 do Guia) só é verificável por COMPARAÇÃO: uma tela sozinha prova que
  // existe um cartucho colorido, não que Segurança e Elétrica são distintas
  // uma da outra. Escolhidas estas duas porque são as que estavam nos dois
  // extremos do defeito — a de Segurança tinha o `<h1>` solto com ação, a de
  // Elétrica tinha o "Voltar" de 16px.
  { rota: "/barco/seguranca", nome: "6-hub-seguranca" },
  { rota: "/barco/eletrica", nome: "7-hub-eletrica" },
  // Onda 108 — OS OITO OBJETOS PRECISAM SER OLHADOS JUNTOS, e não de dois em
  // dois. Eles são desenhados por código (`components/ui/objeto-hub.tsx`), e o
  // que quebra numa cena isométrica não é sintaxe: é escala e ordem de pintura
  // — uma peça grande demais para a base, uma peça de trás desenhada por cima
  // da da frente. Isso só aparece comparando. Foi assim que a boia de Segurança
  // saiu maior que a base e encavalada no extintor sem nenhum teste reclamar.
  { rota: "/barco/motores", nome: "8-hub-motores" },
  { rota: "/barco/casco", nome: "9-hub-casco" },
  { rota: "/barco/hidraulica", nome: "10-hub-hidraulica" },
  { rota: "/barco/equipamentos", nome: "11-hub-equipamentos" },
  { rota: "/barco/documentos", nome: "12-hub-documentos" },
  { rota: "/barco/manutencoes", nome: "13-hub-manutencoes" },
  // Onda 114 — a Agenda virou calendário-primeiro (imagem 5 do guia).
  { rota: "/agenda", nome: "14-agenda" },
  { rota: "/diario", nome: "15-diario" },
  { rota: "/menu/conectar-barco", nome: "16-conectar-barco" },
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

      // ONDA 108 — A TRAVA ANTI-ESQUELETO PASSA A MEDIR O TÍTULO, E NÃO O
      // TAMANHO DO TEXTO.
      // Ela cobrava 200 caracteres no `<body>`, e reprovou `/barco/motores`
      // com a tela PERFEITA: hub com o objeto isométrico, dois mostradores de
      // horímetro e nada mais — 63 caracteres. O número existia para pegar
      // captura de esqueleto, e virou um teto de quanto texto uma tela pode
      // ter. Uma tela de hub com pouco texto é o OBJETIVO do redesign, não o
      // defeito.
      // O `<h1>` é a medida certa: o esqueleto do app não desenha título
      // nenhum (`components/ui/esqueleto.tsx` desenha barras), então título com
      // texto é prova de que o conteúdo real chegou — e não impõe piso de
      // verborragia a tela nenhuma.
      const titulo = (await page.locator("h1").first().innerText().catch(() => "")).trim()
      expect(titulo.length, `tela ${rota} veio sem <h1> — provavelmente esqueleto`).toBeGreaterThan(2)

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

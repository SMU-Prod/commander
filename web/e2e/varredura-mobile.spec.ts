import { test, expect, type Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { ARQUIVO_SESSAO } from "./global-setup"

// Sem sessão a varredura mede a tela de login 70 vezes — o `test.use` é o que
// faz ela olhar o app de verdade. Mesmo padrão de `navegar-mapa.spec.ts`.
const temSessao = fs.existsSync(ARQUIVO_SESSAO)
test.use(temSessao ? { storageState: ARQUIVO_SESSAO } : {})
test.skip(!temSessao, "sem SUPABASE_SERVICE_ROLE_KEY — varredura precisa de sessão real")

/**
 * VARREDURA DE TELA (onda 54) — o app inteiro nas larguras em que ele é usado.
 *
 * Por que isto existe: o Commander é feito pra celular na marina, mas até
 * então o único teste que subia navegador de verdade rodava em
 * `devices["Desktop Chrome"]` (playwright.config.ts). Ou seja: a suíte que
 * existe pra pegar o que o teste unitário não pega nunca olhou o app na
 * largura em que ele é usado. Caixa de formulário em cima de caixa, botão
 * fora da tela e tela sem saída passam batido num viewport de 1280px.
 *
 * O dono relatou exatamente esses três sintomas em 15/08/2026. Isto não é
 * um teste de regressão bonito — é o instrumento de medida que faltava.
 *
 * ONDA 57 — A VARREDURA PASSA A MEDIR TAMBÉM O DESKTOP.
 *
 * A onda deu casca responsiva ao app: a partir de `lg` (1024px) existe um
 * trilho lateral fixo de 72px (`components/trilho-lateral.tsx`), a bottom-nav
 * some e o conteúdo cresce de 430px até 1400px (`lib/ui/superficies.ts`).
 * Nenhuma das 109 telas foi desenhada pra essa largura — elas herdaram a
 * casca sem serem tocadas. Medir só 390px agora seria testar metade do app:
 * a metade que já estava medida.
 *
 * O NOME DO ARQUIVO CONTINUA `varredura-mobile` de propósito: ele é citado
 * em `docs/DESIGN.md` §"Não vale como intenção" e em `app/not-found.tsx`.
 * Renomear por capricho quebraria referência escrita sem ganhar nada — o
 * que manda é o que ele mede, e isso está aqui em cima.
 *
 * O que cada tela é obrigada a passar, EM CADA TAMANHO:
 *   1. NÃO rolar na horizontal (o sintoma clássico de layout quebrado no
 *      celular; `documentElement.scrollWidth > clientWidth`).
 *   2. NÃO ter dois controles interativos sobrepostos (o "caixa em cima de
 *      caixa"). Medimos par a par com `getBoundingClientRect`.
 *   3. TER saída — alguma forma visível de voltar/navegar. Tela sem saída é
 *      o "fico travado sem conseguir voltar".
 *   4. NÃO ter alvo de toque menor que 44px (mínimo de acessibilidade que o
 *      resto do app já respeita, ver `min-h-11` no código).
 *
 * As falhas NÃO quebram a suíte: a varredura grava um relatório JSON e
 * screenshots pra revisão humana. Um `expect` por tela transformaria isto
 * num muro de 140 falhas sem prioridade nenhuma — o objetivo aqui é
 * MEDIR primeiro. Quem conserta é a onda seguinte, guiada pelo relatório.
 */

/**
 * Os dois tamanhos que o app tem hoje. Não são "breakpoints de teste": são
 * as duas pontas reais do que a `MolduraApp` desenha.
 *
 * 390×844 — iPhone 14 / Pixel, a menor largura realista de 2026, e o alvo
 * declarado do produto (marina, uma mão, sol na tela).
 *
 * 1440×900 — a casca de desktop que a onda 57 criou e que nunca tinha sido
 * medida. 1440 e não 1280 porque é acima de `lg` com folga: a 1280 o
 * conteúdo ainda não chega no teto de 1400px, então um defeito de "largura
 * demais" ficaria escondido. Um tamanho intermediário (`md`, 768px) não
 * entra porque dobraria o tempo da suíte pra medir uma faixa que é
 * interpolação das outras duas — se a onda seguinte achar defeito só em
 * tablet, ele entra aqui.
 */
const TAMANHOS = [
  { nome: "celular", largura: 390, altura: 844 },
  { nome: "desktop", largura: 1440, altura: 900 },
] as const

const SAIDA = path.resolve(__dirname, "../.varredura")

/** Rotas estáticas (sem `[id]`). As dinâmicas precisam de dado semeado e
 *  entram numa segunda leva, guiada pelo que esta encontrar. */
const ROTAS = [
  "/hoje", "/barco", "/barco/saude", "/barco/eletrica", "/barco/equipamentos",
  "/barco/hidraulica", "/barco/seguranca", "/barco/documentos", "/barco/fotos",
  "/barco/contatos", "/barco/gastos", "/barco/historico", "/barco/ocorrencias",
  "/barco/ocorrencias/nova", "/barco/itens/novo", "/barco/equipamento/novo",
  "/barco/resumos", "/barco/local", "/barco/editar", "/barco/transferir",
  "/barco/selos", "/barco/selos/verified", "/barco/selos/gold", "/barco/connect",
  "/diario", "/diario/novo",
  "/agenda", "/agenda/novo",
  "/financeiro", "/financeiro/lancamentos", "/financeiro/recorrentes",
  // `/financeiro/novo`, não `/financeiro/nova`: a rota escrita no feminino
  // não existe e a varredura vinha medindo a página 404 do Next — que
  // realmente não tem saída, e por isso aparecia como "SEM SAÍDA" no
  // relatório. Era achado do teste, não do app (onda 55).
  "/financeiro/relatorios", "/financeiro/novo",
  "/carteira", "/carteira/nova",
  "/marketplace", "/marketplace/nova", "/marketplace/interesses",
  "/marketplace/disponibilidades",
  "/avaliacoes", "/explorar", "/prestadores", "/prestadores/perfil",
  "/comandantes", "/rede", "/navegar", "/navegar/viagem/nova",
  // Onda 58: `/menu/ajustes` é tela nova e `/tripulacao` é o endereço novo da
  // Tripulação. `/menu/tripulacao` (agora só redirect) fica de fora — medi-lo
  // seria medir `/tripulacao` duas vezes; `/tripulacao/[id]` segue a regra
  // das dinâmicas lá de cima.
  "/notificacoes", "/menu", "/menu/perfil", "/menu/assinatura", "/menu/ajustes",
  "/tripulacao",
  "/assinar", "/onboarding",
  "/admin", "/admin/administradores", "/admin/usuarios", "/admin/parceiros",
  "/admin/publicidade", "/admin/taxonomia", "/admin/taxonomia/solicitacoes",
  "/admin/logs", "/admin/marketplace", "/admin/avaliacoes", "/admin/gold",
  "/admin/gold/precos", "/admin/gold/consultores",
  "/parceiro", "/parceiro/perfil", "/parceiro/marketplace", "/parceiro/conta",
]

interface Achado {
  rota: string
  estouroHorizontal: number | null
  sobrepostos: string[]
  semSaida: boolean
  alvosPequenos: string[]
  urlFinal: string
  erroConsole: string[]
}

/** Rótulo curto e legível de um elemento, pro relatório apontar QUAL caixa. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const rotulo = (el: Element) => {
      const tag = el.tagName.toLowerCase()
      const texto = (el.textContent ?? "").trim().slice(0, 28)
      const nome = el.getAttribute("name") ?? el.getAttribute("id") ?? ""
      return `${tag}${nome ? `#${nome}` : ""}${texto ? `:"${texto}"` : ""}`
    }

    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"
    }

    // ONDA 57 — POR QUE A PASTILHA DO TRILHO NÃO ENTRA NESTA LISTA.
    //
    // O trilho de desktop revela o rótulo de cada destino numa pastilha
    // `absolute` posicionada FORA dos 72px da coluna (ver o comentário longo
    // em `components/trilho-lateral.tsx`). Ela cobre, sim, o conteúdo da
    // página — de propósito, e só enquanto o ponteiro ou o foco estão em cima
    // do ícone.
    //
    // Ela está fora daqui por construção, não por descuido: o seletor abaixo
    // pega só CONTROLE (`input, select, textarea, button, a[href]`) e a
    // pastilha é um `<span aria-hidden pointer-events-none`. As duas coisas
    // importam. A regra 2 desta varredura existe pra achar controle que ROUBA
    // O TOQUE de outro controle — e `pointer-events: none` torna isso
    // fisicamente impossível: o clique atravessa a pastilha e chega em quem
    // está embaixo.
    //
    // Alargar o seletor pra incluí-la reportaria sobreposição nas ~72 telas
    // de desktop, todas pelo mesmo motivo, todas correto-por-desenho. Um
    // instrumento que grita em toda tela é um instrumento que ninguém lê — e
    // os achados de verdade (que existem, e são o produto desta onda)
    // ficariam soterrados.
    //
    // O que a pastilha PRECISA responder — ela aparece mesmo no foco de
    // teclado? cabe na viewport? empurra a página? — está medido de
    // propósito, com hover e Tab de verdade, no teste "trilho de desktop"
    // no fim deste arquivo. Ou seja: ela não deixou de ser medida; ela saiu
    // da régua errada e entrou na certa.
    const interativos = Array.from(
      document.querySelectorAll("input, select, textarea, button, a[href]"),
    ).filter(visivel)

    // Sobreposição: dois controles cujas caixas se cruzam de verdade. Ignora
    // aninhamento (um <a> dentro de um <button> não é bug de layout) e
    // ignora cruzamento de menos de 4px, que é borda/sombra e não confusão.
    const sobrepostos: string[] = []
    for (let i = 0; i < interativos.length; i++) {
      for (let j = i + 1; j < interativos.length; j++) {
        const a = interativos[i], b = interativos[j]
        if (a.contains(b) || b.contains(a)) continue
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
        const larguraCruz = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
        const alturaCruz = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
        if (larguraCruz > 4 && alturaCruz > 4) {
          sobrepostos.push(`${rotulo(a)} × ${rotulo(b)}`)
        }
      }
    }

    // Alvo de toque: o próprio app já usa min-h-11 (44px) como régua.
    const alvosPequenos = interativos
      .filter((el) => {
        const r = el.getBoundingClientRect()
        // link dentro de parágrafo é texto corrido, não alvo de toque isolado
        if (el.tagName === "A" && el.closest("p")) return false
        return r.height < 40 || r.width < 24
      })
      .map(rotulo)

    // "Tem saída?" — bottom-nav, link de voltar, ou qualquer <a> que suba a
    // hierarquia. Tela que só tem formulário e nenhum caminho é a queixa do
    // "fico travado".
    //
    // Vale nos dois tamanhos sem precisar de exceção: no celular quem casa
    // com `nav a` é a bottom-nav; no desktop ela some (`lg:hidden`) e quem
    // casa é o trilho lateral, que é `<nav>` com sete links. Se um dia os
    // dois sumirem no mesmo breakpoint — o erro que o comentário do trilho
    // avisa — esta linha acusa em 72 telas de uma vez.
    const temSaida =
      document.querySelector("nav a, [data-voltar], a[href='/hoje'], a[href='/barco'], a[href='/menu']") != null ||
      Array.from(document.querySelectorAll("a")).some((a) => /voltar|barco|menu|in[íi]cio|cancelar/i.test(a.textContent ?? ""))

    return {
      estouro: document.documentElement.scrollWidth > document.documentElement.clientWidth
        ? document.documentElement.scrollWidth - document.documentElement.clientWidth
        : null,
      sobrepostos: [...new Set(sobrepostos)].slice(0, 8),
      alvosPequenos: [...new Set(alvosPequenos)].slice(0, 8),
      semSaida: !temSaida,
    }
  })
}

// Um teste POR TAMANHO, e não um teste que troca o viewport no meio: com
// `fullyParallel` os dois rodam em paralelo (o tempo total não dobra) e,
// principalmente, o relatório de cada largura é um arquivo independente —
// dá pra comparar 390 com 1440 lado a lado, e dá pra rodar só um dos dois
// com `--grep desktop` quando o assunto é a casca nova.
for (const { nome, largura, altura } of TAMANHOS) {
  test(`varredura de todas as telas em ${nome} (${largura}px)`, async ({ page }) => {
    test.setTimeout(15 * 60 * 1000)
    // Pasta por tamanho: `hoje.png` de celular e de desktop têm o mesmo nome
    // e são a MESMA tela — separar por pasta é o que permite abrir as duas
    // lado a lado sem inventar sufixo em 72 arquivos.
    const pasta = path.join(SAIDA, `${nome}-${largura}`)
    fs.mkdirSync(pasta, { recursive: true })
    await page.setViewportSize({ width: largura, height: altura })

    const achados: Achado[] = []

    for (const rota of ROTAS) {
      const erros: string[] = []
      const ouvir = (m: { type: () => string; text: () => string }) => {
        if (m.type() === "error") erros.push(m.text().slice(0, 160))
      }
      page.on("console", ouvir)
      try {
        await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 25_000 })
        // Esperar a rede sossegar ANTES de medir: várias telas fazem redirect
        // no cliente depois de hidratar (guard de permissão, seletor de
        // embarcação), e medir no meio disso derrubava o contexto com
        // "Execution context was destroyed".
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {})
        await page.waitForTimeout(400)
        const m = await medir(page)
        const arquivo = rota.replace(/\//g, "_").replace(/^_/, "") || "raiz"
        await page.screenshot({ path: path.join(pasta, `${arquivo}.png`), fullPage: true })
        achados.push({
          rota,
          estouroHorizontal: m.estouro,
          sobrepostos: m.sobrepostos,
          semSaida: m.semSaida,
          alvosPequenos: m.alvosPequenos,
          urlFinal: new URL(page.url()).pathname,
          erroConsole: erros,
        })
      } catch (e) {
        achados.push({
          rota, estouroHorizontal: null, sobrepostos: [], semSaida: false,
          alvosPequenos: [], urlFinal: "ERRO", erroConsole: [String(e).slice(0, 200)],
        })
      }
      page.off("console", ouvir)
    }

    fs.writeFileSync(
      path.join(SAIDA, `relatorio-${nome}-${largura}.json`),
      JSON.stringify(achados, null, 2),
      "utf-8",
    )

    const comProblema = achados.filter(
      (a) => a.estouroHorizontal || a.sobrepostos.length || a.semSaida || a.alvosPequenos.length || a.erroConsole.length,
    )
    console.log(`\n=== VARREDURA ${nome.toUpperCase()} ${largura}px: ${achados.length} telas, ${comProblema.length} com achado ===`)
    for (const a of comProblema) {
      const partes = [
        a.estouroHorizontal ? `estouro ${a.estouroHorizontal}px` : null,
        a.sobrepostos.length ? `${a.sobrepostos.length} sobreposta(s)` : null,
        a.semSaida ? "SEM SAÍDA" : null,
        a.alvosPequenos.length ? `${a.alvosPequenos.length} alvo(s) < 40px` : null,
        a.erroConsole.length ? `${a.erroConsole.length} erro(s) de console` : null,
        a.urlFinal !== a.rota ? `redirecionou pra ${a.urlFinal}` : null,
      ].filter(Boolean)
      console.log(`[${largura}] ${a.rota.padEnd(38)} ${partes.join(" · ")}`)
    }

    expect(achados.length).toBe(ROTAS.length)
  })
}

/**
 * ONDA 57 — A PASTILHA DE RÓTULO DO TRILHO, MEDIDA NA RÉGUA CERTA.
 *
 * Este é o outro lado da decisão explicada lá em cima, em `medir()`: a
 * pastilha ficou de fora da regra de sobreposição (ela não pode roubar
 * toque de ninguém), então ela precisa de um teste que faça o que a
 * varredura nunca faz — provocar hover e foco de teclado. Sem isto, o único
 * elemento novo de navegação do desktop seria também o único que nenhum
 * teste jamais olha.
 *
 * As três perguntas que importam, e nada além:
 *   1. Ela aparece no FOCO DE TECLADO, não só no ponteiro? Se não, quem
 *      navega por Tab vê sete ícones sem nome — e o trilho, que é a
 *      navegação principal do desktop, vira adivinhação.
 *   2. Ela nasce FORA dos 72px do trilho? É a razão de o rótulo ter voltado
 *      pra um degrau legítimo da escala (12px): se ela voltar pra dentro da
 *      coluna, o texto volta a negociar com a largura e a fonte volta a
 *      encolher.
 *   3. Ela cabe na viewport e NÃO empurra a página? `absolute` fora do
 *      container é exatamente o desenho que costuma criar barra de rolagem
 *      horizontal — o defeito nº 1 desta varredura.
 *
 * Diferente da varredura, aqui é `expect` de verdade e quebra a suíte: são
 * três invariantes de UM componente que a fundação acabou de criar, não
 * inventário de 72 telas herdadas.
 *
 * Uma tela só (`/hoje`): o trilho é o mesmo componente em todas as rotas de
 * `(app)` — repetir em 72 telas mediria o mesmo React 72 vezes.
 */
test("trilho de desktop: o rotulo aparece no foco e nao empurra a pagina", async ({ page }) => {
  const { largura, altura } = TAMANHOS[1]
  await page.setViewportSize({ width: largura, height: altura })
  await page.goto("/hoje", { waitUntil: "domcontentloaded", timeout: 25_000 })
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {})

  const trilho = page.getByRole("navigation", { name: "Navegação principal" })
  await expect(trilho).toBeVisible()

  const links = trilho.locator("a[href]")
  const quantos = await links.count()
  expect(quantos).toBeGreaterThan(0)

  // TECLADO PRIMEIRO. `Tab` a partir do documento recém-carregado, e não
  // `element.focus()`: `:focus-visible` — que é o que revela a pastilha —
  // não casa de forma confiável com foco programático no Chromium. Um teste
  // que usasse `.focus()` passaria mesmo se o `group-focus-visible` tivesse
  // sido apagado do componente, que é justamente a regressão a pegar.
  //
  // O trilho é o PRIMEIRO irmão da moldura (`components/moldura-app.tsx`), e
  // o app não tem link de "pular pro conteúdo": o primeiro Tab da página cai
  // no primeiro destino. Se um dia entrar um skip link, este `expect` avisa.
  await page.keyboard.press("Tab")
  const primeiro = links.first()
  await expect(primeiro).toBeFocused()
  await expect(primeiro.locator("span[aria-hidden='true']")).toHaveCSS("opacity", "1")

  // Geometria: com o ponteiro, que é determinístico e não depende de ordem
  // de foco. Percorre TODOS os destinos porque o rótulo mais longo
  // ("Financeiro") é justamente o que já quebrou uma vez.
  for (let i = 0; i < quantos; i++) {
    const link = links.nth(i)
    const pastilha = link.locator("span[aria-hidden='true']")
    await link.hover()
    await expect(pastilha).toHaveCSS("opacity", "1")

    const caixa = await pastilha.boundingBox()
    expect(caixa, `destino ${i}: pastilha sem caixa`).not.toBeNull()
    // 72 = a largura do trilho. A pastilha começa DEPOIS dela.
    expect(caixa!.x, `destino ${i}: pastilha dentro dos 72px do trilho`).toBeGreaterThanOrEqual(72)
    expect(caixa!.x + caixa!.width, `destino ${i}: pastilha passa da viewport`).toBeLessThanOrEqual(largura)
  }

  // A página não pode ter ganhado rolagem horizontal com a pastilha aberta.
  const estouro = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(estouro, "a pastilha aberta criou rolagem horizontal").toBeLessThanOrEqual(0)
})

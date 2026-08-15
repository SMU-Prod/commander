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
 * VARREDURA DE TELA (onda 54) — o app inteiro numa largura de CELULAR.
 *
 * Por que isto existe: o Commander é feito pra celular na marina, mas até
 * hoje o único teste que sobe navegador de verdade rodava em
 * `devices["Desktop Chrome"]` (playwright.config.ts). Ou seja: a suíte que
 * existe pra pegar o que o teste unitário não pega nunca olhou o app na
 * largura em que ele é usado. Caixa de formulário em cima de caixa, botão
 * fora da tela e tela sem saída passam batido num viewport de 1280px.
 *
 * O dono relatou exatamente esses três sintomas em 15/08/2026. Isto não é
 * um teste de regressão bonito — é o instrumento de medida que faltava.
 *
 * O que cada tela é obrigada a passar:
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
 * num muro de 70 falhas sem prioridade nenhuma — o objetivo aqui é
 * MEDIR primeiro.
 */

const LARGURA = 390 // iPhone 14 / Pixel — a menor largura realista de 2026
const ALTURA = 844

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
  "/notificacoes", "/menu", "/menu/perfil", "/menu/assinatura", "/menu/tripulacao",
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

test("varredura de todas as telas em largura de celular", async ({ page }) => {
  test.setTimeout(10 * 60 * 1000)
  fs.mkdirSync(SAIDA, { recursive: true })
  await page.setViewportSize({ width: LARGURA, height: ALTURA })

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
      const nome = rota.replace(/\//g, "_").replace(/^_/, "") || "raiz"
      await page.screenshot({ path: path.join(SAIDA, `${nome}.png`), fullPage: true })
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

  fs.writeFileSync(path.join(SAIDA, "relatorio.json"), JSON.stringify(achados, null, 2), "utf-8")

  const comProblema = achados.filter(
    (a) => a.estouroHorizontal || a.sobrepostos.length || a.semSaida || a.alvosPequenos.length || a.erroConsole.length,
  )
  console.log(`\n=== VARREDURA: ${achados.length} telas, ${comProblema.length} com achado ===`)
  for (const a of comProblema) {
    const partes = [
      a.estouroHorizontal ? `estouro ${a.estouroHorizontal}px` : null,
      a.sobrepostos.length ? `${a.sobrepostos.length} sobreposta(s)` : null,
      a.semSaida ? "SEM SAÍDA" : null,
      a.alvosPequenos.length ? `${a.alvosPequenos.length} alvo(s) < 40px` : null,
      a.erroConsole.length ? `${a.erroConsole.length} erro(s) de console` : null,
      a.urlFinal !== a.rota ? `redirecionou pra ${a.urlFinal}` : null,
    ].filter(Boolean)
    console.log(`${a.rota.padEnd(38)} ${partes.join(" · ")}`)
  }

  expect(achados.length).toBe(ROTAS.length)
})

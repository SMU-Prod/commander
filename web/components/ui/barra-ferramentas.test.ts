import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BarraFerramentas } from "./barra-ferramentas"

/**
 * Mesmo padrão de `abas.test.ts`: `renderToStaticMarkup` sem jsdom — o que
 * importa aqui é o HTML que sai (uma ação dourada, uma altura), não
 * comportamento de clique.
 */
const FILTROS_TESTE = createElement("span", { key: "f1" }, "Pendentes")

function html(acao?: { href: string; rotulo: string }) {
  return renderToStaticMarkup(
    createElement(BarraFerramentas, { filtros: FILTROS_TESTE, acao })
  )
}

describe("BarraFerramentas", () => {
  it("com acao, renderiza um link dourado com o rotulo", () => {
    const saida = html({ href: "/diario/novo", rotulo: "Novo registro" })
    const link = saida.match(/<a[^>]*href="\/diario\/novo"[^>]*>.*?<\/a>/)?.[0] ?? ""
    expect(link).toContain("bg-accent")
    expect(link).toContain("Novo registro")
  })

  it("sem acao, nenhum bg-accent aparece", () => {
    const saida = html()
    expect(saida).not.toContain("bg-accent")
  })

  it("os filtros aparecem na saida", () => {
    const saida = html()
    expect(saida).toContain("Pendentes")
  })

  it("a acao tem altura minima de 44px (min-h-11)", () => {
    const saida = html({ href: "/diario/novo", rotulo: "Novo registro" })
    const link = saida.match(/<a[^>]*href="\/diario\/novo"[^>]*>/)?.[0] ?? ""
    expect(link).toContain("min-h-11")
  })

  it("no celular a acao fica ACIMA da fila, e so a partir de lg divide a linha", () => {
    // O defeito que este teste tranca (auditoria visual 18/08): com chips e
    // ação na mesma linha em 390px, o terceiro chip era cortado no meio da
    // palavra rente ao botão dourado. A ordem no DOM é ação→filtros e as
    // classes `lg:order-*` invertem no desktop — se alguém devolver a barra
    // pra uma linha só em toda largura, o corte volta.
    const saida = html({ href: "/diario/novo", rotulo: "Registrar" })
    const raiz = saida.match(/^<div class="([^"]*)"/)?.[1] ?? ""
    expect(raiz).toContain("flex-col")
    expect(raiz).toContain("lg:flex-row")
    // A ação vem primeiro no HTML (é ela que sobe no celular) e volta pra
    // direita no desktop via `order`.
    expect(saida.indexOf("bg-accent")).toBeLessThan(saida.indexOf("rolagem-lateral"))
    expect(saida).toContain("lg:order-2")
    expect(saida).toContain("lg:order-1")
  })
})

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
})

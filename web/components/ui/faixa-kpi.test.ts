import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FaixaKpi, PastilhaKpi } from "./faixa-kpi"

function htmlPastilha(props: Parameters<typeof PastilhaKpi>[0]) {
  return renderToStaticMarkup(createElement(PastilhaKpi, props))
}
function htmlFaixa(props: Parameters<typeof FaixaKpi>[0]) {
  return renderToStaticMarkup(createElement(FaixaKpi, props))
}

describe("PastilhaKpi", () => {
  it("rótulo em caixa de frase (rotulo-dado), valor em mono tabular", () => {
    const saida = htmlPastilha({ icone: "motor", rotulo: "Sistemas", valor: "3" })
    expect(saida).toContain("rotulo-dado")
    expect(saida).toContain(">Sistemas:</span>")
    expect(saida).toContain("font-mono-instr")
    expect(saida).toContain("tabular-nums")
    expect(saida).toContain(">3<")
  })

  it("não é alvo de toque — pastilha informativa, não navega", () => {
    const saida = htmlPastilha({ icone: "motor", rotulo: "Sistemas", valor: "3" })
    expect(saida).not.toContain("<a ")
    expect(saida).not.toContain("<button")
  })
})

describe("FaixaKpi", () => {
  it("rola na horizontal sem quebrar linha", () => {
    const saida = htmlFaixa({ children: createElement(PastilhaKpi, { icone: "motor", rotulo: "Sistemas", valor: "3" }) })
    expect(saida).toContain("overflow-x-auto")
  })
})

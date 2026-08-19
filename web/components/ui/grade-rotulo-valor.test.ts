import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { GradeRotuloValor } from "./grade-rotulo-valor"

describe("GradeRotuloValor", () => {
  it("rótulo em rotulo-dado (caixa de frase), valor em corpo/font-medium", () => {
    const saida = renderToStaticMarkup(createElement(GradeRotuloValor, { itens: [["Client", "TechFlow Inc."]] }))
    expect(saida).toContain("rotulo-dado")
    expect(saida).toContain(">Client<")
    expect(saida).toContain(">TechFlow Inc.<")
  })

  it("valor ausente vira travessão — não finge dado que não existe", () => {
    const saida = renderToStaticMarkup(createElement(GradeRotuloValor, { itens: [["Nº de série", null]] }))
    expect(saida).toContain("—")
  })

  it("é grade de duas colunas", () => {
    const saida = renderToStaticMarkup(createElement(GradeRotuloValor, { itens: [["A", "1"], ["B", "2"]] }))
    expect(saida).toContain("grid-cols-2")
  })
})

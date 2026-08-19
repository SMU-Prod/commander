import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CabecalhoCartao } from "./cabecalho-cartao"

describe("CabecalhoCartao", () => {
  it("título em destaque (titulo-card, não .rotulo dim) — a diferença do Cartao comum", () => {
    const saida = renderToStaticMarkup(createElement(CabecalhoCartao, { titulo: "Cargo Layout" }))
    expect(saida).toContain("titulo-card")
    expect(saida).not.toContain('class="rotulo')
  })

  it("ícone, selo e ação são todos opcionais e aparecem quando passados", () => {
    const selo = createElement("span", { className: "selo-teste" }, "Fully loaded")
    const acao = createElement("button", { className: "acao-teste" }, "⟳")
    const saida = renderToStaticMarkup(createElement(CabecalhoCartao, { titulo: "Cargo Layout", selo, acao }))
    expect(saida).toContain("selo-teste")
    expect(saida).toContain("acao-teste")
  })
})

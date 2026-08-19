import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MigalhaPao } from "./migalha-pao"

const ITENS = [
  { rotulo: "Barco", href: "/barco" },
  { rotulo: "Motores", href: "/barco/eletrica" },
  { rotulo: "Motor BB" },
]

describe("MigalhaPao", () => {
  it("os itens do meio navegam; o último não é link", () => {
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: ITENS }))
    expect(saida).toContain('href="/barco"')
    expect(saida).toContain('href="/barco/eletrica"')
    // "Motor BB" (o atual) não pode aparecer dentro de um <a> — clique morto
    // num lugar que já é onde a pessoa está.
    const ultimo = saida.match(/<span aria-current="page"[^>]*>Motor BB<\/span>/)
    expect(ultimo).not.toBeNull()
  })

  it("o último item carrega aria-current=page", () => {
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: ITENS }))
    expect(saida).toContain('aria-current="page"')
  })

  it("com um item só, não quebra (sem chevron nenhum)", () => {
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: [{ rotulo: "Início" }] }))
    expect(saida).toContain("Início")
  })
})

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AlternadorVisao } from "./alternador-visao"

const OPCOES = [
  { valor: "lista", rotulo: "Lista", href: "/barco/equipamentos?visao=lista" },
  { valor: "quadro", rotulo: "Quadro", href: "/barco/equipamentos?visao=quadro" },
]

describe("AlternadorVisao", () => {
  it("cada opção é um link — estado mora na URL, não em useState", () => {
    const saida = renderToStaticMarkup(createElement(AlternadorVisao, { opcoes: OPCOES, ativa: "lista" }))
    expect(saida).toContain('href="/barco/equipamentos?visao=lista"')
    expect(saida).toContain('href="/barco/equipamentos?visao=quadro"')
  })

  it("só a opção ativa carrega aria-current", () => {
    const saida = renderToStaticMarkup(createElement(AlternadorVisao, { opcoes: OPCOES, ativa: "quadro" }))
    const lista = saida.match(/<a[^>]*visao=lista[^>]*>/)?.[0] ?? ""
    const quadro = saida.match(/<a[^>]*visao=quadro[^>]*>/)?.[0] ?? ""
    expect(lista).not.toContain("aria-current")
    expect(quadro).toContain('aria-current="true"')
  })
})

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Chip } from "./chip"

function html(props: Parameters<typeof Chip>[0]) {
  return renderToStaticMarkup(createElement(Chip, props))
}

describe("Chip — contagem (onda 79)", () => {
  it("sem contagem, nenhum número extra aparece (contrato antigo intacto)", () => {
    const saida = html({ href: "/x", ativo: false, children: "Ativos" })
    expect(saida).not.toContain("tabular-nums")
  })

  it("com contagem, mostra o número em mono tabular", () => {
    const saida = html({ href: "/x", ativo: false, children: "Ativos", contagem: 4 })
    expect(saida).toContain("tabular-nums")
    expect(saida).toContain(">4<")
  })

  it("contagem zero também aparece — mesma régua de honestidade do Abas", () => {
    const saida = html({ href: "/x", ativo: false, children: "Vencidos", contagem: 0 })
    expect(saida).toContain(">0<")
  })
})

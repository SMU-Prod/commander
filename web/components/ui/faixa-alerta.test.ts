import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FaixaAlerta } from "./faixa-alerta"

function html(props: Parameters<typeof FaixaAlerta>[0]) {
  return renderToStaticMarkup(createElement(FaixaAlerta, props))
}

describe("FaixaAlerta", () => {
  it("título em negrito + instrução como filho, sobre fundo âmbar", () => {
    const saida = html({ titulo: "Frágil", children: "Manuseie com cuidado." })
    expect(saida).toContain("Frágil")
    expect(saida).toContain("Manuseie com cuidado.")
    expect(saida).toContain("bg-warn/10")
    expect(saida).toContain("border-warn/30")
  })

  it("role=status, não role=alert — é informação já sabida, não interrupção", () => {
    const saida = html({ titulo: "Frágil", children: "x" })
    expect(saida).toContain('role="status"')
  })
})

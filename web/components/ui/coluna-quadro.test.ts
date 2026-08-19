import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ColunaQuadro } from "./coluna-quadro"

function html(props: Parameters<typeof ColunaQuadro>[0]) {
  return renderToStaticMarkup(createElement(ColunaQuadro, props))
}

describe("ColunaQuadro", () => {
  it("ponto colorido + título + contagem + subtítulo", () => {
    const saida = html({ tom: "ok", titulo: "Driving", contagem: 6, subtitulo: "Weekly utilization", children: null })
    expect(saida).toContain("Driving")
    expect(saida).toContain(">6<")
    expect(saida).toContain("Weekly utilization")
    expect(saida).toContain("bg-ok")
  })

  it("tom neutro por padrão — não inventa estado que ninguém passou", () => {
    const saida = html({ titulo: "Off duty", contagem: 0, children: null })
    expect(saida).toContain("bg-line")
  })
})

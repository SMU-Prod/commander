import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { GraficoBarras } from "./grafico-barras"

function html(props: Parameters<typeof GraficoBarras>[0]) {
  return renderToStaticMarkup(createElement(GraficoBarras, props))
}

const USO = [
  { rotulo: "S1", valor: 31 },
  { rotulo: "S4", valor: 38, apoio: "Distância 1.344,7 mi", destaque: true },
  { rotulo: "S5", valor: 45 },
]

/** As alturas que as barras realmente pintam, em porcentagem. */
function alturas(saida: string): number[] {
  return [...saida.matchAll(/style="height:([\d.]+)%"/g)].map((m) => Number(m[1]))
}

describe("GraficoBarras", () => {
  it("cada barra carrega as duas métricas no aria-label", () => {
    const saida = html({ pontos: USO, metrica: "Utilização", sufixo: "%" })
    expect(saida).toContain('aria-label="S4: Utilização 38%. Distância 1.344,7 mi"')
    expect(saida).toContain('aria-label="S1: Utilização 31%"')
  })

  it("o tooltip traz rótulo, métrica e apoio — sem JavaScript", () => {
    const saida = html({ pontos: USO, metrica: "Utilização", sufixo: "%" })
    expect(saida).toContain("Distância 1.344,7 mi")
    expect(saida).toContain("group-hover:opacity-100")
    expect(saida).toContain("group-focus-within:opacity-100")
    // A peça inteira é de servidor: nenhuma diretiva de cliente escondida.
    expect(saida).not.toContain("use client")
  })

  it("a barra em destaque já nasce com o tooltip aberto; as outras, fechado", () => {
    const saida = html({ pontos: USO })
    expect(saida.match(/opacity-0/g)?.length).toBe(2)
  })

  it("toda barra é alcançável pelo teclado", () => {
    const saida = html({ pontos: USO })
    expect(saida.match(/tabindex="0"/g)?.length).toBe(3)
  })

  it("nenhuma barra passa do topo da área", () => {
    for (const altura of alturas(html({ pontos: USO }))) {
      expect(altura).toBeGreaterThanOrEqual(0)
      expect(altura).toBeLessThanOrEqual(100)
    }
  })

  it("valor negativo vira barra zerada, não barra invertida", () => {
    const saida = html({ pontos: [{ rotulo: "a", valor: -10 }, { rotulo: "b", valor: 10 }] })
    expect(alturas(saida)[0]).toBe(0)
  })

  it("série toda em zero não desenha barra nenhuma", () => {
    const saida = html({ pontos: [{ rotulo: "a", valor: 0 }, { rotulo: "b", valor: 0 }] })
    expect(alturas(saida)).toEqual([0, 0])
  })
})

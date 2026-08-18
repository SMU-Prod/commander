import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { GraficoArea } from "./grafico-area"

function html(props: Parameters<typeof GraficoArea>[0]) {
  return renderToStaticMarkup(createElement(GraficoArea, props))
}

const SEMANAS = [
  { rotulo: "01/06", valor: 88 },
  { rotulo: "08/06", valor: 92 },
  { rotulo: "15/06", valor: 85 },
  { rotulo: "22/06", valor: 94 },
]

/** Todos os `y` que o caminho da área desenha. */
function alturas(saida: string): number[] {
  const caminho = saida.match(/<path d="(M [^"]*)"/)?.[1] ?? ""
  return [...caminho.matchAll(/[ML C]\s?[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]))
}

describe("GraficoArea", () => {
  it("o aria-label descreve a série — o SVG não tem texto nenhum dentro", () => {
    const saida = html({ pontos: SEMANAS, rotulo: "Pontualidade", sufixo: "%" })
    expect(saida).toContain('aria-label="Pontualidade: 4 pontos, de 85% a 94%"')
  })

  it("dado até 100 dá o eixo 0/25/50/75/100 da referência", () => {
    const saida = html({ pontos: SEMANAS, sufixo: "%" })
    for (const marca of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(saida).toContain(`${marca}<`)
    }
  })

  it("o eixo cresce junto com o dado em vez de estourar", () => {
    const saida = html({ pontos: [{ rotulo: "a", valor: 340 }], sufixo: "h" })
    expect(saida).toContain("400h<")
  })

  it("os rótulos do eixo X saem em mono tabular", () => {
    const saida = html({ pontos: SEMANAS })
    const span = saida.match(/<span[^>]*class="([^"]*)"[^>]*>01\/06<\/span>/)?.[1] ?? ""
    expect(span).toContain("font-mono-instr")
    expect(span).toContain("tabular-nums")
  })

  it("nenhum ponto do caminho sai da caixa do gráfico", () => {
    // Inclusive os pontos de controle da curva: sem prender, um vale seguido
    // de um pico faz o Bézier passar por baixo de 100 e a área vaza do
    // gráfico por dentro do preenchimento.
    const serrote = [
      { rotulo: "a", valor: 0 },
      { rotulo: "b", valor: 100 },
      { rotulo: "c", valor: 0 },
      { rotulo: "d", valor: 100 },
    ]
    for (const y of alturas(html({ pontos: serrote }))) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(100)
    }
  })

  it("série vazia não quebra e não inventa gráfico", () => {
    const saida = html({ pontos: [], rotulo: "Vazio" })
    expect(saida).toContain('aria-label="Vazio: sem dados"')
    expect(alturas(saida)).toEqual([])
  })

  it("valor negativo é preso no piso em vez de furar o eixo", () => {
    const saida = html({ pontos: [{ rotulo: "a", valor: -50 }, { rotulo: "b", valor: 50 }] })
    for (const y of alturas(saida)) expect(y).toBeLessThanOrEqual(100)
  })
})

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ProgressoRota } from "./progresso-rota"

function html(props: Parameters<typeof ProgressoRota>[0]) {
  return renderToStaticMarkup(createElement(ProgressoRota, props))
}

const BASE = {
  origem: "Angra dos Reis",
  destino: "Ilha Grande",
  distanciaTotal: 282.1,
  restante: 72.9,
  eta: "~1h 8m",
} as const

function larguraPintada(saida: string): string | null {
  return saida.match(/style="width:([^"]*)"/)?.[1] ?? null
}

describe("ProgressoRota", () => {
  it("mostra origem, destino e os três números", () => {
    const saida = html({ ...BASE, percentual: 72 })
    expect(saida).toContain("Angra dos Reis")
    expect(saida).toContain("Ilha Grande")
    expect(saida).toContain("282,1 km")
    expect(saida).toContain("72,9 km")
    expect(saida).toContain("~1h 8m")
    expect(saida).toContain(">72%<")
  })

  it("os números que mudam em navegação saem em mono tabular", () => {
    const saida = html({ ...BASE, percentual: 72 })
    const span = saida.match(/<span class="([^"]*)">282,1 km<\/span>/)?.[1] ?? ""
    expect(span).toContain("font-mono-instr")
    expect(span).toContain("tabular-nums")
  })

  it("a barra se anuncia como progresso, com o valor certo", () => {
    const saida = html({ ...BASE, percentual: 72 })
    expect(saida).toContain('aria-label="Progresso de Angra dos Reis até Ilha Grande"')
    expect(saida).toContain('aria-valuenow="72"')
  })

  it("acima de 100% a barra não estoura o trilho", () => {
    // GPS ruidoso já mandou 101 antes; o trilho não pode ceder por isso.
    const saida = html({ ...BASE, percentual: 130 })
    expect(larguraPintada(saida)).toBe("100%")
    expect(saida).toContain('aria-valuenow="100"')
  })

  it("sem percentual a rota lê zero em vez de quebrar", () => {
    const saida = html({ ...BASE, percentual: null })
    expect(larguraPintada(saida)).toBe("0%")
    expect(saida).toContain(">0%<")
  })

  it("a unidade acompanha o dado em vez de ser fixa", () => {
    const saida = html({ ...BASE, percentual: 40, unidade: "MN" })
    expect(saida).toContain("282,1 MN")
  })
})

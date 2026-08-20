import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BarraCapacidade } from "./barra-capacidade"

function html(props: Parameters<typeof BarraCapacidade>[0]) {
  return renderToStaticMarkup(createElement(BarraCapacidade, props))
}

const BASE = { total: 44000, unidade: "lbs", rotulo: "Peso a bordo" } as const

/** A largura que a barra realmente pinta. */
function larguraPintada(saida: string): string | null {
  return saida.match(/style="width:([^"]*)"/)?.[1] ?? null
}

describe("BarraCapacidade", () => {
  it("mostra usado e total com separador de milhar", () => {
    const saida = html({ ...BASE, usado: 28700 })
    expect(saida).toContain("28.700")
    expect(saida).toContain("/ 44.000 lbs")
    expect(saida).toContain("65%")
  })

  it("o número forte sai em mono tabular", () => {
    const saida = html({ ...BASE, usado: 28700 })
    const span = saida.match(/<span class="([^"]*)">28\.700<\/span>/)?.[1] ?? ""
    expect(span).toContain("tabular-nums")
    expect(span).toContain("tabular-nums")
  })

  it("o aria-label junta as três partes numa frase só", () => {
    const saida = html({ ...BASE, usado: 28700 })
    expect(saida).toContain('aria-label="Peso a bordo: 28.700 de 44.000 lbs, 65%"')
  })

  it("acima de 100% a barra NÃO estoura o trilho", () => {
    const saida = html({ ...BASE, usado: 60000 })
    expect(larguraPintada(saida)).toBe("100%")
    expect(saida).toContain("bg-crit")
  })

  it("65% é âmbar e 100% é vermelho, como na referência", () => {
    expect(html({ ...BASE, usado: 28700 })).toContain("bg-warn")
    expect(html({ ...BASE, usado: 44000 })).toContain("bg-crit")
  })

  it("sem leitura não vira verde — nem barra, nem chip", () => {
    const saida = html({ ...BASE, usado: null })
    expect(saida).not.toContain("bg-ok")
    expect(saida).not.toContain("text-ok")
    expect(saida).toContain("bg-line")
    expect(saida).toContain("—")
  })

  it("zero usado também não vira verde", () => {
    // Neste app "0 de 44.000" quase sempre é "ninguém preencheu", e pintar de
    // verde um cartão vazio afirma que está tudo em dia sobre dado nenhum.
    const saida = html({ ...BASE, usado: 0 })
    expect(saida).not.toContain("bg-ok")
    expect(larguraPintada(saida)).toBe("0%")
  })

  it("total zero não gera divisão por zero nem barra doida", () => {
    const saida = html({ usado: 10, total: 0, unidade: "un", rotulo: "Nada" })
    expect(larguraPintada(saida)).toBe("0%")
  })
})

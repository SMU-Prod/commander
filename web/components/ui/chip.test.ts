import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Chip, ChipDado } from "./chip"

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

  it("a altura vem do token, não de um 44 cravado no arquivo (onda 91)", () => {
    expect(html({ href: "/x", ativo: false, children: "Ativos" })).toContain(
      "h-[var(--altura-controle)]",
    )
  })
})

describe("ChipDado — o chip de leitura (onda 91)", () => {
  function dado(props: Parameters<typeof ChipDado>[0]) {
    return renderToStaticMarkup(createElement(ChipDado, props))
  }

  it("rótulo e valor saem no mesmo chip — a contagem nunca fica solta ao lado do título", () => {
    const saida = dado({ rotulo: "No mar", children: "4 h 20 min" })
    expect(saida).toContain("No mar")
    expect(saida).toContain("4 h 20 min")
  })

  it("o valor usa o degrau `.valor`, e não um oitavo tamanho de número", () => {
    const saida = dado({ rotulo: "Trilha", children: "12,4 MN" })
    expect(saida).toMatch(/class="[^"]*\bvalor\b/)
    expect(saida).toContain("tabular-nums")
  })

  it("não é alvo de toque — é leitura, e por isso não vira link nem botão", () => {
    const saida = dado({ rotulo: "A bordo", children: "3" })
    expect(saida).not.toContain("<a ")
    expect(saida).not.toContain("<button")
  })
})

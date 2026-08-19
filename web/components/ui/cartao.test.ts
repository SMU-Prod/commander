import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Cartao } from "./cartao"

/**
 * ONDA 91 — O CARTÃO VIRA INSTRUMENTO DOCUMENTADO.
 *
 * Duas props novas, e o que precisa ser trancado não é a aparência delas — é
 * o contrato de quem NÃO as usa. `subtitulo` é opcional porque nenhum dos
 * cartões que já existem pode mudar sem pedir; `nivel` tem padrão `painel`
 * porque os consumidores atuais SÃO painéis de primeiro nível, e um padrão
 * `aninhado` devolveria `--raio-painel`/`.painel-lustro` à prateleira onde
 * eles ficaram sete ondas sem uso (achado 2.3).
 */
function html(props: Parameters<typeof Cartao>[0]) {
  return renderToStaticMarkup(createElement(Cartao, props))
}

describe("Cartao — subtítulo (spec §3, item 3)", () => {
  it("sem subtítulo, o cabeçalho é o de sempre: só o rótulo cinza", () => {
    const saida = html({ titulo: "Gastos do mês", children: "x" })
    expect(saida).toContain("Gastos do mês")
    expect(saida).not.toContain("rotulo-dado")
  })

  it("com subtítulo, a linha explicativa entra abaixo do título em `.rotulo-dado`", () => {
    const saida = html({
      titulo: "Gastos do mês",
      subtitulo: "Despesas pagas nos últimos 6 meses",
      children: "x",
    })
    expect(saida).toContain("Despesas pagas nos últimos 6 meses")
    expect(saida).toMatch(/class="rotulo-dado[^"]*"/)
  })

  it("subtítulo sozinho já desenha cabeçalho — não é acessório do título", () => {
    // O caso do cartão que é gráfico puro: a legenda existe, o rótulo não.
    const saida = html({ subtitulo: "Média dos últimos 12 meses", children: "x" })
    expect(saida).toContain("<header")
    expect(saida).toContain("Média dos últimos 12 meses")
  })

  it("cartão sem título, sem subtítulo, sem selo e sem ação continua sem cabeçalho", () => {
    expect(html({ children: "x" })).not.toContain("<header")
  })
})

describe("Cartao — nível (spec §3.2: o raio significa profundidade)", () => {
  it("o padrão é primeiro nível: raio de painel MAIS o material do §3.1", () => {
    const saida = html({ children: "x" })
    expect(saida).toContain("raio-painel")
    expect(saida).toContain("painel-lustro")
  })

  it("aninhado volta aos 14px e perde o lustro — sub-painel não é painel", () => {
    const saida = html({ nivel: "aninhado", children: "x" })
    expect(saida).toContain("rounded-[var(--raio-cartao)]")
    expect(saida).not.toContain("painel-lustro")
  })

  it("nível e sombra são decisões separadas — um painel pode ser chapado", () => {
    // É o tema escuro inteiro: `--sombra-1` é `none` lá, e mesmo assim o
    // cartão é de primeiro nível.
    const saida = html({ plano: true, children: "x" })
    expect(saida).toContain("raio-painel")
    expect(saida).not.toContain("sombra-1")
  })

  it("nenhum raio em pixel cravado — os dois caminhos passam por token", () => {
    for (const nivel of ["painel", "aninhado"] as const) {
      expect(html({ nivel, children: "x" }), nivel).not.toMatch(/rounded-\[\d/)
    }
  })
})

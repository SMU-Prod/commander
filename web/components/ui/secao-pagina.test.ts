import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SecaoPagina } from "./secao-pagina"

/**
 * ONDA 91, achado 1.3 — `/barco` gastava 457px só em moldura de cabeçalho de
 * seção: oito seções × 32px fixos (`mt-6 mb-2`) mais as linhas, ou 61% de uma
 * tela de 390×844 antes de qualquer conteúdo.
 *
 * O que este arquivo tranca não é o desenho denso — é o contrato de quem NÃO
 * pede: `denso` é opcional e os ~35 consumidores atuais têm que continuar
 * recebendo exatamente a moldura de antes.
 */
function html(props: Parameters<typeof SecaoPagina>[0]) {
  return renderToStaticMarkup(createElement(SecaoPagina, props))
}

describe("SecaoPagina — moldura densa", () => {
  it("sem `denso`, a moldura é a de sempre (24 + 8 = 32px)", () => {
    const saida = html({ children: "Motores" })
    expect(saida).toContain("mt-6 mb-2")
    expect(saida).not.toContain("mt-4 mb-1")
  })

  it("com `denso`, cai para 16 + 4 = 20px — 12px por seção, ~96px em /barco", () => {
    const saida = html({ denso: true, children: "Motores" })
    expect(saida).toContain("mt-4 mb-1")
    expect(saida).not.toContain("mt-6 mb-2")
  })

  it("os dois pares são degraus da escala base-8 — apertar não é sair da régua", () => {
    for (const denso of [false, true]) {
      const saida = html({ denso, children: "Motores" })
      const margens = saida.match(/m[tb]-\d+(\.\d+)?/g) ?? []
      for (const m of margens) {
        expect([4, 6, 1, 2], `${m} (denso=${denso})`).toContain(Number(m.split("-")[1]))
      }
    }
  })

  it("o rótulo e a ação não mudam com a densidade — só a moldura aperta", () => {
    const acao = { href: "/barco/motores", rotulo: "Ver tudo" }
    const normal = html({ acao, children: "Motores" })
    const denso = html({ acao, denso: true, children: "Motores" })
    expect(denso.replace("mt-4 mb-1", "mt-6 mb-2")).toBe(normal)
  })
})

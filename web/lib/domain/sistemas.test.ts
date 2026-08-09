import { describe, expect, it } from "vitest"
import { iconeDoSistema, ordenarSistemas, proximaOrdemSistema, urlManualNaPagina } from "./sistemas"

describe("ordenarSistemas", () => {
  it("ordena pela posição gravada", () => {
    const s = [{ ordem: 2, nome: "Transmissão" }, { ordem: 0, nome: "Arrefecimento" }, { ordem: 1, nome: "Elétrica" }]
    expect(ordenarSistemas(s).map((x) => x.nome)).toEqual(["Arrefecimento", "Elétrica", "Transmissão"])
  })
  it("desempata por nome quando a posição é igual", () => {
    const s = [{ ordem: 0, nome: "Zebra" }, { ordem: 0, nome: "Arara" }]
    expect(ordenarSistemas(s).map((x) => x.nome)).toEqual(["Arara", "Zebra"])
  })
  it("não muta a lista original", () => {
    const s = [{ ordem: 1, nome: "B" }, { ordem: 0, nome: "A" }]
    const copia = [...s]
    ordenarSistemas(s)
    expect(s).toEqual(copia)
  })
})

describe("proximaOrdemSistema", () => {
  it("primeiro sistema começa em 0", () => {
    expect(proximaOrdemSistema([])).toBe(0)
  })
  it("vai pro fim da lista existente", () => {
    expect(proximaOrdemSistema([{ ordem: 0 }, { ordem: 3 }])).toBe(4)
  })
})

describe("iconeDoSistema", () => {
  it("reconhece os exemplos sugeridos no placeholder", () => {
    expect(iconeDoSistema("Arrefecimento")).toBe("oleo")
    expect(iconeDoSistema("Injeção")).toBe("oleo")
    expect(iconeDoSistema("Elétrica do motor")).toBe("raio")
    expect(iconeDoSistema("Transmissão")).toBe("ferramenta")
  })
  it("ignora maiúsculas e acentos", () => {
    expect(iconeDoSistema("ARREFECIMENTO")).toBe("oleo")
    expect(iconeDoSistema("eletrica")).toBe("raio")
  })
  it("cai no ícone genérico do motor sem palavra-chave reconhecida", () => {
    expect(iconeDoSistema("Caterpillar C32")).toBe("motor")
    expect(iconeDoSistema("")).toBe("motor")
  })
})

describe("urlManualNaPagina", () => {
  it("acrescenta o fragmento de página quando informada", () => {
    expect(urlManualNaPagina("https://acervo/manual.pdf?token=abc", 12)).toBe(
      "https://acervo/manual.pdf?token=abc#page=12",
    )
  })
  it("devolve a URL sem alteração quando não há página", () => {
    expect(urlManualNaPagina("https://acervo/manual.pdf", null)).toBe("https://acervo/manual.pdf")
  })
  it("ignora página zero ou negativa (defensivo — a UI já valida antes)", () => {
    expect(urlManualNaPagina("https://acervo/manual.pdf", 0)).toBe("https://acervo/manual.pdf")
    expect(urlManualNaPagina("https://acervo/manual.pdf", -3)).toBe("https://acervo/manual.pdf")
  })
})

import { describe, expect, it } from "vitest"
import { duracaoHoras, horasSugeridas, lerPassageiros, retornoNoDiaSeguinte, textoDuracao } from "./bordo"

describe("duracaoHoras", () => {
  it("calcula a duracao entre saida e retorno", () => {
    expect(duracaoHoras("08:00", "12:30")).toBeCloseTo(4.5, 2)
    expect(duracaoHoras("09:15", "10:00")).toBeCloseTo(0.75, 2)
  })
  it("retorno depois da meia-noite conta como no dia seguinte", () => {
    expect(duracaoHoras("22:00", "01:30")).toBeCloseTo(3.5, 2)
  })
  it("sem uma das pontas, sem duracao", () => {
    expect(duracaoHoras(null, "12:00")).toBeNull()
    expect(duracaoHoras("08:00", null)).toBeNull()
    expect(duracaoHoras("08:00", "08:00")).toBeNull()
  })
})

describe("horasSugeridas", () => {
  it("arredonda para o decimo de hora — e o que se lanca no horimetro", () => {
    expect(horasSugeridas(4.47)).toBe(4.5)
    expect(horasSugeridas(0.75)).toBe(0.8)
  })
  it("saida curta demais nao sugere nada", () => {
    expect(horasSugeridas(0.2)).toBeNull()
    expect(horasSugeridas(null)).toBeNull()
  })
})

describe("textoDuracao", () => {
  it("fala como gente", () => {
    expect(textoDuracao(4.5)).toBe("4 h 30 min")
    expect(textoDuracao(2)).toBe("2 h")
    expect(textoDuracao(0.5)).toBe("30 min")
  })
})

describe("entradas malformadas", () => {
  it("nao deixa NaN vazar para a tela", () => {
    expect(duracaoHoras("08", "12:00")).toBeNull()
    expect(duracaoHoras("", "12:00")).toBeNull()
    expect(duracaoHoras("25:00", "12:00")).toBeNull()
    expect(duracaoHoras("08:99", "12:00")).toBeNull()
  })
})

describe("retornoNoDiaSeguinte", () => {
  it("marca a travessia da meia-noite", () => {
    expect(retornoNoDiaSeguinte("22:00", "01:30")).toBe(true)
    expect(retornoNoDiaSeguinte("08:00", "12:00")).toBe(false)
    expect(retornoNoDiaSeguinte(null, "12:00")).toBe(false)
  })
})

describe("lerPassageiros", () => {
  it("separa por virgula e limpa espaco", () => {
    expect(lerPassageiros("Pedro, Ana,João ")).toEqual(["Pedro", "Ana", "João"])
  })

  it("campo vazio ou nulo nao vira passageiro", () => {
    expect(lerPassageiros(null)).toEqual([])
    expect(lerPassageiros("")).toEqual([])
    expect(lerPassageiros("  ,  ")).toEqual([])
  })

  it("virgula sobrando nao cria passageiro anonimo", () => {
    expect(lerPassageiros("Pedro,,Ana,")).toEqual(["Pedro", "Ana"])
  })

  it("nao deduplica: dois Joao a bordo sao duas pessoas", () => {
    expect(lerPassageiros("João, João")).toEqual(["João", "João"])
  })
})

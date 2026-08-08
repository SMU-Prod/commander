import { describe, expect, it } from "vitest"
import { duracaoHoras, horasSugeridas, textoDuracao } from "./bordo"

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

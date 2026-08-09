import { describe, expect, it } from "vitest"
import {
  CORES_PARCEIRO,
  ICONES_PARCEIRO,
  ICONE_PADRAO_POR_CATEGORIA,
  ehCorParceiroValida,
  ehIconeParceiroValido,
} from "./pino-parceiro"

describe("paleta e icones do pino do parceiro", () => {
  it("aceita todo valor da paleta curada de cores", () => {
    for (const c of CORES_PARCEIRO) expect(ehCorParceiroValida(c.valor)).toBe(true)
  })

  it("rejeita cor fora da paleta — não é um color picker livre", () => {
    expect(ehCorParceiroValida("#ff0000")).toBe(false)
    expect(ehCorParceiroValida("red")).toBe(false)
    expect(ehCorParceiroValida("")).toBe(false)
    expect(ehCorParceiroValida(null)).toBe(false)
    expect(ehCorParceiroValida(undefined)).toBe(false)
    expect(ehCorParceiroValida(123)).toBe(false)
  })

  it("aceita todo ícone do conjunto curado", () => {
    for (const i of ICONES_PARCEIRO) expect(ehIconeParceiroValido(i.valor)).toBe(true)
  })

  it("rejeita ícone fora do conjunto curado (ex.: ícone de ação da UI, não de estabelecimento)", () => {
    expect(ehIconeParceiroValido("chevron")).toBe(false)
    expect(ehIconeParceiroValido("menu")).toBe(false)
    expect(ehIconeParceiroValido("")).toBe(false)
    expect(ehIconeParceiroValido(null)).toBe(false)
    expect(ehIconeParceiroValido(undefined)).toBe(false)
  })

  it("todo ícone padrão por categoria pertence ao conjunto curado", () => {
    for (const icone of Object.values(ICONE_PADRAO_POR_CATEGORIA)) {
      expect(ehIconeParceiroValido(icone)).toBe(true)
    }
  })

  it("paleta tem entre 5 e 7 cores (curada, não livre — pedido explícito da task)", () => {
    expect(CORES_PARCEIRO.length).toBeGreaterThanOrEqual(5)
    expect(CORES_PARCEIRO.length).toBeLessThanOrEqual(7)
  })

  it("sem cor duplicada na paleta", () => {
    const valores = CORES_PARCEIRO.map((c) => c.valor)
    expect(new Set(valores).size).toBe(valores.length)
  })

  it("sem ícone duplicado no conjunto curado", () => {
    const valores = ICONES_PARCEIRO.map((i) => i.valor)
    expect(new Set(valores).size).toBe(valores.length)
  })
})

import { describe, expect, it } from "vitest"
import { parseDecimalPtBr } from "./numeros"

describe("parseDecimalPtBr", () => {
  it("vírgula decimal", () => expect(parseDecimalPtBr("1503,4")).toBe(1503.4))
  it("milhar + vírgula", () => expect(parseDecimalPtBr("1.503,4")).toBe(1503.4))
  it("ponto decimal simples preservado", () => expect(parseDecimalPtBr("1503.4")).toBe(1503.4))
  it("inteiro", () => expect(parseDecimalPtBr("2016")).toBe(2016))
  it("vazio vira null", () => expect(parseDecimalPtBr("  ")).toBeNull())
  it("não numérico vira null", () => expect(parseDecimalPtBr("abc")).toBeNull())
})

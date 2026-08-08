import { describe, expect, it } from "vitest"
import { horaSP } from "./datas"

describe("horaSP", () => {
  it("converte epoch em HH:MM no fuso de Sao Paulo (UTC-3)", () => {
    const epoca = Date.UTC(2024, 0, 15, 14, 30, 0) / 1000 // 14:30 UTC = 11:30 em SP
    expect(horaSP(epoca)).toBe("11:30")
  })
  it("vira o dia anterior quando o UTC ainda esta de madrugada em SP", () => {
    const epoca = Date.UTC(2024, 0, 15, 2, 15, 0) / 1000 // 02:15 UTC = 23:15 do dia 14 em SP
    expect(horaSP(epoca)).toBe("23:15")
  })
})

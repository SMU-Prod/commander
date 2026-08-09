import { describe, expect, it } from "vitest"
import { horaSP, tempoRelativo } from "./datas"

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

describe("tempoRelativo", () => {
  const agora = Date.UTC(2026, 7, 9, 12, 0, 0)

  it("menos de 1 minuto: 'agora mesmo'", () => {
    expect(tempoRelativo(agora - 30_000, agora)).toBe("agora mesmo")
  })
  it("minutos: 'há N min'", () => {
    expect(tempoRelativo(agora - 120_000, agora)).toBe("há 2 min")
  })
  it("exatamente 60 min vira 'há 1 h'", () => {
    expect(tempoRelativo(agora - 3_600_000, agora)).toBe("há 1 h")
  })
  it("horas: 'há N h'", () => {
    expect(tempoRelativo(agora - 2 * 3_600_000, agora)).toBe("há 2 h")
  })
  it("mais de 24h: 'há N d'", () => {
    expect(tempoRelativo(agora - 25 * 3_600_000, agora)).toBe("há 1 d")
  })
  it("instante no futuro (relógio ligeiramente dessincronizado) não vira negativo", () => {
    expect(tempoRelativo(agora + 5_000, agora)).toBe("agora mesmo")
  })
})

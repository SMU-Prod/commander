import { describe, expect, it } from "vitest"
import { dataSP, formatarCarimbo, horaSP, tempoRelativo } from "./datas"

describe("dataSP", () => {
  it("converte epoch em AAAA-MM-DD no fuso de Sao Paulo (UTC-3)", () => {
    const epoca = Date.UTC(2026, 0, 5, 14, 30, 0) / 1000 // 14:30 UTC de 05/01 = 11:30 em SP, mesmo dia
    expect(dataSP(epoca)).toBe("2026-01-05")
  })
  it("madrugada UTC ainda pertence ao dia anterior em SP", () => {
    const epoca = Date.UTC(2026, 0, 6, 2, 15, 0) / 1000 // 02:15 UTC do dia 06 = 23:15 do dia 05 em SP
    expect(dataSP(epoca)).toBe("2026-01-05")
  })
})

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

describe("formatarCarimbo — carimbo do hero de /hoje ('Última atualização')", () => {
  // agora = 2026-08-11 12:00 em SP (15:00 UTC)
  const agora = new Date(Date.UTC(2026, 7, 11, 15, 0, 0))

  it("mesmo dia em SP: 'Hoje, HH:MM'", () => {
    const iso = new Date(Date.UTC(2026, 7, 11, 11, 30, 0)).toISOString() // 08:30 SP
    expect(formatarCarimbo(iso, agora)).toBe("Hoje, 08:30")
  })
  it("dia anterior em SP: 'Ontem, HH:MM'", () => {
    const iso = new Date(Date.UTC(2026, 7, 10, 20, 0, 0)).toISOString() // 17:00 SP do dia 10
    expect(formatarCarimbo(iso, agora)).toBe("Ontem, 17:00")
  })
  it("mais de 2 dias: 'DD/MM, HH:MM'", () => {
    const iso = new Date(Date.UTC(2026, 7, 6, 12, 0, 0)).toISOString() // 09:00 SP do dia 06
    expect(formatarCarimbo(iso, agora)).toBe("06/08, 09:00")
  })
  it("virada de dia por fuso: madrugada UTC ainda é 'hoje' em SP (mesmo cuidado de horaSP)", () => {
    const agoraDeMadrugada = new Date(Date.UTC(2026, 7, 11, 2, 0, 0)) // 23:00 SP do dia 10
    const iso = new Date(Date.UTC(2026, 7, 11, 1, 30, 0)).toISOString() // 22:30 SP do dia 10 — mesmo dia em SP
    expect(formatarCarimbo(iso, agoraDeMadrugada)).toBe("Hoje, 22:30")
  })
})

import { describe, expect, it } from "vitest"
import { mediaHorasPorSemana, previsaoDias } from "./uso"

describe("mediaHorasPorSemana", () => {
  it("menos de duas leituras não tem média", () => {
    expect(mediaHorasPorSemana([])).toBeNull()
    expect(mediaHorasPorSemana([{ data: "2026-08-01", horas: 100 }])).toBeNull()
  })
  it("28 dias e 36 horas dão 9 h por semana", () => {
    expect(
      mediaHorasPorSemana([
        { data: "2026-07-05", horas: 1000 },
        { data: "2026-08-02", horas: 1036 },
      ]),
    ).toBeCloseTo(9, 2)
  })
  it("usa a leitura mais antiga e a mais nova, fora de ordem", () => {
    expect(
      mediaHorasPorSemana([
        { data: "2026-08-02", horas: 1036 },
        { data: "2026-07-19", horas: 1020 },
        { data: "2026-07-05", horas: 1000 },
      ]),
    ).toBeCloseTo(9, 2)
  })
  it("mesmo dia não divide por zero", () => {
    expect(
      mediaHorasPorSemana([
        { data: "2026-08-02", horas: 1000 },
        { data: "2026-08-02", horas: 1010 },
      ]),
    ).toBeNull()
  })
})

describe("previsaoDias", () => {
  it("37 horas a 9 h por semana dão ~29 dias", () => {
    expect(previsaoDias(37, 9)).toBe(29)
  })
  it("sem uso não há previsão", () => {
    expect(previsaoDias(37, 0)).toBeNull()
  })
  it("já vencido não projeta", () => {
    expect(previsaoDias(-5, 9)).toBe(0)
  })
})

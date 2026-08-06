import { describe, expect, it } from "vitest"
import { formatarReais, resumoGastos } from "./gastos"

describe("resumoGastos", () => {
  const entradas = [
    { data: "2026-08-02", custoCentavos: 185000, grupo: "Motores" },
    { data: "2026-08-01", custoCentavos: 78000, grupo: "Elétrica" },
    { data: "2026-07-19", custoCentavos: 235000, grupo: "Motores" },
    { data: "2026-02-10", custoCentavos: 99900, grupo: "Casco" }, // fora da janela de 6 meses
  ]
  const r = resumoGastos(entradas, "2026-08-06")

  it("total do mês atual", () => {
    expect(r.totalMesCentavos).toBe(263000)
  })
  it("quebra por grupo do mês atual, maior primeiro", () => {
    expect(r.porGrupo).toEqual([
      { grupo: "Motores", totalCentavos: 185000 },
      { grupo: "Elétrica", totalCentavos: 78000 },
    ])
  })
  it("janela de 6 meses em ordem cronológica, com zeros", () => {
    expect(r.meses).toHaveLength(6)
    expect(r.meses[0].mes).toBe("2026-03")
    expect(r.meses[5]).toMatchObject({ mes: "2026-08", totalCentavos: 263000 })
    expect(r.meses[4]).toMatchObject({ mes: "2026-07", totalCentavos: 235000 })
    expect(r.meses[1].totalCentavos).toBe(0)
  })
  it("rotulo curto pt-BR", () => {
    expect(r.meses[5].rotulo).toBe("ago")
  })
})

describe("formatarReais", () => {
  it("formata centavos como BRL", () => {
    expect(formatarReais(185000).replace(/\u00a0/g, " ")).toBe("R$ 1.850,00")
  })
})
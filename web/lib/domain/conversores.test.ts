import { describe, expect, it } from "vitest"
import { itemMonitoradoToItemCalc } from "./conversores"

describe("itemMonitoradoToItemCalc", () => {
  it("mapeia todos os campos snake_case para camelCase", () => {
    expect(
      itemMonitoradoToItemCalc({
        id: "i1", embarcacao_id: "e1", equipamento_id: "q1",
        nome: "Revisão geral", especificacao: null, quantidade: null, categoria: null,
        intervalo_horas: 500, intervalo_meses: 12, data_fixa: "2027-03-12",
        ultimo_ciclo_data: "2026-07-19", ultimo_ciclo_horas: 1000,
        created_at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      intervaloHoras: 500, intervaloMeses: 12, dataFixa: "2027-03-12",
      ultimoCicloData: "2026-07-19", ultimoCicloHoras: 1000,
    })
  })
  it("preserva nulls", () => {
    expect(
      itemMonitoradoToItemCalc({
        id: "i2", embarcacao_id: "e1", equipamento_id: null,
        nome: "Seguro", especificacao: null, quantidade: null, categoria: null, intervalo_horas: null, intervalo_meses: null,
        data_fixa: "2026-08-17", ultimo_ciclo_data: null, ultimo_ciclo_horas: null,
        created_at: "2026-01-01T00:00:00Z",
      }).dataFixa,
    ).toBe("2026-08-17")
  })
})

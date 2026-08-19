import { describe, expect, it } from "vitest"
import type { ItemMonitorado } from "@/lib/db/types"
import { itemMonitoradoToItemCalc } from "./conversores"

describe("itemMonitoradoToItemCalc", () => {
  it("mapeia todos os campos snake_case para camelCase — a linha COMPLETA do banco continua entrando", () => {
    // Tipada como `ItemMonitorado` de propósito (onda 60): o parâmetro virou
    // o subconjunto que a conversão lê, e este teste prova que a linha
    // inteira segue passando por estrutura, sem cast.
    const linha: ItemMonitorado = {
      id: "i1", embarcacao_id: "e1", equipamento_id: "q1",
      nome: "Revisão geral", especificacao: null, quantidade: null, categoria: null,
      intervalo_horas: 500, intervalo_meses: 12, data_fixa: "2027-03-12",
      ultimo_ciclo_data: "2026-07-19", ultimo_ciclo_horas: 1000, part_number_oem: null, motor_componente_id: null,
      created_at: "2026-01-01T00:00:00Z",
    }
    expect(itemMonitoradoToItemCalc(linha)).toEqual({
      intervaloHoras: 500, intervaloMeses: 12, dataFixa: "2027-03-12",
      ultimoCicloData: "2026-07-19", ultimoCicloHoras: 1000,
    })
  })
  it("preserva nulls — e aceita só os cinco campos que lê", () => {
    expect(
      itemMonitoradoToItemCalc({
        intervalo_horas: null, intervalo_meses: null,
        data_fixa: "2026-08-17", ultimo_ciclo_data: null, ultimo_ciclo_horas: null,
      }).dataFixa,
    ).toBe("2026-08-17")
  })
})

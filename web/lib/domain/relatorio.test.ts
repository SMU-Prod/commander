import { describe, expect, it } from "vitest"
import { mesAnteriorISO, resumoDoMes } from "./relatorio"
import type { Equipamento, Evento, ItemMonitorado } from "@/lib/db/types"

const eq = (extra: Partial<Equipamento>): Equipamento => ({
  id: "e1", embarcacao_id: "b1", tipo: "motor", posicao: "BB", marca: null, modelo: null,
  numero_serie: null, ano: null, potencia_hp: null, combustivel: null, identificacao_interna: null,
  quantidade: null, foto_path: null, observacoes: null, horas_atuais: 100, ultima_leitura: null,
  created_at: "2026-01-01", ...extra,
})
const ev = (extra: Partial<Evento>): Evento => ({
  id: "v1", embarcacao_id: "b1", equipamento_id: null, item_monitorado_id: null, contato_id: null,
  tipo: "manutencao", categoria: null, data: "2026-08-10", horas_no_momento: null, descricao: "t",
  custo_centavos: null, anexo_path: null, trilha: null, tem_trilha: false, criado_por: "u1",
  hora_saida: null, hora_retorno: null, destino: null, tripulacao: [], mar_onda_m: null, mar_vento_kt: null,
  checklist: null, importado_do_plotter: false, trilha_sem_horario: false, origem_hash: null,
  created_at: "2026-08-10", ...extra,
})

describe("resumoDoMes", () => {
  it("soma horas de motor pelo delta das leituras do mes, por equipamento", () => {
    const eventos = [
      ev({ id: "a", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 100, data: "2026-08-02" }),
      ev({ id: "b", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 112, data: "2026-08-20" }),
      ev({ id: "c", tipo: "leitura_horas", equipamento_id: "e2", horas_no_momento: 50, data: "2026-08-05" }),
      ev({ id: "d", tipo: "leitura_horas", equipamento_id: "e2", horas_no_momento: 57, data: "2026-08-25" }),
    ]
    const r = resumoDoMes({ eventos, itens: [], equipamentos: [eq({}), eq({ id: "e2", posicao: "BE" })] }, "2026-08")
    expect(r.horasMotor).toBe(19) // 12 do BB + 7 do BE
  })

  it("leituras fora de ordem cronologica ainda geram o delta certo", () => {
    const eventos = [
      ev({ id: "b", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 112, data: "2026-08-20" }),
      ev({ id: "a", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 100, data: "2026-08-02" }),
    ]
    const r = resumoDoMes({ eventos, itens: [], equipamentos: [eq({})] }, "2026-08")
    expect(r.horasMotor).toBe(12)
  })

  it("uma leitura so no mes nao gera delta", () => {
    const eventos = [ev({ tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 100 })]
    expect(resumoDoMes({ eventos, itens: [], equipamentos: [eq({})] }, "2026-08").horasMotor).toBe(0)
  })

  it("ignora eventos fora do mes e soma so os gastos do mes", () => {
    const eventos = [
      ev({ id: "a", custo_centavos: 100000, data: "2026-08-15" }),
      ev({ id: "b", custo_centavos: 50000, data: "2026-07-30" }),
    ]
    const r = resumoDoMes({ eventos, itens: [], equipamentos: [] }, "2026-08")
    expect(r.totalGastosCentavos).toBe(100000)
  })

  it("conta saidas (eventos de tipo navegacao) do mes", () => {
    const eventos = [
      ev({ id: "a", tipo: "navegacao", data: "2026-08-08" }),
      ev({ id: "b", tipo: "navegacao", data: "2026-08-22" }),
      ev({ id: "c", tipo: "navegacao", data: "2026-07-01" }),
    ]
    expect(resumoDoMes({ eventos, itens: [], equipamentos: [] }, "2026-08").saidas).toBe(2)
  })

  it("lista itens que vencem no mes seguinte, por data", () => {
    const item: ItemMonitorado = {
      id: "i1", embarcacao_id: "b1", equipamento_id: null, nome: "Seguro casco", especificacao: null,
      quantidade: null, categoria: "documento", intervalo_horas: null, intervalo_meses: null,
      data_fixa: "2026-09-12", ultimo_ciclo_data: null, ultimo_ciclo_horas: null, created_at: "2026-01-01",
    }
    const r = resumoDoMes({ eventos: [], itens: [item], equipamentos: [] }, "2026-08")
    expect(r.aVencer).toEqual([{ nome: "Seguro casco", quando: "2026-09-12" }])
  })
  it("item sem data fixa vence por ultimo ciclo + intervalo em meses, como no farol", () => {
    const item: ItemMonitorado = {
      id: "i2", embarcacao_id: "b1", equipamento_id: null, nome: "Revisão do guincho", especificacao: null,
      quantidade: null, categoria: "deck", intervalo_horas: null, intervalo_meses: 6,
      data_fixa: null, ultimo_ciclo_data: "2026-03-12", ultimo_ciclo_horas: null, created_at: "2026-01-01",
    }
    const r = resumoDoMes({ eventos: [], itens: [item], equipamentos: [] }, "2026-08")
    expect(r.aVencer).toEqual([{ nome: "Revisão do guincho", quando: "2026-09-12" }])
  })
})

describe("mesAnteriorISO", () => {
  it("mes anterior de agosto e julho, mesmo ano", () => {
    expect(mesAnteriorISO("2026-08-15")).toBe("2026-07")
  })

  it("virada de ano: relatorio de janeiro cobre dezembro do ano anterior", () => {
    expect(mesAnteriorISO("2026-01-05")).toBe("2025-12")
  })
})

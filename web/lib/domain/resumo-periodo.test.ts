import { describe, expect, it } from "vitest"
import {
  custoPorHoraCentavos,
  gastosPorGrupoComBarra,
  mediaMensalGastosCentavos,
  mesesDoPeriodo,
  montarResumoPeriodo,
  opcoesAnuais,
  opcoesMensais,
  opcoesSemestrais,
  periodoSemAtividade,
  rotuloPeriodo,
} from "./resumo-periodo"
import type { Equipamento, Evento, ItemMonitorado } from "@/lib/db/types"

const eq = (extra: Partial<Equipamento>): Equipamento => ({
  id: "e1", embarcacao_id: "b1", tipo: "motor", posicao: "BB", marca: null, modelo: null,
  numero_serie: null, ano: null, potencia_hp: null, combustivel: null, identificacao_interna: null,
  quantidade: null, foto_path: null, observacoes: null, tipo_bateria: null, zona: null, motor_modelo_id: null, horas_atuais: 100, ultima_leitura: null,
  created_at: "2026-01-01", ...extra,
})
const ev = (extra: Partial<Evento>): Evento => ({
  id: "v1", embarcacao_id: "b1", equipamento_id: null, item_monitorado_id: null, contato_id: null,
  tipo: "manutencao", categoria: null, data: "2026-08-10", horas_no_momento: null, descricao: "t",
  custo_centavos: null, anexo_path: null, trilha: null, tem_trilha: false, criado_por: "u1",
  hora_saida: null, hora_retorno: null, local_saida: null, destino: null, tripulacao: [], passageiros: [], mar_onda_m: null, mar_vento_kt: null,
  // checklist chegou na onda 40 (merge paralelo com esta onda 37) — null é o
  // valor honesto do auxiliar: "ninguém tocou o checklist nesta saída".
  checklist: null,
  importado_do_plotter: false, trilha_sem_horario: false, origem_hash: null,
  created_at: "2026-08-10", ...extra,
})
const item = (extra: Partial<ItemMonitorado>): ItemMonitorado => ({
  id: "i1", embarcacao_id: "b1", equipamento_id: null, nome: "Item", especificacao: null,
  quantidade: null, categoria: "deck", intervalo_horas: null, intervalo_meses: null,
  data_fixa: null, ultimo_ciclo_data: null, ultimo_ciclo_horas: null, part_number_oem: null, motor_componente_id: null, created_at: "2026-01-01", ...extra,
})

describe("mesesDoPeriodo", () => {
  it("mensal: um mes so", () => {
    expect(mesesDoPeriodo("mensal", "2026-07", "2026-08-14")).toEqual(["2026-07"])
  })

  it("semestral: 6 meses a partir de janeiro ou julho", () => {
    expect(mesesDoPeriodo("semestral", "2026-S1", "2026-12-31")).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    ])
    expect(mesesDoPeriodo("semestral", "2025-S2", "2026-12-31")).toEqual([
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    ])
  })

  it("anual: 12 meses do ano", () => {
    expect(mesesDoPeriodo("anual", "2025", "2026-12-31")).toHaveLength(12)
    expect(mesesDoPeriodo("anual", "2025", "2026-12-31")[0]).toBe("2025-01")
    expect(mesesDoPeriodo("anual", "2025", "2026-12-31")[11]).toBe("2025-12")
  })

  it("periodo em andamento corta em hoje — nunca inclui mes futuro", () => {
    expect(mesesDoPeriodo("anual", "2026", "2026-08-14")).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ])
    expect(mesesDoPeriodo("semestral", "2026-S2", "2026-08-14")).toEqual(["2026-07", "2026-08"])
  })

  it("periodo inteiramente futuro nao devolve mes nenhum", () => {
    expect(mesesDoPeriodo("mensal", "2027-01", "2026-08-14")).toEqual([])
  })
})

describe("rotuloPeriodo e opcoes*", () => {
  it("rotula cada tipo de periodo", () => {
    expect(rotuloPeriodo("mensal", "2026-07")).toBe("Julho de 2026")
    expect(rotuloPeriodo("semestral", "2026-S1")).toBe("1º semestre de 2026")
    expect(rotuloPeriodo("anual", "2026")).toBe("2026")
  })

  it("opcoesMensais comeca no mes atual e anda pro passado", () => {
    const op = opcoesMensais("2026-08-14", 3)
    expect(op.map((o) => o.chave)).toEqual(["2026-08", "2026-07", "2026-06"])
  })

  it("opcoesSemestrais comeca no semestre atual e anda pro passado", () => {
    const op = opcoesSemestrais("2026-08-14", 3)
    expect(op.map((o) => o.chave)).toEqual(["2026-S2", "2026-S1", "2025-S2"])
  })

  it("opcoesAnuais comeca no ano atual e anda pro passado", () => {
    const op = opcoesAnuais("2026-08-14", 3)
    expect(op.map((o) => o.chave)).toEqual(["2026", "2025", "2024"])
  })
})

describe("montarResumoPeriodo", () => {
  it("soma horas/gastos/saidas mes a mes reaproveitando resumoDoMes, sem recalcular por fora", () => {
    const eventos = [
      ev({ id: "a", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 100, data: "2026-07-02" }),
      ev({ id: "b", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 112, data: "2026-07-20" }),
      ev({ id: "c", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 112, data: "2026-08-01" }),
      ev({ id: "d", tipo: "leitura_horas", equipamento_id: "e1", horas_no_momento: 130, data: "2026-08-25" }),
      ev({ id: "e", tipo: "navegacao", data: "2026-07-10", custo_centavos: 20000 }),
      ev({ id: "f", tipo: "navegacao", data: "2026-08-05", custo_centavos: 30000 }),
    ]
    const r = montarResumoPeriodo(
      { eventos, itens: [], equipamentos: [eq({})], ocorrencias: [] },
      { tipo: "semestral", chave: "2026-S2" },
      "2026-08-14",
    )
    expect(r.meses).toEqual(["2026-07", "2026-08"])
    expect(r.horasMotor).toBe(12 + 18)
    expect(r.saidas).toBe(2)
    expect(r.totalGastosCentavos).toBe(50000)
    expect(r.evolucaoMensal).toHaveLength(2)
    expect(r.evolucaoMensal[0]).toMatchObject({ mes: "2026-07", horasMotor: 12, saidas: 1 })
    expect(r.evolucaoMensal[1]).toMatchObject({ mes: "2026-08", horasMotor: 18, saidas: 1 })
  })

  it("conta manutencoes, abastecimentos e diario total dentro da janela do periodo", () => {
    const eventos = [
      ev({ id: "a", tipo: "manutencao", data: "2026-07-05" }),
      ev({ id: "b", tipo: "manutencao", data: "2026-06-30" }), // fora do periodo
      ev({ id: "c", tipo: "abastecimento", data: "2026-07-15", custo_centavos: 40000 }),
      ev({ id: "d", tipo: "docagem", data: "2026-07-20" }),
    ]
    const r = montarResumoPeriodo(
      { eventos, itens: [], equipamentos: [], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(r.manutencoesRealizadas).toBe(1)
    expect(r.abastecimentos).toEqual({ quantidade: 1, totalCentavos: 40000 })
    expect(r.totalDiario).toBe(3) // manutencao + abastecimento + docagem do mes de julho
  })

  it("agrupa gastos por hub reaproveitando grupoDoEvento", () => {
    const eventos = [
      ev({ id: "a", tipo: "manutencao", equipamento_id: "e1", data: "2026-07-05", custo_centavos: 10000 }),
      ev({ id: "b", tipo: "abastecimento", data: "2026-07-06", custo_centavos: 5000 }),
    ]
    const r = montarResumoPeriodo(
      { eventos, itens: [], equipamentos: [eq({})], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(r.gastosPorGrupo).toEqual(
      expect.arrayContaining([
        { grupo: "Motores", totalCentavos: 10000 },
        { grupo: "Geral", totalCentavos: 5000 },
      ]),
    )
  })

  it("conta ocorrencias abertas e resolvidas dentro do periodo, nao pelo estado atual", () => {
    const r = montarResumoPeriodo(
      {
        eventos: [], itens: [], equipamentos: [],
        ocorrencias: [
          { estado: "resolvida", created_at: "2026-07-05T10:00:00Z", resolvida_em: "2026-07-20T10:00:00Z" },
          { estado: "aberta", created_at: "2026-07-10T10:00:00Z", resolvida_em: null },
          { estado: "resolvida", created_at: "2026-06-01T10:00:00Z", resolvida_em: "2026-06-10T10:00:00Z" }, // fora
        ],
      },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(r.ocorrenciasAbertasNoPeriodo).toBe(2)
    expect(r.ocorrenciasResolvidasNoPeriodo).toBe(1)
  })

  it("aVencer reaproveita a mesma lista que resumoDoMes calcula pro mes seguinte ao fim do periodo", () => {
    const itens = [item({ id: "i1", nome: "Seguro", categoria: "documento", data_fixa: "2026-08-12" })]
    const r = montarResumoPeriodo(
      { eventos: [], itens, equipamentos: [], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(r.aVencer).toEqual([{ nome: "Seguro", quando: "2026-08-12" }])
  })

  it("classifica os hubs pelo farol atual, contando item sem informacao suficiente a parte", () => {
    const itens = [
      item({ id: "i1", nome: "Deck ok", categoria: "deck", intervalo_meses: 12, ultimo_ciclo_data: "2026-08-01" }),
      item({ id: "i2", nome: "Sem regra", categoria: "seguranca" }), // sem intervalo/data — sem informacao
    ]
    const r = montarResumoPeriodo(
      { eventos: [], itens, equipamentos: [], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    const casco = r.hubs.find((h) => h.aba === "casco")!
    const seguranca = r.hubs.find((h) => h.aba === "seguranca")!
    expect(casco).toMatchObject({ total: 1, ok: 1, atencao: 0, vencido: 0, semInformacao: 0 })
    expect(seguranca).toMatchObject({ total: 1, ok: 0, semInformacao: 1 })
  })

  it("periodoSemAtividade e honesto: so fica true quando nada aconteceu no periodo", () => {
    const vazio = montarResumoPeriodo(
      { eventos: [], itens: [], equipamentos: [], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(periodoSemAtividade(vazio)).toBe(true)

    const comSaida = montarResumoPeriodo(
      { eventos: [ev({ tipo: "navegacao", data: "2026-07-10" })], itens: [], equipamentos: [], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(periodoSemAtividade(comSaida)).toBe(false)
  })

  it("hubs sao um retrato de hoje, independente de o periodo estar vazio", () => {
    const itens = [item({ id: "i1", nome: "Deck", categoria: "deck", intervalo_meses: 12, ultimo_ciclo_data: "2026-08-01" })]
    const r = montarResumoPeriodo(
      { eventos: [], itens, equipamentos: [], ocorrencias: [] },
      { tipo: "mensal", chave: "2026-07" },
      "2026-08-14",
    )
    expect(periodoSemAtividade(r)).toBe(true)
    expect(r.hubs.find((h) => h.aba === "casco")?.total).toBe(1)
  })
})

// --- onda 62 (canvas tela-1g): as réguas do relatório de custo -------------

describe("custoPorHoraCentavos", () => {
  it("divide o gasto pelas horas de motor do período", () => {
    expect(custoPorHoraCentavos(1_824_000, 96)).toBe(19_000)
  })
  it("sem hora de motor devolve null — 'R$ 0/h' afirmaria que navegar é de graça", () => {
    expect(custoPorHoraCentavos(1_824_000, 0)).toBeNull()
  })
  it("sem gasto devolve null — não há custo pra ratear", () => {
    expect(custoPorHoraCentavos(0, 96)).toBeNull()
  })
})

describe("mediaMensalGastosCentavos", () => {
  it("total dividido pelos meses já decorridos", () => {
    expect(mediaMensalGastosCentavos({ totalGastosCentavos: 1_200_00, meses: ["2026-01", "2026-02", "2026-03"] })).toBe(400_00)
  })
  it("um mês só (ou nenhum) devolve null — média de um número é o próprio número", () => {
    expect(mediaMensalGastosCentavos({ totalGastosCentavos: 500_00, meses: ["2026-08"] })).toBeNull()
    expect(mediaMensalGastosCentavos({ totalGastosCentavos: 0, meses: [] })).toBeNull()
  })
})

describe("gastosPorGrupoComBarra", () => {
  it("a barra é relativa ao MAIOR grupo, não ao total (o maior = 100)", () => {
    const barras = gastosPorGrupoComBarra([
      { grupo: "Combustível", totalCentavos: 812_000 },
      { grupo: "Marina", totalCentavos: 406_000 },
    ])
    expect(barras[0].percentual).toBe(100)
    expect(barras[1].percentual).toBe(50)
  })
  it("tudo zerado fica com barra zero, sem divisão por zero", () => {
    expect(gastosPorGrupoComBarra([{ grupo: "x", totalCentavos: 0 }])[0].percentual).toBe(0)
  })
  it("lista vazia continua vazia", () => {
    expect(gastosPorGrupoComBarra([])).toEqual([])
  })
})

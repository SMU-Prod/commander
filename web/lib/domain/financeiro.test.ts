import { describe, expect, it } from "vitest"
import {
  CATEGORIAS_FINANCEIRAS,
  categoriaFinanceiraDoEvento,
  compararPeriodos,
  mesesNoPeriodo,
  periodoAnterior,
  periodoAnual,
  periodoMensal,
  periodoPersonalizado,
  proximoVencimento,
  resumoFinanceiro,
  rotuloStatus,
  validarLancamento,
  validarRecorrente,
  vencimento,
  vencimentosNoIntervalo,
  type LancamentoParaResumo,
} from "./financeiro"

const base = {
  tipo: "despesa" as const,
  categoria: "combustivel" as const,
  status: "pago" as const,
  recorrente: false,
}

function l(p: Partial<LancamentoParaResumo> & { valorCentavos: number; data: string }): LancamentoParaResumo {
  return { ...base, ...p }
}

describe("categorias e rótulos", () => {
  it("tem as 10 categorias do PRD §9.1", () => {
    expect(CATEGORIAS_FINANCEIRAS).toHaveLength(10)
    expect(CATEGORIAS_FINANCEIRAS).toContain("marina_vaga")
    expect(CATEGORIAS_FINANCEIRAS).toContain("documentacao_taxas")
  })
  it("o mesmo status muda de nome conforme o dinheiro sai ou entra", () => {
    expect(rotuloStatus("despesa", "pago")).toBe("Pago")
    expect(rotuloStatus("entrada", "pago")).toBe("Recebido")
    expect(rotuloStatus("despesa", "pendente")).toBe("Pendente")
    expect(rotuloStatus("entrada", "pendente")).toBe("Pendente")
  })
})

describe("vencimentos de série recorrente", () => {
  it("semanal anda de 7 em 7 dias", () => {
    expect(vencimento("2026-08-03", "semanal", 0)).toBe("2026-08-03")
    expect(vencimento("2026-08-03", "semanal", 3)).toBe("2026-08-24")
  })
  it("mensal/trimestral/semestral/anual andam pelo calendário", () => {
    expect(vencimento("2026-01-10", "mensal", 2)).toBe("2026-03-10")
    expect(vencimento("2026-01-10", "trimestral", 2)).toBe("2026-07-10")
    expect(vencimento("2026-01-10", "semestral", 1)).toBe("2026-07-10")
    expect(vencimento("2026-01-10", "anual", 1)).toBe("2027-01-10")
  })
  it("dia 31 gruda no último dia do mês curto e VOLTA a ser 31 no mês seguinte", () => {
    // O caso que quebra quem encadeia o cálculo a partir do vencimento
    // anterior: fevereiro comeria o dia 31 da série inteira.
    expect(vencimento("2026-01-31", "mensal", 1)).toBe("2026-02-28")
    expect(vencimento("2026-01-31", "mensal", 2)).toBe("2026-03-31")
    expect(vencimento("2028-01-31", "mensal", 1)).toBe("2028-02-29")
  })
  it("lista só o que cai dentro do intervalo e respeita o fim da série", () => {
    const serie = { inicio: "2026-01-10", fim: null, frequencia: "mensal" as const }
    expect(vencimentosNoIntervalo(serie, "2026-03-01", "2026-05-31"))
      .toEqual(["2026-03-10", "2026-04-10", "2026-05-10"])
    expect(vencimentosNoIntervalo({ ...serie, fim: "2026-04-30" }, "2026-01-01", "2026-12-31"))
      .toEqual(["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10"])
  })
  it("próximo vencimento é null quando a série já acabou", () => {
    const serie = { inicio: "2026-01-10", fim: "2026-03-31", frequencia: "mensal" as const }
    expect(proximoVencimento(serie, "2026-02-15")).toBe("2026-03-10")
    expect(proximoVencimento(serie, "2026-04-01")).toBeNull()
  })
})

describe("períodos", () => {
  it("mensal cobre o mês inteiro, inclusive fevereiro bissexto", () => {
    expect(periodoMensal(2026, 2)).toMatchObject({ de: "2026-02-01", ate: "2026-02-28" })
    expect(periodoMensal(2028, 2).ate).toBe("2028-02-29")
    expect(periodoMensal(2026, 8).rotulo).toBe("Agosto de 2026")
  })
  it("anterior de mês é mês, e vira dezembro do ano passado em janeiro", () => {
    expect(periodoAnterior(periodoMensal(2026, 8))).toMatchObject({ de: "2026-07-01", ate: "2026-07-31" })
    expect(periodoAnterior(periodoMensal(2026, 1))).toMatchObject({ de: "2025-12-01", ate: "2025-12-31" })
  })
  it("anterior de ano é o ano anterior inteiro", () => {
    expect(periodoAnterior(periodoAnual(2026))).toMatchObject({ de: "2025-01-01", ate: "2025-12-31" })
  })
  it("anterior de período livre é a mesma quantidade de dias, colada antes", () => {
    // 10 dias (01 a 10) → os 10 dias anteriores (22/07 a 31/07)
    expect(periodoAnterior(periodoPersonalizado("2026-08-01", "2026-08-10")))
      .toMatchObject({ de: "2026-07-22", ate: "2026-07-31" })
  })
  it("conta meses cobertos, nunca zero", () => {
    expect(mesesNoPeriodo(periodoMensal(2026, 8))).toBe(1)
    expect(mesesNoPeriodo(periodoAnual(2026))).toBe(12)
    expect(mesesNoPeriodo(periodoPersonalizado("2026-08-05", "2026-08-06"))).toBe(1)
  })
})

describe("resumo do período", () => {
  const periodo = periodoMensal(2026, 8)
  const lancamentos = [
    l({ valorCentavos: 100_00, data: "2026-08-02" }),
    l({ valorCentavos: 250_00, data: "2026-08-10", categoria: "marina_vaga", recorrente: true }),
    l({ valorCentavos: 900_00, data: "2026-08-15", tipo: "entrada", categoria: "outros" }),
    l({ valorCentavos: 500_00, data: "2026-08-20", status: "pendente", categoria: "seguro" }),
    l({ valorCentavos: 999_00, data: "2026-07-31" }), // fora do período
  ]

  it("soma só o que caiu dentro do período", () => {
    const r = resumoFinanceiro(lancamentos, periodo)
    expect(r.totalLancamentos).toBe(4)
  })
  it("pendente não vira dinheiro gasto — vira 'a pagar'", () => {
    const r = resumoFinanceiro(lancamentos, periodo)
    expect(r.despesasCentavos).toBe(350_00)
    expect(r.aPagarCentavos).toBe(500_00)
    expect(r.entradasCentavos).toBe(900_00)
    expect(r.saldoCentavos).toBe(550_00)
  })
  it("separa recorrentes de variáveis (PRD §9.3)", () => {
    const r = resumoFinanceiro(lancamentos, periodo)
    expect(r.recorrentesCentavos).toBe(250_00)
    expect(r.variaveisCentavos).toBe(100_00)
    expect(r.recorrentesCentavos + r.variaveisCentavos).toBe(r.despesasCentavos)
  })
  it("maior categoria é a de maior DESPESA, nunca uma que só teve entrada", () => {
    const r = resumoFinanceiro(lancamentos, periodo)
    expect(r.maiorCategoria?.categoria).toBe("marina_vaga")
  })
  it("sem despesa no período, não existe maior categoria", () => {
    const r = resumoFinanceiro([l({ valorCentavos: 10_00, data: "2026-08-01", tipo: "entrada" })], periodo)
    expect(r.maiorCategoria).toBeNull()
    expect(r.mediaMensalDespesasCentavos).toBe(0)
  })
  it("média mensal divide pelos meses do período, não pelo número de lançamentos", () => {
    const anual = resumoFinanceiro(
      [l({ valorCentavos: 1200_00, data: "2026-03-01" })],
      periodoAnual(2026),
    )
    expect(anual.mediaMensalDespesasCentavos).toBe(100_00)
  })
})

describe("comparação entre períodos", () => {
  const agosto = resumoFinanceiro([{ ...base, valorCentavos: 150_00, data: "2026-08-01" }], periodoMensal(2026, 8))
  const julho = resumoFinanceiro([{ ...base, valorCentavos: 100_00, data: "2026-07-01" }], periodoMensal(2026, 7))

  it("mostra percentual e diferença quando os dois lados têm valor", () => {
    const c = compararPeriodos(agosto, julho)
    expect(c.despesasPercentual).toBe(50)
    expect(c.despesasDiferencaCentavos).toBe(50_00)
  })
  it("não inventa percentual contra período vazio", () => {
    const vazio = resumoFinanceiro([], periodoMensal(2026, 7))
    expect(compararPeriodos(agosto, vazio).despesasPercentual).toBeNull()
    expect(compararPeriodos(agosto, vazio).despesasDiferencaCentavos).toBe(150_00)
  })
})

describe("categoria vinda de um evento do Diário", () => {
  it("usa o que o evento já diz de si — e cai em Outros quando não diz nada", () => {
    expect(categoriaFinanceiraDoEvento({ tipo: "abastecimento", categoria: null })).toBe("combustivel")
    expect(categoriaFinanceiraDoEvento({ tipo: "manutencao", categoria: null })).toBe("manutencao")
    expect(categoriaFinanceiraDoEvento({ tipo: "docagem", categoria: null })).toBe("manutencao")
    expect(categoriaFinanceiraDoEvento({ tipo: "outro", categoria: "documento" })).toBe("documentacao_taxas")
    expect(categoriaFinanceiraDoEvento({ tipo: "outro", categoria: "fibra" })).toBe("limpeza_conservacao")
    expect(categoriaFinanceiraDoEvento({ tipo: "outro", categoria: "motor_filtro_ar" })).toBe("manutencao")
    expect(categoriaFinanceiraDoEvento({ tipo: "outro", categoria: null })).toBe("outros")
  })
  it("a categoria do evento manda mais que o tipo (item de casco num evento de manutenção)", () => {
    expect(categoriaFinanceiraDoEvento({ tipo: "manutencao", categoria: "deck" })).toBe("limpeza_conservacao")
  })
})

describe("validação", () => {
  const bom = {
    tipo: "despesa", descricao: "Vaga de agosto", categoria: "marina_vaga",
    valorCentavos: 120_000, data: "2026-08-01",
  }
  it("aceita lançamento completo", () => {
    expect(validarLancamento(bom)).toEqual({ ok: true })
  })
  it("recusa sem descrição, sem categoria, com valor zero e sem data", () => {
    expect(validarLancamento({ ...bom, descricao: "  " }).ok).toBe(false)
    expect(validarLancamento({ ...bom, categoria: "combustivel_inexistente" }).ok).toBe(false)
    expect(validarLancamento({ ...bom, valorCentavos: 0 }).ok).toBe(false)
    expect(validarLancamento({ ...bom, data: null }).ok).toBe(false)
    expect(validarLancamento({ ...bom, tipo: "orcamento" }).ok).toBe(false)
  })
  it("recorrente exige frequência válida e fim depois do início", () => {
    expect(validarRecorrente({ ...bom, frequencia: "mensal", fim: null })).toEqual({ ok: true })
    expect(validarRecorrente({ ...bom, frequencia: "quinzenal", fim: null }).ok).toBe(false)
    expect(validarRecorrente({ ...bom, frequencia: "mensal", fim: "2026-07-01" }).ok).toBe(false)
  })
})

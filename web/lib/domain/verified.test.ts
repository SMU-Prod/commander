import { describe, expect, it } from "vitest"
import {
  avaliarSeloVerified,
  avaliarVerified,
  DIAS_REGULARIZACAO_VERIFIED,
  PILARES_VERIFIED,
  textoPrazoVerified,
  type DadosVerified,
  type EstadoVerifiedGravado,
} from "./verified"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"

const HOJE = "2026-08-08"

function motor(horas: number | null): Equipamento {
  return {
    id: "m1", embarcacao_id: "b1", tipo: "motor", posicao: "central", marca: null, modelo: null,
    numero_serie: null, ano: null, potencia_hp: null, combustivel: null, identificacao_interna: null,
    quantidade: null, foto_path: null, observacoes: null, tipo_bateria: null, zona: null, motor_modelo_id: null, horas_atuais: horas, ultima_leitura: null,
    created_at: "2026-01-01",
  }
}

function itemOk(id: string): ItemMonitorado {
  return {
    id, embarcacao_id: "b1", equipamento_id: null, nome: `Item ${id}`, especificacao: null,
    quantidade: null, categoria: null, intervalo_horas: null, intervalo_meses: null,
    data_fixa: null, ultimo_ciclo_data: null, ultimo_ciclo_horas: null, part_number_oem: null, motor_componente_id: null, created_at: "2026-01-01",
  }
}

function itemVencido(id: string): ItemMonitorado {
  return { ...itemOk(id), data_fixa: "2020-01-01" }
}

function itemSeguranca(id: string): ItemMonitorado {
  return { ...itemOk(id), categoria: "seguranca" }
}

function documentoFuturo(id: string): ItemMonitorado {
  return { ...itemOk(id), categoria: "documento", data_fixa: "2027-01-01" }
}

function documentoVencido(id: string): ItemMonitorado {
  return { ...itemOk(id), categoria: "documento", data_fixa: "2020-01-01" }
}

const baseVazia: DadosVerified = {
  equipamentos: [],
  itens: [],
  hoje: HOJE,
  totalEventosDiario: 0,
}

const baseCompleta: DadosVerified = {
  equipamentos: [motor(120)],
  itens: [itemOk("i1"), itemSeguranca("s1"), documentoFuturo("d1"), documentoFuturo("d2"), documentoFuturo("d3")],
  hoje: HOJE,
  totalEventosDiario: 6,
}

const pilar = (r: ReturnType<typeof avaliarVerified>, chave: string) => r.itens.find((i) => i.chave === chave)!

describe("avaliarVerified — os cinco pilares do PRD §15", () => {
  it("são exatamente os cinco do PRD, nessa ordem, sem nenhum a mais", () => {
    expect(PILARES_VERIFIED).toEqual(["motores", "manutencoes", "seguranca", "documentacao", "historico"])
    expect(avaliarVerified(baseVazia).itens.map((i) => i.chave)).toEqual([...PILARES_VERIFIED])
  })

  it("não expõe percentual — o PRD proíbe porcentagem no selo", () => {
    expect(avaliarVerified(baseCompleta)).not.toHaveProperty("percentual")
  })

  it("barco vazio: nenhum pilar atendido, todos listados como pendentes", () => {
    const r = avaliarVerified(baseVazia)
    expect(r.completos).toBe(0)
    expect(r.atendidos).toEqual([])
    expect(r.pendentes).toHaveLength(r.total)
  })

  it("barco completo: os cinco pilares atendidos, nada pendente", () => {
    const r = avaliarVerified(baseCompleta)
    expect(r.completos).toBe(r.total)
    expect(r.pendentes).toEqual([])
  })

  it("motores: exige horímetro — motor cadastrado sem leitura não conta", () => {
    expect(pilar(avaliarVerified({ ...baseVazia, equipamentos: [motor(50)] }), "motores").ok).toBe(true)
    expect(pilar(avaliarVerified({ ...baseVazia, equipamentos: [motor(null)] }), "motores").ok).toBe(false)
  })

  it("manutenções: sem nenhuma cadastrada não conta (barco vazio não passa por omissão)", () => {
    expect(pilar(avaliarVerified(baseVazia), "manutencoes").ok).toBe(false)
  })

  it("manutenções: uma manutenção em dia basta; uma vencida derruba", () => {
    expect(pilar(avaliarVerified({ ...baseVazia, itens: [itemOk("i1")] }), "manutencoes").ok).toBe(true)
    expect(pilar(avaliarVerified({ ...baseVazia, itens: [itemOk("i1"), itemVencido("i2")] }), "manutencoes").ok).toBe(false)
  })

  it("manutenções: vencimento por horas usa o equipamento vinculado ao item", () => {
    const eq = motor(1000)
    const item: ItemMonitorado = { ...itemOk("i1"), equipamento_id: eq.id, intervalo_horas: 500, ultimo_ciclo_horas: 400 }
    expect(pilar(avaliarVerified({ ...baseVazia, equipamentos: [eq], itens: [item] }), "manutencoes").ok).toBe(false)
  })

  it("manutenções: documento vencido NÃO derruba este pilar — documentação tem pilar próprio", () => {
    const r = avaliarVerified({ ...baseVazia, itens: [itemOk("i1"), documentoVencido("d1")] })
    expect(pilar(r, "manutencoes").ok).toBe(true)
    expect(pilar(r, "documentacao").ok).toBe(false)
  })

  it("segurança: basta um item da categoria cadastrado", () => {
    expect(pilar(avaliarVerified({ ...baseVazia, itens: [itemSeguranca("s1")] }), "seguranca").ok).toBe(true)
    expect(pilar(avaliarVerified({ ...baseVazia, itens: [itemOk("i1")] }), "seguranca").ok).toBe(false)
  })

  it("documentação: 3 com validade futura contam, 2 não bastam", () => {
    const tres = [documentoFuturo("d1"), documentoFuturo("d2"), documentoFuturo("d3")]
    expect(pilar(avaliarVerified({ ...baseVazia, itens: tres }), "documentacao").ok).toBe(true)
    expect(pilar(avaliarVerified({ ...baseVazia, itens: tres.slice(0, 2) }), "documentacao").ok).toBe(false)
  })

  it("documentação: um documento vencido derruba mesmo com 3 válidos", () => {
    const r = avaliarVerified({
      ...baseVazia,
      itens: [documentoFuturo("d1"), documentoFuturo("d2"), documentoFuturo("d3"), documentoVencido("d4")],
    })
    expect(pilar(r, "documentacao").ok).toBe(false)
  })

  it("histórico: 6 eventos contam, 5 não", () => {
    expect(pilar(avaliarVerified({ ...baseVazia, totalEventosDiario: 6 }), "historico").ok).toBe(true)
    expect(pilar(avaliarVerified({ ...baseVazia, totalEventosDiario: 5 }), "historico").ok).toBe(false)
  })

  it("toda pendência traz dica e um link interno que resolve", () => {
    for (const item of avaliarVerified(baseVazia).itens) {
      expect(item.dica.length).toBeGreaterThan(0)
      expect(item.href.startsWith("/")).toBe(true)
    }
  })

  it("ocorrência não é insumo do selo — o PRD proíbe que avaria aberta derrube Verified", () => {
    // Prova estrutural: se algum dia alguém acrescentar ocorrências à entrada,
    // este teste cai e obriga a reler o §15 antes de mudar a regra.
    expect(Object.keys(baseCompleta).sort()).toEqual(["equipamentos", "hoje", "itens", "totalEventosDiario"])
  })
})

describe("avaliarSeloVerified — prazo de 15 dias", () => {
  const completo = avaliarVerified(baseCompleta)
  const incompleto = avaliarVerified(baseVazia)
  const NUNCA: EstadoVerifiedGravado = { conquistadoEm: null, pendenciaDesde: null }
  const DIA_0 = "2026-08-01T12:00:00.000Z"
  const emDias = (d: number) => new Date(Date.parse(DIA_0) + d * 86_400_000).toISOString()

  it("o prazo do PRD é 15 dias", () => {
    expect(DIAS_REGULARIZACAO_VERIFIED).toBe(15)
  })

  it("nunca conquistado + pilar faltando = sem relógio correndo", () => {
    const a = avaliarSeloVerified(incompleto, NUNCA, DIA_0)
    expect(a.situacao).toBe("nao_conquistado")
    expect(a.prazoAte).toBeNull()
    expect(a.estadoParaGravar).toBeNull()
  })

  it("primeira vez com os cinco de pé: conquista e grava a data", () => {
    const a = avaliarSeloVerified(completo, NUNCA, DIA_0)
    expect(a.situacao).toBe("ativo")
    expect(a.estadoParaGravar).toEqual({ conquistadoEm: DIA_0, pendenciaDesde: null })
  })

  it("selo ativo e nada mudou: não grava nada de novo", () => {
    const a = avaliarSeloVerified(completo, { conquistadoEm: DIA_0, pendenciaDesde: null }, emDias(3))
    expect(a.situacao).toBe("ativo")
    expect(a.estadoParaGravar).toBeNull()
  })

  it("pilar cai: começa a contagem e o selo segue valendo, com 15 dias", () => {
    const a = avaliarSeloVerified(incompleto, { conquistadoEm: DIA_0, pendenciaDesde: null }, emDias(10))
    expect(a.situacao).toBe("regularizacao")
    expect(a.diasRestantes).toBe(15)
    expect(a.estadoParaGravar).toEqual({ conquistadoEm: DIA_0, pendenciaDesde: emDias(10) })
    expect(textoPrazoVerified(a)).toBe("Atualização necessária — 15 dias")
  })

  it("no meio do prazo mostra os dias que faltam, sem regravar o relógio", () => {
    const gravado = { conquistadoEm: DIA_0, pendenciaDesde: emDias(10) }
    const a = avaliarSeloVerified(incompleto, gravado, emDias(22))
    expect(a.situacao).toBe("regularizacao")
    expect(a.diasRestantes).toBe(3)
    expect(a.estadoParaGravar).toBeNull()
    expect(textoPrazoVerified(a)).toBe("Atualização necessária — 3 dias")
  })

  it("faltando 1 dia, a frase fica no singular", () => {
    const a = avaliarSeloVerified(incompleto, { conquistadoEm: DIA_0, pendenciaDesde: emDias(10) }, emDias(24))
    expect(textoPrazoVerified(a)).toBe("Atualização necessária — 1 dia")
  })

  it("no dia 15 ainda dentro do prazo; passou de 15 dias: suspenso", () => {
    const gravado = { conquistadoEm: DIA_0, pendenciaDesde: emDias(10) }
    expect(avaliarSeloVerified(incompleto, gravado, emDias(24.9)).situacao).toBe("regularizacao")
    expect(avaliarSeloVerified(incompleto, gravado, emDias(25)).situacao).toBe("suspenso")
    expect(avaliarSeloVerified(incompleto, gravado, emDias(40)).situacao).toBe("suspenso")
  })

  it("regularizou dentro dos 15 dias: mantém o selo e o relógio zera", () => {
    const a = avaliarSeloVerified(completo, { conquistadoEm: DIA_0, pendenciaDesde: emDias(10) }, emDias(20))
    expect(a.situacao).toBe("ativo")
    expect(a.estadoParaGravar).toEqual({ conquistadoEm: DIA_0, pendenciaDesde: null })
  })

  it("corrigiu depois de suspenso: reativação automática, sem ninguém aprovar", () => {
    const a = avaliarSeloVerified(completo, { conquistadoEm: DIA_0, pendenciaDesde: emDias(10) }, emDias(90))
    expect(a.situacao).toBe("ativo")
    expect(a.estadoParaGravar).toEqual({ conquistadoEm: DIA_0, pendenciaDesde: null })
    expect(textoPrazoVerified(a)).toBeNull()
  })

  it("a conquista original nunca é reescrita numa reativação", () => {
    const a = avaliarSeloVerified(completo, { conquistadoEm: DIA_0, pendenciaDesde: emDias(10) }, emDias(90))
    expect(a.estadoParaGravar!.conquistadoEm).toBe(DIA_0)
  })

  it("só há texto de prazo em regularização", () => {
    expect(textoPrazoVerified(avaliarSeloVerified(completo, NUNCA, DIA_0))).toBeNull()
    expect(textoPrazoVerified(avaliarSeloVerified(incompleto, NUNCA, DIA_0))).toBeNull()
    const suspenso = avaliarSeloVerified(incompleto, { conquistadoEm: DIA_0, pendenciaDesde: DIA_0 }, emDias(30))
    expect(textoPrazoVerified(suspenso)).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import { avaliarSelo, type DadosSelo } from "./selo"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"

const HOJE = "2026-08-08"

const embarcacaoVazia: DadosSelo["embarcacao"] = {
  nome: "Veleiro Teste", estaleiro: null, modelo: null, ano: null, comprimento_m: null,
}

const embarcacaoCompleta: DadosSelo["embarcacao"] = {
  nome: "Veleiro Teste", estaleiro: "Schaefer", modelo: "510", ano: 2018, comprimento_m: 15.5,
}

function motor(horas: number | null): Equipamento {
  return {
    id: "m1", embarcacao_id: "b1", tipo: "motor", posicao: "central", marca: null, modelo: null,
    numero_serie: null, ano: null, potencia_hp: null, combustivel: null, identificacao_interna: null,
    quantidade: null, foto_path: null, observacoes: null, horas_atuais: horas, ultima_leitura: null,
    created_at: "2026-01-01",
  }
}

function itemOk(id: string): ItemMonitorado {
  return {
    id, embarcacao_id: "b1", equipamento_id: null, nome: `Item ${id}`, especificacao: null,
    quantidade: null, categoria: null, intervalo_horas: null, intervalo_meses: null,
    data_fixa: null, ultimo_ciclo_data: null, ultimo_ciclo_horas: null, created_at: "2026-01-01",
  }
}

function itemVencido(id: string): ItemMonitorado {
  return { ...itemOk(id), data_fixa: "2020-01-01" }
}

function documentoFuturo(id: string): ItemMonitorado {
  return { ...itemOk(id), categoria: "documento", data_fixa: "2027-01-01" }
}

function documentoVencido(id: string): ItemMonitorado {
  return { ...itemOk(id), categoria: "documento", data_fixa: "2020-01-01" }
}

/** data futura, mas SEM a categoria "documento" — usado só pra provar que o
 *  filtro de categoria importa, não só a data. */
function itemFuturoOutraCategoria(id: string): ItemMonitorado {
  return { ...itemOk(id), categoria: "deck", data_fixa: "2027-01-01" }
}

const baseVazia: DadosSelo = {
  embarcacao: embarcacaoVazia,
  equipamentos: [],
  itens: [],
  hoje: HOJE,
  totalFotos: 0,
  totalEventosDiario: 0,
  totalContatos: 0,
}

const baseCompleta: DadosSelo = {
  embarcacao: embarcacaoCompleta,
  equipamentos: [motor(120)],
  itens: [documentoFuturo("d1"), documentoFuturo("d2"), documentoFuturo("d3")],
  hoje: HOJE,
  totalFotos: 1,
  totalEventosDiario: 6,
  totalContatos: 1,
}

describe("avaliarSelo", () => {
  it("barco vazio: 0%, nenhum item completo", () => {
    const r = avaliarSelo(baseVazia)
    expect(r.completos).toBe(0)
    expect(r.percentual).toBe(0)
    expect(r.itens.every((i) => !i.ok)).toBe(true)
  })

  it("barco completo: 100%, todos os itens completos", () => {
    const r = avaliarSelo(baseCompleta)
    expect(r.completos).toBe(r.total)
    expect(r.percentual).toBe(100)
    expect(r.itens.every((i) => i.ok)).toBe(true)
  })

  it("dados gerais completos conta isoladamente", () => {
    const r = avaliarSelo({ ...baseVazia, embarcacao: embarcacaoCompleta })
    expect(r.itens.find((i) => i.chave === "dados_gerais")!.ok).toBe(true)
    expect(r.completos).toBe(1)
  })

  it("motor com horas conta isoladamente", () => {
    const r = avaliarSelo({ ...baseVazia, equipamentos: [motor(50)] })
    expect(r.itens.find((i) => i.chave === "motor_horas")!.ok).toBe(true)
    expect(r.completos).toBe(1)
  })

  it("motor cadastrado sem leitura de horas não conta", () => {
    const r = avaliarSelo({ ...baseVazia, equipamentos: [motor(null)] })
    expect(r.itens.find((i) => i.chave === "motor_horas")!.ok).toBe(false)
  })

  it("3+ documentos com validade futura conta (e também zera vencidos, já que nenhum desses 3 venceu)", () => {
    const r = avaliarSelo({
      ...baseVazia,
      itens: [documentoFuturo("d1"), documentoFuturo("d2"), documentoFuturo("d3")],
    })
    expect(r.itens.find((i) => i.chave === "documentos")!.ok).toBe(true)
    expect(r.itens.find((i) => i.chave === "nenhum_vencido")!.ok).toBe(true)
    expect(r.completos).toBe(2)
  })

  it("2 documentos com validade futura não bastam", () => {
    const r = avaliarSelo({ ...baseVazia, itens: [documentoFuturo("d1"), documentoFuturo("d2")] })
    expect(r.itens.find((i) => i.chave === "documentos")!.ok).toBe(false)
  })

  it("documento vencido não conta como validade futura nem soma pro item de vencidos", () => {
    const r = avaliarSelo({
      ...baseVazia,
      itens: [documentoFuturo("d1"), documentoFuturo("d2"), documentoVencido("d3")],
    })
    expect(r.itens.find((i) => i.chave === "documentos")!.ok).toBe(false)
    expect(r.itens.find((i) => i.chave === "nenhum_vencido")!.ok).toBe(false)
  })

  it("documentos com validade só conta itens categoria \"documento\" (data futura em outra categoria não entra)", () => {
    const r = avaliarSelo({
      ...baseVazia,
      itens: [itemFuturoOutraCategoria("c1"), itemFuturoOutraCategoria("c2"), itemFuturoOutraCategoria("c3")],
    })
    expect(r.itens.find((i) => i.chave === "documentos")!.ok).toBe(false)
  })

  it("nenhum item vencido conta isoladamente quando há itens em dia", () => {
    const r = avaliarSelo({ ...baseVazia, itens: [itemOk("i1"), itemOk("i2")] })
    expect(r.itens.find((i) => i.chave === "nenhum_vencido")!.ok).toBe(true)
    expect(r.completos).toBe(1)
  })

  it("sem nenhum item cadastrado, o critério de vencidos não conta (nada para verificar)", () => {
    const r = avaliarSelo(baseVazia)
    expect(r.itens.find((i) => i.chave === "nenhum_vencido")!.ok).toBe(false)
  })

  it("um item vencido derruba o critério", () => {
    const r = avaliarSelo({ ...baseVazia, itens: [itemOk("i1"), itemVencido("i2")] })
    expect(r.itens.find((i) => i.chave === "nenhum_vencido")!.ok).toBe(false)
  })

  it("vencimento por horas usa o equipamento vinculado ao item", () => {
    const eq = motor(1000)
    const item: ItemMonitorado = {
      ...itemOk("i1"), equipamento_id: eq.id, intervalo_horas: 500, ultimo_ciclo_horas: 400,
    }
    const r = avaliarSelo({ ...baseVazia, equipamentos: [eq], itens: [item] })
    expect(r.itens.find((i) => i.chave === "nenhum_vencido")!.ok).toBe(false)
  })

  it("ao menos 1 foto conta isoladamente", () => {
    const r = avaliarSelo({ ...baseVazia, totalFotos: 1 })
    expect(r.itens.find((i) => i.chave === "fotos")!.ok).toBe(true)
    expect(r.completos).toBe(1)
  })

  it("6+ eventos no diário conta isoladamente", () => {
    const r = avaliarSelo({ ...baseVazia, totalEventosDiario: 6 })
    expect(r.itens.find((i) => i.chave === "diario")!.ok).toBe(true)
    expect(r.completos).toBe(1)
  })

  it("5 eventos não bastam", () => {
    const r = avaliarSelo({ ...baseVazia, totalEventosDiario: 5 })
    expect(r.itens.find((i) => i.chave === "diario")!.ok).toBe(false)
  })

  it("contato cadastrado conta isoladamente", () => {
    const r = avaliarSelo({ ...baseVazia, totalContatos: 1 })
    expect(r.itens.find((i) => i.chave === "contatos")!.ok).toBe(true)
    expect(r.completos).toBe(1)
  })

  it("toda pendência traz dica e um link (interno) que resolve", () => {
    const r = avaliarSelo(baseVazia)
    for (const item of r.itens) {
      expect(item.dica.length).toBeGreaterThan(0)
      expect(item.href.startsWith("/")).toBe(true)
    }
  })

  it("percentual arredonda para o inteiro mais próximo", () => {
    // 1 de 7 = 14,28...% -> 14%
    const r = avaliarSelo({ ...baseVazia, totalFotos: 1 })
    expect(r.percentual).toBe(14)
  })
})

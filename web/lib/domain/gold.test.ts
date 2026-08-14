import { describe, expect, it } from "vitest"
import {
  estadoFinal, formatarPrecoGold, podeCancelarGold, statusSeloGold, sugerirFaixaPorte, transicaoValidaGold,
} from "./gold"
import type { GoldPreco } from "@/lib/db/types"

describe("sugerirFaixaPorte", () => {
  it("sem comprimento cadastrado devolve null", () => {
    expect(sugerirFaixaPorte(null)).toBeNull()
    expect(sugerirFaixaPorte(undefined)).toBeNull()
    expect(sugerirFaixaPorte(0)).toBeNull()
  })
  it("converte metros para pés e escolhe a faixa certa", () => {
    expect(sugerirFaixaPorte(3)).toBe("ate_30") // ~9,8 pés
    expect(sugerirFaixaPorte(9)).toBe("ate_30") // ~29,5 pés
    expect(sugerirFaixaPorte(10)).toBe("31_40") // ~32,8 pés
    expect(sugerirFaixaPorte(15)).toBe("41_50") // ~49,2 pés
  })
  it("fronteiras exatas (30/40/50/60/80 pés)", () => {
    const pesParaMetros = (pes: number) => pes / 3.28084
    expect(sugerirFaixaPorte(pesParaMetros(30))).toBe("ate_30")
    expect(sugerirFaixaPorte(pesParaMetros(30.1))).toBe("31_40")
    expect(sugerirFaixaPorte(pesParaMetros(40))).toBe("31_40")
    expect(sugerirFaixaPorte(pesParaMetros(50))).toBe("41_50")
    expect(sugerirFaixaPorte(pesParaMetros(60))).toBe("51_60")
    expect(sugerirFaixaPorte(pesParaMetros(80))).toBe("61_80")
    expect(sugerirFaixaPorte(pesParaMetros(81))).toBe("81_mais")
  })
})

describe("formatarPrecoGold", () => {
  it("null é sob consulta, nunca R$ 0,00", () => {
    expect(formatarPrecoGold(null)).toBe("Sob consulta")
  })
  it("formata centavos em reais", () => {
    expect(formatarPrecoGold(199000)).toContain("1.990,00")
  })
})

describe("transicaoValidaGold", () => {
  it("segue o fluxo oficial do PRD de Correções", () => {
    expect(transicaoValidaGold("solicitado", "aguardando_pagamento")).toBe(true)
    expect(transicaoValidaGold("aguardando_pagamento", "pago")).toBe(true)
    expect(transicaoValidaGold("pago", "aguardando_agendamento")).toBe(true)
    expect(transicaoValidaGold("aguardando_agendamento", "agendado")).toBe(true)
    expect(transicaoValidaGold("agendado", "avaliacao_realizada")).toBe(true)
    expect(transicaoValidaGold("avaliacao_realizada", "em_analise")).toBe(true)
    expect(transicaoValidaGold("em_analise", "aprovado")).toBe(true)
    expect(transicaoValidaGold("em_analise", "reprovado")).toBe(true)
  })
  it("rejeita pular etapa", () => {
    expect(transicaoValidaGold("solicitado", "agendado")).toBe(false)
    expect(transicaoValidaGold("pago", "aprovado")).toBe(false)
  })
  it("estados terminais não vão a lugar nenhum", () => {
    expect(estadoFinal("aprovado")).toBe(true)
    expect(estadoFinal("reprovado")).toBe(true)
    expect(estadoFinal("cancelado")).toBe(true)
    expect(estadoFinal("solicitado")).toBe(false)
  })
})

describe("podeCancelarGold", () => {
  it("pode cancelar em qualquer estado não-terminal", () => {
    expect(podeCancelarGold("solicitado")).toBe(true)
    expect(podeCancelarGold("agendado")).toBe(true)
    expect(podeCancelarGold("em_analise")).toBe(true)
  })
  it("não pode cancelar depois do resultado final", () => {
    expect(podeCancelarGold("aprovado")).toBe(false)
    expect(podeCancelarGold("reprovado")).toBe(false)
    expect(podeCancelarGold("cancelado")).toBe(false)
  })
})

describe("statusSeloGold", () => {
  it("ativo quando falta mais de 30 dias", () => {
    expect(statusSeloGold("2027-06-01", "2027-01-01")).toBe("ativo")
  })
  it("vencendo nos últimos 30 dias", () => {
    expect(statusSeloGold("2027-01-20", "2027-01-01")).toBe("vencendo")
  })
  it("expirado depois da validade", () => {
    expect(statusSeloGold("2026-12-31", "2027-01-01")).toBe("expirado")
  })
  it("no dia exato da validade ainda não expirou", () => {
    expect(statusSeloGold("2027-01-01", "2027-01-01")).toBe("vencendo")
  })
})

describe("preços — dado semeado, não constante de código", () => {
  it("formatarPrecoGold funciona igual pra qualquer linha vinda do banco", () => {
    const precos: GoldPreco[] = [
      { faixa: "ate_30", rotulo: "Até 30 pés", limite_pes: 30, valor_centavos: 199000, atualizado_por: null, atualizado_em: "2027-01-01" },
      { faixa: "81_mais", rotulo: "81+ pés", limite_pes: null, valor_centavos: null, atualizado_por: null, atualizado_em: "2027-01-01" },
    ]
    expect(formatarPrecoGold(precos[0].valor_centavos)).toContain("1.990,00")
    expect(formatarPrecoGold(precos[1].valor_centavos)).toBe("Sob consulta")
  })
})

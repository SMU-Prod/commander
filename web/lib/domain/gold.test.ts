import { describe, expect, it } from "vitest"
import {
  estadoFinal, faixaPorteDePes, formatarPrecoGold, METROS_POR_PE, pesDeMetros, podeCancelarGold,
  precoSobConsulta, statusSeloGold, sugerirFaixaPorte, transicaoValidaGold,
} from "./gold"
import type { GoldPreco } from "@/lib/db/types"

describe("pesDeMetros — a conversão e o arredondamento escolhido", () => {
  it("um pé é 0,3048 m por definição", () => {
    expect(METROS_POR_PE).toBe(0.3048)
    expect(pesDeMetros(0.3048)).toBe(1)
  })

  /** A regressão que motivou a mudança: com o fator arredondado (3.28084),
   *  9,144 m dava 30,00000096 pés e o barco de EXATAMENTE 30 pés caía na
   *  faixa de 31–40 — R$ 500 a mais por erro de ponto flutuante. */
  it("9,144 m é 30 pés cravados, não 30,000001", () => {
    expect(pesDeMetros(9.144)).toBe(30)
    expect(sugerirFaixaPorte(9.144)).toBe("ate_30")
  })

  it("arredonda pro pé inteiro mais próximo, e meio pé sobe", () => {
    expect(pesDeMetros(9.1739)).toBe(30) // 30,10 pés -> 30
    expect(pesDeMetros(9.2659)).toBe(30) // 30,40 pés -> 30
    expect(pesDeMetros(9.2964)).toBe(31) // 30,50 pés -> 31 (o meio pé sobe)
    expect(pesDeMetros(9.4488)).toBe(31) // 31 pés cravados
  })

  it("um centímetro a mais na ficha não muda de faixa", () => {
    expect(sugerirFaixaPorte(9.144)).toBe("ate_30")
    expect(sugerirFaixaPorte(9.154)).toBe("ate_30") // +1 cm
    expect(sugerirFaixaPorte(9.174)).toBe("ate_30") // 30,1 pés
  })
})

describe("sugerirFaixaPorte", () => {
  it("sem comprimento cadastrado devolve null", () => {
    expect(sugerirFaixaPorte(null)).toBeNull()
    expect(sugerirFaixaPorte(undefined)).toBeNull()
    expect(sugerirFaixaPorte(0)).toBeNull()
    expect(sugerirFaixaPorte(Number.NaN)).toBeNull()
  })
  it("converte metros para pés e escolhe a faixa certa", () => {
    expect(sugerirFaixaPorte(3)).toBe("ate_30") // ~10 pés
    expect(sugerirFaixaPorte(9)).toBe("ate_30") // ~30 pés
    expect(sugerirFaixaPorte(10)).toBe("31_40") // ~33 pés
    expect(sugerirFaixaPorte(15)).toBe("41_50") // ~49 pés
  })
  it("fronteiras exatas (30/40/50/60/80 pés)", () => {
    const pesParaMetros = (pes: number) => pes * 0.3048
    expect(sugerirFaixaPorte(pesParaMetros(30))).toBe("ate_30")
    expect(sugerirFaixaPorte(pesParaMetros(31))).toBe("31_40")
    expect(sugerirFaixaPorte(pesParaMetros(40))).toBe("31_40")
    expect(sugerirFaixaPorte(pesParaMetros(41))).toBe("41_50")
    expect(sugerirFaixaPorte(pesParaMetros(50))).toBe("41_50")
    expect(sugerirFaixaPorte(pesParaMetros(60))).toBe("51_60")
    expect(sugerirFaixaPorte(pesParaMetros(80))).toBe("61_80")
    expect(sugerirFaixaPorte(pesParaMetros(81))).toBe("81_mais")
    expect(sugerirFaixaPorte(pesParaMetros(120))).toBe("81_mais")
  })
  it("as faixas cobrem todos os pés inteiros, sem buraco", () => {
    for (let pes = 1; pes <= 200; pes++) {
      expect(faixaPorteDePes(pes)).toBeTruthy()
    }
    expect(faixaPorteDePes(30)).toBe("ate_30")
    expect(faixaPorteDePes(31)).toBe("31_40")
    expect(faixaPorteDePes(81)).toBe("81_mais")
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
  const precos: GoldPreco[] = [
    { faixa: "ate_30", rotulo: "Até 30 pés", limite_pes: 30, valor_centavos: 199000, atualizado_por: null, atualizado_em: "2027-01-01" },
    { faixa: "81_mais", rotulo: "81+ pés", limite_pes: null, valor_centavos: null, atualizado_por: null, atualizado_em: "2027-01-01" },
  ]

  it("formatarPrecoGold funciona igual pra qualquer linha vinda do banco", () => {
    expect(formatarPrecoGold(precos[0].valor_centavos)).toContain("1.990,00")
    expect(formatarPrecoGold(precos[1].valor_centavos)).toBe("Sob consulta")
  })

  /** §16: "81+ pés — Sob consulta". Estado, não preço: quem estiver nessa
   *  faixa não pode nem ver um botão de pagar. */
  it("sob consulta é estado — inclusive quando o Admin apaga o valor de outra faixa", () => {
    expect(precoSobConsulta(precos[1])).toBe(true)
    expect(precoSobConsulta(precos[0])).toBe(false)
    expect(precoSobConsulta(null)).toBe(true)
    expect(precoSobConsulta({ ...precos[0], valor_centavos: null })).toBe(true)
  })
})

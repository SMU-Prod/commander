import { describe, expect, it } from "vitest"
import {
  ABAS_OCORRENCIA,
  faroDoEstado,
  podeTransicionar,
  proximaResolvidaEm,
  ROTULO_ESTADO,
  transicoesPossiveis,
} from "./ocorrencias"

describe("podeTransicionar", () => {
  it("aberta pode virar em acompanhamento ou resolvida", () => {
    expect(podeTransicionar("aberta", "em_acompanhamento")).toBe(true)
    expect(podeTransicionar("aberta", "resolvida")).toBe(true)
  })
  it("em acompanhamento pode voltar pra aberta ou fechar como resolvida", () => {
    expect(podeTransicionar("em_acompanhamento", "aberta")).toBe(true)
    expect(podeTransicionar("em_acompanhamento", "resolvida")).toBe(true)
  })
  it("resolvida só reabre para em acompanhamento — nunca direto pra aberta de novo", () => {
    expect(podeTransicionar("resolvida", "em_acompanhamento")).toBe(true)
    expect(podeTransicionar("resolvida", "aberta")).toBe(false)
  })
  it("nao existe transicao para o mesmo estado", () => {
    expect(podeTransicionar("aberta", "aberta")).toBe(false)
    expect(podeTransicionar("em_acompanhamento", "em_acompanhamento")).toBe(false)
    expect(podeTransicionar("resolvida", "resolvida")).toBe(false)
  })
})

describe("transicoesPossiveis", () => {
  it("lista exatamente os estados alcançáveis a partir do atual", () => {
    expect(transicoesPossiveis("aberta")).toEqual(["em_acompanhamento", "resolvida"])
    expect(transicoesPossiveis("em_acompanhamento")).toEqual(["aberta", "resolvida"])
    expect(transicoesPossiveis("resolvida")).toEqual(["em_acompanhamento"])
  })
})

describe("faroDoEstado", () => {
  it("aberta é crítico (vermelho) — ninguém cuidou ainda", () => {
    expect(faroDoEstado("aberta")).toBe("vencido")
  })
  it("em acompanhamento é atenção (amarelo) — alguém já está cuidando", () => {
    expect(faroDoEstado("em_acompanhamento")).toBe("atencao")
  })
  it("resolvida é ok (verde)", () => {
    expect(faroDoEstado("resolvida")).toBe("ok")
  })
})

describe("proximaResolvidaEm", () => {
  it("marca resolvida_em ao resolver", () => {
    expect(proximaResolvidaEm("resolvida", "2026-08-14T12:00:00.000Z")).toBe("2026-08-14T12:00:00.000Z")
  })
  it("limpa resolvida_em ao sair de resolvida (reabertura)", () => {
    expect(proximaResolvidaEm("em_acompanhamento", "2026-08-14T12:00:00.000Z")).toBeNull()
    expect(proximaResolvidaEm("aberta", "2026-08-14T12:00:00.000Z")).toBeNull()
  })
})

describe("ROTULO_ESTADO", () => {
  it("usa exatamente as palavras do PRD/glossário", () => {
    expect(ROTULO_ESTADO.aberta).toBe("Aberta")
    expect(ROTULO_ESTADO.em_acompanhamento).toBe("Em acompanhamento")
    expect(ROTULO_ESTADO.resolvida).toBe("Resolvida")
  })
})

describe("ABAS_OCORRENCIA", () => {
  it("cobre os hubs onde uma ocorrência pode nascer", () => {
    expect(ABAS_OCORRENCIA).toContain("motores")
    expect(ABAS_OCORRENCIA).toContain("eletrica")
    expect(ABAS_OCORRENCIA).toContain("casco")
    expect(ABAS_OCORRENCIA).toContain("hidraulica")
    expect(ABAS_OCORRENCIA).toContain("seguranca")
    expect(ABAS_OCORRENCIA).toContain("equipamentos")
    expect(ABAS_OCORRENCIA).toContain("documentos")
    expect(ABAS_OCORRENCIA).toContain("embarcacao")
    // areas que nao sao "setor" nao entram (diario e a origem, nao o destino)
    expect(ABAS_OCORRENCIA).not.toContain("diario")
    expect(ABAS_OCORRENCIA).not.toContain("historico")
    expect(ABAS_OCORRENCIA).not.toContain("fotos")
    expect(ABAS_OCORRENCIA).not.toContain("contatos")
    expect(ABAS_OCORRENCIA).not.toContain("gastos")
  })
})

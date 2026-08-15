import { describe, expect, it } from "vitest"
import {
  ABAS_OCORRENCIA,
  ESTADOS_OCORRENCIA,
  faroDoEstado,
  MINIMO_MOTIVO_ANULACAO,
  pesaNaSaude,
  podeTransicionar,
  proximaResolvidaEm,
  registroDaAnulacao,
  ROTULO_ESTADO,
  transicoesPossiveis,
  validarMotivoAnulacao,
} from "./ocorrencias"

describe("podeTransicionar", () => {
  it("aberta pode virar em acompanhamento, resolvida ou anulada", () => {
    expect(podeTransicionar("aberta", "em_acompanhamento")).toBe(true)
    expect(podeTransicionar("aberta", "resolvida")).toBe(true)
    expect(podeTransicionar("aberta", "anulada")).toBe(true)
  })
  it("em acompanhamento pode voltar pra aberta, fechar como resolvida ou ser anulada", () => {
    expect(podeTransicionar("em_acompanhamento", "aberta")).toBe(true)
    expect(podeTransicionar("em_acompanhamento", "resolvida")).toBe(true)
    expect(podeTransicionar("em_acompanhamento", "anulada")).toBe(true)
  })
  it("resolvida só reabre para em acompanhamento — nunca direto pra aberta de novo", () => {
    expect(podeTransicionar("resolvida", "em_acompanhamento")).toBe(true)
    expect(podeTransicionar("resolvida", "aberta")).toBe(false)
  })
  it("resolvida NAO pode ser anulada — anular reescreveria trabalho que aconteceu de verdade", () => {
    expect(podeTransicionar("resolvida", "anulada")).toBe(false)
  })
  it("anulada só volta pra aberta — recomeça do zero, como nasceu", () => {
    expect(podeTransicionar("anulada", "aberta")).toBe(true)
    expect(podeTransicionar("anulada", "em_acompanhamento")).toBe(false)
    expect(podeTransicionar("anulada", "resolvida")).toBe(false)
  })
  it("nao existe transicao para o mesmo estado", () => {
    for (const estado of ESTADOS_OCORRENCIA) {
      expect(podeTransicionar(estado, estado)).toBe(false)
    }
  })
})

describe("transicoesPossiveis", () => {
  it("lista exatamente os estados alcançáveis a partir do atual", () => {
    expect(transicoesPossiveis("aberta")).toEqual(["em_acompanhamento", "resolvida", "anulada"])
    expect(transicoesPossiveis("em_acompanhamento")).toEqual(["aberta", "resolvida", "anulada"])
    expect(transicoesPossiveis("resolvida")).toEqual(["em_acompanhamento"])
    expect(transicoesPossiveis("anulada")).toEqual(["aberta"])
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
  it("anulada não tem farol — verde diria 'foi resolvido', e não foi", () => {
    expect(faroDoEstado("anulada")).toBeNull()
  })
})

describe("pesaNaSaude", () => {
  it("só aberta e em acompanhamento representam problema vivo", () => {
    expect(pesaNaSaude("aberta")).toBe(true)
    expect(pesaNaSaude("em_acompanhamento")).toBe(true)
  })
  it("resolvida não pesa", () => {
    expect(pesaNaSaude("resolvida")).toBe(false)
  })
  it("anulada não pesa — foi declarada inexistente por escrito", () => {
    expect(pesaNaSaude("anulada")).toBe(false)
  })
})

describe("validarMotivoAnulacao", () => {
  it("aceita um motivo de verdade, já limpo das bordas", () => {
    expect(validarMotivoAnulacao("  apontei o motor errado  ")).toBe("apontei o motor errado")
  })
  it("recusa vazio, só espaços e nulo", () => {
    expect(validarMotivoAnulacao("")).toBeNull()
    expect(validarMotivoAnulacao("     ")).toBeNull()
    expect(validarMotivoAnulacao(null)).toBeNull()
    expect(validarMotivoAnulacao(undefined)).toBeNull()
  })
  it("recusa motivo curto demais pra significar alguma coisa daqui a seis meses", () => {
    expect(validarMotivoAnulacao("x")).toBeNull()
    expect(validarMotivoAnulacao("abcd")).toBeNull()
    expect(validarMotivoAnulacao("abcde")).toBe("abcde")
    expect(MINIMO_MOTIVO_ANULACAO).toBe(5)
  })
})

describe("registroDaAnulacao", () => {
  const AGORA = "2026-08-15T12:00:00.000Z"
  it("carimba autoria, data e motivo ao anular", () => {
    expect(registroDaAnulacao("anulada", AGORA, "u1", "criada por engano no checklist")).toEqual({
      anulada_em: AGORA,
      anulada_por: "u1",
      motivo_anulacao: "criada por engano no checklist",
    })
  })
  it("limpa os três ao sair de anulada — colunas não podem mentir que ainda está anulada", () => {
    expect(registroDaAnulacao("aberta", AGORA, "u1", "")).toEqual({
      anulada_em: null, anulada_por: null, motivo_anulacao: null,
    })
    expect(registroDaAnulacao("resolvida", AGORA, "u1", "")).toEqual({
      anulada_em: null, anulada_por: null, motivo_anulacao: null,
    })
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
    expect(ROTULO_ESTADO.anulada).toBe("Anulada")
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

import { describe, expect, it } from "vitest"
import {
  ABAS_OCORRENCIA,
  chipsDaAtiva,
  ESTADOS_OCORRENCIA,
  faroDoEstado,
  farolDaGravidade,
  linhaDaAtiva,
  linhaDaFinalizada,
  MINIMO_MOTIVO_ANULACAO,
  pesaNaSaude,
  podeTransicionar,
  proximaResolvidaEm,
  registroDaAnulacao,
  ROTULO_ESTADO,
  tituloDasFinalizadas,
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

describe("farolDaGravidade (canvas tela-3f: severidade na borda)", () => {
  it("alta acende a luz de crítico — é o que a Saúde chama de ação necessária", () => {
    expect(farolDaGravidade("alta")).toBe("vencido")
  })
  it("média e baixa acendem a de atenção — o canvas pinta as duas de âmbar", () => {
    expect(farolDaGravidade("media")).toBe("atencao")
    expect(farolDaGravidade("baixa")).toBe("atencao")
  })
  it("sem gravidade registrada não se inventa cor", () => {
    expect(farolDaGravidade(null)).toBeNull()
  })
})

describe("linhaDaAtiva", () => {
  // 22:00 UTC de 10/08 é 19:00 de 10/08 em SP — o dia civil é 10/08 mesmo.
  const ABERTURA = "2026-08-10T22:00:00+00:00"
  it("setor, data curta e autor, na frase do canvas", () => {
    expect(linhaDaAtiva({ rotuloAba: "Casco", aberturaISO: ABERTURA, autor: "Marcos Jordão", estado: "em_acompanhamento" }))
      .toBe("Casco · aberta em 10/08 por Marcos Jordão · em acompanhamento")
  })
  it("aberta não repete o estado — 'aberta em 10/08' já diz", () => {
    expect(linhaDaAtiva({ rotuloAba: "Elétrica", aberturaISO: ABERTURA, autor: "Erick", estado: "aberta" }))
      .toBe("Elétrica · aberta em 10/08 por Erick")
  })
  it("sem autor conhecido a frase para na data — nunca 'por Alguém'", () => {
    expect(linhaDaAtiva({ rotuloAba: "Casco", aberturaISO: ABERTURA, autor: null, estado: "aberta" }))
      .toBe("Casco · aberta em 10/08")
  })
  it("madrugada UTC não empurra o dia civil: 01:00 UTC de 12/08 é 11/08 na marina", () => {
    expect(linhaDaAtiva({ rotuloAba: "Casco", aberturaISO: "2026-08-12T01:00:00+00:00", autor: null, estado: "aberta" }))
      .toBe("Casco · aberta em 11/08")
  })
})

describe("chipsDaAtiva", () => {
  const HOJE = "2026-08-16"
  it("anexo quando há, e há quantos dias está em aberto", () => {
    expect(chipsDaAtiva(true, "2026-08-10T12:00:00+00:00", HOJE)).toEqual(["1 anexo", "6 dias aberta"])
  })
  it("sem anexo não há chip de anexo — vazio honesto", () => {
    expect(chipsDaAtiva(false, "2026-08-15T12:00:00+00:00", HOJE)).toEqual(["1 dia aberta"])
  })
  it("aberta no próprio dia diz 'aberta hoje', não '0 dias'", () => {
    expect(chipsDaAtiva(false, "2026-08-16T12:00:00+00:00", HOJE)).toEqual(["aberta hoje"])
  })
})

describe("linhaDaFinalizada", () => {
  it("resolvida com data e a observação de quem fechou", () => {
    expect(linhaDaFinalizada({ estado: "resolvida", quandoISO: "2026-08-02T18:00:00+00:00", nota: "troca de impelidor" }))
      .toBe("Resolvida em 02/08 · troca de impelidor")
  })
  it("anulada com o motivo obrigatório do PRD §7", () => {
    expect(linhaDaFinalizada({ estado: "anulada", quandoISO: "2026-07-21T12:00:00+00:00", nota: "registro não procedia" }))
      .toBe("Anulada em 21/07 · registro não procedia")
  })
  it("sem data conhecida a palavra fica sozinha — nunca se inventa carimbo", () => {
    expect(linhaDaFinalizada({ estado: "resolvida", quandoISO: null, nota: null })).toBe("Resolvida")
  })
  it("nota vazia ou só espaços não vira ' · ' pendurado", () => {
    expect(linhaDaFinalizada({ estado: "resolvida", quandoISO: "2026-08-02", nota: "   " })).toBe("Resolvida em 02/08")
  })
})

describe("tituloDasFinalizadas", () => {
  it("diz o que o painel de fato contém", () => {
    expect(tituloDasFinalizadas(true, true)).toBe("Resolvidas e anuladas")
    expect(tituloDasFinalizadas(true, false)).toBe("Resolvidas recentemente")
    expect(tituloDasFinalizadas(false, true)).toBe("Anuladas")
  })
  it("sem nada finalizado, painel nenhum", () => {
    expect(tituloDasFinalizadas(false, false)).toBeNull()
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

import { describe, expect, it } from "vitest"
import {
  calcularSaudeEmbarcacao,
  ehAreaCritica,
  ESTADOS_SAUDE,
  FAROL_ESTADO_SAUDE,
  GRAVIDADE_CRITICA,
  MULTIPLICADOR_ESTADO_OCORRENCIA,
  ORDEM_ESTADO_SAUDE,
  PESO_AREA_CRITICA,
  PESO_CATEGORIA,
  piorEstado,
  ROTULO_ESTADO_SAUDE,
  SEVERIDADE_GRAVIDADE_OCORRENCIA,
  SEVERIDADE_STATUS_ITEM,
  type FatorSaude,
  type ItemParaSaude,
  type OcorrenciaParaSaude,
} from "./saude"

const itemOk = (over: Partial<ItemParaSaude> = {}): ItemParaSaude => ({
  id: "item-ok", nome: "Item ok", aba: "motores", status: "ok", temInformacao: true, ...over,
})

const fator = (over: Partial<FatorSaude> = {}): FatorSaude => ({
  tipo: "manutencao", id: "f", nome: "Fator", aba: "motores", detalhe: "Atenção",
  critico: false, peso: 4, farol: "atencao", ...over,
})

// =====================================================================
// A régua do PRD FINAL §5 — três estados, sem numero nenhum.
// =====================================================================

describe("vocabulario da Saude (PRD FINAL §5, §28)", () => {
  it("sao exatamente tres estados, com os rotulos do PRD", () => {
    expect(ESTADOS_SAUDE).toEqual(["saudavel", "atencao", "acao_necessaria"])
    expect(ROTULO_ESTADO_SAUDE.saudavel).toBe("Saudável")
    expect(ROTULO_ESTADO_SAUDE.atencao).toBe("Atenção")
    expect(ROTULO_ESTADO_SAUDE.acao_necessaria).toBe("Ação necessária")
  })

  it("nenhum rotulo carrega numero ou porcentagem — o PRD proibe em tres lugares", () => {
    for (const estado of ESTADOS_SAUDE) {
      expect(ROTULO_ESTADO_SAUDE[estado]).not.toMatch(/[0-9%]/)
    }
  })

  it("reusa as cores de farol que ja existem no app, sem inventar cor nova", () => {
    expect(FAROL_ESTADO_SAUDE).toEqual({ saudavel: "ok", atencao: "atencao", acao_necessaria: "vencido" })
  })

  it("o resultado nao expoe nota nenhuma na interface publica", () => {
    const r = calcularSaudeEmbarcacao([itemOk()], [])
    expect(r).not.toHaveProperty("nota")
    expect(r).not.toHaveProperty("rotulo")
    expect(Object.keys(r).sort()).toEqual(["atencao", "emDia", "estado", "fatores", "total", "vencido"])
  })
})

describe('"o pior estado relevante prevalece" (PRD §5)', () => {
  it("sem fator nenhum: SAUDAVEL", () => {
    expect(piorEstado([])).toBe("saudavel")
  })
  it("so pendencia nao critica: ATENCAO", () => {
    expect(piorEstado([fator(), fator({ id: "b" })])).toBe("atencao")
  })
  it("uma pendencia critica no meio de dez nao criticas ja manda pra ACAO NECESSARIA", () => {
    const fatores = [
      ...Array.from({ length: 10 }, (_, i) => fator({ id: `n${i}` })),
      fator({ id: "critico", critico: true }),
    ]
    expect(piorEstado(fatores)).toBe("acao_necessaria")
  })
})

// =====================================================================
// Estados a partir de dado real.
// =====================================================================

describe("calcularSaudeEmbarcacao — barco impecavel", () => {
  it("tudo ok e informado: SAUDAVEL, sem fatores", () => {
    const itens: ItemParaSaude[] = [
      itemOk({ id: "1", aba: "motores" }),
      itemOk({ id: "2", aba: "documentos" }),
      itemOk({ id: "3", aba: "casco" }),
    ]
    const r = calcularSaudeEmbarcacao(itens, [])
    expect(r.estado).toBe("saudavel")
    expect(r.fatores).toEqual([])
    expect(r).toMatchObject({ emDia: 3, atencao: 0, vencido: 0, total: 3 })
  })
})

describe("calcularSaudeEmbarcacao — o que e critico (area de peso >= 6 vencida)", () => {
  it("a definicao de area critica sai da propria tabela de pesos, nao de uma lista paralela", () => {
    expect(PESO_AREA_CRITICA).toBe(6)
    expect(ehAreaCritica("documentos")).toBe(true)
    expect(ehAreaCritica("seguranca")).toBe(true)
    // faixa "funcional" e abaixo: relevante, mas nao critica
    expect(ehAreaCritica("motores")).toBe(false)
    expect(ehAreaCritica("eletrica")).toBe(false)
    expect(ehAreaCritica("casco")).toBe(false)
    // e a tabela e a fonte: quem esta em 6 e exatamente quem e critico
    for (const [aba, peso] of Object.entries(PESO_CATEGORIA)) {
      expect(ehAreaCritica(aba as keyof typeof PESO_CATEGORIA)).toBe(peso >= PESO_AREA_CRITICA)
    }
  })

  it("documento vencido: ACAO NECESSARIA, e o fator vem marcado como critico", () => {
    const r = calcularSaudeEmbarcacao(
      [itemOk({ id: "1" }), { id: "doc", nome: "Seguro da embarcação", aba: "documentos", status: "vencido", temInformacao: true }],
      [],
    )
    expect(r.estado).toBe("acao_necessaria")
    expect(r.fatores).toHaveLength(1)
    expect(r.fatores[0]).toMatchObject({ tipo: "manutencao", id: "doc", aba: "documentos", detalhe: "Vencido", critico: true, farol: "vencido" })
  })

  it("item de seguranca vencido tambem e critico (risco de vida, mesma faixa)", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "ext", nome: "Extintor", aba: "seguranca", status: "vencido", temInformacao: true }],
      [],
    )
    expect(r.estado).toBe("acao_necessaria")
  })

  it("documento em ATENCAO nao e critico — 'proximo do limite' e a definicao de Atencao no §5", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "doc", nome: "TIE", aba: "documentos", status: "atencao", temInformacao: true }],
      [],
    )
    expect(r.estado).toBe("atencao")
    expect(r.fatores[0].critico).toBe(false)
  })

  it("motor vencido (area funcional, peso 4) e pendencia, mas nao e critica", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "oleo", nome: "Troca de óleo", aba: "motores", status: "vencido", temInformacao: true }],
      [],
    )
    expect(r.estado).toBe("atencao")
    expect(r.fatores[0].critico).toBe(false)
  })

  it("verniz do deck em atencao mal arranha: continua so ATENCAO", () => {
    const r = calcularSaudeEmbarcacao(
      [itemOk({ id: "1" }), itemOk({ id: "2" }), { id: "3", nome: "Verniz do deck", aba: "casco", status: "atencao", temInformacao: true }],
      [],
    )
    expect(r.estado).toBe("atencao")
  })
})

describe("calcularSaudeEmbarcacao — o que e critico (ocorrencia de gravidade alta)", () => {
  const ocorrencia = (over: Partial<OcorrenciaParaSaude> = {}): OcorrenciaParaSaude => ({
    id: "oc-1", titulo: "Vazamento no porão", aba: "seguranca", estado: "aberta", gravidade: "alta", ...over,
  })

  it("gravidade alta e a gravidade critica, em qualquer area", () => {
    expect(GRAVIDADE_CRITICA).toBe("alta")
    const emAreaLeve = calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ aba: "casco" })])
    expect(emAreaLeve.estado).toBe("acao_necessaria")
    expect(emAreaLeve.fatores[0]).toMatchObject({ tipo: "ocorrencia", id: "oc-1", critico: true })
    expect(emAreaLeve.fatores[0].detalhe).toMatch(/alta/i)
  })

  it("gravidade baixa e media sao pendencia, nao pendencia critica", () => {
    expect(calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ gravidade: "baixa" })]).estado).toBe("atencao")
    expect(calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ gravidade: "media" })]).estado).toBe("atencao")
  })

  it("sem gravidade registrada nunca vira critica — dado ausente nao inventa alarme", () => {
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ gravidade: null })])
    expect(r.estado).toBe("atencao")
    expect(r.fatores[0].critico).toBe(false)
  })

  it("grave EM ACOMPANHAMENTO continua critica — alguem olhando nao e 'resolvido'", () => {
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ estado: "em_acompanhamento" })])
    expect(r.estado).toBe("acao_necessaria")
    expect(r.fatores[0]).toMatchObject({ critico: true, farol: "atencao" })
  })

  it("ocorrencia resolvida nao entra na conta", () => {
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ estado: "resolvida" })])
    expect(r.estado).toBe("saudavel")
    expect(r.fatores).toEqual([])
  })

  it("ocorrencia anulada (PRD §7) nao entra na conta nem quebra o calculo", () => {
    // Regressao real da onda 44: o filtro era "tudo menos resolvida" e um `as`
    // silenciava o TypeScript, entao um estado desconhecido chegava na
    // multiplicacao como `undefined`. Na epoca isso virava "NaN%" na tela.
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrencia({ estado: "anulada" })])
    expect(r.estado).toBe("saudavel")
    expect(r.fatores).toEqual([])
  })
})

describe("calcularSaudeEmbarcacao — sem dado nenhum nao ha estado (vira convite)", () => {
  it("nenhum item com informacao e nenhuma ocorrencia: estado nulo, nunca 'Saudavel' inventado", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "1", nome: "Item novo", aba: "motores", status: "ok", temInformacao: false }],
      [],
    )
    expect(r.estado).toBeNull()
    expect(r.fatores).toEqual([])
    expect(r.total).toBe(0)
  })

  it("barco sem nada cadastrado nao e barco saudavel — e barco desconhecido", () => {
    expect(calcularSaudeEmbarcacao([], []).estado).toBeNull()
  })

  it("uma ocorrencia aberta ja basta pra existir estado, mesmo sem item com informacao", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "1", nome: "Item novo", aba: "motores", status: "ok", temInformacao: false }],
      [{ id: "oc", titulo: "Algo quebrou", aba: "motores", estado: "aberta", gravidade: null }],
    )
    expect(r.estado).toBe("atencao")
  })

  it("item sem informacao continua fora da conta mesmo quando outros itens tem dado", () => {
    const r = calcularSaudeEmbarcacao(
      [itemOk({ id: "1", temInformacao: true }), { id: "2", nome: "Sem dado", aba: "motores", status: "ok", temInformacao: false }],
      [],
    )
    expect(r.total).toBe(1)
    expect(r.estado).toBe("saudavel")
  })
})

describe("calcularSaudeEmbarcacao — monotonicidade: piorar nunca melhora o estado", () => {
  const ordem = ORDEM_ESTADO_SAUDE

  it("a ordem dos estados vai do melhor pro pior", () => {
    expect(ordem.saudavel).toBeLessThan(ordem.atencao)
    expect(ordem.atencao).toBeLessThan(ordem.acao_necessaria)
  })

  it("ok -> atencao -> vencido so pode manter ou piorar", () => {
    const montar = (status: "ok" | "atencao" | "vencido") =>
      ordem[calcularSaudeEmbarcacao([{ id: "1", nome: "Extintor", aba: "seguranca", status, temInformacao: true }], []).estado!]

    expect(montar("atencao")).toBeGreaterThanOrEqual(montar("ok"))
    expect(montar("vencido")).toBeGreaterThan(montar("atencao"))
  })

  it("piorar a gravidade de uma ocorrencia nunca melhora o estado", () => {
    const montar = (gravidade: "baixa" | "media" | "alta") =>
      ordem[calcularSaudeEmbarcacao([], [{ id: "oc", titulo: "Problema", aba: "motores", estado: "aberta", gravidade }]).estado!]

    expect(montar("media")).toBeGreaterThanOrEqual(montar("baixa"))
    expect(montar("alta")).toBeGreaterThan(montar("media"))
  })

  it("dez documentos vencidos nao sao 'pior' que um — o pior estado ja e o teto", () => {
    const um = calcularSaudeEmbarcacao(
      [{ id: "d0", nome: "Documento 0", aba: "documentos", status: "vencido", temInformacao: true }],
      [],
    )
    const dez = calcularSaudeEmbarcacao(
      Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`, nome: `Documento ${i}`, aba: "documentos" as const, status: "vencido" as const, temInformacao: true,
      })),
      [],
    )
    expect(um.estado).toBe("acao_necessaria")
    expect(dez.estado).toBe("acao_necessaria")
    expect(dez.fatores).toHaveLength(10)
  })
})

// =====================================================================
// Os pesos sobreviveram — mas so pra ordenar (PRD §3.4).
// =====================================================================

describe('"Precisa da sua atencao" ordenado por criticidade (PRD §3.4)', () => {
  it("critico vem antes de nao critico, mesmo quando o nao critico pesa mais", () => {
    // Ocorrencia grave no Casco: peso 2 x 3 x 1 = 6.
    // Documento em atencao: peso 6 x 1 = 6 — empate de peso, mas so um e critico.
    // Motor vencido: peso 4 x 3 = 12 — o MAIOR peso da lista, e nao e critico.
    const r = calcularSaudeEmbarcacao(
      [
        { id: "motor", nome: "Óleo", aba: "motores", status: "vencido", temInformacao: true },
        { id: "doc", nome: "TIE", aba: "documentos", status: "atencao", temInformacao: true },
      ],
      [{ id: "oc", titulo: "Rachadura no casco", aba: "casco", estado: "aberta", gravidade: "alta" }],
    )
    expect(r.fatores.map((f) => f.id)).toEqual(["oc", "motor", "doc"])
    expect(r.fatores[0].critico).toBe(true)
  })

  it("dentro do mesmo grupo, o de maior peso vem primeiro (a formula de 14/08 ainda ordena)", () => {
    const r = calcularSaudeEmbarcacao(
      [
        { id: "casco", nome: "Verniz", aba: "casco", status: "atencao", temInformacao: true },
        { id: "doc", nome: "Seguro", aba: "documentos", status: "vencido", temInformacao: true },
      ],
      [],
    )
    expect(r.fatores.map((f) => f.id)).toEqual(["doc", "casco"])
  })

  it("o peso continua sendo PESO_CATEGORIA x severidade — so nao vira mais nota", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "doc", nome: "TIE", aba: "documentos", status: "vencido", temInformacao: true }],
      [],
    )
    expect(r.fatores[0].peso).toBe(PESO_CATEGORIA.documentos * SEVERIDADE_STATUS_ITEM.vencido)
  })

  it("em acompanhamento pesa metade de aberta na ORDEM (nao no estado)", () => {
    const aberta = calcularSaudeEmbarcacao([], [{ id: "a", titulo: "A", aba: "motores", estado: "aberta", gravidade: "media" }])
    const acompanhando = calcularSaudeEmbarcacao([], [{ id: "b", titulo: "B", aba: "motores", estado: "em_acompanhamento", gravidade: "media" }])
    expect(acompanhando.fatores[0].peso).toBe(aberta.fatores[0].peso * MULTIPLICADOR_ESTADO_OCORRENCIA.em_acompanhamento)
    expect(acompanhando.estado).toBe(aberta.estado)
  })

  it("gravidade alta pesa mais que baixa na ordem", () => {
    const alta = calcularSaudeEmbarcacao([], [{ id: "a", titulo: "A", aba: "motores", estado: "aberta", gravidade: "alta" }])
    const baixa = calcularSaudeEmbarcacao([], [{ id: "b", titulo: "B", aba: "motores", estado: "aberta", gravidade: "baixa" }])
    expect(alta.fatores[0].peso).toBeGreaterThan(baixa.fatores[0].peso)
    expect(SEVERIDADE_GRAVIDADE_OCORRENCIA.alta).toBeGreaterThan(SEVERIDADE_GRAVIDADE_OCORRENCIA.baixa)
  })

  it("a ordem e deterministica: mesma entrada embaralhada, mesma lista", () => {
    const itens: ItemParaSaude[] = [
      { id: "a", nome: "Alfa", aba: "motores", status: "vencido", temInformacao: true },
      { id: "b", nome: "Bravo", aba: "motores", status: "vencido", temInformacao: true },
      { id: "c", nome: "Charlie", aba: "motores", status: "vencido", temInformacao: true },
    ]
    const direto = calcularSaudeEmbarcacao(itens, []).fatores.map((f) => f.id)
    const invertido = calcularSaudeEmbarcacao([...itens].reverse(), []).fatores.map((f) => f.id)
    expect(direto).toEqual(invertido)
    expect(direto).toEqual(["a", "b", "c"])
  })
})

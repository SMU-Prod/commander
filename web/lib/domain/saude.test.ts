import { describe, expect, it } from "vitest"
import {
  calcularSaudeEmbarcacao,
  MULTIPLICADOR_ESTADO_OCORRENCIA,
  PESO_CATEGORIA,
  PONTOS_POR_PESO_EFETIVO,
  SEVERIDADE_GRAVIDADE_OCORRENCIA,
  SEVERIDADE_STATUS_ITEM,
  type ItemParaSaude,
  type OcorrenciaParaSaude,
} from "./saude"

const itemOk = (over: Partial<ItemParaSaude> = {}): ItemParaSaude => ({
  id: "item-ok", nome: "Item ok", aba: "motores", status: "ok", temInformacao: true, ...over,
})

describe("calcularSaudeEmbarcacao — barco impecável", () => {
  it("nota 100, Ótimo, sem fatores, quando tudo está ok e informado", () => {
    const itens: ItemParaSaude[] = [
      itemOk({ id: "1", aba: "motores" }),
      itemOk({ id: "2", aba: "documentos" }),
      itemOk({ id: "3", aba: "casco" }),
    ]
    const r = calcularSaudeEmbarcacao(itens, [])
    expect(r.nota).toBe(100)
    expect(r.rotulo).toBe("Ótimo")
    expect(r.fatores).toEqual([])
    expect(r).toMatchObject({ emDia: 3, atencao: 0, vencido: 0, total: 3 })
  })
})

describe("calcularSaudeEmbarcacao — documento vencido pesa mais que atenção genérica", () => {
  it("um documento vencido derruba a nota mais que um item de casco em atenção", () => {
    const base: ItemParaSaude[] = [itemOk({ id: "1" }), itemOk({ id: "2" })]
    const comDocVencido = calcularSaudeEmbarcacao(
      [...base, { id: "doc", nome: "Seguro da embarcação", aba: "documentos", status: "vencido", temInformacao: true }],
      [],
    )
    const comCascoAtencao = calcularSaudeEmbarcacao(
      [...base, { id: "casco", nome: "Verniz do deck", aba: "casco", status: "atencao", temInformacao: true }],
      [],
    )
    expect(comDocVencido.nota).not.toBeNull()
    expect(comCascoAtencao.nota).not.toBeNull()
    expect(comDocVencido.nota!).toBeLessThan(comCascoAtencao.nota!)
    // O fator aparece na lista, com pontos > 0 e identificado.
    expect(comDocVencido.fatores).toHaveLength(1)
    expect(comDocVencido.fatores[0]).toMatchObject({ tipo: "manutencao", id: "doc", aba: "documentos", detalhe: "Vencido" })
    expect(comDocVencido.fatores[0].pontos).toBeGreaterThan(0)
  })

  it("a fórmula é exatamente PESO_CATEGORIA × SEVERIDADE_STATUS_ITEM × PONTOS_POR_PESO_EFETIVO", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "doc", nome: "TIE", aba: "documentos", status: "vencido", temInformacao: true }],
      [],
    )
    const pontosEsperados = PESO_CATEGORIA.documentos * SEVERIDADE_STATUS_ITEM.vencido * PONTOS_POR_PESO_EFETIVO
    expect(r.fatores[0].pontos).toBe(pontosEsperados)
    expect(r.nota).toBe(100 - pontosEsperados)
  })
})

describe("calcularSaudeEmbarcacao — barco só com item estético atrasado", () => {
  it("item de casco em atenção mal arranha a nota (categoria de peso baixo)", () => {
    const r = calcularSaudeEmbarcacao(
      [
        itemOk({ id: "1" }),
        itemOk({ id: "2" }),
        { id: "3", nome: "Verniz do deck", aba: "casco", status: "atencao", temInformacao: true },
      ],
      [],
    )
    expect(r.nota).not.toBeNull()
    expect(r.nota!).toBeGreaterThanOrEqual(90)
    expect(r.rotulo).toBe("Ótimo")
  })
})

describe("calcularSaudeEmbarcacao — ocorrência aberta grave", () => {
  const ocorrenciaGrave = (over: Partial<OcorrenciaParaSaude> = {}): OcorrenciaParaSaude => ({
    id: "oc-1", titulo: "Vazamento no porão", aba: "seguranca", estado: "aberta", gravidade: "alta", ...over,
  })

  it("derruba a nota, aparece nos fatores com a gravidade no detalhe", () => {
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrenciaGrave()])
    expect(r.nota).not.toBeNull()
    expect(r.nota!).toBeLessThan(100)
    expect(r.fatores).toHaveLength(1)
    expect(r.fatores[0]).toMatchObject({ tipo: "ocorrencia", id: "oc-1", aba: "seguranca" })
    expect(r.fatores[0].detalhe).toMatch(/alta/i)
  })

  it("gravidade alta pesa mais que gravidade baixa", () => {
    const alta = calcularSaudeEmbarcacao([], [ocorrenciaGrave({ gravidade: "alta" })])
    const baixa = calcularSaudeEmbarcacao([], [ocorrenciaGrave({ gravidade: "baixa" })])
    expect(alta.nota!).toBeLessThan(baixa.nota!)
  })

  it("sem gravidade registrada nunca inventa 'alta' — usa o mesmo piso de 'baixa'", () => {
    const semGravidade = calcularSaudeEmbarcacao([], [ocorrenciaGrave({ gravidade: null })])
    const comBaixa = calcularSaudeEmbarcacao([], [ocorrenciaGrave({ gravidade: "baixa" })])
    expect(semGravidade.nota).toBe(comBaixa.nota)
  })

  it("em acompanhamento pesa metade de aberta (alguém já está cuidando)", () => {
    const aberta = calcularSaudeEmbarcacao([], [ocorrenciaGrave({ estado: "aberta" })])
    const emAcompanhamento = calcularSaudeEmbarcacao([], [ocorrenciaGrave({ estado: "em_acompanhamento" })])
    expect(aberta.nota!).toBeLessThan(emAcompanhamento.nota!)
    expect(
      PESO_CATEGORIA.seguranca * SEVERIDADE_GRAVIDADE_OCORRENCIA.alta * MULTIPLICADOR_ESTADO_OCORRENCIA.em_acompanhamento,
    ).toBeLessThan(PESO_CATEGORIA.seguranca * SEVERIDADE_GRAVIDADE_OCORRENCIA.alta * MULTIPLICADOR_ESTADO_OCORRENCIA.aberta)
  })

  it("ocorrência resolvida não entra na conta", () => {
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrenciaGrave({ estado: "resolvida" as never })])
    expect(r.nota).toBe(100)
    expect(r.fatores).toEqual([])
  })

  it("estado desconhecido é ignorado em vez de virar NaN na tela", () => {
    // Regressão real: o filtro era "tudo menos resolvida" e havia um `as` que
    // silenciava o TypeScript, então um estado fora dos dois conhecidos
    // (`anulada`, ou qualquer um que venha a existir) chegava na multiplicação
    // como `undefined` e a nota saía NaN — o anel de Início mostraria "NaN%".
    const r = calcularSaudeEmbarcacao([itemOk()], [ocorrenciaGrave({ estado: "anulada" as never })])
    expect(Number.isNaN(r.nota)).toBe(false)
    expect(r.nota).toBe(100)
    expect(r.fatores).toEqual([])
  })
})

describe("calcularSaudeEmbarcacao — sem dado nenhum não há nota", () => {
  it("nenhum item com informação e nenhuma ocorrência: nota e rótulo nulos", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "1", nome: "Item novo", aba: "motores", status: "ok", temInformacao: false }],
      [],
    )
    expect(r.nota).toBeNull()
    expect(r.rotulo).toBeNull()
    expect(r.fatores).toEqual([])
    expect(r.total).toBe(0)
  })

  it("uma ocorrência aberta já basta pra existir nota, mesmo sem nenhum item com informação", () => {
    const r = calcularSaudeEmbarcacao(
      [{ id: "1", nome: "Item novo", aba: "motores", status: "ok", temInformacao: false }],
      [{ id: "oc", titulo: "Algo quebrou", aba: "motores", estado: "aberta", gravidade: null }],
    )
    expect(r.nota).not.toBeNull()
  })

  it("item sem informação continua fora da conta mesmo quando outros itens têm dado", () => {
    const r = calcularSaudeEmbarcacao(
      [
        itemOk({ id: "1", temInformacao: true }),
        { id: "2", nome: "Sem dado", aba: "motores", status: "ok", temInformacao: false },
      ],
      [],
    )
    expect(r.total).toBe(1)
    expect(r.nota).toBe(100)
  })
})

describe("calcularSaudeEmbarcacao — monotonicidade: piorar um item nunca aumenta a nota", () => {
  it("ok -> atenção -> vencido só pode manter ou reduzir a nota", () => {
    const montar = (status: "ok" | "atencao" | "vencido") =>
      calcularSaudeEmbarcacao([{ id: "1", nome: "Extintor", aba: "seguranca", status, temInformacao: true }], []).nota!

    const ok = montar("ok")
    const atencao = montar("atencao")
    const vencido = montar("vencido")
    expect(atencao).toBeLessThanOrEqual(ok)
    expect(vencido).toBeLessThanOrEqual(atencao)
    expect(vencido).toBeLessThan(ok)
  })

  it("adicionar uma ocorrência aberta nunca aumenta a nota", () => {
    const itens: ItemParaSaude[] = [itemOk({ id: "1" }), itemOk({ id: "2" })]
    const sem = calcularSaudeEmbarcacao(itens, []).nota!
    const com = calcularSaudeEmbarcacao(
      itens,
      [{ id: "oc", titulo: "Problema", aba: "motores", estado: "aberta", gravidade: "baixa" }],
    ).nota!
    expect(com).toBeLessThanOrEqual(sem)
  })

  it("piorar a gravidade de uma ocorrência nunca aumenta a nota", () => {
    const montar = (gravidade: "baixa" | "media" | "alta") =>
      calcularSaudeEmbarcacao(
        [],
        [{ id: "oc", titulo: "Problema", aba: "motores", estado: "aberta", gravidade }],
      ).nota!
    const baixa = montar("baixa")
    const media = montar("media")
    const alta = montar("alta")
    expect(media).toBeLessThanOrEqual(baixa)
    expect(alta).toBeLessThanOrEqual(media)
  })

  it("nota nunca fica negativa mesmo com muitos problemas graves", () => {
    const itens: ItemParaSaude[] = Array.from({ length: 10 }, (_, i) => ({
      id: `doc-${i}`, nome: `Documento ${i}`, aba: "documentos" as const, status: "vencido" as const, temInformacao: true,
    }))
    const r = calcularSaudeEmbarcacao(itens, [])
    expect(r.nota).toBe(0)
    expect(r.rotulo).toBe("Crítico")
  })
})

describe("calcularSaudeEmbarcacao — fatores ordenados por impacto decrescente", () => {
  it("o problema que mais pesa vem primeiro", () => {
    const r = calcularSaudeEmbarcacao(
      [
        { id: "casco", nome: "Verniz", aba: "casco", status: "atencao", temInformacao: true },
        { id: "doc", nome: "Seguro", aba: "documentos", status: "vencido", temInformacao: true },
      ],
      [],
    )
    expect(r.fatores.map((f) => f.id)).toEqual(["doc", "casco"])
  })
})

import { describe, expect, it } from "vitest"
import {
  HUBS_CHECKLIST_DIARIO,
  itensQueViramOcorrencia,
  lerChecklistDoFormulario,
  tituloDaObservacaoChecklist,
} from "./checklist-diario"

describe("lerChecklistDoFormulario", () => {
  it("hub nao tocado nao entra no resultado — silencio nao vira OK inventado", () => {
    expect(lerChecklistDoFormulario(() => null)).toEqual([])
  })

  it("OK GERAL marca os 5 hubs de uma vez", () => {
    const campos: Record<string, string> = {}
    for (const hub of HUBS_CHECKLIST_DIARIO) campos[`checklist_${hub}_estado`] = "ok"
    const itens = lerChecklistDoFormulario((k) => campos[k] ?? null)
    expect(itens).toHaveLength(5)
    expect(itens.every((i) => i.estado === "ok" && i.nota === null)).toBe(true)
  })

  it("hub tocado individualmente como observacao carrega a nota", () => {
    const campos: Record<string, string> = {
      checklist_casco_estado: "observacao",
      checklist_casco_nota: "arranhao no costado BB",
    }
    const itens = lerChecklistDoFormulario((k) => campos[k] ?? null)
    expect(itens).toEqual([{ hub: "casco", estado: "observacao", nota: "arranhao no costado BB" }])
  })

  it("mistura hubs OK e observacao, ignorando os nao tocados", () => {
    const campos: Record<string, string> = {
      checklist_motores_estado: "ok",
      checklist_seguranca_estado: "observacao",
      checklist_seguranca_nota: "colete sumiu",
    }
    const itens = lerChecklistDoFormulario((k) => campos[k] ?? null)
    expect(itens).toEqual([
      { hub: "motores", estado: "ok", nota: null },
      { hub: "seguranca", estado: "observacao", nota: "colete sumiu" },
    ])
  })

  it("estado com valor invalido e tratado como nao tocado", () => {
    const itens = lerChecklistDoFormulario((k) => (k === "checklist_casco_estado" ? "lixo" : null))
    expect(itens).toEqual([])
  })
})

describe("tituloDaObservacaoChecklist", () => {
  it("nota curta vira o proprio titulo, sem cortar", () => {
    expect(tituloDaObservacaoChecklist("luz de navegacao BE falhou")).toBe("luz de navegacao BE falhou")
  })

  it("nota longa corta em ~60 chars numa fronteira de palavra, com reticencias", () => {
    const nota = "a bomba de porao ligou sozinha varias vezes durante a saida de hoje, sem motivo aparente"
    const titulo = tituloDaObservacaoChecklist(nota)
    expect(titulo.length).toBeLessThanOrEqual(61)
    expect(titulo.endsWith("…")).toBe(true)
    expect(titulo.endsWith(" …")).toBe(false)
  })

  it("espacos nas pontas nao contam pro tamanho", () => {
    expect(tituloDaObservacaoChecklist("  ok  ")).toBe("ok")
  })
})

describe("itensQueViramOcorrencia", () => {
  it("observacao sem a caixa marcada fica so no checklist, sem ocorrencia", () => {
    const itens = [{ hub: "casco" as const, estado: "observacao" as const, nota: "risco leve" }]
    expect(itensQueViramOcorrencia(itens, () => false)).toEqual([])
  })

  it("observacao com a caixa marcada vira ocorrencia com titulo derivado da nota", () => {
    const itens = [{ hub: "seguranca" as const, estado: "observacao" as const, nota: "colete sumiu" }]
    const r = itensQueViramOcorrencia(itens, () => true)
    expect(r).toEqual([{ hub: "seguranca", titulo: "colete sumiu", descricao: "colete sumiu" }])
  })

  it("hub OK nunca vira ocorrencia, mesmo se a caixa (inexistente) fosse marcada", () => {
    const itens = [{ hub: "motores" as const, estado: "ok" as const, nota: null }]
    expect(itensQueViramOcorrencia(itens, () => true)).toEqual([])
  })

  it("observacao com nota vazia nao vira ocorrencia", () => {
    const itens = [{ hub: "casco" as const, estado: "observacao" as const, nota: "   " }]
    expect(itensQueViramOcorrencia(itens, () => true)).toEqual([])
  })
})

import { describe, expect, it } from "vitest"
import { indiceDoDestaque, resumoDosDocumentos } from "./documentos"
import type { ResultadoCalc } from "./semaforo"

describe("resumoDosDocumentos — o subtítulo do cabeçalho (canvas tela-3d)", () => {
  it("diz os problemas quando existem", () => {
    expect(resumoDosDocumentos(8, 5, 1, 1)).toBe("8 documentos · 1 vencido, 1 na margem.")
    expect(resumoDosDocumentos(8, 5, 2, 0)).toBe("8 documentos · 2 vencidos.")
    expect(resumoDosDocumentos(8, 5, 0, 3)).toBe("8 documentos · 3 na margem.")
  })
  it("sem problema mas com acompanhamento diz 'nenhum vencido' — nunca um 'em dia' que incluiria avulsos", () => {
    expect(resumoDosDocumentos(4, 2, 0, 0)).toBe("4 documentos · nenhum vencido.")
  })
  it("só arquivos avulsos: a frase para na contagem, sem estado inventado", () => {
    expect(resumoDosDocumentos(3, 0, 0, 0)).toBe("3 documentos.")
    expect(resumoDosDocumentos(1, 0, 0, 0)).toBe("1 documento.")
  })
  it("sem documento nenhum não há frase — o vazio da lista fala", () => {
    expect(resumoDosDocumentos(0, 0, 0, 0)).toBeNull()
  })
})

describe("indiceDoDestaque — qual vencido vira o cartão (canvas tela-3d)", () => {
  const r = (status: ResultadoCalc["status"], diasRestantes: number | null = null): ResultadoCalc => ({
    status,
    horasRestantes: null,
    diasRestantes,
  })

  it("escolhe o vencido há mais tempo", () => {
    expect(indiceDoDestaque([r("ok"), r("vencido", -3), r("vencido", -19), r("atencao", 17)])).toBe(2)
  })
  it("nenhum vencido, nenhum destaque", () => {
    expect(indiceDoDestaque([r("ok"), r("atencao", 17)])).toBeNull()
    expect(indiceDoDestaque([])).toBeNull()
  })
  it("vencido sem dias conhecidos ainda pode ser o destaque (único vencido)", () => {
    expect(indiceDoDestaque([r("ok"), r("vencido", null)])).toBe(1)
  })
  it("empate fica com o primeiro — mesma entrada, mesma tela", () => {
    expect(indiceDoDestaque([r("vencido", -5), r("vencido", -5)])).toBe(0)
  })
})

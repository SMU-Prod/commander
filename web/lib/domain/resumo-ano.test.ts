import { describe, expect, it } from "vitest"
import { resumoAno, type EventoParaResumoAno } from "./resumo-ano"

function evento(parcial: Partial<EventoParaResumoAno>): EventoParaResumoAno {
  return {
    tipo: "navegacao",
    data: "2026-03-10",
    hora_saida: null,
    hora_retorno: null,
    distancia_nm: null,
    ...parcial,
  }
}

describe("resumoAno", () => {
  it("sem nenhuma saída no ano, devolve null (nada de zero espalhafatoso)", () => {
    expect(resumoAno([], 2026)).toBeNull()
    expect(resumoAno([evento({ data: "2025-12-31" })], 2026)).toBeNull()
  })

  it("ignora eventos que não são navegação", () => {
    const eventos = [
      evento({ tipo: "manutencao", data: "2026-01-05" }),
      evento({ tipo: "abastecimento", data: "2026-02-05" }),
    ]
    expect(resumoAno(eventos, 2026)).toBeNull()
  })

  it("conta saídas do ano certo, ignora outros anos", () => {
    const eventos = [
      evento({ data: "2026-01-10", hora_saida: "08:00", hora_retorno: "10:00" }),
      evento({ data: "2026-06-10", hora_saida: "08:00", hora_retorno: "09:00" }),
      evento({ data: "2025-06-10", hora_saida: "08:00", hora_retorno: "09:00" }),
    ]
    const r = resumoAno(eventos, 2026)
    expect(r?.saidas).toBe(2)
  })

  it("milhas só somam quando existe distância gravada — nunca estimadas", () => {
    const eventos = [
      evento({ data: "2026-01-10", distancia_nm: 6, hora_saida: "08:00", hora_retorno: "09:00" }),
      evento({ data: "2026-01-11", distancia_nm: null, hora_saida: "08:00", hora_retorno: "10:00" }),
    ]
    const r = resumoAno(eventos, 2026)
    expect(r?.saidas).toBe(2)
    expect(r?.milhasNm).toBeCloseTo(6, 1)
  })

  it("saída SEM trilha não vira zero na média: ela não entra na soma", () => {
    // As duas saídas contam como saída; só uma tem distância. O total é o da
    // que tem — a outra não empurra a soma pra baixo nem pra cima.
    const eventos = [
      evento({ data: "2026-01-10", distancia_nm: 12.4 }),
      evento({ data: "2026-01-11" }),
    ]
    const r = resumoAno(eventos, 2026)
    expect(r?.saidas).toBe(2)
    expect(r?.milhasNm).toBeCloseTo(12.4, 5)
  })

  it("distância gravada como zero É um número: trilha que não saiu do lugar soma zero", () => {
    // Diferente de `null`: aqui existe traçado, ele só não andou. A conta é a
    // mesma de antes (a soma não muda), mas o significado é outro — e é o que
    // permite a tela distinguir "sem GPS" de "0 MN".
    const r = resumoAno([evento({ data: "2026-01-10", distancia_nm: 0 })], 2026)
    expect(r?.milhasNm).toBe(0)
  })

  it("horas no mar somam a duração (saída→retorno) de cada saída do ano", () => {
    const eventos = [
      evento({ data: "2026-01-10", hora_saida: "08:00", hora_retorno: "11:30" }), // 3.5h
      evento({ data: "2026-02-10", hora_saida: "09:00", hora_retorno: "10:00" }), // 1h
      evento({ data: "2026-03-10", hora_saida: null, hora_retorno: null }), // sem horas — não soma
    ]
    const r = resumoAno(eventos, 2026)
    expect(r?.saidas).toBe(3)
    expect(r?.horasNoMar).toBeCloseTo(4.5, 5)
  })
})

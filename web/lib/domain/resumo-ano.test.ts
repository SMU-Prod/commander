import { describe, expect, it } from "vitest"
import { resumoAno, type EventoParaResumoAno } from "./resumo-ano"

function evento(parcial: Partial<EventoParaResumoAno>): EventoParaResumoAno {
  return {
    tipo: "navegacao",
    data: "2026-03-10",
    hora_saida: null,
    hora_retorno: null,
    trilha: null,
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

  it("milhas só somam quando existe trilha GPS — nunca estimadas", () => {
    const trilha = [
      { t: 0, la: 0, lo: 0 },
      { t: 3600, la: 0.1, lo: 0 }, // 6 nm em 1h
    ]
    const eventos = [
      evento({ data: "2026-01-10", trilha, hora_saida: "08:00", hora_retorno: "09:00" }),
      evento({ data: "2026-01-11", trilha: null, hora_saida: "08:00", hora_retorno: "10:00" }),
    ]
    const r = resumoAno(eventos, 2026)
    expect(r?.saidas).toBe(2)
    expect(r?.milhasNm).toBeCloseTo(6, 1)
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

  it("trilha de 1 ponto (ou menos) não conta como trilha válida", () => {
    const eventos = [
      evento({ data: "2026-01-10", trilha: [{ t: 0, la: 0, lo: 0 }], hora_saida: "08:00", hora_retorno: "09:00" }),
    ]
    const r = resumoAno(eventos, 2026)
    expect(r?.milhasNm).toBe(0)
  })
})

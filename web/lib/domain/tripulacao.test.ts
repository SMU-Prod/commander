import { describe, expect, it } from "vitest"
import { horasNoMarCurto, usoPorTripulante, type SaidaParaTripulante } from "./tripulacao"

function saida(parcial: Partial<SaidaParaTripulante>): SaidaParaTripulante {
  return { tipo: "navegacao", criado_por: "ana", hora_saida: "09:00", hora_retorno: "12:00", ...parcial }
}

describe("usoPorTripulante — os micro-KPIs do cartão de pessoa (canvas tela-1f)", () => {
  it("conta saídas e soma horas por autor", () => {
    const indice = usoPorTripulante([
      saida({}),
      saida({ hora_saida: "14:00", hora_retorno: "16:30" }),
      saida({ criado_por: "beto", hora_saida: "08:00", hora_retorno: "09:00" }),
    ])
    expect(indice.get("ana")).toEqual({ saidas: 2, horasNoMar: 5.5 })
    expect(indice.get("beto")).toEqual({ saidas: 1, horasNoMar: 1 })
  })

  it("só saída (navegacao) entra — manutenção e abastecimento não são currículo de mar", () => {
    const indice = usoPorTripulante([saida({ tipo: "manutencao" }), saida({ tipo: "abastecimento" })])
    expect(indice.size).toBe(0)
  })

  it("evento sem autor não é atribuído a ninguém", () => {
    expect(usoPorTripulante([saida({ criado_por: null })]).size).toBe(0)
  })

  it("saída sem par de horários conta como saída mas não soma hora — nada de hora inventada", () => {
    const indice = usoPorTripulante([saida({ hora_retorno: null })])
    expect(indice.get("ana")).toEqual({ saidas: 1, horasNoMar: 0 })
  })

  it("virada de meia-noite usa a mesma régua do Diário (duracaoHoras)", () => {
    const indice = usoPorTripulante([saida({ hora_saida: "22:00", hora_retorno: "01:30" })])
    expect(indice.get("ana")?.horasNoMar).toBe(3.5)
  })
})

describe("horasNoMarCurto", () => {
  it("arredonda pra hora inteira com unidade", () => {
    expect(horasNoMarCurto({ saidas: 3, horasNoMar: 5.5 })).toBe("6 h")
    expect(horasNoMarCurto({ saidas: 1, horasNoMar: 1 })).toBe("1 h")
  })
  it("zero hora registrada vira traço — '0 h' afirmaria o que ninguém registrou", () => {
    expect(horasNoMarCurto({ saidas: 2, horasNoMar: 0 })).toBe("—")
  })
})

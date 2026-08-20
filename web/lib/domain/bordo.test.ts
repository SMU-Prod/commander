import { describe, expect, it } from "vitest"
import {
  duracaoHoras,
  horasSugeridas,
  lerPassageiros,
  retornoNoDiaSeguinte,
  textoDuracao,
  tituloDaSaida,
  tituloDoRegistro,
} from "./bordo"

describe("duracaoHoras", () => {
  it("calcula a duracao entre saida e retorno", () => {
    expect(duracaoHoras("08:00", "12:30")).toBeCloseTo(4.5, 2)
    expect(duracaoHoras("09:15", "10:00")).toBeCloseTo(0.75, 2)
  })
  it("retorno depois da meia-noite conta como no dia seguinte", () => {
    expect(duracaoHoras("22:00", "01:30")).toBeCloseTo(3.5, 2)
  })
  it("sem uma das pontas, sem duracao", () => {
    expect(duracaoHoras(null, "12:00")).toBeNull()
    expect(duracaoHoras("08:00", null)).toBeNull()
    expect(duracaoHoras("08:00", "08:00")).toBeNull()
  })
})

describe("horasSugeridas", () => {
  it("arredonda para o decimo de hora — e o que se lanca no horimetro", () => {
    expect(horasSugeridas(4.47)).toBe(4.5)
    expect(horasSugeridas(0.75)).toBe(0.8)
  })
  it("saida curta demais nao sugere nada", () => {
    expect(horasSugeridas(0.2)).toBeNull()
    expect(horasSugeridas(null)).toBeNull()
  })
})

describe("textoDuracao", () => {
  it("fala a lingua do canvas: minuto com dois digitos, sem 'min' quando ha horas", () => {
    // tela-3a do canvas: "4 h 20", "6 h 05" — o zero a esquerda mantem as
    // duracoes alinhadas quando ficam lado a lado em fonte tabular.
    expect(textoDuracao(4.5)).toBe("4 h 30")
    expect(textoDuracao(6 + 5 / 60)).toBe("6 h 05")
    expect(textoDuracao(2)).toBe("2 h")
  })
  it("menos de uma hora continua em minutos, sem '0 h' na frente", () => {
    expect(textoDuracao(0.5)).toBe("30 min")
  })
})

describe("tituloDaSaida", () => {
  it("com os dois lados, a rota vira o titulo — canvas tela-3a", () => {
    expect(tituloDaSaida("Angra dos Reis", "Ilha Grande")).toBe("Angra dos Reis → Ilha Grande")
  })
  it("com um lado so, o titulo e esse lado — sem seta pra lugar nenhum", () => {
    expect(tituloDaSaida(null, "Ilha Grande")).toBe("Ilha Grande")
    expect(tituloDaSaida("Marina da Glória", null)).toBe("Marina da Glória")
  })
  it("sem nenhum, devolve null — o feed cai no rotulo do tipo, nunca inventa rota", () => {
    expect(tituloDaSaida(null, null)).toBeNull()
    expect(tituloDaSaida("  ", "")).toBeNull()
  })
})

describe("tituloDoRegistro", () => {
  it("a descricao digitada vira o titulo, com o equipamento atras", () => {
    expect(tituloDoRegistro("Manutenção", "troca de impelidor", "Motor BB"))
      .toBe("Troca de impelidor — Motor BB")
  })
  // Onda 122: o cartucho do cartao ja diz "Abastecimento" — o titulo
  // repetindo o tipo era a mesma redundancia dos subtitulos que o dono
  // mandou cortar. A descricao fica sozinha.
  it("o titulo nao repete o tipo que o cartucho ja diz", () => {
    expect(tituloDoRegistro("Abastecimento", "320 L", null)).toBe("320 L")
  })
  it("sem descricao, o equipamento responde; sem os dois, sobra o rotulo do tipo — nunca titulo inventado", () => {
    expect(tituloDoRegistro("Avaria", null, null)).toBe("Avaria")
    expect(tituloDoRegistro("Docagem", "  ", "Motor BE")).toBe("Motor BE")
  })
})

describe("entradas malformadas", () => {
  it("nao deixa NaN vazar para a tela", () => {
    expect(duracaoHoras("08", "12:00")).toBeNull()
    expect(duracaoHoras("", "12:00")).toBeNull()
    expect(duracaoHoras("25:00", "12:00")).toBeNull()
    expect(duracaoHoras("08:99", "12:00")).toBeNull()
  })
})

describe("retornoNoDiaSeguinte", () => {
  it("marca a travessia da meia-noite", () => {
    expect(retornoNoDiaSeguinte("22:00", "01:30")).toBe(true)
    expect(retornoNoDiaSeguinte("08:00", "12:00")).toBe(false)
    expect(retornoNoDiaSeguinte(null, "12:00")).toBe(false)
  })
})

describe("lerPassageiros", () => {
  it("separa por virgula e limpa espaco", () => {
    expect(lerPassageiros("Pedro, Ana,João ")).toEqual(["Pedro", "Ana", "João"])
  })

  it("campo vazio ou nulo nao vira passageiro", () => {
    expect(lerPassageiros(null)).toEqual([])
    expect(lerPassageiros("")).toEqual([])
    expect(lerPassageiros("  ,  ")).toEqual([])
  })

  it("virgula sobrando nao cria passageiro anonimo", () => {
    expect(lerPassageiros("Pedro,,Ana,")).toEqual(["Pedro", "Ana"])
  })

  it("nao deduplica: dois Joao a bordo sao duas pessoas", () => {
    expect(lerPassageiros("João, João")).toEqual(["João", "João"])
  })
})

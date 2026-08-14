import { describe, expect, it } from "vitest"
import { ANCORA_MENSAL_CENTAVOS, formatarPreco, PLANOS, proximoUpgrade, VAGAS_FUNDADOR, vagasRestantes } from "./planos"

describe("planos", () => {
  it("fundador mensal custa R$ 69,99 e o anual 10x isso (2 meses gratis)", () => {
    expect(PLANOS.fundador_mensal.valorCentavos).toBe(6999)
    expect(PLANOS.fundador_anual.valorCentavos).toBe(69990)
    expect(PLANOS.fundador_anual.valorCentavos).toBe(PLANOS.fundador_mensal.valorCentavos * 10)
  })
  it("ancora e o preco cheio mensal", () => {
    expect(ANCORA_MENSAL_CENTAVOS).toBe(11990)
    expect(ANCORA_MENSAL_CENTAVOS).toBeGreaterThan(PLANOS.fundador_mensal.valorCentavos)
  })
  it("ciclos batem com os valores que o Asaas espera", () => {
    expect(PLANOS.fundador_mensal.ciclo).toBe("MONTHLY")
    expect(PLANOS.fundador_anual.ciclo).toBe("YEARLY")
  })
  it("vagasRestantes nunca fica negativo", () => {
    expect(vagasRestantes(0)).toBe(VAGAS_FUNDADOR)
    expect(vagasRestantes(37)).toBe(VAGAS_FUNDADOR - 37)
    expect(vagasRestantes(150)).toBe(0)
  })
  it("formatarPreco escreve em reais pt-BR", () => {
    expect(formatarPreco(6999)).toBe("R$ 69,99")
    expect(formatarPreco(69990)).toBe("R$ 699,90")
    expect(formatarPreco(11990)).toBe("R$ 119,90")
  })
})

describe("proximoUpgrade", () => {
  it("mensal pode subir para anual", () => {
    expect(proximoUpgrade("fundador_mensal")).toBe("fundador_anual")
  })
  it("anual ja esta no melhor ciclo, sem upgrade", () => {
    expect(proximoUpgrade("fundador_anual")).toBeNull()
  })
})

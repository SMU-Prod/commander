import { describe, expect, it } from "vitest"
import { formatarEta } from "./eta"

describe("formatarEta", () => {
  it("abaixo de uma hora fica em minutos", () => {
    expect(formatarEta(0)).toBe("~0 min")
    expect(formatarEta(48)).toBe("~48 min")
    expect(formatarEta(59)).toBe("~59 min")
  })

  it("de uma hora pra cima quebra em horas e minutos, com dois dígitos", () => {
    expect(formatarEta(60)).toBe("~1 h 00 min")
    expect(formatarEta(68)).toBe("~1 h 08 min")
    expect(formatarEta(200)).toBe("~3 h 20 min")
  })

  it("arredonda o minuto quebrado em vez de mostrar decimal", () => {
    expect(formatarEta(47.6)).toBe("~48 min")
  })

  // A regra da casa: sem dado o app não escreve zero. Sem velocidade
  // utilizável `etaMinutos` devolve null, e null não vira "0 min".
  it("sem ETA escreve o travessão, nunca zero", () => {
    expect(formatarEta(null)).toBe("—")
    expect(formatarEta(undefined)).toBe("—")
    expect(formatarEta(Number.NaN)).toBe("—")
    expect(formatarEta(-3)).toBe("—")
  })
})

import { describe, expect, it } from "vitest"
import { COTA_MB, cotaDoPlano, formatarBytes, usoDaCota } from "./cota"

const MB = 1024 * 1024

describe("usoDaCota", () => {
  it("vazio", () => {
    const u = usoDaCota(0)
    expect(u.percentual).toBe(0)
    expect(u.cheio).toBe(false)
    expect(u.limiteBytes).toBe(COTA_MB * MB)
  })
  it("metade", () => {
    const u = usoDaCota((COTA_MB / 2) * MB)
    expect(u.percentual).toBe(50)
    expect(u.restanteBytes).toBe((COTA_MB / 2) * MB)
  })
  it("cheio no limite e acima", () => {
    expect(usoDaCota(COTA_MB * MB).cheio).toBe(true)
    expect(usoDaCota(COTA_MB * MB * 2).percentual).toBe(100)
    expect(usoDaCota(COTA_MB * MB * 2).restanteBytes).toBe(0)
  })
})

describe("cotaDoPlano", () => {
  it("Free mostra a contagem — o teto que barra o envio, não os bytes", () => {
    const c = cotaDoPlano("proprietario_free", 3, 490 * MB)
    expect(c.valor).toBe("3 / 8")
    expect(c.percentual).toBe(38)
    expect(c.critico).toBe(false)
  })
  it("Free no teto fica crítico", () => {
    const c = cotaDoPlano("proprietario_free", 8, 0)
    expect(c.valor).toBe("8 / 8")
    expect(c.critico).toBe(true)
  })
  it("Free acima do teto (§23) mostra o número real, nunca o teto disfarçado", () => {
    const c = cotaDoPlano("proprietario_free", 12, 0)
    expect(c.valor).toBe("12 / 8")
    expect(c.percentual).toBe(100)
    expect(c.critico).toBe(true)
  })
  it("pago mostra o espaço — contagem não tem teto no Commander", () => {
    const c = cotaDoPlano("commander", 200, (COTA_MB / 2) * MB)
    expect(c.valor).toBe("250 MB / 500 MB")
    expect(c.percentual).toBe(50)
    expect(c.critico).toBe(false)
  })
  it("pago acima de 90% do espaço fica crítico", () => {
    const c = cotaDoPlano("commander_pro", 10, COTA_MB * MB * 0.95)
    expect(c.critico).toBe(true)
  })
})

describe("formatarBytes", () => {
  it("escala pt-BR", () => {
    expect(formatarBytes(0)).toBe("0 KB")
    expect(formatarBytes(48 * 1024)).toBe("48 KB")
    expect(formatarBytes(320 * MB)).toBe("320 MB")
    expect(formatarBytes(1.4 * 1024 * MB)).toBe("1,4 GB")
  })
})

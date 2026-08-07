import { describe, expect, it } from "vitest"
import { COTA_MB, formatarBytes, usoDaCota } from "./cota"

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

describe("formatarBytes", () => {
  it("escala pt-BR", () => {
    expect(formatarBytes(0)).toBe("0 KB")
    expect(formatarBytes(48 * 1024)).toBe("48 KB")
    expect(formatarBytes(320 * MB)).toBe("320 MB")
    expect(formatarBytes(1.4 * 1024 * MB)).toBe("1,4 GB")
  })
})

import { describe, expect, it } from "vitest"
import { criarTransporteNativo, transporteNativoDisponivel } from "./nativo"

describe("transporte nativo (stub — o shell Capacitor preenche depois)", () => {
  it("indisponível no navegador", () => {
    expect(transporteNativoDisponivel()).toBe(false)
  })

  it("criarTransporteNativo devolve null enquanto indisponível", () => {
    expect(criarTransporteNativo()).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import { ESTADOS_SELO, rotuloDoSelo } from "./selo"

describe("Selo", () => {
  it("todo estado tem palavra — cor sozinha exclui quem não distingue verde de vermelho", () => {
    for (const e of ESTADOS_SELO) {
      expect(rotuloDoSelo(e).trim().length).toBeGreaterThan(0)
    }
  })

  it("os rotulos nao usam porcentagem nem numero (PRD 1.1)", () => {
    for (const e of ESTADOS_SELO) {
      expect(rotuloDoSelo(e)).not.toMatch(/\d|%/)
    }
  })
})

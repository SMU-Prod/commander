import { describe, expect, it } from "vitest"
import { validarLeitura } from "./leituras"

describe("validarLeitura", () => {
  it("aceita leitura maior que a atual", () => {
    expect(validarLeitura(1510, 1503.4)).toEqual({ ok: true })
  })
  it("aceita igual à atual (saída sem uso de motor)", () => {
    expect(validarLeitura(1503.4, 1503.4)).toEqual({ ok: true })
  })
  it("recusa leitura menor que a atual", () => {
    const r = validarLeitura(1400, 1503.4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain("menor")
  })
  it("recusa salto absurdo (mais de 500 h de uma vez)", () => {
    expect(validarLeitura(2100, 1503.4).ok).toBe(false)
  })
  it("aceita primeira leitura quando não há horas atuais", () => {
    expect(validarLeitura(120, null)).toEqual({ ok: true })
  })
  it("recusa valores não positivos ou não numéricos", () => {
    expect(validarLeitura(-5, null).ok).toBe(false)
    expect(validarLeitura(Number.NaN, null).ok).toBe(false)
  })
})

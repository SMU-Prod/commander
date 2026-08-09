import { describe, expect, it } from "vitest"
import { devePropagarLeitura, validarLeitura } from "./leituras"

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

describe("devePropagarLeitura", () => {
  it("propaga quando não há leitura atual (primeira leitura)", () => {
    expect(devePropagarLeitura(620, null)).toBe(true)
  })
  it("propaga quando a nova leitura é maior que a atual", () => {
    expect(devePropagarLeitura(620, 610)).toBe(true)
  })
  it("propaga quando a nova leitura é igual à atual", () => {
    expect(devePropagarLeitura(610, 610)).toBe(true)
  })
  it("não propaga quando a nova leitura é menor que a atual (correção manual, não regride)", () => {
    expect(devePropagarLeitura(590, 610)).toBe(false)
  })
  it("propaga saltos grandes (evento do diário pode ser meses depois da última leitura)", () => {
    expect(devePropagarLeitura(1500, 610)).toBe(true)
  })
})

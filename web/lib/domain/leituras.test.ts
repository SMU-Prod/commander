import { describe, expect, it } from "vitest"
import { carimboDaLeitura, devePropagarLeitura, validarLeitura } from "./leituras"

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

describe("carimboDaLeitura — o carimbo humano do horímetro (canvas tela-3c)", () => {
  // `agora` fixo pra data relativa ("hoje"/"ontem") ser determinística.
  const AGORA = new Date("2026-08-16T18:00:00-03:00")

  it("data antiga sai com dia/mês e hora, com autor", () => {
    expect(carimboDaLeitura("2026-08-09T21:40:00+00:00", "Erick", AGORA)).toBe(
      "Informado à mão em 09/08, 18:40 por Erick.",
    )
  })
  it("carimbo de hoje concorda com a frase (nunca 'em Hoje')", () => {
    expect(carimboDaLeitura("2026-08-16T12:30:00-03:00", "Ana", AGORA)).toBe(
      "Informado à mão hoje, 12:30 por Ana.",
    )
  })
  it("carimbo de ontem idem", () => {
    expect(carimboDaLeitura("2026-08-15T08:05:00-03:00", null, AGORA)).toBe(
      "Informado à mão ontem, 08:05.",
    )
  })
  it("sem autor conhecido a frase fica só com o quando — nunca inventa nome", () => {
    expect(carimboDaLeitura("2026-08-09T21:40:00+00:00", null, AGORA)).toBe(
      "Informado à mão em 09/08, 18:40.",
    )
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

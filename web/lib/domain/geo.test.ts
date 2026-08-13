import { describe, expect, it } from "vitest"
import { celulaGeografica, haversineNm, resumoTrilha } from "./geo"

describe("haversineNm", () => {
  it("1 minuto de latitude ≈ 1 milha náutica", () => {
    expect(haversineNm({ la: 0, lo: 0 }, { la: 1 / 60, lo: 0 })).toBeCloseTo(1, 2)
  })
  it("mesmo ponto = 0", () => {
    expect(haversineNm({ la: -22.9, lo: -43.1 }, { la: -22.9, lo: -43.1 })).toBe(0)
  })
})

describe("resumoTrilha", () => {
  it("trilha vazia ou de 1 ponto zera tudo", () => {
    expect(resumoTrilha([])).toEqual({ distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 })
    expect(resumoTrilha([{ t: 0, la: 0, lo: 0 }]).duracaoH).toBe(0)
  })
  it("1h navegando a 6 kt + 1h parado", () => {
    const r = resumoTrilha([
      { t: 0, la: 0, lo: 0 },
      { t: 3600, la: 0.1, lo: 0 },   // 6 nm em 1 h → 6 kt
      { t: 7200, la: 0.1, lo: 0 },   // parado 1 h
    ])
    expect(r.distanciaNm).toBeCloseTo(6, 1)
    expect(r.duracaoH).toBeCloseTo(2, 5)
    expect(r.tempoMovimentoH).toBeCloseTo(1, 5)
    expect(r.velMediaKt).toBeCloseTo(6, 1)
    expect(r.velMaxKt).toBeCloseTo(6, 1)
  })
  it("velMaxKt pega o segmento mais rápido", () => {
    const r = resumoTrilha([
      { t: 0, la: 0, lo: 0 },
      { t: 1800, la: 0.05, lo: 0 },  // 3 nm em 0,5 h → 6 kt
      { t: 3600, la: 0.15, lo: 0 },  // 6 nm em 0,5 h → 12 kt
    ])
    expect(r.velMaxKt).toBeCloseTo(12, 1)
    expect(r.velMediaKt).toBeCloseTo(9, 1)
  })
})

describe("celulaGeografica", () => {
  it("dois pontos dentro da mesma célula caem na mesma chave", () => {
    const a = celulaGeografica(-22.91, -43.17, 0.05)
    const b = celulaGeografica(-22.93, -43.19, 0.05)
    expect(a).toBe(b)
  })
  it("pontos em células vizinhas caem em chaves diferentes", () => {
    const a = celulaGeografica(-22.91, -43.17, 0.05)
    const b = celulaGeografica(-22.97, -43.17, 0.05) // ~6,7 km ao sul, célula de 0.05° (~5,5 km)
    expect(a).not.toBe(b)
  })
  it("célula maior agrupa pontos que uma célula menor separaria", () => {
    const fina = celulaGeografica(-22.91, -43.17, 0.01) !== celulaGeografica(-22.94, -43.17, 0.01)
    const grossa = celulaGeografica(-22.91, -43.17, 0.2) === celulaGeografica(-22.94, -43.17, 0.2)
    expect(fina).toBe(true)
    expect(grossa).toBe(true)
  })
})

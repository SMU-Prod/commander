import { describe, expect, it } from "vitest"
import { formatarMN, maisProximos } from "./explorar"

// Pontos reais da baía da Ilha Grande — os mesmos lugares que o canvas
// tela-3h desenha (Verolme, Bracuhy, Abraão), pra conferir que a ordem de
// proximidade bate com a geografia de verdade.
const VEROLME = { id: "verolme", lat: -22.9754, lng: -44.3046 }
const BRACUHY = { id: "bracuhy", lat: -22.9528, lng: -44.3931 }
const ABRAAO = { id: "abraao", lat: -23.1396, lng: -44.1699 }

describe("formatarMN — distância do canvas: vírgula, uma casa, unidade MN", () => {
  it("uma casa decimal com vírgula de pt-BR", () => {
    expect(formatarMN(0.42)).toBe("0,4 MN")
    expect(formatarMN(11.83)).toBe("11,8 MN")
  })

  it("zero é distância válida (você está em cima do ponto), não erro", () => {
    expect(formatarMN(0)).toBe("0,0 MN")
  })

  it("acima de 100 a casa decimal vira ruído — arredonda", () => {
    expect(formatarMN(123.46)).toBe("123 MN")
  })

  it("entrada inválida vira travessão honesto, nunca NaN na tela", () => {
    expect(formatarMN(Number.NaN)).toBe("— MN")
    expect(formatarMN(-1)).toBe("— MN")
  })
})

describe("maisProximos — a folha do Explorar", () => {
  const todos = [ABRAAO, VEROLME, BRACUHY]
  const pertoDeVerolme = { lat: -22.97, lng: -44.31 }

  it("ordena pela geografia real, não pela ordem de chegada da lista", () => {
    const r = maisProximos(todos, pertoDeVerolme, 3)
    expect(r.map((p) => p.id)).toEqual(["verolme", "bracuhy", "abraao"])
  })

  it("corta em n sem mutar a lista original", () => {
    const copia = [...todos]
    const r = maisProximos(todos, pertoDeVerolme, 2)
    expect(r).toHaveLength(2)
    expect(todos).toEqual(copia)
  })

  it("devolve a distância em milhas náuticas junto de cada ponto", () => {
    const r = maisProximos([VEROLME], pertoDeVerolme, 1)
    // ~0,4 MN entre o centro simulado e a Verolme — o número do canvas.
    expect(r[0].distanciaNm).toBeGreaterThan(0.1)
    expect(r[0].distanciaNm).toBeLessThan(1)
  })

  it("lista vazia e n=0 são casos honestos, não exceção", () => {
    expect(maisProximos([], pertoDeVerolme, 3)).toEqual([])
    expect(maisProximos(todos, pertoDeVerolme, 0)).toEqual([])
  })
})

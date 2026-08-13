import { describe, expect, it } from "vitest"
import { avaliarMar, calcularEscalaMare, extremosMare, pathNivelMar, pontoCardeal, projetarPonto, proximaMare } from "./mar"

describe("avaliarMar", () => {
  it("mar calmo e vento fraco liberam", () => {
    expect(avaliarMar(0.8, 12)).toEqual({ nivel: "ok", rotulo: "Bom pra sair" })
  })
  it("onda ou vento medianos pedem atenção", () => {
    expect(avaliarMar(1.5, 12).nivel).toBe("atencao")
    expect(avaliarMar(0.8, 20).nivel).toBe("atencao")
    expect(avaliarMar(1.5, 20).rotulo).toBe("Atenção no mar")
  })
  it("mar pesado bloqueia", () => {
    expect(avaliarMar(2.2, 12)).toEqual({ nivel: "crit", rotulo: "Mar pesado" })
    expect(avaliarMar(1.0, 28).nivel).toBe("crit")
  })
  it("sem nenhum dado, informa", () => {
    expect(avaliarMar(null, null)).toEqual({ nivel: "atencao", rotulo: "Sem dados do mar" })
  })
  it("dado parcial avalia com o que tem", () => {
    expect(avaliarMar(0.5, null).nivel).toBe("ok")
    expect(avaliarMar(null, 30).nivel).toBe("crit")
  })
})

describe("pontoCardeal", () => {
  it("os 8 rumos da rosa dos ventos em PT-BR", () => {
    expect(pontoCardeal(0)).toBe("N")
    expect(pontoCardeal(45)).toBe("NE")
    expect(pontoCardeal(90)).toBe("L")
    expect(pontoCardeal(135)).toBe("SE")
    expect(pontoCardeal(180)).toBe("S")
    expect(pontoCardeal(225)).toBe("SO")
    expect(pontoCardeal(270)).toBe("O")
    expect(pontoCardeal(315)).toBe("NO")
  })
  it("360 volta pra N (arredondamento circular)", () => {
    expect(pontoCardeal(360)).toBe("N")
    expect(pontoCardeal(359)).toBe("N")
  })
  it("arredonda pro rumo mais próximo no meio do caminho", () => {
    expect(pontoCardeal(20)).toBe("N")
    expect(pontoCardeal(23)).toBe("NE")
    expect(pontoCardeal(100)).toBe("L")
  })
  it("aceita graus negativos (normaliza antes de arredondar)", () => {
    expect(pontoCardeal(-10)).toBe("N")
    expect(pontoCardeal(-90)).toBe("O")
  })
})

describe("extremosMare", () => {
  it("acha o pico (preamar) e o vale (baixa-mar) numa curva simples de maré", () => {
    // maré sobe até a hora 6 (preamar), desce até a hora 12 (baixa-mar), sobe de novo
    const serie = [
      { hora: 0, nivelM: 0.5 },
      { hora: 1, nivelM: 0.7 },
      { hora: 2, nivelM: 0.9 },
      { hora: 3, nivelM: 1.1 },
      { hora: 4, nivelM: 1.2 },
      { hora: 5, nivelM: 1.25 },
      { hora: 6, nivelM: 1.3 },
      { hora: 7, nivelM: 1.2 },
      { hora: 8, nivelM: 1.0 },
      { hora: 9, nivelM: 0.7 },
      { hora: 10, nivelM: 0.4 },
      { hora: 11, nivelM: 0.2 },
      { hora: 12, nivelM: 0.1 },
      { hora: 13, nivelM: 0.3 },
    ]
    const extremos = extremosMare(serie)
    expect(extremos).toEqual([
      { hora: 6, nivelM: 1.3, tipo: "preamar" },
      { hora: 12, nivelM: 0.1, tipo: "baixa-mar" },
    ])
  })
  it("serie curta demais (sem ponto interior) não acha extremo nenhum", () => {
    expect(extremosMare([{ hora: 0, nivelM: 1 }])).toEqual([])
    expect(extremosMare([{ hora: 0, nivelM: 1 }, { hora: 1, nivelM: 2 }])).toEqual([])
  })
  it("serie estritamente monótona (sem virada) não acha extremo nenhum", () => {
    const serie = [
      { hora: 0, nivelM: 0.1 },
      { hora: 1, nivelM: 0.4 },
      { hora: 2, nivelM: 0.7 },
      { hora: 3, nivelM: 1.0 },
    ]
    expect(extremosMare(serie)).toEqual([])
  })
})

describe("proximaMare", () => {
  const serie = [
    { hora: 0, nivelM: 0.5 },
    { hora: 1, nivelM: 0.9 },
    { hora: 2, nivelM: 1.3 },
    { hora: 3, nivelM: 0.9 },
    { hora: 4, nivelM: 0.5 },
    { hora: 5, nivelM: 0.2 },
    { hora: 6, nivelM: 0.5 },
  ]
  it("acha a próxima virada a partir da hora atual", () => {
    expect(proximaMare(serie, 0)).toEqual({ hora: 2, nivelM: 1.3, tipo: "preamar" })
    expect(proximaMare(serie, 3)).toEqual({ hora: 5, nivelM: 0.2, tipo: "baixa-mar" })
  })
  it("na própria hora da virada, devolve ela mesma (>=, não >)", () => {
    expect(proximaMare(serie, 2)).toEqual({ hora: 2, nivelM: 1.3, tipo: "preamar" })
  })
  it("depois da última virada da série, não tem próxima — null", () => {
    expect(proximaMare(serie, 6)).toBeNull()
  })
  it("série vazia, null", () => {
    expect(proximaMare([], 10)).toBeNull()
  })
})

describe("calcularEscalaMare", () => {
  it("min/max da série, dimensões repassadas", () => {
    const serie = [{ hora: 0, nivelM: 0.2 }, { hora: 1, nivelM: 1.4 }, { hora: 2, nivelM: 0.5 }]
    expect(calcularEscalaMare(serie, 200, 60, 6)).toEqual({ min: 0.2, max: 1.4, larguraPx: 200, alturaPx: 60, margemYPx: 6 })
  })
  it("série curta demais (0 ou 1 ponto) não dá pra desenhar linha — null", () => {
    expect(calcularEscalaMare([], 200, 60)).toBeNull()
    expect(calcularEscalaMare([{ hora: 0, nivelM: 1 }], 200, 60)).toBeNull()
  })
})

describe("projetarPonto", () => {
  const escala = { min: 0, max: 2, larguraPx: 230, alturaPx: 60, margemYPx: 6 }
  it("hora 0 fica na borda esquerda, hora 23 na borda direita", () => {
    expect(projetarPonto(0, 1, escala).x).toBe(0)
    expect(projetarPonto(23, 1, escala).x).toBeCloseTo(230, 5)
  })
  it("nível máximo fica no topo (y pequeno), mínimo embaixo (y grande) — SVG cresce pra baixo", () => {
    expect(projetarPonto(0, 2, escala).y).toBeCloseTo(6, 5) // max -> margem de cima
    expect(projetarPonto(0, 0, escala).y).toBeCloseTo(54, 5) // min -> altura - margem
  })
  it("amplitude zero (maré chapada) não divide por zero — linha no meio", () => {
    const chapada = { min: 1, max: 1, larguraPx: 230, alturaPx: 60, margemYPx: 6 }
    expect(projetarPonto(5, 1, chapada).y).toBe(30)
  })
})

describe("pathNivelMar", () => {
  it("desenha um M seguido de L para cada ponto seguinte", () => {
    const serie = [{ hora: 0, nivelM: 0 }, { hora: 23, nivelM: 2 }]
    const escala = calcularEscalaMare(serie, 230, 60, 6)!
    const path = pathNivelMar(serie, escala)
    expect(path.startsWith("M")).toBe(true)
    expect(path).toContain("L")
  })
  it("série curta demais devolve string vazia (nada pra desenhar)", () => {
    const escala = { min: 0, max: 1, larguraPx: 230, alturaPx: 60, margemYPx: 6 }
    expect(pathNivelMar([], escala)).toBe("")
    expect(pathNivelMar([{ hora: 0, nivelM: 1 }], escala)).toBe("")
  })
})

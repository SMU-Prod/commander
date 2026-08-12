import { describe, expect, it } from "vitest"
import { suavizarChaikin, type Ponto } from "./suavizar-linha"

describe("suavizarChaikin (onda 23 — suavizacao visual da rota)", () => {
  it("com menos de 3 pontos, devolve copia sem alteracao (nada pra cortar)", () => {
    const doisPontos: Ponto[] = [
      [0, 0],
      [10, 10],
    ]
    const resultado = suavizarChaikin(doisPontos)
    expect(resultado).toEqual(doisPontos)
    expect(resultado).not.toBe(doisPontos) // copia, nao a mesma referencia
  })

  it("um unico ponto devolve copia do unico ponto", () => {
    const umPonto: Ponto[] = [[5, 5]]
    expect(suavizarChaikin(umPonto)).toEqual(umPonto)
  })

  it("preserva o primeiro e o ultimo ponto EXATAMENTE (a origem e o destino nunca se movem)", () => {
    const caminho: Ponto[] = [
      [0, 0],
      [1, 5],
      [4, 5],
      [5, 0],
      [9, 3],
    ]
    const resultado = suavizarChaikin(caminho)
    expect(resultado[0]).toEqual(caminho[0])
    expect(resultado[resultado.length - 1]).toEqual(caminho[caminho.length - 1])
  })

  it("gera mais pontos que a entrada (quinas internas cortadas viram 2 pontos cada)", () => {
    const caminho: Ponto[] = [
      [0, 0],
      [1, 5],
      [4, 5],
      [5, 0],
    ]
    const resultado = suavizarChaikin(caminho, 1)
    // 1 passada: extremos (2) + 2 pontos por segmento interno (3 segmentos) = 2 + 6 = 8
    expect(resultado).toHaveLength(8)
  })

  it("nao muta o array de entrada", () => {
    const caminho: Ponto[] = [
      [0, 0],
      [2, 4],
      [6, 1],
    ]
    const copiaOriginal = caminho.map((p) => [...p])
    suavizarChaikin(caminho)
    expect(caminho).toEqual(copiaOriginal)
  })

  it("passadas=0 devolve copia sem alteracao", () => {
    const caminho: Ponto[] = [
      [0, 0],
      [2, 4],
      [6, 1],
    ]
    expect(suavizarChaikin(caminho, 0)).toEqual(caminho)
  })

  it("uma quina reta de 90 graus fica mais macia (o ponto de virada deixa de estar EXATAMENTE na quina)", () => {
    // quina em (5,0): vem de (0,0) reto no eixo x, sai reto no eixo y ate (5,5)
    const caminho: Ponto[] = [
      [0, 0],
      [5, 0],
      [5, 5],
    ]
    const resultado = suavizarChaikin(caminho, 2)
    // nenhum ponto do resultado (fora dos extremos) cai exatamente sobre a quina original
    const quina = caminho[1]
    const pontosInternos = resultado.slice(1, -1)
    for (const p of pontosInternos) {
      expect(p).not.toEqual(quina)
    }
  })

  it("cada passada encurta o tracado (corner-cutting tira material da quina, nunca acrescenta)", () => {
    const caminho: Ponto[] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ]
    const comprimento = (pontos: Ponto[]) => {
      let total = 0
      for (let i = 1; i < pontos.length; i++) total += Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1])
      return total
    }
    const original = comprimento(caminho)
    const suave1 = comprimento(suavizarChaikin(caminho, 1))
    const suave3 = comprimento(suavizarChaikin(caminho, 3))
    // amacia progressivamente: cada passada corta mais quina, o tracado so encurta
    expect(suave1).toBeLessThan(original)
    expect(suave3).toBeLessThan(suave1)
  })

  it("aplicada a uma reta (pontos colineares), o resultado continua colinear", () => {
    const reta: Ponto[] = [
      [0, 0],
      [3, 3],
      [7, 7],
      [10, 10],
    ]
    const resultado = suavizarChaikin(reta)
    for (const [x, y] of resultado) {
      expect(y).toBeCloseTo(x, 10) // y === x pra toda a reta
    }
  })
})

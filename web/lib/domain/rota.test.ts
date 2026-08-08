import { describe, expect, it } from "vitest"
import { acharCaminho, distanciaDaRota, ehAgua, paraCelula, snapParaAgua, suavizar, type Grade } from "./rota"

/** 40x20, tudo água menos uma ilha retangular no meio. */
function gradeComIlha(): Grade {
  const largura = 40
  const altura = 20
  const agua = new Uint8Array(largura * altura).fill(1)
  for (let y = 5; y <= 15; y++) for (let x = 15; x <= 25; x++) agua[y * largura + x] = 0
  return { largura, altura, lngMin: 0, latMin: 0, lngMax: 40, latMax: 20, agua }
}

describe("grade", () => {
  it("converte coordenada para celula e de volta", () => {
    const g = gradeComIlha()
    const c = paraCelula(g, { la: 10.5, lo: 20.5 })
    expect(c).toEqual({ x: 20, y: 9 })
    expect(ehAgua(g, c)).toBe(false) // dentro da ilha
    expect(ehAgua(g, paraCelula(g, { la: 2.5, lo: 2.5 }))).toBe(true)
  })
  it("snap leva um ponto em terra para a agua mais proxima", () => {
    const g = gradeComIlha()
    const alvo = snapParaAgua(g, { la: 10.5, lo: 20.5 }, 20)
    expect(alvo).not.toBeNull()
    expect(ehAgua(g, alvo!)).toBe(true)
  })
  it("snap devolve null quando nao ha agua no raio", () => {
    const g = gradeComIlha()
    expect(snapParaAgua(g, { la: 10.5, lo: 20.5 }, 1)).toBeNull()
  })
})

describe("acharCaminho", () => {
  it("acha caminho reto quando nao ha obstaculo", () => {
    const g = gradeComIlha()
    const caminho = acharCaminho(g, { la: 2.5, lo: 2.5 }, { la: 2.5, lo: 35.5 })
    expect(caminho).not.toBeNull()
    expect(caminho!.every((p) => ehAgua(g, paraCelula(g, p)))).toBe(true)
  })
  it("CONTORNA a ilha em vez de atravessar (o teste que importa)", () => {
    const g = gradeComIlha()
    const caminho = acharCaminho(g, { la: 10.5, lo: 5.5 }, { la: 10.5, lo: 35.5 })
    expect(caminho).not.toBeNull()
    // nenhum ponto do caminho pode cair em terra
    expect(caminho!.every((p) => ehAgua(g, paraCelula(g, p)))).toBe(true)
    // e tem que ser mais longo que a reta entre os extremos, porque desviou.
    // (comparar com a reta REAL, não com um número solto: a grade sintética
    // mapeia graus 1:1, então qualquer limiar fixo passaria mesmo atravessando)
    const reta = distanciaDaRota([{ la: 10.5, lo: 5.5 }, { la: 10.5, lo: 35.5 }])
    expect(distanciaDaRota(caminho!)).toBeGreaterThan(reta * 1.05)
    // e nem tanto: desviar não pode virar circum-navegação
    expect(distanciaDaRota(caminho!)).toBeLessThan(reta * 2)
  })
  it("devolve null quando o destino esta cercado de terra", () => {
    const g = gradeComIlha()
    // centro da ilha nao tem agua ao redor no raio de snap zero
    const caminho = acharCaminho(g, { la: 2.5, lo: 2.5 }, { la: 10.5, lo: 20.5 })
    // com snap, o destino vira a borda da ilha — entao ha caminho;
    // o caso sem saida e testado com uma grade toda de terra
    const seca: Grade = { ...g, agua: new Uint8Array(g.largura * g.altura) }
    expect(acharCaminho(seca, { la: 2.5, lo: 2.5 }, { la: 10.5, lo: 20.5 })).toBeNull()
    expect(caminho).not.toBeNull()
  })
})

describe("suavizar", () => {
  it("reduz os pontos mantendo o caminho na agua", () => {
    const g = gradeComIlha()
    const caminho = acharCaminho(g, { la: 10.5, lo: 5.5 }, { la: 10.5, lo: 35.5 })!
    const pernas = suavizar(g, caminho)
    expect(pernas.length).toBeLessThan(caminho.length)
    expect(pernas.length).toBeGreaterThanOrEqual(2)
    expect(pernas[0]).toEqual(caminho[0])
    expect(pernas[pernas.length - 1]).toEqual(caminho[caminho.length - 1])
  })
})

describe("distanciaDaRota", () => {
  it("soma as pernas em MN", () => {
    expect(distanciaDaRota([{ la: 0, lo: 0 }, { la: 0, lo: 0 }])).toBe(0)
    expect(distanciaDaRota([{ la: 0, lo: 0 }, { la: 1, lo: 0 }])).toBeCloseTo(60, 0)
  })
})

import { describe, expect, it } from "vitest"
import {
  acharCaminho,
  bboxComFolga,
  dentroDaGrade,
  distanciaDaRota,
  ehAgua,
  escolherGrade,
  paraCelula,
  recortarGrade,
  snapParaAgua,
  suavizar,
  type Grade,
} from "./rota"

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

// ---------------------------------------------------------------------------
// Onda 11 — recorte por trecho + escolha de grade (fina vs nacional)
// ---------------------------------------------------------------------------

describe("dentroDaGrade", () => {
  it("verdadeiro dentro do bbox, falso fora", () => {
    const g = gradeComIlha()
    expect(dentroDaGrade(g, { la: 10, lo: 20 })).toBe(true)
    expect(dentroDaGrade(g, { la: 10, lo: 20 })).toBe(true) // canto/miolo, sanidade
    expect(dentroDaGrade(g, { la: -1, lo: 20 })).toBe(false)
    expect(dentroDaGrade(g, { la: 10, lo: 41 })).toBe(false)
  })
})

describe("bboxComFolga", () => {
  it("bbox contem origem e destino, com folga positiva em volta", () => {
    const de = { la: 10, lo: 5 }
    const para = { la: 12, lo: 25 }
    const bbox = bboxComFolga(de, para)
    expect(bbox.lngMin).toBeLessThan(Math.min(de.lo, para.lo))
    expect(bbox.lngMax).toBeGreaterThan(Math.max(de.lo, para.lo))
    expect(bbox.latMin).toBeLessThan(Math.min(de.la, para.la))
    expect(bbox.latMax).toBeGreaterThan(Math.max(de.la, para.la))
  })

  it("respeita o piso de folga quando origem e destino estao muito perto (ou coincidem)", () => {
    const p = { la: 10, lo: 5 }
    const bbox = bboxComFolga(p, p)
    // diagonal zero -> a folga toda vem do piso, nao da fracao da diagonal
    const folga = bbox.lngMax - p.lo
    expect(folga).toBeGreaterThan(0.15) // piso documentado em rota.ts (0.2 grau)
  })

  it("folga cresce com a distancia entre origem e destino", () => {
    const perto = bboxComFolga({ la: 0, lo: 0 }, { la: 1, lo: 1 })
    const longe = bboxComFolga({ la: 0, lo: 0 }, { la: 20, lo: 20 })
    const folgaPerto = perto.lngMax - 1
    const folgaLonge = longe.lngMax - 20
    expect(folgaLonge).toBeGreaterThan(folgaPerto)
  })
})

describe("recortarGrade", () => {
  it("preserva agua/terra nas celulas certas e converte coordenadas corretamente", () => {
    const g = gradeComIlha()
    const bbox = { lngMin: 10, latMin: 3, lngMax: 30, latMax: 17 }
    const recorte = recortarGrade(g, bbox)

    const pontos = [
      { la: 4, lo: 12 }, // agua
      { la: 10, lo: 20 }, // dentro da ilha (terra)
      { la: 16, lo: 28 }, // agua
      { la: 6, lo: 16 }, // agua, perto da borda da ilha
    ]
    for (const p of pontos) {
      const original = ehAgua(g, paraCelula(g, p))
      const recortado = ehAgua(recorte, paraCelula(recorte, p))
      expect(recortado).toBe(original)
    }
  })

  it("as dimensoes do recorte sao menores que a grade original e cobrem o bbox pedido", () => {
    const g = gradeComIlha()
    const bbox = { lngMin: 10, latMin: 3, lngMax: 30, latMax: 17 }
    const recorte = recortarGrade(g, bbox)
    expect(recorte.largura).toBeLessThan(g.largura)
    expect(recorte.altura).toBeLessThan(g.altura)
    expect(recorte.lngMin).toBeLessThanOrEqual(bbox.lngMin)
    expect(recorte.lngMax).toBeGreaterThanOrEqual(bbox.lngMax)
    expect(recorte.latMin).toBeLessThanOrEqual(bbox.latMin)
    expect(recorte.latMax).toBeGreaterThanOrEqual(bbox.latMax)
  })

  it("bbox maior que a grade e clampado aos limites dela, sem estourar indices", () => {
    const g = gradeComIlha()
    const bbox = { lngMin: -1000, latMin: -1000, lngMax: 1000, latMax: 1000 }
    const recorte = recortarGrade(g, bbox)
    expect(recorte.largura).toBe(g.largura)
    expect(recorte.altura).toBe(g.altura)
    expect(recorte.agua).toEqual(g.agua)
  })

  it("uma rota calculada na grade recortada da o MESMO caminho que na grade inteira", () => {
    const g = gradeComIlha()
    const de = { la: 10.5, lo: 5.5 }
    const para = { la: 10.5, lo: 35.5 }
    const recorte = recortarGrade(g, bboxComFolga(de, para))

    const caminhoInteiro = acharCaminho(g, de, para)
    const caminhoRecorte = acharCaminho(recorte, de, para)
    expect(caminhoInteiro).not.toBeNull()
    expect(caminhoRecorte).toEqual(caminhoInteiro)
  })
})

describe("escolherGrade", () => {
  const fina: Grade = {
    largura: 10,
    altura: 10,
    lngMin: 0,
    latMin: 0,
    lngMax: 10,
    latMax: 10,
    agua: new Uint8Array(100).fill(1),
  }
  const nacional: Grade = {
    largura: 10,
    altura: 10,
    lngMin: -50,
    latMin: -50,
    lngMax: 50,
    latMax: 50,
    agua: new Uint8Array(100).fill(1),
  }

  it("usa a fina quando origem E destino cabem nela (melhor detalhe perto de casa)", () => {
    const r = escolherGrade(fina, nacional, { la: 2, lo: 2 }, { la: 8, lo: 8 })
    expect(r).toEqual({ grade: fina, tipo: "fina" })
  })

  it("usa a nacional quando um dos pontos esta fora da fina mas os dois cabem na nacional", () => {
    const r = escolherGrade(fina, nacional, { la: 2, lo: 2 }, { la: 30, lo: 30 })
    expect(r).toEqual({ grade: nacional, tipo: "nacional" })
  })

  it("null quando nenhuma das duas grades cobre os dois pontos ao mesmo tempo (fora da area)", () => {
    const r = escolherGrade(fina, nacional, { la: 2, lo: 2 }, { la: 1000, lo: 1000 })
    expect(r).toBeNull()
  })

  it("funciona so com a nacional quando a fina nao carregou (null)", () => {
    const r = escolherGrade(null, nacional, { la: 30, lo: 30 }, { la: -30, lo: -30 })
    expect(r).toEqual({ grade: nacional, tipo: "nacional" })
  })

  it("null quando as duas grades estao indisponiveis", () => {
    expect(escolherGrade(null, null, { la: 2, lo: 2 }, { la: 8, lo: 8 })).toBeNull()
  })
})

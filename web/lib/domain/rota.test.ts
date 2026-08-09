import { describe, expect, it } from "vitest"
import {
  acharCaminho,
  bboxComFolga,
  dentroDaGrade,
  distanciaDaRota,
  ehAgua,
  escolherGrade,
  MARGEM_SEGURANCA_PADRAO_M,
  paraCelula,
  profundidadeEm,
  recortarGrade,
  snapParaAgua,
  suavizar,
  type ConfigCalado,
  type Grade,
  type GradeProfundidade,
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

// ---------------------------------------------------------------------------
// Onda 12 — rota por calado: grade de profundidade + bloqueio/penalidade no A*
// ---------------------------------------------------------------------------

/** Grade de profundidade sintetica 4x2 (bbox 0..4 lng, 0..2 lat) com valores
 *  conhecidos, pra testar profundidadeEm isoladamente. */
function gradeProfundidadeSimples(): GradeProfundidade {
  // linha 0 (norte, la proximo de 2): 1m, 5m, 10m, 20m
  // linha 1 (sul, la proximo de 0): Infinity (terra/sem-dado), 3m, 7m, 15m
  return {
    largura: 4,
    altura: 2,
    lngMin: 0,
    latMin: 0,
    lngMax: 4,
    latMax: 2,
    profundidadeM: Float32Array.from([1, 5, 10, 20, Number.POSITIVE_INFINITY, 3, 7, 15]),
  }
}

describe("profundidadeEm", () => {
  it("devolve a profundidade decodificada na celula certa", () => {
    const gp = gradeProfundidadeSimples()
    expect(profundidadeEm(gp, { la: 1.5, lo: 0.5 })).toBe(1) // linha 0, col 0
    expect(profundidadeEm(gp, { la: 1.5, lo: 3.5 })).toBe(20) // linha 0, col 3
    expect(profundidadeEm(gp, { la: 0.5, lo: 1.5 })).toBe(3) // linha 1, col 1
  })
  it("Infinity pra celula marcada terra/sem-dado dentro do bbox", () => {
    const gp = gradeProfundidadeSimples()
    expect(profundidadeEm(gp, { la: 0.5, lo: 0.5 })).toBe(Number.POSITIVE_INFINITY)
  })
  it("Infinity fora do bbox da grade de profundidade (sem cobertura nao bloqueia por profundidade)", () => {
    const gp = gradeProfundidadeSimples()
    expect(profundidadeEm(gp, { la: 10, lo: 10 })).toBe(Number.POSITIVE_INFINITY)
    expect(profundidadeEm(gp, { la: -5, lo: -5 })).toBe(Number.POSITIVE_INFINITY)
  })
})

/** Grade totalmente aberta (sem terra), 20x5, com um "corredor" na linha do
 *  meio (y=2): a rota DIRETA entre origem e destino segue exatamente por
 *  essa linha (custo 19 celulas). As linhas y=1 e y=3 sao rotas alternativas
 *  levemente mais longas (exigem 1 passo diagonal em cada ponta pra entrar/
 *  sair da linha do meio, custo ~20,83) — servem de "canal fundo" quando a
 *  linha do meio estiver rasa/penalizada. As demais linhas (y=0,4) existem
 *  so pra dar folga de grade, profundidade nao importa nelas.
 *  `profundidadeMeioM` controla a profundidade da linha do meio; as demais
 *  ficam sempre fundas (10 m). */
function gradeCorredor(profundidadeMeioM: number): { agua: Grade; profundidade: GradeProfundidade } {
  const largura = 20
  const altura = 5
  const agua: Grade = {
    largura,
    altura,
    lngMin: 0,
    latMin: 0,
    lngMax: largura,
    latMax: altura,
    agua: new Uint8Array(largura * altura).fill(1),
  }
  const profundidadeM = new Float32Array(largura * altura).fill(10)
  for (let x = 0; x < largura; x++) profundidadeM[2 * largura + x] = profundidadeMeioM
  const profundidade: GradeProfundidade = {
    largura,
    altura,
    lngMin: 0,
    latMin: 0,
    lngMax: largura,
    latMax: altura,
    profundidadeM,
  }
  return { agua, profundidade }
}

const ORIGEM_CORREDOR = { la: 2.5, lo: 0.5 } // y=2, x=0
const DESTINO_CORREDOR = { la: 2.5, lo: 19.5 } // y=2, x=19

describe("A* respeitando calado (onda 12)", () => {
  it("celula rasa demais pro calado bloqueia como terra: sem rota quando o UNICO caminho e raso", () => {
    // grade de 1 unica linha (altura=1): nao ha como desviar por cima/baixo.
    const largura = 10
    const agua: Grade = {
      largura,
      altura: 1,
      lngMin: 0,
      latMin: 0,
      lngMax: largura,
      latMax: 1,
      agua: new Uint8Array(largura).fill(1),
    }
    const profundidade: GradeProfundidade = {
      largura,
      altura: 1,
      lngMin: 0,
      latMin: 0,
      lngMax: largura,
      latMax: 1,
      profundidadeM: new Float32Array(largura).fill(0.1), // rasissimo, a linha inteira
    }
    const de = { la: 0.5, lo: 0.5 }
    const para = { la: 0.5, lo: 9.5 }

    // sem config de calado, a rota existe normalmente (ignora profundidade)
    expect(acharCaminho(agua, de, para)).not.toBeNull()

    const config: ConfigCalado = { caladoM: 2, margemSegurancaM: 0.5, profundidade }
    // 0.1m < calado(2) + margem(0.5) = 2.5m em toda a linha -> intransponivel, como se fosse terra
    expect(acharCaminho(agua, de, para, config)).toBeNull()
  })

  it("celula com profundidade suficiente (fora da zona de penalidade) NAO e penalizada nem bloqueada", () => {
    const { agua, profundidade } = gradeCorredor(10) // linha do meio tambem funda
    const config: ConfigCalado = { caladoM: 1, margemSegurancaM: 0.5, profundidade } // limiar 1.5m
    const caminho = acharCaminho(agua, ORIGEM_CORREDOR, DESTINO_CORREDOR, config)
    expect(caminho).not.toBeNull()
    // com tudo igualmente fundo, a rota mais barata e a linha reta do meio (19 celulas)
    expect(distanciaDaRota(caminho!)).toBeCloseTo(distanciaDaRota([ORIGEM_CORREDOR, DESTINO_CORREDOR]), 1)
  })

  it("penalidade (nao bloqueio) faz a rota preferir o canal fundo quando o desvio e curto", () => {
    // linha do meio com 1.2m: calado 0.5 + margem 0.5 = limiar 1.0m -> 1.2m PASSA (nao bloqueia),
    // mas esta bem perto do limite (dentro da zona de penalidade de 0.5m acima do limiar) -> custa caro.
    const { agua, profundidade } = gradeCorredor(1.2)
    const semConfig = acharCaminho(agua, ORIGEM_CORREDOR, DESTINO_CORREDOR)
    expect(semConfig).not.toBeNull()
    // sem calado, a rota direta (mais barata) passa pela linha do meio (y=2) o tempo todo
    const celulasSemConfig = semConfig!.map((p) => paraCelula(agua, p))
    expect(celulasSemConfig.every((c) => c.y === 2)).toBe(true)

    const config: ConfigCalado = { caladoM: 0.5, margemSegurancaM: 0.5, profundidade }
    const comConfig = acharCaminho(agua, ORIGEM_CORREDOR, DESTINO_CORREDOR, config)
    expect(comConfig).not.toBeNull()
    // com a penalidade, a rota EVITA a linha do meio (rasa) no MIOLO do caminho e usa uma
    // das linhas fundas adjacentes — os extremos continuam em y=2 (origem/destino sao
    // isentos do check: e onde o usuario esta/vai, nao faz sentido bloquear a marina dele)
    const celulasComConfig = comConfig!.map((p) => paraCelula(agua, p))
    expect(celulasComConfig.every((c) => c.y === 2)).toBe(false) // deixa de ser 100% linha do meio
    expect(distanciaDaRota(comConfig!)).toBeGreaterThan(distanciaDaRota(semConfig!))
  })

  it("calado maior gera rota diferente (desvia) onde o calado menor passava direto", () => {
    // linha do meio com 1.5m: passa folgado pra calado pequeno, mas fica abaixo do limiar
    // (bloqueado, nao so penalizado) pro calado grande.
    const { agua, profundidade } = gradeCorredor(1.5)

    const caladoPequeno: ConfigCalado = { caladoM: 0.5, margemSegurancaM: 0.3, profundidade } // limiar 0.8m -> 1.5m passa livre
    const rotaPequena = acharCaminho(agua, ORIGEM_CORREDOR, DESTINO_CORREDOR, caladoPequeno)
    expect(rotaPequena).not.toBeNull()
    expect(rotaPequena!.map((p) => paraCelula(agua, p)).every((c) => c.y === 2)).toBe(true)

    const caladoGrande: ConfigCalado = { caladoM: 2, margemSegurancaM: 0.5, profundidade } // limiar 2.5m -> 1.5m bloqueia
    const rotaGrande = acharCaminho(agua, ORIGEM_CORREDOR, DESTINO_CORREDOR, caladoGrande)
    expect(rotaGrande).not.toBeNull() // ainda ha caminho, so que desviando
    // deixa de ser 100% linha do meio (so os extremos, isentos, continuam em y=2)
    expect(rotaGrande!.map((p) => paraCelula(agua, p)).every((c) => c.y === 2)).toBe(false)
    // rota final e DIFERENTE (mais longa) da rota do calado pequeno
    expect(distanciaDaRota(rotaGrande!)).toBeGreaterThan(distanciaDaRota(rotaPequena!))
  })

  it("MARGEM_SEGURANCA_PADRAO_M e um numero positivo e sensato pra lancha (nem zero, nem exagerado)", () => {
    expect(MARGEM_SEGURANCA_PADRAO_M).toBeGreaterThan(0)
    expect(MARGEM_SEGURANCA_PADRAO_M).toBeLessThanOrEqual(2)
  })

  it("suavizar NAO atalha de volta por cima de uma celula rasa que o caminho bruto desviou", () => {
    // 10x5, tudo agua (sem terra) — o caminho bruto (dado a mao, como se viesse
    // do A*) desvia por cima (y=0) de duas celulas rasas em y=2 (x=4 e x=5).
    // Sem considerar calado, a linha reta do primeiro ao ultimo ponto passa
    // DIRETO por cima das celulas rasas (e agua, entao "passaria" no check antigo).
    const largura = 10
    const altura = 5
    const agua: Grade = {
      largura,
      altura,
      lngMin: 0,
      latMin: 0,
      lngMax: largura,
      latMax: altura,
      agua: new Uint8Array(largura * altura).fill(1),
    }
    const profundidadeM = new Float32Array(largura * altura).fill(10)
    profundidadeM[2 * largura + 4] = 0.1 // (4,2) rasissimo
    profundidadeM[2 * largura + 5] = 0.1 // (5,2) rasissimo
    const profundidade: GradeProfundidade = { largura, altura, lngMin: 0, latMin: 0, lngMax: largura, latMax: altura, profundidadeM }

    const p0 = { la: 2.5, lo: 0.5 } // celula (0,2)
    const p1 = { la: 4.5, lo: 4.5 } // celula (4,0)
    const p2 = { la: 4.5, lo: 5.5 } // celula (5,0)
    const p3 = { la: 2.5, lo: 9.5 } // celula (9,2)
    const caminhoBruto = [p0, p1, p2, p3]

    const semConfig = suavizar(agua, caminhoBruto)
    expect(semConfig).toEqual([p0, p3]) // colapsa direto: linha reta passa por (4,2)/(5,2), mas e agua

    const config: ConfigCalado = { caladoM: 1, margemSegurancaM: 0.5, profundidade } // limiar 1.5m, 0.1m bloqueia
    const comConfig = suavizar(agua, caminhoBruto, config)
    expect(comConfig.length).toBeGreaterThan(2) // nao pode colapsar: o atalho cruzaria agua rasa demais
    expect(comConfig[0]).toEqual(p0)
    expect(comConfig[comConfig.length - 1]).toEqual(p3)
  })
})

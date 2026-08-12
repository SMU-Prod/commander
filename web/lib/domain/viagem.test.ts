import { describe, expect, it } from "vitest"
import {
  montarViagem,
  velocidadeCruzeiroHistorica,
  velocidadeCruzeiroInformada,
  type EventoComTrilha,
  type Parada,
} from "./viagem"
import type { Coord } from "./rota"

function parada(nome: string, la: number, lo: number): Parada {
  return { nome, la, lo }
}

describe("velocidadeCruzeiroHistorica", () => {
  it("sem nenhum evento, devolve null — quem chama cai pro passo (b)", () => {
    expect(velocidadeCruzeiroHistorica([])).toBeNull()
  })

  it("ignora eventos sem trilha ou com trilha curta demais", () => {
    const eventos: EventoComTrilha[] = [
      { trilha: null },
      { trilha: [{ t: 0, la: 0, lo: 0 }] }, // 1 ponto só
    ]
    expect(velocidadeCruzeiroHistorica(eventos)).toBeNull()
  })

  it("uma saída com trilha: usa a média dela, e o texto diz a origem", () => {
    // 6 nm em 1h = 6 kt de média
    const trilha = [
      { t: 0, la: 0, lo: 0 },
      { t: 3600, la: 0.1, lo: 0 },
    ]
    const r = velocidadeCruzeiroHistorica([{ trilha }])
    expect(r).not.toBeNull()
    expect(r!.kt).toBeCloseTo(6, 0)
    expect(r!.texto).toMatch(/sua média/)
    expect(r!.texto).toMatch(/kt/)
  })

  it("várias saídas: média das MÉDIAS (não ponderada pela distância)", () => {
    const trilhaLenta = [
      { t: 0, la: 0, lo: 0 },
      { t: 3600, la: 0.05, lo: 0 }, // 3 nm em 1h = 3 kt
    ]
    const trilhaRapida = [
      { t: 0, la: 10, lo: 0 },
      { t: 3600, la: 10.15, lo: 0 }, // 9 nm em 1h = 9 kt
    ]
    const r = velocidadeCruzeiroHistorica([{ trilha: trilhaLenta }, { trilha: trilhaRapida }])
    // média das médias = (3 + 9) / 2 = 6, NÃO a média ponderada por distância total
    expect(r!.kt).toBeCloseTo(6, 0)
  })
})

describe("velocidadeCruzeiroInformada", () => {
  it("devolve o kt informado com texto que não esconde a origem", () => {
    const r = velocidadeCruzeiroInformada(8)
    expect(r.kt).toBe(8)
    expect(r.texto).toMatch(/informada/)
    expect(r.texto).toMatch(/8/)
  })
})

describe("montarViagem", () => {
  const velocidade = { kt: 6, texto: "pela sua média de 6,0 kt" }

  it("sem paradas suficientes, devolve viagem vazia sem quebrar", () => {
    const v = montarViagem([parada("Só uma", 0, 0)], [], velocidade)
    expect(v.pernas).toEqual([])
    expect(v.distanciaTotalNm).toBe(0)
    expect(v.completa).toBe(true)
  })

  it("uma perna com caminho: soma distância e ETA pela velocidade informada", () => {
    const origem = parada("Marina", 0, 0)
    const destino = parada("Ilha", 0.1, 0) // ~6 nm ao norte
    const caminho: Coord[] = [origem, destino]
    const v = montarViagem([origem, destino], [caminho], velocidade)
    expect(v.pernas).toHaveLength(1)
    expect(v.pernas[0].distanciaNm).toBeCloseTo(6, 0)
    expect(v.pernas[0].etaMin).toBeCloseTo(60, 0) // 6 nm a 6 kt = 1h = 60 min
    expect(v.distanciaTotalNm).toBeCloseTo(6, 0)
    expect(v.etaTotalMin).toBeCloseTo(60, 0)
    expect(v.completa).toBe(true)
  })

  it("N pernas: soma cada uma na ordem origem -> parada1 -> ... -> destino", () => {
    const p0 = parada("Marina", 0, 0)
    const p1 = parada("Parada 1", 0.1, 0) // ~6 nm
    const p2 = parada("Destino", 0.1, 0.1) // outra perna
    const c1: Coord[] = [p0, p1]
    const c2: Coord[] = [p1, p2]
    const v = montarViagem([p0, p1, p2], [c1, c2], velocidade)
    expect(v.pernas).toHaveLength(2)
    expect(v.pernas[0].de).toEqual(p0)
    expect(v.pernas[0].para).toEqual(p1)
    expect(v.pernas[1].de).toEqual(p1)
    expect(v.pernas[1].para).toEqual(p2)
    expect(v.distanciaTotalNm).toBeGreaterThan(v.pernas[0].distanciaNm!)
    expect(v.completa).toBe(true)
  })

  it("perna sem caminho (calado, fora da área): honesta — aparece na lista sem distância/ETA, derruba completa", () => {
    const p0 = parada("Marina", 0, 0)
    const p1 = parada("Impossível", 5, 5)
    const p2 = parada("Destino", 5.1, 5)
    const c1: Coord[] | null = null // sem caminho pra essa perna
    const c2: Coord[] = [p1, p2]
    const v = montarViagem([p0, p1, p2], [c1, c2], velocidade)
    expect(v.pernas[0].pontos).toBeNull()
    expect(v.pernas[0].distanciaNm).toBeNull()
    expect(v.pernas[0].etaMin).toBeNull()
    expect(v.pernas[1].distanciaNm).not.toBeNull()
    expect(v.completa).toBe(false)
    // total NUNCA finge que a perna sem caminho tem distância: só soma o que existe
    expect(v.distanciaTotalNm).toBeCloseTo(v.pernas[1].distanciaNm!, 5)
  })

  it("sem velocidade (null): nunca inventa ETA — todo etaMin fica null", () => {
    const p0 = parada("Marina", 0, 0)
    const p1 = parada("Ilha", 0.1, 0)
    const caminho: Coord[] = [p0, p1]
    const v = montarViagem([p0, p1], [caminho], null)
    expect(v.pernas[0].distanciaNm).not.toBeNull()
    expect(v.pernas[0].etaMin).toBeNull()
    expect(v.etaTotalMin).toBeNull()
  })
})

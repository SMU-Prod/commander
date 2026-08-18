import { describe, expect, it } from "vitest"
import { filtrarParceiros, formatarMN, maisProximos } from "./explorar"

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

describe("filtrarParceiros — a busca do canvas tela-3h", () => {
  const parceiros = [
    { id: "1", nome: "Marina Verolme", categoria: "marina" },
    { id: "2", nome: "Posto do Léo", categoria: "posto" },
    { id: "3", nome: "Náutica São João", categoria: "loja_nautica" },
    { id: "4", nome: "Restaurante do Costa", categoria: "restaurante" },
  ] as const

  const ids = (termo: string) => filtrarParceiros(parceiros, termo).map((p) => p.id)

  it("'Verolme' acha 'verolme' — maiúscula não separa ninguém do resultado", () => {
    expect(ids("verolme")).toEqual(["1"])
    expect(ids("VEROLME")).toEqual(["1"])
  })

  it("acento não separa: 'nautica' acha 'Náutica', e 'São' acha 'sao'", () => {
    expect(ids("nautica")).toContain("3")
    expect(ids("sao joao")).toEqual(["3"])
  })

  it("acha pelo TIPO usando o rótulo dos chips — 'posto' traz o Posto do Léo", () => {
    // "Posto Náutico" é o rótulo de ROTULO_TIPO_PARTNER; a categoria crua
    // (`loja_nautica`) ninguém digita.
    expect(ids("posto")).toEqual(["2"])
    expect(ids("loja")).toEqual(["3"])
  })

  it("mais de uma palavra exige todas, em qualquer ordem", () => {
    expect(ids("verolme marina")).toEqual(["1"])
    expect(ids("marina joão")).toEqual([])
  })

  it("termo vazio (ou só espaço) devolve a lista inteira — busca limpa não é filtro", () => {
    expect(ids("")).toEqual(["1", "2", "3", "4"])
    expect(ids("   ")).toEqual(["1", "2", "3", "4"])
  })

  it("sem resultado devolve lista vazia (o 'Nada com esse nome por aqui' da tela), sem mutar a original", () => {
    const copia = [...parceiros]
    expect(ids("bracuhy")).toEqual([])
    expect(parceiros).toEqual(copia)
  })
})

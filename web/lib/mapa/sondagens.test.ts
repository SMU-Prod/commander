import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ANCORAS_RAMPA_SONDAGEM,
  buscarSondagens,
  celulasParaGeoJSON,
  colecaoSondagensVazia,
  expressaoCorSondagem,
  type CelulaSondagemMapa,
} from "./sondagens"

function celula(parcial: Partial<CelulaSondagemMapa> = {}): CelulaSondagemMapa {
  // Uma célula plausível da Baía da Ilha Grande — cada teste sobrescreve só
  // o campo que está exercitando.
  return { celula_id: "-171441:-32833", lat: -23.09, lon: -44.14, profundidade_m: 7.5, leituras: 3, ...parcial }
}

describe("rampa de cor das sondagens", () => {
  it("as ancoras sao as MESMAS profundidades da batimetria fina (0/5/10/20/50/150)", () => {
    // Se alguém mudar a rampa da batimetria (scripts/gerar-batimetria.mjs),
    // este teste é o lembrete de que as duas camadas falam a mesma língua de
    // cor — mudar lá pede mudar aqui junto.
    expect(ANCORAS_RAMPA_SONDAGEM.map((a) => a.profundidadeM)).toEqual([0, 5, 10, 20, 50, 150])
  })

  it("profundidades estritamente crescentes — exigência do interpolate do Mapbox", () => {
    for (let i = 1; i < ANCORAS_RAMPA_SONDAGEM.length; i++) {
      expect(ANCORAS_RAMPA_SONDAGEM[i].profundidadeM).toBeGreaterThan(ANCORAS_RAMPA_SONDAGEM[i - 1].profundidadeM)
    }
  })

  it("a expressao interpola linearmente sobre profundidade_m com os pares (parada, cor) na ordem", () => {
    const expressao = expressaoCorSondagem() as unknown as (number | string | string[])[]
    expect(expressao[0]).toBe("interpolate")
    expect(expressao[1]).toEqual(["linear"])
    expect(expressao[2]).toEqual(["get", "profundidade_m"])
    // 3 de cabeçalho + 1 par (parada, cor) por âncora
    expect(expressao).toHaveLength(3 + ANCORAS_RAMPA_SONDAGEM.length * 2)
    ANCORAS_RAMPA_SONDAGEM.forEach((ancora, i) => {
      expect(expressao[3 + i * 2]).toBe(ancora.profundidadeM)
      expect(expressao[4 + i * 2]).toBe(ancora.cor)
    })
  })
})

describe("celulasParaGeoJSON", () => {
  it("converte celulas validas em pontos com coordinates [lon, lat] e as propriedades da rampa", () => {
    const resultado = celulasParaGeoJSON([celula()])
    expect(resultado.type).toBe("FeatureCollection")
    expect(resultado.features).toHaveLength(1)
    const f = resultado.features[0]
    expect(f.geometry).toEqual({ type: "Point", coordinates: [-44.14, -23.09] })
    expect(f.properties).toEqual({ profundidade_m: 7.5, leituras: 3 })
  })

  it("lista vazia vira colecao vazia (mesma forma de colecaoSondagensVazia)", () => {
    expect(celulasParaGeoJSON([])).toEqual(colecaoSondagensVazia())
  })

  it("descarta celula com numero quebrado em vez de consertar — circulo no lugar errado e pior que nenhum", () => {
    const quebradas: CelulaSondagemMapa[] = [
      celula({ lat: Number.NaN }),
      celula({ lon: Number.POSITIVE_INFINITY }),
      celula({ lat: 91 }),
      celula({ lon: -181 }),
      celula({ profundidade_m: 0 }),
      celula({ profundidade_m: -3 }),
      celula({ profundidade_m: Number.NaN }),
    ]
    expect(celulasParaGeoJSON([...quebradas, celula()]).features).toHaveLength(1)
  })

  it("leituras invalida cai pra 1 (uma leitura existe, senao a celula nao existiria) sem descartar a celula", () => {
    const resultado = celulasParaGeoJSON([celula({ leituras: Number.NaN })])
    expect(resultado.features).toHaveLength(1)
    expect(resultado.features[0].properties.leituras).toBe(1)
  })
})

describe("buscarSondagens (degrade silencioso, mesmo contrato de buscarCorredores)", () => {
  const BBOX = { lngMin: -44.5, latMin: -23.2, lngMax: -44.0, latMax: -22.9 }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("resposta ok passa celulas e o aviso de corte adiante", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ celulas: [celula()], cortado: true }),
      }),
    )
    const r = await buscarSondagens(BBOX)
    expect(r.celulas).toHaveLength(1)
    expect(r.cortado).toBe(true)
  })

  it("servidor recusando (401/500) devolve vazio, nunca lanca", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ erro: "x" }) }))
    await expect(buscarSondagens(BBOX)).resolves.toEqual({ celulas: [], cortado: false })
  })

  it("corpo fora do contrato (sem array de celulas) devolve vazio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ qualquer: "coisa" }) }))
    await expect(buscarSondagens(BBOX)).resolves.toEqual({ celulas: [], cortado: false })
  })

  it("falha de rede (fetch rejeita) devolve vazio, nunca lanca", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sem sinal na enseada")))
    await expect(buscarSondagens(BBOX)).resolves.toEqual({ celulas: [], cortado: false })
  })
})

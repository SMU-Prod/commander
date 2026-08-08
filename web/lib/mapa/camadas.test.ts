import { afterEach, describe, expect, it, vi } from "vitest"
import { CAMADAS_PADRAO, carregarCamadas, salvarCamadas, type EstadoCamadas } from "./camadas"

/** localStorage não existe no ambiente de teste (node puro, sem jsdom) —
 *  mesmo motivo pelo qual mascara.test.ts stuba `fetch`. Um Map por trás
 *  simula getItem/setItem o suficiente pro módulo sob teste. */
function criarLocalStorageFalso(inicial: Record<string, string> = {}) {
  const store = new Map(Object.entries(inicial))
  return {
    getItem: (chave: string) => (store.has(chave) ? (store.get(chave) as string) : null),
    setItem: (chave: string, valor: string) => {
      store.set(chave, valor)
    },
    removeItem: (chave: string) => {
      store.delete(chave)
    },
    _store: store,
  }
}

describe("camadas do mapa (localStorage)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sem localStorage no ambiente, carregarCamadas devolve os padroes", () => {
    // nenhum vi.stubGlobal foi chamado - `localStorage` segue indefinido
    expect(carregarCamadas()).toEqual(CAMADAS_PADRAO)
  })

  it("localStorage vazio (nada salvo ainda) devolve os padroes", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    expect(carregarCamadas()).toEqual({ balizamento: true, profundidade: false, parceiros: true })
  })

  it("mescla um estado salvo PARCIAL com os padroes - chave ausente nao derruba as outras", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso({ "commander:camadas-mapa": JSON.stringify({ profundidade: true }) }))
    expect(carregarCamadas()).toEqual({ balizamento: true, profundidade: true, parceiros: true })
  })

  it("JSON corrompido no localStorage cai pros padroes, sem lancar", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso({ "commander:camadas-mapa": "{nao e json valido" }))
    expect(carregarCamadas()).toEqual(CAMADAS_PADRAO)
  })

  it("valor nao-booleano numa chave e ignorado - cai pro padrao so dessa chave", () => {
    vi.stubGlobal(
      "localStorage",
      criarLocalStorageFalso({ "commander:camadas-mapa": JSON.stringify({ balizamento: "sim", parceiros: false }) }),
    )
    expect(carregarCamadas()).toEqual({ balizamento: true, profundidade: false, parceiros: false })
  })

  it("salvarCamadas grava o estado completo serializado", () => {
    const fake = criarLocalStorageFalso()
    vi.stubGlobal("localStorage", fake)
    const estado: EstadoCamadas = { balizamento: false, profundidade: true, parceiros: true }
    salvarCamadas(estado)
    expect(JSON.parse(fake._store.get("commander:camadas-mapa") as string)).toEqual(estado)
  })

  it("round-trip: salvar e depois carregar devolve o mesmo estado", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    const estado: EstadoCamadas = { balizamento: false, profundidade: true, parceiros: false }
    salvarCamadas(estado)
    expect(carregarCamadas()).toEqual(estado)
  })

  it("falha ao salvar (quota/modo privado) e engolida, nao lanca", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError simulado")
      },
    })
    expect(() => salvarCamadas(CAMADAS_PADRAO)).not.toThrow()
  })

  it("sem localStorage no ambiente, salvarCamadas nao lanca", () => {
    expect(() => salvarCamadas(CAMADAS_PADRAO)).not.toThrow()
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Achado 3 da revisao da onda 5: carregarGrade memoizava QUALQUER resultado da
 * promessa, inclusive falha de rede — uma falha transitoria no boot (Overpass fora
 * do ar, wifi ruim) deixava a sessao inteira sem rota maritima ate o usuario
 * recarregar a pagina. So sucesso (com ou sem mascara) pode ficar memoizado; erro
 * tem que liberar a proxima chamada pra tentar de novo.
 *
 * `carregarGrade` memoiza num `let` de modulo, entao cada teste precisa de uma
 * instancia fresca do modulo (vi.resetModules + import dinamico) pra nao vazar
 * estado de um teste pro outro.
 */
describe("carregarGrade", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("falha de rede NAO fica memoizada — a proxima chamada tenta buscar de novo", async () => {
    vi.resetModules()
    const fetchMock = vi.fn().mockRejectedValue(new Error("falha de rede simulada"))
    vi.stubGlobal("fetch", fetchMock)

    const { carregarGrade } = await import("./mascara")

    const primeira = await carregarGrade()
    expect(primeira).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2) // JSON + PNG, em paralelo

    const segunda = await carregarGrade()
    expect(segunda).toBeNull()
    // se a falha tivesse ficado memoizada, a segunda chamada reusaria a promessa
    // antiga e o fetch NAO seria chamado de novo — 2 chamadas a mais prova o retry
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("resposta sem mascara (404) fica memoizada — so busca uma vez", async () => {
    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false } as Response)
    vi.stubGlobal("fetch", fetchMock)

    const { carregarGrade } = await import("./mascara")

    const primeira = await carregarGrade()
    const segunda = await carregarGrade()
    expect(primeira).toBeNull()
    expect(segunda).toBeNull()
    // sucesso (mesmo devolvendo null porque a mascara nao existe) memoiza: so 2
    // chamadas de fetch no total (JSON + PNG da PRIMEIRA vez, nada na segunda)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

/** Onda 12 — mesma politica de memoizacao de `carregarGrade`, aplicada aos
 *  carregadores de GRADE DE PROFUNDIDADE (fabrica separada,
 *  `criarCarregadorDeGradeProfundidade`, mas o contrato e identico: so
 *  sucesso memoiza, falha real libera retry). */
describe("carregarGradeProfundidade", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("falha de rede NAO fica memoizada — a proxima chamada tenta buscar de novo", async () => {
    vi.resetModules()
    const fetchMock = vi.fn().mockRejectedValue(new Error("falha de rede simulada"))
    vi.stubGlobal("fetch", fetchMock)

    const { carregarGradeProfundidade } = await import("./mascara")

    const primeira = await carregarGradeProfundidade()
    expect(primeira).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const segunda = await carregarGradeProfundidade()
    expect(segunda).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("resposta sem grade de profundidade (404) fica memoizada — so busca uma vez", async () => {
    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false } as Response)
    vi.stubGlobal("fetch", fetchMock)

    const { carregarGradeProfundidade } = await import("./mascara")

    const primeira = await carregarGradeProfundidade()
    const segunda = await carregarGradeProfundidade()
    expect(primeira).toBeNull()
    expect(segunda).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("carregarGrade e carregarGradeProfundidade tem promessas independentes (nao compartilham memoizacao)", async () => {
    vi.resetModules()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false } as Response)
    vi.stubGlobal("fetch", fetchMock)

    const { carregarGrade, carregarGradeProfundidade, carregarGradeNacional, carregarGradeProfundidadeNacional } =
      await import("./mascara")

    await carregarGrade()
    await carregarGradeProfundidade()
    await carregarGradeNacional()
    await carregarGradeProfundidadeNacional()
    // 4 carregadores independentes, 2 fetches cada (JSON+PNG) = 8 no total —
    // se algum compartilhasse promessa com outro, esse numero seria menor
    expect(fetchMock).toHaveBeenCalledTimes(8)
  })
})

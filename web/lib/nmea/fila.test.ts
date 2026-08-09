import { afterEach, describe, expect, it, vi } from "vitest"
import {
  descartarExcedente,
  despachar,
  enfileirar,
  estadoFila,
  TETO_PENDENTES_FILA,
  type LeituraParaFila,
  type LoteParaEnviar,
  type ResultadoEnvioLote,
} from "./fila"

/** localStorage não existe no ambiente de teste (node puro, sem jsdom) — mesmo
 *  motivo documentado em `lib/mapa/camadas.test.ts`. Um Map por trás simula
 *  getItem/setItem o suficiente pro módulo sob teste. */
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

function leituraExemplo(overrides: Partial<LeituraParaFila> = {}): LeituraParaFila {
  return {
    lat: -22.9,
    lon: -43.2,
    profundidadeM: 5.5,
    medidoEm: new Date("2026-08-09T12:00:00.000Z").toISOString(),
    transporte: "signalk",
    ...overrides,
  }
}

describe("descartarExcedente (política de descarte — FIFO, mais antigo cai primeiro)", () => {
  it("array dentro do teto não é alterado", () => {
    expect(descartarExcedente([1, 2, 3], 5)).toEqual([1, 2, 3])
  })

  it("array exatamente no teto não é alterado", () => {
    expect(descartarExcedente([1, 2, 3], 3)).toEqual([1, 2, 3])
  })

  it("array acima do teto descarta os mais ANTIGOS (início do array)", () => {
    expect(descartarExcedente([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5])
  })

  it("teto zero descarta tudo", () => {
    expect(descartarExcedente([1, 2, 3], 0)).toEqual([])
  })

  it("array vazio não quebra", () => {
    expect(descartarExcedente([], 10)).toEqual([])
  })
})

describe("fila de sondagem (localStorage)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sem localStorage no ambiente, estadoFila devolve fila vazia sem lançar", () => {
    expect(estadoFila()).toEqual({
      pendentes: 0,
      emVoo: 0,
      filaCheia: false,
      ultimoEnvioEm: null,
      proximaTentativaEm: null,
    })
  })

  it("sem localStorage no ambiente, enfileirar não lança", () => {
    expect(() => enfileirar(leituraExemplo())).not.toThrow()
  })

  it("fila vazia no início", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    expect(estadoFila().pendentes).toBe(0)
  })

  it("enfileirar uma leitura aumenta os pendentes", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())
    expect(estadoFila().pendentes).toBe(1)
  })

  it("enfileirar várias leituras acumula", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo({ lat: 1 }))
    enfileirar(leituraExemplo({ lat: 2 }))
    enfileirar(leituraExemplo({ lat: 3 }))
    expect(estadoFila().pendentes).toBe(3)
  })

  it("JSON corrompido no localStorage cai pra fila vazia, sem lançar", () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso({ "commander:fila-sondagem": "{nao e json valido" }))
    expect(estadoFila()).toEqual({
      pendentes: 0,
      emVoo: 0,
      filaCheia: false,
      ultimoEnvioEm: null,
      proximaTentativaEm: null,
    })
  })

  it("falha ao salvar (quota/modo privado) é engolida, não lança", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError simulado")
      },
    })
    expect(() => enfileirar(leituraExemplo())).not.toThrow()
  })

  it("teto real: enfileirar quando a fila já está no teto descarta a mais antiga (integração no tamanho de produção)", () => {
    // Semeia o estado direto em JSON (uma serialização O(n), não N chamadas a
    // enfileirar — chamar enfileirar em loop até o teto seria O(n²) e lento
    // pra um teste; ver decisão documentada em fila.ts).
    const antigas = Array.from({ length: TETO_PENDENTES_FILA }, (_, i) => ({
      id: `antiga-${i}`,
      lat: 0,
      lon: 0,
      profundidadeM: 1,
      medidoEm: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      transporte: "signalk" as const,
    }))
    const fake = criarLocalStorageFalso({
      "commander:fila-sondagem": JSON.stringify({ pendentes: antigas, loteEmVoo: null, ultimoEnvioSucessoEm: null }),
    })
    vi.stubGlobal("localStorage", fake)

    expect(estadoFila().filaCheia).toBe(true)

    enfileirar(leituraExemplo({ lat: 99 }))

    const salvo = JSON.parse(fake._store.get("commander:fila-sondagem") as string)
    expect(salvo.pendentes.length).toBe(TETO_PENDENTES_FILA)
    // a mais antiga (índice 0) caiu fora...
    expect(salvo.pendentes.find((p: { id: string }) => p.id === "antiga-0")).toBeUndefined()
    // ...a penúltima mais antiga sobreviveu...
    expect(salvo.pendentes.find((p: { id: string }) => p.id === "antiga-1")).toBeDefined()
    // ...e a leitura nova entrou no final.
    expect(salvo.pendentes[salvo.pendentes.length - 1].lat).toBe(99)
  })
})

describe("despachar (envio em lote com retentativa e backoff)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function envioOk(gravadas = 1): (lote: LoteParaEnviar) => Promise<ResultadoEnvioLote> {
    return vi.fn(async (): Promise<ResultadoEnvioLote> => ({ ok: true, gravadas }))
  }
  function envioFalha(erro = "sem rede"): (lote: LoteParaEnviar) => Promise<ResultadoEnvioLote> {
    return vi.fn(async (): Promise<ResultadoEnvioLote> => ({ ok: false, erro }))
  }

  it("fila vazia: não chama enviar", async () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    const enviar = envioOk()
    await despachar(enviar)
    expect(enviar).not.toHaveBeenCalled()
  })

  it("envia as leituras pendentes, reduzidas por célula, e limpa a fila no sucesso", async () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    // duas leituras na MESMA célula (mesmo lat/lon) — devem virar 1 célula reduzida.
    enfileirar(leituraExemplo({ lat: -22.9, lon: -43.2, profundidadeM: 5 }))
    enfileirar(leituraExemplo({ lat: -22.9, lon: -43.2, profundidadeM: 7 }))

    const enviar = envioOk(1)
    await despachar(enviar)

    expect(enviar).toHaveBeenCalledTimes(1)
    const lote = (enviar as ReturnType<typeof vi.fn>).mock.calls[0][0] as LoteParaEnviar
    expect(lote.celulas).toHaveLength(1)
    expect(typeof lote.loteId).toBe("string")
    expect(lote.transporte).toBe("signalk")

    const estado = estadoFila()
    expect(estado.pendentes).toBe(0)
    expect(estado.emVoo).toBe(0)
    expect(estado.ultimoEnvioEm).not.toBeNull()
  })

  it("falha no envio: mantém o lote em voo (não perde leituras) e agenda retentativa", async () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())

    const enviar = envioFalha()
    await despachar(enviar)

    const estado = estadoFila()
    expect(estado.pendentes).toBe(0) // já foi congelada num lote
    expect(estado.emVoo).toBe(1) // mas continua guardada, não sumiu
    expect(estado.ultimoEnvioEm).toBeNull()
    expect(estado.proximaTentativaEm).not.toBeNull()
  })

  it("exceção lançada por enviar() é tratada como falha, nunca escapa", async () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())
    const enviar = vi.fn(async () => {
      throw new Error("rede caiu no meio")
    })
    await expect(despachar(enviar)).resolves.toBeUndefined()
    expect(estadoFila().emVoo).toBe(1)
  })

  it("não retenta antes do backoff — segunda chamada a despachar não bate na rede de novo", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"))
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())

    const enviar = envioFalha()
    await despachar(enviar) // 1ª tentativa, falha, agenda backoff
    expect(enviar).toHaveBeenCalledTimes(1)

    await despachar(enviar) // chamada imediata de novo — ainda dentro do backoff
    expect(enviar).toHaveBeenCalledTimes(1) // não bateu na rede de novo
  })

  it("retenta o MESMO lote (mesmo loteId) depois do backoff passar — idempotência do retry", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"))
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())

    const enviar = vi.fn()
    enviar.mockResolvedValueOnce({ ok: false, erro: "sem rede" }).mockResolvedValueOnce({ ok: true, gravadas: 1 })

    await despachar(enviar) // falha, agenda backoff (5s base)
    vi.setSystemTime(new Date(Date.now() + 6_000)) // passa do backoff
    await despachar(enviar) // retentativa

    expect(enviar).toHaveBeenCalledTimes(2)
    const loteId1 = (enviar.mock.calls[0][0] as LoteParaEnviar).loteId
    const loteId2 = (enviar.mock.calls[1][0] as LoteParaEnviar).loteId
    expect(loteId2).toBe(loteId1) // mesma chave de deduplicação nas duas tentativas
    expect(estadoFila().emVoo).toBe(0) // 2ª tentativa deu certo, lote foi limpo
  })

  it("backoff cresce exponencialmente a cada falha, até o teto", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-09T12:00:00.000Z"))
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())

    const enviar = envioFalha()
    await despachar(enviar) // tentativa 1 -> falha
    const primeiraEspera = estadoFila().proximaTentativaEm! - Date.now()

    vi.setSystemTime(new Date(Date.now() + primeiraEspera + 1))
    await despachar(enviar) // tentativa 2 -> falha de novo
    const segundaEspera = estadoFila().proximaTentativaEm! - Date.now()

    expect(segundaEspera).toBeGreaterThan(primeiraEspera)
  })

  it("depois de um lote enviar com sucesso, drena imediatamente as leituras que chegaram depois (novo loteId)", async () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo({ lat: 1 }))

    const chamadas: LoteParaEnviar[] = []
    const enviar = vi.fn(async (lote: LoteParaEnviar) => {
      chamadas.push(lote)
      // simula uma leitura nova chegando enquanto o primeiro lote ainda está em voo
      if (chamadas.length === 1) enfileirar(leituraExemplo({ lat: 2 }))
      return { ok: true, gravadas: 1 } as ResultadoEnvioLote
    })

    await despachar(enviar)

    expect(enviar).toHaveBeenCalledTimes(2)
    expect(chamadas[0].loteId).not.toBe(chamadas[1].loteId)
    expect(estadoFila().pendentes).toBe(0)
    expect(estadoFila().emVoo).toBe(0)
  })

  it("reentrância: uma segunda chamada a despachar() enquanto a primeira está em voo não dispara um segundo envio concorrente", async () => {
    vi.stubGlobal("localStorage", criarLocalStorageFalso())
    enfileirar(leituraExemplo())

    let resolver!: (r: ResultadoEnvioLote) => void
    const pendente = new Promise<ResultadoEnvioLote>((r) => {
      resolver = r
    })
    const enviar = vi.fn(() => pendente)

    const primeira = despachar(enviar)
    const segunda = despachar(enviar) // dispara enquanto a primeira ainda não resolveu

    resolver({ ok: true, gravadas: 1 })
    await Promise.all([primeira, segunda])

    expect(enviar).toHaveBeenCalledTimes(1)
  })
})

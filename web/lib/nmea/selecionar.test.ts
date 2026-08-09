import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("./nativo", () => ({
  transporteNativoDisponivel: vi.fn(() => false),
  criarTransporteNativo: vi.fn(() => null),
}))

describe("seletor de transporte", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("./nativo")
  })

  it("hoje (nativo indisponível) cai pro Signal K — mesmo formato de TransporteProfundidade (tem .conectar)", async () => {
    const { criarTransporteAtivo } = await import("./selecionar")
    const transporte = criarTransporteAtivo("ws://teste:3000")
    expect(typeof transporte.conectar).toBe("function")
  })

  it("transporteAtivoNome devolve 'signalk' hoje", async () => {
    const { transporteAtivoNome } = await import("./selecionar")
    expect(transporteAtivoNome()).toBe("signalk")
  })

  it("quando o nativo estiver disponível (plugin Capacitor preenchido), o seletor usa ele — não cria o Signal K", async () => {
    vi.resetModules()
    const transporteFalso = { conectar: vi.fn(() => () => {}) }
    vi.doMock("./nativo", () => ({
      transporteNativoDisponivel: () => true,
      criarTransporteNativo: () => transporteFalso,
    }))
    const { criarTransporteAtivo, transporteAtivoNome } = await import("./selecionar")
    expect(criarTransporteAtivo()).toBe(transporteFalso)
    expect(transporteAtivoNome()).toBe("nativo")
  })

  it("nativo disponível mas criarTransporteNativo devolve null (inconsistência defensiva) — cai pro Signal K mesmo assim", async () => {
    vi.resetModules()
    vi.doMock("./nativo", () => ({
      transporteNativoDisponivel: () => true,
      criarTransporteNativo: () => null,
    }))
    const { criarTransporteAtivo } = await import("./selecionar")
    const transporte = criarTransporteAtivo("ws://teste:3000")
    expect(typeof transporte.conectar).toBe("function")
  })
})

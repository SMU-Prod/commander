import { beforeEach, describe, expect, it, vi } from "vitest"
import { _resetarLimitesParaTeste, checarLimite, identificarIp } from "./limitador"

describe("checarLimite", () => {
  beforeEach(() => {
    _resetarLimitesParaTeste()
    vi.useRealTimers()
  })

  it("permite até o limite dentro da janela", () => {
    const chave = "user-1"
    for (let i = 0; i < 5; i++) {
      const r = checarLimite(chave, 60_000, 5)
      expect(r.permitido).toBe(true)
    }
  })

  it("bloqueia a partir da chamada que estoura o limite", () => {
    const chave = "user-2"
    for (let i = 0; i < 3; i++) checarLimite(chave, 60_000, 3)
    const r = checarLimite(chave, 60_000, 3)
    expect(r.permitido).toBe(false)
    expect(r.restante).toBe(0)
    expect(r.retryAfterMs).toBeGreaterThan(0)
  })

  it("chaves diferentes têm baldes independentes", () => {
    for (let i = 0; i < 3; i++) checarLimite("a", 60_000, 3)
    const r = checarLimite("b", 60_000, 3)
    expect(r.permitido).toBe(true)
  })

  it("reseta a contagem depois que a janela expira", () => {
    vi.useFakeTimers()
    const chave = "user-3"
    for (let i = 0; i < 2; i++) checarLimite(chave, 1000, 2)
    expect(checarLimite(chave, 1000, 2).permitido).toBe(false)
    vi.advanceTimersByTime(1001)
    expect(checarLimite(chave, 1000, 2).permitido).toBe(true)
    vi.useRealTimers()
  })

  it("retryAfterMs cai à medida que o tempo passa dentro da janela bloqueada", () => {
    vi.useFakeTimers()
    const chave = "user-4"
    checarLimite(chave, 1000, 1)
    const primeiro = checarLimite(chave, 1000, 1)
    vi.advanceTimersByTime(400)
    const segundo = checarLimite(chave, 1000, 1)
    expect(segundo.retryAfterMs).toBeLessThan(primeiro.retryAfterMs)
    vi.useRealTimers()
  })
})

describe("identificarIp", () => {
  it("usa o primeiro IP de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })
    expect(identificarIp(h)).toBe("203.0.113.5")
  })

  it("cai pra x-real-ip quando x-forwarded-for está ausente", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.9" })
    expect(identificarIp(h)).toBe("198.51.100.9")
  })

  it("devolve 'desconhecido' sem nenhum header de IP", () => {
    expect(identificarIp(new Headers())).toBe("desconhecido")
  })
})

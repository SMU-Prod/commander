/**
 * Backoff: 30s dobrando até o teto de 10min; sucesso zera.
 */
import { describe, expect, it } from 'vitest'
import { Backoff, BACKOFF_BASE_MS, BACKOFF_TETO_MS } from '../src/backoff'

describe('Backoff', () => {
  it('sem falhas, pode tentar imediatamente', () => {
    const b = new Backoff()
    expect(b.podeTentar(0)).toBe(true)
    expect(b.atrasoAtualMs).toBe(0)
  })

  it('dobra a cada falha seguida: 30s, 60s, 120s, 240s, 480s, teto 600s', () => {
    const b = new Backoff()
    const esperados = [30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000]
    for (const esperado of esperados) {
      b.falhou(0)
      expect(b.atrasoAtualMs).toBe(esperado)
    }
  })

  it('bloqueia dentro da janela e libera quando o atraso passa', () => {
    const b = new Backoff()
    b.falhou(1000)
    expect(b.podeTentar(1000 + BACKOFF_BASE_MS - 1)).toBe(false)
    expect(b.podeTentar(1000 + BACKOFF_BASE_MS)).toBe(true)
  })

  it('sucesso reseta a sequência por completo', () => {
    const b = new Backoff()
    b.falhou(0)
    b.falhou(0)
    b.sucesso()
    expect(b.podeTentar(1)).toBe(true)
    b.falhou(0)
    expect(b.atrasoAtualMs).toBe(BACKOFF_BASE_MS)
  })

  it('nunca passa do teto de 10 minutos', () => {
    const b = new Backoff()
    for (let i = 0; i < 20; i++) {
      b.falhou(0)
    }
    expect(b.atrasoAtualMs).toBe(BACKOFF_TETO_MS)
  })

  it('esperaRestanteMs informa quanto falta pra próxima tentativa', () => {
    const b = new Backoff()
    b.falhou(10_000)
    expect(b.esperaRestanteMs(20_000)).toBe(20_000)
    expect(b.esperaRestanteMs(10_000 + BACKOFF_BASE_MS)).toBe(0)
  })
})

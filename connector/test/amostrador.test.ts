/**
 * Amostrador: retenção da última leitura por path e fallback de profundidade.
 */
import { describe, expect, it } from 'vitest'
import { Amostrador } from '../src/amostrador'

describe('Amostrador', () => {
  it('retém apenas a última leitura de cada path (amostragem honesta, sem flood)', () => {
    const a = new Amostrador()
    a.registrar('navigation.speedOverGround', 1.1, '2026-08-20T10:00:00.000Z')
    a.registrar('navigation.speedOverGround', 2.2, '2026-08-20T10:00:01.000Z')
    a.registrar('navigation.speedOverGround', 3.3, '2026-08-20T10:00:02.000Z')
    const lote = a.coletar()
    expect(lote).toHaveLength(1)
    expect(lote[0].valor).toBe(3.3)
    expect(lote[0].ts).toBe('2026-08-20T10:00:02.000Z')
  })

  it('coletar drena o buffer — o lote seguinte começa vazio', () => {
    const a = new Amostrador()
    a.registrar('navigation.position', { latitude: -23.9, longitude: -46.3 })
    expect(a.coletar()).toHaveLength(1)
    expect(a.coletar()).toHaveLength(0)
  })

  it('ignora valores nulos e indefinidos', () => {
    const a = new Amostrador()
    a.registrar('environment.depth.belowKeel', null)
    a.registrar('environment.depth.belowKeel', undefined)
    expect(a.coletar()).toHaveLength(0)
  })

  it('carimba ts UTC ISO quando o delta não traz timestamp válido', () => {
    const a = new Amostrador()
    a.registrar('navigation.speedOverGround', 5, 'nao-e-data')
    const [leitura] = a.coletar()
    expect(Number.isNaN(Date.parse(leitura.ts))).toBe(false)
    expect(leitura.ts.endsWith('Z')).toBe(true)
  })

  it('profundidade: belowKeel presente descarta belowTransducer do lote', () => {
    const a = new Amostrador()
    a.registrar('environment.depth.belowKeel', 3.2)
    a.registrar('environment.depth.belowTransducer', 4.5)
    const lote = a.coletar()
    expect(lote.map((l) => l.path)).toEqual(['environment.depth.belowKeel'])
  })

  it('profundidade: sem belowKeel, belowTransducer sobe como reserva', () => {
    const a = new Amostrador()
    a.registrar('environment.depth.belowTransducer', 4.5)
    const lote = a.coletar()
    expect(lote.map((l) => l.path)).toEqual(['environment.depth.belowTransducer'])
  })
})

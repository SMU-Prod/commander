/**
 * Categorias: opt-in explícito — nada ligado, nada assinado.
 */
import { describe, expect, it } from 'vitest'
import { pathsParaConfig, PATHS_POR_CATEGORIA } from '../src/categorias'
import { resolverConfig } from '../src/tipos'

describe('categorias → paths', () => {
  it('todas desligadas (o padrão) = nenhum path assinado', () => {
    const cfg = resolverConfig({})
    expect(pathsParaConfig(cfg)).toEqual([])
  })

  it('posicao liga exatamente posição, SOG e COG verdadeiro', () => {
    const cfg = resolverConfig({ posicao: true })
    expect(pathsParaConfig(cfg)).toEqual([
      'navigation.position',
      'navigation.speedOverGround',
      'navigation.courseOverGroundTrue'
    ])
  })

  it('motor cobre rotação, temperatura e horímetro de qualquer motor', () => {
    const cfg = resolverConfig({ motor: true })
    expect(pathsParaConfig(cfg)).toEqual([
      'propulsion.*.revolutions',
      'propulsion.*.temperature',
      'propulsion.*.runTime'
    ])
  })

  it('profundidade assina quilha E transdutor (fallback resolvido no lote)', () => {
    const cfg = resolverConfig({ profundidade: true })
    expect(pathsParaConfig(cfg)).toEqual([
      'environment.depth.belowKeel',
      'environment.depth.belowTransducer'
    ])
  })

  it('todas ligadas = união de todas as categorias, sem repetição', () => {
    const cfg = resolverConfig({
      posicao: true,
      motor: true,
      profundidade: true,
      eletrica: true,
      ambiente: true
    })
    const paths = pathsParaConfig(cfg)
    const esperados = Object.values(PATHS_POR_CATEGORIA).flat()
    expect(paths).toEqual(esperados)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('resolverConfig', () => {
  it('aplica defaults: urlBase do Commander, lote de 30s, tudo desligado', () => {
    const cfg = resolverConfig(undefined)
    expect(cfg.urlBase).toBe('https://commander-tau.vercel.app')
    expect(cfg.intervaloLoteSegundos).toBe(30)
    expect(cfg.posicao).toBe(false)
    expect(cfg.motor).toBe(false)
    expect(cfg.profundidade).toBe(false)
    expect(cfg.eletrica).toBe(false)
    expect(cfg.ambiente).toBe(false)
    expect(cfg.token).toBe('')
  })

  it('respeita o piso de 5s no intervalo de lote', () => {
    expect(resolverConfig({ intervaloLoteSegundos: 1 }).intervaloLoteSegundos).toBe(5)
    expect(resolverConfig({ intervaloLoteSegundos: 60 }).intervaloLoteSegundos).toBe(60)
  })

  it('normaliza urlBase sem barra final (evita //api/connect/ingest)', () => {
    expect(resolverConfig({ urlBase: 'http://x.local/' }).urlBase).toBe('http://x.local')
  })
})

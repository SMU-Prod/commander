/**
 * Mapeamento categoria → paths do Signal K.
 *
 * O plugin assina SOMENTE os paths das categorias que o usuário ligou na
 * configuração. Os curingas (*) seguem a semântica de assinatura do próprio
 * servidor (hierarquia de paths do Signal K), então `propulsion.*.revolutions`
 * cobre qualquer motor (port, starboard, único...).
 */
import { Categoria, ConfigResolvida } from './tipos'

export const PATHS_POR_CATEGORIA: Record<Categoria, string[]> = {
  posicao: [
    'navigation.position',
    'navigation.speedOverGround',
    'navigation.courseOverGroundTrue'
  ],
  motor: [
    'propulsion.*.revolutions',
    'propulsion.*.temperature',
    'propulsion.*.runTime'
  ],
  // Assinamos as duas profundidades; o Amostrador aplica o fallback
  // (belowKeel vence quando existe, belowTransducer só na ausência dele).
  profundidade: [
    'environment.depth.belowKeel',
    'environment.depth.belowTransducer'
  ],
  eletrica: [
    'electrical.batteries.*.voltage',
    'electrical.batteries.*.current'
  ],
  ambiente: [
    'environment.wind.*',
    'environment.water.temperature'
  ]
}

export const TODAS_CATEGORIAS: Categoria[] = [
  'posicao',
  'motor',
  'profundidade',
  'eletrica',
  'ambiente'
]

/** Lista de paths a assinar conforme as categorias ligadas na config. */
export function pathsParaConfig(cfg: ConfigResolvida): string[] {
  const paths: string[] = []
  for (const categoria of TODAS_CATEGORIAS) {
    if (cfg[categoria]) {
      paths.push(...PATHS_POR_CATEGORIA[categoria])
    }
  }
  return paths
}

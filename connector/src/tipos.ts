/**
 * Tipos compartilhados do signalk-commander-connector.
 *
 * Uma "leitura" é o menor grão que sobe pro Commander: um path do Signal K,
 * o valor NA UNIDADE SI ORIGINAL (conversão é responsabilidade do app, não
 * do plugin) e o timestamp UTC em ISO 8601.
 */

export interface Leitura {
  path: string
  valor: unknown
  ts: string
}

/** Categorias de dados que o usuário pode compartilhar — opt-in explícito. */
export type Categoria =
  | 'posicao'
  | 'motor'
  | 'profundidade'
  | 'eletrica'
  | 'ambiente'

/**
 * Configuração do plugin como chega do Signal K (a tela de config do servidor
 * é gerada a partir do schema() em index.ts). Tudo opcional aqui porque o
 * servidor pode entregar um objeto parcial (ou vazio) na primeira ativação.
 */
export interface ConfigConnector {
  urlBase?: string
  token?: string
  posicao?: boolean
  motor?: boolean
  profundidade?: boolean
  eletrica?: boolean
  ambiente?: boolean
  intervaloLoteSegundos?: number
}

/** Configuração já saneada, com defaults aplicados. */
export interface ConfigResolvida {
  urlBase: string
  token: string
  posicao: boolean
  motor: boolean
  profundidade: boolean
  eletrica: boolean
  ambiente: boolean
  intervaloLoteSegundos: number
}

export const URL_BASE_PADRAO = 'https://commander-tau.vercel.app'
export const INTERVALO_LOTE_PADRAO_S = 30
export const INTERVALO_LOTE_MINIMO_S = 5

/**
 * Aplica defaults e pisos sobre a configuração crua vinda do servidor.
 * Categorias nascem DESLIGADAS — consentimento explícito é regra da casa.
 */
export function resolverConfig(cru: ConfigConnector | undefined): ConfigResolvida {
  const c = cru ?? {}
  const intervalo =
    typeof c.intervaloLoteSegundos === 'number' && !Number.isNaN(c.intervaloLoteSegundos)
      ? Math.max(INTERVALO_LOTE_MINIMO_S, c.intervaloLoteSegundos)
      : INTERVALO_LOTE_PADRAO_S
  return {
    urlBase: (c.urlBase ?? URL_BASE_PADRAO).replace(/\/+$/, ''),
    token: c.token ?? '',
    posicao: c.posicao === true,
    motor: c.motor === true,
    profundidade: c.profundidade === true,
    eletrica: c.eletrica === true,
    ambiente: c.ambiente === true,
    intervaloLoteSegundos: intervalo
  }
}

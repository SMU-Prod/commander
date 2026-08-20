/**
 * Teste de CONFORMIDADE contra o signalk-server OFICIAL (npm, mesma versão
 * que roda nos barcos), com os dados de amostra NMEA2000 embutidos.
 *
 * Cenário 1 — caminho feliz: servidor real + plugin ativado com todas as
 * categorias → em até 90s o mock do Commander precisa receber ao menos um
 * lote com navigation.position válida (lat/lon numéricos), ts ISO UTC e o
 * Bearer correto.
 *
 * Cenário 2 — resiliência: com o mock DERRUBADO, as leituras têm de segurar
 * na fila em disco; quando o mock sobe, o lote atrasado tem de chegar.
 */
import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CONFIG_TESTE,
  esperarPor,
  montarDiretorioDeConfig,
  PORTA_MOCK,
  ServidorDeTeste,
  signalKRespondendo,
  subirSignalK,
  TOKEN_DE_TESTE
} from './apoio/ambiente'
import { ReceptorMock } from './apoio/receptor-mock'

let servidor: ServidorDeTeste | null = null
let mock: ReceptorMock | null = null

afterEach(async () => {
  // Teardown sempre, mesmo em falha — e com o log do servidor à mão.
  if (servidor) {
    await servidor.parar()
    servidor = null
  }
  if (mock) {
    await mock.parar()
    mock = null
  }
})

/** O lote tem uma navigation.position válida? */
function acharPosicaoValida(mockAtual: ReceptorMock) {
  return mockAtual.leituras.find((l) => {
    if (l.path !== 'navigation.position') {
      return false
    }
    const v = l.valor as { latitude?: unknown; longitude?: unknown } | null
    return (
      v !== null &&
      typeof v === 'object' &&
      typeof v.latitude === 'number' &&
      typeof v.longitude === 'number' &&
      !Number.isNaN(v.latitude) &&
      !Number.isNaN(v.longitude)
    )
  })
}

const TS_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

describe('conformidade com o signalk-server oficial', () => {
  it('cenário 1: lote com posição válida chega ao mock em até 90s', async () => {
    mock = new ReceptorMock(PORTA_MOCK, TOKEN_DE_TESTE)
    await mock.iniciar()

    const dirConfig = montarDiretorioDeConfig('cenario-1', CONFIG_TESTE)
    const inicio = Date.now()
    servidor = subirSignalK(dirConfig)

    try {
      // Servidor de pé primeiro (dá contexto melhor quando algo quebra cedo).
      let respondeu = false
      await esperarPor(
        () => {
          void signalKRespondendo().then((ok) => (respondeu = respondeu || ok))
          return respondeu
        },
        60_000,
        1000,
        'signalk-server responder na API REST'
      )

      // CRITÉRIO DE PASSAGEM: ≤90s para o primeiro lote com posição válida.
      const decorrido = await esperarPor(
        () => acharPosicaoValida(mock!) !== undefined,
        90_000 - (Date.now() - inicio) > 0 ? 90_000 - (Date.now() - inicio) : 1,
        500,
        'primeiro lote com navigation.position válida no mock'
      )
      const totalMs = Date.now() - inicio
      expect(totalMs).toBeLessThanOrEqual(90_000)

      const posicao = acharPosicaoValida(mock!)
      expect(posicao).toBeDefined()

      // ts UTC ISO em TODAS as leituras recebidas.
      for (const leitura of mock!.leituras) {
        expect(leitura.ts).toMatch(TS_ISO_UTC)
        expect(Number.isNaN(Date.parse(leitura.ts))).toBe(false)
      }

      // Bearer correto em todos os lotes; nenhuma requisição recusada.
      expect(mock!.lotes.length).toBeGreaterThanOrEqual(1)
      for (const lote of mock!.lotes) {
        expect(lote.autorizacao).toBe(`Bearer ${TOKEN_DE_TESTE}`)
      }
      expect(mock!.recusadas).toBe(0)

      const pathsVistos = [...new Set(mock!.leituras.map((l) => l.path))].sort()
      console.log(
        `[cenario-1] ${mock!.lotes.length} lote(s), ${mock!.leituras.length} leitura(s); posição válida em ${Math.round(totalMs / 1000)}s desde o boot (espera final de ${Math.round(decorrido / 1000)}s); paths: ${pathsVistos.join(', ')}`
      )
    } catch (erro) {
      console.error('--- cauda do log do signalk-server (cenário 1) ---')
      console.error(servidor.saida().slice(-4000))
      throw erro
    }
  })

  it('cenário 2: mock fora do ar → fila segura em disco e entrega quando ele volta', async () => {
    // SEM mock ouvindo: todo envio vai falhar até a "volta da rede".
    const dirConfig = montarDiretorioDeConfig('cenario-2', CONFIG_TESTE)
    servidor = subirSignalK(dirConfig)

    const arquivoFila = path.join(
      dirConfig,
      'plugin-config-data',
      'signalk-commander-connector',
      'fila-pendentes.json'
    )

    try {
      // A fila em disco tem de encher enquanto o destino está fora.
      await esperarPor(
        () => {
          try {
            const dados = JSON.parse(fs.readFileSync(arquivoFila, 'utf8'))
            return Array.isArray(dados) && dados.length > 0
          } catch {
            return false
          }
        },
        90_000,
        1000,
        'fila-pendentes.json com leituras retidas (mock fora do ar)'
      )
      const filaAntes = JSON.parse(fs.readFileSync(arquivoFila, 'utf8')) as unknown[]
      const mockSubiuEm = Date.now()

      // "A rede voltou": agora o lote atrasado tem de chegar (backoff ≤ 30s
      // na primeira falha, então 120s dá folga com margem).
      mock = new ReceptorMock(PORTA_MOCK, TOKEN_DE_TESTE)
      await mock.iniciar()

      const esperaMs = await esperarPor(
        () => mock!.lotes.length >= 1,
        120_000,
        1000,
        'primeiro lote entregue depois que o mock voltou'
      )

      // As leituras entregues incluem medições de ANTES do mock subir —
      // prova de que a fila segurou e entregou, não de que só recomeçou.
      const antigas = mock!.leituras.filter(
        (l) => Date.parse(l.ts) < mockSubiuEm
      )
      expect(antigas.length).toBeGreaterThanOrEqual(1)

      for (const lote of mock!.lotes) {
        expect(lote.autorizacao).toBe(`Bearer ${TOKEN_DE_TESTE}`)
      }
      expect(mock!.recusadas).toBe(0)

      console.log(
        `[cenario-2] fila retinha ${filaAntes.length} leitura(s) com o mock fora; entrega em ${Math.round(esperaMs / 1000)}s após a volta; ${mock!.lotes.length} lote(s), ${mock!.leituras.length} leitura(s), ${antigas.length} anteriores à volta do mock`
      )
    } catch (erro) {
      console.error('--- cauda do log do signalk-server (cenário 2) ---')
      console.error(servidor.saida().slice(-4000))
      throw erro
    }
  })
})

/**
 * signalk-commander-connector — plugin de Signal K do app Commander.
 *
 * O que ele faz, em uma frase: assina os dados do PRÓPRIO barco que o dono
 * autorizou (opt-in por categoria) e sobe a última leitura de cada path em
 * lotes resilientes pra conta Commander dele — nunca escreve nada de volta
 * no barramento nem no servidor. Somente leitura, sempre.
 *
 * Conformidade com a doc oficial do signalk-server (v2.31.x):
 * - exporta função (app) => Plugin com id/name/description/schema/start/stop;
 * - assina via app.subscriptionmanager.subscribe() — a API que a própria doc
 *   recomenda para plugins novos (streambundle entrega só a fonte preferida
 *   e está preterido para este uso);
 * - loga pelo canal do servidor: app.debug / setPluginStatus / setPluginError;
 * - fila de pendências no diretório oficial de dados (app.getDataDirPath()).
 */
import path from 'path'
import type { Delta, Plugin, ServerAPI } from '@signalk/server-api'
import type { Unsubscribes } from '@signalk/server-api'
import { Amostrador } from './amostrador'
import { Backoff } from './backoff'
import { pathsParaConfig } from './categorias'
import { FilaDisco, TETO_PADRAO_LEITURAS } from './fila'
import { enviarLote, ErroDeEnvio } from './transporte'
import {
  ConfigConnector,
  ConfigResolvida,
  INTERVALO_LOTE_MINIMO_S,
  INTERVALO_LOTE_PADRAO_S,
  resolverConfig,
  URL_BASE_PADRAO
} from './tipos'

/** Quantas leituras no máximo por POST — lotes grandes demais viram timeout. */
const MAX_LEITURAS_POR_POST = 500

/** Período de entrega das assinaturas (ms): o servidor manda o último valor
 * conhecido de cada path nesse ritmo; a retenção por path fica no Amostrador. */
const PERIODO_ASSINATURA_MS = 1000

const criarPlugin = (app: ServerAPI): Plugin => {
  let cfg: ConfigResolvida | null = null
  let fila: FilaDisco | null = null
  const amostrador = new Amostrador()
  const backoff = new Backoff()
  let unsubscribes: Unsubscribes = []
  let timerLote: ReturnType<typeof setInterval> | null = null
  let enviando = false

  /** Extrai leituras de um delta e retém a última por path. */
  const aoReceberDelta = (delta: Delta): void => {
    for (const update of delta.updates ?? []) {
      if (!('values' in update) || !Array.isArray(update.values)) {
        continue // deltas de meta não carregam leituras
      }
      for (const pv of update.values) {
        amostrador.registrar(pv.path, pv.value, update.timestamp)
      }
    }
  }

  /**
   * Descarrega a fila pro Commander respeitando o backoff. A fila é o único
   * buffer: toda coleta entra nela primeiro, então rede fora não perde nada
   * (até o teto FIFO) e reinício do servidor retoma do disco.
   */
  const tentarEnviar = async (ignorarBackoff = false): Promise<void> => {
    if (!cfg || !fila || enviando) {
      return
    }
    if (!cfg.token) {
      app.setPluginError('Sem token da conta Commander — configure o plugin.')
      return
    }
    enviando = true
    try {
      while (fila.tamanho > 0) {
        const agora = Date.now()
        if (!ignorarBackoff && !backoff.podeTentar(agora)) {
          const seg = Math.ceil(backoff.esperaRestanteMs(agora) / 1000)
          app.setPluginStatus(
            `Aguardando rede — nova tentativa em ${seg}s (fila: ${fila.tamanho} leituras)`
          )
          return
        }
        const lote = fila.espiar(MAX_LEITURAS_POR_POST)
        try {
          await enviarLote(cfg.urlBase, cfg.token, lote)
          fila.remover(lote.length)
          backoff.sucesso()
          app.debug(`lote de ${lote.length} leituras entregue (fila: ${fila.tamanho})`)
          app.setPluginStatus(
            `Ativo — último lote: ${lote.length} leituras às ${new Date().toISOString()}`
          )
        } catch (erro) {
          backoff.falhou(Date.now())
          const msg = erro instanceof Error ? erro.message : String(erro)
          if (erro instanceof ErroDeEnvio && (erro.status === 401 || erro.status === 403)) {
            app.setPluginError(
              'Commander recusou o token (verifique em /menu/ajustes). Leituras seguem na fila.'
            )
          } else {
            app.setPluginError(`Falha ao enviar lote: ${msg}`)
          }
          app.debug(`envio falhou (${msg}); backoff ${backoff.atrasoAtualMs / 1000}s`)
          return
        }
      }
    } finally {
      enviando = false
    }
  }

  /** Um ciclo do relógio de lote: drena o amostrador pra fila e tenta enviar. */
  const cicloDeLote = (): void => {
    if (!fila) {
      return
    }
    const novas = amostrador.coletar()
    if (novas.length > 0) {
      fila.adicionar(novas)
    }
    void tentarEnviar()
  }

  const plugin: Plugin = {
    id: 'signalk-commander-connector',
    name: 'Commander Connector',
    description:
      'Envia dados do seu barco para a sua conta no Commander — você escolhe o que compartilhar, categoria por categoria.',

    schema: () => ({
      type: 'object',
      required: ['token'],
      properties: {
        urlBase: {
          type: 'string',
          title: 'Endereço do Commander',
          description: 'Deixe o padrão, a não ser que o suporte peça para mudar.',
          default: URL_BASE_PADRAO
        },
        token: {
          type: 'string',
          title: 'Token da conta Commander',
          description: 'Gere em Menu → Ajustes no app Commander e cole aqui.'
        },
        posicao: {
          type: 'boolean',
          title: 'Compartilhar posição (posição, velocidade e rumo sobre o fundo)',
          default: false
        },
        motor: {
          type: 'boolean',
          title: 'Compartilhar motor (rotação, temperatura e horímetro)',
          default: false
        },
        profundidade: {
          type: 'boolean',
          title: 'Compartilhar profundidade (sob a quilha; transdutor como reserva)',
          default: false
        },
        eletrica: {
          type: 'boolean',
          title: 'Compartilhar elétrica (tensão e corrente das baterias)',
          default: false
        },
        ambiente: {
          type: 'boolean',
          title: 'Compartilhar ambiente (vento e temperatura da água)',
          default: false
        },
        intervaloLoteSegundos: {
          type: 'number',
          title: 'Intervalo entre lotes (segundos)',
          default: INTERVALO_LOTE_PADRAO_S,
          minimum: INTERVALO_LOTE_MINIMO_S
        }
      }
    }),

    uiSchema: () => ({
      token: { 'ui:widget': 'password' }
    }),

    start: (settings: object) => {
      cfg = resolverConfig(settings as ConfigConnector)
      fila = new FilaDisco(
        path.join(app.getDataDirPath(), 'fila-pendentes.json'),
        TETO_PADRAO_LEITURAS
      )
      const paths = pathsParaConfig(cfg)

      if (!cfg.token) {
        app.setPluginStatus('Aguardando token da conta Commander (Menu → Ajustes no app).')
      }
      if (paths.length === 0) {
        app.setPluginStatus(
          'Nenhuma categoria de compartilhamento ligada — nada será enviado.'
        )
        app.debug('start sem categorias ligadas; sem assinaturas')
        return
      }

      // Assinatura oficial: contexto do PRÓPRIO barco, um path por categoria
      // ligada, entrega periódica (o Amostrador retém a última por path).
      app.subscriptionmanager.subscribe(
        {
          context: 'vessels.self',
          subscribe: paths.map((p) => ({
            path: p,
            period: PERIODO_ASSINATURA_MS
          }))
        } as Parameters<typeof app.subscriptionmanager.subscribe>[0],
        unsubscribes,
        (erro) => {
          app.setPluginError(`Erro na assinatura de dados: ${String(erro)}`)
        },
        aoReceberDelta
      )

      timerLote = setInterval(cicloDeLote, cfg.intervaloLoteSegundos * 1000)
      app.debug(
        `iniciado: ${paths.length} paths assinados, lote a cada ${cfg.intervaloLoteSegundos}s, fila com ${fila.tamanho} pendentes`
      )
      app.setPluginStatus(
        `Ativo — ${paths.length} caminhos assinados; lote a cada ${cfg.intervaloLoteSegundos}s`
      )
      // Se ficou pendência de uma sessão anterior no disco, já tenta subir.
      if (fila.tamanho > 0) {
        void tentarEnviar()
      }
    },

    stop: async () => {
      // Ordem importa: para o relógio e as assinaturas primeiro, depois um
      // último esforço de entrega (ignorando backoff) — e o que não subir
      // fica persistido em disco pra próxima sessão.
      if (timerLote) {
        clearInterval(timerLote)
        timerLote = null
      }
      unsubscribes.forEach((desassinar) => desassinar())
      unsubscribes = []
      if (fila) {
        const restantes = amostrador.coletar()
        if (restantes.length > 0) {
          fila.adicionar(restantes)
        }
        if (cfg?.token && fila.tamanho > 0) {
          try {
            await tentarEnviar(true)
          } catch {
            // Falha no flush final não impede o stop — a fila fica no disco.
          }
        }
      }
      app.debug('parado; fila persistida em disco')
      app.setPluginStatus('Parado')
    }
  }

  return plugin
}

export = criarPlugin

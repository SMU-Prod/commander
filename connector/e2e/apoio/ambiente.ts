/**
 * Apoio do e2e: monta um diretório de configuração do Signal K do zero,
 * "instala" o plugin nele (junction pro repo, o equivalente do npm link que
 * a doc oficial recomenda) e sobe o signalk-server REAL por linha de comando
 * com os dados de amostra embutidos (--sample-n2k-data).
 */
import { ChildProcess, spawn, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export const RAIZ_CONNECTOR = path.resolve(__dirname, '..', '..')
export const PORTA_SIGNALK = 3999
export const PORTA_MOCK = 4999
export const TOKEN_DE_TESTE = 'token-de-teste-commander'
export const URL_MOCK = `http://127.0.0.1:${PORTA_MOCK}`

export interface ConfigDePlugin {
  urlBase: string
  token: string
  posicao: boolean
  motor: boolean
  profundidade: boolean
  eletrica: boolean
  ambiente: boolean
  intervaloLoteSegundos: number
}

export const CONFIG_TESTE: ConfigDePlugin = {
  urlBase: URL_MOCK,
  token: TOKEN_DE_TESTE,
  posicao: true,
  motor: true,
  profundidade: true,
  eletrica: true,
  ambiente: true,
  intervaloLoteSegundos: 5
}

/**
 * Cria um diretório de config do Signal K pronto pra subir com o plugin
 * ativado. Devolve o caminho do diretório.
 */
export function montarDiretorioDeConfig(nome: string, config: ConfigDePlugin): string {
  const base = path.join(RAIZ_CONNECTOR, 'e2e', '.tmp', nome)
  fs.rmSync(base, { recursive: true, force: true })
  fs.mkdirSync(base, { recursive: true })

  // settings.json mínimo: sem mDNS (barulho desnecessário no CI) e sem
  // provedores — a amostra entra pela flag --sample-n2k-data.
  fs.writeFileSync(
    path.join(base, 'settings.json'),
    JSON.stringify({ mdns: false, pipedProviders: [], interfaces: {} }, null, 2),
    'utf8'
  )

  // Configuração do plugin no lugar oficial: plugin-config-data/<id>.json
  // com { enabled, configuration } — é o que o servidor lê no startup.
  const dirPluginConfig = path.join(base, 'plugin-config-data')
  fs.mkdirSync(dirPluginConfig, { recursive: true })
  fs.writeFileSync(
    path.join(dirPluginConfig, 'signalk-commander-connector.json'),
    JSON.stringify({ enabled: true, configuration: config }, null, 2),
    'utf8'
  )

  // "Instala" o plugin: o servidor procura pacotes com a keyword
  // signalk-node-server-plugin em <config>/node_modules. Uma junction pro
  // repo faz o papel do npm link sem precisar de privilégios no Windows.
  const dirModulos = path.join(base, 'node_modules')
  fs.mkdirSync(dirModulos, { recursive: true })
  fs.symlinkSync(
    RAIZ_CONNECTOR,
    path.join(dirModulos, 'signalk-commander-connector'),
    'junction'
  )

  return base
}

export interface ServidorDeTeste {
  processo: ChildProcess
  /** Saída acumulada (stdout+stderr) pra diagnóstico quando algo falha. */
  saida: () => string
  parar: () => Promise<void>
}

/** Sobe o signalk-server oficial como processo filho, igual usuário real. */
export function subirSignalK(dirConfig: string): ServidorDeTeste {
  const bin = path.join(
    RAIZ_CONNECTOR,
    'node_modules',
    'signalk-server',
    'bin',
    'signalk-server'
  )
  let acumulado = ''
  const processo = spawn(
    process.execPath,
    [bin, '--sample-n2k-data', '--override-timestamps'],
    {
      env: {
        ...process.env,
        SIGNALK_NODE_CONFIG_DIR: dirConfig,
        PORT: String(PORTA_SIGNALK),
        DEBUG: 'signalk-commander-connector*'
      },
      cwd: RAIZ_CONNECTOR,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  processo.stdout?.on('data', (d) => (acumulado += d.toString()))
  processo.stderr?.on('data', (d) => (acumulado += d.toString()))

  const parar = (): Promise<void> =>
    new Promise((resolver) => {
      if (processo.exitCode !== null || processo.pid === undefined) {
        resolver()
        return
      }
      processo.once('exit', () => resolver())
      // No Windows, taskkill /T derruba a árvore inteira do processo.
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(processo.pid), '/T', '/F'], {
          windowsHide: true
        })
      } else {
        processo.kill('SIGTERM')
      }
      // Rede de segurança: se não sair em 10s, segue o baile.
      setTimeout(() => resolver(), 10_000).unref()
    })

  return { processo, saida: () => acumulado, parar }
}

/** Espera uma condição virar verdade, checando a cada `passoMs`. */
export async function esperarPor(
  condicao: () => boolean,
  limiteMs: number,
  passoMs = 500,
  descricao = 'condição'
): Promise<number> {
  const inicio = Date.now()
  while (Date.now() - inicio < limiteMs) {
    if (condicao()) {
      return Date.now() - inicio
    }
    await new Promise((r) => setTimeout(r, passoMs))
  }
  throw new Error(`tempo esgotado (${limiteMs}ms) esperando: ${descricao}`)
}

/** O servidor respondeu na API REST? (sinal de que subiu de verdade) */
export async function signalKRespondendo(): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${PORTA_SIGNALK}/signalk`, {
      signal: AbortSignal.timeout(2000)
    })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Transporte: POST real contra um servidorzinho local — valida Bearer, corpo
 * e o tratamento de erro por status.
 */
import http from 'http'
import { AddressInfo } from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import { enviarLote, ErroDeEnvio } from '../src/transporte'
import { Leitura } from '../src/tipos'

interface RequisicaoVista {
  metodo: string | undefined
  url: string | undefined
  autorizacao: string | undefined
  contentType: string | undefined
  corpo: unknown
}

let servidor: http.Server | null = null

function subirServidor(
  status: number,
  vistas: RequisicaoVista[]
): Promise<string> {
  return new Promise((resolver) => {
    servidor = http.createServer((req, res) => {
      let cru = ''
      req.on('data', (pedaco) => (cru += pedaco))
      req.on('end', () => {
        vistas.push({
          metodo: req.method,
          url: req.url,
          autorizacao: req.headers.authorization,
          contentType: req.headers['content-type'],
          corpo: cru ? JSON.parse(cru) : null
        })
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: status < 400 }))
      })
    })
    servidor.listen(0, '127.0.0.1', () => {
      const porta = (servidor!.address() as AddressInfo).port
      resolver(`http://127.0.0.1:${porta}`)
    })
  })
}

afterEach(() => {
  servidor?.close()
  servidor = null
})

const leituras: Leitura[] = [
  {
    path: 'navigation.position',
    valor: { latitude: -23.98, longitude: -46.31 },
    ts: '2026-08-20T12:00:00.000Z'
  },
  { path: 'navigation.speedOverGround', valor: 3.6, ts: '2026-08-20T12:00:01.000Z' }
]

describe('enviarLote', () => {
  it('faz POST em /api/connect/ingest com Bearer e corpo { leituras }', async () => {
    const vistas: RequisicaoVista[] = []
    const base = await subirServidor(200, vistas)
    await enviarLote(base, 'meu-token-secreto', leituras)
    expect(vistas).toHaveLength(1)
    expect(vistas[0].metodo).toBe('POST')
    expect(vistas[0].url).toBe('/api/connect/ingest')
    expect(vistas[0].autorizacao).toBe('Bearer meu-token-secreto')
    expect(vistas[0].contentType).toContain('application/json')
    expect(vistas[0].corpo).toEqual({ leituras })
  })

  it('status fora de 2xx vira ErroDeEnvio com o status preservado', async () => {
    const vistas: RequisicaoVista[] = []
    const base = await subirServidor(401, vistas)
    const promessa = enviarLote(base, 'token-ruim', leituras)
    await expect(promessa).rejects.toBeInstanceOf(ErroDeEnvio)
    await expect(
      enviarLote(base, 'token-ruim', leituras).catch((e: ErroDeEnvio) => e.status)
    ).resolves.toBe(401)
  })

  it('rede fora (porta sem ninguém ouvindo) vira ErroDeEnvio sem status', async () => {
    const promessa = enviarLote('http://127.0.0.1:1', 'token', leituras, 2000)
    const erro = await promessa.then(
      () => null,
      (e: ErroDeEnvio) => e
    )
    expect(erro).toBeInstanceOf(ErroDeEnvio)
    expect(erro?.status).toBeUndefined()
  })
})

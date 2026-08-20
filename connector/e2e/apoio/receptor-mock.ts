/**
 * Receptor mock do Commander: um http.createServer local que faz o papel da
 * rota /api/connect/ingest — valida o Bearer e guarda os lotes recebidos
 * para as asserções do e2e.
 */
import http from 'http'
import { AddressInfo } from 'net'

export interface LoteRecebido {
  autorizacao: string | undefined
  corpo: { leituras: Array<{ path: string; valor: unknown; ts: string }> }
  recebidoEm: number
}

export class ReceptorMock {
  /** Lotes que chegaram com o Bearer correto. */
  lotes: LoteRecebido[] = []
  /** Requisições recusadas por token errado ou ausente. */
  recusadas = 0
  private servidor: http.Server | null = null

  constructor(
    private readonly porta: number,
    private readonly tokenEsperado: string
  ) {}

  iniciar(): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      this.servidor = http.createServer((req, res) => {
        let cru = ''
        req.on('data', (pedaco) => (cru += pedaco))
        req.on('end', () => {
          const esperado = `Bearer ${this.tokenEsperado}`
          if (req.headers.authorization !== esperado) {
            this.recusadas += 1
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ erro: 'token invalido' }))
            return
          }
          try {
            const corpo = JSON.parse(cru)
            this.lotes.push({
              autorizacao: req.headers.authorization,
              corpo,
              recebidoEm: Date.now()
            })
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ erro: 'json invalido' }))
          }
        })
      })
      this.servidor.once('error', rejeitar)
      this.servidor.listen(this.porta, '127.0.0.1', () => {
        // Confirma que a porta pedida foi mesmo a obtida (sanidade).
        const endereco = this.servidor!.address() as AddressInfo
        if (endereco.port !== this.porta) {
          rejeitar(new Error(`porta inesperada: ${endereco.port}`))
          return
        }
        resolver()
      })
    })
  }

  parar(): Promise<void> {
    return new Promise((resolver) => {
      if (!this.servidor) {
        resolver()
        return
      }
      this.servidor.close(() => resolver())
      // Derruba conexões keep-alive penduradas pra fechar rápido.
      this.servidor.closeAllConnections?.()
      this.servidor = null
    })
  }

  /** Todas as leituras de todos os lotes válidos, achatadas. */
  get leituras(): Array<{ path: string; valor: unknown; ts: string }> {
    return this.lotes.flatMap((l) => l.corpo.leituras ?? [])
  }
}

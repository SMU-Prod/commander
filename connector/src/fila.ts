/**
 * Fila de leituras pendentes com persistência em disco.
 *
 * Quando a rede cai (barco no meio da baía sem sinal), as leituras ficam
 * aqui — no diretório de dados que o próprio Signal K dá ao plugin
 * (app.getDataDirPath()) — e sobem quando a conexão volta. FIFO com teto:
 * ao estourar, as leituras MAIS ANTIGAS caem primeiro (o presente vale mais
 * que o passado para monitoramento).
 *
 * A escrita é atômica no possível: grava num .tmp e renomeia por cima
 * (fs.rename substitui o destino também no Windows), então uma queda de
 * energia no meio da escrita não corrompe a fila já persistida.
 */
import fs from 'fs'
import path from 'path'
import { Leitura } from './tipos'

export const TETO_PADRAO_LEITURAS = 5000

export class FilaDisco {
  private itens: Leitura[] = []

  constructor(
    private readonly arquivo: string,
    private readonly teto: number = TETO_PADRAO_LEITURAS
  ) {
    this.carregar()
  }

  /** Lê o arquivo persistido; conteúdo corrompido ou ausente = fila vazia. */
  private carregar(): void {
    try {
      const cru = fs.readFileSync(this.arquivo, 'utf8')
      const dados = JSON.parse(cru)
      if (Array.isArray(dados)) {
        this.itens = dados.filter(
          (i): i is Leitura =>
            i !== null &&
            typeof i === 'object' &&
            typeof i.path === 'string' &&
            typeof i.ts === 'string' &&
            'valor' in i
        )
      }
    } catch {
      // Sem arquivo ainda, ou JSON inválido — começa do zero sem drama.
      this.itens = []
    }
  }

  private persistir(): void {
    const tmp = this.arquivo + '.tmp'
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true })
    fs.writeFileSync(tmp, JSON.stringify(this.itens), 'utf8')
    fs.renameSync(tmp, this.arquivo)
  }

  get tamanho(): number {
    return this.itens.length
  }

  /** Enfileira novas leituras; acima do teto, descarta as mais antigas. */
  adicionar(leituras: Leitura[]): void {
    if (leituras.length === 0) {
      return
    }
    this.itens.push(...leituras)
    if (this.itens.length > this.teto) {
      this.itens.splice(0, this.itens.length - this.teto)
    }
    this.persistir()
  }

  /** Olha as próximas leituras sem retirar (retira só após envio confirmado). */
  espiar(max: number): Leitura[] {
    return this.itens.slice(0, max)
  }

  /** Remove da frente as leituras já entregues e persiste o novo estado. */
  remover(quantidade: number): void {
    if (quantidade <= 0) {
      return
    }
    this.itens.splice(0, quantidade)
    this.persistir()
  }
}

/**
 * Backoff exponencial para o envio de lotes: 30s após a primeira falha,
 * dobrando a cada falha seguida, com teto de 10 minutos. Sucesso zera tudo.
 *
 * A classe só faz aritmética de tempo (recebe o "agora" de fora) — o que a
 * deixa 100% testável sem timers de verdade.
 */

export const BACKOFF_BASE_MS = 30_000
export const BACKOFF_TETO_MS = 600_000

export class Backoff {
  private falhasSeguidas = 0
  private ultimaFalhaEm = 0

  constructor(
    private readonly baseMs: number = BACKOFF_BASE_MS,
    private readonly tetoMs: number = BACKOFF_TETO_MS
  ) {}

  /** Registra uma falha de envio no instante dado. */
  falhou(agoraMs: number): void {
    this.falhasSeguidas += 1
    this.ultimaFalhaEm = agoraMs
  }

  /** Envio confirmado — o próximo lote sai sem espera. */
  sucesso(): void {
    this.falhasSeguidas = 0
    this.ultimaFalhaEm = 0
  }

  /** Atraso vigente após a última falha (0 quando não há falha ativa). */
  get atrasoAtualMs(): number {
    if (this.falhasSeguidas === 0) {
      return 0
    }
    const exponencial = this.baseMs * 2 ** (this.falhasSeguidas - 1)
    return Math.min(exponencial, this.tetoMs)
  }

  /** Já pode tentar de novo? */
  podeTentar(agoraMs: number): boolean {
    if (this.falhasSeguidas === 0) {
      return true
    }
    return agoraMs - this.ultimaFalhaEm >= this.atrasoAtualMs
  }

  /** Quanto falta (ms) até a próxima tentativa — para mensagens de status. */
  esperaRestanteMs(agoraMs: number): number {
    if (this.podeTentar(agoraMs)) {
      return 0
    }
    return this.atrasoAtualMs - (agoraMs - this.ultimaFalhaEm)
  }
}

/**
 * Amostragem honesta: entre um lote e outro o plugin retém apenas a ÚLTIMA
 * leitura de cada path. Nada de flood — se o barramento emite posição 10x por
 * segundo, o Commander recebe uma por lote.
 */
import { Leitura } from './tipos'

const PATH_PROF_QUILHA = 'environment.depth.belowKeel'
const PATH_PROF_TRANSDUTOR = 'environment.depth.belowTransducer'

export class Amostrador {
  private ultimas = new Map<string, Leitura>()

  /**
   * Registra uma leitura vinda do barramento. Valores nulos/indefinidos são
   * ignorados (o Signal K emite null para "sem dado" em alguns paths).
   * O ts vem do delta quando o servidor mandou um timestamp válido; senão,
   * carimbamos o agora — sempre UTC ISO.
   */
  registrar(path: string, valor: unknown, tsDelta?: string): void {
    if (!path || valor === null || valor === undefined) {
      return
    }
    const ts =
      tsDelta && !Number.isNaN(Date.parse(tsDelta))
        ? new Date(tsDelta).toISOString()
        : new Date().toISOString()
    this.ultimas.set(path, { path, valor, ts })
  }

  /** Quantos paths têm leitura retida agora. */
  get tamanho(): number {
    return this.ultimas.size
  }

  /**
   * Drena as leituras retidas (o próximo lote começa do zero) aplicando o
   * fallback de profundidade: quando belowKeel está presente na janela,
   * belowTransducer é descartada — o transdutor só sobe na ausência da
   * profundidade sob a quilha.
   */
  coletar(): Leitura[] {
    const leituras = Array.from(this.ultimas.values())
    this.ultimas.clear()
    const temQuilha = leituras.some((l) => l.path === PATH_PROF_QUILHA)
    if (!temQuilha) {
      return leituras
    }
    return leituras.filter((l) => l.path !== PATH_PROF_TRANSDUTOR)
  }
}

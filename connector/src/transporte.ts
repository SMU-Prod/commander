/**
 * Transporte do lote pro Commander: POST simples com Bearer token.
 *
 * O corpo segue o contrato da rota /api/connect/ingest:
 *   { leituras: [{ path, valor, ts }] }
 * Valores nas unidades SI do Signal K, sem conversão — converter é papel do app.
 */
import { Leitura } from './tipos'

export const TIMEOUT_ENVIO_MS = 15_000

/** Erro de envio carregando o status HTTP quando houve resposta do servidor. */
export class ErroDeEnvio extends Error {
  constructor(
    mensagem: string,
    public readonly status?: number
  ) {
    super(mensagem)
    this.name = 'ErroDeEnvio'
  }
}

/**
 * Envia um lote de leituras. Resolve em 2xx; qualquer outra coisa (rede fora,
 * timeout, 4xx/5xx) vira ErroDeEnvio — quem decide o que fazer é o chamador
 * (fila + backoff em index.ts).
 */
export async function enviarLote(
  urlBase: string,
  token: string,
  leituras: Leitura[],
  timeoutMs: number = TIMEOUT_ENVIO_MS
): Promise<void> {
  const url = `${urlBase}/api/connect/ingest`
  let resposta: Response
  try {
    resposta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ leituras }),
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (erro) {
    // Rede fora, DNS, timeout — sem resposta HTTP.
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    throw new ErroDeEnvio(`falha de rede ao enviar lote: ${detalhe}`)
  }
  if (!resposta.ok) {
    throw new ErroDeEnvio(
      `servidor respondeu ${resposta.status} ao lote`,
      resposta.status
    )
  }
}

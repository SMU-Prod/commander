/** Rate limit simples, em memória, por instância do processo.
 *
 *  ATENÇÃO — leia antes de confiar nisso como proteção forte: em ambiente
 *  serverless (Vercel), cada invocação PODE cair numa instância de função
 *  diferente, e cada instância tem sua PRÓPRIA memória — não existe um
 *  contador compartilhado entre instâncias/regiões aqui. Isso é
 *  **mitigação, não muralha**: reduz o dano de um cliente único martelando
 *  a mesma instância "quente" (comum em rajada curta), mas NÃO impede um
 *  ataque distribuído que acerte instâncias diferentes a cada request. Se
 *  o volume real de abuso um dia justificar uma barreira de verdade, a
 *  solução é um contador compartilhado (Redis/Upstash) — deliberadamente
 *  NÃO implementado aqui pra não introduzir uma dependência nova pesada
 *  numa mitigação básica (ver `docs/OPERACAO.md`, seção Rate limiting).
 *
 *  Algoritmo: janela fixa (fixed window) por chave — mais simples que uma
 *  janela deslizante de verdade, suficiente pra mitigação (não pra billing
 *  preciso: um cliente pode, no pior caso, mandar até 2x o limite bem na
 *  borda de duas janelas consecutivas).
 */

interface Balde {
  contagem: number
  iniciadoEm: number
  janelaMs: number
}

const baldes = new Map<string, Balde>()

// Limpeza esporádica pra não vazar memória indefinidamente dentro da MESMA
// instância de longa duração (dev local, ou uma instância que fica quente
// por um tempo em produção). Roda a cada N chamadas — não via
// `setInterval`, que não tem garantia de ser limpo entre invocações
// serverless.
let chamadasDesdeLimpeza = 0
const LIMPEZA_A_CADA = 500

export interface ResultadoLimite {
  permitido: boolean
  restante: number
  /** Quanto falta (em ms) pra janela atual desta chave resetar. 0 quando `permitido`. */
  retryAfterMs: number
}

/** Verifica e REGISTRA uma chamada da chave `chave` contra o limite
 *  `maxNaJanela` por `janelaMs`. Cada chamada conta — não é só leitura. */
export function checarLimite(chave: string, janelaMs: number, maxNaJanela: number): ResultadoLimite {
  const agora = Date.now()
  let b = baldes.get(chave)
  if (!b || agora - b.iniciadoEm >= b.janelaMs) {
    b = { contagem: 0, iniciadoEm: agora, janelaMs }
    baldes.set(chave, b)
  }
  b.contagem++

  chamadasDesdeLimpeza++
  if (chamadasDesdeLimpeza >= LIMPEZA_A_CADA) {
    limparExpirados(agora)
    chamadasDesdeLimpeza = 0
  }

  const permitido = b.contagem <= maxNaJanela
  return {
    permitido,
    restante: Math.max(0, maxNaJanela - b.contagem),
    retryAfterMs: permitido ? 0 : Math.max(0, b.janelaMs - (agora - b.iniciadoEm)),
  }
}

function limparExpirados(agora: number): void {
  for (const [chave, b] of baldes) {
    if (agora - b.iniciadoEm >= b.janelaMs) baldes.delete(chave)
  }
}

/** Só pra teste — não use em código de produto. */
export function _resetarLimitesParaTeste(): void {
  baldes.clear()
  chamadasDesdeLimpeza = 0
}

/** Extrai o melhor identificador de cliente disponível a partir dos headers
 *  de um `Request`/`NextRequest`. A Vercel injeta `x-forwarded-for` com o IP
 *  real do cliente na frente (formato `cliente, proxy1, proxy2, ...`) — o
 *  PRIMEIRO valor é o mais próximo do cliente original. Sem o header (dev
 *  local, teste), cai num balde único "desconhecido" — aceitável só fora de
 *  produção. */
export function identificarIp(headers: Headers): string {
  const encaminhado = headers.get("x-forwarded-for")
  if (encaminhado) return encaminhado.split(",")[0].trim()
  const real = headers.get("x-real-ip")
  if (real) return real.trim()
  return "desconhecido"
}

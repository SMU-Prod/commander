/**
 * ONDA 141 — A PRIMEIRA TELA DOS DADOS DO COMMANDER CONNECTOR.
 * ===========================================================================
 * O plugin de Signal K (connector/, publicado 20/08) grava leituras cruas em
 * `telemetria` NAS UNIDADES SI DO PADRÃO — o contrato da ingestão
 * (`app/api/connect/ingest/route.ts`) é explícito: "conversão é
 * responsabilidade de quem exibe". Este arquivo é o "quem exibe" em forma de
 * domínio puro: converte pro vocabulário da casa, diz há quanto tempo o dado
 * chegou e escolhe o que cada hub mostra. Nenhum I/O — a consulta mora em
 * `lib/consultas-telemetria.ts`, as telas nos hubs Elétrica e Motores.
 *
 * AS TRÊS REGRAS DE HONESTIDADE, que os testes ao lado cobram:
 *
 * 1. NULL NUNCA VIRA ZERO. `valor` é jsonb e chega do barco de outra pessoa:
 *    o que não for número finito vira `null`, e um grupo (banco, motor) cujas
 *    leituras são todas `null` simplesmente não aparece. Mas 0 É um número:
 *    0 rpm é motor parado, não "sem leitura" — a mesma régua do decodificador
 *    N2K (`lib/nmea/n2k-motor.ts`, "Sentinela").
 *
 * 2. O FRESCOR É PARTE DO DADO. Telemetria sem carimbo de idade é um número
 *    que finge ser agora. Fora da janela de 48h o rótulo é `null` — e o
 *    contrato das telas é que sem rótulo o cartão inteiro some, em vez de
 *    exibir uma leitura de anteontem como estado do barco.
 *
 * 3. VÍNCULO SÓ QUANDO É CERTO. `propulsion.port` casa com o motor de posição
 *    BB apenas se existe EXATAMENTE UM motor BB cadastrado; qualquer
 *    ambiguidade (nome desconhecido, dois BB, nenhum BB) mostra o nome cru do
 *    path — apontar o motor errado numa tela de temperatura é pior que não
 *    apontar nenhum.
 */

/** Uma leitura como a consulta entrega: o jsonb cru e o instante DA MEDIÇÃO
 *  (ts do barco, não `recebido_em` — fila offline do plugin pode segurar
 *  horas de dado, e o que interessa é quando o motor estava naquele estado). */
export interface LeituraTelemetria {
  valor: unknown
  ts: string
}

/** path → leitura mais recente daquele path (o dedupe é da consulta). */
export type MapaTelemetria = Record<string, LeituraTelemetria>

/** 48h: além disso a leitura deixa de dizer algo sobre o barco DE HOJE.
 *  A consulta usa a mesma constante como corte do `gte` — janela e rótulo
 *  saem da mesma régua de propósito. */
export const JANELA_TELEMETRIA_MS = 48 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Conversões SI do Signal K → unidades da casa
// ---------------------------------------------------------------------------

// m/s → nós: a conta JÁ MORA no navegador de bordo desde a onda dele, e a
// telemetria fala da mesma água — reexportar em vez de copiar é o que impede
// as duas telas de divergirem no quarto decimal.
export { msParaNos } from "./navegacao"

/** Kelvin → °C (temperatura de motor e de água chegam em K). */
export function kelvinParaCelsius(k: number | null): number | null {
  if (k == null) return null
  return k - 273.15
}

/** Radianos → graus, preservando o sinal — o ângulo de vento aparente do
 *  Signal K é −π..π (negativo = bombordo), e quem exibe decide a leitura. */
export function radParaGraus(rad: number | null): number | null {
  if (rad == null) return null
  return (rad * 180) / Math.PI
}

/** Segundos → horas: `propulsion.*.runTime` chega em s, e o horímetro da casa
 *  (`equipamentos.horas_atuais`) fala em horas. */
export function segundosParaHoras(s: number | null): number | null {
  if (s == null) return null
  return s / 3600
}

/** Hz → rpm. `propulsion.*.revolutions` é rotação POR SEGUNDO na spec do
 *  Signal K — mostrar o valor cru como "rpm" erraria por um fator de 60. */
export function hzParaRpm(hz: number | null): number | null {
  if (hz == null) return null
  return hz * 60
}

// ---------------------------------------------------------------------------
// Frescor
// ---------------------------------------------------------------------------

/**
 * "agora" (≤2 min) · "há X min" · "há X h" · `null` fora da janela de 48h.
 * `Math.floor`, não `round`: "há 1 h" até completar duas é errar pro lado que
 * não promete frescor a mais. Ts no futuro lê como "agora" — a ingestão
 * tolera 10 min de relógio adiantado no barco, e acusar dado do futuro seria
 * transformar folga de relógio em mentira na tela.
 */
export function rotuloFrescor(tsISO: string, agoraMs: number = Date.now()): string | null {
  const medido = Date.parse(tsISO)
  if (!Number.isFinite(medido)) return null
  const diffMs = Math.max(0, agoraMs - medido)
  if (diffMs > JANELA_TELEMETRIA_MS) return null
  if (diffMs <= 2 * 60_000) return "agora"
  const min = Math.floor(diffMs / 60_000)
  if (min < 60) return `há ${min} min`
  return `há ${Math.floor(min / 60)} h`
}

/**
 * O carimbo do cartão: "Ao vivo · agora" quando o dado é deste instante, e
 * "Última leitura há 3 h" quando não é — o cartão nunca se chama "ao vivo"
 * mostrando dado de horas atrás. `null` sem ts ou fora da janela: é o sinal
 * que a tela usa pra NÃO desenhar o cartão.
 */
export function carimboAoVivo(
  tsISO: string | null,
  agoraMs: number = Date.now(),
): { texto: string; aoVivo: boolean } | null {
  if (tsISO == null) return null
  const rotulo = rotuloFrescor(tsISO, agoraMs)
  if (rotulo == null) return null
  return rotulo === "agora"
    ? { texto: "Ao vivo · agora", aoVivo: true }
    : { texto: `Última leitura ${rotulo}`, aoVivo: false }
}

// ---------------------------------------------------------------------------
// Seleção por categoria
// ---------------------------------------------------------------------------

/** jsonb cru → número, ou `null`. String numérica NÃO passa de propósito:
 *  o contrato do conector manda número, e aceitar "12.6" aqui abriria a
 *  porta pra qualquer instalação inventar formato. */
function numeroOuNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** O ts mais novo de um conjunto de leituras que REALMENTE viraram tela —
 *  leitura descartada (valor lixo) não carimba frescor de ninguém. */
function tsMaisNovoDe(tss: string[]): string | null {
  let melhor: string | null = null
  for (const t of tss) {
    if (melhor == null || Date.parse(t) > Date.parse(melhor)) melhor = t
  }
  return melhor
}

const PATH_BATERIA = /^electrical\.batteries\.([A-Za-z0-9-]+)\.(voltage|current)$/
const PATH_MOTOR = /^propulsion\.([A-Za-z0-9-]+)\.(revolutions|temperature|runTime)$/

export interface BancoAoVivo {
  /** "Banco 0" quando o id do Signal K é numérico; o nome cru ("house")
   *  quando a instalação nomeou — a casa não renumera o barco dos outros. */
  rotulo: string
  /** Volts — o SI aqui já é a unidade da casa. */
  voltagem: number | null
  /** Ampères; negativo é descarga, como o barramento reporta. */
  corrente: number | null
}

/**
 * O recorte do hub Elétrica: voltagem e corrente por banco de bateria.
 * Banco sem NENHUMA leitura válida não entra; mapa sem elétrica devolve
 * vazio — e vazio, lá na tela, é cartão inexistente, não cartão em branco.
 */
export function bancosAoVivo(mapa: MapaTelemetria): { bancos: BancoAoVivo[]; tsMaisNovo: string | null } {
  const porBanco = new Map<string, { voltagem: number | null; corrente: number | null; tss: string[] }>()
  for (const [path, leitura] of Object.entries(mapa)) {
    const m = PATH_BATERIA.exec(path)
    if (!m) continue
    const valor = numeroOuNull(leitura.valor)
    if (valor == null) continue
    const banco = porBanco.get(m[1]) ?? { voltagem: null, corrente: null, tss: [] }
    if (m[2] === "voltage") banco.voltagem = valor
    else banco.corrente = valor
    banco.tss.push(leitura.ts)
    porBanco.set(m[1], banco)
  }

  const bancos = [...porBanco.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))
    .map(([id, b]) => ({
      rotulo: /^\d+$/.test(id) ? `Banco ${id}` : id,
      voltagem: b.voltagem,
      corrente: b.corrente,
    }))
  return {
    bancos,
    tsMaisNovo: tsMaisNovoDe([...porBanco.values()].flatMap((b) => b.tss)),
  }
}

export interface MotorAoVivo {
  /** "Motor BB"/"Motor BE" quando o vínculo é certo; o nome cru do path
   *  ("main", "port") quando não é. */
  rotulo: string
  rpm: number | null
  temperaturaC: number | null
  horas: number | null
}

/** port/starboard nos nomes que o Signal K padroniza → a posição da casa. */
const POSICAO_POR_NOME: Record<string, "BB" | "BE"> = { port: "BB", starboard: "BE" }

/**
 * O recorte do hub Motores: rpm, temperatura e horas por motor do path.
 * O vínculo com o cadastro segue a regra 3 do cabeçalho: só quando o nome é
 * port/starboard E existe exatamente um motor naquela posição. Casados vêm
 * primeiro (BB antes de BE — ordem de leitura náutica), soltos depois por
 * nome, pra dois acessos seguidos desenharem o cartão na mesma ordem.
 */
export function motoresAoVivo(
  mapa: MapaTelemetria,
  equipamentosMotores: readonly { posicao: "BB" | "BE" | "central" | null }[],
): { motores: MotorAoVivo[]; tsMaisNovo: string | null } {
  const porNome = new Map<string, { rpm: number | null; temperaturaC: number | null; horas: number | null; tss: string[] }>()
  for (const [path, leitura] of Object.entries(mapa)) {
    const m = PATH_MOTOR.exec(path)
    if (!m) continue
    const bruto = numeroOuNull(leitura.valor)
    if (bruto == null) continue
    const motor = porNome.get(m[1]) ?? { rpm: null, temperaturaC: null, horas: null, tss: [] }
    if (m[2] === "revolutions") motor.rpm = hzParaRpm(bruto)
    else if (m[2] === "temperature") motor.temperaturaC = kelvinParaCelsius(bruto)
    else motor.horas = segundosParaHoras(bruto)
    motor.tss.push(leitura.ts)
    porNome.set(m[1], motor)
  }

  const rotuloDe = (nome: string): { rotulo: string; casado: boolean } => {
    const posicao = POSICAO_POR_NOME[nome.toLowerCase()]
    if (posicao && equipamentosMotores.filter((e) => e.posicao === posicao).length === 1) {
      return { rotulo: `Motor ${posicao}`, casado: true }
    }
    return { rotulo: nome, casado: false }
  }

  const motores = [...porNome.entries()]
    .map(([nome, m]) => {
      const { rotulo, casado } = rotuloDe(nome)
      return { casado, motor: { rotulo, rpm: m.rpm, temperaturaC: m.temperaturaC, horas: m.horas } }
    })
    .sort((a, b) =>
      a.casado !== b.casado
        ? (a.casado ? -1 : 1)
        : a.motor.rotulo.localeCompare(b.motor.rotulo, "pt-BR", { numeric: true }),
    )
    .map((x) => x.motor)
  return {
    motores,
    tsMaisNovo: tsMaisNovoDe([...porNome.values()].flatMap((m) => m.tss)),
  }
}

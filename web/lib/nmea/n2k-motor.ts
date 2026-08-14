import type { QuadroN2K } from "./n2k-quadro"

/**
 * Onda 34 — Commander Connect: decodificação dos campos de motor e
 * combustível das PGNs NMEA 2000 escolhidas pra V1 (rede N2K já existente,
 * sem hardware Commander Connect ainda — ver `docs/prd/commander-connect.txt`):
 *
 *  - 127488 Engine Parameters, Rapid Update — RPM (parâmetro "rápido").
 *  - 127489 Engine Parameters, Dynamic — horas do motor, temperatura,
 *    pressão de óleo, fluxo de combustível (parâmetros "dinâmicos",
 *    1x/segundo).
 *  - 127505 Fluid Level — nível do tanque (combustível, quando `tipo` for
 *    "combustivel"; a PGN é genérica pra qualquer fluido).
 *
 * Campos, offsets, resolução e os valores-sentinela de "dado ausente"
 * pesquisados em canboat (github.com/canboat/canboat, licença MIT — a
 * referência pública de fato pra NMEA 2000, já que a especificação oficial
 * da NMEA é paga/fechada), arquivo `docs/canboat.json`, entradas PGN
 * 127488 (`engineParametersRapidUpdate`), 127489 (`engineParametersDynamic`)
 * e 127505 (`fluidLevel`). Conferido em 14/08/2026.
 *
 * Este arquivo decodifica só os campos que o PRD pede (seção 5: "horas de
 * motor, RPM, temperatura, ..., consumo/fluxo de combustível") — não a PGN
 * inteira. Campos fora do escopo desta onda (boost pressure, tilt/trim,
 * alternator potential, coolant/fuel pressure, discrete status/alarmes,
 * engine load/torque) ficam de fora de propósito, documentados aqui pra
 * quem for estender depois saber onde parou.
 *
 * ## Sentinela "dado ausente" — a fonte clássica de número absurdo na tela
 * Todo campo numérico do N2K reserva os ÚLTIMOS 2 ou 3 valores da faixa
 * BRUTA (antes de aplicar a resolução) pra "reservado" / "fora de faixa" /
 * "não disponível" — nunca 0, que é um valor VÁLIDO (0 rpm é "motor
 * parado", não "sem leitura"; 0 litros/hora é "motor desligado ou parado",
 * não "sem sensor"). Cada campo abaixo devolve `null` nesses casos —
 * NUNCA o número bruto reinterpretado como física (evita o clássico
 * "motor a 6553 graus" quando o sensor não está instalado/conectado).
 */

function lerUintLE(dados: Uint8Array, offset: number, bytes: number): number {
  let valor = 0
  for (let i = bytes - 1; i >= 0; i--) valor = valor * 256 + dados[offset + i]
  return valor
}

function lerIntLE(dados: Uint8Array, offset: number, bytes: number): number {
  const semSinal = lerUintLE(dados, offset, bytes)
  const meio = 2 ** (bytes * 8 - 1)
  return semSinal >= meio ? semSinal - meio * 2 : semSinal
}

/** `limiteValidoRaw` é o maior valor BRUTO ainda considerado dado real —
 *  `RangeMax / Resolution` de cada campo no canboat (ver comentário de
 *  cada função abaixo). Qualquer coisa acima é sentinela (reservado, fora
 *  de faixa, ou "não disponível" propriamente dito) — todas tratadas da
 *  mesma forma aqui: dado ausente, `null`, nunca um número inventado. */
function campoNumerico(raw: number, limiteValidoRaw: number, resolucao: number): number | null {
  return raw > limiteValidoRaw ? null : raw * resolucao
}

// ---------------------------------------------------------------------------
// PGN 127488 — Engine Parameters, Rapid Update (8 bytes, quadro único)
// ---------------------------------------------------------------------------

export const PGN_MOTOR_RAPIDO = 127488

export interface MotorRapido {
  /** Número da instância do motor (0 = motor único, ou um dos motores numa
   *  instalação com mais de um — qual número é qual bordo é convenção da
   *  instalação, este parser só devolve o número). `null` = não informado. */
  instancia: number | null
  /** Rotação do motor, em RPM. `null` = sem leitura. */
  rpm: number | null
}

/** offsets (bytes): instance@0 (1B) · speed@1 (2B, LE, resolução 0,25 rpm,
 *  RangeMax 16383 → limite bruto 65532). */
export function decodificarMotorRapido(quadro: QuadroN2K): MotorRapido | null {
  if (quadro.pgn !== PGN_MOTOR_RAPIDO || quadro.dados.length < 3) return null
  const instanciaRaw = lerUintLE(quadro.dados, 0, 1)
  const rpmRaw = lerUintLE(quadro.dados, 1, 2)
  return {
    instancia: campoNumerico(instanciaRaw, 252, 1),
    rpm: campoNumerico(rpmRaw, 65532, 0.25),
  }
}

// ---------------------------------------------------------------------------
// PGN 127489 — Engine Parameters, Dynamic (26 bytes, fast packet)
// ---------------------------------------------------------------------------

export const PGN_MOTOR_DINAMICO = 127489

export interface MotorDinamico {
  instancia: number | null
  /** Pressão de óleo, em kPa (bruto em Pa no N2K — dividido por 1000 aqui
   *  pra unidade mais legível num painel/alerta). `null` = sem leitura. */
  pressaoOleoKPa: number | null
  /** Temperatura do líquido de arrefecimento, em °C (bruto em Kelvin no
   *  N2K — conversão K − 273,15). `null` = sem leitura. */
  temperaturaC: number | null
  /** Fluxo de combustível, em litros/hora. Campo assinado no N2K (motores
   *  com retorno de combustível medido à parte podem reportar negativo) —
   *  devolvido como veio; quem exibe decide se trunca em 0. `null` = sem
   *  leitura. */
  fluxoCombustivelLh: number | null
  /** Horas totais do motor, em HORAS (bruto em segundos no N2K — dividido
   *  por 3600 aqui: é a mesma unidade de `equipamentos.horas_atuais`, ver
   *  `web/lib/acoes/leituras.ts`). `null` = sem leitura. */
  horasMotor: number | null
}

/** offsets (bytes): instance@0 (1B) · oilPressure@1 (2B, resolução 100 Pa,
 *  RangeMax 6553200 → limite bruto 65532) · [oilTemperature@3, fora do
 *  escopo] · temperature@5 (2B, resolução 0,01 K, RangeMax 655,32 → limite
 *  bruto 65532) · [alternatorPotential@7, fora do escopo] · fuelRate@9
 *  (2B assinado, resolução 0,1 L/h, RangeMax 3276,4 → limite bruto 32764)
 *  · totalEngineHours@11 (4B, resolução 1 s, RangeMax 4294967292 → mesmo
 *  valor é o limite bruto, resolução 1). */
export function decodificarMotorDinamico(quadro: QuadroN2K): MotorDinamico | null {
  if (quadro.pgn !== PGN_MOTOR_DINAMICO || quadro.dados.length < 15) return null

  const instanciaRaw = lerUintLE(quadro.dados, 0, 1)
  const oilPressureRaw = lerUintLE(quadro.dados, 1, 2)
  const temperatureRaw = lerUintLE(quadro.dados, 5, 2)
  const fuelRateRaw = lerIntLE(quadro.dados, 9, 2)
  const horasRaw = lerUintLE(quadro.dados, 11, 4)

  const pressaoPa = campoNumerico(oilPressureRaw, 65532, 100)
  const temperaturaK = campoNumerico(temperatureRaw, 65532, 0.01)
  const horasS = campoNumerico(horasRaw, 4294967292, 1)

  return {
    instancia: campoNumerico(instanciaRaw, 252, 1),
    pressaoOleoKPa: pressaoPa === null ? null : pressaoPa / 1000,
    temperaturaC: temperaturaK === null ? null : temperaturaK - 273.15,
    fluxoCombustivelLh: campoNumerico(fuelRateRaw, 32764, 0.1),
    horasMotor: horasS === null ? null : horasS / 3600,
  }
}

// ---------------------------------------------------------------------------
// PGN 127505 — Fluid Level (8 bytes, quadro único)
// ---------------------------------------------------------------------------

export const PGN_NIVEL_FLUIDO = 127505

/** `LookupEnumeration TANK_TYPE` do canboat — só os valores que existem em
 *  barco de passeio; o restante da faixa (6-13) fica como "desconhecido"
 *  em vez de inventar um rótulo. */
export type TipoFluidoN2K = "combustivel" | "agua" | "porao" | "vivo" | "oleo" | "esgoto" | "desconhecido"

const TIPOS_FLUIDO: Record<number, TipoFluidoN2K> = {
  0: "combustivel",
  1: "agua",
  2: "porao",
  3: "vivo",
  4: "oleo",
  5: "esgoto",
}

export interface NivelFluido {
  instancia: number | null
  tipo: TipoFluidoN2K
  /** Nível do tanque, em % (0-100). `null` = sem leitura. */
  nivelPct: number | null
  /** Capacidade do tanque, em litros. `null` = sem leitura. */
  capacidadeL: number | null
}

/** byte 0: instance nos 4 bits baixos (RangeMax 13, sem sentinela
 *  "reservado" separado — só outOfRange/unknown, limite bruto 13) + type
 *  nos 4 bits altos (mesma faixa). level@1 (2B assinado, resolução 0,004%,
 *  RangeMax 131,056 → limite bruto 32764). capacity@3 (4B, resolução 0,1 L,
 *  RangeMax 429496729,2 → limite bruto 4294967292). */
export function decodificarNivelFluido(quadro: QuadroN2K): NivelFluido | null {
  if (quadro.pgn !== PGN_NIVEL_FLUIDO || quadro.dados.length < 7) return null

  const instanciaRaw = quadro.dados[0] & 0x0f
  const tipoRaw = (quadro.dados[0] >> 4) & 0x0f
  const nivelRaw = lerIntLE(quadro.dados, 1, 2)
  const capacidadeRaw = lerUintLE(quadro.dados, 3, 4)

  return {
    instancia: campoNumerico(instanciaRaw, 13, 1),
    tipo: TIPOS_FLUIDO[tipoRaw] ?? "desconhecido",
    nivelPct: campoNumerico(nivelRaw, 32764, 0.004),
    capacidadeL: campoNumerico(capacidadeRaw, 4294967292, 0.1),
  }
}

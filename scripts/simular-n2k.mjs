#!/usr/bin/env node
/**
 * Simulador de quadros NMEA 2000 sintéticos — onda 34 (Commander Connect).
 *
 * Irmão de `scripts/simular-nmea.mjs` (que simula o gateway WiFi NMEA 0183
 * da sondagem). Aqui não existe hardware Commander Connect nem gateway N2K
 * real pra testar contra (a caixa física ainda não existe — ver
 * `docs/prd/commander-connect.txt`), então este script gera quadros CAN
 * SINTÉTICOS das 3 PGNs decodificadas em `web/lib/nmea/n2k-motor.ts`
 * (127488 RPM, 127489 horas/temperatura/pressão/combustível, 127505 nível
 * de combustível), incluindo a remontagem fast packet real da 127489 —
 * e escreve cada quadro como uma linha JSON em stdout, pra um teste
 * automatizado (`web/lib/nmea/n2k-simulador.test.ts`) consumir de um
 * PROCESSO de verdade (não só objetos montados em memória), mesmo método
 * que provou o parser 0183 antes do hardware existir.
 *
 * Formato de saída (uma linha JSON por quadro CAN, não é nenhum protocolo
 * de gateway real — é só o jeito mais simples de levar {idCan, dados} de
 * um processo pro outro por stdout):
 *   {"idCan":166854661,"dados":[0,160,40,255,255,127,255,255]}
 *
 * Uso (a partir da raiz do repo):
 *   node scripts/simular-n2k.mjs                          # 1 ciclo/seg, indefinido
 *   node scripts/simular-n2k.mjs --quantidade 5            # 5 ciclos e sai
 *   node scripts/simular-n2k.mjs --intervalo 50 --seed 42  # reproduzível
 *   node scripts/simular-n2k.mjs --ausente-a-cada 3        # todo 3º ciclo manda sentinelas "não disponível"
 *
 * Cada "ciclo" emite 6 quadros CAN: 1 de RPM (127488), 4 de fast packet
 * remontando a 127489 (26 bytes = 6 + 3×7 preenchidos, último padded), e 1
 * de nível de combustível (127505).
 *
 * PGNs, offsets, resolução e sentinelas "não disponível": mesma fonte
 * documentada em `web/lib/nmea/n2k-motor.ts` (canboat, docs/canboat.json,
 * PGNs 127488/127489/127505 — conferido em 14/08/2026). REIMPLEMENTADO
 * aqui (não importado de `web/lib/nmea/`) de propósito — mesma razão do
 * `simular-nmea.mjs`: este script roda com `node` puro na raiz do repo,
 * fora da árvore de resolução de módulos de `web/`, e o objetivo é simular
 * o que um GATEWAY EXTERNO manda, sem depender do parser sendo testado.
 */

function lerArgs(argv) {
  const opcoes = {
    intervalo: 1000,
    quantidade: 0, // 0 = sem limite
    seed: null,
    instancia: 0,
    rpmBase: 2600,
    ausenteACada: 0, // 0 = nunca
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const valor = () => argv[++i]
    switch (arg) {
      case "--intervalo":
        opcoes.intervalo = Number(valor())
        break
      case "--quantidade":
        opcoes.quantidade = Number(valor())
        break
      case "--seed":
        opcoes.seed = Number(valor())
        break
      case "--instancia":
        opcoes.instancia = Number(valor())
        break
      case "--rpm-base":
        opcoes.rpmBase = Number(valor())
        break
      case "--ausente-a-cada":
        opcoes.ausenteACada = Number(valor())
        break
      case "--help":
      case "-h":
        opcoes.ajuda = true
        break
      default:
        throw new Error(`Argumento desconhecido: ${arg} (use --help)`)
    }
  }
  return opcoes
}

const AJUDA = `
Simulador de quadros NMEA 2000 sintéticos (onda 34 — Commander Connect).

  node scripts/simular-n2k.mjs [opcoes]

  --intervalo <ms>          default: 1000 (entre ciclos; cada ciclo = 6 quadros)
  --quantidade <n>          default: 0 (sem limite; encerra sozinho após N ciclos)
  --seed <numero>           opcional, reproducibilidade do "ruído"
  --instancia <n>           default: 0 (número da instância do motor)
  --rpm-base <n>            default: 2600 (ponto de partida; varia com seno + ruído)
  --ausente-a-cada <n>      default: 0 (nunca; todo Nº ciclo manda sentinelas "não disponível")
`

// ---------------------------------------------------------------------------
// Codificação de baixo nível — inversa dos leitores de
// web/lib/nmea/n2k-quadro.ts e n2k-motor.ts (reimplementada, ver cabeçalho).
// ---------------------------------------------------------------------------

function bytesUintLE(valorBruto, bytes) {
  let valor = valorBruto
  const out = []
  for (let i = 0; i < bytes; i++) {
    out.push(valor % 256)
    valor = Math.floor(valor / 256)
  }
  return out
}

function bytesIntLE(valor, bytes) {
  const meio = 2 ** (bytes * 8 - 1)
  const semSinal = valor < 0 ? valor + meio * 2 : valor
  return bytesUintLE(semSinal, bytes)
}

/** Identificador CAN de 29 bits — mesma regra J1939/ISO 11783 que
 *  `decodificarIdCan` (web/lib/nmea/n2k-quadro.ts) decompõe; aqui é a
 *  direção inversa (montar, não decompor). As 3 PGNs simuladas são todas
 *  PDU2/broadcast (PDU Format >= 240), então o PDU Specific sempre entra
 *  no PGN como "group extension". */
function idCanDe(prioridade, pgn, origem) {
  const dataPage = (pgn >> 16) & 0x1
  const pduFormat = (pgn >> 8) & 0xff
  const pduSpecific = pgn & 0xff
  return ((prioridade & 0x7) << 26) + (dataPage << 24) + (pduFormat << 16) + (pduSpecific << 8) + (origem & 0xff)
}

/** PRNG simples (mulberry32) — mesma técnica de `simular-nmea.mjs` pra
 *  permitir `--seed` reproduzir a mesma sequência de "ruído" em teste
 *  automatizado. */
function criarGeradorRuido(seed) {
  if (seed == null) return () => Math.random()
  let estado = seed >>> 0
  return function mulberry32() {
    estado |= 0
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ORIGEM_MOTOR = 5 // endereço arbitrário do "motor" simulado na rede N2K

// PGN 127488 — Engine Parameters, Rapid Update: instance@0(1B) · speed@1(2B, resolução 0,25rpm).
function quadroMotorRapido(instancia, rpm) {
  const rpmRaw = rpm == null ? 0xffff : Math.round(rpm / 0.25)
  const dados = [instancia, ...bytesUintLE(rpmRaw, 2), ...bytesUintLE(0xffff, 2), 0x7f, 0xff, 0xff]
  return { idCan: idCanDe(2, 127488, ORIGEM_MOTOR), dados }
}

// PGN 127489 — Engine Parameters, Dynamic (26 bytes) — ver offsets em
// n2k-motor.ts. Devolve os 4 quadros fast packet já fatiados (2 header +
// 6 dado no 1º, 1 header + 7 dado nos seguintes; até 32 quadros no total,
// aqui sempre 4 porque a PGN é fixa em 26 bytes).
function quadrosMotorDinamico(sequencia, instancia, { pressaoOleoKPa, temperaturaC, fluxoCombustivelLh, horasMotor }) {
  const oilPressureRaw = pressaoOleoKPa == null ? 0xffff : Math.round((pressaoOleoKPa * 1000) / 100)
  const temperatureRaw = temperaturaC == null ? 0xffff : Math.round((temperaturaC + 273.15) / 0.01)
  const fuelRateRaw = fluxoCombustivelLh == null ? 32767 : Math.round(fluxoCombustivelLh / 0.1)
  const horasRaw = horasMotor == null ? 0xffffffff : Math.round(horasMotor * 3600)

  const dados26 = [
    instancia,
    ...bytesUintLE(oilPressureRaw, 2),
    ...bytesUintLE(0xffff, 2), // oil temperature — fora do escopo desta onda, sempre "não disponível"
    ...bytesUintLE(temperatureRaw, 2),
    ...bytesUintLE(0x7fff, 2), // alternator potential — fora do escopo, sentinela assinada
    ...bytesIntLE(fuelRateRaw, 2),
    ...bytesUintLE(horasRaw, 4),
    ...bytesUintLE(0xffff, 2), // coolant pressure — fora do escopo
    ...bytesUintLE(0xffff, 2), // fuel pressure — fora do escopo
    0xff, // reserved
    ...bytesUintLE(0, 2), // discrete status 1 — sem alarme
    ...bytesUintLE(0, 2), // discrete status 2 — sem alarme
    0x7f, // engine load — fora do escopo
    0x7f, // engine torque — fora do escopo
  ]

  const idCan = idCanDe(2, 127489, ORIGEM_MOTOR)
  const quadros = []
  quadros.push({ idCan, dados: [(sequencia << 5) | 0, dados26.length, ...dados26.slice(0, 6)] })
  let restante = dados26.slice(6)
  let contador = 1
  while (restante.length > 0) {
    const pedaco = restante.slice(0, 7)
    restante = restante.slice(7)
    // Último quadro real de gateway costuma preencher o que sobra do
    // frame CAN (8 bytes) com padding — testa que quem remonta TRUNCA no
    // total anunciado em vez de ler o padding como dado.
    const comPadding = pedaco.length < 7 ? [...pedaco, ...Array(7 - pedaco.length).fill(0xff)] : pedaco
    quadros.push({ idCan, dados: [(sequencia << 5) | contador, ...comPadding] })
    contador++
  }
  return quadros
}

// PGN 127505 — Fluid Level: byte0 = instance(4 bits baixos) + type(4 bits
// altos, 0=combustível) · level@1(2B assinado, resolução 0,004%) ·
// capacity@3(4B, resolução 0,1L).
function quadroNivelCombustivel(instancia, nivelPct, capacidadeL) {
  const byte0 = (instancia & 0x0f) | (0 << 4) // type=0 (combustível)
  const nivelRaw = nivelPct == null ? 32767 : Math.round(nivelPct / 0.004)
  const capacidadeRaw = capacidadeL == null ? 0xffffffff : Math.round(capacidadeL / 0.1)
  const dados = [byte0, ...bytesIntLE(nivelRaw, 2), ...bytesUintLE(capacidadeRaw, 4), 0xff]
  return { idCan: idCanDe(6, 127505, ORIGEM_MOTOR), dados }
}

// ---------------------------------------------------------------------------
// Loop principal — cada ciclo varia RPM/temperatura/combustível com seno +
// ruído (mesmo espírito de `criarProximaSentenca` em simular-nmea.mjs) e
// avança horas do motor monotonicamente (nunca anda pra trás — é a mesma
// regra de `devePropagarLeitura`, web/lib/domain/leituras.ts).
// ---------------------------------------------------------------------------

function main() {
  const opcoes = lerArgs(process.argv.slice(2))
  if (opcoes.ajuda) {
    console.log(AJUDA)
    return
  }

  const ruido = criarGeradorRuido(opcoes.seed)
  let horasAcumuladas = 1200 // ponto de partida plausível pra um motor de lancha usada
  let sequenciaFastPacket = 0
  let tick = 0
  let ciclosEmitidos = 0
  let timer = null

  function emitirCiclo() {
    const ausente = opcoes.ausenteACada > 0 && (tick + 1) % opcoes.ausenteACada === 0

    const rpm = ausente ? null : Math.max(0, opcoes.rpmBase + Math.sin(tick / 8) * 200 + (ruido() - 0.5) * 60)
    const temperaturaC = ausente ? null : 78 + Math.sin(tick / 12) * 4 + (ruido() - 0.5) * 1.5
    const pressaoOleoKPa = ausente ? null : 320 + (ruido() - 0.5) * 20
    const fluxoCombustivelLh = ausente ? null : 14 + Math.sin(tick / 10) * 3 + (ruido() - 0.5)
    horasAcumuladas += opcoes.intervalo / 3_600_000 // avança "de verdade" com o tempo simulado, nunca regride
    const horasMotor = ausente ? null : horasAcumuladas
    const nivelPct = ausente ? null : Math.max(0, 62 - tick * 0.05)

    const quadros = [
      quadroMotorRapido(opcoes.instancia, rpm),
      ...quadrosMotorDinamico(sequenciaFastPacket, opcoes.instancia, { pressaoOleoKPa, temperaturaC, fluxoCombustivelLh, horasMotor }),
      quadroNivelCombustivel(opcoes.instancia, nivelPct, 200),
    ]
    sequenciaFastPacket = (sequenciaFastPacket + 1) % 8
    tick++

    for (const q of quadros) console.log(JSON.stringify(q))

    ciclosEmitidos++
    if (opcoes.quantidade > 0 && ciclosEmitidos >= opcoes.quantidade) {
      if (timer) clearInterval(timer)
      process.exit(0)
    }
  }

  emitirCiclo()
  if (opcoes.quantidade !== 1) timer = setInterval(emitirCiclo, opcoes.intervalo)

  process.on("SIGINT", () => {
    clearInterval(timer)
    process.exit(0)
  })
}

main()

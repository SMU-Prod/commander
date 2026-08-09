#!/usr/bin/env node
/**
 * Simulador de gateway WiFi NMEA 0183 — onda 14 (app nativo Capacitor).
 *
 * Sem barco de verdade pra testar o plugin nativo `NmeaSocket`
 * (android/.../nmea/, ios/App/App/NmeaSocket/), este script finge ser o
 * gateway: manda sentencas DPT/DBT de profundidade, com checksum valido,
 * por TCP (servidor — o app conecta nele) ou UDP (broadcast/unicast — o
 * app so escuta), na mesma porta/formato que um gateway de verdade usaria
 * (ver PORTA_PADRAO em web/lib/nmea/nmea-socket-plugin.ts e o comentario
 * de pesquisa em android/.../nmea/NmeaSocketWorker.java).
 *
 * Uso (a partir da raiz do repo):
 *   node scripts/simular-nmea.mjs                       # UDP, porta 10110, indefinido
 *   node scripts/simular-nmea.mjs --modo tcp             # TCP, porta 10110
 *   node scripts/simular-nmea.mjs --modo udp --destino 192.168.15.255  # broadcast de verdade na LAN
 *   node scripts/simular-nmea.mjs --quantidade 20 --intervalo 200      # sai sozinho depois de 20 sentencas
 *   npm run simular-nmea --prefix web -- --modo tcp      # via script do web/package.json
 *
 * `--porta 0` pede uma porta efemera ao SO (usado pelo teste automatizado
 * `web/lib/nmea/simulador-nmea.test.ts`, que precisa de uma porta livre
 * sem colidir com outra execucao em paralelo) — a porta de fato escolhida
 * sai na primeira linha de stdout, formato `PORTA=<numero>`.
 *
 * Ver "Testar o socket NMEA sem barco" em docs/APP-NATIVO.md.
 */

import net from "node:net"
import dgram from "node:dgram"

function lerArgs(argv) {
  const opcoes = {
    modo: "udp",
    porta: 10110,
    destino: "255.255.255.255",
    intervalo: 1000,
    quantidade: 0, // 0 = sem limite
    profundidadeBase: 12.5,
    sentenca: "alternando", // "DPT" | "DBT" | "alternando"
    seed: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const valor = () => argv[++i]
    switch (arg) {
      case "--modo":
        opcoes.modo = valor()
        break
      case "--porta":
        opcoes.porta = Number(valor())
        break
      case "--destino":
        opcoes.destino = valor()
        break
      case "--intervalo":
        opcoes.intervalo = Number(valor())
        break
      case "--quantidade":
        opcoes.quantidade = Number(valor())
        break
      case "--profundidade":
        opcoes.profundidadeBase = Number(valor())
        break
      case "--sentenca":
        opcoes.sentenca = valor()
        break
      case "--seed":
        opcoes.seed = Number(valor())
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
Simulador de gateway WiFi NMEA 0183 (onda 14).

  node scripts/simular-nmea.mjs [opcoes]

  --modo <tcp|udp>        default: udp
  --porta <numero>        default: 10110 (0 = porta efemera, ver stdout "PORTA=")
  --destino <host>        default: 255.255.255.255 (so udp; broadcast de verdade
                           so funciona numa LAN real — em localhost use 127.0.0.1)
  --intervalo <ms>        default: 1000
  --quantidade <n>        default: 0 (sem limite; encerra sozinho apos N sentencas)
  --profundidade <m>      default: 12.5 (ponto de partida; varia com seno + ruido)
  --sentenca <DPT|DBT|alternando>  default: alternando
  --seed <numero>         opcional, reproducibilidade do "ruido" de profundidade
`

// ---------------------------------------------------------------------------
// Sentencas NMEA 0183 — mesmo formato/checksum que
// web/lib/domain/sondagem.ts (parseDPT/parseDBT/validarChecksum) espera.
// Reimplementado aqui (nao importado) de proposito: este script roda com
// `node` puro na RAIZ do repo, fora da arvore de resolucao de modulos de
// `web/` (mesma razao documentada em scripts/gerar-mascara-agua.mjs pro
// pngjs) — e MAIS ainda, o ponto e simular o que um gateway EXTERNO
// manda, sem depender do parser que esta sendo testado.
// ---------------------------------------------------------------------------

function checksumNmea(corpo) {
  let calc = 0
  for (let i = 0; i < corpo.length; i++) calc ^= corpo.charCodeAt(i)
  return calc.toString(16).toUpperCase().padStart(2, "0")
}

function sentenca(corpo) {
  return `$${corpo}*${checksumNmea(corpo)}`
}

/** $SDDPT,profundidade,offset*hh — offset 0 (sem info de quilha/linha
 *  d'agua configurada, caso comum). */
function sentencaDPT(profundidadeM) {
  return sentenca(`SDDPT,${profundidadeM.toFixed(1)},0.0`)
}

/** $SDDBT,pes,f,metros,M,bracas,F*hh */
function sentencaDBT(profundidadeM) {
  const pes = profundidadeM / 0.3048
  const bracas = profundidadeM / 1.8288
  return sentenca(`SDDBT,${pes.toFixed(1)},f,${profundidadeM.toFixed(1)},M,${bracas.toFixed(1)},F`)
}

/** PRNG simples (mulberry32) so pra permitir `--seed` reproduzir a mesma
 *  sequencia de "ruido" em teste automatizado — Math.random() normal
 *  quando `seed` e null. */
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

function criarProximaSentenca(opcoes) {
  const ruido = criarGeradorRuido(opcoes.seed)
  let tick = 0
  return function proxima() {
    const onda = Math.sin(tick / 10) * 3
    const jitter = (ruido() - 0.5) * 0.4
    const profundidadeM = Math.max(0.3, opcoes.profundidadeBase + onda + jitter)
    tick++

    const tipo = opcoes.sentenca === "alternando" ? (tick % 2 === 0 ? "DPT" : "DBT") : opcoes.sentenca
    return tipo === "DBT" ? sentencaDBT(profundidadeM) : sentencaDPT(profundidadeM)
  }
}

// ---------------------------------------------------------------------------
// Modo TCP — servidor: o app (ou o cliente de teste) conecta como cliente,
// igual a um gateway NMEA real em modo servidor TCP.
// ---------------------------------------------------------------------------

function rodarTcp(opcoes) {
  const proximaSentenca = criarProximaSentenca(opcoes)
  const servidor = net.createServer((socket) => {
    console.error(`[simular-nmea] cliente TCP conectado: ${socket.remoteAddress}:${socket.remotePort}`)
    let enviadas = 0
    const timer = setInterval(() => {
      const linha = proximaSentenca()
      socket.write(linha + "\r\n")
      enviadas++
      if (opcoes.quantidade > 0 && enviadas >= opcoes.quantidade) {
        clearInterval(timer)
        setTimeout(() => socket.end(), 50)
      }
    }, opcoes.intervalo)
    socket.on("close", () => clearInterval(timer))
    socket.on("error", () => clearInterval(timer))
  })

  servidor.listen(opcoes.porta, () => {
    const portaReal = servidor.address().port
    console.log(`PORTA=${portaReal}`)
    console.error(`[simular-nmea] TCP escutando na porta ${portaReal} — aguardando conexao...`)
  })

  return () => servidor.close()
}

// ---------------------------------------------------------------------------
// Modo UDP — broadcast/unicast: o app (ou o cliente de teste) so escuta a
// porta, igual ao listener nativo (NmeaSocketWorker#loopUdp/iniciarUdp).
// ---------------------------------------------------------------------------

/** Acha uma porta UDP livre no SO: abre um socket em `--porta 0`, le a
 *  porta que o SO escolheu, fecha na hora. Corrida pequena (a porta pode
 *  em teoria ser tomada por outra coisa entre o close e o bind de quem
 *  vai escutar de verdade) — mesmo padrao usado por ferramentas de teste
 *  em geral pra "achar uma porta livre"; aqui o teste automatizado
 *  (web/lib/nmea/simulador-nmea.test.ts) faz o bind do lado dele logo em
 *  seguida, janela minima. */
function acharPortaLivreUdp() {
  return new Promise((resolve, reject) => {
    const sondagem = dgram.createSocket("udp4")
    sondagem.on("error", reject)
    sondagem.bind(0, () => {
      const porta = sondagem.address().port
      sondagem.close(() => resolve(porta))
    })
  })
}

async function rodarUdp(opcoes) {
  const proximaSentenca = criarProximaSentenca(opcoes)

  // Em UDP nao ha negociacao cliente/servidor: o emissor NAO precisa
  // (nem deve) ocupar a porta de destino — um gateway de verdade manda
  // de uma porta qualquer do lado dele pra porta FIXA que os listeners
  // conhecem de antemao (ver PORTA_PADRAO_NMEA). `--porta 0` so serve
  // pra escolher essa porta de destino automaticamente em teste
  // automatizado (evita colisao entre execucoes em paralelo); o proprio
  // socket de envio deste script fica na porta efemera que o Node
  // escolher sozinho no primeiro `send` (sem bind explicito).
  if (opcoes.porta === 0) {
    opcoes.porta = await acharPortaLivreUdp()
  }
  console.log(`PORTA=${opcoes.porta}`)
  console.error(`[simular-nmea] UDP enviando pra ${opcoes.destino}:${opcoes.porta} a cada ${opcoes.intervalo}ms...`)

  const socket = dgram.createSocket("udp4")
  let enviadas = 0
  let broadcastLigado = false

  socket.on("error", (erro) => {
    console.error(`[simular-nmea] erro UDP: ${erro.message}`)
  })

  const timer = setInterval(() => {
    const linha = proximaSentenca()
    const buffer = Buffer.from(linha + "\r\n", "ascii")
    socket.send(buffer, opcoes.porta, opcoes.destino, (erro) => {
      // `setBroadcast` so pode ser chamado DEPOIS que o socket tem uma
      // porta local (o Node so bind implicito no primeiro `send`) — por
      // isso fica aqui, uma vez, em vez de antes do loop.
      if (!broadcastLigado) {
        broadcastLigado = true
        try {
          socket.setBroadcast(true)
        } catch {
          // Destino unicast (ex.: 127.0.0.1 em teste automatizado) nao
          // precisa de SO_BROADCAST — inofensivo tentar mesmo assim.
        }
      }
      if (erro) console.error(`[simular-nmea] falha ao enviar: ${erro.message}`)
    })
    enviadas++
    if (opcoes.quantidade > 0 && enviadas >= opcoes.quantidade) {
      clearInterval(timer)
      setTimeout(() => socket.close(), 50)
    }
  }, opcoes.intervalo)

  return () => {
    if (timer) clearInterval(timer)
    socket.close()
  }
}

async function main() {
  const opcoes = lerArgs(process.argv.slice(2))
  if (opcoes.ajuda) {
    console.log(AJUDA)
    return
  }
  if (opcoes.modo !== "tcp" && opcoes.modo !== "udp") {
    throw new Error(`--modo precisa ser "tcp" ou "udp", recebi "${opcoes.modo}"`)
  }

  const parar = opcoes.modo === "tcp" ? rodarTcp(opcoes) : await rodarUdp(opcoes)

  process.on("SIGINT", () => {
    parar()
    process.exit(0)
  })
}

main().catch((erro) => {
  console.error(`[simular-nmea] ${erro.message}`)
  process.exit(1)
})

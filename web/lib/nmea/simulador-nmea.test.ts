import { afterEach, describe, expect, it } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import net from "node:net"
import dgram from "node:dgram"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseSentencaProfundidade, validarChecksum } from "@/lib/domain/sondagem"

/**
 * Onda 14 — prova de verdade que `scripts/simular-nmea.mjs` (o simulador
 * de gateway WiFi NMEA 0183 pedido pra testar o app nativo sem barco)
 * produz sentencas que o parser de dominio (`parseSentencaProfundidade`,
 * `web/lib/domain/sondagem.ts`) decodifica corretamente — por TCP E por
 * UDP, os dois modos que o plugin nativo `NmeaSocket`
 * (android/.../nmea/, ios/App/App/NmeaSocket/) implementa.
 *
 * O que este teste NAO cobre (fora do alcance de rodar em Node puro):
 * o plugin Capacitor de verdade (Java/Kotlin/Swift) — sem Android
 * SDK/Xcode nesta maquina, ver docs/APP-NATIVO.md. Este teste valida a
 * metade que DA pra verificar de verdade sem esse toolchain: o formato
 * de sentenca que o simulador manda e exatamente o que o parser espera,
 * sobrevivendo a uma transmissao real por socket (nao so uma string
 * montada em memoria).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAMINHO_SIMULADOR = path.resolve(__dirname, "../../../scripts/simular-nmea.mjs")
const QUANTIDADE = 12
const TIMEOUT_MS = 15_000

let processoAtual: ChildProcess | null = null

afterEach(() => {
  processoAtual?.kill()
  processoAtual = null
})

function spawnSimulador(args: string[]): Promise<{ porta: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CAMINHO_SIMULADOR, ...args])
    processoAtual = proc
    let resolvido = false
    const timeout = setTimeout(() => {
      if (!resolvido) reject(new Error("timeout esperando o simulador anunciar a porta (stdout 'PORTA=')"))
    }, TIMEOUT_MS)
    proc.stdout?.on("data", (chunk: Buffer) => {
      if (resolvido) return
      const m = /PORTA=(\d+)/.exec(chunk.toString("utf8"))
      if (m) {
        resolvido = true
        clearTimeout(timeout)
        resolve({ porta: Number(m[1]) })
      }
    })
    proc.on("error", reject)
  })
}

function separarLinhas(buffer: string): { linhas: string[]; resto: string } {
  const linhas = buffer.split(/\r\n|\n/)
  const resto = linhas.pop() ?? ""
  return { linhas: linhas.filter((l) => l.length > 0), resto }
}

async function coletarViaTcp(porta: number, quantidade: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const linhas: string[] = []
    let buffer = ""
    const socket = net.createConnection({ port: porta, host: "127.0.0.1" })
    const timeout = setTimeout(() => reject(new Error("timeout coletando via TCP")), TIMEOUT_MS)
    socket.on("data", (dados) => {
      buffer += dados.toString("ascii")
      const { linhas: novas, resto } = separarLinhas(buffer)
      buffer = resto
      linhas.push(...novas)
      if (linhas.length >= quantidade) {
        clearTimeout(timeout)
        socket.end()
        resolve(linhas.slice(0, quantidade))
      }
    })
    socket.on("error", reject)
  })
}

async function coletarViaUdp(porta: number, quantidade: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const linhas: string[] = []
    const receptor = dgram.createSocket("udp4")
    const timeout = setTimeout(() => reject(new Error("timeout coletando via UDP")), TIMEOUT_MS)
    receptor.on("message", (msg) => {
      const { linhas: novas } = separarLinhas(msg.toString("ascii") + "\n")
      linhas.push(...novas)
      if (linhas.length >= quantidade) {
        clearTimeout(timeout)
        receptor.close()
        resolve(linhas.slice(0, quantidade))
      }
    })
    receptor.on("error", reject)
    receptor.bind(porta)
  })
}

describe("simular-nmea.mjs (onda 14 — app nativo)", () => {
  it(
    "TCP: sentencas chegam com checksum valido e o parser de dominio decodifica profundidade plausivel",
    async () => {
      const { porta } = await spawnSimulador([
        "--modo",
        "tcp",
        "--porta",
        "0",
        "--intervalo",
        "20",
        "--quantidade",
        String(QUANTIDADE),
        "--profundidade",
        "12.5",
      ])
      const linhas = await coletarViaTcp(porta, QUANTIDADE)

      expect(linhas).toHaveLength(QUANTIDADE)
      const fontes = new Set<string>()
      for (const linha of linhas) {
        expect(validarChecksum(linha)).toBe(true)
        const leitura = parseSentencaProfundidade(linha)
        expect(leitura).not.toBeNull()
        expect(leitura!.profundidadeM).toBeGreaterThan(0)
        expect(leitura!.profundidadeM).toBeLessThan(25)
        fontes.add(leitura!.fonte)
      }
      // "--sentenca alternando" (default): confirma que DPT e DBT
      // aparecem os dois, nao so um tipo por acidente de implementacao.
      expect(fontes).toEqual(new Set(["DPT", "DBT"]))
    },
    TIMEOUT_MS + 5_000,
  )

  it(
    "UDP: mesma garantia, agora contra datagramas de verdade (nao TCP com framing de stream)",
    async () => {
      const { porta } = await spawnSimulador([
        "--modo",
        "udp",
        "--porta",
        "0",
        "--destino",
        "127.0.0.1",
        "--intervalo",
        "20",
        "--quantidade",
        String(QUANTIDADE),
        "--profundidade",
        "8",
      ])
      const linhas = await coletarViaUdp(porta, QUANTIDADE)

      expect(linhas).toHaveLength(QUANTIDADE)
      for (const linha of linhas) {
        expect(validarChecksum(linha)).toBe(true)
        const leitura = parseSentencaProfundidade(linha)
        expect(leitura).not.toBeNull()
        expect(leitura!.profundidadeM).toBeGreaterThan(0)
        expect(leitura!.profundidadeM).toBeLessThan(20)
      }
    },
    TIMEOUT_MS + 5_000,
  )

  it("sentenca com checksum corrompido de proposito e rejeitada (garante que os testes acima nao passariam por acidente)", () => {
    const boa = "$SDDPT,12.5,0.0*61" // checksum de verdade do corpo "SDDPT,12.5,0.0"
    expect(validarChecksum(boa)).toBe(true)
    expect(parseSentencaProfundidade(boa)).toEqual({ profundidadeM: 12.5, fonte: "DPT" })

    const corrompida = boa.slice(0, -2) + "00"
    expect(validarChecksum(corrompida)).toBe(false)
    expect(parseSentencaProfundidade(corrompida)).toBeNull()
  })
})

import { afterEach, describe, expect, it } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import readline from "node:readline"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { criarMontadorFastPacket, type QuadroCan } from "./n2k-quadro"
import { decodificarMotorDinamico, decodificarMotorRapido, decodificarNivelFluido, PGN_MOTOR_DINAMICO, PGN_MOTOR_RAPIDO, PGN_NIVEL_FLUIDO } from "./n2k-motor"

/**
 * Onda 34 — prova de verdade que `scripts/simular-n2k.mjs` (o simulador de
 * quadros NMEA 2000 sintéticos, pedido pra testar o parser sem hardware
 * Commander Connect nem barco com rede N2K disponível) produz quadros que
 * a camada de dominio (`n2k-quadro.ts` + `n2k-motor.ts`) remonta e
 * decodifica corretamente — consumindo a saída de um PROCESSO de verdade
 * via stdout, não objetos criados em memória (mesmo método documentado em
 * `simulador-nmea.test.ts` pro 0183, que provou o parser antes do
 * aparelho real existir).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAMINHO_SIMULADOR = path.resolve(__dirname, "../../../scripts/simular-n2k.mjs")
const TIMEOUT_MS = 15_000

let processoAtual: ChildProcess | null = null

afterEach(() => {
  processoAtual?.kill()
  processoAtual = null
})

/** Spawna o simulador e devolve todos os quadros CAN (uma linha JSON por
 *  quadro) até o processo terminar sozinho (`--quantidade` finito). */
function coletarQuadros(args: string[]): Promise<QuadroCan[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CAMINHO_SIMULADOR, ...args])
    processoAtual = proc
    const quadros: QuadroCan[] = []
    const timeout = setTimeout(() => reject(new Error("timeout esperando o simulador terminar")), TIMEOUT_MS)

    const rl = readline.createInterface({ input: proc.stdout! })
    rl.on("line", (linha) => {
      if (!linha.trim()) return
      quadros.push(JSON.parse(linha) as QuadroCan)
    })
    proc.on("close", (codigo) => {
      clearTimeout(timeout)
      if (codigo === 0) resolve(quadros)
      else reject(new Error(`simulador saiu com código ${codigo}`))
    })
    proc.on("error", reject)
  })
}

describe("simular-n2k.mjs (onda 34 — Commander Connect)", () => {
  it(
    "3 ciclos: os quadros remontados/decodificados batem com física plausível de motor de lancha",
    async () => {
      const quadros = await coletarQuadros(["--quantidade", "3", "--intervalo", "10", "--seed", "42"])
      expect(quadros).toHaveLength(3 * 6) // 1 (rápido) + 4 (fast packet dinâmico) + 1 (nível) por ciclo

      const montador = criarMontadorFastPacket()
      const rapidos: ReturnType<typeof decodificarMotorRapido>[] = []
      const dinamicos: ReturnType<typeof decodificarMotorDinamico>[] = []
      const niveis: ReturnType<typeof decodificarNivelFluido>[] = []

      for (const quadro of quadros) {
        const remontado = montador.processar(quadro)
        if (!remontado) continue
        if (remontado.pgn === PGN_MOTOR_RAPIDO) rapidos.push(decodificarMotorRapido(remontado))
        else if (remontado.pgn === PGN_MOTOR_DINAMICO) dinamicos.push(decodificarMotorDinamico(remontado))
        else if (remontado.pgn === PGN_NIVEL_FLUIDO) niveis.push(decodificarNivelFluido(remontado))
      }

      expect(rapidos).toHaveLength(3)
      expect(dinamicos).toHaveLength(3) // prova que os 4 quadros fast packet por ciclo remontaram em 1 mensagem cada
      expect(niveis).toHaveLength(3)

      for (const r of rapidos) {
        expect(r!.rpm).not.toBeNull()
        expect(r!.rpm!).toBeGreaterThan(1000)
        expect(r!.rpm!).toBeLessThan(4000)
      }
      for (const d of dinamicos) {
        expect(d!.temperaturaC).not.toBeNull()
        expect(d!.temperaturaC!).toBeGreaterThan(50)
        expect(d!.temperaturaC!).toBeLessThan(110)
        expect(d!.pressaoOleoKPa).not.toBeNull()
        expect(d!.horasMotor).not.toBeNull()
      }
      // Horas do motor nunca regride entre ciclos — mesma regra de
      // devePropagarLeitura (web/lib/domain/leituras.ts) que consome este
      // dado no Diário.
      for (let i = 1; i < dinamicos.length; i++) {
        expect(dinamicos[i]!.horasMotor!).toBeGreaterThanOrEqual(dinamicos[i - 1]!.horasMotor!)
      }
      for (const n of niveis) {
        expect(n!.tipo).toBe("combustivel")
        expect(n!.nivelPct).not.toBeNull()
        expect(n!.capacidadeL).toBe(200)
      }
    },
    TIMEOUT_MS + 5_000,
  )

  it(
    "--ausente-a-cada 2: o segundo ciclo manda sentinelas 'não disponível' e o parser devolve null, nunca um número absurdo",
    async () => {
      const quadros = await coletarQuadros(["--quantidade", "3", "--intervalo", "10", "--seed", "7", "--ausente-a-cada", "2"])

      const montador = criarMontadorFastPacket()
      const rapidos: ReturnType<typeof decodificarMotorRapido>[] = []
      const dinamicos: ReturnType<typeof decodificarMotorDinamico>[] = []

      for (const quadro of quadros) {
        const remontado = montador.processar(quadro)
        if (!remontado) continue
        if (remontado.pgn === PGN_MOTOR_RAPIDO) rapidos.push(decodificarMotorRapido(remontado))
        else if (remontado.pgn === PGN_MOTOR_DINAMICO) dinamicos.push(decodificarMotorDinamico(remontado))
      }

      // Ciclo 2 (índice 1) é o "ausente" — nenhum campo pode vazar um raw
      // reinterpretado como física.
      expect(rapidos[1]!.rpm).toBeNull()
      expect(dinamicos[1]!.temperaturaC).toBeNull()
      expect(dinamicos[1]!.pressaoOleoKPa).toBeNull()
      expect(dinamicos[1]!.horasMotor).toBeNull()

      // Ciclos 1 e 3 (com dado) continuam plausíveis.
      expect(rapidos[0]!.rpm).not.toBeNull()
      expect(rapidos[2]!.rpm).not.toBeNull()
      expect(dinamicos[0]!.horasMotor).not.toBeNull()
      expect(dinamicos[2]!.horasMotor).not.toBeNull()
    },
    TIMEOUT_MS + 5_000,
  )
})

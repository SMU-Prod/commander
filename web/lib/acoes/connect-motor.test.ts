import { afterEach, describe, expect, it } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import readline from "node:readline"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sincronizarHorasMotorConnect } from "./connect-motor"
import { criarMontadorFastPacket, type QuadroCan } from "@/lib/nmea/n2k-quadro"
import { decodificarMotorDinamico, PGN_MOTOR_DINAMICO } from "@/lib/nmea/n2k-motor"

/**
 * Onda 34 — prova que `sincronizarHorasMotorConnect` decide e grava certo,
 * SEM criar um segundo caminho de escrita: o stub abaixo só confirma que
 * a MESMA chamada que `atualizarLeituraEquipamento` (`web/lib/acoes/leituras.ts`)
 * já faz é a que sai daqui — `update equipamentos ... eq(id) ... select(id)`.
 */

interface ChamadaRegistrada {
  tabela?: string
  update?: Record<string, unknown>
  eqColuna?: string
  eqValor?: unknown
}

function supabaseFake(resultado: { data: unknown; error: unknown }): { cliente: SupabaseClient; chamada: ChamadaRegistrada } {
  const chamada: ChamadaRegistrada = {}
  const cliente = {
    from(tabela: string) {
      chamada.tabela = tabela
      return {
        update(valores: Record<string, unknown>) {
          chamada.update = valores
          return {
            eq(coluna: string, valor: unknown) {
              chamada.eqColuna = coluna
              chamada.eqValor = valor
              return {
                select() {
                  return Promise.resolve(resultado)
                },
              }
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient
  return { cliente, chamada }
}

describe("sincronizarHorasMotorConnect", () => {
  it("sem horas decodificadas (sensor ausente): não propaga, nunca chama o banco", async () => {
    const { cliente, chamada } = supabaseFake({ data: [{ id: "eq1" }], error: null })
    const resultado = await sincronizarHorasMotorConnect(cliente, "eq1", 500, { horasMotor: null })
    expect(resultado).toEqual({ status: "sem_dado" })
    expect(chamada.tabela).toBeUndefined()
  })

  it("leitura menor que a atual (regressão): não propaga — horímetro não anda pra trás", async () => {
    const { cliente, chamada } = supabaseFake({ data: [{ id: "eq1" }], error: null })
    const resultado = await sincronizarHorasMotorConnect(cliente, "eq1", 900, { horasMotor: 850 })
    expect(resultado).toEqual({ status: "nao_avancou" })
    expect(chamada.tabela).toBeUndefined()
  })

  it("leitura avançou: propaga pela MESMA escrita de equipamentos.horas_atuais que 'Voltei ao mar'/Diário usam", async () => {
    const { cliente, chamada } = supabaseFake({ data: [{ id: "eq1" }], error: null })
    const resultado = await sincronizarHorasMotorConnect(cliente, "eq1", 1200, { horasMotor: 1234.5 })
    expect(resultado).toEqual({ status: "propagou", horas: 1234.5 })
    expect(chamada.tabela).toBe("equipamentos")
    expect(chamada.update?.horas_atuais).toBe(1234.5)
    expect(chamada.eqColuna).toBe("id")
    expect(chamada.eqValor).toBe("eq1")
  })

  it("equipamento sem leitura anterior (null): primeira leitura sempre propaga", async () => {
    const { cliente } = supabaseFake({ data: [{ id: "eq1" }], error: null })
    const resultado = await sincronizarHorasMotorConnect(cliente, "eq1", null, { horasMotor: 42 })
    expect(resultado).toEqual({ status: "propagou", horas: 42 })
  })

  it("erro do banco (RLS negou, rede caiu) devolve status de erro, não lança", async () => {
    const { cliente } = supabaseFake({ data: null, error: { message: "falhou" } })
    const resultado = await sincronizarHorasMotorConnect(cliente, "eq1", 100, { horasMotor: 200 })
    expect(resultado.status).toBe("erro")
  })
})

// ---------------------------------------------------------------------------
// Ponta a ponta com o simulador de verdade: simular-n2k.mjs → montador de
// fast packet → decodificarMotorDinamico → sincronizarHorasMotorConnect.
// Prova que as horas que SAEM do decoder N2K são as MESMAS que ENTRAM na
// escrita do Diário, sem transformação escondida no meio.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CAMINHO_SIMULADOR = path.resolve(__dirname, "../../../scripts/simular-n2k.mjs")
const TIMEOUT_MS = 15_000

let processoAtual: ChildProcess | null = null
afterEach(() => {
  processoAtual?.kill()
  processoAtual = null
})

function coletarQuadros(args: string[]): Promise<QuadroCan[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CAMINHO_SIMULADOR, ...args])
    processoAtual = proc
    const quadros: QuadroCan[] = []
    const timeout = setTimeout(() => reject(new Error("timeout esperando o simulador terminar")), TIMEOUT_MS)
    const rl = readline.createInterface({ input: proc.stdout! })
    rl.on("line", (linha) => {
      if (linha.trim()) quadros.push(JSON.parse(linha) as QuadroCan)
    })
    proc.on("close", (codigo) => {
      clearTimeout(timeout)
      if (codigo === 0) resolve(quadros)
      else reject(new Error(`simulador saiu com código ${codigo}`))
    })
    proc.on("error", reject)
  })
}

describe("Connect → Diário, ponta a ponta com o simulador N2K", () => {
  it(
    "horas decodificadas de um quadro do simulador propagam pra equipamentos.horas_atuais",
    async () => {
      const quadros = await coletarQuadros(["--quantidade", "1", "--seed", "9"])
      const montador = criarMontadorFastPacket()
      const dinamico = quadros.map((q) => montador.processar(q)).find((q) => q?.pgn === PGN_MOTOR_DINAMICO)
      expect(dinamico).toBeDefined()

      const motor = decodificarMotorDinamico(dinamico!)
      expect(motor!.horasMotor).not.toBeNull()

      const { cliente, chamada } = supabaseFake({ data: [{ id: "eq-motor-bb" }], error: null })
      const resultado = await sincronizarHorasMotorConnect(cliente, "eq-motor-bb", 0, motor!)

      expect(resultado).toEqual({ status: "propagou", horas: motor!.horasMotor })
      expect(chamada.update?.horas_atuais).toBe(motor!.horasMotor)
    },
    TIMEOUT_MS + 5_000,
  )
})

import { describe, expect, it } from "vitest"
import {
  decodificarMotorDinamico,
  decodificarMotorRapido,
  decodificarNivelFluido,
  PGN_MOTOR_DINAMICO,
  PGN_MOTOR_RAPIDO,
  PGN_NIVEL_FLUIDO,
} from "./n2k-motor"
import type { QuadroN2K } from "./n2k-quadro"

/** Quadros sintéticos montados campo a campo a partir da especificação
 *  pesquisada no canboat (ver cabeçalho de `n2k-motor.ts`) — não vêm de
 *  nenhuma captura real (não há caixa Commander Connect nem barco com N2K
 *  disponível pra esta onda), mas os offsets/resolução/sentinelas são os
 *  documentados pra cada PGN. O teste de ponta a ponta com o simulador
 *  (`n2k-simulador.test.ts`) prova a mesma decodificação a partir de um
 *  fluxo de quadros gerado por um processo externo, não só objetos criados
 *  em memória. */

function quadro(pgn: number, dados: number[]): QuadroN2K {
  return { prioridade: 2, pgn, origem: 5, dados: Uint8Array.from(dados) }
}

describe("decodificarMotorRapido (PGN 127488)", () => {
  it("decodifica instância e RPM de um quadro válido", () => {
    // instance=0, rpm bruto=10400 (10400*0,25=2600 rpm), resto reservado
    const q = quadro(PGN_MOTOR_RAPIDO, [0, 160, 40, 255, 255, 127, 255, 255])
    expect(decodificarMotorRapido(q)).toEqual({ instancia: 0, rpm: 2600 })
  })

  it("RPM e instância ausentes (sentinela 'não disponível') viram null, nunca o número bruto", () => {
    // instance=255 (unknown), rpm bruto=65535 (unknown)
    const q = quadro(PGN_MOTOR_RAPIDO, [255, 255, 255, 255, 255, 127, 255, 255])
    expect(decodificarMotorRapido(q)).toEqual({ instancia: null, rpm: null })
  })

  it("0 rpm é um valor VÁLIDO (motor parado), não é tratado como ausente", () => {
    const q = quadro(PGN_MOTOR_RAPIDO, [0, 0, 0, 255, 255, 127, 255, 255])
    expect(decodificarMotorRapido(q)!.rpm).toBe(0)
  })

  it("PGN errada devolve null (quem chama nunca decodifica o quadro errado por engano)", () => {
    const q = quadro(PGN_MOTOR_DINAMICO, [0, 160, 40, 255, 255, 127, 255, 255])
    expect(decodificarMotorRapido(q)).toBeNull()
  })
})

describe("decodificarMotorDinamico (PGN 127489)", () => {
  const DADOS_VALIDOS = [0, 172, 13, 255, 255, 187, 138, 255, 127, 123, 0, 40, 208, 67, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 127, 127]

  it("decodifica pressão de óleo, temperatura, fluxo de combustível e horas do motor de um quadro válido (26 bytes remontados)", () => {
    const q = quadro(PGN_MOTOR_DINAMICO, DADOS_VALIDOS)
    const resultado = decodificarMotorDinamico(q)
    expect(resultado).not.toBeNull()
    expect(resultado!.instancia).toBe(0)
    expect(resultado!.pressaoOleoKPa).toBe(350)
    expect(resultado!.temperaturaC).toBeCloseTo(82, 6)
    expect(resultado!.fluxoCombustivelLh).toBe(12.3)
    expect(resultado!.horasMotor).toBe(1234.5)
  })

  it("todos os campos ausentes (sentinela) viram null — nunca 'motor a 6553 graus'", () => {
    const dadosAusentes = [255, 255, 255, 255, 255, 255, 255, 255, 127, 255, 127, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 127, 127]
    const q = quadro(PGN_MOTOR_DINAMICO, dadosAusentes)
    expect(decodificarMotorDinamico(q)).toEqual({
      instancia: null,
      pressaoOleoKPa: null,
      temperaturaC: null,
      fluxoCombustivelLh: null,
      horasMotor: null,
    })
  })

  it("horas do motor em 0 é válido (equipamento zerado), não ausente", () => {
    const dados = [...DADOS_VALIDOS]
    dados[11] = 0
    dados[12] = 0
    dados[13] = 0
    dados[14] = 0
    const q = quadro(PGN_MOTOR_DINAMICO, dados)
    expect(decodificarMotorDinamico(q)!.horasMotor).toBe(0)
  })

  it("fluxo de combustível negativo (retorno medido à parte) é decodificado, não descartado", () => {
    const dados = [...DADOS_VALIDOS]
    // fuelRate bruto = -50 (-5,0 L/h) em complemento de 2, 16 bits: 0xFFCE
    dados[9] = 0xce
    dados[10] = 0xff
    const q = quadro(PGN_MOTOR_DINAMICO, dados)
    expect(decodificarMotorDinamico(q)!.fluxoCombustivelLh).toBeCloseTo(-5.0, 6)
  })

  it("quadro incompleto (fast packet cortado, menos de 15 bytes) devolve null em vez de ler lixo", () => {
    const q = quadro(PGN_MOTOR_DINAMICO, DADOS_VALIDOS.slice(0, 10))
    expect(decodificarMotorDinamico(q)).toBeNull()
  })
})

describe("decodificarNivelFluido (PGN 127505)", () => {
  it("decodifica tipo, nível e capacidade de um tanque de combustível", () => {
    // instance=0, type=0 (combustível), level bruto=17125 (68,5%), capacity bruto=2000 (200 L)
    const q = quadro(PGN_NIVEL_FLUIDO, [0, 229, 66, 208, 7, 0, 0, 255])
    expect(decodificarNivelFluido(q)).toEqual({ instancia: 0, tipo: "combustivel", nivelPct: 68.5, capacidadeL: 200 })
  })

  it("distingue tanque de água (type=1) de combustível — a PGN é genérica pra qualquer fluido", () => {
    const q = quadro(PGN_NIVEL_FLUIDO, [0x10, 229, 66, 208, 7, 0, 0, 255]) // nibble alto=1 (água)
    expect(decodificarNivelFluido(q)!.tipo).toBe("agua")
  })

  it("nível e capacidade ausentes (sentinela) viram null", () => {
    const q = quadro(PGN_NIVEL_FLUIDO, [0x0f, 255, 127, 255, 255, 255, 255, 255])
    const resultado = decodificarNivelFluido(q)!
    expect(resultado.instancia).toBeNull()
    expect(resultado.nivelPct).toBeNull()
    expect(resultado.capacidadeL).toBeNull()
  })

  it("tipo fora do dicionário conhecido (ex.: 6-13) vira 'desconhecido' em vez de lançar", () => {
    const q = quadro(PGN_NIVEL_FLUIDO, [0x60, 229, 66, 208, 7, 0, 0, 255]) // nibble alto=6
    expect(decodificarNivelFluido(q)!.tipo).toBe("desconhecido")
  })
})

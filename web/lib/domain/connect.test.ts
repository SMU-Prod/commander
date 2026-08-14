import { describe, expect, it } from "vitest"
import { classificarCompatibilidadeConnect, type RespostasCompatibilidadeConnect } from "./connect"

/**
 * Onda 34 — classificação do questionário de interesse no Commander
 * Connect nas 3 classes comerciais do PRD (`docs/prd/commander-connect.txt`,
 * seção 3): CONNECT READY, CONNECT COMPATIBLE, CONSULTAR COMPATIBILIDADE.
 * Escrito ANTES da implementação (TDD) — cada caso abaixo é uma frase do
 * PRD virada em teste.
 */

function respostas(parciais: Partial<RespostasCompatibilidadeConnect>): RespostasCompatibilidadeConnect {
  return {
    redeNmea2000: "nao_sei",
    dadosMotorNaRede: null,
    motorDigitalConhecido: "nao_sei",
    ...parciais,
  }
}

describe("classificarCompatibilidadeConnect", () => {
  it("READY: rede N2K existe E os dados do motor já circulam nela", () => {
    const r = respostas({ redeNmea2000: "sim", dadosMotorNaRede: "sim" })
    expect(classificarCompatibilidadeConnect(r)).toBe("ready")
  })

  it("COMPATIBLE: rede N2K existe, mas os dados do motor ainda não chegam nela (precisa de gateway)", () => {
    const r = respostas({ redeNmea2000: "sim", dadosMotorNaRede: "nao" })
    expect(classificarCompatibilidadeConnect(r)).toBe("compatible")
  })

  it("COMPATIBLE: sem rede N2K ainda, mas o motor é um sistema digital conhecido (SmartCraft/Command Link)", () => {
    const r = respostas({ redeNmea2000: "nao", motorDigitalConhecido: "sim" })
    expect(classificarCompatibilidadeConnect(r)).toBe("compatible")
  })

  it("CONSULTAR: sem rede N2K e motor não é um sistema digital conhecido — instalação desconhecida", () => {
    const r = respostas({ redeNmea2000: "nao", motorDigitalConhecido: "nao" })
    expect(classificarCompatibilidadeConnect(r)).toBe("consultar")
  })

  it("CONSULTAR: qualquer 'não sei' na pergunta principal (rede N2K) — nunca adivinha", () => {
    const r = respostas({ redeNmea2000: "nao_sei", motorDigitalConhecido: "sim" })
    expect(classificarCompatibilidadeConnect(r)).toBe("consultar")
  })

  it("CONSULTAR: 'não sei' se o motor é digital, quando não há rede N2K", () => {
    const r = respostas({ redeNmea2000: "nao", motorDigitalConhecido: "nao_sei" })
    expect(classificarCompatibilidadeConnect(r)).toBe("consultar")
  })

  it("CONSULTAR: rede N2K existe mas não se sabe se os dados do motor chegam nela", () => {
    const r = respostas({ redeNmea2000: "sim", dadosMotorNaRede: "nao_sei" })
    expect(classificarCompatibilidadeConnect(r)).toBe("consultar")
  })

  it("CONSULTAR: rede N2K existe mas a pergunta de acompanhamento nunca foi respondida (null)", () => {
    const r = respostas({ redeNmea2000: "sim", dadosMotorNaRede: null })
    expect(classificarCompatibilidadeConnect(r)).toBe("consultar")
  })
})

import { describe, expect, it } from "vitest"
import {
  CORES_MAPA_PADRAO,
  escolherCor,
  lerCoresMapa,
  mesmasCores,
  observarTema,
  TOKENS_MAPA,
} from "./cores-tema"

describe("escolherCor", () => {
  it("usa o valor lido quando ele existe", () => {
    expect(escolherCor(" #d6f24a ", "alternativa")).toBe("#d6f24a")
  })

  // O caso que motivou a função: `getPropertyValue` devolve "" antes do CSS
  // assentar, e camada pintada com "" fica TRANSPARENTE — a linha da rota
  // sumiria da tela sem nenhum aviso.
  it("cai no valor de emergência quando o token vem vazio", () => {
    expect(escolherCor("", "emergencia")).toBe("emergencia")
    expect(escolherCor("   ", "emergencia")).toBe("emergencia")
    expect(escolherCor(null, "emergencia")).toBe("emergencia")
    expect(escolherCor(undefined, "emergencia")).toBe("emergencia")
  })
})

describe("lerCoresMapa", () => {
  // Este teste roda em Node, sem `document` — que é exatamente a condição do
  // render de servidor. Ler cor não pode lançar ali.
  it("sem documento devolve os valores de emergência, sem lançar", () => {
    expect(lerCoresMapa()).toEqual(CORES_MAPA_PADRAO)
  })

  it("todo token declarado tem valor de emergência", () => {
    for (const chave of Object.keys(TOKENS_MAPA)) {
      expect(CORES_MAPA_PADRAO[chave as keyof typeof CORES_MAPA_PADRAO]).toBeTruthy()
    }
  })
})

describe("mesmasCores", () => {
  it("reconhece a leitura idêntica", () => {
    expect(mesmasCores(CORES_MAPA_PADRAO, { ...CORES_MAPA_PADRAO })).toBe(true)
  })

  it("reconhece a troca de tema por qualquer um dos tokens", () => {
    expect(mesmasCores(CORES_MAPA_PADRAO, { ...CORES_MAPA_PADRAO, acao: "outra" })).toBe(false)
    expect(mesmasCores(CORES_MAPA_PADRAO, { ...CORES_MAPA_PADRAO, meter: "outra" })).toBe(false)
  })
})

describe("observarTema", () => {
  it("fora do navegador devolve um desinscrever que não quebra", () => {
    const parar = observarTema(() => {})
    expect(() => parar()).not.toThrow()
  })
})

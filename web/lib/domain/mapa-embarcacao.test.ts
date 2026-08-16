import { describe, expect, it } from "vitest"
import {
  ROTULO_ZONA,
  sugestaoDeZona,
  ZONAS,
  type ZonaEmbarcacao,
} from "./mapa-embarcacao"

describe("ZONAS", () => {
  it("são as sete do spec, na ordem proa→popa e o casco por último", () => {
    // Spec §2.1: sete zonas fixas. A ordem é espacial (da proa pra popa),
    // com o casco fechando a lista porque ele é "embaixo", não "entre".
    expect(ZONAS).toEqual([
      "proa",
      "conves",
      "casaria",
      "flybridge",
      "praca_de_maquinas",
      "popa",
      "casco",
    ])
  })

  it("não repete zona", () => {
    expect(new Set(ZONAS).size).toBe(ZONAS.length)
  })
})

describe("ROTULO_ZONA", () => {
  it("cobre toda zona com as palavras do spec §2.1", () => {
    const esperado: Record<ZonaEmbarcacao, string> = {
      proa: "Proa",
      conves: "Convés",
      casaria: "Casaria",
      flybridge: "Flybridge",
      praca_de_maquinas: "Praça de máquinas",
      popa: "Popa",
      casco: "Casco",
    }
    expect(ROTULO_ZONA).toEqual(esperado)
  })

  it("toda zona da lista tem rótulo", () => {
    for (const zona of ZONAS) {
      expect(ROTULO_ZONA[zona]).toBeTruthy()
    }
  })
})

describe("sugestaoDeZona", () => {
  it("motor, gerador e bateria moram na praça de máquinas", () => {
    expect(sugestaoDeZona("motor")).toBe("praca_de_maquinas")
    expect(sugestaoDeZona("gerador")).toBe("praca_de_maquinas")
    expect(sugestaoDeZona("bateria")).toBe("praca_de_maquinas")
  })

  it("painel elétrico mora na casaria", () => {
    expect(sugestaoDeZona("painel")).toBe("casaria")
  })

  it("'outro' não tem palpite — devolve null, nunca chuta", () => {
    // Não se inventa dado (spec §2.1): sem convicção, sem sugestão.
    expect(sugestaoDeZona("outro")).toBeNull()
  })
})

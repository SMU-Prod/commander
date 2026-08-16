import { describe, expect, it } from "vitest"
import {
  estadoDaZona,
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

describe("estadoDaZona", () => {
  const eq = [{ id: "eq-1" }]

  it("zona sem nenhum equipamento devolve null — não existe zona pra pintar", () => {
    expect(estadoDaZona([], [], [])).toBeNull()
  })

  it("nunca verde por omissão: zona com equipamento mas sem NENHUM dado devolve null (pino cinza)", () => {
    // Nem item com informação suficiente, nem ocorrência — o pino é cinza,
    // nunca "ok" por ausência de problema (regra de honestidade da onda 16).
    expect(estadoDaZona(eq, [], [])).toBeNull()
  })

  it("item sem informação suficiente não conta, mesmo com status pré-calculado", () => {
    // Contrivado de propósito: um item com `temInformacao: false` não deveria
    // nem existir com status "vencido", mas o filtro precisa ignorá-lo de
    // qualquer forma — é a mesma garantia que `temInformacaoSuficiente` dá
    // em `semaforo.ts` e `calcularSaudeEmbarcacao` em `saude.ts`.
    expect(estadoDaZona(eq, [{ status: "vencido", temInformacao: false }], [])).toBeNull()
  })

  it("um item em dia pinta a zona ok", () => {
    expect(estadoDaZona(eq, [{ status: "ok", temInformacao: true }], [])).toBe("ok")
  })

  it("um item em atenção pinta a zona atenção", () => {
    expect(estadoDaZona(eq, [{ status: "atencao", temInformacao: true }], [])).toBe("atencao")
  })

  it("pior vence entre itens: ok + vencido pinta vencido", () => {
    const itens = [
      { status: "ok" as const, temInformacao: true },
      { status: "vencido" as const, temInformacao: true },
    ]
    expect(estadoDaZona(eq, itens, [])).toBe("vencido")
  })

  it("ocorrência de gravidade alta, sozinha, pinta a zona vencido (crítico)", () => {
    expect(estadoDaZona(eq, [], [{ gravidade: "alta" }])).toBe("vencido")
  })

  it("ocorrência de gravidade baixa ou média pinta só atenção — não escala sozinha", () => {
    expect(estadoDaZona(eq, [], [{ gravidade: "baixa" }])).toBe("atencao")
    expect(estadoDaZona(eq, [], [{ gravidade: "media" }])).toBe("atencao")
  })

  it("ocorrência sem gravidade registrada nunca inventa alta — conta como atenção", () => {
    // Mesma regra de honestidade de `SEVERIDADE_GRAVIDADE_AUSENTE` em saude.ts:
    // dado ausente nunca vira MAIS penalidade.
    expect(estadoDaZona(eq, [], [{ gravidade: null }])).toBe("atencao")
  })

  it("pior vence entre fontes: item ok + ocorrência grave pinta vencido", () => {
    expect(estadoDaZona(eq, [{ status: "ok", temInformacao: true }], [{ gravidade: "alta" }])).toBe("vencido")
  })

  it("pior vence entre fontes: item vencido some sob ocorrência leve, continua vencido", () => {
    const itens = [{ status: "vencido" as const, temInformacao: true }]
    expect(estadoDaZona(eq, itens, [{ gravidade: "baixa" }])).toBe("vencido")
  })
})

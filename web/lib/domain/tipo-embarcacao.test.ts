import { describe, expect, it } from "vitest"
import { ehTipoEmbarcacao, ROTULO_TIPO_EMBARCACAO, TIPOS_EMBARCACAO } from "./tipo-embarcacao"

describe("tipo da embarcação — o vocabulário do canvas tela-3j", () => {
  it("são os quatro chips do canvas, na ordem do canvas", () => {
    expect(TIPOS_EMBARCACAO).toEqual(["lancha", "veleiro", "iate", "bote"])
  })

  it("todo tipo tem rótulo — chip sem nome não existe", () => {
    for (const t of TIPOS_EMBARCACAO) {
      expect(ROTULO_TIPO_EMBARCACAO[t]).toBeTruthy()
    }
    expect(ROTULO_TIPO_EMBARCACAO.lancha).toBe("Lancha")
  })

  it("valida o que veio de formulário sem confiar no navegador", () => {
    expect(ehTipoEmbarcacao("veleiro")).toBe(true)
    expect(ehTipoEmbarcacao("catamara")).toBe(false)
    expect(ehTipoEmbarcacao("")).toBe(false)
    expect(ehTipoEmbarcacao(null)).toBe(false)
    expect(ehTipoEmbarcacao(7)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { ehTipoEmbarcacao, ROTULO_TIPO_EMBARCACAO, TIPOS_EMBARCACAO } from "./tipo-embarcacao"

describe("tipo da embarcação — o vocabulário do canvas tela-3j", () => {
  it("os quatro chips do canvas vêm primeiro, na ordem do canvas", () => {
    // Onda 70: "jet" entrou no fim, pelo §5 do PRD Upgrade 3 (ficha própria
    // de PWC). Os quatro do canvas não mudaram de ordem — o chip que o dono
    // desenhou continua onde ele desenhou.
    expect(TIPOS_EMBARCACAO.slice(0, 4)).toEqual(["lancha", "veleiro", "iate", "bote"])
    expect(TIPOS_EMBARCACAO).toEqual(["lancha", "veleiro", "iate", "bote", "jet"])
  })

  it("Jet Ski é como o pátio chama — não 'PWC'", () => {
    expect(ROTULO_TIPO_EMBARCACAO.jet).toBe("Jet Ski")
    expect(ehTipoEmbarcacao("jet")).toBe(true)
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

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BotaoCirculo } from "./botao-circulo"

function html(props: Parameters<typeof BotaoCirculo>[0]) {
  return renderToStaticMarkup(createElement(BotaoCirculo, props))
}

describe("BotaoCirculo", () => {
  it("com href é um link; sem href, um botão que não envia formulário", () => {
    const link = html({ icone: "repetir", rotulo: "Atualizar", href: "/avisos" })
    expect(link).toContain("<a ")
    expect(link).toContain('href="/avisos"')
    expect(link).not.toContain("<button")
    const botao = html({ icone: "mais", rotulo: "Adicionar" })
    expect(botao).toContain("<button")
    // Sem `type="button"` explícito ele viraria submit dentro de um <form> —
    // e este botãozinho vai para o canto de cartões que às vezes são formulário.
    expect(botao).toContain('type="button"')
  })

  it("botão só de ícone SEMPRE tem nome acessível", () => {
    const saida = html({ icone: "chevron", rotulo: "Expandir" })
    expect(saida).toContain('aria-label="Expandir"')
    expect(saida).toContain('title="Expandir"')
  })

  /**
   * A briga entre os dois números da peça: o desenho pede 30px, a régua de
   * toque pede 44. Se algum dia alguém "simplificar" isso para um círculo só,
   * este teste cai — que é exatamente o ponto.
   */
  it("o alvo tem 44px mesmo com o desenho de 30px", () => {
    const saida = html({ icone: "mais", rotulo: "Adicionar" })
    expect(saida).toContain("size-11")
    expect(saida).toContain("size-[30px]")
    // A folga devolvida ao layout, para o cartão continuar espaçado como se o
    // botão medisse 30px.
    expect(saida).toContain("-m-[7px]")
  })

  it("é peça de servidor — nada de diretiva de cliente escondida", () => {
    expect(html({ icone: "mais", rotulo: "Adicionar" })).not.toContain("use client")
  })
})

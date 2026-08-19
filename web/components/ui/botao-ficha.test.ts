import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BotaoFicha } from "./botao-ficha"

function html(props: Parameters<typeof BotaoFicha>[0]) {
  return renderToStaticMarkup(createElement(BotaoFicha, props))
}

describe("BotaoFicha", () => {
  it("com href é link; sem href, botão (não envia formulário por acidente)", () => {
    const link = html({ href: "/editar", children: "Editar" })
    expect(link).toContain("<a ")
    const botao = html({ children: "Excluir" })
    expect(botao).toContain("<button")
    expect(botao).toContain('type="button"')
  })

  it("contorno é neutro; preenchido usa o acento — nunca os dois parecem iguais", () => {
    const contorno = html({ href: "/x", children: "Editar", variante: "contorno" })
    const preenchido = html({ href: "/x", children: "Ativar", variante: "preenchido" })
    expect(contorno).toContain("bg-panel")
    expect(contorno).not.toContain("bg-accent")
    expect(preenchido).toContain("bg-accent")
    expect(preenchido).toContain("text-acao-texto")
  })

  it("alvo de 44px sempre — é ação, não pastilha informativa", () => {
    expect(html({ href: "/x", children: "Editar" })).toContain("min-h-11")
  })
})

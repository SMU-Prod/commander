import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MigalhaPao } from "./migalha-pao"

const ITENS = [
  { rotulo: "Barco", href: "/barco" },
  { rotulo: "Motores", href: "/barco/eletrica" },
  { rotulo: "Motor BB" },
]

describe("MigalhaPao", () => {
  it("os itens do meio navegam; o último não é link", () => {
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: ITENS }))
    expect(saida).toContain('href="/barco"')
    expect(saida).toContain('href="/barco/eletrica"')
    // "Motor BB" (o atual) não pode aparecer dentro de um <a> — clique morto
    // num lugar que já é onde a pessoa está.
    const ultimo = saida.match(/<span aria-current="page"[^>]*>Motor BB<\/span>/)
    expect(ultimo).not.toBeNull()
  })

  it("o último item carrega aria-current=page", () => {
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: ITENS }))
    expect(saida).toContain('aria-current="page"')
  })

  it("o link da trilha tem alvo de toque, e ele vem do token", () => {
    // Onda 94 — estes links eram 15px de alvo (fonte de 11 por 1,4 de
    // entrelinha), o menor de `components/ui/`. O teste trava o TOKEN e não os
    // 44px: se a régua do app mudar, ela muda num lugar só.
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: ITENS }))
    expect(saida).toContain("min-h-[var(--altura-controle)]")
  })

  it("com um item só, não quebra (sem chevron nenhum)", () => {
    const saida = renderToStaticMarkup(createElement(MigalhaPao, { itens: [{ rotulo: "Início" }] }))
    expect(saida).toContain("Início")
  })
})

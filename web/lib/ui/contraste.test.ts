import { describe, expect, it } from "vitest"

/** Luminância relativa (WCAG 2.1). */
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function razao(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Os valores do tema escuro da onda 57. Se globals.css mudar, mude aqui —
// e o teste dirá se a mudança quebrou a legibilidade.
//
// SUPERFICIE aqui é #1c232c, não o #121820 do plano original: aquele
// reprovava o teste "cartao se separa do fundo" abaixo mesmo com FUNDO em
// preto puro (1.177:1 < 1.2) — ver o comentário em globals.css.
const FUNDO = "#0a0e12"
const SUPERFICIE = "#1c232c"
const TEXTO = "#e8eef4"
const TEXTO_FRACO = "#8fa2b3"

describe("contraste do tema escuro", () => {
  it("texto sobre cartao passa AA (4.5:1)", () => {
    expect(razao(TEXTO, SUPERFICIE)).toBeGreaterThanOrEqual(4.5)
  })

  it("texto fraco sobre cartao passa AA — e o par que mais reprova na pratica", () => {
    expect(razao(TEXTO_FRACO, SUPERFICIE)).toBeGreaterThanOrEqual(4.5)
  })

  it("o cartao se separa do fundo, senao o escuro vira uma mancha so", () => {
    expect(razao(SUPERFICIE, FUNDO)).toBeGreaterThan(1.2)
  })
})

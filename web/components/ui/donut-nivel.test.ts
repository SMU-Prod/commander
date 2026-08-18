import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DonutNivel } from "./donut-nivel"

function html(props: Parameters<typeof DonutNivel>[0]) {
  return renderToStaticMarkup(createElement(DonutNivel, props))
}

const BASE = { unidade: "gal", rotulo: "Combustível" } as const

/** A superfície do líquido é o primeiro `M -10 <y>` do caminho. */
function nivelDesenhado(saida: string): number | null {
  const achado = saida.match(/d="M -10 ([\d.]+) C/)
  return achado ? Number(achado[1]) : null
}

describe("DonutNivel", () => {
  it("mostra o valor em mono tabular e o percentual no chip", () => {
    const saida = html({ ...BASE, valor: 3.61, percentual: 31 })
    const span = saida.match(/<span class="([^"]*)">3,61<\/span>/)?.[1] ?? ""
    expect(span).toContain("font-mono-instr")
    expect(span).toContain("tabular-nums")
    expect(saida).toContain("31%")
  })

  it("o aria-label diz nível e percentual", () => {
    const saida = html({ ...BASE, valor: 3.61, percentual: 31 })
    expect(saida).toContain('aria-label="Combustível: 3,61 gal, 31% da capacidade"')
  })

  it("acima de 100% o líquido para na boca do tanque — não transborda", () => {
    const cheio = html({ ...BASE, valor: 44, percentual: 100 })
    const absurdo = html({ ...BASE, valor: 44, percentual: 140 })
    expect(nivelDesenhado(absurdo)).toBe(nivelDesenhado(cheio))
    expect(absurdo).toContain(">100%<")
  })

  it("sem leitura o tanque fica vazio, sem dourado nenhum", () => {
    const saida = html({ ...BASE, valor: null, percentual: null })
    expect(saida).toContain("—")
    expect(nivelDesenhado(saida)).toBeNull()
    // Nada de `--acao` no preenchimento: tanque sem leitura não é tanque cheio.
    expect(saida).not.toContain("stop-color")
  })

  it("zero por cento não desenha lâmina de líquido", () => {
    const saida = html({ ...BASE, valor: 0, percentual: 0 })
    expect(nivelDesenhado(saida)).toBeNull()
    expect(saida).toContain(">0%<")
  })

  it("o halo do número só entra quando o líquido chega nele", () => {
    // Abaixo da metade o número está sobre o fundo escuro do tanque e a sombra
    // seria sujeira; acima, é o que salva o branco sobre o dourado.
    expect(html({ ...BASE, valor: 3.61, percentual: 31 })).not.toContain("text-shadow")
    expect(html({ ...BASE, valor: 9, percentual: 78 })).toContain("text-shadow")
  })

  it("o badge de apoio sai quando existe, e some quando não", () => {
    expect(html({ ...BASE, valor: 3.61, percentual: 31, apoio: "⌀ 72°F" })).toContain("⌀ 72°F")
    expect(html({ ...BASE, valor: 3.61, percentual: 31 })).not.toContain("⌀")
  })
})

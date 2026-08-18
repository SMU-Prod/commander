import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Medidor } from "./medidor"

/** Mesmo padrão de `abas.test.ts`: `renderToStaticMarkup` sem jsdom, porque o
 *  que precisa ser medido é o SVG que sai. */
function html(props: Parameters<typeof Medidor>[0]) {
  return renderToStaticMarkup(createElement(Medidor, props))
}

const BASE = { max: 150, unidade: "mph", rotulo: "Velocidade" } as const

describe("Medidor", () => {
  it("mostra o valor em fonte de instrumento, mono E tabular", () => {
    const saida = html({ ...BASE, valor: 100 })
    const span = saida.match(/<span class="([^"]*)">100<\/span>/)?.[1] ?? ""
    expect(span).toContain("font-mono-instr")
    expect(span).toContain("tabular-nums")
  })

  it("o aria-label diz a leitura inteira — o SVG sozinho não fala", () => {
    const saida = html({ ...BASE, valor: 100 })
    expect(saida).toContain('aria-label="Velocidade: 100 mph de 150"')
  })

  /**
   * A trava da spec §7: onde o dado não existe, o medidor não pinta. Um arco
   * cinza com a agulha no zero seria lido como "tudo bem" sobre uma leitura
   * que ninguém fez — e no zero a agulha cai justamente dentro da faixa verde.
   */
  it("sem leitura, NENHUMA zona é verde e não há ponteiro", () => {
    const saida = html({ ...BASE, valor: null })
    expect(saida).not.toContain("var(--ok)")
    expect(saida).not.toContain("var(--warn)")
    expect(saida).not.toContain("var(--crit)")
    expect(saida).toContain("var(--linha)")
    // O ponteiro é o único traço em `--texto`; sem ele, a cor some do markup.
    expect(saida).not.toContain('stroke="var(--texto)"')
    expect(saida).toContain("—")
  })

  it("zero É uma leitura, e continua desenhando o instrumento inteiro", () => {
    // A distinção que o teste acima protege só vale se o zero legítimo NÃO for
    // tratado como ausência: 0 nó é uma medida (o barco está parado).
    const saida = html({ ...BASE, valor: 0 })
    expect(saida).toContain("var(--ok)")
    expect(saida).toContain('stroke="var(--texto)"')
    expect(saida).not.toContain("—")
  })

  it("acima do máximo o ponteiro para na ponta do arco, não passa dela", () => {
    const noMaximo = html({ ...BASE, valor: 150 })
    const muitoAcima = html({ ...BASE, valor: 900 })
    const ponta = (saida: string) => saida.match(/<line x1="100" y1="104" x2="([^"]*)" y2="([^"]*)"/)?.slice(1, 3)
    expect(ponta(muitoAcima)).toEqual(ponta(noMaximo))
  })

  it("as zonas padrão acompanham a escala — não são frações soltas", () => {
    // A regressão que a captura v1 pegou: `{ ate: 0.5 }` fixo significava
    // "meio mph", e o arco saía cinza com um respingo de cor colado no zero.
    // Com 150 de máximo, o verde tem de ir até 75, ou seja, ocupar de fato o
    // primeiro terço do arco — mais de um punhado de pixels.
    const saida = html({ ...BASE, valor: 100 })
    const verde = saida.match(/x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"[^>]*>\s*<stop offset="0" stop-color="var\(--ok\)"/)
    expect(verde).not.toBeNull()
    const [x1, y1, x2, y2] = verde!.slice(1, 5).map(Number)
    expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThan(50)
  })

  it("o chip de estado sai com a palavra, não só com a cor", () => {
    const saida = html({ ...BASE, valor: 140, estado: { rotulo: "Alta", tom: "critico" } })
    expect(saida).toContain("Alta")
    expect(saida).toContain("text-crit")
  })
})

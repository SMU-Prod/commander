import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Casco, type ZonaDoCasco } from "./casco"

/**
 * Mesmo padrão de `faixa-topo.test.ts`: `renderToStaticMarkup` sem jsdom.
 * O Casco é função pura de props pra HTML, e o que precisa ser cobrado é o
 * CONTRATO que sobrevive ao 3D da onda 62: pino só onde há equipamento,
 * cor E palavra por estado, cinza honesto quando não há dado (nunca verde
 * por omissão), e o dourado só na zona selecionada.
 */

function pino(sobre: Partial<ZonaDoCasco> = {}): ZonaDoCasco {
  return { zona: "praca_de_maquinas", quantidade: 4, estado: "atencao", ...sobre }
}

function html(zonas: ZonaDoCasco[], selecionada?: ZonaDoCasco["zona"]) {
  return renderToStaticMarkup(createElement(Casco, { zonas, selecionada, hrefBase: "/barco/mapa" }))
}

describe("Casco", () => {
  it("pino só em zona presente — as outras seis não ganham link", () => {
    const saida = html([pino()])
    expect(saida).toContain('href="/barco/mapa?zona=praca_de_maquinas"')
    for (const ausente of ["proa", "conves", "casaria", "flybridge", "popa", "casco"]) {
      expect(saida).not.toContain(`?zona=${ausente}`)
    }
  })

  it("zona com contagem zero não vira pino — seria decorar o vazio", () => {
    expect(html([pino({ quantidade: 0 })])).not.toContain("?zona=")
  })

  it("aria-label completo: zona, contagem e a PALAVRA do estado", () => {
    expect(html([pino()])).toContain('aria-label="Praça de máquinas, 4 equipamentos, atenção"')
    // Singular sem gambiarra de "1 equipamentos".
    expect(html([pino({ zona: "casco", quantidade: 1, estado: "vencido" })])).toContain(
      'aria-label="Casco, 1 equipamento, vencido"',
    )
  })

  it("cada estado pinta com o próprio token — e a contagem aparece no pino", () => {
    expect(html([pino({ estado: "ok" })])).toContain("border-ok")
    expect(html([pino({ estado: "atencao" })])).toContain("border-warn")
    expect(html([pino({ estado: "vencido" })])).toContain("border-crit")
    expect(html([pino({ quantidade: 7 })])).toContain(">7<")
  })

  it("estado null é pino CINZA e diz 'sem dados' — nunca verde por omissão", () => {
    const saida = html([pino({ estado: null })])
    expect(saida).toContain("border-dim")
    expect(saida).toContain("sem dados")
    expect(saida).not.toContain("border-ok")
    expect(saida).not.toContain("text-ok")
  })

  it("zona selecionada ganha o contorno dourado (pino e região); sem seleção, dourado nenhum", () => {
    const selecionado = html([pino()], "praca_de_maquinas")
    expect(selecionado).toContain("outline-accent")
    expect(selecionado).toContain("stroke-accent")
    expect(selecionado).toContain('aria-current="true"')

    const semSelecao = html([pino()])
    expect(semSelecao).not.toContain("outline-accent")
    expect(semSelecao).not.toContain("stroke-accent")
    expect(semSelecao).not.toContain("aria-current")
  })

  it("selecionar zona SEM pino acende a região mesmo assim — o mapa mostra onde ela fica", () => {
    // T4 valida `?zona=` contra o vocabulário, não contra "tem equipamento";
    // a região acesa sem pino é o desenho respondendo "é aqui" sem inventar dado.
    const saida = html([pino()], "proa")
    expect(saida).toContain("stroke-accent")
    expect(saida).not.toContain('aria-current="true"')
  })

  it("com `ancora`, o pino leva pro painel dentro da página (o toque rola até a resposta)", () => {
    const saida = renderToStaticMarkup(
      createElement(Casco, { zonas: [pino()], hrefBase: "/barco/mapa", ancora: "painel-zona" }),
    )
    expect(saida).toContain('href="/barco/mapa?zona=praca_de_maquinas#painel-zona"')
  })

  it("orientação escrita nas pontas: PROA e POPA", () => {
    const saida = html([])
    expect(saida).toContain("PROA")
    expect(saida).toContain("POPA")
  })

  it("o desenho é decorativo (aria-hidden); a informação mora nos pinos", () => {
    expect(html([pino()])).toContain('aria-hidden="true"')
  })
})

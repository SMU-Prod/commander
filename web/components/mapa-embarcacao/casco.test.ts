import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Casco, type ZonaDoCasco } from "./casco"

/**
 * Mesmo padrão de `faixa-topo.test.ts`: `renderToStaticMarkup` sem jsdom.
 * O Casco é função pura de props pra HTML, e o que precisa ser cobrado é o
 * CONTRATO que sobrevive ao 3D da onda 62: TODA zona é tocável, contagem só
 * onde há equipamento, cor E palavra por estado, cinza honesto quando não há
 * dado (nunca verde por omissão), e o dourado só na zona selecionada.
 */

function pino(sobre: Partial<ZonaDoCasco> = {}): ZonaDoCasco {
  return { zona: "praca_de_maquinas", quantidade: 4, estado: "atencao", ...sobre }
}

function html(zonas: ZonaDoCasco[], selecionada?: ZonaDoCasco["zona"]) {
  return renderToStaticMarkup(createElement(Casco, { zonas, selecionada, hrefBase: "/barco/mapa" }))
}

describe("Casco", () => {
  // ONDA 97 — as duas provas abaixo cobravam o CONTRÁRIO até hoje ("pino só
  // em zona presente", "contagem zero não vira pino"). Elas guardavam a regra
  // que deixou o mapa do dia 1 sem um único alvo de toque embaixo de uma
  // legenda que manda tocar — ver o bloco dos marcadores em `casco.tsx`. O
  // que a regra protegia de verdade (não escrever "0" numa zona vazia)
  // continua cobrado, agora separado do direito de tocar.
  it("TODA zona é tocável, inclusive a vazia — a legenda manda tocar", () => {
    const saida = html([pino()])
    expect(saida).toContain('href="/barco/mapa?zona=praca_de_maquinas"')
    for (const outra of ["proa", "conves", "casaria", "flybridge", "popa", "casco"]) {
      expect(saida).toContain(`?zona=${outra}`)
    }
  })

  it("zona vazia não escreve contagem nenhuma — nem '0'", () => {
    const saida = html([pino({ quantidade: 0 })])
    expect(saida).toContain("?zona=praca_de_maquinas")
    expect(saida).not.toContain(">0<")
    // E ela se anuncia pelo que é, sem fingir farol.
    expect(saida).toContain('aria-label="Praça de máquinas, sem equipamento"')
  })

  it("zona sem equipamento não recebe cor de farol — o anel é tracejado e dim", () => {
    const saida = html([])
    expect(saida).toContain("border-dashed")
    expect(saida).not.toContain("border-ok")
    expect(saida).not.toContain("border-warn")
    expect(saida).not.toContain("border-crit")
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

  it("selecionar zona SEM equipamento acende a região mesmo assim — o mapa mostra onde ela fica", () => {
    // T4 valida `?zona=` contra o vocabulário, não contra "tem equipamento";
    // a região acesa é o desenho respondendo "é aqui" sem inventar dado. A
    // zona escolhida se declara escolhida mesmo vazia (onda 97) — era esse o
    // caminho que não existia: a página sabia responder e ninguém chegava lá.
    const saida = html([pino()], "proa")
    expect(saida).toContain("stroke-accent")
    expect(saida).toContain('aria-current="true"')
    expect(saida).not.toContain(">0<")
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

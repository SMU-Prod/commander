import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Esqueleto } from "./esqueleto"

function html(props: Parameters<typeof Esqueleto>[0]) {
  return renderToStaticMarkup(createElement(Esqueleto, props))
}

const FORMAS = ["lista", "ficha", "painel"] as const

describe("Esqueleto", () => {
  it("toda forma se anuncia como carregando", () => {
    for (const forma of FORMAS) {
      const saida = html({ forma })
      expect(saida, forma).toContain('role="status"')
      expect(saida, forma).toContain('aria-busy="true"')
      expect(saida, forma).toContain("Carregando")
    }
  })

  /**
   * O achado 3.2 inteiro em um teste: a foto de 176px do `CardEmbarcacao` é a
   * silhueta da Início, e era ela que o esqueleto genérico desenhava nas 92
   * telas. Ela só pode existir onde chega mesmo.
   */
  it("só o painel desenha a foto de 176px — é ela que fazia a tela saltar", () => {
    expect(html({ forma: "painel" })).toContain("h-44")
    expect(html({ forma: "lista" })).not.toContain("h-44")
    expect(html({ forma: "ficha" })).not.toContain("h-44")
  })

  it("lista tem a anatomia de LinhaLista: separador, py-3 e uma linha por item", () => {
    const saida = html({ forma: "lista", itens: 6 })
    expect(saida).toContain("border-b border-line py-3 last:border-0")
    expect(saida.match(/border-b border-line py-3/g)).toHaveLength(6)
  })

  it("ficha abre pelo cabeçalho de detalhe e repete blocos de rótulo/valor", () => {
    const saida = html({ forma: "ficha", itens: 2 })
    // A grade de pares é a marca do bloco de ficha (`GradeRotuloValor`).
    expect(saida.match(/grid grid-cols-2 gap-x-4 gap-y-3/g)).toHaveLength(2)
  })

  /**
   * `/barco` é a mesma silhueta da Início a partir da foto, mas sem a
   * saudação — e 40px de avatar que não chega empurrariam a foto para baixo,
   * que é exatamente o salto que este componente existe para matar.
   */
  it("painel sem saudação começa direto na foto", () => {
    expect(html({ forma: "painel" })).toContain("size-10")
    expect(html({ forma: "painel", saudacao: false })).not.toContain("size-10")
  })

  /**
   * Achado 3.5: sob `prefers-reduced-motion` a regra wildcard de `globals.css`
   * congela qualquer animação, e o esqueleto vira um bloco cinza parado. A
   * troca é uma frase visível — texto não congela.
   */
  it("quem pediu menos movimento não recebe pulso, recebe palavra", () => {
    const saida = html({ forma: "lista" })
    // `motion-safe:` e não `animate-pulse` solto: sob "reduzir movimento" a
    // animação nem chega a ser declarada.
    expect(saida).toContain("motion-safe:animate-pulse")
    expect(saida).not.toMatch(/[\s"]animate-pulse/)
    expect(saida).toContain("motion-reduce:block")
  })

  /**
   * O `loading.tsx` antigo misturava quatro raios (`rounded-[16px]`,
   * `rounded`, `rounded-[14px]`, `rounded-[10px]`), dois deles fora de
   * qualquer token. Raio arbitrário em pixel não volta.
   */
  it("todo raio vem de token, nenhum pixel cravado", () => {
    for (const forma of FORMAS) {
      const saida = html({ forma })
      expect(saida, forma).not.toMatch(/rounded-\[\d/)
      for (const arbitrario of saida.match(/rounded-\[[^\]]+\]/g) ?? []) {
        expect(arbitrario, forma).toMatch(/^rounded-\[var\(--raio-[a-z]+\)\]$/)
      }
    }
  })

  it("itens controla a repetição da unidade de cada forma", () => {
    expect(html({ forma: "painel", itens: 3 }).match(/sombra-1/g)?.length).toBeGreaterThan(
      html({ forma: "painel", itens: 1 }).match(/sombra-1/g)?.length ?? 0,
    )
  })
})

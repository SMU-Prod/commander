import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ESTADOS_SELO, Selo } from "./selo"

/**
 * O TESTE RENDERIZA O COMPONENTE — NÃO A FUNÇÃO QUE NINGUÉM CHAMA.
 *
 * A versão anterior media `rotuloDoSelo(estado)`, e essa função tinha UM
 * consumidor: este arquivo. Nos dois usos reais (`/hoje`, o selo da Saúde e o
 * do boletim do mar) o `Selo` recebe `children`, então o `ROTULO` interno
 * nunca era renderizado. Ou seja: a garantia que o `vitest.config.mts` foi
 * alterado pra proteger — "estado nunca só por cor" (docs/DESIGN.md §6,
 * regra 3) — estava sendo medida num galho morto.
 *
 * DAS DUAS SAÍDAS POSSÍVEIS, ESTA. A outra era o `Selo` derivar sempre o
 * rótulo e os dois call sites pararem de passar `children` — e ela custa
 * caro: as palavras que aparecem na tela são do DOMÍNIO, não genéricas. A
 * Saúde fala o vocabulário do PRD §5 ("Saudável", "Ação necessária") e o
 * boletim fala o do mar ("Bom pra sair", "Mar pesado"); trocá-las pelo
 * "Em dia"/"Crítico" do mapa interno empobreceria as duas telas para
 * facilitar o teste. `children` fica; o teste é que passa a olhar o que a
 * pessoa lê.
 *
 * `renderToStaticMarkup` e não uma biblioteca de teste de DOM: o `Selo` é
 * uma função pura sem estado, sem efeito e sem evento — o que precisa ser
 * medido é o texto que sai. Isso dispensa jsdom e `@testing-library` no
 * devDependencies e mantém o runner como está.
 */
function textoDoSelo(estado: (typeof ESTADOS_SELO)[number], filhos?: ReactNode): string {
  return renderToStaticMarkup(createElement(Selo, { estado }, filhos))
    .replace(/<[^>]*>/g, "")
    .trim()
}

describe("Selo", () => {
  it("todo estado renderiza uma palavra — cor sozinha exclui quem não distingue verde de vermelho", () => {
    for (const e of ESTADOS_SELO) {
      expect(textoDoSelo(e), e).not.toBe("")
    }
  })

  it("os rotulos nao usam porcentagem nem numero (PRD 1.1)", () => {
    for (const e of ESTADOS_SELO) {
      expect(textoDoSelo(e), e).not.toMatch(/\d|%/)
    }
  })

  it("a palavra do call site é a que aparece — é este o caminho que /hoje usa", () => {
    // Os dois usos reais passam `children` com o vocabulário da própria tela.
    expect(textoDoSelo("atencao", "Mar pesado")).toBe("Mar pesado")
    expect(textoDoSelo("ok", "Saudável")).toBe("Saudável")
  })

  it("o estado tem um segundo canal além da cor", () => {
    // A cor entra por classe utilitária (`text-ok`, `border-crit/40`...), e
    // ela sozinha não basta. O que este teste cobra é que exista TEXTO junto,
    // em qualquer um dos dois caminhos.
    for (const e of ESTADOS_SELO) {
      const html = renderToStaticMarkup(createElement(Selo, { estado: e }))
      expect(html, e).toMatch(/class="[^"]*(text-ok|text-warn|text-crit|text-dim)/)
      expect(html.replace(/<[^>]*>/g, "").trim().length, e).toBeGreaterThan(0)
    }
  })
})

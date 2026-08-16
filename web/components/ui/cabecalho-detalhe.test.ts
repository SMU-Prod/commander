import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CabecalhoDetalhe } from "./cabecalho-detalhe"

/**
 * Mesmo padrão de `abas.test.ts`/`selo.test.ts`: `renderToStaticMarkup` sem
 * jsdom — o componente é função pura e o que precisa ser medido é o HTML que
 * sai. O que este arquivo protege, especificamente, é o contrato da onda 60:
 * `selo` e `acoes` são props NOVAS e OPCIONAIS, e os ~46 consumidores que não
 * as passam têm que continuar recebendo EXATAMENTE o cabeçalho de antes.
 */
function html(props: Parameters<typeof CabecalhoDetalhe>[0]) {
  return renderToStaticMarkup(createElement(CabecalhoDetalhe, props))
}

const SELO = createElement("span", { className: "selo-teste" }, "Em dia")
const ACOES = createElement("a", { href: "/editar", className: "acao-teste" }, "Editar")

describe("CabecalhoDetalhe — contrato antigo intacto", () => {
  it("só voltarHref: renderiza o link de voltar e nada de título", () => {
    const saida = html({ voltarHref: "/barco" })
    expect(saida).toContain('href="/barco"')
    expect(saida).toContain("Voltar")
    expect(saida).not.toContain("<h1")
  })

  it("sem selo nem acoes, o wrapper do título é o flex de sempre — em toda largura, não só sm:", () => {
    const saida = html({ voltarHref: "/barco", titulo: "Motor BB", descricao: "Volvo Penta D6-400" })
    expect(saida).toContain('class="mt-3 flex items-start justify-between gap-3"')
    expect(saida).toContain(">Motor BB</h1>")
    expect(saida).toContain("Volvo Penta D6-400")
  })
})

describe("CabecalhoDetalhe — a anatomia de ficha da imagem 2 (onda 60)", () => {
  it("o selo sai COLADO ao título: mesmo contêiner de linha, título ainda truncável", () => {
    const saida = html({ voltarHref: "/barco", titulo: "Motor BB", selo: SELO })
    const linha = saida.match(/<div class="flex min-w-0 items-center gap-2">.*?<\/div>/)?.[0] ?? ""
    expect(linha).toContain(">Motor BB</h1>")
    expect(linha).toContain("selo-teste")
    expect(linha).toContain("truncate")
  })

  it("com acoes, o wrapper só vira flex de sm: pra cima — no celular a barra desce pra baixo do título", () => {
    const saida = html({ voltarHref: "/barco", titulo: "Motor BB", acoes: ACOES })
    expect(saida).toContain('class="mt-3 sm:flex sm:items-start sm:justify-between sm:gap-3"')
    // A barra: bloco com respiro em cima no celular (mt-3), zerado no desktop
    // (sm:mt-0), encostada à direita sem esmagar o título (shrink + justify).
    const barra = saida.match(/<div class="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0 sm:justify-end">.*?<\/div>/)?.[0] ?? ""
    expect(barra).toContain("acao-teste")
  })

  it("selo e acoes sem titulo não aparecem — selo sem título não é ficha", () => {
    const saida = html({ voltarHref: "/barco", selo: SELO, acoes: ACOES })
    expect(saida).not.toContain("selo-teste")
    expect(saida).not.toContain("acao-teste")
  })
})

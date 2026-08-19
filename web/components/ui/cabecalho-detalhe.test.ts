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
  it("o selo sai COLADO ao título: mesmo contêiner de linha, título ainda contido", () => {
    const saida = html({ voltarHref: "/barco", titulo: "Motor BB", selo: SELO })
    const linha = saida.match(/<div class="flex min-w-0 items-center gap-2">.*?<\/div>/)?.[0] ?? ""
    expect(linha).toContain(">Motor BB</h1>")
    expect(linha).toContain("selo-teste")
    expect(linha).toContain("line-clamp-2")
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

/**
 * ONDA 91 — `titulo` passou de `string` a `ReactNode`. O caso que forçou: a
 * ficha de uma ocorrência ANULADA precisa do título riscado, e ao adotar o
 * componente padrão essa informação — a única marca de que o registro não vale
 * mais — sumia da tela.
 */
describe("CabecalhoDetalhe — título rico", () => {
  it("texto puro continua saindo igual: os ~46 consumidores não mexem", () => {
    expect(html({ voltarHref: "/barco", titulo: "Motor BB" })).toContain(">Motor BB</h1>")
  })

  it("aceita marcação no título — é assim que a ocorrência anulada aparece riscada", () => {
    const saida = html({
      voltarHref: "/barco/ocorrencias",
      titulo: createElement("s", null, "Vazamento na casa de máquinas"),
    })
    expect(saida).toContain("<s>Vazamento na casa de máquinas</s>")
  })

  it("o título continua contido mesmo com filho que não é texto puro", () => {
    const saida = html({
      voltarHref: "/x",
      titulo: createElement("s", null, "Título muito longo que não cabe"),
      selo: SELO,
    })
    // `min-w-0` explícito além do `line-clamp`: com selo o `<h1>` é item de
    // uma fileira flex, e sem mínimo zerado um título longo empurraria o selo
    // pra fora em vez de quebrar.
    expect(saida).toContain('class="titulo-pagina min-w-0 line-clamp-2"')
  })
})

/**
 * ONDA 91 — o título de tela deixou de ser cortado em uma linha.
 *
 * `/admin/gold/precos` ("Preços da avaliação Commander Gold", 34 caracteres)
 * ficava "Preços da avaliação Comm…" a 390px, e a tela preferiu não usar o
 * componente. A régua da casa (`linha-lista.tsx`, onda 56): reticência serve
 * quando o resto é dispensável, não quando o texto É a identificação.
 */
describe("CabecalhoDetalhe — o título cabe em duas linhas", () => {
  it("nenhum `<h1>` sai com `truncate` — o teto agora é de duas linhas", () => {
    for (const props of [
      { voltarHref: "/x", titulo: "Preços da avaliação Commander Gold" },
      { voltarHref: "/x", titulo: "Preços da avaliação Commander Gold", selo: SELO },
      { voltarHref: "/x", titulo: "Preços da avaliação Commander Gold", acoes: ACOES },
    ]) {
      expect(html(props)).not.toMatch(/class="[^"]*\btruncate\b/)
      expect(html(props)).toContain("line-clamp-2")
    }
  })
})

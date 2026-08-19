import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChipDado } from "./chip"
import { LinhaLista } from "./linha-lista"

/**
 * ONDA 91, achado 1.2 — A LINHA JÁ ESTAVA NOS 64px E ERA AÍ QUE ELA PERDIA.
 *
 * A régua do spec (§3, item 6) é "2 linhas de texto + 3 chips em ~64px". A
 * nossa linha densa media exatamente 64px e carregava duas linhas de texto e
 * UM número — não porque a altura faltasse, mas porque não havia onde pôr
 * chip. Quem quis chip escreveu à mão, e foi assim que o cartão de saída do
 * Diário virou 120px pra entregar o que a referência entrega em 64.
 */
function html(props: Parameters<typeof LinhaLista>[0]) {
  return renderToStaticMarkup(createElement(LinhaLista, props))
}

/** Arquivo `.ts` não tem JSX, então o chip é montado por `createElement` — e o
 *  objeto de props sai numa variável porque `react/no-children-prop` reprova
 *  `children` escrito dentro de um literal na chamada. */
function chipDado(rotulo: string, valor: string) {
  const props: Parameters<typeof ChipDado>[0] = { rotulo, children: valor }
  return createElement(ChipDado, props)
}

describe("LinhaLista — slot de chips", () => {
  it("sem chips a linha não ganha nenhuma caixa nova — as ~120 linhas de hoje não mexem", () => {
    const saida = html({ titulo: "Motor BB", subtitulo: "482,3 h" })
    expect(saida).not.toContain("flex-wrap")
  })

  it("os chips entram na segunda linha do bloco do meio, não ao lado do valor", () => {
    const saida = html({
      titulo: "Saída para Angra",
      subtitulo: "Marina da Glória",
      chips: chipDado("No mar", "4 h 20 min"),
      valor: "12/08",
    })
    // O bloco do meio é o `min-w-0 flex-1`; a fila de chips tem que estar
    // DENTRO dele — se escapar, ela disputa largura com o valor da direita e
    // a linha volta a crescer em altura para caber tudo.
    const meio = saida.split('class="min-w-0 flex-1"')[1] ?? ""
    expect(meio).toContain("No mar")
    expect(meio.indexOf("No mar")).toBeLessThan(meio.indexOf("12/08"))
  })

  it("chips convivem com valor e subtítulo — é a carga da referência, não um substituto", () => {
    const saida = html({
      titulo: "Saída para Angra",
      subtitulo: "Marina da Glória",
      chips: chipDado("Trilha", "12,4 MN"),
      valor: "12/08",
    })
    expect(saida).toContain("Marina da Glória")
    expect(saida).toContain("12,4 MN")
    expect(saida).toContain("12/08")
  })
})

/**
 * ONDA 91 — o `chevron` era IGNORADO no ramo `href` + `trailing`: o `return`
 * antecipado montava o JSX sem consultar a prop. Uma linha que navega e traz
 * um `Selo` "Incompleto" à direita ficava sem a seta que diz que ela navega.
 */
describe("LinhaLista — chevron com trailing", () => {
  const SELO = createElement("span", { className: "selo-teste" }, "Incompleto")
  // O `Icone` sai como `<svg>` com o traçado dentro — o nome do ícone não
  // chega ao HTML, então o que se procura é o desenho do chevron
  // (`components/icone.tsx`). Se o traçado mudar lá, é aqui que se descobre.
  const SETA = 'd="m9 5 7 7-7 7"'

  it("o padrão não mudou: com trailing, a linha continua sem seta", () => {
    expect(html({ titulo: "CNH", href: "/x", trailing: SELO })).not.toContain(SETA)
  })

  it("`chevron` pedido explicitamente passa a valer nesse ramo", () => {
    expect(html({ titulo: "CNH", href: "/x", trailing: SELO, chevron: true })).toContain(SETA)
  })

  it("a seta fica DENTRO do link — enfeite não clicável apontaria para o alvo errado", () => {
    const saida = html({ titulo: "CNH", href: "/x", trailing: SELO, chevron: true })
    const link = saida.match(/<a [^>]*href="\/x"[\s\S]*?<\/a>/)?.[0] ?? ""
    expect(link).toContain(SETA)
    // E o `trailing`, que tem interação própria, continua fora do link.
    expect(link).not.toContain("selo-teste")
  })

  it("sem seta o link do miolo não vira flex — quem não pede não muda um byte", () => {
    expect(html({ titulo: "CNH", href: "/x", trailing: SELO })).toContain(
      'class="min-w-0 flex-1 transition-transform',
    )
  })

  it("`chevron: false` continua escondendo a seta na linha inteira clicável", () => {
    expect(html({ titulo: "CNH", href: "/x", chevron: false })).not.toContain(SETA)
  })
})

describe("LinhaLista — o cartão tem um padding só (achado 2.4)", () => {
  it("a variante cartão usa o mesmo `p-3` de `Cartao`, não os 14px de antes", () => {
    const saida = html({ titulo: "Alerta", variant: "cartao" })
    expect(saida).toContain("p-3")
    expect(saida).not.toContain("p-3.5")
  })
})

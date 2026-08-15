import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Abas } from "./abas"

/**
 * Mesmo padrão de `selo.test.ts`: `renderToStaticMarkup` sem jsdom, porque
 * `Abas` é uma função pura — o que precisa ser medido é o HTML que sai, não
 * comportamento de clique (isso é navegação do `<Link>`, testada pelo
 * próprio Next.js).
 */
const ABAS_TESTE = [
  { valor: "pendentes", rotulo: "Pendentes", href: "/avisos?aba=pendentes", contagem: 3 },
  { valor: "historico", rotulo: "Histórico", href: "/avisos?aba=historico" },
]

function html(ativa: string) {
  return renderToStaticMarkup(createElement(Abas, { abas: ABAS_TESTE, ativa }))
}

describe("Abas", () => {
  it("a aba ativa tem aria-current=page — as outras, não", () => {
    const saida = html("pendentes")
    const linkPendentes = saida.match(/<a[^>]*href="\/avisos\?aba=pendentes"[^>]*>/)?.[0] ?? ""
    const linkHistorico = saida.match(/<a[^>]*href="\/avisos\?aba=historico"[^>]*>/)?.[0] ?? ""
    expect(linkPendentes).toMatch(/aria-current="page"/)
    expect(linkHistorico).not.toMatch(/aria-current/)
  })

  it("toda aba é um link com o href dado — navegação por URL, não useState", () => {
    const saida = html("pendentes")
    expect(saida).toContain('href="/avisos?aba=pendentes"')
    expect(saida).toContain('href="/avisos?aba=historico"')
  })

  it("a contagem sai em fonte de instrumento — mono E tabular", () => {
    const saida = html("pendentes")
    // As duas classes, não só a mono: `tabular-nums` é o que alinha o dígito
    // em coluna; perder só ela passaria despercebido no olho.
    const span = saida.match(/<span class="([^"]*)">3<\/span>/)?.[1] ?? ""
    expect(span).toContain("font-mono-instr")
    expect(span).toContain("tabular-nums")
  })

  it("sem contagem, nenhum span de número aparece pra aquela aba", () => {
    const saida = html("pendentes")
    const linkHistorico = saida.match(/<a[^>]*href="\/avisos\?aba=historico"[^>]*>.*?<\/a>/)?.[0] ?? ""
    expect(linkHistorico).not.toContain("<span")
  })
})

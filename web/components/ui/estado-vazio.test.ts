import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EstadoVazio } from "./estado-vazio"

/**
 * ONDA 103 — O GRAU DENSO, E O QUE PRECISA FICAR TRANCADO NELE.
 *
 * O achado que gerou a onda, medido a 390px na `/hoje` do barco de teste: o
 * cartão "Gastos do mês" fechava em 244px e o "Tripulação" em 228px, e o bloco
 * vazio dentro deles respondia por 184px e 168px — quase 40% disso em `py-6`
 * mais o ícone de 24px em linha própria. Nenhum dos dois diz uma palavra a
 * mais que os cartões de 100px ao lado.
 *
 * O que este arquivo guarda não é a aparência do grau novo — é o CONTRATO em
 * volta dele, que tem três metades e todas já foram furadas antes nesta casa:
 *
 *   1. ADITIVO DE VERDADE. O componente serve 95 chamadas em ~76 telas e
 *      quase nenhuma dá para conferir numa rodada. `conforto` tem que sair
 *      byte a byte como saía — é a diferença entre consertar duas telas e
 *      mexer em setenta no escuro.
 *   2. ENCOLHER NÃO PODE VIRAR MUDEZ. O §6 de `docs/DESIGN.md` cobra três
 *      coisas do vazio: o que não existe, por que isso é normal, e a ação.
 *      Um grau "denso" que ganhasse altura calando a descrição passaria numa
 *      régua de pixel e reprovaria na régua que importa.
 *   3. NENHUM TAMANHO NOVO. A escala tem seis degraus e o espaçamento é base
 *      4; a maneira mais barata de estragar as duas é escrever um `0.5` num
 *      utilitário de margem meses depois, e ninguém percebe olhando.
 */
function html(props: Parameters<typeof EstadoVazio>[0]) {
  return renderToStaticMarkup(createElement(EstadoVazio, props))
}

/** As três frases que o §6 cobra, num vazio completo. */
const COMPLETO = {
  icone: "cifrao",
  titulo: "Nenhuma despesa paga este mês",
  descricao: "Vaga, combustível, manutenção — o que sai do bolso fica registrado aqui.",
  acao: { href: "/financeiro/novo?tipo=despesa", rotulo: "Registrar despesa" },
  variant: "linha",
} as const satisfies Parameters<typeof EstadoVazio>[0]

describe("EstadoVazio — o grau denso é aditivo", () => {
  it("sem `densidade`, a linha sai como sempre saiu: py-6 e coluna centralizada", () => {
    const saida = html(COMPLETO)
    expect(saida).toContain("py-6")
    expect(saida).toContain("text-center")
    // O ícone em linha própria, 24px, centrado — a anatomia das ~49 telas em
    // que o vazio É o corpo inteiro.
    expect(saida).toContain("mx-auto size-6")
  })

  it("`conforto` escrito à mão é exatamente o padrão — nenhum consumidor muda ao ser anotado", () => {
    expect(html({ ...COMPLETO, densidade: "conforto" })).toBe(html(COMPLETO))
  })

  it("o padrão do componente NÃO é o denso — quem não pediu não recebe", () => {
    expect(html(COMPLETO)).not.toBe(html({ ...COMPLETO, densidade: "denso" }))
    expect(html(COMPLETO)).not.toContain("py-1")
  })
})

describe("EstadoVazio — o que o denso corta, e o que ele não pode cortar", () => {
  it("corta os 48px de padding próprio: `py-6` vira `py-1`", () => {
    const saida = html({ ...COMPLETO, densidade: "denso" })
    expect(saida).toContain("py-1")
    expect(saida).not.toContain("py-6")
  })

  it("o ícone sai da linha própria e passa a dividir a linha do título, em size-4", () => {
    const saida = html({ ...COMPLETO, densidade: "denso" })
    expect(saida).toContain("size-4")
    expect(saida).not.toContain("size-6")
    expect(saida).not.toContain("text-center")
  })

  it("continua dizendo as TRÊS coisas — título, por que é normal, e a ação", () => {
    const saida = html({ ...COMPLETO, densidade: "denso" })
    expect(saida).toContain(COMPLETO.titulo)
    expect(saida).toContain("o que sai do bolso fica registrado aqui")
    expect(saida).toContain(COMPLETO.acao.rotulo)
    expect(saida).toContain(COMPLETO.acao.href.replace("?", "?"))
  })

  it("o denso não muda o que a tela DIZ — o texto dos dois graus é o mesmo", () => {
    const semTag = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    expect(semTag(html({ ...COMPLETO, densidade: "denso" }))).toBe(semTag(html(COMPLETO)))
  })

  it("vazio sem descrição e sem ação continua desenhando ícone e frase — não some", () => {
    // "Zero é uma resposta boa": um vazio que encolhesse até virar nada leria
    // como tela quebrada, que é o oposto do que o grau existe pra fazer.
    const saida = html({ icone: "pessoas", titulo: "Ninguém além de você ainda", variant: "linha", densidade: "denso" })
    expect(saida).toContain("Ninguém além de você ainda")
    expect(saida).toContain("<svg")
  })

  it("`variant=\"cartao\"` não perde a casca no denso — lá o vazio É o cartão", () => {
    const saida = html({ ...COMPLETO, variant: "cartao", densidade: "denso" })
    expect(saida).toContain("border-line")
    expect(saida).toContain("rounded-[var(--raio-cartao)]")
    expect(saida).toContain("p-3")
  })
})

describe("EstadoVazio — o denso não pode furar as réguas da casa", () => {
  const TODOS = [
    { ...COMPLETO, densidade: "denso" },
    { ...COMPLETO, densidade: "denso", enfase: "discreta" },
    { ...COMPLETO, densidade: "denso", variant: "cartao" },
    { ...COMPLETO, densidade: "conforto" },
  ] as const satisfies readonly Parameters<typeof EstadoVazio>[0][]

  it("o alvo de toque continua em 44px, pelo token — encolher não chega no dedo", () => {
    for (const props of TODOS) {
      const saida = html(props)
      expect(saida, JSON.stringify(props)).toContain("min-h-[var(--altura-controle)]")
      // O 44 nunca escrito como número: a régua tem token desde a onda 91.
      expect(saida, JSON.stringify(props)).not.toMatch(/min-h-\[?4[04]/)
    }
  })

  it("a ação veste as pílulas declaradas em lib/ui/acoes.ts — o denso não redesenha ação", () => {
    // 36px de DESENHO dentro do alvo de 44 (a separação que `acoes.ts`
    // documenta). Se um grau novo inventasse uma terceira pílula, o gesto
    // "aqui se age" passaria a ter três vestidos — a deriva do §6.6.
    const cheia = html({ ...COMPLETO, densidade: "denso" })
    const contorno = html({ ...COMPLETO, densidade: "denso", enfase: "discreta" })
    expect(cheia).toContain("bg-accent")
    expect(contorno).toContain("bg-panel2")
    for (const saida of [cheia, contorno]) expect(saida).toContain("h-9")
  })

  /**
   * A CATRACA DE ESPAÇAMENTO, e ela existe porque o furo é silencioso.
   * `mt-0.5` (2px) já mora em `Cartao` e `LinhaLista` e passaria despercebido
   * aqui — só que 2px não é degrau de base 4, e um grau que se chama "denso"
   * é justamente onde a tentação de raspar meio degrau aparece.
   */
  it("todo espaçamento sai da base 4 — nada de meio degrau, nada de pixel cravado", () => {
    const ESPACO = /^-?(?:[pm][xytblrse]?|gap(?:-[xy])?|space-[xy])-(.+)$/
    for (const props of TODOS) {
      for (const classe of html(props).matchAll(/class="([^"]*)"/g)) {
        for (const token of classe[1].split(/\s+/)) {
          const m = token.match(ESPACO)
          // `auto` não é degrau — é a centralização do grau `conforto`
          // (`mx-auto`), que não consome espaço nenhum da escala.
          if (!m || m[1] === "auto") continue
          expect(
            m[1],
            `${token} em ${JSON.stringify(props)} — espaçamento fora da base 4`,
          ).toMatch(/^\d+$/)
        }
      }
    }
  })

  it("as vozes continuam sendo as duas de sempre — nenhum degrau novo de tipografia", () => {
    for (const props of TODOS) {
      const saida = html(props)
      expect(saida, JSON.stringify(props)).toContain("corpo")
      expect(saida, JSON.stringify(props)).toContain("apoio")
      // 15 e 13 são os dois degraus que `docs/DESIGN.md` recusa por nome, e
      // `text-[…]px` cravado é como eles voltariam.
      expect(saida, JSON.stringify(props)).not.toMatch(/text-\[\d+px\]/)
    }
  })
})

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BotaoEnviar, enviandoPadrao } from "./botao-enviar"

function html(props: Parameters<typeof BotaoEnviar>[0]) {
  return renderToStaticMarkup(createElement(BotaoEnviar, props))
}

/**
 * O estado PENDENTE não tem teste de marcação aqui, e não é esquecimento:
 * `useFormStatus` devolve `pending: false` em render de servidor, então
 * `renderToStaticMarkup` nunca chega nele. O que dá para travar sem DOM é o
 * repouso (o que a pessoa vê em 99% do tempo) e o rótulo de envio, que é
 * função pura de propósito — ver `enviandoPadrao`.
 */
describe("BotaoEnviar", () => {
  it("em repouso mostra o rótulo normal, e nada de gerúndio vazado", () => {
    const saida = html({ rotulo: "Salvar dados" })
    expect(saida).toContain(">Salvar dados<")
    expect(saida).not.toContain("Salvando")
    // O ponto que pulsa só existe enquanto envia — em repouso o botão é o
    // botão de sempre, sem enfeite parado dentro dele.
    expect(saida).not.toContain("animate-pulse")
  })

  it("é sempre submit — botão de enviar que não envia é o pior dos mundos", () => {
    expect(html({ rotulo: "Entrar" })).toContain('type="submit"')
  })

  /**
   * A briga que `chip.tsx` já perdeu uma vez: seis alturas para o mesmo gesto.
   * Estes dois números são os que o app JÁ tinha (48px do botão do canvas,
   * 44px da única pílula). Se alguém acrescentar um terceiro, este teste cai —
   * que é o ponto.
   */
  it("usa as duas alturas que já existiam, ambas acima dos 44px de toque", () => {
    expect(html({ rotulo: "Salvar dados" })).toContain("h-12")
    expect(html({ rotulo: "Reenviar", variante: "contorno" })).toContain("h-11")
  })

  it("a largura é escolha da coluna, não do vestido", () => {
    // Coluna que cresce (o resto do app): o dourado para de esticar em `sm`.
    expect(html({ rotulo: "Salvar dados" })).toContain("sm:w-auto")
    // Coluna travada em 430px (as telas de `(auth)`): preenche sempre.
    expect(html({ rotulo: "Entrar", larguraCheia: true })).toContain("w-full")
    expect(html({ rotulo: "Entrar", larguraCheia: true })).not.toContain("sm:w-auto")
    // A pílula secundária é contida — largura é o que a faria competir com a
    // ação principal logo acima dela.
    expect(html({ rotulo: "Reenviar", variante: "contorno" })).not.toContain("w-full")
  })

  it("a variante principal é a única dourada, e a de contorno não usa tinta", () => {
    const principal = html({ rotulo: "Salvar dados" })
    expect(principal).toContain("bg-accent")
    const contorno = html({ rotulo: "Reenviar", variante: "contorno" })
    expect(contorno).not.toContain("bg-accent")
    expect(contorno).toContain("border-line")
  })
})

describe("enviandoPadrao", () => {
  it("conjuga o gerúndio das três conjugações e preserva o resto da frase", () => {
    expect(enviandoPadrao("Salvar dados")).toBe("Salvando dados…")
    expect(enviandoPadrao("Abrir ocorrência")).toBe("Abrindo ocorrência…")
    expect(enviandoPadrao("Entrar")).toBe("Entrando…")
    expect(enviandoPadrao("Criar conta")).toBe("Criando conta…")
    expect(enviandoPadrao("Registrar despesa")).toBe("Registrando despesa…")
  })

  it("todo rótulo de envio termina em reticências — é o sinal de 'aguarde'", () => {
    for (const r of ["Enviar link", "Reenviar", "Salvar senha", "Abrir ocorrência"]) {
      expect(enviandoPadrao(r)).toMatch(/…$/)
    }
  })

  it("rótulo que não começa por infinitivo cai no genérico, sem inventar palavra", () => {
    expect(enviandoPadrao("Vamos lá")).toBe("Enviando…")
    expect(enviandoPadrao("")).toBe("Enviando…")
  })
})

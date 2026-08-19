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
   * ONDA 91 — O FORMULÁRIO DE DOIS BOTÕES. Sem `name`/`value` no `<button>`,
   * a action não tem como saber qual dos dois foi tocado, e as telas de
   * moderação (`/admin/avaliacoes`, `/consultor/[id]`) ficavam sem aviso de
   * envio — justamente onde o duplo-toque grava uma decisão errada.
   */
  it("repassa name/value pro botão — é assim que a action sabe qual foi tocado", () => {
    const saida = html({ rotulo: "Ocultar por violação", name: "decisao", value: "ocultar" })
    expect(saida).toContain('name="decisao"')
    expect(saida).toContain('value="ocultar"')
  })

  it("sem name/value o botão sai limpo — os consumidores de hoje não mudam", () => {
    const saida = html({ rotulo: "Salvar dados" })
    expect(saida).not.toContain("name=")
    expect(saida).not.toContain("value=")
  })

  /**
   * A briga que `chip.tsx` já perdeu uma vez: seis alturas para o mesmo gesto.
   * Estes dois degraus são os que o app JÁ tinha (48px do botão do canvas,
   * 44px da única pílula) e que a onda 91 declarou como token — o teste passou
   * a cobrar o TOKEN e não o número, senão a régua volta a existir em dois
   * lugares. Se alguém acrescentar um terceiro, este teste cai, que é o ponto.
   */
  it("usa os dois degraus declarados de altura, ambos acima dos 44px de toque", () => {
    expect(html({ rotulo: "Salvar dados" })).toContain("h-[var(--altura-campo)]")
    expect(html({ rotulo: "Reenviar", variante: "contorno" })).toContain("h-[var(--altura-controle)]")
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

  /**
   * ONDA 91 — "Aprovar" um selo e "Reprovar" uma avaliação paga são as duas
   * gravações mais sérias do produto e ficavam sem aviso de envio, porque nem
   * o dourado nem o cinza serviam: dourado diria que a reprovação é a marca,
   * cinza diria que ela é secundária.
   */
  it("as variantes de estado usam o semáforo, nunca o acento da marca", () => {
    const aprovar = html({ rotulo: "Aprovar", variante: "ok" })
    const reprovar = html({ rotulo: "Reprovar", variante: "critico" })
    expect(aprovar).toContain("text-ok")
    expect(reprovar).toContain("text-crit")
    // Se gastassem dourado, gastariam o orçamento de dois por tela — e uma
    // reprovação não é a marca do Commander.
    expect(aprovar).not.toContain("accent")
    expect(reprovar).not.toContain("accent")
  })

  it("a cor acompanha, não substitui — a palavra continua dizendo o que acontece", () => {
    // DESIGN §6, regra 3: quem não distingue verde de vermelho lê o rótulo.
    expect(html({ rotulo: "Aprovar", variante: "ok" })).toContain(">Aprovar<")
    expect(html({ rotulo: "Reprovar", variante: "critico" })).toContain(">Reprovar<")
  })

  it("estado muda só a família de cor — a forma é a de contorno, letra por letra", () => {
    const contorno = html({ rotulo: "Decidir", variante: "contorno" })
    const ok = html({ rotulo: "Decidir", variante: "ok" })
    // Trocando as duas classes de cor, os dois HTML têm que ficar idênticos:
    // é isso que garante que uma ação de estado não abriu a sétima altura de
    // pílula do app.
    expect(ok.replace("border-ok/60 bg-panel text-ok", "border-line bg-panel2 text-texto")).toBe(contorno)
  })

  it("`--ok`/`--crit` moram sobre `bg-panel` — sobre `panel2` o claro reprova AA", () => {
    // Medido: no tema claro `--ok` sobre `--superficie-2` dá 4,43:1 e `--crit`
    // 4,26:1, os dois abaixo de 4,5:1; sobre `--superficie` sobem para 5,02:1
    // e 4,82:1.
    for (const variante of ["ok", "critico"] as const) {
      const saida = html({ rotulo: "Decidir", variante })
      expect(saida, variante).toContain("bg-panel")
      expect(saida, variante).not.toContain("bg-panel2")
    }
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

import { describe, expect, it } from "vitest"
import {
  temAcaoFlutuantePropria,
  ACAO_NAO_ESTICA,
  FOLGA_BASE,
  FOLGA_COM_ACAO_FLUTUANTE,
  GRADE_LADRILHOS,
  LARGURA_CONTEUDO,
  TETO_FORMULARIO,
  TETO_LISTA,
  TETO_PAINEL,
} from "./superficies"

// Até a onda 60 este arquivo testava também `mostrarRegistroRapido` e
// `ehTelaDeFormulario` — as regras de onde o FAB global "+ Registrar" podia
// aparecer. O FAB aposentou (a decisão e a história estão no cabeçalho de
// `superficies.ts`), então o que resta a governar é: qual tela tem ação
// flutuante própria, e quanta folga o conteúdo reserva embaixo.

describe("temAcaoFlutuantePropria", () => {
  it("reconhece a única tela com ação flutuante própria", () => {
    // /barco/resumos renderiza o BotaoExportarPdf no SLOT_ACAO_FLUTUANTE —
    // é ela que precisa da folga maior pra o fim da página não terminar
    // embaixo do botão.
    expect(temAcaoFlutuantePropria("/barco/resumos")).toBe(true)
  })

  it("nega no resto do app — sem o FAB global, nada mais flutua sobre o conteúdo", () => {
    for (const r of [
      "/hoje",
      "/barco",
      "/barco/itens/novo",
      "/barco/editar",
      "/diario",
      "/diario/abc/horas",
      "/financeiro",
      "/financeiro/lancamentos",
      "/marketplace",
      "/navegar",
      "/menu",
      "/menu/perfil",
      "/tripulacao",
    ]) {
      expect(temAcaoFlutuantePropria(r), r).toBe(false)
    }
  })

  it("ignora barra final, query e hash", () => {
    expect(temAcaoFlutuantePropria("/barco/resumos/")).toBe(true)
    expect(temAcaoFlutuantePropria("/barco/resumos?periodo=ano")).toBe(true)
    expect(temAcaoFlutuantePropria("/barco/resumos#gastos")).toBe(true)
  })
})

describe("folga inferior", () => {
  it("soma a safe-area em vez de assumir zero", () => {
    // lição da onda 54, que continua valendo: folga fixa fechava a conta no
    // navegador e deixava o botão de salvar coberto no iPhone com barra de
    // gestos (`viewportFit: "cover"` faz todo `fixed` subir a safe-area).
    expect(FOLGA_BASE).toContain("env(safe-area-inset-bottom)")
    expect(FOLGA_COM_ACAO_FLUTUANTE).toContain("env(safe-area-inset-bottom)")
  })

  it("reserva mais espaço só onde uma ação flutuante mora sobre o conteúdo", () => {
    // 4.75rem cobre a bottom-nav (a folga de toda tela); 9rem cobre também o
    // botão flutuante de /barco/resumos (topo a 128px + safe-area do rodapé).
    expect(FOLGA_BASE).toContain("4.75rem")
    expect(FOLGA_COM_ACAO_FLUTUANTE).toContain("9rem")
  })
})

describe("régua de larguras (onda 63)", () => {
  it("tem três degraus, do mais estreito ao mais largo", () => {
    // A ordem importa mais que os números: formulário/texto é o mais
    // estreito (linha de leitura), painel é o único que pode ocupar o
    // monitor. Se um dia alguém trocar os valores, a relação continua
    // sendo o que a régua promete.
    const px = (c: string) => Number(/max-w-\[(\d+)px\]/.exec(c)?.[1])
    expect(px(TETO_FORMULARIO)).toBeLessThan(px(TETO_LISTA))
    expect(px(TETO_LISTA)).toBeLessThan(px(TETO_PAINEL))
  })

  it("o teto de painel é o mesmo teto de casca — não uma segunda verdade", () => {
    // `LARGURA_CONTEUDO` repete o valor por exigência do Tailwind (ele varre
    // a classe literal). Este teste é o que impede as duas de divergirem.
    expect(LARGURA_CONTEUDO).toContain(TETO_PAINEL.replace("max-w-", "lg:max-w-"))
  })

  it("nenhum teto tem prefixo de breakpoint — o celular não pode mudar", () => {
    // A 390px o conteúdo mede ~358px, abaixo de qualquer um destes tetos.
    // Um `md:`/`lg:` aqui seria a porta pra alguém mexer no aparelho sem
    // perceber; sem prefixo, a classe é inerte no celular por construção.
    for (const teto of [TETO_FORMULARIO, TETO_LISTA, TETO_PAINEL]) {
      expect(teto, teto).not.toMatch(/(sm|md|lg|xl):/)
    }
  })

  it("botão e ladrilho só deixam de esticar a partir de `sm` (640px)", () => {
    // `sm` é 640px no Tailwind — acima da largura de qualquer celular. É o
    // que garante que o aparelho continue com o botão de linha inteira e a
    // grade de 2 colunas de sempre.
    expect(ACAO_NAO_ESTICA).toContain("w-full")
    expect(ACAO_NAO_ESTICA).toContain("sm:w-auto")
    expect(GRADE_LADRILHOS).toContain("grid-cols-2")
    expect(GRADE_LADRILHOS).toContain("sm:grid-cols-3")
  })
})

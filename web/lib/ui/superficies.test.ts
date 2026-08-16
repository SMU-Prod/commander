import { describe, expect, it } from "vitest"
import {
  temAcaoFlutuantePropria,
  FOLGA_BASE,
  FOLGA_COM_ACAO_FLUTUANTE,
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

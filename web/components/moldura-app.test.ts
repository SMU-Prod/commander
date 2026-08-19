import { describe, expect, it } from "vitest"
import { temEstadoDoBarco } from "./moldura-app"

/**
 * ONDA 102 — *"PARECE QUE NUNCA CONSEGUIMOS SAIR DA MANUTENÇÃO DO BARCO."*
 *
 * A frase é do dono, na spec `2026-08-19-arquitetura-quatro-apps.md` §5, e o
 * defeito que ela descreve é de NAVEGAÇÃO, não de desenho: o cabeçalho com
 * Motor BB, Motor BE e "Revisão em 250 horas" aparecia em Marketplace,
 * Explorar e Mensagens — áreas onde nenhuma dessas informações decide coisa
 * alguma. A regra que ele fixou é curta ("aparece em Início e Meu Barco") e
 * por isso mesmo fácil de furar sem perceber, à medida que rotas novas nascem.
 *
 * O teste é de função pura e roda no `npm test`, junto do resto — mesmo
 * espírito de `menu-destinos.test.ts`: a pergunta "esta rota mostra o estado
 * do barco?" se responde sem navegador e sem sessão, então ela é barrada antes
 * do commit, e não depois numa varredura visual.
 */
describe("temEstadoDoBarco", () => {
  it("Início mostra — é a tela de casa do barco", () => {
    expect(temEstadoDoBarco("/hoje")).toBe(true)
  })

  // ONDA 103 — "Meu Barco" virou duas rotas: o índice (`/meu-barco`, os treze
  // destinos que saíram do Menu) e a central técnica (`/barco`, os oito hubs).
  // As duas mostram o estado, porque nas duas ele decide alguma coisa.
  it("Meu Barco mostra — o índice e a central técnica —, e o que pendura nelas também", () => {
    expect(temEstadoDoBarco("/meu-barco")).toBe(true)
    expect(temEstadoDoBarco("/barco")).toBe(true)
    expect(temEstadoDoBarco("/barco/motores")).toBe(true)
    expect(temEstadoDoBarco("/barco/ocorrencias/abc-123")).toBe(true)
  })

  // As três áreas que o dono citou pelo nome, e o Diário — que é do barco mas
  // não é manutenção dele: quem registra uma saída não decide nada com a
  // revisão no topo.
  it("as áreas que o dono citou não mostram", () => {
    for (const rota of ["/marketplace", "/explorar", "/mensagens", "/diario", "/agenda", "/menu"]) {
      expect(temEstadoDoBarco(rota), rota).toBe(false)
    }
  })

  // A armadilha do `startsWith` sem a barra, que já mordeu o trilho lateral:
  // sem ela, qualquer rota que só COMECE com essas letras acenderia junto.
  // Hoje não existe `/barcos` nem `/hojeXYZ` — o teste guarda o dia em que
  // existir.
  it("prefixo não é a mesma coisa que rota: /barcos não é /barco", () => {
    expect(temEstadoDoBarco("/barcos")).toBe(false)
    expect(temEstadoDoBarco("/hoje-antigo")).toBe(false)
  })
})

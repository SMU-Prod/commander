import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { HUBS, hub, type Hub } from "./hubs"

/**
 * O GUARDIÃO DA REGRA DE ESCOPO DO §5.
 *
 * O guia diz *"cor do hub apenas no estado ativo ou no card daquele
 * sistema"* — ou seja, **a cor do hub X só aparece no hub X**. Enquanto a
 * amarração hub→classe vivia solta dentro de `app/(app)/barco/page.tsx`, essa
 * regra era uma intenção que dependia de alguém reler oito blocos quase
 * idênticos. Aqui ela vira medida: se uma entrada nomear o token de outra, o
 * `npm test` reprova.
 *
 * O caso que isto pega, e que revisão humana não pega: copiar o bloco do hub
 * de cima, trocar o `rotulo` e o `href`, e esquecer UMA das cinco classes.
 * Visualmente é um card com quatro canais certos e um errado — some no meio de
 * oito.
 */
const CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/globals.css"),
  "utf-8",
)

/** As cinco propriedades que carregam classe de cor. */
const CANAIS = ["tom", "borda", "halo", "filete", "anel"] as const satisfies readonly (keyof Hub)[]

describe("hubs", () => {
  it("são oito, e as chaves não se repetem", () => {
    expect(HUBS).toHaveLength(8)
    expect(new Set(HUBS.map((h) => h.chave)).size).toBe(8)
  })

  it.each(HUBS)("$chave só nomeia o próprio token de cor", (h) => {
    for (const canal of CANAIS) {
      const classe = h[canal] as string
      const nomeados = [...classe.matchAll(/hub-([a-z]+)/g)].map((m) => m[1])
      expect(
        nomeados.length,
        `O canal "${canal}" de ${h.chave} não nomeia token de hub nenhum: "${classe}"`,
      ).toBeGreaterThan(0)
      for (const nome of nomeados) {
        expect(
          nome,
          `O canal "${canal}" de ${h.chave} nomeia hub-${nome}. ` +
            `A cor do hub X só aparece no hub X (§5 do Guia de Design).`,
        ).toBe(h.chave)
      }
    }
  })

  it.each(HUBS)("$chave tem token declarado em globals.css nos dois temas", (h) => {
    // Duas ocorrências: uma no bloco `:root` (tema claro) e outra em
    // `[data-theme="dark"]`. Um hub declarado só num tema desapareceria no
    // outro — e o tema que abre é o escuro, então o buraco apareceria
    // justamente para quem NÃO mexeu em Aparência.
    const ocorrencias = [...CSS.matchAll(new RegExp(`--hub-${h.chave}:`, "g"))].length
    expect(
      ocorrencias,
      `--hub-${h.chave} aparece ${ocorrencias}× em globals.css; esperado ao menos 2 ` +
        `(tema claro e [data-theme="dark"]).`,
    ).toBeGreaterThanOrEqual(2)
  })

  it("nenhum token --hub-* do CSS ficou de fora da tabela", () => {
    // A direção que falta na asserção acima. Sem ela, alguém acrescenta um
    // nono token de hub no CSS, nenhuma tela o consome, e ele fica anos
    // respondendo "é assim que se faz" para quem procura no grep — o vício que
    // esta casa passou as ondas 87–95 apagando.
    const noCss = new Set([...CSS.matchAll(/--hub-([a-z]+):/g)].map((m) => m[1]))
    expect([...noCss].sort()).toEqual(HUBS.map((h) => h.chave).sort())
  })

  /**
   * ONDA 135 — O GUARDIÃO DESCE ATÉ AS TELAS. As oito páginas de hub agora
   * escrevem UMA classe de cor à mão: a `classeAtiva` das abas em pílula
   * (literal por obrigação do Tailwind — ver o cabeçalho de `hubs.ts`). É
   * exatamente o cenário do copia-e-cola: duplicar a tela de um hub pro
   * vizinho e esquecer de trocar `bg-hub-motores` deixaria a aba ativa da
   * Elétrica vestida de Motores — quatro canais certos e um errado, invisível
   * em revisão. Aqui vira medida: a página do hub X só pode nomear hub-X.
   */
  it.each(HUBS)("a tela de $chave só veste a própria cor de hub", (h) => {
    const fonte = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../app/(app)/barco/${h.chave}/page.tsx`),
      "utf-8",
    )
    const nomeados = [...fonte.matchAll(/hub-([a-z]+)/g)].map((m) => m[1])
    expect(
      nomeados.length,
      `app/(app)/barco/${h.chave}/page.tsx não nomeia token de hub nenhum — ` +
        `a aba ativa em pílula precisa da classe literal do próprio hub.`,
    ).toBeGreaterThan(0)
    for (const nome of nomeados) {
      expect(
        nome,
        `app/(app)/barco/${h.chave}/page.tsx nomeia hub-${nome}. ` +
          `A cor do hub X só aparece no hub X (§5 do Guia de Design).`,
      ).toBe(h.chave)
    }
  })

  it("hub() lança em chave desconhecida em vez de devolver nada", () => {
    // @ts-expect-error — é exatamente o erro de programação que o lançamento existe pra pegar.
    expect(() => hub("propulsao")).toThrow(/Hub desconhecido/)
    expect(hub("casco").rotulo).toBe("Casco")
  })
})

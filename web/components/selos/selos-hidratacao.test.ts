import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SeloGold } from "./selo-gold"
import { SeloVerified } from "./selo-verified"

/**
 * O ERRO DE HIDRATAÇÃO QUE NENHUM TESTE PEGAVA — 17 DAS 73 ROTAS.
 *
 * A varredura de 19/08 registrou "A tree hydrated but some attributes of the
 * server rendered HTML didn't match" em `/barco`, `/barco/selos*` e em TODO o
 * `/admin`, nas duas larguras, e a suíte estava verde o tempo inteiro. A causa
 * medida eram estes dois arquivos: os dois calculavam coordenada polar com
 * `Math.cos`/`Math.sin` e mandavam o double CRU pro atributo do SVG. O
 * ECMAScript não exige que essas duas funções sejam bit-idênticas entre
 * implementações — o Node do servidor emitia `translate(63.674192626285084,…)`
 * e o V8 do navegador calculava `63.67419262628509`. O React reporta e NÃO
 * conserta ("This won't be patched up").
 *
 * POR QUE ESTE TESTE OLHA A MARCAÇÃO E NÃO A FUNÇÃO. Testar
 * `arredondarCoordenada` isolada provaria que a régua funciona, não que os
 * selos a usam — e o defeito foi exatamente esse: a régua já existia em
 * `pontoNoArco` desde o primeiro instrumento, e os selos nasceram sem ela.
 * O que precisa ser verdade é uma propriedade do HTML QUE SAI DO SERVIDOR:
 * nenhum número serializado carrega dígito que possa divergir. Renderizar de
 * verdade é o que faz este teste falhar quando alguém escrever o próximo
 * `Math.sin` direto no atributo.
 */

/** Todo número que sai dentro de um atributo — `transform`, `x1`, `cx`, `d`… */
function numerosDaMarcacao(html: string): string[] {
  return [...html.matchAll(/-?\d+\.\d+/g)].map((m) => m[0])
}

/** Duas casas é a régua de `arredondarCoordenada`, e o motivo dela está lá:
 *  o viewBox é de 100 unidades e o maior tamanho de renderização é 160px, ou
 *  seja, o centésimo vale 0,016px. Três casas já não seriam desenho — seriam
 *  dígitos a mais perto do que diverge. */
const CASAS_MAXIMAS = 2

describe("selos não serializam float instável", () => {
  it.each([
    ["SeloVerified", createElement(SeloVerified, { size: 160 })],
    ["SeloGold", createElement(SeloGold, { size: 160 })],
    // A variante de convite muda cor e opacidade, não geometria — entra
    // porque é a que aparece na vitrine, e vitrine é rota pública.
    ["SeloGold convite", createElement(SeloGold, { size: 160, variant: "convite" as const })],
  ])("%s", (nome, elemento) => {
    const html = renderToStaticMarkup(elemento)
    const longos = numerosDaMarcacao(html).filter((n) => (n.split(".")[1] ?? "").length > CASAS_MAXIMAS)
    expect(
      longos,
      `${nome} serializou ${longos.length} número(s) com mais de ${CASAS_MAXIMAS} casas decimais. ` +
        `Quem calcula coordenada com Math.cos/Math.sin tem que passar por ` +
        `arredondarCoordenada (components/ui/instrumento.ts) — senão o servidor e o ` +
        `navegador podem divergir no último dígito e a rota inteira perde a hidratação. ` +
        `Amostra: ${longos.slice(0, 3).join(", ")}`,
    ).toEqual([])
  })

  it("e a renderização não ficou vazia por engano", () => {
    // Sanidade: se o componente devolvesse marcação vazia (import quebrado,
    // guarda de tipo), o teste acima passaria por vazio — que é o mesmo vício
    // que o teste de contraste tinha antes da onda 96.
    const html = renderToStaticMarkup(createElement(SeloGold, { size: 160 }))
    expect(numerosDaMarcacao(html).length).toBeGreaterThan(50)
  })
})

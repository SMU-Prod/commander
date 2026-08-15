import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * ONDA 57 — O TETO DE COR LITERAL.
 *
 * O que este teste mede: quantas cores estão escritas à mão em `.tsx`, em vez
 * de virem dos tokens de `app/globals.css`. É a medida exata da deriva que
 * fez o app parecer inconsistente — o mesmo azul-marinho aparecia como
 * `#0B1D2D`, `#0b1d2d` e `bg-panel` em três telas vizinhas, e mudar o tema
 * escuro corrigia só a terceira.
 *
 * Por que Vitest e não Playwright: isto é leitura de arquivo, não precisa de
 * navegador. Assim roda no `npm test` (e no pre-commit) junto com o resto,
 * que é onde a deriva precisa ser barrada — barrar depois, na varredura,
 * seria barrar quando o commit já existe.
 *
 * O TETO SÓ DESCE. Ele não trava a fundação (as 91 de hoje continuam onde
 * estão, e várias têm motivo — ver "o que conta" abaixo); ele impede que a
 * conta cresça enquanto as telas herdadas não são refeitas. Quando chegar a
 * zero, troque o teto por 0 e apague este comentário.
 */
const TETO = 91

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

/**
 * O QUE CONTA COMO COR LITERAL — e por que não há exceção nenhuma.
 *
 * Conta todo `#` seguido de 3 a 8 dígitos hexadecimais em todo arquivo
 * `.tsx` de `app/` e `components/`, recursivamente. Sem exceção por pasta,
 * por tipo de arquivo, por contexto ou por comentário. As três decisões que
 * isso embute:
 *
 * 1. `{3,8}` e não `{6}`: um teto que só conhece `#rrggbb` tem porta dos
 *    fundos — `#fff` e `#0b1d2dcc` são a mesma deriva escrita diferente e
 *    passariam batido. Hoje o app não usa nenhuma das duas grafias (medido:
 *    91 ocorrências, todas de 6 dígitos), e é justamente por isso que a
 *    porta se fecha agora, antes de alguém entrar por ela.
 *
 * 2. CONTA TAMBÉM O QUE ESTÁ EM COMENTÁRIO. Não é descuido. Filtrar
 *    comentário exige recortar `//` e barra-asterisco com regex, e regex não
 *    sabe a diferença entre um comentário e um `//` dentro de uma string (uma
 *    URL, por exemplo) — o filtro passaria a comer trecho de código real e
 *    abriria um esconderijo. Entre errar contando a mais (uma menção em
 *    comentário empurra o número pra cima) e errar contando a menos (uma cor
 *    real some da conta), este teste erra sempre pra cima: teto que
 *    subestima não impede deriva nenhuma.
 *
 * 3. NÃO HÁ EXCEÇÃO PARA "COR QUE VEM DE DADO". A pergunta é legítima — um
 *    `#rrggbb` que chega do banco (cor de gráfico, cor escolhida pela pessoa)
 *    não é deriva de design e não deveria pesar no teto. Só que hoje não
 *    existe nenhum: as 91 ocorrências foram lidas uma a uma e todas são cor
 *    escrita à mão (paint de camada Mapbox, `<stop>` de gradiente SVG,
 *    `accent-[#d4af37]` em checkbox, `bg-[#0B1D2D]` em className). Escrever
 *    hoje uma exceção sem nenhum caso real seria escrever exatamente o tipo
 *    de folga que este teste existe pra evitar. Se um dia aparecer cor vinda
 *    de dado, ela não é literal em `.tsx` de qualquer forma: chega numa
 *    variável, num `style={{ color: registro.cor }}` — e não casa com este
 *    padrão. O único caso que casaria é um valor de banco COPIADO pra dentro
 *    do JSX, e esse é deriva mesmo.
 *
 * O escopo é `.tsx` porque é onde a interface mora. Os `#rrggbb` que
 * sobrevivem em `.ts` (`lib/mapa/pino-parceiro.ts`, `app/manifest.ts`) são
 * lugares onde não existe CSS pra consumir token — Mapbox e manifesto de PWA
 * pedem string de cor. Mover um literal de `.tsx` pra um `.ts` só pra fugir
 * do teto seria óbvio na revisão, e continua sendo pior do que usar o token.
 */
const COR_LITERAL = /#[0-9a-fA-F]{3,8}\b/g

/** As duas pastas onde a interface mora. */
const PASTAS = ["app", "components"]

/**
 * Caminhada recursiva à mão em vez de `fs.globSync`: o runtime é Node 22 e
 * teria a função, mas os tipos do projeto são `@types/node@20` e o `tsc
 * --noEmit` da verificação reprova (`has no exported member 'globSync'`).
 * Dez linhas tipadas valem mais que um `as any` no teste que existe pra
 * segurar disciplina.
 */
function varrerTsx(dir: string, achados: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) varrerTsx(completo, achados)
    else if (entrada.name.endsWith(".tsx")) achados.push(completo)
  }
  return achados
}

function contarPorArquivo(): Map<string, number> {
  const porArquivo = new Map<string, number>()
  for (const pasta of PASTAS) {
    for (const completo of varrerTsx(path.join(RAIZ, pasta))) {
      const achados = readFileSync(completo, "utf-8").match(COR_LITERAL)
      if (achados?.length) {
        porArquivo.set(path.relative(RAIZ, completo).replace(/\\/g, "/"), achados.length)
      }
    }
  }
  return porArquivo
}

function total(porArquivo: Map<string, number>): number {
  return [...porArquivo.values()].reduce((soma, n) => soma + n, 0)
}

/** As piores primeiro — a mensagem de falha precisa dizer ONDE olhar. */
function ranking(porArquivo: Map<string, number>): string {
  return [...porArquivo]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([arquivo, n]) => `  ${String(n).padStart(3)}  ${arquivo}`)
    .join("\n")
}

describe("tokens", () => {
  it("cor literal em .tsx nao aumenta", () => {
    const porArquivo = contarPorArquivo()
    // Sanidade: se a caminhada não achar arquivo nenhum — pasta renomeada,
    // `RAIZ` resolvida errada — a soma daria zero e o teto passaria por
    // vazio, virando decoração. Um teste de disciplina que passa sem ler
    // nada é pior que teste nenhum, porque dá a sensação de estar coberto.
    expect(porArquivo.size).toBeGreaterThan(0)

    expect(
      total(porArquivo),
      `Cor literal em .tsx passou do teto (${TETO}).\n` +
        `Use um token de app/globals.css (bg-panel, text-dim, text-accent...) ` +
        `em vez de escrever o hexadecimal.\n` +
        `Arquivos com mais ocorrências:\n${ranking(porArquivo)}`,
    ).toBeLessThanOrEqual(TETO)
  })

  /**
   * A CATRACA. Sem ela o `<=` acima deixa a folga se acumular em silêncio:
   * a onda que apaga dez literais devolve dez de crédito pra próxima que
   * quiser escrever dez. Isso é a deriva voltando pela porta da frente, com
   * o teste verde. Aqui o número só desce e FICA descido.
   *
   * O preço é uma linha a mudar quando alguém apaga uma cor — e a mensagem
   * abaixo já diz qual número escrever. É barato pelo que compra.
   */
  it("o teto acompanha a queda (catraca)", () => {
    const atual = total(contarPorArquivo())
    expect(
      atual,
      `Sobraram ${atual} cores literais, menos que o teto (${TETO}). ` +
        `Ótimo — agora baixe TETO para ${atual} neste arquivo, senão a folga ` +
        `de ${TETO - atual} vira crédito pra próxima cor escrita à mão.`,
    ).toBeGreaterThanOrEqual(TETO)
  })
})

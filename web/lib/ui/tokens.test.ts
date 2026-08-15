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
 * zero, apague o mapa abaixo e este comentário.
 *
 * O TETO É POR ARQUIVO, E NÃO A SOMA (revisão da onda 57). Enquanto ele era
 * um número só — 91 — apagar três literais num arquivo e escrever três em
 * outro passava nos dois testes: a soma não mudava, e a deriva entrava pela
 * porta da frente com o teste verde. É exatamente a folga que o comentário
 * da catraca, lá embaixo, diz querer fechar. `ranking()` já produzia o número
 * por arquivo pra mensagem de erro; agora é ele que está travado.
 *
 * COMO MEXER NESTE MAPA: baixando um número (apagou literal) ou apagando uma
 * linha (o arquivo zerou). Subir um número ou acrescentar uma linha é
 * escrever cor à mão — se for realmente inevitável, escreva o porquê no
 * commit, porque a linha vai ficar aqui até alguém apagá-la.
 */
const TETO_POR_ARQUIVO: Record<string, number> = {
  "components/mapa/navegar-mapa.tsx": 11,
  "components/card-embarcacao.tsx": 10,
  "components/mapa/mapa-nautico.tsx": 10,
  "components/selos/selo-verified.tsx": 9,
  "app/(app)/barco/equipamento/[id]/page.tsx": 8,
  "components/mapa/trilha-mapa.tsx": 7,
  "components/explorar/cards-parceiros.tsx": 4,
  "components/mapa/planejar-viagem-mapa.tsx": 4,
  "components/mapa/ver-viagem-mapa.tsx": 4,
  "components/selos/selo-gold.tsx": 4,
  "app/opengraph-image.tsx": 3,
  "app/(app)/carteira/[id]/page.tsx": 2,
  "app/(app)/menu/tripulacao/[id]/page.tsx": 2,
  "components/landing/mock-telas.tsx": 2,
  "components/mapa/card-parceiro.tsx": 2,
  "app/(app)/carteira/nova/page.tsx": 1,
  "app/(app)/explorar/[id]/page.tsx": 1,
  "app/(app)/financeiro/lancamentos/[id]/page.tsx": 1,
  "app/(app)/financeiro/novo/page.tsx": 1,
  "app/(app)/marketplace/[id]/page.tsx": 1,
  "app/layout.tsx": 1,
  "components/logo.tsx": 1,
  "components/mapa/escolher-pino-parceiro.tsx": 1,
  "components/perfil-profissional-form.tsx": 1,
}

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

/** Todo arquivo que aparece na conta OU no mapa, sem repetir. */
function arquivosConhecidos(porArquivo: Map<string, number>): string[] {
  return [...new Set([...porArquivo.keys(), ...Object.keys(TETO_POR_ARQUIVO)])].sort()
}

describe("tokens", () => {
  // Sanidade: se a caminhada não achar arquivo nenhum — pasta renomeada,
  // `RAIZ` resolvida errada — tudo daria zero e os dois testes abaixo
  // passariam por vazio, virando decoração. Um teste de disciplina que passa
  // sem ler nada é pior que teste nenhum, porque dá a sensação de estar
  // coberto.
  it("a varredura encontra os .tsx do app", () => {
    expect(contarPorArquivo().size).toBeGreaterThan(0)
  })

  it("nenhum arquivo escreve mais cor a mao do que ja escrevia", () => {
    const porArquivo = contarPorArquivo()
    const piores: string[] = []
    for (const arquivo of arquivosConhecidos(porArquivo)) {
      const atual = porArquivo.get(arquivo) ?? 0
      const teto = TETO_POR_ARQUIVO[arquivo] ?? 0
      if (atual > teto) piores.push(`  ${arquivo}: ${teto} → ${atual}`)
    }
    expect(
      piores,
      `Cor literal escrita à mão aumentou.\n` +
        `Use um token de app/globals.css (bg-panel, text-dim, text-accent...) ` +
        `em vez do hexadecimal. Se o arquivo não está no mapa, o teto dele é 0 ` +
        `— arquivo novo já nasce sem direito a cor literal.\n${piores.join("\n")}`,
    ).toEqual([])
  })

  /**
   * A CATRACA — agora por arquivo, e é a diferença que importa.
   *
   * Com o teto na SOMA, apagar três literais aqui e escrever três ali passava
   * nos dois testes: o total não mexia. Travado por arquivo, cada lado é
   * cobrado de um jeito — o que ganhou cor reprova no teste de cima, o que
   * perdeu reprova aqui até alguém baixar a linha dele no mapa.
   *
   * O preço é uma linha a mudar quando alguém apaga uma cor — e a mensagem
   * abaixo já diz qual número escrever. É barato pelo que compra.
   */
  it("o teto de cada arquivo acompanha a queda (catraca)", () => {
    const porArquivo = contarPorArquivo()
    const folgas: string[] = []
    for (const [arquivo, teto] of Object.entries(TETO_POR_ARQUIVO)) {
      const atual = porArquivo.get(arquivo) ?? 0
      if (atual < teto) {
        folgas.push(
          atual === 0
            ? `  ${arquivo}: zerou — apague a linha do mapa`
            : `  ${arquivo}: ${teto} → ${atual} (baixe o teto para ${atual})`,
        )
      }
    }
    expect(
      folgas,
      `Ótimo, sobrou menos cor literal do que o mapa registra — agora ajuste ` +
        `TETO_POR_ARQUIVO, senão a folga vira crédito pra próxima cor escrita ` +
        `à mão:\n${folgas.join("\n")}`,
    ).toEqual([])
  })
})

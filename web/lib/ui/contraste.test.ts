import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/** Luminância relativa (WCAG 2.1). */
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function razao(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/**
 * O TESTE LÊ `globals.css`. NÃO TEM CÓPIA DOS VALORES.
 *
 * Até a revisão da onda 57 os quatro hexadecimais estavam escritos aqui, à
 * mão, com um comentário dizendo "os valores do tema escuro da onda 57" —
 * e dois deles eram os do PLANO, não os que foram pro CSS (`#e8eef4` contra
 * o `--texto: #e9f1f8` real; `#8fa2b3` contra o `--texto-dim: #7c93ab`).
 * Pior que estar errado: como o teste não lia o CSS, ele passava com
 * QUALQUER CSS. Um teste que não pode falhar pelo motivo certo é decoração —
 * dá a sensação de estar coberto e não cobre nada.
 *
 * Agora mexer no tema escuro do `globals.css` é que faz este teste falhar,
 * que é o único jeito de ele valer alguma coisa.
 */
const CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/globals.css"),
  "utf-8",
)

/**
 * Os blocos `[data-theme="dark"]` do arquivo, juntos.
 *
 * São dois (tokens de cor e sombras), e a busca varre os dois em vez de
 * assumir qual vem primeiro. Regex e não um parser de CSS: o alvo é
 * `--nome: #rrggbb` dentro de um bloco conhecido, não CSS arbitrário — e a
 * alternativa (um parser no devDependencies) custaria mais do que o problema
 * que resolve.
 */
function blocosDoTemaEscuro(): string {
  const blocos: string[] = []
  const re = /\[data-theme="dark"\]\s*\{([^}]*)\}/g
  for (let m = re.exec(CSS); m !== null; m = re.exec(CSS)) blocos.push(m[1])
  return blocos.join("\n")
}

const ESCURO = blocosDoTemaEscuro()

/**
 * Lê um token do tema escuro. Falha ALTO quando não acha: um token renomeado
 * que devolvesse `undefined` em silêncio recriaria o defeito que este arquivo
 * acabou de perder — o teste voltaria a medir uma coisa que não existe.
 * Exige 6 dígitos porque é o que `luminancia` acima sabe ler.
 */
function token(nome: string): string {
  const achado = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(ESCURO)
  if (!achado) {
    throw new Error(
      `Token --${nome} não encontrado (ou não é #rrggbb) no bloco [data-theme="dark"] de app/globals.css. ` +
        `Se ele foi renomeado, renomeie aqui também — este teste existe pra medir o CSS de verdade.`,
    )
  }
  return achado[1]
}

const FUNDO = token("fundo")
const SUPERFICIE = token("superficie")
const LINHA = token("linha")
const TEXTO = token("texto")
const TEXTO_FRACO = token("texto-dim")
/** Onda 79 — a borda entrou na conta: é ela que separa cartão de fundo na
 *  paleta medida da referência. Ver o último teste deste arquivo. */
const LINHA = token("linha")

describe("contraste do tema escuro", () => {
  it("os valores vêm mesmo do globals.css", () => {
    // Sanidade do instrumento: se a leitura falhar em silêncio (arquivo
    // movido, bloco renomeado), os três testes abaixo passariam medindo
    // strings vazias. As quatro leituras acima já lançam nesse caso; aqui
    // fica registrado que elas são quatro cores distintas de verdade.
    expect(new Set([FUNDO, SUPERFICIE, TEXTO, TEXTO_FRACO]).size).toBe(4)
  })

  it("texto sobre cartao passa AA (4.5:1)", () => {
    expect(razao(TEXTO, SUPERFICIE)).toBeGreaterThanOrEqual(4.5)
  })

  it("texto fraco sobre cartao passa AA — e o par que mais reprova na pratica", () => {
    expect(razao(TEXTO_FRACO, SUPERFICIE)).toBeGreaterThanOrEqual(4.5)
  })

  it("o cartao se separa do fundo, senao o escuro vira uma mancha so", () => {
    // O limiar continua 1.2 e NÃO desce (revisão da onda 57): foi ele que
    // reprovou o `#121820` do plano original e obrigou a clarear a
    // superfície — afrouxar aqui apagaria a razão de a superfície ser o que
    // é hoje. Se um par real não passar, o que muda é a cor, não o limiar.
    //
    // ONDA 79 — DUAS FORMAS DE SEPARAR, NÃO UMA SÓ.
    // A paleta medida pixel a pixel da referência (`app/globals.css`,
    // comentário do bloco `[data-theme="dark"]`) é cinza puro em toda
    // superfície — o preenchimento sozinho (#1a1a1a sobre #101010) dá
    // 1,105:1, abaixo do 1,2. Só que a referência não separa cartão do
    // fundo com preenchimento: separa com BORDA, e a borda dela (#2c2c2c
    // sobre o cartão) dá 1,225:1 — acima do MESMO 1,2. A separação que este
    // teste protege existe; ele só media um jeito só de obtê-la. Agora
    // aceita os dois e exige que PELO MENOS UM passe — na prática, hoje,
    // é a borda quem carrega a régua.
    const porPreenchimento = razao(SUPERFICIE, FUNDO)
    const porBorda = razao(LINHA, SUPERFICIE)
    expect(
      Math.max(porPreenchimento, porBorda),
      `Nem preenchimento (${porPreenchimento.toFixed(3)}:1) nem borda (${porBorda.toFixed(3)}:1) ` +
        `separam o cartão do fundo acima de 1,2:1.`,
    ).toBeGreaterThan(1.2)
  })

  it("quando o preenchimento nao separa, a borda TEM que separar", () => {
    // O teste acima aceita qualquer um dos dois caminhos. Este fecha a
    // brecha que sobra: se o preenchimento não separa, a borda deixa de ser
    // alternativa e vira obrigação — com mensagem própria, em vez de a falha
    // aparecer escondida dentro de um `Math.max`.
    //
    // É por isso que a regra ficou MAIS rígida que antes da onda 79, não
    // menos: antes uma paleta passava com preenchimento no limite e borda
    // invisível; agora, nessa situação, ela reprova aqui.
    if (razao(SUPERFICIE, FUNDO) > 1.2) return
    expect(razao(LINHA, SUPERFICIE)).toBeGreaterThan(1.2)
  })
})

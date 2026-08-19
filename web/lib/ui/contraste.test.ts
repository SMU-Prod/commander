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

/** O mínimo AA para texto normal. Não desce — se um par não passa, o que muda
 *  é a cor, não a régua (mesmo compromisso do limiar de separação lá embaixo). */
const AA = 4.5

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
 * Agora mexer no `globals.css` é que faz este teste falhar, que é o único
 * jeito de ele valer alguma coisa.
 *
 * ONDA 96 — E MEDIR 4 PARES DE UM TEMA SÓ TAMBÉM É DECORAÇÃO.
 * A auditoria de 19/08 (achado 5.1) achou o acento do tema CLARO em 2,10:1
 * sobre cartão — menos da metade do mínimo — e este arquivo estava VERDE
 * enquanto isso. Não por engano de conta: ele media quatro pares, e só no
 * tema escuro (`describe("contraste do tema escuro")`). O tema que a régua
 * reprovava era o que o teste não abria.
 *
 * Um teste de contraste que escolhe os pares que mede não mede contraste;
 * mede os pares que alguém lembrou de escrever. Agora a tabela é a mesma
 * para os DOIS temas e cobre as vozes que a tela realmente usa — texto,
 * texto fraco, os quatro semânticos, o dado, o acento nos dois sentidos
 * (acento como TEXTO sobre os três chões, e o texto do botão cheio SOBRE o
 * acento) e o cartucho de instrumento. Acrescentar um token de cor novo sem
 * acrescentar linha aqui volta a abrir o buraco: a régua é a tabela.
 */
const CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../app/globals.css"),
  "utf-8",
)

/**
 * Os blocos de um seletor, juntos.
 *
 * Junta em vez de assumir qual vem primeiro: o tema claro mora em VÁRIOS
 * `:root` (tokens, pilha de fonte, lustro, sombra, navy do mapa) e o escuro
 * em dois. Regex e não um parser de CSS: o alvo é `--nome: <cor>` dentro de
 * um bloco conhecido, não CSS arbitrário — e nenhum destes blocos tem chave
 * aninhada, que é a única coisa que quebraria `[^}]*`.
 */
function blocosDe(seletor: string): string {
  const blocos: string[] = []
  const re = new RegExp(`${seletor}\\s*\\{([^}]*)\\}`, "g")
  for (let m = re.exec(CSS); m !== null; m = re.exec(CSS)) blocos.push(m[1])
  return blocos.join("\n")
}

/**
 * Lê um token e devolve `#rrggbb`. Aceita as duas grafias que o arquivo usa:
 * hexadecimal e `rgb(r g b / a)` — esta última porque o navy do instrumento
 * (`--mapa-instrumento`) é declarado com alfa, e copiar o hexadecimal dele
 * pra cá recriaria exatamente o defeito que o cabeçalho acima descreve.
 * O alfa é IGNORADO de propósito: .95 sobre um mapa é, pra efeito de leitura,
 * o navy — e ignorá-lo mede o caso mais claro (o pior), não o mais escuro.
 *
 * Falha ALTO quando não acha: um token renomeado que devolvesse `undefined`
 * em silêncio faria a tabela inteira medir string vazia.
 */
function token(bloco: string, nome: string, onde: string): string {
  const hex = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(bloco)
  if (hex) return hex[1]
  const rgb = new RegExp(`--${nome}:\\s*rgba?\\(\\s*(\\d+)[\\s,]+(\\d+)[\\s,]+(\\d+)`).exec(bloco)
  if (rgb) {
    return `#${[1, 2, 3].map((i) => Number(rgb[i]).toString(16).padStart(2, "0")).join("")}`
  }
  throw new Error(
    `Token --${nome} não encontrado (ou não é #rrggbb / rgb()) no bloco ${onde} de app/globals.css. ` +
      `Se ele foi renomeado, renomeie aqui também — este teste existe pra medir o CSS de verdade.`,
  )
}

/** O bloco que dá paleta própria a quem tem chão próprio: o cartucho do
 *  horímetro e os cartões flutuantes de /navegar são navy fixo nos DOIS temas,
 *  então as cores do tema claro (calibradas pra ler sobre branco) ficariam
 *  escuro-sobre-escuro lá dentro. Ver o comentário do bloco no CSS. */
const INSTRUMENTO = blocosDe("\\.bg-meter, \\.bg-mapa-instrumento")

type Par = readonly [rotulo: string, frente: string, fundo: string]

/**
 * A TABELA. Uma função, dois temas — é o que impede um tema de ganhar
 * cobertura que o outro não tem, que foi como o defeito de 19/08 passou.
 */
function paresDoTema(nomeTema: string, bloco: string): Par[] {
  const t = (nome: string) => token(bloco, nome, nomeTema)
  const cartao = t("superficie")
  const pagina = t("fundo")
  // `--superficie-2` é o chão de chip, pílula recolhida e badge. Entra na
  // tabela porque é o mais CLARO dos três no tema claro: é ele que reprova
  // primeiro, e era ele que ninguém media — o `--acao-forte` de antes passava
  // sobre cartão (4,90) e reprovava aqui (4,33).
  const chip = t("superficie-2")
  const acao = t("acao")
  const acaoForte = t("acao-forte")
  const acaoTexto = t("acao-texto")
  const cartucho = t("meter")

  return [
    ["texto sobre cartão", t("texto"), cartao],
    ["texto sobre página", t("texto"), pagina],
    ["texto fraco sobre cartão — o par que mais reprova na prática", t("texto-dim"), cartao],
    ["texto fraco sobre página", t("texto-dim"), pagina],
    ["texto fraco de chip sobre a superfície de chip", t("texto-dim-chip"), chip],

    // O ACENTO, NOS DOIS SENTIDOS. Um token de acento serve a dois papéis que
    // se contradizem num chão claro — ler COMO texto e servir DE fundo — e
    // medir só um dos dois é o que deixou o tema claro entregar 2,10:1 em
    // texto enquanto o botão cheio ia bem, obrigado.
    ["acento como TEXTO sobre cartão", acao, cartao],
    ["acento como TEXTO sobre página", acao, pagina],
    ["acento como TEXTO sobre a superfície de chip", acao, chip],
    ["acento forte como TEXTO sobre cartão", acaoForte, cartao],
    ["acento forte como TEXTO sobre página", acaoForte, pagina],
    ["acento forte como TEXTO sobre a superfície de chip", acaoForte, chip],
    ["texto do botão cheio SOBRE o acento", acaoTexto, acao],
    ["texto do botão cheio SOBRE o acento forte", acaoTexto, acaoForte],

    // Estado e dado. A auditoria recalculou estes à mão e passavam; ficam
    // aqui pra não voltarem a depender de alguém recalcular à mão.
    ["ok sobre cartão", t("ok"), cartao],
    ["atenção sobre cartão", t("warn"), cartao],
    ["crítico sobre cartão", t("crit"), cartao],
    ["dado sobre cartão", t("dado"), cartao],

    // O cartucho de instrumento com as cores do PRÓPRIO tema (horímetro).
    ["texto de instrumento sobre o cartucho", t("meter-texto"), cartucho],
    ["texto fraco de instrumento sobre o cartucho", t("meter-dim"), cartucho],
  ]
}

/**
 * Os pares do instrumento: paleta do bloco `.bg-meter`, chão navy.
 *
 * Vale nos dois temas porque o bloco não é de tema nenhum — mas o CHÃO muda
 * (`--meter` é navy no claro e quase-preto no escuro), então cada tema mede o
 * seu. O navy translúcido dos cartões de /navegar entra separado: ele é fixo
 * e é o mais claro dos dois chãos, ou seja, o caso que reprova primeiro.
 */
function paresDoInstrumento(nomeTema: string, bloco: string): Par[] {
  const i = (nome: string) => token(INSTRUMENTO, nome, ".bg-meter/.bg-mapa-instrumento")
  const cartucho = token(bloco, "meter", nomeTema)
  const navyDoMapa = token(blocosDe(":root"), "mapa-instrumento", ":root")
  const pares: Par[] = []
  for (const [rotulo, chao] of [["cartucho", cartucho], ["cartão flutuante do mapa", navyDoMapa]] as const) {
    pares.push(
      [`acento do instrumento sobre o ${rotulo}`, i("acao"), chao],
      [`acento forte do instrumento sobre o ${rotulo}`, i("acao-forte"), chao],
      [`texto do botão cheio SOBRE o acento do instrumento`, i("acao-texto"), i("acao")],
      [`ok do instrumento sobre o ${rotulo}`, i("ok"), chao],
      [`atenção do instrumento sobre o ${rotulo}`, i("warn"), chao],
      [`crítico do instrumento sobre o ${rotulo}`, i("crit"), chao],
    )
  }
  return pares
}

const TEMAS: Record<string, string> = {
  claro: blocosDe(":root"),
  escuro: blocosDe('\\[data-theme="dark"\\]'),
}

describe.each(Object.entries(TEMAS))("contraste do tema %s", (nomeTema, bloco) => {
  it("os valores vêm mesmo do globals.css", () => {
    // Sanidade do instrumento: se a leitura falhar em silêncio (arquivo
    // movido, bloco renomeado), a tabela inteira passaria medindo strings
    // vazias. `token()` já lança nesse caso; aqui fica registrado que o bloco
    // deste tema tem cores distintas de verdade, e não o mesmo hexadecimal
    // repetido por um regex que casou com o bloco errado.
    const t = (n: string) => token(bloco, n, nomeTema)
    expect(new Set([t("fundo"), t("superficie"), t("texto"), t("texto-dim")]).size).toBe(4)
  })

  it.each(paresDoTema(nomeTema, bloco))("%s passa AA", (rotulo, frente, fundo) => {
    const r = razao(frente, fundo)
    expect(r, `${rotulo}: ${frente} sobre ${fundo} dá ${r.toFixed(2)}:1 (mínimo ${AA}:1)`).toBeGreaterThanOrEqual(AA)
  })

  it.each(paresDoInstrumento(nomeTema, bloco))("%s passa AA", (rotulo, frente, fundo) => {
    const r = razao(frente, fundo)
    expect(r, `${rotulo}: ${frente} sobre ${fundo} dá ${r.toFixed(2)}:1 (mínimo ${AA}:1)`).toBeGreaterThanOrEqual(AA)
  })

  it("o cartão se separa do fundo, senão o tema vira uma mancha só", () => {
    // O limiar continua 1.2 e NÃO desce (revisão da onda 57): foi ele que
    // reprovou o `#121820` do plano original e obrigou a clarear a
    // superfície — afrouxar aqui apagaria a razão de a superfície ser o que
    // é hoje. Se um par real não passar, o que muda é a cor, não o limiar.
    //
    // ONDA 79 — DUAS FORMAS DE SEPARAR, NÃO UMA SÓ.
    // A paleta medida pixel a pixel da referência é cinza puro em toda
    // superfície — o preenchimento sozinho (#1a1a1a sobre #101010) dá
    // 1,105:1, abaixo do 1,2. Só que a referência não separa cartão do
    // fundo com preenchimento: separa com BORDA, e a borda dela dá 1,225:1 —
    // acima do MESMO 1,2. A separação que este teste protege existe; ele só
    // media um jeito só de obtê-la. Agora aceita os dois e exige que PELO
    // MENOS UM passe — na prática, hoje, é a borda quem carrega a régua.
    //
    // ONDA 96 — e agora vale nos DOIS temas: no claro o preenchimento dá
    // 1,07:1 e a borda 1,24:1, mesma história, e ela também não era medida.
    const t = (n: string) => token(bloco, n, nomeTema)
    const porPreenchimento = razao(t("superficie"), t("fundo"))
    const porBorda = razao(t("linha"), t("superficie"))
    expect(
      Math.max(porPreenchimento, porBorda),
      `Nem preenchimento (${porPreenchimento.toFixed(3)}:1) nem borda (${porBorda.toFixed(3)}:1) ` +
        `separam o cartão do fundo acima de 1,2:1.`,
    ).toBeGreaterThan(1.2)
  })

  it("quando o preenchimento não separa, a borda TEM que separar", () => {
    // O teste acima aceita qualquer um dos dois caminhos. Este fecha a
    // brecha que sobra: se o preenchimento não separa, a borda deixa de ser
    // alternativa e vira obrigação — com mensagem própria, em vez de a falha
    // aparecer escondida dentro de um `Math.max`.
    //
    // É por isso que a regra ficou MAIS rígida que antes da onda 79, não
    // menos: antes uma paleta passava com preenchimento no limite e borda
    // invisível; agora, nessa situação, ela reprova aqui.
    const t = (n: string) => token(bloco, n, nomeTema)
    if (razao(t("superficie"), t("fundo")) > 1.2) return
    expect(razao(t("linha"), t("superficie"))).toBeGreaterThan(1.2)
  })
})

/**
 * A regra que não é sobre um par, e sim sobre o MECANISMO.
 *
 * O acento do app e o acento do instrumento são obrigados a ser cores
 * diferentes num app que tem tema claro: sobre branco o acento precisa ser
 * escuro pra ler, e sobre o navy fixo do instrumento um acento escuro dá
 * 3,02:1. Se alguém apagar a redeclaração do bloco `.bg-meter`, os 17 usos de
 * `text-accent` que vivem dentro dos cartões de /navegar voltam a herdar o
 * acento da página — e a tabela acima continuaria TODA verde, porque nenhum
 * dos pares dela mede essa herança. Este teste é o que impede isso.
 */
describe("o instrumento tem acento próprio", () => {
  it.each(["acao", "acao-forte", "acao-texto", "ok", "warn", "crit"])(
    "o bloco .bg-meter redeclara --%s",
    (nome) => {
      expect(
        new RegExp(`--${nome}:`).test(INSTRUMENTO),
        `O bloco .bg-meter/.bg-mapa-instrumento parou de redeclarar --${nome}. ` +
          `O chão ali é navy nos dois temas: sem a redeclaração, quem estiver dentro ` +
          `herda a cor calibrada pra ler sobre branco e some.`,
      ).toBe(true)
    },
  )
})

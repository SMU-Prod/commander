import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * ONDA 58 — TODO DESTINO DO MENU LEVA A UMA ROTA QUE EXISTE.
 *
 * O Menu virou o índice do produto (spec de arquitetura §4) e Ajustes virou a
 * casa de tudo que é configuração — juntos, os dois são o *gate de
 * descoberta* (PRD §9): pra maioria das áreas, é a ÚNICA porta visível. Um
 * `href` apontando pra rota que não existe aqui não é um 404 qualquer — é uma
 * área inteira do produto que ninguém mais acha. Foi quase o que aconteceu na
 * onda 58: Tripulação mudou de `/menu/tripulacao` pra `/tripulacao`, e cada
 * link esquecido viraria exatamente essa porta falsa.
 *
 * Por que Vitest e leitura de arquivo (mesmo espírito de `tokens.test.ts`):
 * não precisa de navegador nem de sessão — a pergunta "esse caminho tem
 * `page.tsx`?" se responde no disco, e assim ela é barrada no `npm test`,
 * antes de o commit existir, e não depois na varredura e2e.
 *
 * O QUE CONTA COMO DESTINO — e o que fica de fora, de propósito:
 *
 * 1. SÓ `href` LITERAL (`href="/rota"`). Href dinâmico (template string,
 *    expressão, prop repassada) depende de dado que só existe em runtime —
 *    regex não resolve `${id}`, e fingir que resolve seria checar um caminho
 *    inventado. Hoje as duas telas só têm literais; se um dia entrar um
 *    dinâmico, ele fica invisível pra ESTE teste e a varredura e2e é quem o
 *    cobre.
 *
 * 2. REDIRECT CONTA COMO ROTA VIVA. `menu/tripulacao/page.tsx` existe só pra
 *    redirecionar pra `/tripulacao` — e está certo que o teste o aceite: o
 *    critério é "link morto = área que ninguém acha", e quem clica num link
 *    que redireciona CHEGA em algum lugar. Porta que abre pra um corredor não
 *    é porta falsa. (Se o alvo do redirect morresse, o link dele nas telas
 *    reprovaria aqui do mesmo jeito.)
 *
 * 3. GRUPOS DE ROTA SÃO NORMALIZADOS. `/parceiro` mora em
 *    `app/(parceiro)/parceiro/`, `/termos` mora solto em `app/termos/` —
 *    parêntese não vira URL. Por isso a checagem caminha `app/` inteira e
 *    apaga os segmentos `(grupo)`, em vez de assumir que todo destino mora
 *    em `(app)`.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

/** As duas telas do gate de descoberta. Caminho relativo à raiz de `web/`. */
const TELAS_DO_GATE = [
  "app/(app)/menu/page.tsx",
  "app/(app)/menu/ajustes/page.tsx",
]

/** `href="/..."` literal, aspas duplas — como o JSX das duas telas escreve. */
const HREF_LITERAL = /\bhref="(\/[^"]*)"/g

function extrairHrefs(arquivoRelativo: string): string[] {
  const conteudo = readFileSync(path.join(RAIZ, arquivoRelativo), "utf-8")
  const hrefs: string[] = []
  for (const [, href] of conteudo.matchAll(HREF_LITERAL)) {
    // Query e fragmento não escolhem page.tsx — só o caminho escolhe.
    hrefs.push(href.replace(/[?#].*$/, ""))
  }
  return hrefs
}

/**
 * Todas as rotas que têm `page.tsx`, já sem os segmentos `(grupo)`.
 * Segmentos dinâmicos (`[id]`) ficam como estão — nenhum href literal casa
 * com eles e está certo assim: apontar o índice pra `/tripulacao/[id]` sem
 * saber o id seria um link quebrado de qualquer forma.
 */
function rotasExistentes(dir: string, prefixo = "", rotas = new Set<string>()): Set<string> {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.isDirectory()) {
      const segmento = entrada.name.startsWith("(") && entrada.name.endsWith(")")
        ? "" // grupo de rota: organiza pasta, não vira URL
        : `/${entrada.name}`
      rotasExistentes(path.join(dir, entrada.name), prefixo + segmento, rotas)
    } else if (entrada.name === "page.tsx") {
      rotas.add(prefixo || "/")
    }
  }
  return rotas
}

describe("menu-destinos", () => {
  const rotas = rotasExistentes(path.join(RAIZ, "app"))

  // Sanidade, pelo mesmo motivo do teste-irmão `tokens.test.ts`: se o regex
  // apodrecer ou uma das telas mudar de lugar, extrair ZERO hrefs faria o
  // teste de baixo passar por vazio — um gate de descoberta sem nenhuma porta
  // passaria como "nenhuma porta falsa". Teste de disciplina que passa sem
  // ler nada é decoração.
  it("as duas telas do gate existem e têm destinos pra checar", () => {
    for (const tela of TELAS_DO_GATE) {
      expect(extrairHrefs(tela).length, `${tela}: nenhum href literal encontrado`).toBeGreaterThan(0)
    }
  })

  it("todo href literal do Menu e de Ajustes leva a uma rota com page.tsx", () => {
    const mortos: string[] = []
    for (const tela of TELAS_DO_GATE) {
      for (const href of extrairHrefs(tela)) {
        if (!rotas.has(href)) mortos.push(`  ${tela} → ${href}`)
      }
    }
    expect(
      mortos,
      `Link morto no gate de descoberta — área do produto que ninguém acha.\n` +
        `Ou a rota mudou de endereço (atualize o href), ou a tela foi removida ` +
        `(remova a linha do índice):\n${mortos.join("\n")}`,
    ).toEqual([])
  })

  // ONDA 59 — A OUTRA METADE DO TESTE QUE O SPEC PEDE.
  //
  // O spec de arquitetura §6 pede DUAS coisas do Menu: "todo destino do Menu
  // leva a uma rota que existe" (o teste acima, entregue na onda 58) "e nenhum
  // ajuste sobrou entre os destinos" — esta aqui, que tinha ficado pra trás.
  //
  // A separação da onda 58 só funciona se for EXCLUSIVA: o Menu é o índice do
  // produto, Ajustes é a casa única da configuração ("moram AQUI, e em nenhum
  // outro lugar", diz o cabeçalho de `menu/ajustes/page.tsx`). Um destino que
  // apareça nas DUAS telas desfaz a mudança em silêncio — foi exatamente o
  // estado que o dono descreveu como "o menu mais parece configurações do que
  // menu". Como "é ajuste" não é uma propriedade que dê pra deduzir do href,
  // o critério verificável é o da moradia: o que mora em Ajustes não pode
  // TAMBÉM morar no Menu.
  //
  // A única exceção é `/menu/ajustes` em si: a linha "Ajustes" no fim do Menu
  // é a porta pra casa da configuração — sem ela, Ajustes viraria área que
  // ninguém acha (o mesmo critério do teste de link morto). Hoje esse href só
  // existe do lado do Menu; o filtro guarda o caso futuro de Ajustes ganhar
  // um link pra si mesmo sem transformar isso numa reprovação sem sentido.
  //
  // Contra o "passa por vazio": a sentinela lá de cima já reprova se qualquer
  // uma das duas telas extrair zero hrefs — este teste herda a proteção por
  // usar os MESMOS helpers.
  it("nenhum ajuste entre os destinos: o que mora em Ajustes não aparece no Menu", () => {
    const [telaMenu, telaAjustes] = TELAS_DO_GATE
    const noMenu = new Set(extrairHrefs(telaMenu))
    const duplicados = extrairHrefs(telaAjustes)
      .filter((href) => href !== "/menu/ajustes")
      .filter((href) => noMenu.has(href))
    expect(
      duplicados,
      `Destino morando nas duas telas do gate — a separação Menu (índice) × ` +
        `Ajustes (configuração) da onda 58 exige moradia única.\n` +
        `Decida a casa e remova a linha da outra tela:\n` +
        duplicados.map((d) => `  ${d}`).join("\n"),
    ).toEqual([])
  })
})

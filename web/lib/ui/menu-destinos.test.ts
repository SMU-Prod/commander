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
 *    inventado. Hoje as telas do gate só têm literais; se um dia entrar um
 *    dinâmico, ele fica invisível pra ESTE teste e a varredura e2e é quem o
 *    cobre. (O `\b` antes de `href` é o que faz `voltarHref="/menu"` NÃO
 *    contar: o "Voltar" de uma tela filha é o caminho de trás, não um destino
 *    do índice — contá-lo acusaria toda tela de índice de morar dentro de si
 *    mesma.)
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

/**
 * ONDA 103 — O GATE PASSOU A TER DOIS NÍVEIS, E ESTE ARQUIVO PRECISOU
 * ACOMPANHAR.
 *
 * Até a onda 102 o gate eram DUAS telas: Menu (índice) e Ajustes
 * (configuração). O §2.1 da spec `2026-08-19-arquitetura-quatro-apps.md` pede
 * um menu de seis itens em que **Meu Barco** e **Serviços** são agrupadores, e
 * a onda 102 os entregou como SEÇÕES da mesma lista — o que deixou o defeito
 * nº 5 do dono ("menu longo demais") de pé: 1788px de rolagem, 22 linhas.
 *
 * Agora os dois agrupadores são TELAS (`/meu-barco` e `/servicos`), e o gate
 * são QUATRO arquivos. Se este teste continuasse olhando só dois, dezoito
 * destinos sairiam da cobertura no mesmo commit que os moveu — exatamente o
 * tipo de buraco que ele existe pra impedir.
 *
 * As três disciplinas que ele passa a cobrar, e o motivo de cada uma:
 *
 *   · **LINK MORTO** — como antes, agora nas quatro telas.
 *   · **MORADIA ÚNICA** — nenhum destino aparece em duas telas do gate. Era
 *     "o que mora em Ajustes não pode morar no Menu" (onda 59) e virou a regra
 *     geral, porque com agrupadores ela ganhou um segundo trabalho: impedir
 *     que o Menu principal REENGORDE. Se alguém devolver "Financeiro" para a
 *     tela do Menu, a linha passa a existir em dois lugares e o teste reprova
 *     — que é a forma verificável de dizer "seis linhas e nada mais".
 *   · **OS SEIS SÃO SEIS** — a tela do Menu só pode conter os seis destinos do
 *     §2.1 e o que estiver declarado em `FORA_DOS_SEIS` com motivo escrito.
 *     Sem isto, a moradia única sozinha permitiria acrescentar ao Menu
 *     qualquer destino que ainda não estivesse nos agrupadores, e a lista
 *     voltaria a crescer por acúmulo — que é literalmente como ela chegou a 22
 *     linhas.
 */

/**
 * ONDA 84 / AUDITORIA 19/08 — A VARREDURA NA OUTRA DIREÇÃO (achado C5).
 *
 * Tudo acima checa `hrefs ⊆ rotas`: nenhum link aponta pro vazio. A auditoria
 * mostrou que o defeito mais caro é o INVERSO e passava batido: `rotas −
 * alcançáveis`, a sala sem corredor. Foi assim que `/consultor` — a agenda de
 * um papel PAGO, externo, que precisa entrar todo dia — ficou sem nenhum link
 * no app inteiro, alcançável só digitando a URL de cabeça. É a segunda vez que
 * acontece: `/parceiro` teve o mesmo defeito, foi consertado à mão em 08/08, e
 * o teste não aprendeu nada com isso. Consertar o caso pontual de novo seria
 * marcar encontro com a terceira vez.
 *
 * Por isso a varredura de baixo NÃO olha só as telas do gate: ela lê `app/`,
 * `components/` e `lib/` inteiras. O gate é onde o destino DEVERIA estar, mas
 * navegação nasce em muitos lugares (`bottom-nav`, `trilho-lateral`,
 * `rede-nav`, `financeiro-nav`, `faixa-topo`, `admin/page.tsx`,
 * `lib/domain/partner.ts`) e uma rota alcançável por qualquer um deles não é
 * órfã — é só uma rota que não mora no Menu.
 *
 * O QUE CONTA COMO ALCANÇÁVEL, e o critério é sempre "existe um caminho que a
 * pessoa percorre sem digitar":
 *
 *   · `href="/x"` literal — o mesmo do teste de cima;
 *   · `href={`/x/${id}`}` — o PREFIXO estático conta. Aqui a regra é o oposto
 *     da de lá, e de propósito: naquele teste o href dinâmico é ignorado
 *     porque não dá pra provar que o destino existe; neste, ele PROVA que
 *     alguém navega pra `/x`, que é tudo o que se pergunta;
 *   · `router.push` / `redirect` / `permanentRedirect` — chegar por redirect
 *     depois de uma ação é chegar (mesmo critério do item 2 lá em cima).
 *
 * O QUE NÃO CONTA: a própria rota se autorreferenciando. Uma tela que só é
 * linkada por ela mesma (o back-link de `(consultor)/consultor/[id]` apontando
 * pra `/consultor`, os auto-redirects de guarda) é exatamente o caso que
 * `/consultor` exibia — parece alcançável na varredura ingênua e não é.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

/**
 * AS QUATRO TELAS DO GATE DE DESCOBERTA, em dois níveis. Caminho relativo à
 * raiz de `web/`.
 *
 * O Menu é o primeiro nível (os seis do §2.1); `/meu-barco` e `/servicos` são
 * os dois agrupadores; `/menu/ajustes` é "Minha conta", que sempre foi uma
 * tela filha do Menu e agora só ficou explícito que ela é o terceiro filho.
 */
const TELA_DO_MENU = "app/(app)/menu/page.tsx"
const TELAS_DO_GATE = [
  TELA_DO_MENU,
  "app/(app)/meu-barco/page.tsx",
  "app/(app)/servicos/page.tsx",
  "app/(app)/menu/ajustes/page.tsx",
]

/**
 * OS SEIS ITENS DO §2.1, na ordem em que o dono os escreveu:
 * *"Início · Meu Barco · Diário · Agenda · Serviços · Minha Conta"*.
 *
 * "Minha Conta" continua morando em `/menu/ajustes` — o endereço não mudou de
 * propósito (link salvo, conversa antiga e URL indexada não valem uma rota
 * nova); o que mudou na onda 102 foi o título da tela.
 */
const OS_SEIS = ["/hoje", "/meu-barco", "/diario", "/agenda", "/servicos", "/menu/ajustes"]

/**
 * O que o Menu carrega ALÉM dos seis, com o motivo escrito — mesma disciplina
 * das listas de exceção lá embaixo: lista sem motivo vira depósito, e foi por
 * acúmulo sem motivo que o Menu chegou a 22 linhas.
 *
 * Todas as linhas de hoje são do TERCEIRO aplicativo do §1 (a operação
 * Enterprise) e nenhuma aparece para um proprietário comum: elas estão atrás
 * de `veOperacaoDaFrota`/`veHubDeAtualizacoes` (`lib/domain/enterprise.ts`),
 * que dependem de `embarcacoes.cotas_total`. O §2.4 pede pra elas um ambiente
 * separado, com rota, trilho e barra próprios — enquanto esse ambiente não
 * existe, elas ficam aqui, declaradas. Quando ele existir, esta lista esvazia.
 */
const FORA_DOS_SEIS: Record<string, string> = {
  "/patio": "operação Enterprise (§2.4) — atrás de veOperacaoDaFrota, invisível pro proprietário comum",
  "/mecanica": "operação Enterprise (§2.4) — atrás de veOperacaoDaFrota",
  "/afazeres": "operação Enterprise (§2.4) — atrás de veOperacaoDaFrota",
  "/estoque": "operação Enterprise (§2.4) — atrás de veOperacaoDaFrota",
  "/combustivel": "operação Enterprise (§2.4) — atrás de veOperacaoDaFrota",
  "/frota": "financeiro operacional (§2.4) — veOperacaoDaFrota E permissão de gastos",
  "/atualizacoes": "hub de mão dupla da cota (§15) — atrás de veHubDeAtualizacoes",
}

/** `href="/..."` literal, aspas duplas — como o JSX das telas escreve. */
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

// ---------------------------------------------------------------------------
// A varredura de órfãs
// ---------------------------------------------------------------------------

/** Onde navegação pode nascer. `lib/` entra porque `lib/domain/partner.ts`
 *  guarda destinos, e `lib/acoes/*` redireciona depois de agir. */
const PASTAS_DE_NAVEGACAO = ["app", "components", "lib"]

/**
 * Rotas que existem sem link de entrada POR DECISÃO — cada uma com o motivo
 * escrito, porque uma lista sem motivo vira depósito e o teste volta a não
 * proteger nada.
 *
 * A lista é fechada nos dois sentidos: rota órfã fora dela reprova, e entrada
 * daqui que GANHOU uma porta também reprova, obrigando a linha a sair. Sem a
 * segunda metade, a lista apodreceria em silêncio — que é como este teste
 * chegou até aqui sem pegar `/consultor`.
 */
const SEM_PORTA_POR_DECISAO: Record<string, string> = {
  // C3 — aliases de compatibilidade. São `redirect` puros que cobrem link
  // salvo, link em conversa antiga e URL já indexada. Ganhar um link seria o
  // defeito: são o endereço velho, não um destino.
  "/barco/gastos": "alias de compatibilidade — redireciona pro Financeiro",
  "/barco/selo": "alias de compatibilidade",
  "/menu/tripulacao": "alias de compatibilidade — Tripulação mudou pra /tripulacao na onda 58",
  "/oportunidades": "alias de compatibilidade — virou /marketplace",
  "/oportunidades/nova": "alias de compatibilidade — virou /marketplace",
  "/rede": "alias de compatibilidade",

  // `/servicos` ESTAVA AQUI e saiu na onda 103 — ele deixou de ser alias e
  // virou o quinto item do §2.1, com link no Menu. A metade compatível
  // continua viva DENTRO da tela: `?categoria=` ainda redireciona pra
  // `/prestadores?categoria=`, então nenhum link velho virou 404. O
  // julgamento inteiro (inclusive a objeção do PRD §10, *"não existe aba
  // Serviços"*) está escrito em `app/(app)/servicos/page.tsx`.
  //
  // A lição, que é a mesma da saída de `/consultor` de `SO_POR_ACAO`: exceção
  // some quando o defeito some. Manter a linha aqui faria o teste de baixo
  // reprovar a rota justamente por ela ter ganhado a porta que precisava.
}

/**
 * SÓ SE CHEGA AGINDO — rotas que nenhum `href` alcança, mas que um `redirect`
 * ou `router.push` produz depois de uma ação.
 *
 * Esta é a categoria em que `/consultor` estava escondido, e é por isso que
 * ela merece lista própria em vez de cair no balaio de cima: uma tela que só
 * aparece DEPOIS de você já ter feito alguma coisa não é descobrível. Quem
 * nunca fez a ação não sabe que ela existe; quem fez e quis voltar não tem por
 * onde.
 *
 * O que entra aqui, e a diferença importa:
 *
 *   PASSO DE FLUXO / PÁGINA DE SISTEMA — está certo assim, é o desenho.
 *   DEFEITO CONHECIDO — está errado e a linha diz o conserto. Ficam aqui, e
 *   não como reprovação, porque a porta que falta mora numa tela fora do
 *   alcance desta rodada; o registro é o que impede de esquecer de novo.
 */
const SO_POR_ACAO: Record<string, string> = {
  "/nova-senha": "chega pelo link do e-mail de recuperação",
  "/diario/[id]/horas": "passo de fluxo (C4) — pós-registro de trilha e evento",
  "/navegar/viagem/nova":
    "atalho por BOTÃO no mapa (`router.push`), não por `<Link>` — porta existe, só não é href",

  // `/consultor` ESTAVA AQUI, e saiu na mesma rodada (onda 88).
  //
  // O achado C1 da auditoria de 19/08 registrou o defeito — a agenda do
  // consultor do Commander Gold, papel PAGO e externo, sem UM link no app
  // inteiro — e este teste nasceu justamente porque ele passou três ondas
  // escondido. A porta foi construída em `app/(app)/menu/ajustes/page.tsx`, no
  // molde da de `/parceiro` e visível só para quem tem o papel, e por isso a
  // exceção deixou de existir em vez de virar mobília.
  //
  // A lição fica escrita porque é ela que se repete: exceção com prazo é
  // dívida; exceção sem prazo vira desenho. Se você precisar acrescentar uma
  // aqui, escreva junto quem a remove e quando.
}

/** Uma PORTA: alguém pode clicar e chegar. `href="/x"`, `href={"/x"}`, o
 *  prefixo estático de `` href={`/x/${id}`} ``, e `href: "/x"` — as barras de
 *  navegação (`financeiro-nav`, `rede-nav`) guardam destino em objeto, não em
 *  JSX, e ignorar isso acusaria de órfã meia dúzia de tela linkada. */
const PADROES_DE_PORTA = [
  /\bhref="(\/[^"]*)"/g,
  /\bhref=\{"(\/[^"]*)"\}/g,
  /\bhref=\{`(\/[^`$]*)/g,
  /\bhref:\s*"(\/[^"]*)"/g,
  /\bhref:\s*`(\/[^`$]*)/g,
]

/** Chegar DEPOIS de agir: redirect de server action, push do cliente, e os
 *  atalhos que a casa usa pra devolver a pessoa com `?ok=`/`?erro=`. */
const PADROES_DE_ACAO = [
  /\b(?:router\.push|router\.replace|redirect|permanentRedirect)\(\s*"(\/[^"]*)"/g,
  /\b(?:router\.push|router\.replace|redirect|permanentRedirect)\(\s*`(\/[^`$]*)/g,
  /\b(?:erroAdmin|okAdmin|falhar|erro)\(\s*"(\/[^"]*)"\s*,/g,
  /\b(?:erroAdmin|okAdmin|falhar|erro)\(\s*`(\/[^`$]*)/g,
]

/** Query, fragmento e barra final não escolhem `page.tsx` — só o caminho. */
function normalizar(bruto: string): string {
  const limpo = bruto.replace(/[?#].*$/, "")
  return limpo.length > 1 ? limpo.replace(/\/+$/, "") : limpo
}

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules") continue
      arquivosDeCodigo(completo, achados)
    } else if (/\.tsx?$/.test(entrada.name) && !entrada.name.endsWith(".test.ts")) {
      achados.push(completo)
    }
  }
  return achados
}

/**
 * A rota que um arquivo SERVE — usada pra descartar autorreferência.
 * `app/(consultor)/consultor/[id]/page.tsx` serve `/consultor/[id]`, e um link
 * pra `/consultor` saindo de lá é o próprio recinto apontando pra si mesmo.
 */
function rotaDoArquivo(caminhoCompleto: string): string | null {
  const rel = path.relative(path.join(RAIZ, "app"), caminhoCompleto)
  if (rel.startsWith("..")) return null
  const segmentos = rel.split(path.sep).slice(0, -1)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
  return `/${segmentos.join("/")}`.replace(/\/$/, "") || "/"
}

/** Os destinos que os padrões dados encontram, ignorando autorreferência. */
function varrer(padroes: readonly RegExp[]): Set<string> {
  const destinos = new Set<string>()
  for (const pasta of PASTAS_DE_NAVEGACAO) {
    for (const arquivo of arquivosDeCodigo(path.join(RAIZ, pasta))) {
      const conteudo = readFileSync(arquivo, "utf-8")
      const casa = rotaDoArquivo(arquivo)
      for (const padrao of padroes) {
        for (const [, bruto] of conteudo.matchAll(padrao)) {
          const destino = normalizar(bruto)
          if (destino === "") continue
          // Autorreferência não abre porta: nem o link pra si mesmo, nem o
          // link de um filho pro pai que ninguém alcança. Foi assim que
          // `/consultor` passou por alcançável durante três ondas — o único
          // link pra ele saía de dentro dele.
          if (casa != null && (destino === casa || casa.startsWith(`${destino}/`))) continue
          destinos.add(destino)
        }
      }
    }
  }
  return destinos
}

describe("menu-destinos", () => {
  const rotas = rotasExistentes(path.join(RAIZ, "app"))

  // Sanidade, pelo mesmo motivo do teste-irmão `tokens.test.ts`: se o regex
  // apodrecer ou uma das telas mudar de lugar, extrair ZERO hrefs faria os
  // testes de baixo passarem por vazio — um gate de descoberta sem nenhuma
  // porta passaria como "nenhuma porta falsa". Teste de disciplina que passa
  // sem ler nada é decoração.
  it("as quatro telas do gate existem e têm destinos pra checar", () => {
    for (const tela of TELAS_DO_GATE) {
      expect(extrairHrefs(tela).length, `${tela}: nenhum href literal encontrado`).toBeGreaterThan(0)
    }
  })

  it("todo href literal das telas do gate leva a uma rota com page.tsx", () => {
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

  // ONDA 103 — O TESTE QUE FAZ "SEIS LINHAS E NADA MAIS" SER VERIFICÁVEL.
  //
  // O §2.1 nomeia seis itens. Sem este teste, "seis" é uma frase de spec: a
  // próxima área nova encosta mais uma linha aqui, depois outra, e em três
  // ondas o Menu está de volta às 22 que esta rodada mediu antes de começar.
  // Foi assim que ele engordou da primeira vez — nenhuma linha isolada parecia
  // demais.
  //
  // A ORDEM ENTRA NA CONFERÊNCIA porque ela é do dono e carrega significado:
  // "Meu Barco" logo depois de "Início" é o que diz que o barco é o assunto do
  // app; "Minha Conta" no fim é o que diz que conta não é área do produto.
  it("a tela do Menu tem os seis do §2.1, nessa ordem, e nada além do declarado", () => {
    const hrefs = extrairHrefs(TELA_DO_MENU)
    const seisNaOrdem = hrefs.filter((h) => OS_SEIS.includes(h))
    expect(
      seisNaOrdem,
      `Os seis itens do §2.1 mudaram de ordem ou sumiram do Menu.\n` +
        `A ordem do dono é: ${OS_SEIS.join(" · ")}`,
    ).toEqual(OS_SEIS)

    const intrusos = hrefs.filter((h) => !OS_SEIS.includes(h) && !(h in FORA_DOS_SEIS))
    expect(
      intrusos,
      `Destino novo na tela do Menu. O §2.1 fixa SEIS itens e o defeito nº 5 do ` +
        `dono é "menu longo demais, exige muita rolagem".\n` +
        `Se é área do barco, a casa é /meu-barco; se é rede náutica, /servicos; ` +
        `se é da pessoa, /menu/ajustes. Se não for nenhuma das três, declare em ` +
        `FORA_DOS_SEIS com o motivo:\n${intrusos.map((d) => `  ${d}`).join("\n")}`,
    ).toEqual([])

    const declaradosQueSumiram = Object.keys(FORA_DOS_SEIS).filter((d) => !hrefs.includes(d))
    expect(
      declaradosQueSumiram,
      `Estas rotas estão declaradas em FORA_DOS_SEIS e não estão mais no Menu — ` +
        `lista que mente deixa de proteger. Remova as linhas:\n` +
        declaradosQueSumiram.map((d) => `  ${d}`).join("\n"),
    ).toEqual([])
  })

  // ONDA 59, ESTENDIDA NA 103 — MORADIA ÚNICA ENTRE AS TELAS DO GATE.
  //
  // O spec de arquitetura §6 pedia DUAS coisas do Menu: "todo destino do Menu
  // leva a uma rota que existe" (o teste acima) "e nenhum ajuste sobrou entre
  // os destinos" — que na onda 59 virou "o que mora em Ajustes não pode
  // TAMBÉM morar no Menu". Com os agrupadores da onda 103 a mesma regra passou
  // a fazer um segundo trabalho, e o mais importante dos dois:
  //
  //   · o de sempre — Menu (índice) × Ajustes (configuração) não se misturam,
  //     que foi o estado que o dono descreveu como "o menu mais parece
  //     configurações do que menu";
  //   · o novo — um destino que já tem casa em `/meu-barco` ou `/servicos` não
  //     pode reaparecer no Menu principal. É a forma verificável de dizer que
  //     o agrupamento aconteceu de verdade, e não que a lista longa ganhou uma
  //     cópia resumida em cima.
  //
  // Como "é ajuste" ou "é área do barco" não são propriedades dedutíveis de um
  // href, o critério verificável continua sendo o da moradia: cada destino
  // aparece em UMA tela do gate.
  //
  // Contra o "passa por vazio": a sentinela lá de cima já reprova se qualquer
  // uma das quatro telas extrair zero hrefs — este teste herda a proteção por
  // usar os MESMOS helpers.
  it("moradia única: nenhum destino aparece em duas telas do gate", () => {
    const casaDe = new Map<string, string>()
    const duplicados: string[] = []
    for (const tela of TELAS_DO_GATE) {
      for (const href of new Set(extrairHrefs(tela))) {
        const jaMora = casaDe.get(href)
        if (jaMora != null) duplicados.push(`  ${href} — em ${jaMora} e em ${tela}`)
        else casaDe.set(href, tela)
      }
    }
    expect(
      duplicados,
      `Destino morando em duas telas do gate. O índice tem dois níveis desde a ` +
        `onda 103 e cada destino tem UMA casa:\n` +
        `  · área do barco → /meu-barco\n` +
        `  · rede náutica → /servicos\n` +
        `  · configuração e papéis da pessoa → /menu/ajustes\n` +
        `  · os seis do §2.1 → a tela do Menu\n` +
        `Decida a casa e remova a linha da outra tela:\n${duplicados.join("\n")}`,
    ).toEqual([])
  })

  describe("rota órfã — a sala sem corredor", () => {
    const portas = varrer(PADROES_DE_PORTA)
    const porAcao = varrer(PADROES_DE_ACAO)

    /** Rota estática de produto. Dinâmica (`[id]`) fica de fora do primeiro
     *  teste: nenhum destino literal casa com ela, e a porta dela é sempre a
     *  lista que a antecede — cobrar link literal aqui acusaria toda tela de
     *  detalhe do app. Rota de API também: não é tela, não tem porta. */
    const rotasDeTela = [...rotas].filter((r) => !r.startsWith("/api")).sort()

    // Mesma sentinela do teste de cima, pelo mesmo motivo: uma varredura que
    // encontra ZERO destinos declararia o app inteiro órfão sem ter lido nada.
    it("a varredura encontra portas de verdade", () => {
      expect(portas.size, "nenhuma porta extraída — os padrões apodreceram").toBeGreaterThan(20)
      expect(portas.has("/menu")).toBe(true)
      expect(porAcao.size, "nenhum redirect extraído").toBeGreaterThan(5)
    })

    it("toda rota é alcançável de alguma forma — ou tem decisão escrita", () => {
      const ilhas = rotasDeTela
        .filter((r) => !r.includes("["))
        .filter((r) => !portas.has(r) && !porAcao.has(r))
        .filter((r) => !(r in SEM_PORTA_POR_DECISAO) && !(r in SO_POR_ACAO))
      expect(
        ilhas,
        `Rota ilhada: existe uma tela e NENHUM link, push ou redirect do app leva até ela.\n` +
          `Ou dê uma porta a ela (o Menu é o gate de descoberta), ou registre em ` +
          `SEM_PORTA_POR_DECISAO com o motivo:\n${ilhas.map((r) => `  ${r}`).join("\n")}`,
      ).toEqual([])
    })

    // O TESTE QUE TERIA PEGO `/consultor`.
    //
    // Alcançável só por redirect pós-ação é o disfarce perfeito: a varredura
    // ingênua marca a rota como viva e o produto não tem porta nenhuma. Toda
    // rota nesse estado tem que estar declarada — como desenho (passo de
    // fluxo) ou como defeito conhecido, com o conserto escrito ao lado.
    it("rota alcançável só por ação está declarada em SO_POR_ACAO", () => {
      const escondidas = rotasDeTela
        .filter((r) => !portas.has(r) && porAcao.has(r))
        .filter((r) => !(r in SO_POR_ACAO))
      expect(
        escondidas,
        `Rota sem porta clicável — só se chega a ela DEPOIS de uma ação.\n` +
          `Quem nunca fez a ação não sabe que a tela existe; quem fez e quis ` +
          `voltar não tem por onde. Foi assim que /parceiro (08/08) e ` +
          `/consultor (19/08) sumiram do produto.\n` +
          `Dê um link a ela, ou registre em SO_POR_ACAO dizendo se é desenho ` +
          `ou defeito:\n${escondidas.map((r) => `  ${r}`).join("\n")}`,
      ).toEqual([])
    })

    it("as listas de exceção não guardam rota que já ganhou porta", () => {
      const obsoletas = [...Object.keys(SEM_PORTA_POR_DECISAO), ...Object.keys(SO_POR_ACAO)]
        .filter((r) => rotas.has(r) && portas.has(r))
      expect(
        obsoletas,
        `Estas rotas estão declaradas como sem porta e JÁ têm link — a exceção ` +
          `virou mentira, e lista que mente deixa de proteger.\n` +
          `Remova as linhas:\n${obsoletas.map((r) => `  ${r}`).join("\n")}`,
      ).toEqual([])
    })

    it("as listas de exceção não guardam rota que deixou de existir", () => {
      const fantasmas = [...Object.keys(SEM_PORTA_POR_DECISAO), ...Object.keys(SO_POR_ACAO)]
        .filter((r) => !rotas.has(r))
      expect(
        fantasmas,
        `Estas rotas estão declaradas como sem porta e não existem mais:\n` +
          fantasmas.map((r) => `  ${r}`).join("\n"),
      ).toEqual([])
    })
  })
})

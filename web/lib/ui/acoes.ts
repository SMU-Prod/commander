/**
 * ONDA 82 — A FORMA DE UMA AÇÃO SECUNDÁRIA, ESCRITA UMA VEZ.
 *
 * O diagnóstico do dono, olhando o app pronto: *"os destaques têm muita coisa
 * que é clicável e não é perceptível, parecendo um texto comum"*. Ele está
 * certo, e a causa tem nome: a onda 63 tirou o dourado das ações secundárias
 * (decisão certa — cinco douradas numa tela de hub estouravam o orçamento de
 * duas por tela) mas o que sobrou foi **texto**. Texto cinza, ou texto
 * sublinhado. E texto cinza é exatamente o vestido que o app usa para rótulo
 * e apoio, ou seja, para o que NÃO se toca: a ação virou a coisa menos
 * visível da linha.
 *
 * Na referência nenhuma ação é texto pelado — é pílula preenchida, pílula de
 * contorno, ou botão-círculo com ícone (spec §3, item 5). **Quem diz "aqui se
 * toca" é a FORMA, não a cor.** É por isso que esta correção não desfaz a
 * onda 63: o dourado continua reservado à ação principal da tela, e a
 * secundária ganha contorno, que custa zero do orçamento.
 *
 * A BRIGA DE DOIS NÚMEROS, a mesma do `BotaoCirculo`: o desenho pede ~30px
 * (maior que isso a pílula compete com o título ao lado dela e a linha deixa
 * de ter hierarquia), a régua de toque pede 44px e não é negociável. Separar
 * as duas coisas resolve — `ALVO_ACAO` é uma caixa de 44px, `PILULA_ACAO` é o
 * desenho de 30px dentro dela, e a margem negativa devolve ao layout a folga
 * que sobra, para o cabeçalho de seção não engordar 14px em cada uma das ~35
 * telas que o usam.
 *
 * ESTE ARQUIVO EXISTE PORQUE O PADRÃO JÁ TINHA VAZADO. Antes da onda 82 o
 * mesmo gesto ("ação repetida por linha, discreta") estava escrito à mão em
 * cinco lugares com três vestidos diferentes: `text-dim` em `SecaoPagina`,
 * `text-texto underline` em `EstadoVazio` e em duas telas, `text-xs
 * underline` numa terceira. Com o valor num lugar só, um `grep` lista todo
 * mundo que usa a forma — e o dia em que ela mudar, muda inteira.
 *
 * As classes são LITERAIS de propósito (nada de interpolação): o Tailwind
 * varre o código-fonte atrás da classe escrita, e `h-[${n}px]` não geraria
 * CSS nenhum. Mesma razão do `TETO_PAINEL` em `superficies.ts`.
 */

/**
 * ONDA 84 — O APP RESPONDE AO DEDO.
 *
 * A auditoria de design de 19/08/2026 mediu o silêncio: `active:` aparecia
 * **zero vezes em 225 arquivos**. Nenhum toque, em nenhuma tela, produzia
 * retorno nenhum até a rota trocar. O caso que mais dói era a bottom-nav —
 * tocada em toda tela, ela só trocava a cor do texto, sem transição.
 *
 * É isso que separa o app de Waze e Navionics ANTES de qualquer pixel: lá o
 * botão afunda antes de o mapa mexer, e é esse meio-segundo que faz o
 * aparelho parecer que ouviu. Um app que não confirma o toque parece travado
 * mesmo quando está rápido — e o nosso é usado com a mão molhada, no sol, com
 * o barco balançando, que é exatamente quando a dúvida "será que pegou?"
 * custa um segundo toque.
 *
 * 100ms e 3% de escala são deliberadamente pequenos: o objetivo é CONFIRMAR,
 * não animar. Acima disso vira enfeite, e enfeite em instrumento é ruído.
 *
 * `motion-reduce:` desliga os dois. A regra wildcard de `globals.css` já zera
 * a duração de qualquer transição para quem pediu menos movimento, mas sem
 * `active:scale-100` a escala continuaria acontecendo — só que instantânea,
 * que é a pior versão das duas.
 */
export const TOQUE =
  "transition-transform duration-100 active:scale-[.97] active:opacity-90 motion-reduce:transition-none motion-reduce:active:scale-100"

/**
 * A mesma confirmação para superfícies GRANDES — linha de lista, cartão
 * inteiro, item da bottom-nav. 3% numa pílula de 100px é 3px e lê como
 * afundar; numa linha de 358px é 11px e lê como a tela inteira tremendo.
 */
export const TOQUE_AMPLO =
  "transition-transform duration-100 active:scale-[.99] active:opacity-95 motion-reduce:transition-none motion-reduce:active:scale-100"

/**
 * A caixa de 44px em volta do desenho — vai no `<Link>`/`<button>`.
 *
 * ONDA 94 — os 44 saem de `--altura-controle` em vez de `min-h-11` cravado.
 * Era o último lugar do app onde a régua de toque estava escrita como número
 * e não como token (o `min-h-11` sobreviveu à onda 91, que tokenizou
 * `Chip`, `RedeNav`, `BotaoFicha` e `BotaoEnviar`) — e é a régua mais copiada
 * que existe: um valor solto aqui é o começo da décima altura.
 *
 * OS `-my-[7px]` ACOMPANHAM O TOKEN E NÃO SÃO OUTRO NÚMERO: são (44 − 30) ÷ 2,
 * a metade da folga entre o alvo e o desenho de `PILULA_ACAO`, devolvida ao
 * layout pra o cabeçalho de seção não engordar 14px em ~35 telas. Ficam
 * literais porque o Tailwind varre a classe escrita — `-my-[calc(...)]` com
 * `var()` geraria CSS, mas amarraria o recuo a uma conta que ninguém lê na
 * hora de mexer. Quem mudar `--altura-controle` mexe aqui também.
 */
export const ALVO_ACAO = `group -my-[7px] inline-flex min-h-[var(--altura-controle)] shrink-0 items-center ${TOQUE}`

/**
 * O desenho da pílula de contorno — vai num `<span>` DENTRO do alvo.
 *
 * `bg-panel2` e não transparente: sobre o fundo da página a pílula precisa de
 * um plano próprio para ler como controle; sobre um cartão (`bg-panel`) o
 * `panel2` avança um degrau, que é a mesma direção. O hover puxa o dourado só
 * na borda — o suficiente para confirmar o alvo sem gastar tinta.
 */
export const PILULA_ACAO =
  "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[var(--raio-pilula)] border border-line bg-panel2 px-3 text-xs font-medium text-texto transition-colors group-hover:border-accent/40 group-hover:bg-panel"

/**
 * A MESMA FORMA, UM TAMANHO ACIMA — para a ação que é um BLOCO, não um
 * acompanhamento de linha: o "Adicionar documento" no meio de um cartão
 * vazio, centrado, com espaço em volta e nada competindo do lado.
 *
 * Por que existe um segundo tamanho, e não é drift: `PILULA_ACAO` é 30px
 * porque divide a linha com um título — se crescer, o cabeçalho de seção
 * deixa de ter hierarquia. Aqui não há nada para dividir, e uma pílula de
 * 30px sozinha no meio de um cartão de 150px lê como sobra, não como
 * convite. Os dois tamanhos moram neste arquivo justamente para a diferença
 * ser uma decisão declarada em vez de dois valores que ninguém comparou.
 *
 * OS 36px SÃO DESENHO, NÃO ALVO — E ISSO FOI MEDIDO ANTES DE FICAR (onda 94).
 * ---------------------------------------------------------------------
 * Uma varredura de régua leu `h-9` aqui e em `PILULA_ACAO_PRINCIPAL` como
 * violação dos 44px. Não é, e engordar a pílula pra "consertar" quebraria a
 * hierarquia que o parágrafo acima descreve. É a MESMA separação do
 * `BotaoCirculo` e do par `ALVO_ACAO`/`PILULA_ACAO`: quem carrega o alvo é o
 * elemento clicável em volta; a pílula é o que se vê dentro dele.
 *
 * Os quatro lugares que consomem estas duas constantes foram conferidos um a
 * um, e nos quatro o elemento clicável já entrega 44px ou mais:
 *
 * | onde | o que embrulha |
 * |---|---|
 * | `components/ui/estado-vazio.tsx` (as duas ênfases, ~49 telas) | `<Link>` com `min-h-[var(--altura-controle)]` |
 * | `app/(parceiro)/parceiro/conta` | `<Link>` com `min-h-11` |
 * | `app/(app)/explorar` e `app/(app)/explorar/[id]` | `ALVO_ACAO` |
 *
 * Ou seja: o alvo cumpre a régua nos quatro, e o que faltava era isto estar
 * ESCRITO aqui — a régua não se lê no `h-9` de quem desenha, se lê em quem
 * embrulha. Se você usar estas constantes num lugar novo, o `<span>` da
 * pílula NÃO pode ser o elemento clicável: ponha `ALVO_ACAO` (ou um
 * `min-h-[var(--altura-controle)]` com `inline-flex items-center`) no
 * `<Link>`/`<button>` de fora, senão o alvo vira 36px e aí sim é violação.
 */
export const PILULA_ACAO_BLOCO =
  `inline-flex h-9 items-center whitespace-nowrap rounded-[var(--raio-pilula)] border border-line bg-panel2 px-4 text-sm text-texto ${TOQUE}`

/**
 * A ação PRINCIPAL de uma tela vazia — cheia, dourada.
 *
 * O orçamento de dois dourados por tela (docs/DESIGN.md §5) cabe folgado
 * aqui: uma tela cujo corpo INTEIRO é um estado vazio tem exatamente uma
 * coisa para se fazer nela. O aninhado — quatro cartões vazios na Início de
 * um barco novo — é quem usa `PILULA_ACAO_BLOCO`.
 *
 * Mesmos 36px de DESENHO do `PILULA_ACAO_BLOCO`, e pelo mesmo motivo: o alvo
 * de 44px vem do elemento clicável em volta. A tabela de quem embrulha o quê
 * está no comentário do `PILULA_ACAO_BLOCO`, logo acima — não repetida aqui
 * pra não haver duas listas divergindo.
 */
export const PILULA_ACAO_PRINCIPAL =
  `inline-flex h-9 items-center whitespace-nowrap rounded-[var(--raio-pilula)] bg-accent px-4 text-sm font-semibold text-acao-texto ${TOQUE}`

/**
 * A AÇÃO DE LARGURA CHEIA NÃO MORA AQUI — ELA É `BotaoEnviar`.
 * ---------------------------------------------------------------------------
 * Existiu neste arquivo uma quarta constante, `PILULA_ACAO_LARGA`, criada pelo
 * achado 5.2 da auditoria de 19/08/2026 para a ação que preenche a largura do
 * bloco onde mora. Ela foi APAGADA no fechamento da mesma auditoria, sem nunca
 * ter tido um consumidor, e o motivo fica escrito porque ele é uma régua e não
 * um evento: **constante sem consumidor é o vício que esta rodada passou o dia
 * apagando** — o `.valor` com zero usos, o `--raio-panel` com zero usos, o
 * bloco de venda do plano de cotista. Uma constante de estilo que ninguém
 * importa não é neutra: ela aparece no `grep` de quem procura "como se faz
 * isso aqui" e responde com um caminho que o app não anda.
 *
 * O QUE FOI MEDIDO ANTES DE APAGAR, e é o que sustenta a decisão:
 *
 *   · ZERO importações em todo o `web/` — e nem sequer um `.test.ts`, porque
 *     `lib/ui/acoes.ts` não tem arquivo de teste.
 *   · As cinco ações que a motivaram viraram `BotaoEnviar variante="contorno"
 *     larguraCheia`, e viraram CERTO: são submits de formulário, e o que a
 *     pílula sozinha não dá é justamente o aviso de envio (`useFormStatus`,
 *     rótulo que troca, duplo toque bloqueado). As duas últimas — o
 *     "Compartilhar" de `barco/selos/gold` e o "Agora não" de
 *     `diario/[id]/horas` — são submits pelo mesmo motivo.
 *   · Uma varredura atrás do consumidor legítimo que a salvaria (uma ação de
 *     largura cheia, contorno, que NÃO fosse submit e estivesse escrita à mão
 *     numa tela) não achou nenhuma. Os dois únicos `w-full` + `rounded-full`
 *     do app são outro vestido: o botão dourado cheio de
 *     `importar-gpx-cliente` e o flutuante com `sombra-2`/`backdrop-blur` do
 *     mapa de planejar viagem.
 *
 * Ou seja: no Commander, ação de largura cheia é submit de formulário, e
 * submit de formulário tem componente próprio há três ondas. Quem chegar aqui
 * precisando de uma ação larga que NÃO envie formulário (um `<a>` de
 * compartilhar fechando o rodapé de um cartão, por exemplo) tem o desenho
 * pronto em `PILULA_ACAO_BLOCO` + `w-full` — e aí sim vale promover a
 * constante, COM o consumidor no mesmo commit, que é a ordem que faltou da
 * primeira vez.
 */

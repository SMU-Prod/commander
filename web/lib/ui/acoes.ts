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

/** A caixa de 44px em volta do desenho — vai no `<Link>`/`<button>`. */
export const ALVO_ACAO = "group -my-[7px] inline-flex min-h-11 shrink-0 items-center"

/**
 * O desenho da pílula de contorno — vai num `<span>` DENTRO do alvo.
 *
 * `bg-panel2` e não transparente: sobre o fundo da página a pílula precisa de
 * um plano próprio para ler como controle; sobre um cartão (`bg-panel`) o
 * `panel2` avança um degrau, que é a mesma direção. O hover puxa o dourado só
 * na borda — o suficiente para confirmar o alvo sem gastar tinta.
 */
export const PILULA_ACAO =
  "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-panel2 px-3 text-xs font-medium text-texto transition-colors group-hover:border-accent/40 group-hover:bg-panel"

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
 */
export const PILULA_ACAO_BLOCO =
  "inline-flex h-9 items-center whitespace-nowrap rounded-full border border-line bg-panel2 px-4 text-sm text-texto"

/**
 * A ação PRINCIPAL de uma tela vazia — cheia, dourada.
 *
 * O orçamento de dois dourados por tela (docs/DESIGN.md §5) cabe folgado
 * aqui: uma tela cujo corpo INTEIRO é um estado vazio tem exatamente uma
 * coisa para se fazer nela. O aninhado — quatro cartões vazios na Início de
 * um barco novo — é quem usa `PILULA_ACAO_BLOCO`.
 */
export const PILULA_ACAO_PRINCIPAL =
  "inline-flex h-9 items-center whitespace-nowrap rounded-full bg-accent px-4 text-sm font-semibold text-acao-texto"

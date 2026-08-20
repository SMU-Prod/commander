/**
 * LARGURA MÁXIMA DE COLUNA — A MEDIDA COM NOME PRÓPRIO (onda 64).
 *
 * `superficies.ts` já tinha a régua de larguras (`TETO_FORMULARIO`,
 * `TETO_LISTA`, `TETO_PAINEL`, onda 63), mas o número que sustenta o degrau
 * mais estreito — 640px — vivia só ali dentro, cravado dentro da classe
 * Tailwind, sem nome próprio. Este arquivo nomeia a MEDIDA, não só a classe:
 * quem precisar limitar outra coisa que não é bem um "formulário" (um
 * parágrafo corrido, uma citação, o corpo de um card de detalhe) tem de onde
 * puxar o mesmo número em vez de reabrir a conta de cabeça ou inventar um
 * `max-w-[]` novo no meio do JSX.
 *
 * A CONTA, REPETIDA AQUI PORQUE É ELA QUE JUSTIFICA O NÚMERO: tipografia
 * clássica fecha a linha de leitura confortável em 45–75 caracteres, e a
 * 16px isso cai na casa dos 640px. É a MESMA régua que decide até onde um
 * campo de texto pode esticar — um input maior que isso não informa nada a
 * mais sobre o que se espera digitar, só fica com cara de campo de celular
 * esticado num monitor.
 *
 * ONDA 95 (achado 5.8) — A CONTA CITAVA UMA FONTE QUE O APP NÃO USA MAIS.
 * Até aqui esta linha dizia "à 16px da IBM Plex Sans". A fonte de TEXTO é
 * Inter desde a onda 80 (e desde a onda 112 ela é a ÚNICA família do app — a
 * Plex Mono, que sobrava no numeral de instrumento, saiu junto com o desvio
 * §15.2 do sistema de design), e a Inter tem largura de avanço diferente: a mesma
 * conta de 45–75 caracteres não devolve exatamente 640. O número segue
 * defensável — 640px continua dentro da faixa de 45–75 caracteres em Inter a
 * 16px — mas a justificativa nomeava a fonte errada, e uma conta que nomeia a
 * fonte errada é uma conta que ninguém pode refazer. Se um dia o corpo do
 * texto mudar, é ESTE parágrafo que precisa ser refeito, não só o número.
 *
 * DUAS CONSTANTES, NÃO UMA — SÃO DUAS PERGUNTAS DIFERENTES QUE HOJE DÃO A
 * MESMA RESPOSTA. "Até onde um parágrafo pode esticar" (legibilidade de
 * prosa) e "até onde um campo de formulário pode esticar" (tamanho que
 * informa quanto se espera escrever) partem de raciocínios distintos e só
 * coincidem em 640px porque as duas contas usam a mesma tipografia de base.
 * Se um dia o campo mudar de corpo só no formulário, ou a prosa ganhar fonte
 * maior, as contas se separam — e cada uma já tem nome próprio pra separar
 * sem precisar inventar um terceiro degrau no meio do caminho.
 *
 * SEM O NÚMERO CRU DE PROPÓSITO — exporta a classe Tailwind PRONTA
 * (`max-w-[640px]`), não `640`. Mesmo motivo do comentário de `TETO_PAINEL`
 * em `superficies.ts`: o Tailwind varre o CÓDIGO-FONTE atrás da classe
 * literal, e interpolar o número numa string no local de uso
 * (`` `max-w-[${N}px]` ``) não gera CSS nenhum. A classe pronta, reexportada
 * sem montagem em tempo de execução, é a única forma de compartilhar a
 * medida que continua funcionando com o Tailwind.
 */
export const COLUNA_LEITURA = "max-w-[640px]"
export const COLUNA_FORMULARIO = "max-w-[640px]"

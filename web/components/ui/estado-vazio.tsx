import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { PILULA_ACAO_BLOCO, PILULA_ACAO_PRINCIPAL } from "@/lib/ui/acoes"

/**
 * Estado vazio: ícone + frase na voz do app + caminho. Um cartão vazio sem
 * ação é uma lápide ("nenhum item cadastrado") — este componente sempre
 * tem espaço para dizer o que fazer a seguir, mesmo quando a ação é opcional.
 *
 * Quando usar: qualquer lista/seção sem dado ainda.
 * - `variant="cartao"` (padrão): sozinho na tela, com sombra e borda próprias
 *   (ex.: "Nenhum motor ainda" sem um painel ao redor).
 * - `variant="linha"`: dentro de um painel que já tem borda (mesmo painel
 *   onde `LinhaLista variant="grupo"` mora) — sem sombra/borda repetida.
 *
 * `densidade` — QUANTO RESPIRO O VAZIO TEM. Ver o comentário da prop.
 *
 * `enfase` — QUANTO PESO A AÇÃO TEM. Numa página inteira vazia, uma ação
 * dourada é a resposta certa: ela É a ação principal daquela tela, e o
 * orçamento de dois dourados por tela (docs/DESIGN.md §5) cabe folgado.
 * O problema aparece ANINHADO: a Início de um barco recém-cadastrado tem
 * quatro cartões vazios ao mesmo tempo (Motores, Gastos, Mar agora,
 * Tripulação) e nenhum deles é a ação principal da tela — quatro dourados
 * de uma vez, mais os que a tela já gasta legitimamente, e o dourado para
 * de significar "aqui se age".
 *
 * Por isso o padrão continua sendo `"acao"`: as ~49 telas que usam este
 * componente como corpo inteiro não mudam nada. Quem está DENTRO de um
 * cartão passa `enfase="discreta"` e a ação vira link sublinhado neutro —
 * mesmo tratamento de link não-dourado que /barco/selos/verified já usa.
 */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  variant = "cartao",
  enfase = "acao",
  densidade = "conforto",
  className = "",
}: {
  icone: NomeIcone
  titulo: string
  descricao?: string
  acao?: { href: string; rotulo: string }
  variant?: "cartao" | "linha"
  /** Peso visual da ação — ver o cabeçalho. `"discreta"` quando o estado
   *  vazio mora dentro de um cartão que não é a ação principal da tela. */
  enfase?: "acao" | "discreta"
  /** ONDA 103 — O RESPIRO DO VAZIO, E ELE ERA O MAIOR BURACO DA INÍCIO.
   *  --------------------------------------------------------------------
   *  Medido a 390px em 19/08, com a `/hoje` do barco de teste: o cartão
   *  "Gastos do mês" fechava em 244px e o "Tripulação" em 228px — os dois
   *  maiores da tela depois do herói —, e o bloco vazio dentro deles
   *  respondia por 184px e 168px. Nenhum dos dois tem UMA palavra a mais que
   *  os cartões de 100px ao lado: a diferença inteira era ar. O dono nomeou
   *  isso duas vezes na spec de 19/08 ("grandes áreas vazias", "tudo com o
   *  mesmo peso visual") e o HAULIX põe "espaço em branco excessivo" na lista
   *  do §58 do que NÃO fazer.
   *
   *  DE ONDE VINHAM OS 184px, item por item: `py-6` (48) + ícone de 24px
   *  numa linha só (24) + `mt-2` (8) + título (20) + `mt-1` (4) + descrição
   *  em duas linhas (32) + `mt-1` (4) + o alvo de toque de 44px (44). Ou
   *  seja: 48px de padding e 24px de ícone — 72px, quase 40% do bloco — para
   *  dizer o que cabe em três linhas de texto.
   *
   *  O QUE O GRAU DENSO MUDA, e é só geometria:
   *    · a coluna centralizada vira a anatomia de alerta compacto do HAULIX
   *      §26 (ícone · título · descrição · ação), alinhada à esquerda — o
   *      ícone sai da própria linha e passa a dividir a linha do título, em
   *      `size-4`, o mesmo tamanho que `Cartao` e `LinhaLista` já usam para
   *      ícone que acompanha texto;
   *    · `py-6` vira `py-1` — dentro de um cartão quem paga o respiro externo
   *      é o `p-3` do `Cartao`, e 48px de padding PRÓPRIO ali é o mesmo
   *      espaço contado duas vezes. Os 4px que ficam existem para o vazio
   *      continuar lendo como ESTADO e não como conteúdo colado no cabeçalho;
   *    · o alvo de 44px devolve ao layout metade da folga que sobra da pílula
   *      de 36 (`-mb-1` = (44−36)÷2), a mesma conta que `ALVO_ACAO` faz com
   *      `-my-[7px]` em ~35 telas. O alvo continua tendo 44px de área
   *      clicável — margem negativa muda o fluxo, não a caixa.
   *
   *  NENHUM TAMANHO NOVO, e isso foi a régua: as vozes seguem `.corpo` (14) e
   *  `.apoio` (12), o espaçamento sai da base 4 (4 · 8), e a ação continua
   *  vestindo as MESMAS duas pílulas de 36px de `lib/ui/acoes.ts`. O grau
   *  denso é layout; ele não redesenha a ação, senão viraria outro
   *  componente em vez de um grau deste.
   *
   *  O DENSO CONTINUA DIZENDO AS TRÊS COISAS que o §6 de `docs/DESIGN.md`
   *  cobra do vazio — o que não existe (título), por que isso é normal
   *  (descrição) e o que fazer (ação). Encolher não podia virar mudez, e é
   *  por isso que o corte veio todo de padding e alinhamento: some ar, não
   *  some frase.
   *
   *  POR QUE ADITIVO, E POR QUE UMA PROP EM VEZ DE MUDAR `variant="linha"`.
   *  O componente serve 95 chamadas em ~76 telas (38 delas em `linha`), e
   *  quase nenhuma dá para conferir nesta rodada. Trocar o padrão consertaria
   *  duas telas medidas e mexeria em setenta e tantas no escuro — o oposto do
   *  que esta casa cobra. `conforto` é o desenho de hoje, byte a byte.
   *
   *  QUANDO PEDIR `denso`: quando o vazio mora DENTRO de um cartão de painel,
   *  disputando a tela com outros cartões — ali ele não é a tela, é uma linha
   *  dela. É o par natural de `enfase="discreta"` (a Início pede os dois
   *  juntos nos quatro cartões dela), mas as duas props continuam separadas
   *  de propósito: uma trata o PESO DA AÇÃO e a outra, o RESPIRO DO BLOCO.
   *  Quem tem a tela inteira para si continua em `conforto`.
   *
   *  UMA ARMADILHA HERDADA, a mesma que `Chip` pagou na onda 98: o `-mb-1`
   *  do alvo só vale onde o container permite. Dentro de um pai com
   *  `overflow-x: auto` o eixo Y vira `auto` junto e os pixels de fora são
   *  recortados COM a área clicável. Nenhum consumidor de hoje está nessa
   *  situação; quem puser um, tire o grau denso ou o `overflow`. */
  densidade?: "conforto" | "denso"
  className?: string
}) {
  // `var(--raio-cartao)` e não `14px` cravado (revisão da onda 57): este
  // componente compõe a Início DENTRO de um `Cartao`, que lê o token. Hoje os
  // dois valem 14px; no dia em que o token mudar, metade dos cartões da mesma
  // tela mudaria e a outra metade não.
  // ONDA 91 (achado 2.4) — `p-3` no lugar de `p-4`: três componentes
  // desenhavam o mesmo gesto "cartão" com 12, 14 e 16px de respiro, e 14 nem
  // degrau da escala base-8 é. O valor que fica é o de `Cartao`, o único dos
  // três com a decisão escrita ("a referência é densa"). O raio continua em
  // `--raio-cartao` e NÃO sobe pra `--raio-painel`: este cartão aparece
  // tipicamente DENTRO de outro (a Início de um barco novo tem quatro ao
  // mesmo tempo), e é o contraste 14/16 que faz o raio significar
  // profundidade — ver o `nivel` de `cartao.tsx`.
  // ONDA 103 — os 48px de `py-6` são o maior item da conta do bloco (ver o
  // comentário de `densidade`). Só o grau denso os troca; `variant="cartao"`
  // continua pagando o `p-3` nos dois graus, porque ali a casca É do vazio e
  // não há `Cartao` em volta para dar o respiro externo.
  const denso = densidade === "denso"
  const base = variant === "cartao"
    ? "sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3"
    : denso ? "py-1" : "py-6"
  // ONDA 82 — DE TEXTO A FORMA. As duas ênfases eram texto: dourado numa,
  // sublinhado na outra. Num cartão vazio — que é uma caixa com um ícone
  // apagado, uma frase e mais uma frase — a linha de texto que É a saída
  // ficava indistinguível das duas que só explicam. O dono resumiu:
  // "parecendo um texto comum".
  //
  // Agora as duas ênfases são pílulas, e a diferença entre elas passa a ser
  // o PESO da pílula, não a existência dela: cheia (a ação principal de uma
  // tela vazia — o dourado cabe folgado no orçamento de dois por tela) e de
  // contorno (o cartão vazio aninhado, que não é a ação principal de nada).
  // O alvo de 44px continua vindo do `--altura-controle` do link em volta; a
  // pílula desenha 36px dentro dele.
  const estiloDaAcao = enfase === "discreta" ? PILULA_ACAO_BLOCO : PILULA_ACAO_PRINCIPAL
  return (
    <div className={`${base} ${denso ? "" : "text-center"} ${className}`}>
      {/* A ÚNICA diferença de anatomia entre os dois graus mora aqui: em
          `conforto` o ícone tem linha própria (24px + `mt-2`); em `denso` ele
          divide a linha do título e para de custar altura. A descrição e a
          ação são as MESMAS nos dois — o grau denso corta ar, não frase. */}
      {denso ? (
        <div className="flex items-center gap-2">
          <Icone nome={icone} className="size-4 shrink-0 text-dim" />
          <p className="corpo min-w-0 flex-1 font-medium">{titulo}</p>
        </div>
      ) : (
        <>
          <Icone nome={icone} className="mx-auto size-6 text-dim" />
          <p className="corpo mt-2 font-medium">{titulo}</p>
        </>
      )}
      {descricao && <p className="apoio mt-1 text-dim">{descricao}</p>}
      {/* Onda 56 — era `apoio mt-3 inline-block`, que dá 17px de altura de
          alvo. A onda 54 já tinha diagnosticado e consertado exatamente isto,
          mas na CÓPIA à mão deste cartão que existe em /hoje ("Completar em
          Embarcação") — o componente compartilhado, que serve as outras ~48
          telas, ficou pra trás. Por isso "Resolver" (Selos), "Cadastrar item"
          (Segurança), "Cadastrar recorrente" (Financeiro) e companhia
          continuavam sendo linhas de texto de 17px fingindo ser botão.
          Mesma solução de lá: `--altura-controle` (a régua de toque do app,
          token desde a onda 91) com `inline-flex` pra altura valer, e `mt-1`
          no lugar de `mt-3` porque a altura nova já traz o respiro que o
          `mt-3` dava. */}
      {/* ONDA 103 — os dois acabamentos que o grau denso põe no alvo, e
          nenhum deles encolhe a área clicável:
          · `px-2` sai. Em `conforto` ele engorda o alvo em volta de uma
            pílula CENTRADA; em `denso` a pílula é o começo da coluna e os 8px
            a empurrariam para fora do prumo do título e da descrição.
          · `-mb-1` entra: (44 − 36) ÷ 2, metade da folga entre o alvo e o
            desenho, devolvida ao layout — a mesma conta e o mesmo motivo do
            `-my-[7px]` de `ALVO_ACAO`. O `<Link>` continua medindo 44px. */}
      {acao && (
        <Link
          href={acao.href}
          className={`mt-1 inline-flex min-h-[var(--altura-controle)] items-center ${denso ? "-mb-1" : "px-2"}`}
        >
          <span className={estiloDaAcao}>{acao.rotulo}</span>
        </Link>
      )}
    </div>
  )
}

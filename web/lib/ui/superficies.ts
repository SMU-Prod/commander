/**
 * QUEM PODE FLUTUAR POR CIMA DO CONTEÚDO, E ONDE.
 *
 * O layout de `(app)` tem hoje UM elemento `fixed` permanente — a bottom-nav
 * (que a partir de `lg` some e vira o trilho lateral) — e UM ponto opcional
 * onde uma tela pode pendurar a própria ação flutuante
 * (`SLOT_ACAO_FLUTUANTE`; hoje só o "Exportar PDF" de `/barco/resumos`).
 * `fixed` não rola: a qualquer momento está em cima de ALGUMA coisa. Este
 * arquivo é o lugar único que governa quem pode flutuar e quanta folga o
 * conteúdo reserva embaixo pra nada terminar coberto — a regra tem teste
 * (`superficies.test.ts`), é medida no navegador (`e2e/sem-saida.spec.ts`)
 * e é grepável.
 *
 * HISTÓRIA (ondas 54–60) — por que este arquivo já foi bem maior: até a
 * onda 60 existia um SEGUNDO `fixed` global, o FAB "+ Registrar"
 * (`RegistroRapido`), montado pelo layout em toda tela. A onda 54 criou
 * aqui as regras de onde ele NÃO podia aparecer (telas de formulário, onde
 * tapava campo; `/navegar`, onde cobria os controles do mapa;
 * `/barco/resumos`, onde empilhava com o "Exportar PDF" e comia o toque
 * dele) e a onda 57 somou a Início à lista (o cartão do Diário ganhou o
 * "Registrar saída", e duas ações principais douradas na mesma tela é uma a
 * mais). A lista de exceções só crescia porque cada onda dava ao gesto uma
 * casa melhor DENTRO do conteúdo — até o dono aposentar o FAB de vez em
 * 16/08/2026: a Início registra pelo cartão do Diário, o Diário tem vaga
 * fixa na bottom-nav e o "Registrar" na `BarraFerramentas`, e as listas têm
 * as próprias ações. O FAB tinha virado duplicata flutuando por cima de
 * conteúdo. `mostrarRegistroRapido`, `ehTelaDeFormulario` e as listas que
 * só existiam pra eles saíram junto (zero consumidores fora deste arquivo —
 * conferido no grep antes de apagar). O registro em si
 * (`registrarVoltaAoMar`) continua vivo pelos caminhos de conteúdo:
 * `/diario/[id]/horas` e a sugestão pós-trilha que leva até lá.
 */

/**
 * Telas que têm uma ação flutuante PRÓPRIA no `SLOT_ACAO_FLUTUANTE`.
 *
 * Hoje é uma só: `/barco/resumos` renderiza `BotaoExportarPdf`. A lista
 * existe por dois motivos:
 *
 * 1. É o registro de quem ocupa o slot — uma tela tem no MÁXIMO uma ação
 *    flutuante, e duas ao mesmo tempo não é opção (são `fixed` nas mesmas
 *    coordenadas: a de cima come o toque da de baixo, e a de baixo fica
 *    invisível e inalcançável — aconteceu de verdade, ver a HISTÓRIA no
 *    comentário do `SLOT_ACAO_FLUTUANTE`).
 * 2. A `MolduraApp` deriva daqui a folga inferior do conteúdo: tela com
 *    ação flutuante precisa da folga maior (`FOLGA_COM_ACAO_FLUTUANTE`)
 *    pra o último elemento da página não terminar embaixo do botão.
 *
 * Se você criar uma nova ação flutuante: use `SLOT_ACAO_FLUTUANTE` e
 * declare a tela aqui — a folga certa vem de graça.
 */
const TEM_ACAO_FLUTUANTE_PROPRIA = new Set([
  "/barco/resumos", // BotaoExportarPdf
])

/** Normaliza `/a/b/` → `/a/b` para a comparação não depender da barra final. */
function normalizar(pathname: string): string {
  const p = pathname.split("?")[0].split("#")[0]
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p
}

/** Esta rota tem uma ação flutuante própria sobre o conteúdo? */
export function temAcaoFlutuantePropria(pathname: string): boolean {
  return TEM_ACAO_FLUTUANTE_PROPRIA.has(normalizar(pathname))
}

/**
 * Folga inferior que o conteúdo precisa para que o último elemento da
 * página NUNCA fique embaixo de um elemento `fixed`.
 *
 * A conta (390×844, medida no navegador):
 * - bottom-nav: 8 (pt-2) + 21 (ícone) + 4 (gap) + ~14 (rótulo 11px) +
 *   max(10, safe-area) de padding + 1 de borda ≈ 58px + safe-area →
 *   `FOLGA_BASE` reserva 4.75rem (76px) + safe-area. É a folga de TODA
 *   tela, porque a bottom-nav está em toda tela.
 * - ação flutuante própria: mora a `5rem + safe-area` do rodapé e tem 48px
 *   de altura (py-3.5 + text-sm) → o topo dela fica a 128px + safe-area do
 *   rodapé → `FOLGA_COM_ACAO_FLUTUANTE` reserva 9rem (144px) + safe-area.
 *   Vale só para quem está em `TEM_ACAO_FLUTUANTE_PROPRIA` — hoje,
 *   `/barco/resumos`.
 *
 * POR QUE A SAFE-AREA É SOMADA E NÃO ASSUMIDA ZERO (lição da onda 54, que
 * continua valendo): o `pb-36` fixo de antigamente (144px) fechava a conta
 * — **em safe-area zero**, que é o caso do navegador de mesa e do
 * Playwright. O app declara `viewportFit: "cover"` (app/layout.tsx), então
 * num iPhone com barra de gestos a safe-area vale ~34px: tudo que é `fixed`
 * sobe ~34px e a folga fixa deixa de cobrir. A conta do comentário antigo
 * estava certa e mesmo assim o botão de salvar ficava tapado — no aparelho
 * de verdade, que é exatamente onde o dono viu. Por isso a folga SOMA a
 * safe-area em vez de torcer para ela ser zero.
 *
 * A PARTIR DE `lg` A CONTA É OUTRA, PORQUE A BARRA SUMIU (onda 57): a
 * bottom-nav é `lg:hidden` (quem navega é o trilho, que é lateral e não
 * come rodapé nenhum), então a folga base cai pra 2rem de respiro. Com ação
 * flutuante própria, ela mora a 1.5rem do rodapé (ver
 * `SLOT_ACAO_FLUTUANTE`): 1.5rem + 48px de botão + respiro fecham em 6rem.
 * O `env(safe-area-inset-bottom)` continua nas variantes `lg` de propósito:
 * `lg` é largura, não "mesa" — um iPad em paisagem passa de 1024px e
 * continua tendo barra de gestos.
 *
 * HISTÓRIA: até a onda 60 estas constantes se chamavam
 * `FOLGA_COM_FAB`/`FOLGA_SEM_FAB` e a MAIOR era a regra — o FAB global
 * "+ Registrar" morava em quase toda tela, e a menor era a exceção das
 * telas de formulário. Com o FAB aposentado a relação inverteu: a folga de
 * bottom-nav é a regra e a maior é exceção de quem tem ação flutuante
 * própria. Os valores não mudaram um pixel; mudou quem usa qual.
 */
export const FOLGA_BASE =
  "pb-[calc(4.75rem_+_env(safe-area-inset-bottom))] lg:pb-[calc(2rem_+_env(safe-area-inset-bottom))]"
export const FOLGA_COM_ACAO_FLUTUANTE =
  "pb-[calc(9rem_+_env(safe-area-inset-bottom))] lg:pb-[calc(6rem_+_env(safe-area-inset-bottom))]"

/**
 * ONDA 57 — LARGURA DO CONTEÚDO POR TAMANHO DE TELA.
 *
 * Até aqui o conteúdo vivia numa coluna de 430px em QUALQUER tela: num
 * notebook de 1440px isso é um app de celular encalhado com mil pixels
 * vazios em volta. O app tinha 42 usos de breakpoint em 109 telas — ou
 * seja, layout de desktop não existia.
 *
 * 430px continua sendo o teto no celular (linha de leitura confortável);
 * a partir de `lg` o conteúdo respira até 1400px ao lado do trilho.
 *
 * Mora aqui, e não solto na `MolduraApp`, pelo mesmo motivo das folgas: é a
 * medida que precisa combinar com o trilho logo abaixo. Quem mudar uma sem
 * a outra deixa o conteúdo embaixo da navegação.
 */
export const LARGURA_CONTEUDO = "max-w-[430px] md:max-w-[680px] lg:max-w-[1400px]"

/**
 * Espaço que o trilho de 72px (`components/trilho-lateral.tsx`) ocupa a
 * partir de `lg`.
 *
 * São 88px e não 72px porque o trilho é `fixed`: ele sai do fluxo, então o
 * conteúdo passaria POR BAIXO dele sem este empurrão. 72 do trilho + 16 de
 * respiro — sem os 16, numa tela de exatamente 1024px o primeiro cartão
 * encosta na borda do trilho (a conta fecha em zero: `mx-auto` não sobra
 * margem nenhuma nessa largura). 16 é o mesmo gutter do `px-4` que o
 * `pl` daqui substitui do lado esquerdo.
 *
 * SIM, ESTE `pl` VENCE O `px-4` — MEDIDO, NÃO DEDUZIDO (revisão da onda 57).
 * `getComputedStyle` da `[data-moldura]` devolve `padding-left: 88px` em
 * 1024, 1440 e 1920, e `padding-right: 16px`. É a ordenação de utilitários do
 * Tailwind (`pl-*` depois de `px-*` na mesma camada) e não sorte de
 * especificidade — mas ela não está escrita em lugar nenhum do nosso código,
 * então `e2e/sem-saida.spec.ts` trava o valor: se um dia o `pl` perder, o
 * conteúdo passa por baixo do trilho em TODO o desktop, e a varredura não
 * pegaria (não é sobreposição de dois elementos do fluxo, nem estouro).
 *
 * E O CONTEÚDO NÃO FICA TORTO ACIMA DE 1400px — TAMBÉM MEDIDO. A suspeita era
 * que `mx-auto` + `max-w-[1400px]` + este `pl` empurrassem o conteúdo pra
 * direita do centro óptico. Não empurram, e a conta fecha em qualquer
 * largura: o conteúdo começa em `caixa + 88` e termina em `caixa + largura -
 * 16`, e como os 88 são 72 (o trilho) + 16 (o gutter), o que sobra dos dois
 * lados DEPOIS do trilho é sempre igual. Medido a 1920px: caixa de 260 a
 * 1660, conteúdo de 348 a 1644 — 276px de folga entre o trilho e o conteúdo,
 * 276px entre o conteúdo e a borda direita. A 1440px: 36 e 36. O centro do
 * conteúdo fica 36px à direita do centro da VIEWPORT, que é exatamente meia
 * largura de trilho — ou seja, centrado no espaço que sobra ao lado dele, que
 * é o centro que o olho usa.
 */
export const OFFSET_TRILHO = "lg:pl-[88px]"

/**
 * O ÚNICO lugar onde uma ação flutuante pode morar: canto inferior direito,
 * logo acima da bottom-nav.
 *
 * HISTÓRIA (onda 54) — por que isto é uma constante e não classes escritas
 * em cada componente: a pior colisão que o app já teve nasceu de dois
 * componentes escreverem essas coordenadas à mão, iguais, sem saber um do
 * outro (o FAB global "+ Registrar", hoje aposentado, e o
 * `BotaoExportarPdf` — classe por classe, até o `z-20`). Em
 * `/barco/resumos` os dois ficavam empilhados no mesmo ponto, para sempre:
 * o que aparecia era uma pílula Frankenstein com o ícone de relatório do
 * botão de baixo e o texto "+ Registrar" do de cima — e tocar nela nunca
 * exportava PDF, porque quem recebe o toque é o de cima. Com a posição num
 * lugar só, um `grep` por `SLOT_ACAO_FLUTUANTE` lista todo mundo que ocupa
 * o espaço, e o registro de quem pode vive em `TEM_ACAO_FLUTUANTE_PROPRIA`.
 *
 * Se você for criar uma nova ação flutuante: use esta constante e declare a
 * tela em `TEM_ACAO_FLUTUANTE_PROPRIA`. Duas ao mesmo tempo na mesma tela
 * não é uma opção — a de cima come o toque da de baixo, e a de baixo fica
 * invisível e inalcançável.
 *
 * ONDA 57 (revisão) — OS 5rem SÃO A ALTURA DA BARRA DE BAIXO, E ELA NÃO
 * EXISTE NO DESKTOP.
 *
 * `bottom-[5rem]` nunca foi uma medida estética: são os ~58px da bottom-nav
 * mais respiro, pra pastilha não encostar nela. A partir de `lg` a barra é
 * `lg:hidden` — e o botão continuava pairando a 80px do rodapé, sobre 80px
 * de nada (medido: `bottomGap` de 80px igual ao do celular). 1.5rem = 24px,
 * degrau da escala de espaçamento (docs/DESIGN.md §5), e o mesmo respiro
 * que o `px-4`/`right-4` já dá do lado. A safe-area continua somada: ver o
 * comentário das folgas acima.
 */
export const SLOT_ACAO_FLUTUANTE =
  "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-20 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-acao-texto shadow-lg shadow-accent/30"

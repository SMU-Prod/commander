/**
 * ONDA 54 — QUEM PODE FLUTUAR POR CIMA DO CONTEÚDO, E ONDE.
 *
 * O problema que este arquivo resolve: o layout de `(app)` tem DOIS
 * elementos `fixed` (a bottom-nav e o botão "+ Registrar"). `fixed` não
 * rola: os dois acompanham a viewport e, a qualquer momento, estão em cima
 * de ALGUMA coisa. Numa tela de lista isso é o preço conhecido de um FAB —
 * a pessoa rola e o que estava coberto aparece. Numa tela de FORMULÁRIO o
 * que fica coberto é campo de formulário, e aí o custo muda de natureza:
 * o rótulo aparece cortado e o toque destinado ao campo cai no botão.
 * Medido em `/barco/itens/novo` (varredura de 15/08/2026): o "+ Registrar"
 * em cima do campo "Horas no último serviço".
 *
 * A DECISÃO: o "+ Registrar" NÃO aparece em tela de criação/edição.
 *
 * Justificativa de produto, não de layout. O FAB é um atalho para
 * "registrar volta ao mar" — um gesto de quem está NAVEGANDO pelo app e
 * lembrou de anotar as horas. Quem está numa tela de criação já está
 * preenchendo alguma coisa; oferecer ali um atalho para criar OUTRA coisa
 * (que ainda por cima descarta o que está sendo digitado, porque abre um
 * modal por cima) não é conveniência, é ruído. Some o ruído e some junto a
 * sobreposição — a causa raiz é a mesma.
 *
 * POR QUE UMA REGRA POR ROTA E NÃO UM `hidden` EM CADA TELA: um `hidden`
 * por arquivo é uma regra invisível espalhada por ~25 páginas, que a
 * próxima tela de formulário vai nascer sem. Aqui a regra é uma só, tem
 * teste (`superficies.test.ts`) e é grepável.
 *
 * POR QUE NÃO DETECTAR `<form>` NO DOM: metade das telas de LISTA do app
 * tem `<form>` (filtro, ação rápida, upload) — `/barco`, `/financeiro`,
 * `/diario` e `/marketplace` inclusive. O sinal seria falso na maioria dos
 * casos e o FAB sumiria justamente de onde ele serve.
 */

/**
 * Últimos segmentos que, no vocabulário deste app, significam "esta tela é
 * um formulário de corpo inteiro". `novo`/`nova` (criação), `editar`
 * (edição), `importar` (`/diario/importar`), `transferir`
 * (`/barco/transferir`) e `horas` (`/diario/[id]/horas` — que é literalmente
 * o mesmo registro que o FAB faz, então lá ele é redundante além de
 * atrapalhar).
 *
 * É sufixo e não caminho completo de propósito: rota nova que siga a
 * convenção (`/qualquer/coisa/nova`) já nasce coberta.
 */
const VERBOS_DE_FORMULARIO = new Set(["novo", "nova", "editar", "importar", "transferir", "horas"])

/**
 * Telas de formulário que NÃO seguem a convenção de sufixo acima. Lista
 * curta e explícita — cada uma foi conferida na varredura de 15/08/2026.
 * Se você criar uma tela de formulário com nome de substantivo, ela entra
 * aqui (ou, melhor, ganha um sufixo da lista de cima).
 */
const FORMULARIOS_SEM_VERBO = new Set([
  "/barco/contatos", // cadastro de contatos da embarcação
  "/barco/local", // coordenadas da marina
  "/barco/selos/gold", // contratação do selo (porte, quem paga, pagamento)
  "/prestadores/perfil", // cadastro do perfil profissional
  "/comandantes/perfil", // idem, lado comandante
  "/menu/perfil", // dados da conta
])

/**
 * Telas que JÁ TÊM uma ação flutuante própria, no mesmo canto.
 *
 * `/barco/resumos` renderiza `BotaoExportarPdf`, e ele usa exatamente as
 * mesmas coordenadas do "+ Registrar" — `fixed bottom-[calc(5rem +
 * env(safe-area-inset-bottom))] right-4 z-20`, classe por classe. Não é
 * "um cobre o outro ao rolar": são dois botões empilhados no mesmo ponto,
 * para sempre. O que aparecia na tela era uma pílula Frankenstein com o
 * ícone de relatório do botão de baixo e o texto "+ Registrar" do de cima —
 * e tocar nela nunca exportava PDF, porque quem recebe o toque é o de cima.
 * A função "Exportar PDF" estava simplesmente inalcançável no celular.
 *
 * A regra: uma tela tem UMA ação flutuante, e quem ganha é a da própria
 * tela. Mesmo princípio que já tinha tirado o FAB de `/navegar`.
 */
const TEM_ACAO_FLUTUANTE_PROPRIA = new Set([
  "/barco/resumos", // BotaoExportarPdf
])

/** Normaliza `/a/b/` → `/a/b` para a comparação não depender da barra final. */
function normalizar(pathname: string): string {
  const p = pathname.split("?")[0].split("#")[0]
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p
}

/** A pessoa está preenchendo um formulário nesta rota? */
export function ehTelaDeFormulario(pathname: string): boolean {
  const p = normalizar(pathname)
  if (FORMULARIOS_SEM_VERBO.has(p)) return true
  const ultimo = p.split("/").filter(Boolean).at(-1)
  return ultimo != null && VERBOS_DE_FORMULARIO.has(ultimo)
}

/**
 * O botão flutuante "+ Registrar" deve aparecer nesta rota?
 *
 * Três exceções, nesta ordem:
 * 1. `/navegar` — no mapa o FAB cobria os controles de navegação, e lá o
 *    registro de horas já tem casa própria (a sugestão pós-trilha do Livro
 *    de Bordo). Regra que já existia antes desta onda, preservada.
 * 2. Telas que já têm ação flutuante própria — ver
 *    `TEM_ACAO_FLUTUANTE_PROPRIA`.
 * 3. Telas de formulário — ver o cabeçalho deste arquivo.
 */
export function mostrarRegistroRapido(pathname: string): boolean {
  const p = normalizar(pathname)
  if (p === "/navegar") return false
  if (TEM_ACAO_FLUTUANTE_PROPRIA.has(p)) return false
  return !ehTelaDeFormulario(p)
}

/**
 * Folga inferior que o conteúdo precisa para que o último elemento da
 * página NUNCA fique embaixo de um elemento `fixed`.
 *
 * A conta (390×844, medida no navegador):
 * - bottom-nav: 8 (pt-2) + 21 (ícone) + 4 (gap) + ~12 (rótulo 9.5px) +
 *   max(10, safe-area) de padding + 1 de borda ≈ 56px + safe-area.
 * - "+ Registrar": mora a `5rem + safe-area` do rodapé e tem 48px de altura
 *   (py-3.5 + text-sm) → o topo dele fica a 128px + safe-area do rodapé.
 *
 * POR QUE O `pb-36` ANTIGO QUEBRAVA MESMO COM A CONTA CERTA: 36 = 9rem =
 * 144px, folga suficiente para os 128px do FAB — **em safe-area zero**, que
 * é o caso do navegador de mesa e do Playwright. O app declara
 * `viewportFit: "cover"` (app/layout.tsx), então num iPhone com barra de
 * gestos a safe-area vale ~34px: o FAB sobe para 162px e os 144px fixos
 * deixam de cobrir. Ou seja, a conta do comentário antigo estava certa e
 * mesmo assim o botão de salvar ficava tapado — no aparelho de verdade, que
 * é exatamente onde o dono viu. Por isso a folga agora SOMA a safe-area em
 * vez de torcer para ela ser zero.
 *
 * E por que dois valores: sem o FAB (tela de formulário) só a bottom-nav
 * flutua, e reservar 9rem ali deixava um vazio de ~90px embaixo de todo
 * formulário — espaço morto que não tem motivo de existir.
 */
export const FOLGA_COM_FAB = "pb-[calc(9rem_+_env(safe-area-inset-bottom))]"
export const FOLGA_SEM_FAB = "pb-[calc(4.75rem_+_env(safe-area-inset-bottom))]"

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
 */
export const OFFSET_TRILHO = "lg:pl-[88px]"

/**
 * O ÚNICO lugar onde uma ação flutuante pode morar: canto inferior direito,
 * logo acima da bottom-nav.
 *
 * Existe como constante porque a colisão que esta onda consertou nasceu de
 * dois componentes escreverem essas coordenadas à mão, iguais, sem saber um
 * do outro (`RegistroRapido` e `BotaoExportarPdf` — classe por classe, até o
 * `z-20`). Com a posição num lugar só, um `grep` por `SLOT_ACAO_FLUTUANTE`
 * lista todo mundo que disputa o espaço, e a regra de quem ganha em cada
 * tela vive logo acima, em `mostrarRegistroRapido`.
 *
 * Se você for criar uma terceira ação flutuante: use esta constante e
 * declare a tela em `TEM_ACAO_FLUTUANTE_PROPRIA`. Duas ao mesmo tempo na
 * mesma tela não é uma opção — a de cima come o toque da de baixo, e a de
 * baixo fica invisível e inalcançável.
 */
export const SLOT_ACAO_FLUTUANTE =
  "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-acao-texto shadow-lg shadow-accent/30"

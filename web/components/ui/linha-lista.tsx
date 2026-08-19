import Link from "next/link"
import type { ReactNode } from "react"
import { Icone } from "@/components/icone"
import { TOQUE_AMPLO } from "@/lib/ui/acoes"

/**
 * Linha clicável (ou não) de uma lista: ícone/avatar à esquerda, título +
 * subtítulo opcional no meio, valor à direita, chevron quando navega.
 * Hoje essa linha era reescrita em cada tela com espaçamentos ligeiramente
 * diferentes — aqui vira um único componente.
 *
 * Quando usar: qualquer linha de lista de "coisas que a pessoa toca pra ver
 * mais" (motores, documentos, avisos, histórico...). Duas variantes:
 * - `variant="grupo"` (padrão): linha dentro de um painel já com borda
 *   (`<div className="sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel px-4">`),
 *   separada por `border-b`, sem borda própria — é a mais comum.
 * - `variant="cartao"`: linha que É o próprio cartão (sombra e borda
 *   próprias), usada quando a lista não tem um painel-mãe (ex.: alertas
 *   soltos de /hoje).
 * Para uma direita totalmente customizada (ex.: um link "Adicionar", ou um
 * form de upload), use `trailing` — ele substitui `valor`/`valorSecundario`.
 * Se `trailing` tiver seu próprio link/botão/form E a linha também tiver
 * `href`, só o bloco título/subtítulo vira link — nunca a linha inteira,
 * pra não aninhar um `<a>`/`<form>` dentro de outro `<a>` (HTML inválido).
 */
export function LinhaLista({
  href,
  leading,
  titulo,
  subtitulo,
  chips,
  valor,
  valorSecundario,
  valorClassName = "",
  trailing,
  chevron,
  variant = "grupo",
  className = "",
}: {
  href?: string
  leading?: ReactNode
  titulo: ReactNode
  subtitulo?: ReactNode
  /** ONDA 91 (achado 1.2) — ONDE OS CHIPS PASSAM A CABER.
   *  A régua do spec (§3, item 6) é "2 linhas de texto + 3 chips em ~64px", e
   *  a nossa linha densa já estava nos 64px: o que faltava não era altura,
   *  era CARGA — os props iam de `titulo` a `chevron` e não havia slot de
   *  chip nenhum. Quem quis chip escreveu à mão, e foi assim que o cartão do
   *  Diário virou 120px pra entregar o que a referência entrega em 64.
   *  Use `ChipDado` (`components/ui/chip.tsx`) aqui dentro. */
  chips?: ReactNode
  valor?: ReactNode
  /** Segunda linha, menor e neutra, abaixo do valor (ex.: "~30 dias"). */
  valorSecundario?: ReactNode
  /** Classe de cor/peso pro valor — ex.: "text-crit" quando vencido. */
  valorClassName?: string
  /** Substitui valor + chevron por conteúdo livre à direita (pode ter seu próprio link/form). */
  trailing?: ReactNode
  /** Força mostrar/esconder o chevron. Padrão: aparece quando há `href` e não
   *  há `trailing`. Com `trailing`, a seta pedida por aqui é desenhada DENTRO
   *  do link do miolo — ver o `return` desse ramo. */
  chevron?: boolean
  variant?: "grupo" | "cartao"
  className?: string
}) {
  // Onda 56 — era `truncate` (uma linha + reticências) nos dois. Num app de
  // 390px de largura isso matava justamente a informação que a linha existe
  // pra dar: o Menu mostrava "Peça profissional, tripulação, peça, vaga ou
  // caminh…", "Repasse, gasto e devolução — controle contá…", e um título
  // inteiro virava "É marina, posto, pousada, restaurante ou lo…". Reticência
  // faz sentido quando o resto é dispensável (um nome longo ao lado de um
  // valor); não faz quando o texto É a explicação do destino.
  // `line-clamp-2` em vez de deixar solto: o teto de duas linhas preserva o
  // ritmo da lista (nenhuma linha vira parágrafo) e a altura só cresce no
  // caso que realmente precisa — a maioria continua em uma linha.
  const meio = (
    <div className="min-w-0 flex-1">
      <p className="titulo-card line-clamp-2">{titulo}</p>
      {subtitulo && <p className="apoio mt-0.5 line-clamp-2 text-dim">{subtitulo}</p>}
      {/* Abaixo do subtítulo e não ao lado do valor: na referência os chips
          são a SEGUNDA linha do bloco de texto, e é isso que os deixa
          truncar/quebrar com a mesma largura do título em vez de disputar
          espaço com o número da direita. `gap-1.5` é o mesmo respiro de
          `ChipLinha` — a fila de chips do app tem um só. */}
      {chips && <div className="mt-1 flex flex-wrap gap-1.5">{chips}</div>}
    </div>
  )
  // ONDA 87 — `.valor` no lugar de `text-sm`. Os dois dão 14px; a classe
  // traz junto o que fazia falta (branco, peso médio, tabular), e é ela que
  // faz o par rótulo-cinza / valor-branco existir na tela em vez de só no
  // CSS. `font-semibold` continua escrito: a linha de lista já era 600 e
  // esta onda não deixa valor nenhum mais fraco do que estava.
  const direita = trailing ?? (valor != null && (
    <span className="shrink-0 text-right">
      <p className={`font-mono-instr valor font-semibold ${valorClassName}`}>{valor}</p>
      {valorSecundario && <p className="apoio font-mono-instr tabular-nums text-dim">{valorSecundario}</p>}
    </span>
  ))
  // `var(--raio-cartao)`, não `14px` cravado — mesma razão do `Cartao`, que
  // esta linha acompanha dentro da Início (revisão da onda 57).
  // ONDA 91 (achado 2.4) — `p-3` no lugar de `p-3.5`. O gesto "cartão" tinha
  // três paddings (12, 14 e 16px) em três componentes, e 14px nem degrau da
  // escala base-8 é (docs/DESIGN.md §5). O valor que fica é o de `Cartao`,
  // que é o único dos três com a decisão escrita: "a referência é densa".
  // ONDA 98 (HAULIX §27 + §49) — A LINHA CLICÁVEL GANHA O DEGRAU DE HOVER.
  // O §27 descreve a linha de lista com um hover que, na escada do §22, é
  // subir um nível de superfície a partir do chão em que a linha está. Era
  // o retorno que faltava no desktop: `TOQUE_AMPLO` responde ao DEDO (onda
  // 84) e não ao ponteiro, então no trilho/notebook a lista inteira era
  // inerte até o clique. Só entra onde o toque LEVA a algum lugar — mesma
  // condição do `TOQUE_AMPLO`, pelo mesmo motivo: numa linha de exibição pura
  // o realce seria mentira.
  const linhaInteiraClicavel = !!href && trailing == null
  const hover = linhaInteiraClicavel ? "transition-colors hover:bg-panel2" : ""
  const base = variant === "cartao"
    ? "sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3"
    : "border-b border-line py-3 last:border-0"
  // ONDA 84 — a confirmação de toque só entra onde o toque LEVA a algum
  // lugar. Numa linha de exibição pura o `active:` seria mentira: ela
  // afundaria e nada aconteceria. E com `trailing` a linha inteira também não
  // vale — ali só o miolo é link (ver o `return` logo abaixo), então afundar
  // a linha toda ao tocar no botão da direita apontaria para o alvo errado.
  // `TOQUE_AMPLO` e não `TOQUE` porque 3% numa linha de 358px é a tela
  // inteira tremendo (ver `lib/ui/acoes.ts`).
  const cls = `flex items-center gap-3 ${base} ${hover} ${linhaInteiraClicavel ? TOQUE_AMPLO : ""} ${className}`

  // ONDA 91 — O `chevron` ERA IGNORADO NO RAMO DE BAIXO, e isso era defeito,
  // não desenho: o `return` antecipado do caso `href` + `trailing` montava o
  // JSX sem consultar a prop, então `chevron={true}` ali não fazia nada. Uma
  // linha que NAVEGA e traz um `Selo` "Incompleto" à direita ficava sem a
  // única marca de que ela leva a algum lugar. O cálculo subiu para antes dos
  // dois ramos; o padrão não mudou (com `trailing`, continua escondida), então
  // quem não pedir a seta não ganha seta.
  const mostrarChevron = chevron ?? (!!href && trailing == null)
  const seta = <Icone nome="chevron" className="size-4 shrink-0 text-dim" />

  if (href && trailing != null) {
    // trailing tem interação própria — link só no bloco título/subtítulo.
    return (
      <div className={cls}>
        {leading}
        {/* A seta entra DENTRO do link, e não ao lado dele: fora, ela seria um
            enfeite não clicável apontando para um alvo que não é ela — o dedo
            que mira a seta acertaria o `trailing`, que faz outra coisa.
            O `flex` só aparece quando há seta, para que as linhas que não
            pedem chevron continuem renderizando byte por byte o que já
            renderizavam. */}
        <Link
          href={href}
          className={`min-w-0 flex-1 ${TOQUE_AMPLO} ${mostrarChevron ? "flex items-center gap-3" : ""}`}
        >
          {meio}
          {mostrarChevron && seta}
        </Link>
        {direita}
      </div>
    )
  }

  const conteudo = (
    <>
      {leading}
      {meio}
      {direita}
      {mostrarChevron && seta}
    </>
  )
  return href ? <Link href={href} className={cls}>{conteudo}</Link> : <div className={cls}>{conteudo}</div>
}

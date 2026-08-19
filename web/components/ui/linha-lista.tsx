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
 *   (`<div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">`),
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
  valor?: ReactNode
  /** Segunda linha, menor e neutra, abaixo do valor (ex.: "~30 dias"). */
  valorSecundario?: ReactNode
  /** Classe de cor/peso pro valor — ex.: "text-crit" quando vencido. */
  valorClassName?: string
  /** Substitui valor + chevron por conteúdo livre à direita (pode ter seu próprio link/form). */
  trailing?: ReactNode
  /** Força mostrar/esconder o chevron. Padrão: aparece quando há `href` e não há `trailing`. */
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
    </div>
  )
  const direita = trailing ?? (valor != null && (
    <span className="shrink-0 text-right">
      <p className={`font-mono-instr text-sm font-semibold tabular-nums ${valorClassName}`}>{valor}</p>
      {valorSecundario && <p className="apoio font-mono-instr tabular-nums text-dim">{valorSecundario}</p>}
    </span>
  ))
  // `var(--raio-cartao)`, não `14px` cravado — mesma razão do `Cartao`, que
  // esta linha acompanha dentro da Início (revisão da onda 57).
  const base = variant === "cartao"
    ? "sombra-1 rounded-[var(--raio-cartao)] border border-line bg-panel p-3.5"
    : "border-b border-line py-3 last:border-0"
  // ONDA 84 — a confirmação de toque só entra onde o toque LEVA a algum
  // lugar. Numa linha de exibição pura o `active:` seria mentira: ela
  // afundaria e nada aconteceria. E com `trailing` a linha inteira também não
  // vale — ali só o miolo é link (ver o `return` logo abaixo), então afundar
  // a linha toda ao tocar no botão da direita apontaria para o alvo errado.
  // `TOQUE_AMPLO` e não `TOQUE` porque 3% numa linha de 358px é a tela
  // inteira tremendo (ver `lib/ui/acoes.ts`).
  const linhaInteiraClicavel = !!href && trailing == null
  const cls = `flex items-center gap-3 ${base} ${linhaInteiraClicavel ? TOQUE_AMPLO : ""} ${className}`

  if (href && trailing != null) {
    // trailing tem interação própria — link só no bloco título/subtítulo.
    return (
      <div className={cls}>
        {leading}
        <Link href={href} className={`min-w-0 flex-1 ${TOQUE_AMPLO}`}>{meio}</Link>
        {direita}
      </div>
    )
  }

  const mostrarChevron = chevron ?? (!!href && trailing == null)
  const conteudo = (
    <>
      {leading}
      {meio}
      {direita}
      {mostrarChevron && <Icone nome="chevron" className="size-4 shrink-0 text-dim" />}
    </>
  )
  return href ? <Link href={href} className={cls}>{conteudo}</Link> : <div className={cls}>{conteudo}</div>
}

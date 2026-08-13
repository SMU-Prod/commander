import Link from "next/link"
import type { ReactNode } from "react"
import { Icone } from "@/components/icone"

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
  const meio = (
    <div className="min-w-0 flex-1">
      <p className="titulo-card truncate">{titulo}</p>
      {subtitulo && <p className="apoio mt-0.5 truncate text-dim">{subtitulo}</p>}
    </div>
  )
  const direita = trailing ?? (valor != null && (
    <span className="shrink-0 text-right">
      <p className={`font-mono-instr text-sm font-semibold tabular-nums ${valorClassName}`}>{valor}</p>
      {valorSecundario && <p className="apoio font-mono-instr tabular-nums text-dim">{valorSecundario}</p>}
    </span>
  ))
  const base = variant === "cartao"
    ? "sombra-1 rounded-[14px] border border-line bg-panel p-3.5"
    : "border-b border-line py-3 last:border-0"
  const cls = `flex items-center gap-3 ${base} ${className}`

  if (href && trailing != null) {
    // trailing tem interação própria — link só no bloco título/subtítulo.
    return (
      <div className={cls}>
        {leading}
        <Link href={href} className="min-w-0 flex-1">{meio}</Link>
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

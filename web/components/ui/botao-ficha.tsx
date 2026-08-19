import Link from "next/link"
import { Icone, type NomeIcone } from "@/components/icone"
import { TOQUE } from "@/lib/ui/acoes"

/**
 * BOTÃO DE FICHA — a barra de ações do cabeçalho de detalhe da referência:
 * "Maintenance" + "Take Offline" (contorno) + "Activate Route" (preenchido)
 * + "···" (`BotaoCirculo`, já existe). Vai dentro do slot `acoes` de
 * `CabecalhoDetalhe` (onda 60) — este componente NÃO substitui o cabeçalho,
 * só padroniza o desenho dos botões que moram nele.
 *
 * SÓ UM `preenchido` POR TELA — DESIGN.md §5 (o orçamento de dois dourados
 * já vale para o `--acao` atual). Este componente não trava isso (não sabe
 * quantas vezes foi chamado na mesma árvore); é responsabilidade de quem
 * monta a tela. A ficha de equipamento, por sinal, não usa `preenchido`
 * aqui — o CTA "Informar leitura" já mora colado no horímetro (onda 62,
 * comentário na própria página), e repetir a mesma ação em dois lugares é
 * exatamente o que a onda 63 (`docs/DESIGN.md` §5, "ação que se repete não
 * é ação principal") baniu.
 *
 * `classesBotaoFicha`/`BASE_BOTAO_FICHA` saem exportados à parte porque o
 * botão de EXCLUIR desta mesma barra não é um link nem um botão simples —
 * é o `<Confirmar>` (`components/confirmar.tsx`, já existe, client
 * component de duas etapas) vestido com a MESMA pílula, só que na cor de
 * destrutivo. `BASE_BOTAO_FICHA` (sem cor nenhuma) é o que serve esse caso:
 * compor `${BASE_BOTAO_FICHA} border-crit/30 text-crit` a partir da base
 * pura. NÃO existe uma forma "pegue `classesBotaoFicha('contorno')` e some
 * classe de cor por cima" — Tailwind não garante que a última classe do
 * `className` vença uma que já está lá (a ordem que decide é a do CSS
 * gerado, não a do atributo); duas classes de `border-*`/`text-*` no MESMO
 * elemento é loteria. Por isso a base fica separada da cor.
 */
export type VarianteBotaoFicha = "contorno" | "preenchido"

// `TOQUE` entra na BASE (onda 84) de propósito: o botão de excluir compõe a
// partir dela, e a confirmação de toque tem que valer para ele também — é o
// controle onde a dúvida "será que pegou?" custa mais caro.
export const BASE_BOTAO_FICHA = `flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--raio-pilula)] border px-4 text-sm font-medium ${TOQUE}`

export function classesBotaoFicha(variante: VarianteBotaoFicha, className = ""): string {
  const cor = variante === "preenchido"
    ? "border-accent bg-accent font-semibold text-acao-texto"
    : "border-line bg-panel text-texto"
  return `${BASE_BOTAO_FICHA} ${cor} ${className}`.trim()
}

export function BotaoFicha({
  icone,
  href,
  onClick,
  variante = "contorno",
  className = "",
  children,
}: {
  icone?: NomeIcone
  href?: string
  onClick?: () => void
  variante?: VarianteBotaoFicha
  className?: string
  children: React.ReactNode
}) {
  const conteudo = (
    <>
      {icone && <Icone nome={icone} className="size-4 shrink-0" />}
      {children}
    </>
  )
  const cls = classesBotaoFicha(variante, className)
  if (href) {
    return (
      <Link href={href} className={cls}>
        {conteudo}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {conteudo}
    </button>
  )
}

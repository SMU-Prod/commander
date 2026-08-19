import Link from "next/link"
import { Icone } from "@/components/icone"

/**
 * MIGALHA DE PÃO — "Dashboard / Fleet Vehicles / TX-4821-HX" da referência,
 * acima do título da ficha. Casa (`inicio`) + trilha + item atual em
 * destaque, separados por um chevron rotacionado.
 *
 * ONDA 79 — o Commander já tinha "voltar um nível" (o link "Voltar" de
 * `CabecalhoDetalhe`, uppercase mono dourado — `docs/DESIGN.md` §5 registra
 * essa forma como intencional, "a referência, então fica") mas não tinha
 * "onde eu estou na hierarquia inteira". São coisas diferentes: Voltar é
 * uma aresta (a tela anterior); a migalha é o caminho (todas as telas até
 * aqui). Por isso este componente SOMA à `CabecalhoDetalhe`, não substitui —
 * numa ficha as duas aparecem, a migalha em cima do "Voltar".
 *
 * O último item NUNCA é link — é onde a pessoa já está; clicar nele não
 * faria nada, e "clique morto" é o que `docs/CONTRIBUTING.md` proíbe.
 */
export function MigalhaPao({
  itens,
  className = "",
}: {
  /** Do mais alto ao atual. O ÚLTIMO item não leva `href` — é a página
   *  corrente (`aria-current="page"`), os anteriores navegam. */
  itens: { rotulo: string; href?: string }[]
  className?: string
}) {
  return (
    <nav aria-label="Caminho" className={`rolagem-lateral flex items-center gap-1.5 overflow-x-auto whitespace-nowrap ${className}`}>
      <Icone nome="inicio" className="size-3.5 shrink-0 text-dim" />
      {itens.map((item, i) => {
        const ultimo = i === itens.length - 1
        return (
          <span key={`${item.rotulo}-${i}`} className="flex shrink-0 items-center gap-1.5">
            {i > 0 && <Icone nome="chevron" className="size-3 shrink-0 text-dim" />}
            {item.href && !ultimo ? (
              <Link href={item.href} className="rotulo-dado text-dim hover:text-texto">
                {item.rotulo}
              </Link>
            ) : (
              <span aria-current={ultimo ? "page" : undefined} className={`rotulo-dado ${ultimo ? "font-semibold text-texto" : "text-dim"}`}>
                {item.rotulo}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

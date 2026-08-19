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
            {/* ONDA 94 — O ALVO QUE NÃO EXISTIA.
                Estes links eram `.rotulo-dado` puro: 11px de fonte por 1,4 de
                entrelinha, ou seja, **15px de alvo de toque** — um terço da
                régua de 44px, e o menor alvo clicável que a varredura de
                `components/ui/` encontrou. Num app usado com a mão molhada, no
                sol, com o barco balançando, uma faixa de 15px é uma navegação
                que só funciona parado no sofá.
                A técnica é a mesma de `ALVO_ACAO` e `BotaoCirculo` (ver
                `lib/ui/acoes.ts`): o ALVO lê `--altura-controle` e a margem
                negativa devolve ao layout a folga que sobra, pra migalha
                continuar sendo a linha fina que ela precisa ser — engordar a
                trilha em 29px empurraria o título de cinco fichas pra baixo, e
                a migalha viraria a peça mais alta do topo, que é o contrário
                da hierarquia que ela serve.
                Os 14px são (44 − 15) ÷ 2, arredondados pra baixo; literais e
                não interpolados porque o Tailwind varre a classe escrita. */}
            {item.href && !ultimo ? (
              <Link
                href={item.href}
                className="rotulo-dado -my-[14px] inline-flex min-h-[var(--altura-controle)] items-center text-dim hover:text-texto"
              >
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

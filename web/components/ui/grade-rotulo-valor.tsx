import type { ReactNode } from "react"

/**
 * GRADE RÓTULO/VALOR — o par "Client / TechFlow Inc.", "Risk score / 15%"
 * em duas colunas dentro do painel de detalhe da referência. Spec §3, item
 * 6. O Commander já tinha essa anatomia escrita à mão (o `<dl>` de "Dados"
 * na ficha de equipamento) — este componente é ela extraída, pra não
 * derivar de tela em tela como a pílula de filtro derivou antes do `Chip`
 * (onda 56).
 *
 * O rótulo usa `.rotulo-dado` (caixa de frase), não `.rotulo` — é
 * literalmente o par que a varredura da referência mediu ("Client",
 * "Destination", não "CLIENT", "DESTINATION"). Ver o comentário da classe
 * em `app/globals.css` pro porquê de ser uma classe nova, e não o `.rotulo`
 * trocado.
 */
export function GradeRotuloValor({
  itens,
  className = "",
}: {
  /** `[rótulo, valor]`. Valor `null`/`undefined` vira "—" — mesma régua de
   *  honestidade do `<dl>` original: campo sem dado mostra que não tem
   *  dado, não finge um valor. */
  itens: [string, ReactNode][]
  className?: string
}) {
  return (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 ${className}`}>
      {itens.map(([rotulo, valor], i) => (
        <div key={`${rotulo}-${i}`} className="min-w-0">
          <dt className="rotulo-dado truncate text-dim">{rotulo}</dt>
          <dd className="corpo mt-0.5 font-medium">
            {valor == null || valor === "" ? <span className="font-normal text-dim">—</span> : valor}
          </dd>
        </div>
      ))}
    </dl>
  )
}

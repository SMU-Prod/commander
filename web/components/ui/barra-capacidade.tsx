import { Icone, type NomeIcone } from "@/components/icone"
import { BORDA_TOM, formatarNumero, FUNDO_TOM, tomPorUso } from "./instrumento"

/**
 * BARRA DE CAPACIDADE — `28 700 / 44 000 lbs · 65%` da referência (cota de
 * fotos, capacidade elétrica, peso a bordo). Spec §2, item 3.
 *
 * A anatomia inteira existe para responder DUAS perguntas de uma vez, que é o
 * que a referência faz e o nosso `Kpi` não fazia: quanto foi usado (o número
 * forte, em mono) e quanto isso é do teto (o chip e a barra). Por isso o total
 * fica dim e menor — ele é a régua, não a notícia.
 *
 * DUAS TRAVAS QUE O TESTE GUARDA:
 *
 * - ACIMA DE 100% NÃO ESTOURA. `tomPorUso`/`percentualPreso` prendem em 100 e
 *   a barra pinta cheia em vermelho. Uma barra que vaza do trilho é o tipo de
 *   defeito que só aparece no dado real do cliente, nunca no dado de exemplo.
 * - ZERO NÃO É VERDE. Ocupação zero cai em `neutro` (cinza), porque neste app
 *   "0 de 44 000" quase sempre é "ninguém preencheu" — ver `tomPorUso`.
 */
export function BarraCapacidade({
  usado,
  total,
  unidade,
  unidadeAntes = false,
  rotulo,
  icone,
  className = "",
}: {
  /** `null` = sem leitura. */
  usado: number | null
  total: number
  unidade: string
  /**
   * Onda 79 (wiring) — a referência só tem unidade depois do número
   * ("44 000 lbs"): nenhuma tela nossa até aqui precisava de outra ordem.
   * `R$` em português vem ANTES ("R$ 9.876,54"), nunca depois — colar como
   * sufixo leria como erro de digitação, não como dinheiro. Opcional e
   * `false` por padrão para não mexer em nenhuma tela existente.
   */
  unidadeAntes?: boolean
  /** O rótulo miúdo embaixo da barra ("Weight capacity" na referência). */
  rotulo: string
  icone?: NomeIcone
  className?: string
}) {
  const semLeitura = usado == null || !Number.isFinite(usado)
  const bruto = semLeitura || total <= 0 ? 0 : (usado / total) * 100
  const pct = Math.min(100, Math.max(0, Math.round(bruto)))
  const tom = semLeitura ? "neutro" : tomPorUso(bruto)

  const textoAcessivel = unidadeAntes
    ? semLeitura
      ? `${rotulo}: sem leitura, de ${unidade} ${formatarNumero(total)}`
      : `${rotulo}: ${unidade} ${formatarNumero(usado)} de ${unidade} ${formatarNumero(total)}, ${pct}%`
    : semLeitura
      ? `${rotulo}: sem leitura, de ${formatarNumero(total)} ${unidade}`
      : `${rotulo}: ${formatarNumero(usado)} de ${formatarNumero(total)} ${unidade}, ${pct}%`

  return (
    // `role="group"` + `aria-label`: as três partes (número, chip, barra) só
    // querem dizer alguma coisa JUNTAS, e lidas em sequência solta viram
    // "28.700 barra 44.000 lbs 65%". O rótulo dá a frase inteira de uma vez.
    <div className={`min-w-0 ${className}`} role="group" aria-label={textoAcessivel}>
      <div className="flex items-center gap-2">
        {icone && <Icone nome={icone} className="size-4 shrink-0 text-dim" />}
        <p className="min-w-0 flex-1 truncate">
          <span className="font-mono-instr text-[17px] font-semibold tabular-nums text-texto">
            {unidadeAntes && `${unidade} `}
            {semLeitura ? "—" : formatarNumero(usado)}
          </span>{" "}
          <span className="font-mono-instr text-[12px] tabular-nums text-dim">
            / {formatarNumero(total)}
            {!unidadeAntes && ` ${unidade}`}
          </span>
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-[var(--raio-pilula)] border px-2 py-0.5 font-mono-instr text-[11px] font-semibold tabular-nums ${BORDA_TOM[tom]}`}
        >
          {semLeitura ? "—" : `${pct}%`}
        </span>
      </div>

      {/* 6px e cantos redondos nas duas pontas: o trilho é um objeto inteiro,
          não uma faixa cortada. `aria-hidden` porque o número acima já diz o
          mesmo, e um leitor de tela lendo "progressbar 65" logo depois de
          "65%" é repetição, não acessibilidade. */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[var(--raio-pilula)] bg-line" aria-hidden="true">
        <div className={`h-full rounded-[var(--raio-pilula)] ${FUNDO_TOM[tom]}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="rotulo mt-1.5 truncate text-dim">{rotulo}</p>
    </div>
  )
}

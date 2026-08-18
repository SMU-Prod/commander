import { escalaTopo, formatarNumero } from "./instrumento"

/**
 * GRÁFICO DE BARRAS COM TOOLTIP — o "Fleet Utilization Trend" da referência
 * (refino do `GraficoMesesGastos` que já existe). Spec §2, item 5.
 *
 * O TOOLTIP É CSS, NÃO JAVASCRIPT, e isso é decisão de arquitetura e não
 * economia: um `useState` aqui obrigaria `"use client"`, e o dia em que o
 * gráfico do Financeiro virar client component é o dia em que a página inteira
 * que o contém vira também. `group-hover` + `group-focus-within` cobrem mouse
 * E teclado; quem navega por toque não tem hover, e para essa pessoa o
 * `destaque` já deixa um tooltip aberto — que é como a própria referência
 * aparece na imagem.
 *
 * Cada barra é focável e carrega `aria-label` com as duas métricas: o gráfico
 * é uma imagem, mas os números dele não podem existir só como altura de div.
 */

export type PontoBarra = {
  rotulo: string
  valor: number
  /** A segunda métrica do tooltip ("Distância 1344,7 mi" na referência). */
  apoio?: string
  /** A barra acesa, com o tooltip já aberto. No máximo uma. */
  destaque?: boolean
}

export function GraficoBarras({
  pontos,
  cor = "var(--acao)",
  metrica = "Valor",
  sufixo = "",
  alturaClasse = "h-[140px] sm:h-[180px]",
  rotulo,
  className = "",
}: {
  pontos: PontoBarra[]
  cor?: string
  /** Nome da métrica principal dentro do tooltip. */
  metrica?: string
  /** Vai colado no número ("%", " h", " mi"). */
  sufixo?: string
  alturaClasse?: string
  rotulo?: string
  className?: string
}) {
  const valores = pontos.map((p) => (Number.isFinite(p.valor) ? p.valor : 0))
  const topo = escalaTopo(Math.max(...valores, 0))

  return (
    <div className={`w-full ${className}`}>
      {/* `overflow-visible` não é decoração: o tooltip sai para fora da caixa
          das barras por definição, e um `overflow-hidden` herdado o cortaria
          pela metade sem erro nenhum no console. */}
      <ul
        className={`flex items-end gap-1 overflow-visible sm:gap-1.5 ${alturaClasse}`}
        aria-label={rotulo ?? "Gráfico de barras"}
      >
        {pontos.map((p, i) => {
          const altura = topo > 0 ? (Math.min(topo, Math.max(0, valores[i])) / topo) * 100 : 0
          const descricao = `${p.rotulo}: ${metrica} ${formatarNumero(valores[i])}${sufixo}${p.apoio ? `. ${p.apoio}` : ""}`
          return (
            <li
              key={`${p.rotulo}-${i}`}
              className="group flex h-full min-w-0 flex-1 items-end rounded-[var(--raio-controle)] outline-offset-4"
              tabIndex={0}
              aria-label={descricao}
            >
              {/* O `relative` mora na BARRA, não no `<li>`. No `<li>` (que tem
                  a altura inteira do gráfico) o `bottom-full` do tooltip mede
                  a partir do topo da ÁREA, e ele saía flutuando acima do
                  cartão inteiro, por cima do cartão de cima — foi o que a
                  captura v1 mostrou. Ancorado na barra, ele aparece onde a
                  referência põe: colado no topo da coluna que descreve. */}
              <div
                style={{ height: `${altura}%` }}
                className="relative mx-auto w-full max-w-[34px]"
              >
                <div
                  className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 min-w-max -translate-x-1/2 rounded-[var(--raio-cartao)] border border-line bg-ink px-2.5 py-2 sombra-2 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${p.destaque ? "opacity-100" : "opacity-0"}`}
                >
                  <p className="rotulo mb-1 text-dim">{p.rotulo}</p>
                  <p className="flex items-baseline gap-3 whitespace-nowrap">
                    <span className="apoio text-dim">{metrica}</span>
                    <span className="ml-auto font-mono-instr text-[13px] font-semibold tabular-nums text-texto">
                      {formatarNumero(valores[i])}
                      {sufixo}
                    </span>
                  </p>
                  {p.apoio && <p className="apoio whitespace-nowrap text-dim">{p.apoio}</p>}
                </div>

                <div
                  style={{ backgroundColor: cor }}
                  className={`h-full w-full rounded-t-[3px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${p.destaque ? "opacity-100" : "opacity-70"}`}
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex gap-1 sm:gap-1.5" aria-hidden="true">
        {pontos.map((p, i) => (
          <span
            key={`${p.rotulo}-${i}`}
            className={`min-w-0 flex-1 truncate text-center font-mono-instr text-[10px] leading-none tabular-nums text-dim sm:text-[11px] ${i % 2 === 1 && i !== pontos.length - 1 ? "max-sm:invisible" : ""}`}
          >
            {p.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}

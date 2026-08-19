import type { ReactNode } from "react"
import { FUNDO_TOM, type TomInstrumento } from "./instrumento"

/**
 * COLUNA DE QUADRO — o cabeçalho de coluna kanban da referência ("🔵
 * Driving 6 · Weekly utilization % and total distance"): ponto colorido +
 * nome + contagem + subtítulo. Spec §3, item 8.
 *
 * ONDA 79 — construído junto com o resto da anatomia da referência, mas SEM
 * consumidor na ficha de equipamento: um quadro kanban pressupõe uma LISTA
 * de itens que se move entre estados (motoristas entre "Driving"/"Resting"/
 * "Off duty" na referência), e a ficha de UM equipamento não tem essa forma
 * — não existe "lista de equipamentos mudando de coluna" dentro da tela de
 * um equipamento só. Forçar este componente ali seria decorar a tela com um
 * padrão que não serve a nenhum dado real dela (`docs/DESIGN.md` §6, regra
 * 4 — não decorar o vazio). Fica pronto pra primeira tela de LISTA que
 * precisar de visão em quadro (candidata natural: `/barco/equipamentos`).
 *
 * `tom` reaproveita o vocabulário de 4 estados do `Selo`/`instrumento.ts` —
 * não inventa paleta nova pro ponto colorido.
 */
export function ColunaQuadro({
  tom = "neutro",
  titulo,
  contagem,
  subtitulo,
  children,
  className = "",
}: {
  tom?: TomInstrumento
  titulo: string
  contagem: number
  subtitulo?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`w-[280px] shrink-0 rounded-[var(--raio-cartao)] border border-line bg-panel p-3 ${className}`}>
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${FUNDO_TOM[tom]}`} />
        <h2 className="titulo-card min-w-0 flex-1 truncate">{titulo}</h2>
        <span className="rotulo-dado shrink-0 rounded-full bg-panel2 px-2 py-0.5 text-dim">{contagem}</span>
      </header>
      {subtitulo && <p className="apoio mt-0.5 truncate text-dim">{subtitulo}</p>}
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  )
}

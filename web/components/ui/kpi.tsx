import type { EstadoSelo } from "./selo"

/**
 * Número-chave. O valor SEMPRE em fonte de instrumento com `tabular-nums`:
 * numa faixa de KPIs os valores ficam lado a lado, e fonte proporcional faz
 * a coluna balançar (docs/DESIGN.md §5).
 */
const COR_VALOR: Record<EstadoSelo, string> = {
  ok: "text-texto", atencao: "text-warn", critico: "text-crit", neutro: "text-dim",
}

export function Kpi({
  rotulo, valor, apoio, estado = "ok",
}: {
  rotulo: string
  valor: string
  apoio?: string
  estado?: EstadoSelo
}) {
  return (
    <div className="min-w-0">
      <p className="rotulo truncate text-dim">{rotulo}</p>
      <p className={`font-mono-instr text-[20px] font-semibold tabular-nums ${COR_VALOR[estado]}`}>{valor}</p>
      {apoio && <p className="apoio truncate text-dim">{apoio}</p>}
    </div>
  )
}

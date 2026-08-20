import type { EstadoSelo } from "./selo"

/**
 * Número-chave. O valor SEMPRE em fonte de instrumento com `tabular-nums`:
 * numa faixa de KPIs os valores ficam lado a lado, e fonte proporcional faz
 * a coluna balançar (docs/DESIGN.md §5).
 */
const COR_VALOR: Record<EstadoSelo, string> = {
  ok: "text-texto", atencao: "text-warn", critico: "text-crit", neutro: "text-dim",
}

/** A cor da LINHA DE APOIO, não do valor (canvas tela-1b, cartão Motores):
 *  o horímetro fica claro e quem acende em âmbar é o "Revisão em 18 h" —
 *  a leitura é fato, o estado é do prazo. `ok` fica dim de propósito:
 *  apoio em dia é contexto, não alarme. */
const COR_APOIO: Record<EstadoSelo, string> = {
  ok: "text-dim", atencao: "text-warn", critico: "text-crit", neutro: "text-dim",
}

export function Kpi({
  rotulo, valor, apoio, estado = "ok", apoioEstado = "neutro",
}: {
  rotulo: string
  valor: string
  apoio?: string
  estado?: EstadoSelo
  /** Estado só da linha de apoio (ex.: prazo de revisão) — ver COR_APOIO. */
  apoioEstado?: EstadoSelo
}) {
  return (
    <div className="min-w-0">
      <p className="rotulo truncate text-dim">{rotulo}</p>
      {/* ONDA 87 — `.valor-forte` no lugar do `text-xl` escrito à mão:
          mesmo 20px, agora vindo do degrau declarado da escala. As cores de
          COR_VALOR continuam mandando (a classe entrega a cor com
          especificidade zero — ver o bloco `:where` em globals.css). */}
      <p className={`font-mono-instr valor-forte font-semibold ${COR_VALOR[estado]}`}>{valor}</p>
      {apoio && <p className={`apoio truncate ${COR_APOIO[apoioEstado]}`}>{apoio}</p>}
    </div>
  )
}

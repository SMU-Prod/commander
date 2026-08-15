/**
 * Pílula de estado. Cor E palavra, sempre: daltônico não enxerga o farol
 * verde, e "estado é forma, não só cor" (docs/DESIGN.md §6, regra 3).
 */
export const ESTADOS_SELO = ["ok", "atencao", "critico", "neutro"] as const
export type EstadoSelo = (typeof ESTADOS_SELO)[number]

const ROTULO: Record<EstadoSelo, string> = {
  ok: "Em dia",
  atencao: "Atenção",
  critico: "Crítico",
  neutro: "Sem dados",
}

const COR: Record<EstadoSelo, string> = {
  ok: "border-ok/40 text-ok",
  atencao: "border-warn/40 text-warn",
  critico: "border-crit/40 text-crit",
  neutro: "border-line text-dim",
}

export function rotuloDoSelo(estado: EstadoSelo): string {
  return ROTULO[estado]
}

export function Selo({ estado, children }: { estado: EstadoSelo; children?: React.ReactNode }) {
  return (
    // 11px e não 10px (revisão da onda 57): `globals.css` diz "nada abaixo de
    // 11px" e o commit que removeu a exceção de 9,5px da barra de baixo
    // declarou que a barra inteira voltava ao piso. Este componente nasceu,
    // no MESMO branch, a 10px — fora da escala `11·12·14·16·20·26·34` — e
    // substituiu a pílula escrita à mão do boletim do mar, que estava a 11px:
    // o selo de estado ficou MENOR do que a coisa que ele veio padronizar.
    <span
      className={`inline-flex shrink-0 items-center rounded-[var(--raio-pilula)] border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.09em] ${COR[estado]}`}
    >
      {children ?? ROTULO[estado]}
    </span>
  )
}

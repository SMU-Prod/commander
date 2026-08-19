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

/* `rotuloDoSelo` foi removido na revisão da onda 57. Ele existia só para o
   teste chamar — nenhuma tela usava — e é por isso que a garantia de "estado
   nunca só por cor" estava sendo medida num galho que não roda. O `ROTULO`
   acima continua sendo o texto de reserva de quem não passa `children`; quem
   quiser a palavra, renderize o `Selo`. */

export function Selo({ estado, children }: { estado: EstadoSelo; children?: React.ReactNode }) {
  return (
    // 11px e não 10px (revisão da onda 57): `globals.css` diz "nada abaixo de
    // 11px" e o commit que removeu a exceção de 9,5px da barra de baixo
    // declarou que a barra inteira voltava ao piso. Este componente nasceu,
    // no MESMO branch, a 10px — fora da escala `11·12·14·16·20·26·34` — e
    // substituiu a pílula escrita à mão do boletim do mar, que estava a 11px:
    // o selo de estado ficou MENOR do que a coisa que ele veio padronizar.
    //
    // ONDA 91 (achado 5.12) — `.rotulo` no lugar de `text-[11px] uppercase
    // tracking-[.09em]`. Os três juntos eram uma cópia à mão da voz de rótulo
    // que derivou: o app tinha ONZE valores de tracking para o mesmo gesto
    // "palavra em caixa alta, rastreada", e o `.16em` que `.rotulo` declara
    // era só o sexto mais usado. A classe traz também a família mono, que é o
    // que o `docs/DESIGN.md` §5 define para etiqueta de instrumento — e um
    // selo de estado é etiqueta, não frase (a ressalva do `Chip` sobre mono
    // virar soletração vale para rótulo corrido de filtro, de até 17
    // caracteres; aqui a palavra mais longa tem 9).
    // `font-bold` fica fora da classe de propósito: `.rotulo` não declara
    // peso, e este é o único rótulo do app que precisa segurar sozinho um
    // estado crítico.
    <span
      className={`rotulo inline-flex shrink-0 items-center rounded-[var(--raio-pilula)] border px-2 py-0.5 font-bold ${COR[estado]}`}
    >
      {children ?? ROTULO[estado]}
    </span>
  )
}

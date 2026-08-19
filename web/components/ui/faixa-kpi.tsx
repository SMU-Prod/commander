import type { ReactNode } from "react"
import { Icone, type NomeIcone } from "@/components/icone"

/**
 * FAIXA DE KPI — a fileira de pastilhas do topo da referência (anatomia de
 * ficha de veículo, `public/imagens/*.png`): "Active 6/10 · Drivers 6/8 ·
 * Trips 5 · Avg Fuel 56.2% · On-time 94.2%", uma linha só, ACIMA de tudo —
 * inclusive da migalha de pão e do título.
 *
 * ONDA 79 — não existia nenhum "resumo numérico da tela inteira" antes do
 * título no Commander; o `Kpi` que já existia (`components/ui/kpi.tsx`) é
 * outra coisa — um número grande dentro de CARTÃO, não uma pastilha de
 * moldura. Este componente é novo e serve especificamente essa faixa.
 *
 * O rótulo é CAIXA DE FRASE (`rotulo-dado`), não `.rotulo` maiúsculo — é a
 * mesma correção medida da grade rótulo/valor (`grade-rotulo-valor.tsx`),
 * pelo mesmo motivo: a referência escreve "Active", "Drivers", não "ACTIVE",
 * "DRIVERS".
 *
 * Sem alvo de toque de 44px de propósito: a pastilha aqui é LEITURA, não
 * ação — não navega, não abre nada. A régua de 44px (`docs/DESIGN.md` §5)
 * vale pra "qualquer coisa que se toca"; isto não se toca.
 */
export function FaixaKpi({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rolagem-lateral flex gap-2 overflow-x-auto pb-1 ${className}`}
      style={{ scrollbarWidth: "none" }}
    >
      {children}
    </div>
  )
}

export function PastilhaKpi({
  icone,
  rotulo,
  valor,
}: {
  icone: NomeIcone
  rotulo: string
  /** Já formatado — "6/10", "56,2%", "482,3 h". Este componente não formata
   *  número, quem chama decide a régua (mesma divisão de responsabilidade
   *  de `Kpi`/`BarraCapacidade`). */
  valor: string
}) {
  return (
    <span className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--raio-pilula)] border border-line bg-panel2 px-3">
      <Icone nome={icone} className="size-3.5 shrink-0 text-dim" />
      <span className="rotulo-dado text-dim">{rotulo}:</span>
      <span className="font-mono-instr text-[12px] font-semibold tabular-nums text-texto">{valor}</span>
    </span>
  )
}

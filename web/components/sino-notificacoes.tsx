import Link from "next/link"
import { Icone } from "@/components/icone"

/**
 * Sino do topo com contador (onda 44, PRD §5.2: "Sino no topo com
 * contador"). O número vem de `contadorSino` (`lib/domain/notificacoes.ts`):
 * críticas + importantes, nunca as informativas — badge que nunca zera vira
 * decoração e ninguém olha quando importa.
 *
 * O contador já chega filtrado por permissão, porque `carregarNotificacoes`
 * filtra antes de contar: um tripulante sem acesso a Documentos não vê nem o
 * NÚMERO subir por causa de um documento vencendo.
 *
 * Acima de 9 vira "9+": o badge é um sinal de "tem coisa te esperando", não
 * um relatório — e três dígitos deformam o círculo.
 */
export function SinoNotificacoes({ contador, className = "" }: { contador: number; className?: string }) {
  const rotulo = contador > 0
    ? `Avisos — ${contador} ${contador === 1 ? "aviso que pede atenção" : "avisos que pedem atenção"}`
    : "Avisos"

  return (
    <Link
      href="/notificacoes"
      aria-label={rotulo}
      className={`relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel ${className}`}
    >
      <Icone nome="alerta" className="size-5 text-dim" />
      {contador > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-crit px-1 font-mono-instr text-[10px] font-semibold leading-[18px] tabular-nums text-white"
        >
          {contador > 9 ? "9+" : contador}
        </span>
      )}
    </Link>
  )
}

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
    /* ONDA 62 — a moldura circular saiu (canvas tela-1b): o sino do topo é
       só o ícone de 21px com o badge em cima, alvo de 44px por conta da
       própria caixa. A borda em volta fazia o sino parecer um botão de ação
       — e ação aqui é olhar os avisos, não apertar um controle. */
    <Link
      href="/notificacoes"
      aria-label={rotulo}
      className={`relative inline-flex size-11 shrink-0 items-center justify-center ${className}`}
    >
      <Icone nome="alerta" className="size-[21px] text-dim" />
      {contador > 0 && (
        /* Badge do canvas: mono 11px (o piso tipográfico — era 10px, abaixo
           dele), vermelho com o texto na cor do CHÃO (`text-ink`): no escuro
           é o quase-preto do canvas, no claro um quase-branco — legível
           sobre o vermelho nos dois. */
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-crit px-1 font-mono-instr text-[11px] font-bold leading-4 tabular-nums text-ink"
        >
          {contador > 9 ? "9+" : contador}
        </span>
      )}
    </Link>
  )
}

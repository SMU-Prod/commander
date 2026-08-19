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
    // ONDA 98 (HAULIX §19, "KPI pill") — a régua é "altura 24–28, padding 0 9,
    // raio 999, fonte 11–12. São indicadores contextuais, NÃO cards". A casa
    // entregava 32 de altura e 12 de padding: 4px acima do teto e 3 acima do
    // lado, o suficiente para a fila de pastilhas ler como uma fila de
    // botõezinhos em vez de uma faixa de leitura. `h-7` = 28, o topo da faixa
    // (não o meio: o valor aqui é `.valor`, 14px, e 24 não o comporta com
    // respiro). O `px-[9px]` é o número do documento — mesma justificativa do
    // `px-[7px]` do `Selo`: padding interno de pill não é a escala base-8, que
    // governa espaço ENTRE blocos.
    <span className="flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--raio-pilula)] border border-line bg-panel2 px-[9px]">
      <Icone nome={icone} className="size-3.5 shrink-0 text-dim" />
      {/* ONDA 95 (achado 5.7) — O DOIS-PONTOS CAI, E COM ELE A TERCEIRA FORMA.
          A auditoria de 19/08 mediu a contagem escrita de três jeitos: dentro
          da pílula (`ChipDado`, `Chip contagem`), `rótulo: valor` — que era
          ESTA linha — e número mono solto ao lado do título. A régua do app é
          a primeira: rótulo colado no valor, dentro da pílula. Sem o
          dois-pontos esta pastilha passa a ter a MESMA anatomia do `ChipDado`,
          e a diferença que sobra entre as duas é a única deliberada: aqui o
          rótulo é caixa de frase (`.rotulo-dado`, medido da referência —
          "Active", não "ACTIVE") porque isto é legenda de um valor; lá é
          `.rotulo` maiúsculo porque é etiqueta de instrumento.
          Um dois-pontos não é pontuação inocente numa faixa de números: ele
          transforma a pastilha numa FRASE ("Sistemas: 3") no meio de uma fila
          que o olho lê como painel, e é o que fazia a mesma informação ter
          duas caras em duas telas vizinhas. A referência não usa nenhum. */}
      <span className="rotulo-dado text-dim">{rotulo}</span>
      {/* ONDA 87 — o valor sobe de 12px pro degrau `.valor` (14px). Era o
          menor dos sete tamanhos de número que a auditoria mediu, e aqui ele
          fica ao lado de um rótulo de 11px: com um pixel de diferença os dois
          liam como a mesma coisa. A pastilha tem altura fixa (`h-8`), então
          nada se move. `tabular-nums` continua explícito no markup porque
          `faixa-kpi.test.ts` confere a string — a classe já o traria. */}
      <span className="font-mono-instr valor font-semibold tabular-nums">{valor}</span>
    </span>
  )
}

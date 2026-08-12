import Link from "next/link"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import type { ResumoStatusGeral } from "@/lib/domain/semaforo"

// Duas faixas boas (Ótimo/Bom) compartilham o verde do farol — o que importa
// visualmente é "tá bem" vs "atenção" vs "crítico", mesma linguagem de cor
// já usada em todo o app (Farol/Horimetro/CardEmbarcacao). Dourado fica
// reservado pra ação/marca, não vira cor de status aqui.
const COR_ROTULO: Record<string, string> = {
  Ótimo: "text-ok",
  Bom: "text-ok",
  Atenção: "text-warn",
  Crítico: "text-crit",
}

const TAMANHO = 116
const ESPESSURA = 11
const RAIO = (TAMANHO - ESPESSURA) / 2
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

export function AnelStatus({ resumo }: { resumo: ResumoStatusGeral }) {
  if (resumo.percentual == null || resumo.rotulo == null) {
    return (
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4 text-center">
        <Icone nome="escudo" className="mx-auto size-7 text-dim" />
        <p className="corpo mt-2 font-medium">Ainda sem dados pro status geral</p>
        <p className="apoio mt-1 text-dim">
          Cadastre motores com horas ou vencimentos com data pra calcular o anel de completude.
        </p>
        <Link href="/barco" className="apoio mt-3 inline-block text-accent-forte">Completar em Embarcação</Link>
      </div>
    )
  }

  const corTexto = COR_ROTULO[resumo.rotulo] ?? "text-ok"
  const offset = CIRCUNFERENCIA - (resumo.percentual / 100) * CIRCUNFERENCIA

  return (
    <div className="sombra-1 flex items-center gap-4 rounded-[14px] border border-line bg-panel p-4">
      <div
        className="relative shrink-0"
        style={{ width: TAMANHO, height: TAMANHO }}
        role="img"
        aria-label={`Status geral: ${resumo.percentual}% — ${resumo.rotulo}`}
      >
        <svg viewBox={`0 0 ${TAMANHO} ${TAMANHO}`} width={TAMANHO} height={TAMANHO} className="-rotate-90" aria-hidden="true">
          <circle
            cx={TAMANHO / 2} cy={TAMANHO / 2} r={RAIO} fill="none"
            strokeWidth={ESPESSURA} stroke="currentColor" className="text-line"
          />
          <circle
            cx={TAMANHO / 2} cy={TAMANHO / 2} r={RAIO} fill="none"
            strokeWidth={ESPESSURA} strokeLinecap="round" stroke="currentColor"
            className={`${corTexto} transition-[stroke-dashoffset] duration-700 ease-out`}
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono-instr text-2xl font-semibold tabular-nums">{resumo.percentual}%</span>
          <span className={`apoio font-medium ${corTexto}`}>{resumo.rotulo}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="corpo flex items-center gap-2">
          <Farol status="ok" /> Em dia
          <span className="ml-auto font-mono-instr tabular-nums">{String(resumo.emDia).padStart(2, "0")}</span>
        </p>
        <p className="corpo flex items-center gap-2">
          <Farol status="atencao" /> Atenção
          <span className="ml-auto font-mono-instr tabular-nums">{String(resumo.atencao).padStart(2, "0")}</span>
        </p>
        <p className="corpo flex items-center gap-2">
          <Farol status="vencido" /> Vencidos
          <span className="ml-auto font-mono-instr tabular-nums">{String(resumo.vencido).padStart(2, "0")}</span>
        </p>
        <Link href="/barco" className="apoio mt-2 inline-block text-accent-forte">Ver detalhes</Link>
      </div>
    </div>
  )
}

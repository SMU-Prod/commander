import { Icone } from "@/components/icone"
import { formatarNumero, percentualPreso } from "./instrumento"

/**
 * PROGRESSO DE ROTA — o `Dallas, TX → Memphis, TN` da referência, no modo
 * navegando (o dado já existe em `progressoNaRota`). Spec §2, item 6.
 *
 * Três linhas, e a ordem delas é o conteúdo: PARA ONDE (origem → destino),
 * QUANTO JÁ ANDOU (a barra dourada), QUANDO CHEGA (ETA e o que falta). É a
 * sequência das perguntas de quem está no leme, e é por isso que o ETA fica
 * embaixo e não ao lado do título — no celular, ao lado, ele seria a primeira
 * coisa a ser truncada.
 *
 * Os três números saem em mono tabular pelo mesmo motivo de sempre: eles
 * MUDAM enquanto a pessoa olha, e em fonte proporcional a linha inteira dança
 * a cada atualização de posição.
 */
export function ProgressoRota({
  origem,
  destino,
  percentual,
  distanciaTotal,
  restante,
  eta,
  unidade = "km",
  className = "",
}: {
  origem: string
  destino: string
  /** 0–100. Preso nas duas pontas: GPS ruidoso já mandou 101 antes. */
  percentual: number | null
  distanciaTotal: number
  restante: number
  /** Já formatado pelo domínio ("~1h 8m", "3h 20m") — texto, não minutos. */
  eta: string
  unidade?: string
  className?: string
}) {
  const pct = percentualPreso(percentual)

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate text-sm text-texto">
          {origem} <span className="text-dim">→</span> {destino}
        </p>
        <p className="shrink-0 whitespace-nowrap">
          <span className="font-mono-instr text-sm font-semibold tabular-nums text-texto">
            {formatarNumero(distanciaTotal)} {unidade}
          </span>{" "}
          <span className="font-mono-instr text-xs tabular-nums text-dim">{pct}%</span>
        </p>
      </div>

      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-[var(--raio-pilula)] bg-line"
        role="progressbar"
        aria-label={`Progresso de ${origem} até ${destino}`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-[var(--raio-pilula)] bg-accent" style={{ width: `${pct}%` }} />
      </div>

      {/* Empilha no celular. Numa linha só a 390px o ETA e o "restantes"
          encostam um no outro e a leitura vira "~1h 8m 72,9 km" — dois números
          colados que parecem um. */}
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <p className="apoio flex min-w-0 items-center gap-2 text-dim sm:flex-1">
          <Icone nome="relogio" className="size-3.5 shrink-0 text-dim" />
          <span className="truncate">
            Chegada estimada (ETA):{" "}
            <span className="font-mono-instr tabular-nums text-texto">{eta}</span>
          </span>
        </p>
        <p className="apoio shrink-0 whitespace-nowrap pl-[22px] text-dim sm:pl-0">
          <span className="font-mono-instr tabular-nums text-texto">
            {formatarNumero(restante)} {unidade}
          </span>{" "}
          restantes
        </p>
      </div>
    </div>
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"
import { Icone } from "@/components/icone"
import { TrilhaSvg } from "@/components/trilha-svg"
import { resumoTrilha } from "@/lib/domain/geo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

export default async function TrilhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await supabaseServer()
  const { data: evento } = await supabase
    .from("eventos").select("*").eq("id", id).maybeSingle()
  const e = evento as Evento | null
  if (!e || !Array.isArray(e.trilha) || e.trilha.length < 2) notFound()

  const r = resumoTrilha(e.trilha)
  const stats: [string, string][] = [
    ["Distância", `${r.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} nm`],
    ["Duração", `${r.duracaoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`],
    ["Em movimento", `${r.tempoMovimentoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`],
    ["Vel. média", `${r.velMediaKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`],
    ["Vel. máxima", `${r.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`],
  ]

  return (
    <main>
      <Link href="/diario" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Diário
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Trilha — {e.data.split("-").reverse().join("/")}</h1>
      {e.descricao && <p className="mt-1 text-sm text-dim">{e.descricao}</p>}

      <div className="mt-4">
        <TrilhaSvg pontos={e.trilha} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map(([nome, valor]) => (
          <div key={nome} className="rounded-[12px] border border-line bg-panel p-3">
            <p className="font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim">{nome}</p>
            <p className="mt-0.5 font-mono-instr text-lg tabular-nums">{valor}</p>
          </div>
        ))}
      </div>
    </main>
  )
}

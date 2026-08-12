import { notFound, redirect } from "next/navigation"
import { VerViagemMapa } from "@/components/mapa/ver-viagem-mapa"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import type { PontoTrilhaDb, Viagem } from "@/lib/db/types"

/**
 * Ver viagem (onda 19) — mesmo padrão de `/diario/[id]`: busca direto, e
 * viagem de outra embarcação (ou inexistente) vira `notFound()`, nunca
 * revela nada. A RLS (migration 030) já impediria o SELECT de trazer a
 * linha de outro dono; esta checagem é defesa em profundidade, mesmo
 * espírito da de `/diario/[id]/page.tsx`.
 */
export default async function VerViagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const supabase = await supabaseServer()
  const { data: viagem } = await supabase.from("viagens").select("*").eq("id", id).maybeSingle()
  const v = viagem as Viagem | null
  if (!v || v.embarcacao_id !== painel.embarcacao.id) notFound()

  const { data: eventos } = await supabase
    .from("eventos")
    .select("trilha")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("tipo", "navegacao")

  return (
    <VerViagemMapa
      nome={v.nome}
      dataPrevista={v.data_prevista}
      paradas={v.paradas}
      caladoM={painel.embarcacao.calado_m ?? null}
      eventosComTrilha={(eventos ?? []) as { trilha: PontoTrilhaDb[] | null }[]}
    />
  )
}

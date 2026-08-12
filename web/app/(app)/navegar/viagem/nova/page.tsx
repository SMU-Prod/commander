import { redirect } from "next/navigation"
import { PlanejarViagemMapa } from "@/components/mapa/planejar-viagem-mapa"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { PontoTrilhaDb } from "@/lib/db/types"

/** Onda 19 (Pilar Strava do Mar) — planejar viagem. Mesma checagem de acesso
 *  que o resto do diário: quem não pode editar o diário (nível "somente
 *  ver" de um CMDT) não vê a entrada nem consegue chegar aqui direto — a
 *  RLS (migration 030) protegeria a escrita de qualquer forma, isso aqui só
 *  evita abrir um formulário que vai falhar ao salvar. */
export default async function NovaViagemPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeEditar(painel.permissoes, "diario")) redirect("/navegar")

  const supabase = await supabaseServer()
  const { data: eventos } = await supabase
    .from("eventos")
    .select("trilha")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("tipo", "navegacao")

  return (
    <PlanejarViagemMapa
      caladoM={painel.embarcacao.calado_m ?? null}
      eventosComTrilha={(eventos ?? []) as { trilha: PontoTrilhaDb[] | null }[]}
    />
  )
}

import { ExplorarMapa } from "@/components/mapa/explorar-mapa"
import { supabaseServer } from "@/lib/supabase/server"
import type { Parceiro } from "@/lib/db/types"

/** Onda 39 — mesma consulta de /navegar (`.eq("visivel", true)`): só
 *  parceiro que fechou com a Commander aparece, nunca POI de terceiro. */
export default async function ExplorarPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from("parceiros").select("*").eq("visivel", true)
  if (error) throw new Error("Não foi possível carregar o mapa. Recarregue a página.")

  return <ExplorarMapa parceiros={(data ?? []) as Parceiro[]} />
}

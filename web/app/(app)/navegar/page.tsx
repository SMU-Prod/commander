import { NavegarMapa } from "@/components/mapa/navegar-mapa"
import { supabaseServer } from "@/lib/supabase/server"
import type { Parceiro } from "@/lib/db/types"

export default async function NavegarPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from("parceiros").select("*").eq("visivel", true)
  if (error) throw new Error("Não foi possível carregar o mapa. Recarregue a página.")

  return <NavegarMapa parceiros={(data ?? []) as Parceiro[]} />
}

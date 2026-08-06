"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

function erroLocal(msg: string): never {
  redirect(`/barco/local?erro=${encodeURIComponent(msg)}`)
}

export async function salvarLocalMarina(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const lat = parseDecimalPtBr(String(formData.get("lat") ?? ""))
  const lon = parseDecimalPtBr(String(formData.get("lon") ?? ""))
  if (lat === null || lon === null) erroLocal("Informe latitude e longitude válidas.")
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    erroLocal("Coordenadas fora do intervalo (lat -90..90, lon -180..180).")
  }

  const { error } = await supabase
    .from("embarcacoes")
    .update({ marina_lat: lat, marina_lon: lon })
    .eq("id", painel.embarcacao.id)
  if (error) erroLocal("Não foi possível salvar a posição. Tente de novo.")

  revalidatePath("/hoje")
  revalidatePath("/barco")
  redirect("/hoje")
}

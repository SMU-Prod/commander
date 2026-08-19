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
    erroLocal("Essas coordenadas não existem no mapa. Confira se copiou certo do GPS ou do Google Maps.")
  }

  const { data, error } = await supabase
    .from("embarcacoes")
    .update({ marina_lat: lat, marina_lon: lon })
    .eq("id", painel.embarcacao.id)
    .select("id")
  // `embarcacao: prop edita` (using e with check `eh_prop(id)`) recusa quem não
  // é proprietário devolvendo ZERO LINHA com `error` nulo. Esta tela é visível
  // a quem tem acesso à embarcação, não só ao dono: sem a checagem da linha, o
  // comandante que salvasse a marina caía em /hoje com o mapa no lugar de antes
  // e nada na tela para explicar.
  if (error || !data?.length) {
    erroLocal("A posição não foi salva. Tente de novo; se continuar, fale com quem administra a embarcação.")
  }

  revalidatePath("/hoje")
  revalidatePath("/barco")
  redirect("/hoje")
}

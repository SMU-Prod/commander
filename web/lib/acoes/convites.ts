"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { PRESETS } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

export async function aceitarConvite(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim()
  function erroAceite(msg: string): never {
    redirect(`/convite/${encodeURIComponent(codigo)}?erro=${encodeURIComponent(msg)}`)
  }
  if (codigo === "") redirect("/hoje?erro=" + encodeURIComponent("Convite inválido."))
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc("aceitar_convite", { p_codigo: codigo })
  if (error) {
    erroAceite(
      error.message.includes("expirado") || error.message.includes("inválido")
        ? "Este convite não é mais válido — peça um novo ao proprietário."
        : error.message.includes("tripulação")
          ? "Você já faz parte desta tripulação."
          : "Não foi possível aceitar o convite. Tente de novo.",
    )
  }
  revalidatePath("/hoje")
  redirect("/hoje")
}

function erroTripulacao(msg: string): never {
  redirect(`/menu/tripulacao?erro=${encodeURIComponent(msg)}`)
}

export async function criarConvite(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroTripulacao("Só o proprietário convida tripulação.")

  const nivel = String(formData.get("nivel") ?? "operacional") === "completo" ? "completo" : "operacional"
  const { data, error } = await supabase
    .from("convites")
    .insert({ embarcacao_id: painel.embarcacao.id, permissoes: PRESETS[nivel], nivel })
    .select("codigo")
    .single()
  if (error || !data) erroTripulacao("Não foi possível criar o convite. Tente de novo.")

  revalidatePath("/menu/tripulacao")
  redirect(`/menu/tripulacao?criado=${encodeURIComponent(data.codigo)}`)
}

export async function revogarConvite(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("convite_id") ?? "")
  const { error } = await supabase.from("convites").delete().eq("id", id).is("usado_em", null)
  if (error) erroTripulacao("Não foi possível revogar.")
  revalidatePath("/menu/tripulacao")
  redirect("/menu/tripulacao")
}

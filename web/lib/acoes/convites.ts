"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
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

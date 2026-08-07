"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

function voltar(msg?: string): never {
  redirect(msg ? `/menu/perfil?erro=${encodeURIComponent(msg)}` : `/menu?ok=${encodeURIComponent("Perfil salvo")}`)
}

export async function salvarPerfil(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()

  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) voltar("Informe seu nome.")
  const telefone = String(formData.get("telefone") ?? "").trim() || null

  let avatarPath: string | null = null
  const avatar = formData.get("avatar")
  if (avatar instanceof File && avatar.size > 0) {
    if (!painel) voltar("Cadastre a embarcação antes de enviar uma foto.")
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatar.type)) voltar("Use JPG, PNG ou WebP.")
    const r = await subirArquivo(supabase, painel.embarcacao.id, "fotos", avatar)
    if ("erro" in r) voltar(r.erro)
    avatarPath = r.path
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nome, telefone, ...(avatarPath ? { avatar_path: avatarPath } : {}) })
    .eq("id", user.id)
  if (error) voltar("Não foi possível salvar o perfil. Tente de novo.")

  revalidatePath("/menu")
  revalidatePath("/hoje")
  voltar()
}

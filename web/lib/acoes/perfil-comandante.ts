"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

function erroPerfil(msg: string): never {
  redirect(`/marketplace/perfil?erro=${encodeURIComponent(msg)}`)
}

export async function salvarPerfilComandante(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome_publico")
  if (!nome) erroPerfil("Informe seu nome profissional.")

  const { error } = await supabase.from("perfis_comandante").upsert({
    usuario_id: user.id,
    nome_publico: nome,
    categoria: texto("categoria"),
    cidade: texto("cidade"),
    bio: texto("bio"),
    telefone: texto("telefone"),
    disponibilidade: texto("disponibilidade"),
    visivel: formData.get("visivel") === "on",
  })
  if (error) erroPerfil("Não foi possível salvar o perfil. Tente de novo.")
  revalidatePath("/marketplace")
  redirect("/marketplace")
}

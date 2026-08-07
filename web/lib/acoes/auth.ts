"use server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

function destinoSeguro(bruto: FormDataEntryValue | null, padrao: string): string {
  const v = String(bruto ?? "")
  return v.startsWith("/") && !v.startsWith("//") ? v : padrao
}

export async function entrar(formData: FormData) {
  const volta = formData.get("volta")
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
  })
  if (error) {
    redirect(`/login?erro=${encodeURIComponent("E-mail ou senha incorretos")}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
  redirect(destinoSeguro(volta, "/hoje"))
}

export async function cadastrar(formData: FormData) {
  const volta = formData.get("volta")
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
    options: { data: { nome: String(formData.get("nome") ?? "") } },
  })
  if (error) {
    redirect(`/login?modo=cadastro&erro=${encodeURIComponent("Não foi possível criar a conta. Confira os dados e tente novamente.")}&volta=${encodeURIComponent(String(volta ?? ""))}`)
  }
  redirect(destinoSeguro(volta, "/onboarding"))
}

export async function sair() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/login")
}

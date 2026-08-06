"use server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

export async function entrar(formData: FormData) {
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
  })
  if (error) redirect(`/login?erro=${encodeURIComponent("E-mail ou senha incorretos")}`)
  redirect("/hoje")
}

export async function cadastrar(formData: FormData) {
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
    options: { data: { nome: String(formData.get("nome") ?? "") } },
  })
  if (error) redirect(`/login?erro=${encodeURIComponent(error.message)}`)
  redirect("/onboarding")
}

export async function sair() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/login")
}

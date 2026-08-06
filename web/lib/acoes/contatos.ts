"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

function volta(msg?: string): never {
  redirect(msg ? `/barco/contatos?erro=${encodeURIComponent(msg)}` : "/barco/contatos")
}

export async function criarContato(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const nome = String(formData.get("nome") ?? "").trim()
  if (nome === "") volta("Informe o nome do contato.")
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const { error } = await supabase.from("contatos").insert({
    embarcacao_id: painel.embarcacao.id, nome,
    especialidade: texto("especialidade"), telefone: texto("telefone"),
  })
  if (error) volta("Não foi possível salvar o contato.")
  revalidatePath("/barco/contatos")
  volta()
}

export async function avaliarContato(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("contato_id") ?? "")
  const nota = Number(formData.get("avaliacao"))
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) volta("Nota de 1 a 5.")
  const { error } = await supabase.from("contatos").update({ avaliacao: nota }).eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
  if (error) volta("Não foi possível avaliar.")
  revalidatePath("/barco/contatos")
  volta()
}

export async function excluirContato(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("contato_id") ?? "")
  const { error } = await supabase.from("contatos").delete().eq("id", id).eq("embarcacao_id", painel.embarcacao.id)
  if (error) volta("Não foi possível excluir. Tente de novo.")
  revalidatePath("/barco/contatos")
  volta()
}

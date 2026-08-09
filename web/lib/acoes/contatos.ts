"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

function volta(msg?: string): never {
  redirect(msg ? `/barco/contatos?erro=${encodeURIComponent(msg)}` : "/barco/contatos")
}

/** Anexa um parâmetro a uma URL que pode ou não já ter querystring. */
function comParametro(url: string, chave: string, valor: string): string {
  const separador = url.includes("?") ? "&" : "?"
  return `${url}${separador}${chave}=${encodeURIComponent(valor)}`
}

export async function criarContato(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const nome = String(formData.get("nome") ?? "").trim()

  // "volta" vem de quem chegou aqui no meio de outro formulário (ex.: registro
  // de serviço no Diário, sem prestador cadastrado ainda) — só aceita caminho
  // relativo, nunca uma URL de fora do app. Erro tambem preserva o caminho de
  // volta, senão a pessoa perde o "volta" ao tentar de novo.
  const brutoVolta = String(formData.get("volta") ?? "").trim()
  const destino = brutoVolta.startsWith("/") ? brutoVolta : null
  const erroContatos = (msg: string): never => {
    if (destino) redirect(comParametro(`/barco/contatos?volta=${encodeURIComponent(destino)}`, "erro", msg))
    volta(msg)
  }

  if (nome === "") erroContatos("Informe o nome do contato.")
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const { data: criado, error } = await supabase.from("contatos").insert({
    embarcacao_id: painel.embarcacao.id, nome,
    especialidade: texto("especialidade"), telefone: texto("telefone"),
  }).select("id")
  if (error || !criado?.length) erroContatos("Não foi possível salvar o contato.")

  revalidatePath("/barco/contatos")
  if (destino) {
    // volta pro formulário de origem (ex.: /diario/novo?tipo=...&alvo=...) já
    // com o prestador recém-criado pré-selecionado — nada do que a pessoa
    // tinha digitado se perde por ter precisado cadastrar o contato no meio.
    redirect(comParametro(comParametro(destino, "contato", criado![0].id), "ok", "Contato salvo"))
  }
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

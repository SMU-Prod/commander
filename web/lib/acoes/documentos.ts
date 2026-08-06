"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

const volta = (msg?: string) =>
  redirect(msg ? `/barco/documentos?erro=${encodeURIComponent(msg)}` : "/barco/documentos")

async function contexto() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  return { supabase, painel: painel! }
}

export async function criarDocumento(formData: FormData) {
  const { supabase, painel } = await contexto()
  const nome = String(formData.get("nome") ?? "").trim()
  if (nome === "") volta("Dê um nome ao documento.")
  const validade = String(formData.get("validade") ?? "").trim() || null

  let itemId: string | null = null
  if (validade) {
    const { data: item, error } = await supabase
      .from("itens_monitorados")
      .insert({ embarcacao_id: painel.embarcacao.id, nome, categoria: "documento", data_fixa: validade })
      .select("id").single()
    if (error || !item) volta("Não foi possível criar o vencimento do documento.")
    itemId = item!.id
  }

  let arquivoPath: string | null = null
  const arquivo = formData.get("arquivo")
  if (arquivo instanceof File && arquivo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "documentos", arquivo)
    if ("erro" in r) volta(r.erro)
    else arquivoPath = r.path
  }

  const { error } = await supabase.from("documentos").insert({
    embarcacao_id: painel.embarcacao.id, nome, arquivo_path: arquivoPath,
    validade, item_monitorado_id: itemId,
  })
  if (error) volta("Não foi possível salvar o documento.")

  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}

export async function anexarArquivo(formData: FormData) {
  const { supabase, painel } = await contexto()
  const itemId = String(formData.get("item_id") ?? "")
  const item = painel.itens.find((i) => i.id === itemId)
  if (!item) volta("Item não encontrado.")

  const arquivo = formData.get("arquivo")
  if (!(arquivo instanceof File) || arquivo.size === 0) volta("Escolha um arquivo.")
  const r = await subirArquivo(supabase, painel.embarcacao.id, "documentos", arquivo as File)
  if ("erro" in r) volta(r.erro)

  const { error } = await supabase.from("documentos").insert({
    embarcacao_id: painel.embarcacao.id, nome: item!.nome,
    arquivo_path: (r as { path: string }).path, validade: item!.data_fixa, item_monitorado_id: itemId,
  })
  if (error) volta("Não foi possível vincular o arquivo.")
  revalidatePath("/barco/documentos")
  volta()
}

export async function excluirDocumento(formData: FormData) {
  const { supabase } = await contexto()
  const id = String(formData.get("documento_id") ?? "")
  const { data: doc } = await supabase.from("documentos")
    .select("id, arquivo_path, item_monitorado_id").eq("id", id).maybeSingle()
  if (!doc) volta("Documento não encontrado.")

  if (doc!.arquivo_path) await supabase.storage.from("acervo").remove([doc!.arquivo_path])
  const { error } = await supabase.from("documentos").delete().eq("id", id)
  if (error) volta("Não foi possível excluir.")
  if (doc!.item_monitorado_id) {
    await supabase.from("itens_monitorados").delete().eq("id", doc!.item_monitorado_id)
  }
  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}

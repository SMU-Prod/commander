"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

const volta = (msg?: string): never =>
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
    if ("erro" in r) {
      if (itemId) await supabase.from("itens_monitorados").delete().eq("id", itemId)
      volta(r.erro)
    } else arquivoPath = r.path
  }

  const { error } = await supabase.from("documentos").insert({
    embarcacao_id: painel.embarcacao.id, nome, arquivo_path: arquivoPath,
    validade, item_monitorado_id: itemId,
  })
  if (error) {
    if (arquivoPath) await supabase.storage.from("acervo").remove([arquivoPath])
    if (itemId) await supabase.from("itens_monitorados").delete().eq("id", itemId)
    volta("Não foi possível salvar o documento.")
  }

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

  const arquivoPath = (r as { path: string }).path

  const { data: existente } = await supabase.from("documentos")
    .select("id").eq("item_monitorado_id", itemId).is("arquivo_path", null).maybeSingle()

  if (existente) {
    const { error } = await supabase.from("documentos")
      .update({ arquivo_path: arquivoPath }).eq("id", existente.id)
    if (error) {
      await supabase.storage.from("acervo").remove([arquivoPath])
      volta("Não foi possível vincular o arquivo.")
    }
  } else {
    const { error } = await supabase.from("documentos").insert({
      embarcacao_id: painel.embarcacao.id, nome: item!.nome,
      arquivo_path: arquivoPath, validade: item!.data_fixa, item_monitorado_id: itemId,
    })
    if (error) {
      await supabase.storage.from("acervo").remove([arquivoPath])
      volta("Não foi possível vincular o arquivo.")
    }
  }
  revalidatePath("/barco/documentos")
  volta()
}

export async function excluirDocumento(formData: FormData) {
  const { supabase, painel } = await contexto()
  const id = String(formData.get("documento_id") ?? "")
  const { data: doc } = await supabase.from("documentos")
    .select("id, arquivo_path, item_monitorado_id")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!doc) volta("Documento não encontrado.")

  if (doc!.item_monitorado_id) {
    const { error: erroItem } = await supabase
      .from("itens_monitorados").delete().eq("id", doc!.item_monitorado_id)
    if (erroItem) volta("Não foi possível excluir o vencimento vinculado. Tente de novo.")
  }
  const { error } = await supabase.from("documentos").delete().eq("id", id)
  if (error) volta("Não foi possível excluir. Tente de novo.")
  if (doc!.arquivo_path) {
    // best-effort: arquivo órfão é aceitável; linha fantasma não.
    await supabase.storage.from("acervo").remove([doc!.arquivo_path])
  }
  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}

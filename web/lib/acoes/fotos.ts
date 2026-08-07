"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { usoDaCota } from "@/lib/domain/cota"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlbumFoto } from "@/lib/db/types"

const ALBUNS_VALIDOS = ["exterior", "interior", "conves", "documentacao"]

function voltar(msg?: string): never {
  redirect(msg ? `/barco/fotos?erro=${encodeURIComponent(msg)}` : "/barco/fotos")
}

export async function subirFoto(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const album = String(formData.get("album") ?? "")
  if (!ALBUNS_VALIDOS.includes(album)) voltar("Escolha um álbum válido.")

  const arquivo = formData.get("arquivo")
  if (!(arquivo instanceof File) || arquivo.size === 0) voltar("Escolha uma foto.")
  if (!["image/jpeg", "image/png", "image/webp"].includes((arquivo as File).type)) {
    voltar("Use JPG, PNG ou WebP.")
  }

  const { data: usadas } = await supabase
    .from("fotos").select("bytes").eq("embarcacao_id", painel.embarcacao.id)
  const usado = (usadas ?? []).reduce((s, f: { bytes: number }) => s + f.bytes, 0)
  if (usoDaCota(usado + (arquivo as File).size).cheio) {
    voltar("Cota de nuvem cheia. Apague fotos antigas para liberar espaço.")
  }

  const r = await subirArquivo(supabase, painel.embarcacao.id, "fotos", arquivo as File)
  if ("erro" in r) voltar(r.erro)

  const { error } = await supabase.from("fotos").insert({
    embarcacao_id: painel.embarcacao.id,
    album: album as AlbumFoto,
    arquivo_path: r.path,
    bytes: (arquivo as File).size,
    legenda: String(formData.get("legenda") ?? "").trim() || null,
    criado_por: user.id,
  })
  if (error) {
    await supabase.storage.from("acervo").remove([r.path])
    voltar("Não foi possível salvar a foto. Tente de novo.")
  }

  revalidatePath("/barco/fotos")
  revalidatePath("/barco")
  voltar()
}

export async function excluirFoto(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("foto_id") ?? "")

  const { data: foto } = await supabase
    .from("fotos").select("id, arquivo_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!foto) voltar("Foto não encontrada.")

  if (painel.embarcacao.foto_capa_path === foto.arquivo_path) {
    await supabase.from("embarcacoes").update({ foto_capa_path: null }).eq("id", painel.embarcacao.id)
  }
  const { error } = await supabase.from("fotos").delete().eq("id", id)
  if (error) voltar("Não foi possível excluir a foto.")
  await supabase.storage.from("acervo").remove([foto.arquivo_path])

  revalidatePath("/barco/fotos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  voltar()
}

export async function definirCapa(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("foto_id") ?? "")

  const { data: foto } = await supabase
    .from("fotos").select("arquivo_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!foto) voltar("Foto não encontrada.")

  const { error } = await supabase
    .from("embarcacoes").update({ foto_capa_path: foto.arquivo_path }).eq("id", painel.embarcacao.id)
  if (error) voltar("Não foi possível definir a capa — confira seu acesso.")

  revalidatePath("/hoje")
  revalidatePath("/barco")
  revalidatePath("/barco/fotos")
  voltar()
}

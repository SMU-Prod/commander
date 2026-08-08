"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { usoDaCota } from "@/lib/domain/cota"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlbumFoto } from "@/lib/db/types"

const ALBUNS_VALIDOS = ["exterior", "interior", "conves", "documentacao"]

/** Volta para o álbum em que a pessoa estava — senão a foto recém-enviada "some". */
function voltar(album?: string | null, msg?: string): never {
  const params = new URLSearchParams()
  if (album && album !== "exterior" && ALBUNS_VALIDOS.includes(album)) params.set("album", album)
  if (msg) params.set("erro", msg)
  const query = params.toString()
  redirect(query ? `/barco/fotos?${query}` : "/barco/fotos")
}

export async function subirFoto(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const album = String(formData.get("album") ?? "")
  if (!ALBUNS_VALIDOS.includes(album)) voltar(null, "Escolha um álbum válido.")

  const arquivo = formData.get("arquivo")
  if (!(arquivo instanceof File) || arquivo.size === 0) voltar(album, "Escolha uma foto.")
  if (!["image/jpeg", "image/png", "image/webp"].includes((arquivo as File).type)) {
    voltar(album, "Use JPG, PNG ou WebP.")
  }

  const { data: usadas } = await supabase
    .from("fotos").select("bytes").eq("embarcacao_id", painel.embarcacao.id)
  const usado = (usadas ?? []).reduce((s, f: { bytes: number }) => s + f.bytes, 0)
  if (usoDaCota(usado + (arquivo as File).size).cheio) {
    voltar(album, "Espaço de fotos cheio. Apague fotos antigas para liberar espaço.")
  }

  const r = await subirArquivo(supabase, painel.embarcacao.id, "fotos", arquivo as File)
  if ("erro" in r) voltar(album, r.erro)

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
    voltar(album, "Não foi possível salvar a foto. Tente de novo.")
  }

  revalidatePath("/barco/fotos")
  revalidatePath("/barco")
  voltar(album)
}

export async function excluirFoto(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("foto_id") ?? "")
  const album = String(formData.get("album") ?? "") || null

  const { data: foto } = await supabase
    .from("fotos").select("id, arquivo_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!foto) voltar(album, "Foto não encontrada.")

  // apaga a linha primeiro: se falhar, a capa continua íntegra
  const { error } = await supabase.from("fotos").delete().eq("id", id)
  if (error) voltar(album, "Não foi possível excluir a foto.")

  if (painel.embarcacao.foto_capa_path === foto.arquivo_path) {
    // via RPC: a capa é do álbum, e a policy de embarcacoes só aceita o PROP
    const { error: erroCapa } = await supabase.rpc("definir_capa", {
      p_embarcacao_id: painel.embarcacao.id,
      p_path: null,
    })
    if (erroCapa) voltar(album, "Foto excluída, mas a capa não foi limpa. Escolha outra capa.")
  }
  await supabase.storage.from("acervo").remove([foto.arquivo_path])

  revalidatePath("/barco/fotos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  voltar(album)
}

export async function definirCapa(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("foto_id") ?? "")
  const album = String(formData.get("album") ?? "") || null

  const { data: foto } = await supabase
    .from("fotos").select("arquivo_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!foto) voltar(album, "Foto não encontrada.")

  const { error } = await supabase.rpc("definir_capa", {
    p_embarcacao_id: painel.embarcacao.id,
    p_path: foto.arquivo_path,
  })
  // A RPC `definir_capa` (migrations 014/015) aceita quem tem permissão de
  // editar Fotos — NÃO só o proprietário. Dizer "só o proprietário" seria
  // diagnóstico falso para um comandante com esse acesso.
  if (error) voltar(album, "Não deu para definir a capa. Se você é comandante, confirme com o proprietário se seu acesso a Fotos permite editar.")

  revalidatePath("/hoje")
  revalidatePath("/barco")
  revalidatePath("/barco/fotos")
  voltar(album)
}

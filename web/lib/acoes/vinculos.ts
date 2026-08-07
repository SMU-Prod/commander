"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ABAS, PRESETS, normalizarPermissoes, type Permissoes } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

function erroMatriz(vinculoId: string, msg: string): never {
  redirect(`/menu/tripulacao/${vinculoId}?erro=${encodeURIComponent(msg)}`)
}

async function atualizarVinculo(vinculoId: string, permissoes: Permissoes, nivel: string) {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("vinculos")
    .update({ permissoes, nivel })
    .eq("id", vinculoId)
    .select("id")
  if (error || data?.length === 0) erroMatriz(vinculoId, "Não foi possível salvar — confira seu acesso.")
  revalidatePath(`/menu/tripulacao/${vinculoId}`)
  revalidatePath("/menu/tripulacao")
}

export async function salvarMatriz(formData: FormData) {
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const bruto: Record<string, { ver: boolean; editar: boolean }> = {}
  for (const aba of ABAS) {
    bruto[aba] = {
      ver: formData.get(`${aba}_ver`) === "on",
      editar: formData.get(`${aba}_editar`) === "on",
    }
  }
  await atualizarVinculo(vinculoId, normalizarPermissoes(bruto), "custom")
  redirect(`/menu/tripulacao/${vinculoId}?salvo=1`)
}

export async function aplicarPreset(formData: FormData) {
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const preset = String(formData.get("preset") ?? "") === "completo" ? "completo" : "operacional"
  await atualizarVinculo(vinculoId, PRESETS[preset], preset)
  redirect(`/menu/tripulacao/${vinculoId}?salvo=1`)
}

export async function removerCmdt(formData: FormData) {
  const supabase = await supabaseServer()
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const { error } = await supabase.from("vinculos").delete().eq("id", vinculoId)
  if (error) erroMatriz(vinculoId, "Não foi possível remover.")
  revalidatePath("/menu/tripulacao")
  redirect("/menu/tripulacao")
}

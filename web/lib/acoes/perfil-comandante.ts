"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import type { TipoPerfilComandante } from "@/lib/db/types"

// Onda 39 — mesma tabela/RLS serve Comandantes (§47) e Prestadores (§50),
// só a rota de volta muda (ver migration 037 e o comentário em
// lib/db/types.ts, PerfilComandante). Rota inválida/ausente cai pra
// "comandante" — mesmo padrão de honestidade de sempre: nunca 404 silencioso.
const ROTA_POR_TIPO: Record<TipoPerfilComandante, string> = {
  comandante: "/comandantes",
  prestador: "/prestadores",
}

function tipoValido(v: FormDataEntryValue | null): TipoPerfilComandante {
  return v === "prestador" ? "prestador" : "comandante"
}

function erroPerfil(tipo: TipoPerfilComandante, msg: string): never {
  redirect(`${ROTA_POR_TIPO[tipo]}/perfil?erro=${encodeURIComponent(msg)}`)
}

export async function salvarPerfilComandante(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const tipo = tipoValido(formData.get("tipo"))
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome_publico")
  if (!nome) erroPerfil(tipo, "Informe seu nome profissional.")

  const { data: salvo, error } = await supabase.from("perfis_comandante").upsert({
    usuario_id: user.id,
    tipo,
    nome_publico: nome,
    categoria: texto("categoria"),
    cidade: texto("cidade"),
    bio: texto("bio"),
    telefone: texto("telefone"),
    disponibilidade: texto("disponibilidade"),
    visivel: formData.get("visivel") === "on",
  }).select("usuario_id")
  // sem o select, uma escrita barrada pela RLS voltaria com error null e a
  // tela diria "salvo" sem ter salvado nada (regra da casa, ver CONTRIBUTING.md).
  if (error || !salvo?.length) erroPerfil(tipo, "Não foi possível salvar o perfil. Tente de novo.")

  const rota = ROTA_POR_TIPO[tipo]
  revalidatePath(rota)
  revalidatePath("/hoje")
  redirect(rota)
}

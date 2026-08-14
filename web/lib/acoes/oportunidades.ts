"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import type { StatusOportunidade, TipoOportunidade } from "@/lib/db/types"

// Onda 39 (PRD upgrade2-master §49, §53-54) — o mural de Oportunidades:
// publica uma demanda (vaga, diária, peça/serviço), prestadores/comandantes
// respondem. SEM comissão nem preço-piso — o PRD marca como "estudados, não
// fechados" (§49: R$350 / 10%); decisão comercial do dono, fora desta onda.
// A tela funciona como mural de contato: combina fora do app, sem promessa
// de intermediação de pagamento nenhuma.

const TIPOS: TipoOportunidade[] = ["vaga", "diaria", "peca_servico"]
const STATUS: StatusOportunidade[] = ["aberta", "atendida", "encerrada"]

function erroNova(msg: string): never {
  redirect(`/oportunidades/nova?erro=${encodeURIComponent(msg)}`)
}
function erroDetalhe(id: string, msg: string): never {
  redirect(`/oportunidades/${id}?erro=${encodeURIComponent(msg)}`)
}

/** Nome de exibição autodeclarado (ver migration 038 — profiles tem RLS de
 *  tripulação e não dá pra confiar num JOIN pra mostrar o nome de um
 *  estranho). Prioridade: perfil de comandante/prestador já público, senão
 *  o nome da conta. Nunca vazio — "Comandante" é o mesmo fallback que
 *  /hoje já usa quando profiles.nome está vazio. */
async function nomeAutodeclarado(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
): Promise<string> {
  const { data: perfilProfissional } = await supabase
    .from("perfis_comandante").select("nome_publico").eq("usuario_id", userId).maybeSingle()
  if (perfilProfissional?.nome_publico) return perfilProfissional.nome_publico
  const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", userId).maybeSingle()
  return perfil?.nome?.trim() || "Comandante"
}

export async function criarOportunidade(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }

  const tipo = String(formData.get("tipo") ?? "") as TipoOportunidade
  if (!TIPOS.includes(tipo)) erroNova("Escolha o tipo da oportunidade.")
  const titulo = texto("titulo")
  if (!titulo) erroNova("Dê um título curto — ex.: \"COMPRO — Rádio VHF\".")

  const autorNome = await nomeAutodeclarado(supabase, user.id)

  const { data: criada, error } = await supabase.from("oportunidades").insert({
    autor_id: user.id,
    autor_nome: autorNome,
    tipo,
    titulo,
    categoria: texto("categoria"),
    descricao: texto("descricao"),
    local: texto("local"),
  }).select("id").single()
  if (error || !criada) erroNova("Não foi possível publicar. Tente de novo.")

  revalidatePath("/oportunidades")
  redirect(`/oportunidades/${criada!.id}?ok=${encodeURIComponent("Publicado")}`)
}

export async function atualizarStatusOportunidade(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const id = String(formData.get("oportunidade_id") ?? "")
  const novoStatus = String(formData.get("status") ?? "") as StatusOportunidade
  if (!STATUS.includes(novoStatus)) erroDetalhe(id, "Status inválido.")

  // .select() + checagem: RLS só deixa o autor atualizar a própria — sem
  // isso, uma tentativa de outra pessoa voltaria com error null e a tela
  // diria "atualizado" sem ter mudado nada (regra da casa, CONTRIBUTING.md).
  const { data: salvo, error } = await supabase
    .from("oportunidades").update({ status: novoStatus }).eq("id", id).eq("autor_id", user.id).select("id")
  if (error || !salvo?.length) erroDetalhe(id, "Não foi possível atualizar agora. Tente de novo.")

  revalidatePath("/oportunidades")
  revalidatePath(`/oportunidades/${id}`)
  redirect(`/oportunidades/${id}?ok=${encodeURIComponent("Atualizado")}`)
}

export async function responderOportunidade(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const id = String(formData.get("oportunidade_id") ?? "")
  const mensagem = String(formData.get("mensagem") ?? "").trim()
  if (!mensagem) erroDetalhe(id, "Escreva uma mensagem pra quem publicou.")
  const telefone = String(formData.get("telefone") ?? "").trim() || null

  const respondenteNome = await nomeAutodeclarado(supabase, user.id)

  const { data: salvo, error } = await supabase.from("respostas_oportunidade").insert({
    oportunidade_id: id,
    respondente_id: user.id,
    nome: respondenteNome,
    mensagem,
    telefone,
  }).select("id")
  if (error || !salvo?.length) {
    // RLS barra resposta a oportunidade fechada OU segunda resposta da
    // mesma pessoa (unique constraint, migration 037) — mensagem cobre os dois.
    erroDetalhe(id, "Não foi possível enviar. A oportunidade pode já ter sido encerrada, ou você já respondeu.")
  }

  revalidatePath(`/oportunidades/${id}`)
  redirect(`/oportunidades/${id}?ok=${encodeURIComponent("Resposta enviada")}`)
}

export async function retirarResposta(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const oportunidadeId = String(formData.get("oportunidade_id") ?? "")
  const { data: salvo, error } = await supabase
    .from("respostas_oportunidade").delete()
    .eq("oportunidade_id", oportunidadeId).eq("respondente_id", user.id).select("id")
  if (error || !salvo?.length) erroDetalhe(oportunidadeId, "Não foi possível retirar a resposta agora.")

  revalidatePath(`/oportunidades/${oportunidadeId}`)
  redirect(`/oportunidades/${oportunidadeId}?ok=${encodeURIComponent("Resposta retirada")}`)
}

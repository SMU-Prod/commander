"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { podeEditar, ROTULO_ABA } from "@/lib/domain/permissoes"
import { proximaOrdemSistema } from "@/lib/domain/sistemas"
import { supabaseServer } from "@/lib/supabase/server"

function erroNovo(equipamentoId: string, msg: string): never {
  redirect(`/barco/equipamento/${equipamentoId}/sistemas/novo?erro=${encodeURIComponent(msg)}`)
}
function erroEditar(equipamentoId: string, sistemaId: string, msg: string): never {
  redirect(`/barco/equipamento/${equipamentoId}/sistemas/${sistemaId}/editar?erro=${encodeURIComponent(msg)}`)
}

async function contextoDoEquipamento(equipamentoId: string) {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const equipamento = painel.equipamentos.find((e) => e.id === equipamentoId)
  if (!equipamento) redirect("/barco")
  const aba = abaDoEquipamento(equipamento.tipo)
  // guard pela área — sem isso o único controle seria a RLS, que barra em
  // silêncio, e a tela diria "salvo" à toa (mesmo padrão de itens/equipamentos)
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco/equipamento/${equipamentoId}?erro=${encodeURIComponent(`Seu acesso não permite editar ${ROTULO_ABA[aba]}.`)}`)
  }
  return { painel, equipamento, aba }
}

function camposDoForm(formData: FormData, falhar: (msg: string) => never) {
  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) falhar("Dê um nome ao sistema.")
  const documentoId = String(formData.get("documento_id") ?? "").trim() || null

  const paginaBruta = String(formData.get("pagina") ?? "").trim()
  let pagina: number | null = null
  if (paginaBruta) {
    const n = Number(paginaBruta)
    if (!Number.isInteger(n) || n <= 0) falhar("Informe a página do manual com um número inteiro maior que zero.")
    pagina = n
  }
  // página só faz sentido junto de um documento — sem documento, não há
  // manual pra abrir em página nenhuma.
  if (!documentoId) pagina = null

  const observacao = String(formData.get("observacao") ?? "").trim() || null
  return { nome, documentoId, pagina, observacao }
}

async function validarDocumento(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  embarcacaoId: string,
  documentoId: string | null,
  falhar: (msg: string) => never,
) {
  if (!documentoId) return
  const { data } = await supabase.from("documentos")
    .select("id").eq("id", documentoId).eq("embarcacao_id", embarcacaoId).maybeSingle()
  if (!data) falhar("Escolha um documento do acervo desta embarcação.")
}

export async function criarSistema(formData: FormData) {
  const supabase = await supabaseServer()
  const equipamentoId = String(formData.get("equipamento_id") ?? "")
  const { painel } = await contextoDoEquipamento(equipamentoId)
  const falhar = (msg: string): never => erroNovo(equipamentoId, msg)
  const { nome, documentoId, pagina, observacao } = camposDoForm(formData, falhar)
  await validarDocumento(supabase, painel.embarcacao.id, documentoId, falhar)

  const { data: existentes } = await supabase.from("equipamento_sistemas")
    .select("ordem").eq("equipamento_id", equipamentoId)
  const ordem = proximaOrdemSistema(existentes ?? [])

  // .select() + checagem de linhas: sem isso, uma escrita barrada pela RLS
  // volta `error: null` e a tela anunciaria "criado" à toa.
  const { data, error } = await supabase.from("equipamento_sistemas").insert({
    equipamento_id: equipamentoId, nome, documento_id: documentoId, pagina, observacao, ordem,
  }).select("id")
  if (error || !data?.length) falhar("Não deu para salvar o sistema agora. Tente de novo em instantes.")

  revalidatePath(`/barco/equipamento/${equipamentoId}`)
  redirect(`/barco/equipamento/${equipamentoId}?ok=${encodeURIComponent("Sistema criado")}`)
}

export async function salvarSistema(formData: FormData) {
  const supabase = await supabaseServer()
  const equipamentoId = String(formData.get("equipamento_id") ?? "")
  const sistemaId = String(formData.get("sistema_id") ?? "")
  const { painel } = await contextoDoEquipamento(equipamentoId)
  const falhar = (msg: string): never => erroEditar(equipamentoId, sistemaId, msg)
  const { nome, documentoId, pagina, observacao } = camposDoForm(formData, falhar)
  await validarDocumento(supabase, painel.embarcacao.id, documentoId, falhar)

  const { data, error } = await supabase.from("equipamento_sistemas")
    .update({ nome, documento_id: documentoId, pagina, observacao })
    .eq("id", sistemaId).eq("equipamento_id", equipamentoId)
    .select("id").maybeSingle()
  if (error || !data) falhar("Não deu para salvar agora. Tente de novo em instantes.")

  revalidatePath(`/barco/equipamento/${equipamentoId}`)
  redirect(`/barco/equipamento/${equipamentoId}?ok=${encodeURIComponent("Sistema salvo")}`)
}

export async function excluirSistema(formData: FormData) {
  const supabase = await supabaseServer()
  const equipamentoId = String(formData.get("equipamento_id") ?? "")
  const sistemaId = String(formData.get("sistema_id") ?? "")
  await contextoDoEquipamento(equipamentoId)

  // o select confirma que a linha saiu: sem ele, uma exclusão barrada pela
  // área de acesso voltaria sem erro e o app anunciaria "excluído" à toa
  const { data: apagado, error } = await supabase.from("equipamento_sistemas")
    .delete().eq("id", sistemaId).eq("equipamento_id", equipamentoId).select("id")
  if (error || !apagado?.length) {
    erroEditar(equipamentoId, sistemaId, "Não deu para excluir agora. Tente de novo em instantes.")
  }

  revalidatePath(`/barco/equipamento/${equipamentoId}`)
  redirect(`/barco/equipamento/${equipamentoId}?ok=${encodeURIComponent("Sistema excluído")}`)
}

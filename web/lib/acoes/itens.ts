"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { abaDoItem, validarNovoItem } from "@/lib/domain/diario"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

function erroNovo(msg: string): never {
  redirect(`/barco/itens/novo?erro=${encodeURIComponent(msg)}`)
}
function erroEditar(id: string, msg: string): never {
  redirect(`/barco/itens/${id}/editar?erro=${encodeURIComponent(msg)}`)
}

/** Para onde voltar depois de salvar/excluir — onde o item aparece hoje. */
function destinoDoItem(equipamentoId: string | null, categoria: string | null): string {
  if (equipamentoId) return `/barco/equipamento/${equipamentoId}`
  if (categoria === "documento") return "/barco/documentos"
  return "/barco"
}

function revalidarTudo(equipamentoIds: (string | null)[]) {
  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/barco/documentos")
  revalidatePath("/hoje")
  for (const id of equipamentoIds) {
    if (id) revalidatePath(`/barco/equipamento/${id}`)
  }
}

export async function criarItemMonitorado(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome")
  if (!nome) erroNovo("Dê um nome ao item.")
  const especificacao = texto("especificacao")
  const quantidade = texto("quantidade")

  const alvo = texto("alvo") ?? "emb"
  const equipamentoId = alvo.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo.startsWith("cat:") ? alvo.slice(4) : null

  const numero = (k: string, msg: string) => {
    const v = texto(k)
    if (v === null) return null
    const n = parseDecimalPtBr(v)
    if (n === null) erroNovo(msg)
    return n
  }
  const intervaloHoras = numero("intervalo_horas", "Informe um intervalo de horas válido.")
  const intervaloMeses = numero("intervalo_meses", "Informe um intervalo de meses válido.")
  const dataFixa = texto("data_fixa")

  const v = validarNovoItem({ intervaloHoras, intervaloMeses, dataFixa })
  if (!v.ok) erroNovo(v.erro)

  const { error } = await supabase.from("itens_monitorados").insert({
    embarcacao_id: painel.embarcacao.id,
    equipamento_id: equipamentoId,
    categoria,
    nome,
    especificacao,
    quantidade,
    intervalo_horas: intervaloHoras,
    intervalo_meses: intervaloMeses,
    data_fixa: dataFixa,
    ultimo_ciclo_data: texto("ultimo_ciclo_data") ?? hojeISO(),
    ultimo_ciclo_horas: numero("ultimo_ciclo_horas", "Informe horas válidas no último serviço."),
  })
  if (error) erroNovo("Não foi possível criar o item. Tente de novo.")

  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect("/barco")
}

export async function salvarItemMonitorado(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("item_id") ?? "")
  const atual = painel.itens.find((i) => i.id === id)
  if (!atual) erroEditar(id, "Item não encontrado.")
  const abaAtual = abaDoItem(atual, painel.equipamentos)
  if (!podeEditar(painel.permissoes, abaAtual)) erroEditar(id, "Seu acesso não permite editar este item.")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome")
  if (!nome) erroEditar(id, "Dê um nome ao item.")
  const especificacao = texto("especificacao")
  const quantidade = texto("quantidade")

  const alvo = texto("alvo") ?? "emb"
  const equipamentoId = alvo.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo.startsWith("cat:") ? alvo.slice(4) : null

  // o alvo pode mudar no editar — checa a aba de destino também, senão dá pra
  // mover um item pra uma aba que o usuário não tem acesso de editar
  const abaNova = abaDoItem({ equipamento_id: equipamentoId, categoria }, painel.equipamentos)
  if (!podeEditar(painel.permissoes, abaNova)) erroEditar(id, "Seu acesso não permite mover o item para essa aba.")

  const numero = (k: string, msg: string) => {
    const v = texto(k)
    if (v === null) return null
    const n = parseDecimalPtBr(v)
    if (n === null) erroEditar(id, msg)
    return n
  }
  const intervaloHoras = numero("intervalo_horas", "Informe um intervalo de horas válido.")
  const intervaloMeses = numero("intervalo_meses", "Informe um intervalo de meses válido.")
  const dataFixa = texto("data_fixa")

  const v = validarNovoItem({ intervaloHoras, intervaloMeses, dataFixa })
  if (!v.ok) erroEditar(id, v.erro)

  const { data, error } = await supabase.from("itens_monitorados").update({
    equipamento_id: equipamentoId,
    categoria,
    nome,
    especificacao,
    quantidade,
    intervalo_horas: intervaloHoras,
    intervalo_meses: intervaloMeses,
    data_fixa: dataFixa,
    ultimo_ciclo_data: texto("ultimo_ciclo_data") ?? hojeISO(),
    ultimo_ciclo_horas: numero("ultimo_ciclo_horas", "Informe horas válidas no último serviço."),
  }).eq("id", id).select("id").maybeSingle()
  if (error || !data) erroEditar(id, "Não foi possível salvar — confira seu acesso.")

  revalidarTudo([atual.equipamento_id, equipamentoId])
  redirect(`${destinoDoItem(equipamentoId, categoria)}?ok=${encodeURIComponent("Item salvo")}`)
}

export async function excluirItemMonitorado(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("item_id") ?? "")
  const atual = painel.itens.find((i) => i.id === id)
  if (!atual) erroEditar(id, "Item não encontrado.")
  const aba = abaDoItem(atual, painel.equipamentos)
  if (!podeEditar(painel.permissoes, aba)) erroEditar(id, "Seu acesso não permite excluir este item.")

  // o select confirma que a linha saiu: sem ele, uma exclusão barrada pela
  // matriz voltaria sem erro e o app anunciaria "excluído" à toa
  const { data: apagado, error } = await supabase
    .from("itens_monitorados").delete().eq("id", id).select("id")
  if (error || !apagado?.length) erroEditar(id, "Não foi possível excluir — confira seu acesso.")

  revalidarTudo([atual.equipamento_id])
  redirect(`${destinoDoItem(atual.equipamento_id, atual.categoria)}?ok=${encodeURIComponent("Item excluído")}`)
}

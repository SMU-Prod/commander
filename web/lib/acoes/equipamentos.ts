"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

const TIPOS = ["motor", "gerador", "bateria", "outro"]
const POSICOES = ["BB", "BE", "central"]

function erroNovo(msg: string): never {
  redirect(`/barco/equipamento/novo?erro=${encodeURIComponent(msg)}`)
}
function erroEditar(id: string, msg: string): never {
  redirect(`/barco/equipamento/${id}/editar?erro=${encodeURIComponent(msg)}`)
}

function camposDoForm(formData: FormData, falhar: (msg: string) => never) {
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const tipo = String(formData.get("tipo") ?? "")
  if (!TIPOS.includes(tipo)) falhar("Escolha o tipo do equipamento.")
  const posicaoBruta = texto("posicao")
  const posicao = posicaoBruta && POSICOES.includes(posicaoBruta) ? posicaoBruta : null

  const inteiro = (k: string, rotulo: string) => {
    const bruto = texto(k)
    if (bruto === null) return null
    const n = parseDecimalPtBr(bruto)
    if (n === null || n < 0) falhar(`Informe ${rotulo} com números.`)
    return Math.round(n)
  }
  const horasBruto = texto("horas_atuais")
  const horas = horasBruto === null ? null : parseDecimalPtBr(horasBruto)
  if (horasBruto !== null && (horas === null || horas < 0)) falhar("Informe as horas com números.")

  return {
    tipo,
    posicao,
    marca: texto("marca"),
    modelo: texto("modelo"),
    numero_serie: texto("numero_serie"),
    identificacao_interna: texto("identificacao_interna"),
    ano: inteiro("ano", "o ano"),
    potencia_hp: inteiro("potencia_hp", "a potência"),
    combustivel: texto("combustivel"),
    quantidade: inteiro("quantidade", "a quantidade"),
    horas_atuais: horas,
    observacoes: texto("observacoes"),
  }
}

export async function criarEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const dados = camposDoForm(formData, erroNovo)

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      ...dados,
      ultima_leitura: dados.horas_atuais != null ? new Date().toISOString() : null,
    })
    .select("id, tipo")
    .single()
  if (error || !data) erroNovo("Não foi possível criar — confira seu acesso a esta aba.")

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/hoje")
  redirect(
    data.tipo === "motor"
      ? `/barco/equipamento/${data.id}?ok=${encodeURIComponent("Equipamento criado")}`
      : `/barco/eletrica?ok=${encodeURIComponent("Equipamento criado")}`,
  )
}

export async function salvarEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  if (!painel.equipamentos.some((e) => e.id === id)) erroEditar(id, "Equipamento não encontrado.")
  const dados = camposDoForm(formData, (msg) => erroEditar(id, msg))

  const { data, error } = await supabase
    .from("equipamentos").update(dados).eq("id", id).select("id").maybeSingle()
  if (error || !data) erroEditar(id, "Não foi possível salvar — confira seu acesso a esta aba.")

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath(`/barco/equipamento/${id}`)
  redirect(`/barco/equipamento/${id}?ok=${encodeURIComponent("Equipamento salvo")}`)
}

export async function excluirEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) erroEditar(id, "Equipamento não encontrado.")

  // o select confirma que a linha saiu: sem ele, uma exclusão barrada pela
  // matriz voltaria sem erro e o app anunciaria "excluído" à toa
  const { data: apagado, error } = await supabase
    .from("equipamentos").delete().eq("id", id).select("id")
  if (error || !apagado?.length) erroEditar(id, "Não foi possível excluir — confira seu acesso.")

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/hoje")
  redirect(
    equipamento.tipo === "motor"
      ? `/barco?ok=${encodeURIComponent("Equipamento excluído")}`
      : `/barco/eletrica?ok=${encodeURIComponent("Equipamento excluído")}`,
  )
}

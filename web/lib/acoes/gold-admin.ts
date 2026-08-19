"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { exigirAreaAdmin, exigirPapelAdmin } from "@/lib/admin"
import { registrarLogAdmin } from "@/lib/log-admin"
import { supabaseServer } from "@/lib/supabase/server"
import type { FaixaPorteGold, GoldAvaliacao } from "@/lib/db/types"

/**
 * Admin Commander Gold (onda 35, Correção 19 do PRD de Correções):
 * Preços · Consultores · Agendamentos · Análise · Aprovação/Reprovação.
 * Toda action confirma a ÁREA primeiro — a RLS/RPC do banco também checam o
 * papel (defesa em profundidade), mas a tela nunca deve deixar a mensagem de
 * erro genérica do banco ser a primeira barreira.
 *
 * Onda 48: `exigirAdmin()` (que era o `is_admin` binário) virou
 * `exigirAreaAdmin("gold")` — operação de vistoria é do Suporte e do
 * Vistoriador; preço é do Comercial. Ver `lib/domain/admin-papeis.ts`.
 */

function erroAdmin(caminho: string, msg: string): never {
  redirect(`${caminho}?erro=${encodeURIComponent(msg)}`)
}
function okAdmin(caminho: string, msg: string): never {
  redirect(`${caminho}?ok=${encodeURIComponent(msg)}`)
}

function revalidarAdminGold(solicitacaoId?: string) {
  revalidatePath("/admin/gold")
  revalidatePath("/admin/gold/precos")
  revalidatePath("/admin/gold/consultores")
  if (solicitacaoId) {
    revalidatePath(`/admin/gold/${solicitacaoId}`)
    revalidatePath(`/barco/selos/gold/${solicitacaoId}`)
  }
}

export async function atualizarPrecoGold(formData: FormData) {
  // Preço é matéria Comercial (§20: "configurável no Admin/Comercial"), não da
  // operação de vistoria — por isso a área é outra. A policy `gold_precos:
  // comercial atualiza` (migration 049) diz o mesmo do lado do banco.
  await exigirAreaAdmin("gold_precos")
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const faixa = String(formData.get("faixa") ?? "") as FaixaPorteGold
  const valorBruto = String(formData.get("valor_reais") ?? "").trim().replace(",", ".")
  const valorCentavos = valorBruto === "" ? null : Math.round(Number(valorBruto) * 100)
  if (valorBruto !== "" && (!Number.isFinite(valorCentavos) || valorCentavos! <= 0)) {
    erroAdmin("/admin/gold/precos", "Valor inválido — use um número em reais, ou deixe vazio para 'sob consulta'.")
  }

  const { data: atualizado, error } = await supabase.from("gold_precos")
    .update({ valor_centavos: valorCentavos, atualizado_por: user?.id ?? null, atualizado_em: new Date().toISOString() })
    .eq("faixa", faixa).select("faixa")
  if (error || !atualizado?.length) erroAdmin("/admin/gold/precos", "Não foi possível salvar o preço. Tente de novo.")

  revalidarAdminGold()
  okAdmin("/admin/gold/precos", "Preço atualizado")
}

export async function criarConsultor(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()

  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) erroAdmin("/admin/gold/consultores", "Informe o nome do consultor.")
  const email = String(formData.get("email") ?? "").trim() || null
  const telefone = String(formData.get("telefone") ?? "").trim() || null
  const regiao = String(formData.get("regiao") ?? "").trim() || null

  const { data: inserido, error } = await supabase.from("gold_consultores")
    .insert({ nome, email, telefone, regiao }).select("id")
  if (error || !inserido?.length) erroAdmin("/admin/gold/consultores", "Não foi possível cadastrar o consultor. Tente de novo.")

  revalidarAdminGold()
  okAdmin("/admin/gold/consultores", "Consultor cadastrado — quando ele fizer login com esse e-mail, o acesso à agenda vincula sozinho.")
}

export async function atualizarConsultor(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) erroAdmin("/admin/gold/consultores", "Informe o nome do consultor.")
  const email = String(formData.get("email") ?? "").trim() || null
  const telefone = String(formData.get("telefone") ?? "").trim() || null
  const regiao = String(formData.get("regiao") ?? "").trim() || null
  const ativo = formData.get("ativo") === "on"

  const { data: atualizado, error } = await supabase.from("gold_consultores")
    .update({ nome, email, telefone, regiao, ativo }).eq("id", id).select("id")
  if (error || !atualizado?.length) erroAdmin("/admin/gold/consultores", "Não foi possível salvar. Tente de novo.")

  revalidarAdminGold()
  okAdmin("/admin/gold/consultores", "Consultor atualizado")
}

/** Agenda a avaliação presencial — só válido quando a solicitação está
 *  `aguardando_agendamento` (pagamento já confirmado pelo webhook do Asaas). */
export async function criarAgendamentoGold(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()

  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const consultorId = String(formData.get("consultor_id") ?? "") || null
  const data = String(formData.get("data") ?? "")
  const hora = String(formData.get("hora") ?? "") || "09:00"
  const local = String(formData.get("local") ?? "").trim() || null
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null
  if (!data) erroAdmin(`/admin/gold/${solicitacaoId}`, "Escolha a data da avaliação.")
  const dataHora = new Date(`${data}T${hora}:00`)
  if (Number.isNaN(dataHora.getTime())) erroAdmin(`/admin/gold/${solicitacaoId}`, "Data ou horário inválidos.")

  const { data: inserido, error } = await supabase.from("gold_agendamentos").insert({
    solicitacao_id: solicitacaoId, consultor_id: consultorId, data_hora: dataHora.toISOString(), local, observacoes,
  }).select("id")
  if (error || !inserido?.length) erroAdmin(`/admin/gold/${solicitacaoId}`, "Não foi possível criar o agendamento. Tente de novo.")

  const { error: erroTransicao } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "agendado",
  })
  if (erroTransicao) {
    erroAdmin(`/admin/gold/${solicitacaoId}`, "Agendamento criado, mas não foi possível avançar o estado. Recarregue e confira.")
  }

  revalidarAdminGold(solicitacaoId)
  okAdmin(`/admin/gold/${solicitacaoId}`, "Avaliação agendada")
}

/** Reagendar/atualizar status sem mexer no estado da solicitação (ela já
 *  está `agendado`). */
export async function atualizarAgendamentoGold(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()

  const id = String(formData.get("id") ?? "")
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const status = String(formData.get("status") ?? "agendado")
  const data = String(formData.get("data") ?? "")
  const hora = String(formData.get("hora") ?? "09:00")
  const local = String(formData.get("local") ?? "").trim() || null
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null

  const payload: Record<string, unknown> = { status, local, observacoes }
  if (data) {
    const dataHora = new Date(`${data}T${hora}:00`)
    if (!Number.isNaN(dataHora.getTime())) payload.data_hora = dataHora.toISOString()
  }

  const { data: atualizado, error } = await supabase.from("gold_agendamentos").update(payload).eq("id", id).select("id")
  if (error || !atualizado?.length) erroAdmin(`/admin/gold/${solicitacaoId}`, "Não foi possível salvar o agendamento.")

  revalidarAdminGold(solicitacaoId)
  okAdmin(`/admin/gold/${solicitacaoId}`, "Agendamento atualizado")
}

/** Abre a análise — a avaliação presencial já aconteceu (consultor marcou
 *  `avaliacao_realizada`), agora é decisão do admin. */
export async function iniciarAnaliseGold(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")

  const { error } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "em_analise",
  })
  if (error) erroAdmin(`/admin/gold/${solicitacaoId}`, "Não foi possível abrir a análise agora.")

  revalidarAdminGold(solicitacaoId)
  okAdmin(`/admin/gold/${solicitacaoId}`, "Análise aberta")
}

/** Aprova — grava a validade (6 ou 12 meses) na avaliação antes de chamar a
 *  transição, porque `gold_definir_estado('aprovado')` exige
 *  `validade_meses` já definido pra gravar o selo (migration 033). */
export async function aprovarSolicitacaoGold(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const validadeMeses = Number(formData.get("validade_meses"))
  if (validadeMeses !== 6 && validadeMeses !== 12) {
    erroAdmin(`/admin/gold/${solicitacaoId}`, "Escolha a validade do selo: 6 ou 12 meses.")
  }

  const { data: avaliacaoBruta } = await supabase.from("gold_avaliacoes").select("*").eq("solicitacao_id", solicitacaoId).maybeSingle()
  const avaliacao = avaliacaoBruta as GoldAvaliacao | null
  if (!avaliacao) erroAdmin(`/admin/gold/${solicitacaoId}`, "Esta solicitação ainda não tem avaliação registrada.")
  if (!avaliacao.data_avaliacao) {
    erroAdmin(`/admin/gold/${solicitacaoId}`, "A avaliação não tem data registrada — confira o Protocolo Commander.")
  }

  const { data: atualizada, error } = await supabase.from("gold_avaliacoes")
    .update({ validade_meses: validadeMeses, resultado: "aprovado", status: "concluida" })
    .eq("id", avaliacao.id).select("id")
  if (error || !atualizada?.length) erroAdmin(`/admin/gold/${solicitacaoId}`, "Não foi possível salvar a validade. Tente de novo.")

  const { error: erroTransicao } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "aprovado",
  })
  if (erroTransicao) {
    erroAdmin(`/admin/gold/${solicitacaoId}`, `Validade salva, mas a aprovação falhou: ${erroTransicao.message}`)
  }

  revalidarAdminGold(solicitacaoId)
  okAdmin(`/admin/gold/${solicitacaoId}`, "Commander Gold aprovado")
}

export async function reprovarSolicitacaoGold(formData: FormData) {
  await exigirAreaAdmin("gold")
  const supabase = await supabaseServer()
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const motivo = String(formData.get("motivo") ?? "").trim() || null

  const { data: avaliacaoBruta } = await supabase.from("gold_avaliacoes").select("id").eq("solicitacao_id", solicitacaoId).maybeSingle()
  if (avaliacaoBruta) {
    // Espelha a aprovação logo acima: confere a linha ANTES de mexer no estado
    // da solicitação. `gold_avaliacoes: atualizar` recusa com zero linha e sem
    // erro, e era o motivo da reprovação — o texto que o cliente vai ler — que
    // ficava para trás enquanto a RPC marcava a solicitação como reprovada.
    const { data: reprovada, error: erroAvaliacao } = await supabase.from("gold_avaliacoes")
      .update({ resultado: "reprovado", status: "concluida", observacoes_gerais: motivo })
      .eq("id", avaliacaoBruta.id).select("id")
    if (erroAvaliacao || !reprovada?.length) {
      erroAdmin(`/admin/gold/${solicitacaoId}`, "A reprovação não foi salva na avaliação. Recarregue e tente de novo.")
    }
  }

  const { error } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "reprovado",
  })
  if (error) erroAdmin(`/admin/gold/${solicitacaoId}`, "Não foi possível registrar a reprovação.")

  revalidarAdminGold(solicitacaoId)
  okAdmin(`/admin/gold/${solicitacaoId}`, "Solicitação marcada como reprovada")
}

/**
 * Região da vistoria (onda 48, PRD §21) — é o que dá ESCOPO ao Vistoriador.
 * Só Suporte/CEO define: se o vistoriador pudesse escolher onde trabalha, o
 * escopo regional seria autoatendido e deixaria de ser escopo.
 *
 * Passa por RPC porque `gold_solicitacoes` não tem policy de UPDATE de
 * propósito (a 033 fechou tudo pra que a máquina de estados não fosse
 * contornada por um update solto).
 */
export async function definirRegiaoGold(formData: FormData) {
  await exigirPapelAdmin("suporte")
  const supabase = await supabaseServer()

  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const regiaoId = String(formData.get("regiao_id") ?? "").trim() || null

  const { error } = await supabase.rpc("gold_definir_regiao", {
    p_solicitacao_id: solicitacaoId,
    p_regiao_id: regiaoId,
  })
  if (error) erroAdmin(`/admin/gold/${solicitacaoId}`, "Não foi possível definir a região. Tente de novo.")

  await registrarLogAdmin({
    acao: "gold.regiao.definir",
    entidade: "gold_solicitacoes",
    entidadeId: solicitacaoId,
    statusDepois: regiaoId ? "com região" : "sem região",
    detalhes: { regiao_id: regiaoId },
  })

  revalidarAdminGold(solicitacaoId)
  okAdmin(
    `/admin/gold/${solicitacaoId}`,
    regiaoId
      ? "Região definida — vistoriadores autorizados nela já enxergam esta vistoria."
      : "Região removida — nenhum vistoriador enxerga esta vistoria agora.",
  )
}

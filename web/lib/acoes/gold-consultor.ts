"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { HUBS_PROTOCOLO_GOLD } from "@/lib/domain/gold"
import { supabaseServer } from "@/lib/supabase/server"
import type { EstadoItemProtocolo, GoldAvaliacao, HubProtocoloGold } from "@/lib/db/types"

/**
 * Ações do consultor náutico (onda 35) — preenchimento do Protocolo Commander
 * em campo. A RLS (`gold_consultor_atribuido`/`gold_consultor_atribuido_avaliacao`,
 * migration 033) garante que um consultor só escreve nas solicitações que
 * têm um agendamento dele — a checagem aqui na action é só pra mensagem de
 * erro melhor, o banco é quem de fato barra.
 */

function erroConsultor(caminho: string, msg: string): never {
  redirect(`${caminho}?erro=${encodeURIComponent(msg)}`)
}
function okConsultor(caminho: string, msg: string): never {
  redirect(`${caminho}?ok=${encodeURIComponent(msg)}`)
}

/** Primeiro acesso do consultor — vincula o login ao cadastro que o admin já
 *  fez em `gold_consultores` (mesmo e-mail). */
export async function reivindicarConsultor() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { error } = await supabase.rpc("gold_reivindicar_consultor")
  if (error) {
    erroConsultor(
      "/consultor",
      "Não encontramos um cadastro de consultor com o e-mail desta conta. Peça pra equipe Commander conferir o e-mail cadastrado.",
    )
  }
  revalidatePath("/consultor")
  okConsultor("/consultor", "Acesso de consultor vinculado")
}

/** Abre o Protocolo Commander pra uma solicitação agendada — cria a
 *  avaliação (se ainda não existir) já com os 8 hubs em N/A, prontos pro
 *  consultor marcar item a item. */
export async function iniciarAvaliacaoGold(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")

  const { data: meuConsultor } = await supabase.from("gold_consultores").select("id").eq("usuario_id", user.id).maybeSingle()
  if (!meuConsultor) erroConsultor("/consultor", "Seu acesso de consultor ainda não está vinculado.")

  const { data: existente } = await supabase.from("gold_avaliacoes").select("id").eq("solicitacao_id", solicitacaoId).maybeSingle()
  let avaliacaoId = existente?.id as string | undefined

  if (!avaliacaoId) {
    const { data: agendamento } = await supabase.from("gold_agendamentos").select("id")
      .eq("solicitacao_id", solicitacaoId).order("criado_em", { ascending: false }).limit(1).maybeSingle()

    const { data: inserida, error } = await supabase.from("gold_avaliacoes").insert({
      solicitacao_id: solicitacaoId,
      consultor_id: meuConsultor.id,
      agendamento_id: agendamento?.id ?? null,
    }).select("id")
    if (error || !inserida?.length) erroConsultor(`/consultor/${solicitacaoId}`, "Não foi possível abrir o Protocolo Commander. Tente de novo.")
    avaliacaoId = inserida![0].id

    // ZERO LINHA AQUI É O PROJETO, NÃO UM DEFEITO. O `ignoreDuplicates` existe
    // para o segundo clique e para dois consultores abrindo o protocolo ao
    // mesmo tempo: o PostgREST devolve sem as linhas que já estavam lá, e um
    // `.select()` com checagem de vazio transformaria "os 8 hubs já existem" —
    // o desfecho desejado — em erro na cara do consultor. A recusa por policy
    // não se esconde atrás disso: `gold_protocolo_itens: criar` pergunta o
    // mesmo que `gold_avaliacoes: criar`, e o insert da avaliação, cinco linhas
    // acima, é conferido linha a linha.
    const { error: erroItens } = await supabase.from("gold_protocolo_itens")
      .upsert(
        HUBS_PROTOCOLO_GOLD.map((hub) => ({ avaliacao_id: avaliacaoId, hub, estado: "na" as EstadoItemProtocolo })),
        { onConflict: "avaliacao_id,hub", ignoreDuplicates: true },
      )
    if (erroItens) erroConsultor(`/consultor/${solicitacaoId}`, "Protocolo aberto, mas os hubs não carregaram. Recarregue a página.")
  }

  revalidatePath(`/consultor/${solicitacaoId}`)
  redirect(`/consultor/${solicitacaoId}`)
}

/** Marca um hub do Protocolo Commander — avaliado / atenção / N/A (PRD §41:
 *  "nem tudo é aplicável a toda embarcação"). */
export async function salvarItemProtocolo(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const hub = String(formData.get("hub") ?? "") as HubProtocoloGold
  const estado = String(formData.get("estado") ?? "") as EstadoItemProtocolo
  const observacao = String(formData.get("observacao") ?? "").trim() || null

  if (!HUBS_PROTOCOLO_GOLD.includes(hub) || !["avaliado", "atencao", "na"].includes(estado)) {
    erroConsultor(`/consultor/${solicitacaoId}`, "Hub ou estado inválido.")
  }

  const { data: atualizado, error } = await supabase.from("gold_protocolo_itens")
    .update({ estado, observacao, atualizado_em: new Date().toISOString() })
    .eq("avaliacao_id", avaliacaoId).eq("hub", hub).select("id")
  if (error || !atualizado?.length) erroConsultor(`/consultor/${solicitacaoId}`, `Não foi possível salvar "${hub}". Tente de novo.`)

  revalidatePath(`/consultor/${solicitacaoId}`)
  redirect(`/consultor/${solicitacaoId}`)
}

/** Fecha a avaliação presencial — passa a solicitação pra `avaliacao_realizada`,
 *  liberando a Análise pro admin. Não decide aprovado/reprovado (isso é do
 *  admin, na Análise) — o consultor só registra que a visita aconteceu. */
export async function concluirAvaliacaoGold(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "")
  const observacoesGerais = String(formData.get("observacoes_gerais") ?? "").trim() || null

  const { data: avaliacaoBruta } = await supabase.from("gold_avaliacoes").select("*").eq("id", avaliacaoId).maybeSingle()
  const avaliacao = avaliacaoBruta as GoldAvaliacao | null
  if (!avaliacao) erroConsultor("/consultor", "Avaliação não encontrada.")
  const solicitacaoId = avaliacao.solicitacao_id
  // Todos os hubs já nascem em "na" (PRD §41: N/A é resposta válida) — não
  // há checagem de "todos preenchidos" bloqueando a conclusão.

  const { data: atualizada, error } = await supabase.from("gold_avaliacoes")
    .update({
      status: "concluida",
      data_avaliacao: new Date().toISOString().slice(0, 10),
      observacoes_gerais: observacoesGerais,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", avaliacaoId).select("id")
  if (error || !atualizada?.length) erroConsultor(`/consultor/${solicitacaoId}`, "Não foi possível concluir a avaliação. Tente de novo.")

  const { error: erroTransicao } = await supabase.rpc("gold_definir_estado", {
    p_solicitacao_id: solicitacaoId, p_novo_estado: "avaliacao_realizada",
  })
  if (erroTransicao) {
    erroConsultor(`/consultor/${solicitacaoId}`, `Avaliação salva, mas não foi possível avançar o estado: ${erroTransicao.message}`)
  }

  revalidatePath(`/consultor/${solicitacaoId}`)
  revalidatePath("/consultor")
  okConsultor("/consultor", "Avaliação presencial concluída — segue para análise da equipe Commander")
}

export async function atualizarStatusAgendamentoConsultor(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const id = String(formData.get("id") ?? "")
  const solicitacaoId = String(formData.get("solicitacao_id") ?? "")
  const status = String(formData.get("status") ?? "")
  if (!["agendado", "confirmado", "realizado", "cancelado", "reagendado"].includes(status)) {
    erroConsultor(`/consultor/${solicitacaoId}`, "Status inválido.")
  }

  const { data: atualizado, error } = await supabase.from("gold_agendamentos").update({ status }).eq("id", id).select("id")
  if (error || !atualizado?.length) erroConsultor(`/consultor/${solicitacaoId}`, "Não foi possível atualizar o agendamento.")

  revalidatePath(`/consultor/${solicitacaoId}`)
  okConsultor(`/consultor/${solicitacaoId}`, "Agendamento atualizado")
}

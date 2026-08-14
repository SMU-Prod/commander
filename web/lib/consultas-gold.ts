import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import type {
  GoldAgendamento, GoldAvaliacao, GoldConsultor, GoldPagamento,
  GoldPreco, GoldProtocoloItem, GoldSelo, GoldSolicitacao,
} from "@/lib/db/types"

/** Leituras do Commander Gold do lado do dono/solicitante (onda 35). Nunca
 *  consulta como admin/consultor — essas telas têm as próprias leituras
 *  (`lib/acoes/gold-admin.ts`/páginas de admin e consultor), sempre com
 *  `eh_admin()`/`gold_consultor_atribuido()` checando do lado do banco (RLS),
 *  não só na tela. */

export const carregarPrecosGold = cache(async (): Promise<GoldPreco[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("gold_precos").select("*")
  const ordem = ["ate_30", "31_40", "41_50", "51_60", "61_80", "81_mais"]
  return ((data ?? []) as GoldPreco[]).sort((a, b) => ordem.indexOf(a.faixa) - ordem.indexOf(b.faixa))
})

/** Selo ativo (ou expirado) da embarcação — `null` se ela nunca teve Gold aprovado. */
export const carregarSeloGold = cache(async (embarcacaoId: string): Promise<GoldSelo | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("gold_selos").select("*").eq("embarcacao_id", embarcacaoId).maybeSingle()
  return (data as GoldSelo | null) ?? null
})

/** Última solicitação de Gold para a EMBARCAÇÃO ATIVA (fluxo "minha
 *  embarcação") — a mais recente decide o que a tela mostra: se está aberta,
 *  o tracker; se aprovada/reprovada/cancelada, ainda mostra o resultado (uma
 *  nova solicitação só nasce quando o dono pede de novo). */
export const carregarSolicitacaoGoldDaEmbarcacao = cache(async (embarcacaoId: string): Promise<GoldSolicitacao | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("gold_solicitacoes")
    .select("*")
    .eq("embarcacao_id", embarcacaoId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as GoldSolicitacao | null) ?? null
})

/** Solicitações do usuário logado para "outra embarcação" (Correção 09 —
 *  interessado/comprador avaliando barco de terceiro, sem cadastro no
 *  Commander). Não filtra por embarcação ativa: são pedidos pessoais do
 *  usuário, não do barco. */
export const carregarMinhasSolicitacoesGoldExternas = cache(async (): Promise<GoldSolicitacao[]> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("gold_solicitacoes")
    .select("*")
    .is("embarcacao_id", null)
    .eq("solicitante_id", user.id)
    .order("criado_em", { ascending: false })
  return (data as GoldSolicitacao[] | null) ?? []
})

export interface DetalheSolicitacaoGold {
  solicitacao: GoldSolicitacao
  pagamento: GoldPagamento | null
  agendamento: GoldAgendamento | null
  consultor: GoldConsultor | null
  avaliacao: GoldAvaliacao | null
  itens: GoldProtocoloItem[]
}

/** Tudo que uma tela de acompanhamento/relatório precisa pra uma
 *  solicitação — RLS decide se o usuário logado pode ver cada linha
 *  (`gold_visivel`/`gold_visivel_avaliacao`), então um `id` de outra pessoa
 *  simplesmente devolve `null` nos relacionados em vez de vazar dado. */
export async function carregarDetalheSolicitacaoGold(solicitacaoId: string): Promise<DetalheSolicitacaoGold | null> {
  const supabase = await supabaseServer()
  const { data: solicitacao } = await supabase
    .from("gold_solicitacoes").select("*").eq("id", solicitacaoId).maybeSingle()
  if (!solicitacao) return null

  const [{ data: pagamento }, { data: agendamento }, { data: avaliacao }] = await Promise.all([
    supabase.from("gold_pagamentos").select("*").eq("solicitacao_id", solicitacaoId)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("gold_agendamentos").select("*").eq("solicitacao_id", solicitacaoId)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("gold_avaliacoes").select("*").eq("solicitacao_id", solicitacaoId).maybeSingle(),
  ])

  let consultor: GoldConsultor | null = null
  if (agendamento?.consultor_id) {
    const { data } = await supabase.from("gold_consultores").select("*").eq("id", agendamento.consultor_id).maybeSingle()
    consultor = (data as GoldConsultor | null) ?? null
  }

  let itens: GoldProtocoloItem[] = []
  if (avaliacao) {
    const { data } = await supabase.from("gold_protocolo_itens").select("*").eq("avaliacao_id", avaliacao.id)
    itens = (data as GoldProtocoloItem[] | null) ?? []
  }

  return {
    solicitacao: solicitacao as GoldSolicitacao,
    pagamento: (pagamento as GoldPagamento | null) ?? null,
    agendamento: (agendamento as GoldAgendamento | null) ?? null,
    consultor,
    avaliacao: (avaliacao as GoldAvaliacao | null) ?? null,
    itens,
  }
}

export interface RelatorioSeloGold {
  selo: GoldSelo
  avaliacao: GoldAvaliacao | null
  itens: GoldProtocoloItem[]
  consultor: GoldConsultor | null
}

/** Tudo que o modal do selo (Correção 12) precisa pra mostrar de uma vez —
 *  `null` quando a embarcação nunca teve Gold aprovado. */
export const carregarRelatorioSeloGold = cache(async (embarcacaoId: string): Promise<RelatorioSeloGold | null> => {
  const supabase = await supabaseServer()
  const { data: selo } = await supabase.from("gold_selos").select("*").eq("embarcacao_id", embarcacaoId).maybeSingle()
  if (!selo) return null

  const [{ data: avaliacao }, { data: consultor }] = await Promise.all([
    supabase.from("gold_avaliacoes").select("*").eq("id", selo.avaliacao_id).maybeSingle(),
    selo.consultor_id
      ? supabase.from("gold_consultores").select("*").eq("id", selo.consultor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const { data: itens } = await supabase.from("gold_protocolo_itens").select("*").eq("avaliacao_id", selo.avaliacao_id)

  return {
    selo: selo as GoldSelo,
    avaliacao: (avaliacao as GoldAvaliacao | null) ?? null,
    itens: (itens as GoldProtocoloItem[] | null) ?? [],
    consultor: (consultor as GoldConsultor | null) ?? null,
  }
})

/** `true` quando o usuário logado é admin Commander (onda 35) — checa via
 *  RPC (o próprio `profiles.is_admin` não é legível de outro usuário pela
 *  RLS normal, então a checagem precisa passar pela função de banco). */
export const ehAdminGold = cache(async (): Promise<boolean> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.rpc("eh_admin")
  return data === true
})

/** Perfil de consultor do usuário logado, se houver — usado pra gatear as
 *  telas `/consultor/*` e achar o `consultor_id` sem precisar de outra RPC. */
export const carregarMeuPerfilConsultor = cache(async (): Promise<GoldConsultor | null> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("gold_consultores").select("*").eq("usuario_id", user.id).maybeSingle()
  return (data as GoldConsultor | null) ?? null
})

export { hojeISO, carregarPainel }

import { cache } from "react"
import { calcularReputacao, podeAvaliar, type Reputacao } from "@/lib/domain/avaliacoes"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  Avaliacao, AvaliacaoContestacao, AvaliacaoResposta, AvaliacaoSolucao,
  Negocio, NegocioConfirmacao, Proposta,
} from "@/lib/db/types"

/**
 * Leituras das Avaliações (onda 49, PRD §14).
 *
 * Nada aqui filtra visibilidade "na mão": a RLS da migration 050 já decide o
 * que cada pessoa enxerga (pública pra todo mundo logado; oculta só pras duas
 * partes e pro admin). As funções abaixo só montam o formato que a tela usa —
 * se uma delas esquecesse um filtro, o banco continuaria não entregando o que
 * não pode.
 */

/** Uma avaliação com tudo que gira em volta dela: a resposta padronizada do
 *  avaliado, a contestação (se houve) e o "problema solucionado". */
export interface AvaliacaoCompleta {
  avaliacao: Avaliacao
  resposta: AvaliacaoResposta | null
  contestacao: AvaliacaoContestacao | null
  solucao: AvaliacaoSolucao | null
}

async function montarCompletas(avaliacoes: Avaliacao[]): Promise<AvaliacaoCompleta[]> {
  if (avaliacoes.length === 0) return []
  const supabase = await supabaseServer()
  const ids = avaliacoes.map((a) => a.id)

  const [{ data: respostas }, { data: contestacoes }, { data: solucoes }] = await Promise.all([
    supabase.from("avaliacoes_respostas").select("*").in("avaliacao_id", ids),
    supabase.from("avaliacoes_contestacoes").select("*").in("avaliacao_id", ids),
    supabase.from("avaliacoes_solucoes").select("*").in("avaliacao_id", ids),
  ])

  return avaliacoes.map((avaliacao) => ({
    avaliacao,
    resposta: ((respostas ?? []) as AvaliacaoResposta[]).find((r) => r.avaliacao_id === avaliacao.id) ?? null,
    contestacao:
      ((contestacoes ?? []) as AvaliacaoContestacao[]).find((c) => c.avaliacao_id === avaliacao.id) ?? null,
    solucao: ((solucoes ?? []) as AvaliacaoSolucao[]).find((s) => s.avaliacao_id === avaliacao.id) ?? null,
  }))
}

/** As avaliações SOBRE mim — as que eu posso responder, contestar e marcar
 *  como solucionadas. Inclui as ocultas (sou parte): preciso saber o que foi
 *  ocultado, e por quê. */
export const carregarAvaliacoesRecebidas = cache(async (): Promise<AvaliacaoCompleta[]> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("avaliacoes").select("*").eq("avaliado_id", user.id).order("criado_em", { ascending: false })
  return montarCompletas((data as Avaliacao[] | null) ?? [])
})

/** As avaliações que EU escrevi — as que eu posso editar por 30 dias e onde
 *  confirmo ou nego um "problema solucionado". */
export const carregarAvaliacoesFeitas = cache(async (): Promise<AvaliacaoCompleta[]> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("avaliacoes").select("*").eq("avaliador_id", user.id).order("criado_em", { ascending: false })
  return montarCompletas((data as Avaliacao[] | null) ?? [])
})

/** O que o perfil de uma pessoa mostra. A RLS devolve as públicas pra
 *  qualquer visitante logado e acrescenta as ocultas quando quem olha é o
 *  próprio avaliado — por isso `calcularReputacao` continua sendo quem decide
 *  o que entra na média, e não a query. */
export const carregarAvaliacoesDe = cache(async (usuarioId: string): Promise<AvaliacaoCompleta[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("avaliacoes").select("*").eq("avaliado_id", usuarioId).order("criado_em", { ascending: false })
  return montarCompletas((data as Avaliacao[] | null) ?? [])
})

/** Média e quantidade de várias pessoas de uma vez — é o que a vitrine de
 *  Prestadores/Comandantes precisa pra mostrar a nota no cartão sem fazer uma
 *  consulta por linha. */
export async function carregarReputacoes(usuarioIds: readonly string[]): Promise<Map<string, Reputacao>> {
  const mapa = new Map<string, Reputacao>()
  if (usuarioIds.length === 0) return mapa
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("avaliacoes").select("avaliado_id, nota, visibilidade").in("avaliado_id", [...usuarioIds])

  const linhas = (data as Pick<Avaliacao, "avaliado_id" | "nota" | "visibilidade">[] | null) ?? []
  for (const id of usuarioIds) {
    mapa.set(id, calcularReputacao(linhas.filter((l) => l.avaliado_id === id)))
  }
  return mapa
}

export const carregarAvaliacaoDoNegocio = cache(async (negocioId: string): Promise<AvaliacaoCompleta | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("avaliacoes").select("*").eq("negocio_id", negocioId).maybeSingle()
  if (!data) return null
  const [completa] = await montarCompletas([data as Avaliacao])
  return completa ?? null
})

/** Fila de moderação do Admin (§14: "Admin analisa e pode Manter ou Ocultar").
 *  Sem filtro de admin aqui: a RLS de `avaliacoes_contestacoes` só devolve a
 *  fila inteira pra quem é admin — para os demais volta a própria linha. */
export const carregarContestacoesPendentes = cache(async (): Promise<
  { contestacao: AvaliacaoContestacao; avaliacao: Avaliacao }[]
> => {
  const supabase = await supabaseServer()
  const { data: contestacoes } = await supabase
    .from("avaliacoes_contestacoes").select("*").eq("status", "pendente").order("criado_em")
  const lista = (contestacoes as AvaliacaoContestacao[] | null) ?? []
  if (lista.length === 0) return []

  const { data: avaliacoes } = await supabase
    .from("avaliacoes").select("*").in("id", lista.map((c) => c.avaliacao_id))
  const porId = new Map(((avaliacoes as Avaliacao[] | null) ?? []).map((a) => [a.id, a]))

  return lista.flatMap((contestacao) => {
    const avaliacao = porId.get(contestacao.avaliacao_id)
    return avaliacao ? [{ contestacao, avaliacao }] : []
  })
})

/** Um negócio meu que já pode virar avaliação (§11.6 → §14) e ainda não
 *  virou. É o que a tela de Avaliações usa pra dizer "você tem 2 pendentes",
 *  em vez de esperar a pessoa lembrar de voltar na ficha do pedido. */
export interface NegocioParaAvaliar {
  negocioId: string
  demandaId: string
  fornecedorNome: string
}

export const carregarNegociosParaAvaliar = cache(async (): Promise<NegocioParaAvaliar[]> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Só onde EU sou o cliente: quem prestou o serviço não avalia o cliente
  // (ver o cabeçalho da migration 050).
  const { data: negociosBrutos } = await supabase
    .from("negocios").select("*").eq("cliente_id", user.id).order("criado_em", { ascending: false })
  const negocios = (negociosBrutos as Negocio[] | null) ?? []
  if (negocios.length === 0) return []

  const ids = negocios.map((n) => n.id)
  const [{ data: confirmacoes }, { data: jaAvaliados }, { data: propostas }] = await Promise.all([
    supabase.from("negocios_confirmacoes").select("*").in("negocio_id", ids),
    supabase.from("avaliacoes").select("negocio_id").in("negocio_id", ids),
    supabase.from("propostas").select("id, autor_nome").in("id", negocios.map((n) => n.proposta_id)),
  ])

  const avaliados = new Set(((jaAvaliados ?? []) as { negocio_id: string }[]).map((a) => a.negocio_id))
  const nomes = new Map(
    ((propostas ?? []) as Pick<Proposta, "id" | "autor_nome">[]).map((p) => [p.id, p.autor_nome]),
  )

  return negocios.flatMap((n) => {
    const liberado = podeAvaliar({
      usuarioId: user.id,
      clienteId: n.cliente_id,
      confirmacoes: ((confirmacoes ?? []) as NegocioConfirmacao[]).filter((c) => c.negocio_id === n.id),
      jaAvaliou: avaliados.has(n.id),
    })
    if (!liberado) return []
    return [{
      negocioId: n.id,
      demandaId: n.demanda_id,
      fornecedorNome: nomes.get(n.proposta_id) || "Parceiro",
    }]
  })
})

/**
 * Nome que aparece pra estranhos. `profiles` tem RLS de "próprio ou
 * tripulação" (migration 008) e quem lê uma avaliação não é tripulante de
 * ninguém — um JOIN voltaria vazio SEM erro. Por isso o nome é copiado pra
 * dentro da linha no momento da escrita, como já acontece em `demandas` e
 * `propostas` (migrations 038/046).
 */
export async function nomePublicoDoUsuario(usuarioId: string): Promise<string> {
  const supabase = await supabaseServer()
  const { data: profissional } = await supabase
    .from("perfis_comandante").select("nome_publico").eq("usuario_id", usuarioId).maybeSingle()
  if (profissional?.nome_publico) return profissional.nome_publico as string
  const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", usuarioId).maybeSingle()
  return (perfil?.nome as string | null)?.trim() || "Comandante"
}

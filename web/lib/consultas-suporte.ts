import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  Assinatura,
  Embarcacao,
  Perfil,
  PremiumConcessao,
  Vinculo,
} from "@/lib/db/types"

/**
 * Leituras do Suporte (onda 52, PRD §21).
 *
 * Escopo do §21, palavra por palavra: *"Usuários, embarcações, planos/status,
 * chamados e operação de suporte; sem configurações estratégicas críticas"*.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO DELIBERADAMENTE NÃO LÊ
 * ---------------------------------------------------------------------------
 * Diário de Bordo, itens monitorados, equipamentos, lançamentos financeiros,
 * carteira, fotos, documentos e ocorrências. Nenhuma dessas tabelas ganhou
 * policy pro papel `suporte` na migration 053, então nem adiantaria tentar —
 * e é esse o ponto. O §21 dá ao Suporte "embarcações", não "o dossiê técnico
 * e financeiro da embarcação"; o §22 manda o isolamento entre contas ser
 * obrigatório no backend, e isolamento que não resiste ao próprio time não é
 * isolamento.
 *
 * Se um dia o atendimento precisar de fato ver uma manutenção pra resolver um
 * chamado, o caminho é uma policy nova, escrita e discutida — não um `select`
 * a mais aqui.
 */

// --- Busca de usuário --------------------------------------------------------
export interface UsuarioNaBusca {
  id: string
  nome: string
  telefone: string | null
  criadoEm: string
  embarcacoes: number
}

/**
 * Busca por nome. Sem termo, devolve os últimos cadastrados — uma tela de
 * suporte que abre vazia obriga a pessoa a adivinhar o que digitar.
 *
 * Por que só nome e não e-mail: o e-mail vive em `auth.users`, que o cliente
 * não alcança nem com papel de Suporte (é schema do Supabase Auth, fora da
 * RLS de `public`). Ler de lá exigiria service role no servidor — decisão de
 * segurança que merece sua própria discussão, não um atalho aqui. Fica
 * anotado como limitação real da tela.
 */
export async function buscarUsuarios(termo: string, limite = 30): Promise<UsuarioNaBusca[]> {
  const supabase = await supabaseServer()
  let consulta = supabase.from("profiles").select("id, nome, telefone, created_at")
  const t = termo.trim()
  if (t !== "") consulta = consulta.ilike("nome", `%${t}%`)

  const { data } = await consulta.order("created_at", { ascending: false }).limit(limite)
  const perfis = (data as Pick<Perfil, "id" | "nome" | "telefone" | "created_at">[] | null) ?? []
  if (perfis.length === 0) return []

  const { data: vinculosBrutos } = await supabase
    .from("vinculos").select("usuario_id, embarcacao_id").in("usuario_id", perfis.map((p) => p.id))
  const vinculos = (vinculosBrutos as Pick<Vinculo, "usuario_id" | "embarcacao_id">[] | null) ?? []

  return perfis.map((p) => ({
    id: p.id,
    nome: p.nome,
    telefone: p.telefone,
    criadoEm: p.created_at,
    embarcacoes: vinculos.filter((v) => v.usuario_id === p.id).length,
  }))
}

// --- Ficha do usuário --------------------------------------------------------
export interface EmbarcacaoDoUsuario {
  id: string
  nome: string
  papel: "PROP" | "CMDT"
}

export interface FichaUsuario {
  perfil: Pick<Perfil, "id" | "nome" | "telefone" | "created_at">
  /** Todas as assinaturas, da mais recente pra mais antiga — inclusive as
   *  canceladas. O §23 preserva histórico, e atendimento sem histórico é
   *  chute. */
  assinaturas: Assinatura[]
  /** Acessos de cortesia/Gold/migração vigentes ou vencidos (§2.2, §21). */
  concessoes: PremiumConcessao[]
  embarcacoes: EmbarcacaoDoUsuario[]
}

export const carregarFichaUsuario = cache(async (usuarioId: string): Promise<FichaUsuario | null> => {
  const supabase = await supabaseServer()

  const { data: perfilBruto } = await supabase
    .from("profiles").select("id, nome, telefone, created_at").eq("id", usuarioId).maybeSingle()
  const perfil = perfilBruto as Pick<Perfil, "id" | "nome" | "telefone" | "created_at"> | null
  if (!perfil) return null

  const [{ data: assinaturasBrutas }, { data: concessoesBrutas }, { data: vinculosBrutos }] =
    await Promise.all([
      supabase.from("assinaturas").select("*").eq("usuario_id", usuarioId).order("criado_em", { ascending: false }),
      supabase.from("premium_concessoes").select("*").eq("usuario_id", usuarioId).order("criado_em", { ascending: false }),
      supabase.from("vinculos").select("embarcacao_id, papel").eq("usuario_id", usuarioId).order("created_at"),
    ])

  const vinculos = (vinculosBrutos as Pick<Vinculo, "embarcacao_id" | "papel">[] | null) ?? []
  const { data: barcosBrutos } = vinculos.length
    ? await supabase.from("embarcacoes").select("id, nome").in("id", vinculos.map((v) => v.embarcacao_id))
    : { data: null }
  const barcos = new Map(((barcosBrutos as Pick<Embarcacao, "id" | "nome">[] | null) ?? []).map((e) => [e.id, e.nome]))

  return {
    perfil,
    assinaturas: (assinaturasBrutas as Assinatura[] | null) ?? [],
    concessoes: (concessoesBrutas as PremiumConcessao[] | null) ?? [],
    embarcacoes: vinculos.map((v) => ({
      id: v.embarcacao_id,
      // Barco apagado ainda deixa vínculo? Não deixa (FK cascade), mas se um
      // dia deixar, a tela diz o que é em vez de mostrar um uuid.
      nome: barcos.get(v.embarcacao_id) ?? "Embarcação removida",
      papel: v.papel,
    })),
  }
})

// --- Ficha da embarcação -----------------------------------------------------
export interface AcessoDaEmbarcacao {
  usuarioId: string
  nome: string
  papel: "PROP" | "CMDT"
  desde: string
}

export interface FichaEmbarcacao {
  embarcacao: Embarcacao
  acessos: AcessoDaEmbarcacao[]
}

/**
 * Cadastro da embarcação + quem tem acesso a ela.
 *
 * Só CADASTRO: nome, medidas, casco, TIE, capitania, base. Nada de motor,
 * manutenção, diário, foto ou dinheiro — ver o cabeçalho deste arquivo. É o
 * suficiente pra o atendimento conferir "é este barco mesmo?" e "quem
 * consegue entrar nele?", que são as duas perguntas de um chamado.
 */
export const carregarFichaEmbarcacao = cache(async (embarcacaoId: string): Promise<FichaEmbarcacao | null> => {
  const supabase = await supabaseServer()

  const { data: bruta } = await supabase.from("embarcacoes").select("*").eq("id", embarcacaoId).maybeSingle()
  const embarcacao = bruta as Embarcacao | null
  if (!embarcacao) return null

  const { data: vinculosBrutos } = await supabase
    .from("vinculos").select("usuario_id, papel, created_at").eq("embarcacao_id", embarcacaoId).order("created_at")
  const vinculos = (vinculosBrutos as Pick<Vinculo, "usuario_id" | "papel" | "created_at">[] | null) ?? []

  const { data: perfisBrutos } = vinculos.length
    ? await supabase.from("profiles").select("id, nome").in("id", vinculos.map((v) => v.usuario_id))
    : { data: null }
  const nomes = new Map(((perfisBrutos as Pick<Perfil, "id" | "nome">[] | null) ?? []).map((p) => [p.id, p.nome]))

  return {
    embarcacao,
    acessos: vinculos.map((v) => ({
      usuarioId: v.usuario_id,
      nome: nomes.get(v.usuario_id) ?? "Conta removida",
      papel: v.papel,
      desde: v.created_at,
    })),
  }
})

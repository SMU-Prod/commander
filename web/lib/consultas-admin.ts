import { cache } from "react"
import { calcularMetricasComerciais, type ConfirmacaoNegocio } from "@/lib/domain/marketplace"
import type {
  FonteAssinaturas,
  FonteComercial,
  FonteGold,
  FonteParceiros,
  FontePessoas,
  FontePublicidade,
  FontesDashboard,
  Leitura,
} from "@/lib/domain/admin-metricas"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  AdminLogDb,
  AdminPapelDb,
  AdminPapelRegiaoDb,
  ItemTaxonomiaDb,
  Negocio,
  NegocioConfirmacao,
  Perfil,
} from "@/lib/db/types"

/**
 * Leituras do Admin Commander (onda 48, PRD §21).
 *
 * Toda métrica passa por uma RPC agregada da migration 049 — nunca por
 * `select *` na tabela de ninguém. É o §22 na prática: o CEO precisa saber
 * QUANTOS assinantes existem, e não tem por que enxergar a linha financeira
 * de uma pessoa pra descobrir isso.
 */

/** Envelopa uma RPC no `Leitura<T>` do domínio: `data` nulo (não é CEO) ou
 *  erro do banco viram ausência EXPLICADA, nunca zero. */
async function lerRpc<T>(nome: string): Promise<Leitura<T>> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.rpc(nome)
  if (error) return { ok: false, motivo: "erro", detalhe: `Fonte indisponível (${nome}).` }
  if (data == null) return { ok: false, motivo: "erro", detalhe: "Esta métrica é do Dashboard CEO." }
  return { ok: true, dados: data as T }
}

/** Métricas comerciais do Marketplace (§21.1). Reaproveita a MESMA regra pura
 *  que `/admin/marketplace` já usa desde a onda 45 — só entra negócio com
 *  confirmação bilateral, e negócio sem valor informado não vira R$ 0 na
 *  média. Duplicar a conta aqui daria dois números diferentes pro mesmo fato. */
async function lerComercial(): Promise<Leitura<FonteComercial>> {
  const supabase = await supabaseServer()
  const [{ data: demandas, error: e1 }, { data: propostas, error: e2 }, { data: negociosBrutos, error: e3 }] =
    await Promise.all([
      supabase.from("demandas").select("id"),
      supabase.from("propostas").select("status"),
      supabase.from("negocios").select("id, fornecedor_id, valor_final_centavos"),
    ])
  if (e1 || e2 || e3) return { ok: false, motivo: "erro" }

  const negocios = (negociosBrutos as Pick<Negocio, "id" | "fornecedor_id" | "valor_final_centavos">[] | null) ?? []
  const { data: confirmacoesBrutas } = negocios.length
    ? await supabase.from("negocios_confirmacoes").select("*").in("negocio_id", negocios.map((n) => n.id))
    : { data: null }
  const confirmacoes = (confirmacoesBrutas as NegocioConfirmacao[] | null) ?? []
  const de = (id: string): ConfirmacaoNegocio[] => confirmacoes.filter((c) => c.negocio_id === id)

  const m = calcularMetricasComerciais({
    demandasPublicadas: (demandas as { id: string }[] | null)?.length ?? 0,
    propostasEnviadas: ((propostas as { status: string }[] | null) ?? []).filter((p) => p.status !== "retirada").length,
    negocios: negocios.map((n) => ({
      fornecedor_id: n.fornecedor_id,
      valor_final_centavos: n.valor_final_centavos,
      confirmacoes: de(n.id),
    })),
  })

  return {
    ok: true,
    dados: {
      demandasPublicadas: m.demandasPublicadas,
      propostasEnviadas: m.propostasEnviadas,
      negociosConfirmados: m.negociosConfirmados,
      volumeInformadoCentavos: m.volumeInformadoCentavos,
      ticketMedioCentavos: m.ticketMedioCentavos,
      negociosComValor: m.negociosComValor,
    },
  }
}

export const carregarFontesDashboard = cache(async (): Promise<FontesDashboard> => {
  const [pessoas, assinaturas, gold, parceiros, comercial, publicidade] = await Promise.all([
    lerRpc<FontePessoas>("admin_metricas_pessoas"),
    lerRpc<FonteAssinaturas>("admin_metricas_assinaturas"),
    lerRpc<FonteGold>("admin_metricas_gold"),
    lerRpc<FonteParceiros>("admin_metricas_parceiros"),
    lerComercial(),
    // Onda 52: a publicidade do §20 ganhou tabela (migration 053), então a
    // fonte deixou de ser ausente. Agora "0 impressões" É uma medição — o
    // produto existe e ninguém viu anúncio ainda —, que é justamente a
    // afirmação que não podia ser feita antes.
    lerRpc<FontePublicidade>("admin_metricas_publicidade"),
  ])

  return {
    pessoas,
    assinaturas,
    gold,
    parceiros,
    comercial,
    publicidade,
    // Continua ausente DE PROPÓSITO, não por falha: os sete planos do §2
    // estão sendo modelados em outra onda, e mostrar zero afirmaria uma
    // contagem que ninguém fez.
    planos: { ok: false, motivo: "sem_fonte" },
  }
})

// --- Administradores --------------------------------------------------------

export interface AdministradorNaTela {
  papel: AdminPapelDb
  nome: string
  regioes: ItemTaxonomiaDb[]
}

/** Lista completa — só o CEO enxerga (RLS da 049). Junta nome do perfil e
 *  regiões autorizadas numa passada só. */
export const carregarAdministradores = cache(async (): Promise<AdministradorNaTela[]> => {
  const supabase = await supabaseServer()
  const { data: papeisBrutos } = await supabase
    .from("admin_papeis").select("*").order("criado_em", { ascending: true })
  const papeis = (papeisBrutos as AdminPapelDb[] | null) ?? []
  if (papeis.length === 0) return []

  const [{ data: perfisBrutos }, { data: vinculosBrutos }] = await Promise.all([
    supabase.from("profiles").select("id, nome").in("id", papeis.map((p) => p.usuario_id)),
    supabase.from("admin_papel_regioes").select("*").in("papel_id", papeis.map((p) => p.id)),
  ])
  const perfis = new Map(((perfisBrutos as Pick<Perfil, "id" | "nome">[] | null) ?? []).map((p) => [p.id, p.nome]))
  const vinculos = (vinculosBrutos as AdminPapelRegiaoDb[] | null) ?? []

  const idsRegiao = [...new Set(vinculos.map((v) => v.regiao_id))]
  const { data: regioesBrutas } = idsRegiao.length
    ? await supabase.from("taxonomia").select("*").in("id", idsRegiao)
    : { data: null }
  const regioes = new Map(((regioesBrutas as ItemTaxonomiaDb[] | null) ?? []).map((r) => [r.id, r]))

  return papeis.map((papel) => ({
    papel,
    nome: perfis.get(papel.usuario_id) ?? "Usuário removido",
    regioes: vinculos
      .filter((v) => v.papel_id === papel.id)
      .map((v) => regioes.get(v.regiao_id))
      .filter((r): r is ItemTaxonomiaDb => r != null)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  }))
})

/** Pessoas que ainda não têm nenhum papel — as candidatas do formulário. Só o
 *  Suporte/CEO lê a base (policy `perfil: suporte enxerga a base`, 049). */
export const carregarCandidatosAdmin = cache(async (): Promise<Pick<Perfil, "id" | "nome">[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("profiles").select("id, nome").order("nome")
  return ((data as Pick<Perfil, "id" | "nome">[] | null) ?? [])
})

// --- Logos (§21.3) ----------------------------------------------------------

export interface LogNaTela extends AdminLogDb {
  nome: string
}

export const carregarLogsAdmin = cache(async (limite = 200): Promise<LogNaTela[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("admin_logs").select("*").order("criado_em", { ascending: false }).limit(limite)
  const logs = (data as AdminLogDb[] | null) ?? []
  if (logs.length === 0) return []

  const ids = [...new Set(logs.map((l) => l.admin_id).filter((i): i is string => i != null))]
  const { data: perfisBrutos } = ids.length
    ? await supabase.from("profiles").select("id, nome").in("id", ids)
    : { data: null }
  const perfis = new Map(((perfisBrutos as Pick<Perfil, "id" | "nome">[] | null) ?? []).map((p) => [p.id, p.nome]))

  return logs.map((l) => ({ ...l, nome: (l.admin_id && perfis.get(l.admin_id)) || "Conta removida" }))
})

import { cache } from "react"
import { hojeISO } from "@/lib/domain/datas"
import {
  destaquesDoExplorar,
  selecionarPatrocinios,
  type CampanhaParaExibicao,
  type ContextoExibicao,
} from "@/lib/domain/publicidade"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  PublicidadeCampanhaDb,
  PublicidadeMetricaDb,
  PublicidadeProdutoDb,
} from "@/lib/db/publicidade"

/**
 * Leituras de publicidade (onda 52, PRD §20 e §3.4).
 *
 * Duas famílias bem separadas, e a separação importa:
 *
 *   · o que a TELA DO CLIENTE lê pra exibir o anúncio — mínimo possível, e
 *     nunca dado de campanha que não esteja no ar (a RLS da migration 053 já
 *     filtra, e aqui a regra pura filtra de novo);
 *   · o que o COMERCIAL lê pra gerir — tudo, inclusive rascunho e encerrada.
 *
 * Nenhuma das duas lê nota, avaliação ou reputação. "Publicidade nunca
 * interfere na nota/reputação do Partner" (§20) só é verdade se os dois
 * assuntos não se encontrarem nem na consulta.
 */

// --- Perfil mínimo do anunciante --------------------------------------------
/**
 * O que o anúncio precisa do Partner, e mais nada.
 *
 * NÃO traz telefone, e-mail, preço nem o perfil inteiro: um cartão de
 * patrocínio no Dashboard mostra nome e leva ao perfil. Puxar o resto
 * despejaria contato de Partner no HTML de todo proprietário — inclusive
 * quem está no Free, pra quem o §2.3 manda esconder exatamente isso.
 *
 * Tipo declarado aqui e não importado de `lib/db/types`: `parceiros` está
 * sendo reescrito noutra onda (Partner por tipo) e este arquivo só depende
 * de três colunas que a reescrita não toca.
 */
export interface AnuncianteMinimo {
  id: string
  nome: string
  regiao_id: string | null
}

export interface AnuncioNaTela {
  campanhaId: string
  parceiroId: string
  nome: string
  chamada: string | null
}

// --- Produtos e preços (§20) -------------------------------------------------
export const carregarProdutosPublicidade = cache(async (): Promise<PublicidadeProdutoDb[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("publicidade_produtos").select("*").order("produto")
  return (data as PublicidadeProdutoDb[] | null) ?? []
})

// --- Patrocínio do Dashboard (§3.4) -----------------------------------------
/**
 * Os patrocinadores que o Dashboard de UMA embarcação pode exibir.
 *
 * A região vem da embarcação (`embarcacoes.regiao_id`, migration 053). Se
 * ela for nula, `segmentacaoAtende` serve só campanha sem segmentação — e
 * isso é intencional: mostrar anúncio de Angra pra um barco que pode estar
 * em Salvador cobraria do Partner um alcance que ele não comprou.
 */
export async function carregarPatrocinioDashboard(regiaoId: string | null): Promise<AnuncioNaTela[]> {
  const supabase = await supabaseServer()

  // A RLS já entrega só campanha vigente (ou própria/comercial); o filtro de
  // produto e de status aqui evita trazer as do Explorar à toa.
  const { data: campanhasBrutas } = await supabase
    .from("publicidade_campanhas")
    .select("*")
    .eq("produto", "patrocinio_dashboard")
    .eq("status", "ativa")
  const campanhas = (campanhasBrutas as PublicidadeCampanhaDb[] | null) ?? []
  if (campanhas.length === 0) return []

  const ctx: ContextoExibicao = { regiaoId }
  const escolhidas = selecionarPatrocinios(campanhas as CampanhaParaExibicao[], ctx, hojeISO())
  if (escolhidas.length === 0) return []

  const { data: parceirosBrutos } = await supabase
    .from("parceiros")
    .select("id, nome, regiao_id")
    .in("id", escolhidas.map((c) => c.parceiro_id))
  const porId = new Map(
    ((parceirosBrutos as AnuncianteMinimo[] | null) ?? []).map((p) => [p.id, p]),
  )

  // Partner suspenso some do carrossel sem precisar de regra nova: a policy
  // `parceiro: ver visiveis ou o proprio` não entrega a linha dele, e um
  // anúncio sem anunciante não vira cartão vazio — vira nada.
  return escolhidas
    .map((c) => {
      const p = porId.get(c.parceiro_id)
      if (!p) return null
      const campanha = campanhas.find((x) => x.id === c.id)
      return {
        campanhaId: c.id,
        parceiroId: p.id,
        nome: p.nome,
        chamada: campanha?.chamada ?? null,
      }
    })
    .filter((a): a is AnuncioNaTela => a != null)
}

// --- Destaque no Explorar (§20) ---------------------------------------------
/**
 * Ids dos Partners com destaque vigente, na ordem de exibição.
 *
 * Fica aqui pronta pra quem montar o Explorar: a tela chama isto e passa o
 * resultado pra `ordenarComDestaque`. O Explorar está sendo reescrito em
 * outra onda (Partner por tipo), então esta onda entrega a REGRA e a
 * consulta, não a página.
 */
export async function carregarDestaquesExplorar(ctx: ContextoExibicao): Promise<string[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("publicidade_campanhas")
    .select("*")
    .in("produto", ["destaque_explorar", "destaque_superior"])
    .eq("status", "ativa")
  const campanhas = (data as PublicidadeCampanhaDb[] | null) ?? []
  return destaquesDoExplorar(campanhas as CampanhaParaExibicao[], ctx, hojeISO())
}

// --- Gestão (Comercial) ------------------------------------------------------
export interface CampanhaNaTela {
  campanha: PublicidadeCampanhaDb
  parceiroNome: string
  impressoes: number
  cliques: number
}

/**
 * Tudo que o Comercial vê: campanhas em qualquer estado, com o desempenho
 * somado. Duas consultas + soma em memória em vez de uma view agregada
 * porque o volume é de dezenas de campanhas — uma view seria manutenção sem
 * ganho, e o dia em que forem milhares a soma vira RPC.
 */
export const carregarCampanhas = cache(async (): Promise<CampanhaNaTela[]> => {
  const supabase = await supabaseServer()
  const { data: campanhasBrutas } = await supabase
    .from("publicidade_campanhas")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(500)
  const campanhas = (campanhasBrutas as PublicidadeCampanhaDb[] | null) ?? []
  if (campanhas.length === 0) return []

  const [{ data: parceirosBrutos }, { data: metricasBrutas }] = await Promise.all([
    supabase.from("parceiros").select("id, nome, regiao_id").in("id", campanhas.map((c) => c.parceiro_id)),
    supabase.from("publicidade_metricas").select("*").in("campanha_id", campanhas.map((c) => c.id)),
  ])
  const nomes = new Map(((parceirosBrutos as AnuncianteMinimo[] | null) ?? []).map((p) => [p.id, p.nome]))
  const metricas = (metricasBrutas as PublicidadeMetricaDb[] | null) ?? []

  return campanhas.map((campanha) => {
    const doDia = metricas.filter((m) => m.campanha_id === campanha.id)
    return {
      campanha,
      // "Partner removido" e não o uuid cru: a campanha sobrevive ao
      // cadastro, e um id na tela não ajuda ninguém a entender o histórico.
      parceiroNome: nomes.get(campanha.parceiro_id) ?? "Partner removido",
      impressoes: doDia.reduce((s, m) => s + m.impressoes, 0),
      cliques: doDia.reduce((s, m) => s + m.cliques, 0),
    }
  })
})

/** Partners que o Comercial pode anunciar. NADA de telefone/e-mail e nada
 *  de `profiles`: §22 — quem vende destaque não precisa do dado pessoal de
 *  ninguém pra vender destaque. */
export const carregarAnunciantes = cache(async (): Promise<AnuncianteMinimo[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("parceiros").select("id, nome, regiao_id").order("nome")
  return (data as AnuncianteMinimo[] | null) ?? []
})

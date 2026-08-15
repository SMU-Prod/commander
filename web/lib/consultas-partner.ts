import { cache } from "react"
import { carregarAssinatura, carregarNivelPlano } from "@/lib/consultas"
import { carregarMapaTaxonomia, nomeDaRegiao } from "@/lib/consultas-marketplace"
import { ehPago } from "@/lib/domain/plano-acesso"
import { explorarCompletoLiberado, ROTULO_TIPO_PARTNER, type TipoPartner } from "@/lib/domain/partner"
import { supabaseServer } from "@/lib/supabase/server"
import type {
  Parceiro,
  ParceiroAcomodacao,
  ParceiroAtividade,
  ParceiroVaga,
} from "@/lib/db/types"

/**
 * Leituras do Commander Partner (onda 51 — PRD §13 e §10).
 *
 * Mesma divisão de trabalho do resto da casa: aqui só se BUSCA e se junta;
 * quem decide qualquer coisa é `lib/domain/partner.ts` (regra pura, com
 * teste). Se aparecer um `if` de produto neste arquivo, ele está no lugar
 * errado.
 */

export interface MeuPartner {
  parceiro: Parceiro
  atividades: ParceiroAtividade[]
  vagas: ParceiroVaga[]
  acomodacoes: ParceiroAcomodacao[]
}

/** URL pública de uma foto do bucket `parceiros`. Fotos de parceiro são
 *  material de marketing — o bucket é público desde a migration 020. */
export async function urlFotoParceiro(path: string): Promise<string> {
  const supabase = await supabaseServer()
  return supabase.storage.from("parceiros").getPublicUrl(path).data.publicUrl
}

/**
 * O Partner da pessoa logada, com tudo o que os painéis do §13 precisam.
 * `cache` do React porque o layout (menu por tipo) e a página (dashboard)
 * pedem a mesma coisa no mesmo request.
 *
 * Devolve `null` pra quem não tem cadastro de parceiro — inclusive pro
 * proprietário comum. Nenhuma tela do grupo `(parceiro)` deve assumir que
 * existe linha.
 */
export const carregarMeuPartner = cache(async (): Promise<MeuPartner | null> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("parceiros").select("*").eq("usuario_id", user.id).maybeSingle()
  const parceiro = data as Parceiro | null
  if (!parceiro) return null

  const [{ data: atividades }, { data: vagas }, { data: acomodacoes }] = await Promise.all([
    supabase.from("parceiro_atividades").select("*").eq("parceiro_id", parceiro.id),
    supabase.from("parceiro_vagas").select("*").eq("parceiro_id", parceiro.id).order("tipo"),
    supabase.from("parceiro_acomodacoes").select("*").eq("parceiro_id", parceiro.id)
      .order("ordem").order("criado_em"),
  ])

  return {
    parceiro,
    atividades: (atividades as ParceiroAtividade[] | null) ?? [],
    vagas: (vagas as ParceiroVaga[] | null) ?? [],
    acomodacoes: (acomodacoes as ParceiroAcomodacao[] | null) ?? [],
  }
})

/**
 * O sinal do §10 já resolvido: esta pessoa vê o Explorar completo?
 *
 * Junta as três leituras (degrau de proprietário, plano da assinatura, tem
 * perfil de Partner?) e entrega pra regra pura `explorarCompletoLiberado`
 * decidir — mesmo padrão de `carregarNivelPlano`: quem lê o banco não é quem
 * decide.
 */
export const carregarElegibilidadeExplorar = cache(async (): Promise<boolean> => {
  const [nivel, { plano }, meu] = await Promise.all([
    carregarNivelPlano(),
    carregarAssinatura(),
    carregarMeuPartner(),
  ])
  return explorarCompletoLiberado({
    proprietarioPago: ehPago(nivel),
    plano,
    temPerfilPartner: meu != null,
  })
})

// ===========================================================================
// §10 — a vitrine do Explorar
// ===========================================================================

/**
 * O cartão do §10: "cards quadrados/visuais com foto, nome, categoria e
 * localização básica".
 *
 * `tipoRotulo` e `local` são `string | null` de propósito, e é aqui que o
 * §2.3 é cumprido: no plano Free eles chegam NULOS DO SERVIDOR ("alguns
 * Partners aleatórios mostram somente foto + nome"). Não é o componente que
 * esconde — o dado não sai do banco pro navegador. Mesma disciplina que a
 * onda 47 aplicou ao mapa; recortar no cliente seria teatro, porque bastaria
 * abrir o HTML da página.
 */
export interface CardVitrine {
  id: string
  nome: string
  fotoUrl: string | null
  /** Ícone/cor que o próprio parceiro escolheu — o fallback visual quando
   *  não há foto, pro cartão nunca virar um retângulo cinza. */
  icone: Parceiro["icone"]
  cor: string
  destaque: boolean
  tipo: TipoPartner | null
  tipoRotulo: string | null
  local: string | null
  /** Ids de `taxonomia` que o parceiro declarou atender. Vazio no Free. */
  atividades: string[]
}

/** Tudo o que a vitrine precisa numa consulta só. Não aplica corte de plano
 *  nenhum — quem decide isso é a página, que é quem conhece o degrau. */
export const carregarVitrine = cache(async (): Promise<{
  parceiros: Parceiro[]
  atividadesPorParceiro: Map<string, string[]>
}> => {
  const supabase = await supabaseServer()
  const [{ data: parceiros, error }, { data: atividades }] = await Promise.all([
    supabase.from("parceiros").select("*").eq("visivel", true).order("plano", { ascending: false }).order("nome"),
    supabase.from("parceiro_atividades").select("parceiro_id, taxonomia_id"),
  ])
  if (error) throw new Error("Não foi possível carregar os parceiros. Recarregue a página.")

  const mapa = new Map<string, string[]>()
  for (const a of (atividades as { parceiro_id: string; taxonomia_id: string }[] | null) ?? []) {
    const lista = mapa.get(a.parceiro_id)
    if (lista) lista.push(a.taxonomia_id)
    else mapa.set(a.parceiro_id, [a.taxonomia_id])
  }
  return { parceiros: (parceiros as Parceiro[] | null) ?? [], atividadesPorParceiro: mapa }
})

/** Cartão completo — pra quem é elegível (§10: "Clique abre perfil completo
 *  para usuários elegíveis"). */
export async function cardCompleto(
  p: Parceiro,
  atividades: readonly string[],
): Promise<CardVitrine> {
  const mapaTaxonomia = await carregarMapaTaxonomia()
  return {
    id: p.id,
    nome: p.nome,
    fotoUrl: p.fotos[0] ? await urlFotoParceiro(p.fotos[0]) : null,
    icone: p.icone,
    cor: p.cor,
    destaque: p.plano === "destaque",
    tipo: p.categoria,
    tipoRotulo: ROTULO_TIPO_PARTNER[p.categoria],
    local: nomeDaRegiao(mapaTaxonomia, p.regiao_id),
    atividades: [...atividades],
  }
}

/**
 * Cartão da amostra do Free (§2.3): foto e nome, e nada mais. Categoria,
 * região e atividades saem NULAS/vazias daqui — não existe caminho pelo qual
 * elas cheguem ao navegador de quem não pagou.
 *
 * `icone`/`cor` continuam porque são o desenho do cartão sem foto, não
 * informação sobre o parceiro (e o §2.3 fala de "detalhe, contato ou ação
 * comercial"). Um cartão sem nada renderizável seria um buraco na tela.
 */
export async function cardAmostraFree(p: Parceiro): Promise<CardVitrine> {
  return {
    id: p.id,
    nome: p.nome,
    fotoUrl: p.fotos[0] ? await urlFotoParceiro(p.fotos[0]) : null,
    icone: p.icone,
    cor: p.cor,
    destaque: false,
    tipo: null,
    tipoRotulo: null,
    local: null,
    atividades: [],
  }
}

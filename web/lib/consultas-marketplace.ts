import { cache } from "react"
import { tituloDaDemanda, tituloDaDisponibilidade, type TipoTaxonomia } from "@/lib/domain/marketplace"
import { supabaseServer } from "@/lib/supabase/server"
import type { Demanda, Disponibilidade, ItemTaxonomiaDb } from "@/lib/db/types"

/**
 * Leituras compartilhadas do Marketplace (onda 45, PRD §11).
 *
 * A taxonomia (§21.2) é carregada uma vez por render e virada num mapa
 * id -> nome: sem isso, cada cartão precisaria de um JOIN, e o título gerado
 * (§11.2) depende justamente desses nomes. `cache` do React garante uma
 * consulta por request mesmo quando três componentes pedem a lista.
 */

export type MapaTaxonomia = Map<string, ItemTaxonomiaDb>

export const carregarTaxonomia = cache(async (): Promise<ItemTaxonomiaDb[]> => {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("taxonomia").select("*").eq("ativo", true).order("ordem").order("nome")
  return (data as ItemTaxonomiaDb[] | null) ?? []
})

export const carregarMapaTaxonomia = cache(async (): Promise<MapaTaxonomia> => {
  const itens = await carregarTaxonomia()
  return new Map(itens.map((i) => [i.id, i]))
})

export function itensDoTipo(itens: readonly ItemTaxonomiaDb[], tipo: TipoTaxonomia): ItemTaxonomiaDb[] {
  return itens.filter((i) => i.tipo === tipo)
}

/** Nome de exibição de um id de taxonomia. Devolve `null` quando o id é nulo
 *  e um texto neutro quando o item foi desativado depois de a demanda ser
 *  publicada — a tela nunca mostra um uuid cru pra quem lê. */
export function nomeDe(mapa: MapaTaxonomia, id: string | null | undefined): string | null {
  if (!id) return null
  return mapa.get(id)?.nome ?? "Não informado"
}

/** Região com UF quando existe ("Angra dos Reis · RJ") — é o que dá contexto
 *  a quem não conhece o nome da cidade. */
export function nomeDaRegiao(mapa: MapaTaxonomia, id: string | null | undefined): string {
  if (!id) return "Região não informada"
  const item = mapa.get(id)
  if (!item) return "Região não informada"
  return item.uf ? `${item.nome} · ${item.uf}` : item.nome
}

/** O título do cartão (§11.2) montado com os nomes já resolvidos. Fica aqui
 *  porque as três telas que listam demanda precisam do mesmo passo de
 *  tradução id -> nome antes de chamar a regra pura. */
export function tituloDeDemanda(mapa: MapaTaxonomia, d: Demanda): string {
  return tituloDaDemanda({
    tipo: d.tipo,
    regiaoNome: mapa.get(d.regiao_id)?.nome ?? "região não informada",
    categoriaNome: nomeDe(mapa, d.categoria_id),
    funcaoNome: nomeDe(mapa, d.funcao_id),
    marcaNome: nomeDe(mapa, d.marca_id),
    combustivelNome: nomeDe(mapa, d.combustivel_id),
    portePes: d.porte_pes,
    tipoVaga: d.tipo_vaga,
    quantidadeLitros: d.quantidade_litros,
    dataDesejada: d.data_desejada,
    dataFim: d.data_fim,
  })
}

export function tituloDeDisponibilidade(mapa: MapaTaxonomia, d: Disponibilidade): string {
  return tituloDaDisponibilidade({
    funcaoNome: mapa.get(d.funcao_id)?.nome ?? "Profissional",
    regiaoNome: mapa.get(d.regiao_id)?.nome ?? "região não informada",
    tipoTrabalho: d.tipo_trabalho,
    dataInicio: d.data_inicio,
    dataFim: d.data_fim,
  })
}

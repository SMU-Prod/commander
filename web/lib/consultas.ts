import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { normalizarPermissoes, type Permissoes } from "@/lib/domain/permissoes"
import { avaliarSelo, type ResultadoSelo } from "@/lib/domain/selo"
import { lerEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"
import type { Embarcacao, Equipamento, ItemMonitorado } from "@/lib/db/types"
import { hojeISO } from "@/lib/domain/datas"

export const carregarPainel = cache(async (): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  papel: "PROP" | "CMDT"
  permissoes: Permissoes | null
  embarcacoes: { id: string; nome: string }[]
} | null> => {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // O barco exibido segue o vínculo do usuário: prioriza o que está marcado
  // como ativo no cookie; sem cookie (ou apontando pra barco sem vínculo),
  // prioriza onde ele é PROP; como CMDT de vários barcos, vale o vínculo
  // mais antigo.
  const { data: meusVinculos, error: erroVinculos } = await supabase
    .from("vinculos")
    .select("embarcacao_id, papel, permissoes")
    .eq("usuario_id", user?.id ?? "")
    .order("created_at")
  if (erroVinculos) throw new Error("Não foi possível carregar seu acesso. Recarregue a página.")
  const ativa = await lerEmbarcacaoAtiva()
  const vinculo =
    (ativa ? (meusVinculos ?? []).find((v) => v.embarcacao_id === ativa) : undefined) ??
    (meusVinculos ?? []).find((v) => v.papel === "PROP") ??
    (meusVinculos ?? [])[0]
  if (!vinculo) return null

  const { data: embarcacao, error } = await supabase
    .from("embarcacoes")
    .select("*")
    .eq("id", vinculo.embarcacao_id)
    .maybeSingle()
  if (error) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")
  if (!embarcacao) return null

  const [{ data: equipamentos, error: equipamentosError }, { data: itens, error: itensError }] = await Promise.all([
    supabase.from("equipamentos").select("*").eq("embarcacao_id", embarcacao.id).order("posicao"),
    supabase.from("itens_monitorados").select("*").eq("embarcacao_id", embarcacao.id).order("created_at"),
  ])
  if (equipamentosError || itensError) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")

  const { data: todas } = await supabase.from("embarcacoes").select("id, nome").order("nome")

  const papel = vinculo.papel as "PROP" | "CMDT"
  const permissoes = papel === "PROP" ? null : normalizarPermissoes(vinculo.permissoes)

  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [], papel, permissoes, embarcacoes: todas ?? [] }
})

/** Selo Ouro: busca o que `carregarPainel` não traz (fotos, eventos do
 *  diário, contatos — documentos com validade já vêm no `painel.itens`) e
 *  entrega pronto ao domínio puro — `avaliarSelo` nunca consulta o banco.
 *  Usado pelo card em `/barco` e pela tela `/barco/selo`; o `cache()` evita
 *  repetir a consulta na mesma renderização. */
export const carregarSelo = cache(async (): Promise<ResultadoSelo | null> => {
  const painel = await carregarPainel()
  if (!painel) return null
  const supabase = await supabaseServer()
  const { embarcacao } = painel

  const [{ count: totalFotos }, { count: totalEventosDiario }, { count: totalContatos }] = await Promise.all([
    supabase.from("fotos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
    supabase.from("eventos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
    supabase.from("contatos").select("id", { count: "exact", head: true })
      .eq("embarcacao_id", embarcacao.id),
  ])

  return avaliarSelo({
    embarcacao,
    equipamentos: painel.equipamentos,
    itens: painel.itens,
    hoje: hojeISO(),
    totalFotos: totalFotos ?? 0,
    totalEventosDiario: totalEventosDiario ?? 0,
    totalContatos: totalContatos ?? 0,
  })
})

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"

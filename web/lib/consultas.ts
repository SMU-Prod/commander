import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import type { Embarcacao, Equipamento, ItemMonitorado } from "@/lib/db/types"

export const carregarPainel = cache(async (): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
} | null> => {
  const supabase = await supabaseServer()
  const { data: embarcacao, error } = await supabase
    .from("embarcacoes")
    .select("id, nome, estaleiro, modelo, ano, marina")
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (error) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")
  if (!embarcacao) return null

  const [{ data: equipamentos, error: equipamentosError }, { data: itens, error: itensError }] = await Promise.all([
    supabase.from("equipamentos").select("*").eq("embarcacao_id", embarcacao.id).order("posicao"),
    supabase.from("itens_monitorados").select("*").eq("embarcacao_id", embarcacao.id).order("created_at"),
  ])
  if (equipamentosError || itensError) throw new Error("Não foi possível carregar os dados da embarcação. Recarregue a página.")
  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [] }
})

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"

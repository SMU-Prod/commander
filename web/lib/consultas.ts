import { cache } from "react"
import { supabaseServer } from "@/lib/supabase/server"
import { normalizarPermissoes, type Permissoes } from "@/lib/domain/permissoes"
import type { Embarcacao, Equipamento, ItemMonitorado } from "@/lib/db/types"

export const carregarPainel = cache(async (): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  papel: "PROP" | "CMDT"
  permissoes: Permissoes | null
} | null> => {
  const supabase = await supabaseServer()
  const { data: embarcacao, error } = await supabase
    .from("embarcacoes")
    .select("*")
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

  const { data: { user } } = await supabase.auth.getUser()
  const { data: vinculo, error: erroVinculo } = await supabase
    .from("vinculos")
    .select("papel, permissoes")
    .eq("embarcacao_id", embarcacao.id)
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle()
  if (erroVinculo) throw new Error("Não foi possível carregar seu acesso. Recarregue a página.")
  const papel = (vinculo?.papel ?? "CMDT") as "PROP" | "CMDT"
  const permissoes = papel === "PROP" ? null : normalizarPermissoes(vinculo?.permissoes)

  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [], papel, permissoes }
})

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"

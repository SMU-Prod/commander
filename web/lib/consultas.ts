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
  const { data: { user } } = await supabase.auth.getUser()

  // O barco exibido segue o vínculo do usuário: prioriza onde ele é PROP;
  // como CMDT de vários barcos, vale o vínculo mais antigo. (Seletor de
  // embarcação no topo fica para a fase do multi-embarcação pleno.)
  const { data: meusVinculos, error: erroVinculos } = await supabase
    .from("vinculos")
    .select("embarcacao_id, papel, permissoes")
    .eq("usuario_id", user?.id ?? "")
    .order("created_at")
  if (erroVinculos) throw new Error("Não foi possível carregar seu acesso. Recarregue a página.")
  const vinculo = (meusVinculos ?? []).find((v) => v.papel === "PROP") ?? (meusVinculos ?? [])[0]
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

  const papel = vinculo.papel as "PROP" | "CMDT"
  const permissoes = papel === "PROP" ? null : normalizarPermissoes(vinculo.permissoes)

  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [], papel, permissoes }
})

export { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
export { hojeISO } from "@/lib/domain/datas"

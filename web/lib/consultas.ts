import { supabaseServer } from "@/lib/supabase/server"
import type { Embarcacao, Equipamento, ItemMonitorado } from "@/lib/db/types"
import type { ItemCalc } from "@/lib/domain/semaforo"

export async function carregarPainel(): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
} | null> {
  const supabase = await supabaseServer()
  const { data: embarcacao } = await supabase
    .from("embarcacoes")
    .select("id, nome, estaleiro, modelo, ano, marina")
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!embarcacao) return null

  const [{ data: equipamentos }, { data: itens }] = await Promise.all([
    supabase.from("equipamentos").select("*").eq("embarcacao_id", embarcacao.id).order("posicao"),
    supabase.from("itens_monitorados").select("*").eq("embarcacao_id", embarcacao.id),
  ])
  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [] }
}

export function itemMonitoradoToItemCalc(item: ItemMonitorado): ItemCalc {
  return {
    intervaloHoras: item.intervalo_horas,
    intervaloMeses: item.intervalo_meses,
    dataFixa: item.data_fixa,
    ultimoCicloData: item.ultimo_ciclo_data,
    ultimoCicloHoras: item.ultimo_ciclo_horas,
  }
}

export { hojeISO } from "@/lib/domain/datas"

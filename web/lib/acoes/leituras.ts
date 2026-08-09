import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Grava a leitura oficial de horas do equipamento — a mesma escrita usada
 * tanto em "Voltei ao mar" (`registro.ts`) quanto no registro de serviço do
 * Diário (`eventos.ts`). Extraída aqui pra não duplicar a atualização em dois
 * lugares; cada chamador decide, com `devePropagarLeitura` (lib/domain/leituras),
 * se deve chamar ou não — esta função apenas grava.
 */
export async function atualizarLeituraEquipamento(
  supabase: SupabaseClient,
  equipamentoId: string,
  novaHoras: number,
) {
  return supabase
    .from("equipamentos")
    .update({ horas_atuais: novaHoras, ultima_leitura: new Date().toISOString() })
    .eq("id", equipamentoId)
    .select("id")
}

import { supabaseServer } from "@/lib/supabase/server"

/**
 * Registro de ação administrativa (PRD §21.3).
 *
 * Não é um `insert` comum de propósito: a tabela `admin_logs` tem INSERT,
 * UPDATE e DELETE revogados de `authenticated` (migration 049). A única porta
 * é a função `registrar_log_admin`, que roda como dona e CARIMBA `auth.uid()`
 * e o papel vigente — o cliente informa o que aconteceu, nunca quem assinou.
 * É o que separa um log de auditoria de um campo de texto.
 *
 * Falha de log NÃO derruba a ação: um erro aqui viraria "não consegui
 * registrar, então não vou aprovar", que é pior que um registro faltando.
 * O erro vai pro console do servidor e a ação segue.
 */
export async function registrarLogAdmin(entrada: {
  acao: string
  entidade: string
  entidadeId?: string | null
  statusAntes?: string | null
  statusDepois?: string | null
  detalhes?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const supabase = await supabaseServer()
    const { error } = await supabase.rpc("registrar_log_admin", {
      p_acao: entrada.acao,
      p_entidade: entrada.entidade,
      p_entidade_id: entrada.entidadeId ?? null,
      p_status_antes: entrada.statusAntes ?? null,
      p_status_depois: entrada.statusDepois ?? null,
      p_detalhes: entrada.detalhes ?? null,
    })
    if (error) console.error("[admin] falha ao registrar log:", error.message)
  } catch (e) {
    console.error("[admin] falha ao registrar log:", e)
  }
}

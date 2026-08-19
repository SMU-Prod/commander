"use server"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Medição de publicidade (PRD §21.1: "Publicidade ativa, impressões e
 * cliques").
 *
 * Separado de `acoes/publicidade.ts` de propósito: aquele arquivo é do
 * Comercial e toda função lá começa com `exigirAreaAdmin`. Estas duas são o
 * contrário — são chamadas pelo PROPRIETÁRIO que está vendo o anúncio, e
 * exigir papel administrativo aqui zeraria o contador. Juntar os dois num
 * arquivo só seria convidar alguém a copiar a guarda errada.
 *
 * As duas passam por RPC `security definer` porque `publicidade_metricas`
 * tem INSERT/UPDATE revogados de `authenticated` (migration 053): o cliente
 * não escreve contador, ele PEDE um incremento — e a função só atende se a
 * campanha estiver vigente.
 *
 * O QUE ESTES NÚMEROS SIGNIFICAM (migration 080, auditoria de 19/08/2026)
 * ----------------------------------------------------------------------
 * Até a 080 o incremento era incondicional, e qualquer usuário logado levava
 * a campanha de um parceiro a qualquer número chamando estas duas funções em
 * laço. Agora a RPC guarda uma janela por pessoa + campanha (`publicidade_vistas`)
 * e ignora a repetição dentro dela:
 *
 *   · impressão — no máximo 1 por pessoa/campanha a cada HORA;
 *   · clique    — no máximo 1 por pessoa/campanha por DIA.
 *
 * Ou seja, `impressoes` conta pessoas-hora distintas e `cliques` conta pessoas
 * distintas no dia — números menores e que sustentam uma conversa comercial.
 * Chamar em excesso daqui não infla nada, mas também não custa nada: a
 * segunda chamada da janela sai da função sem tocar no contador. Este arquivo
 * segue chamando uma vez por render, como sempre.
 *
 * Falha de medição NUNCA quebra a tela: um erro aqui viraria "não consegui
 * contar a impressão, então não mostro o anúncio", que é pior que um número
 * levemente subestimado. Mesma escolha de `lib/log-admin.ts`.
 */

export async function registrarImpressao(campanhaId: string): Promise<void> {
  try {
    const supabase = await supabaseServer()
    const { error } = await supabase.rpc("publicidade_registrar_impressao", { p_campanha_id: campanhaId })
    if (error) console.error("[publicidade] impressão não registrada:", error.message)
  } catch (e) {
    console.error("[publicidade] impressão não registrada:", e)
  }
}

export async function registrarClique(campanhaId: string): Promise<void> {
  try {
    const supabase = await supabaseServer()
    const { error } = await supabase.rpc("publicidade_registrar_clique", { p_campanha_id: campanhaId })
    if (error) console.error("[publicidade] clique não registrado:", error.message)
  } catch (e) {
    console.error("[publicidade] clique não registrado:", e)
  }
}

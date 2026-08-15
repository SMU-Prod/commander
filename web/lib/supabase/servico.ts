import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Cliente com a chave de SERVIÇO — passa por cima da RLS.
 *
 * Existe pra um caso muito específico e nomeado: escrever numa coluna que o
 * próprio dono NÃO pode escrever, depois de o servidor ter confirmado o fato
 * lá fora. Hoje só `lib/acoes/assinatura.ts` usa, pra gravar
 * `assinaturas.plano`/`valor_centavos` DEPOIS que o gateway confirmou a troca.
 *
 * Por que não uma RPC `security definer` aberta ao usuário: qualquer RPC que
 * receba o plano como parâmetro pode ser chamada direto pelo cliente
 * (`/rest/v1/rpc/...`), e alguém pediria `commander_pro` sem pagar — o plano
 * decide limite de embarcação e de tripulação, inclusive na RLS
 * (`plano_do_usuario`, migration 048). A autorização real aqui é "a cobrança
 * mudou no gateway", e só o servidor sabe disso.
 *
 * Regras de uso, curtas: nunca chamar a partir de componente de tela, nunca
 * passar valor vindo direto de formulário sem o servidor ter validado, e
 * sempre restringir a linha pelo `usuario_id` de quem está logado.
 *
 * `null` quando a chave não está configurada (ambiente de preview sem
 * segredos) — quem chama decide o que fazer, nunca estoura de surpresa.
 */
export function supabaseServico(): SupabaseClient | null {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!chave || !url) return null
  return createClient(url, chave, { auth: { persistSession: false } })
}

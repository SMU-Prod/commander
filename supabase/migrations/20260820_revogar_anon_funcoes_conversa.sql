-- Auditoria 360 de 20/08/2026, achado 7: duas funções SECURITY DEFINER
-- executáveis por anon sem necessidade. conversa_tocar é função de TRIGGER
-- (ninguém chama direto) e conversa_par_valido é oráculo de existência de
-- proposta (só faz sentido logado). Revogar de anon não muda nenhum fluxo:
-- os dois caminhos legítimos rodam como authenticated ou via trigger.
--
-- APLICAR NO BANCO VIVO (o MCP foi bloqueado pelo modo de permissão em
-- 20/08): rodar este arquivo no SQL Editor do Supabase, ou via MCP
-- apply_migration numa sessão com permissão. Assinaturas conferidas em
-- pg_proc antes de escrever.
revoke execute on function public.conversa_tocar() from anon;
revoke execute on function public.conversa_par_valido(uuid, uuid, uuid, uuid) from anon;

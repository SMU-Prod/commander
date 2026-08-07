-- 018: travas da 017 que a revisao pegou.
-- (a) a funcao de trigger nasceu executavel por qualquer um via RPC;
-- (b) a policy de UPDATE checava status/usuario mas deixava o usuario gravar
--     fundador_numero (ou valor) arbitrario na propria linha ao cancelar.
--     Privilegio de coluna resolve: authenticated so pode escrever status.

revoke execute on function public.atribuir_fundador_numero() from public, anon, authenticated;

revoke update on table public.assinaturas from authenticated;
grant update (status) on table public.assinaturas to authenticated;

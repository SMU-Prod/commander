-- ============================================================================
-- 067 — A suspensão de acesso passa a valer de verdade
-- ============================================================================
-- FECHA: P0-1 de docs/auditoria/2026-08-19-banco-e-rls.md
--        "Suspender um cotista não tira o acesso dele"
--
-- O PROBLEMA
-- ----------
-- `alternarSuspensao()` (lib/acoes/cotistas.ts) grava `vinculos.suspenso_em`,
-- audita o evento e a tela anuncia "Acesso suspenso". Só que as três funções
-- que decidem TODO o acesso a dado de embarcação — permissao(),
-- pode_ver_embarcacao() e eh_prop() — não olhavam `suspenso_em`. Resultado: a
-- pessoa suspensa continuava lendo diário, documentos, fotos, equipamentos,
-- ocorrências, viagens, auditoria e (com `gastos.ver` na matriz) o financeiro
-- inteiro. Das 218 policies do banco, só 2 checavam suspensão
-- (`envios_cotista` e `votos`): o suspenso parava de votar e de enviar, e
-- continuava lendo tudo.
--
-- POR QUE AQUI E NÃO POLICY POR POLICY
-- ------------------------------------
-- Medido no banco vivo: fora destes três helpers, só 4 policies consultam
-- `vinculos` diretamente (`auditoria` SELECT e INSERT, `carteiras` INSERT,
-- `envios_cotista` INSERT). Todo o resto do isolamento passa por estes três.
-- Corrigir aqui fecha ~25 tabelas de uma vez e mantém uma regra só — corrigir
-- policy por policy seria 216 pontos de falha e a próxima tabela nasceria
-- furada de novo. A policy de SELECT de `auditoria` (o único bypass que
-- concede LEITURA) é tratada na migration 071; a de INSERT é corrigida aqui
-- mesmo, logo abaixo, porque é o mesmo defeito.
--
-- QUEM PERDE ACESSO
-- -----------------
-- Só quem tiver `vinculos.suspenso_em` preenchido — que é exatamente o efeito
-- prometido pelo botão. Conferido no banco em 19/08/2026:
--   vinculos = 3 · suspensos = 0 · PROP suspensos = 0
-- Ou seja: ZERO pessoas perdem acesso hoje. Nenhum vínculo existente é
-- afetado. A mudança só se manifesta na primeira suspensão real.
--
-- SOBRE eh_prop()
-- ---------------
-- Um PROP suspenso perderia o próprio barco. Hoje isso é inalcançável pelo
-- cliente: a policy `vinculos: prop atualiza quem nao e dono` tem
-- `papel <> 'PROP'` no USING e no WITH CHECK, e não existe outra policy de
-- UPDATE em `vinculos` — ninguém consegue suspender um PROP, nem a si mesmo.
-- O filtro aqui é defesa em profundidade (cobre escrita via service_role).
-- A trava declarativa complementar (CHECK) está na migration 072, separada
-- porque é decisão de produto, não correção de segurança.
--
-- DE BRINDE
-- ---------
-- `auth.uid()` vira `(select auth.uid())`: o planner passa a avaliar uma vez
-- por consulta em vez de uma vez por linha. Resolve parte do aviso
-- `auth_rls_initplan` (P2-2) sem migration extra.
--
-- SEGURANÇA DA FUNÇÃO
-- -------------------
-- As três continuam SECURITY DEFINER com `search_path` fixado em 'public' —
-- DEFINER sem search_path fixo é escalada de privilégio. `create or replace`
-- preserva o ACL; ainda assim os grants são reafirmados abaixo (idempotente,
-- e idêntico ao ACL vivo medido: authenticated + service_role, sem anon).
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- permissao(): decide ver/editar em ~25 tabelas pela matriz de permissão
-- ---------------------------------------------------------------------------
create or replace function public.permissao(emb uuid, aba text, modo text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = (select auth.uid())
      and v.suspenso_em is null
      and (
        v.papel = 'PROP'
        or coalesce((v.permissoes -> aba ->> modo)::boolean, false)
      )
  );
$function$;

revoke all on function public.permissao(uuid, text, text) from public, anon;
grant execute on function public.permissao(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pode_ver_embarcacao(): porta de entrada de leitura "tem vínculo?"
-- ---------------------------------------------------------------------------
create or replace function public.pode_ver_embarcacao(emb uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = (select auth.uid())
      and v.suspenso_em is null
  );
$function$;

revoke all on function public.pode_ver_embarcacao(uuid) from public, anon;
grant execute on function public.pode_ver_embarcacao(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- eh_prop(): dono da unidade
-- ---------------------------------------------------------------------------
create or replace function public.eh_prop(emb uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = (select auth.uid())
      and v.papel = 'PROP'
      and v.suspenso_em is null
  );
$function$;

revoke all on function public.eh_prop(uuid) from public, anon;
grant execute on function public.eh_prop(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bypass conhecido: `auditoria` INSERT consulta `vinculos` na mão e por isso
-- escaparia do conserto acima — um suspenso ainda conseguiria gravar linha de
-- auditoria. Passa a usar o helper, que agora respeita a suspensão.
-- Predicado equivalente ao vivo (autor em nome próprio + vínculo na unidade),
-- só que com a suspensão valendo. Impacto hoje: 1 linha na tabela, autor PROP
-- ativo — nada muda para ela.
-- ---------------------------------------------------------------------------
drop policy if exists "auditoria: registra em nome proprio, na embarcacao que acessa" on public.auditoria;
create policy "auditoria: registra em nome proprio, na embarcacao que acessa"
  on public.auditoria
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and public.pode_ver_embarcacao(embarcacao_id)
  );

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois; deve voltar 3)
-- ---------------------------------------------------------------------------
-- select count(*) from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('permissao','pode_ver_embarcacao','eh_prop')
--    and pg_get_functiondef(p.oid) ilike '%suspenso_em%';

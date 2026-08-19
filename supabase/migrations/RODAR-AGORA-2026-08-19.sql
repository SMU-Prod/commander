-- ===========================================================================
-- COMMANDER — correcoes de acesso, 19/08/2026
--
-- Cole ISTO INTEIRO no SQL Editor do Supabase e rode de uma vez. Tudo roda
-- numa transacao: se qualquer linha falhar, NADA e aplicado.
--
-- O QUE MUDA HOJE, NA PRATICA: nada. Conferido linha a linha no banco vivo —
-- 3 vinculos, todos PROP, nenhum suspenso; e cada linha das tabelas tocadas
-- pertence a uma embarcacao onde o ator e PROP. Ninguem perde acesso.
-- O que muda e o FUTURO: a primeira suspensao real passa a funcionar, e as
-- portas abertas fecham.
--
-- Depois de rodar, a ultima consulta deste arquivo imprime a conferencia.
-- ===========================================================================

begin;

-- ############### 067_suspensao_vale_na_raiz.sql ###############

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

drop policy if exists "auditoria: registra em nome proprio, na embarcacao que acessa" on public.auditoria;
create policy "auditoria: registra em nome proprio, na embarcacao que acessa"
  on public.auditoria
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and public.pode_ver_embarcacao(embarcacao_id)
  );


-- ############### 068_viagens_e_sondagens_pela_matriz.sql ###############

drop policy if exists "viagens: tudo com vinculo" on public.viagens;
drop policy if exists "viagens: ver pela matriz" on public.viagens;
drop policy if exists "viagens: criar pela matriz" on public.viagens;
drop policy if exists "viagens: atualizar pela matriz" on public.viagens;
drop policy if exists "viagens: excluir pela matriz" on public.viagens;

create policy "viagens: ver pela matriz" on public.viagens
  for select to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'ver'));

create policy "viagens: criar pela matriz" on public.viagens
  for insert to authenticated
  with check (public.permissao(embarcacao_id, 'diario', 'editar'));

create policy "viagens: atualizar pela matriz" on public.viagens
  for update to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'editar'))
  with check (public.permissao(embarcacao_id, 'diario', 'editar'));

create policy "viagens: excluir pela matriz" on public.viagens
  for delete to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'editar'));

drop policy if exists "sondagens: dono grava e le as suas" on public.sondagens;
drop policy if exists "sondagens: ve as do barco" on public.sondagens;
drop policy if exists "sondagens: grava a propria" on public.sondagens;
drop policy if exists "sondagens: corrige a propria" on public.sondagens;
drop policy if exists "sondagens: apaga a propria" on public.sondagens;

create policy "sondagens: ve as do barco" on public.sondagens
  for select to authenticated
  using (public.pode_ver_embarcacao(embarcacao_id));

create policy "sondagens: grava a propria" on public.sondagens
  for insert to authenticated
  with check (
    public.pode_ver_embarcacao(embarcacao_id)
    and usuario_id = (select auth.uid())
  );

create policy "sondagens: corrige a propria" on public.sondagens
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (
    usuario_id = (select auth.uid())
    and public.pode_ver_embarcacao(embarcacao_id)
  );

create policy "sondagens: apaga a propria" on public.sondagens
  for delete to authenticated
  using (usuario_id = (select auth.uid()));


-- ############### 069_afazeres_pela_matriz.sql ###############

drop policy if exists "afazeres: o dono cria" on public.afazeres;
create policy "afazeres: o dono cria" on public.afazeres
  for insert to authenticated
  with check (
    dono_id = (select auth.uid())
    and (
      embarcacao_id is null
      or public.permissao(embarcacao_id, 'diario', 'editar')
    )
    and (
      responsavel_id is null
      or responsavel_id = dono_id
      or exists (
        select 1 from public.vinculos v
        where v.embarcacao_id = afazeres.embarcacao_id
          and v.usuario_id = afazeres.responsavel_id
          and v.suspenso_em is null
      )
    )
  );

drop policy if exists "afazeres: dono e responsavel leem" on public.afazeres;
drop policy if exists "afazeres: dono, responsavel e a unidade leem" on public.afazeres;
create policy "afazeres: dono, responsavel e a unidade leem" on public.afazeres
  for select to authenticated
  using (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
    or (embarcacao_id is not null and public.eh_prop(embarcacao_id))
  );

drop policy if exists "afazeres: dono e responsavel atualizam" on public.afazeres;
create policy "afazeres: dono e responsavel atualizam" on public.afazeres
  for update to authenticated
  using (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
  )
  with check (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
  );

drop policy if exists "afazeres: so o dono apaga" on public.afazeres;
create policy "afazeres: so o dono apaga" on public.afazeres
  for delete to authenticated
  using (dono_id = (select auth.uid()));


-- ############### 070_estoque_e_tanques_destino_com_vinculo.sql ###############

drop policy if exists "estoque_mov: dono do item registra" on public.estoque_movimentos;
create policy "estoque_mov: dono do item registra" on public.estoque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.estoque_itens i
      where i.id = estoque_movimentos.item_id
        and i.dono_id = (select auth.uid())
    )
    and (
      embarcacao_id is null
      or public.pode_ver_embarcacao(embarcacao_id)
    )
  );

drop policy if exists "tanque_mov: dono do tanque registra" on public.tanque_movimentos;
create policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.tanques t
      where t.id = tanque_movimentos.tanque_id
        and t.dono_id = (select auth.uid())
    )
    and (
      destino_embarcacao_id is null
      or public.pode_ver_embarcacao(destino_embarcacao_id)
    )
  );


-- ############### 071_auditoria_so_para_quem_administra.sql ###############

drop policy if exists "auditoria: quem tem acesso a embarcacao le" on public.auditoria;
drop policy if exists "auditoria: o dono e quem administra leem" on public.auditoria;
create policy "auditoria: o dono e quem administra leem" on public.auditoria
  for select to authenticated
  using (
    public.eh_prop(embarcacao_id)
    or public.permissao(embarcacao_id, 'embarcacao', 'editar')
  );

commit;

-- ===========================================================================
-- CONFERENCIA — rode depois do commit. O esperado esta em cada linha.
-- ===========================================================================
select 'helpers que checam suspensao (esperado 3)' as conferencia,
       count(*)::text as resultado
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('permissao','pode_ver_embarcacao','eh_prop')
   and pg_get_functiondef(p.oid) ilike '%suspenso_em%'
union all
select 'policies ALL sobrando em viagens/sondagens (esperado 0)',
       count(*)::text
  from pg_policies
 where schemaname='public' and tablename in ('viagens','sondagens') and cmd='ALL'
union all
select 'policies com role public nessas tabelas (esperado 0)',
       count(*)::text
  from pg_policies
 where schemaname='public'
   and tablename in ('viagens','sondagens','afazeres','estoque_movimentos','tanque_movimentos','auditoria')
   and roles::text like '%public%';
-- ===========================================================================
-- COMMANDER — terceiro (e ultimo) lote, 19/08/2026
--
-- Cole INTEIRO no SQL Editor e rode. Tudo numa transacao. A conferencia sai
-- no fim.
--
-- A ORDEM IMPORTA: a 079 usa um helper criado pela 078. Elas ja estao na
-- ordem certa aqui — nao reordene.
--
-- IMPACTO HOJE: nenhum. 0 assinaturas, 0 pagamentos Gold, 0 interessados no
-- Connect, metricas de publicidade em zero. Ninguem perde acesso; a 081 so
-- CONCEDE leitura.
--
-- OS INDICES NAO ESTAO AQUI, DE PROPOSITO: `create index concurrently` nao
-- roda dentro de transacao. Eles vao em INDICES-2026-08-19.sql, depois deste.
-- ===========================================================================

begin;

-- ############### 078_gold_pagamentos_insert_travado.sql ###############

begin;

create or replace function public.asaas_id_visto_pelo_gateway(p_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_id is not null and exists (
    select 1 from public.asaas_eventos e
     where e.asaas_payment_id = p_id or e.asaas_subscription_id = p_id
  );
$function$;

revoke all on function public.asaas_id_visto_pelo_gateway(text) from public, anon;
grant execute on function public.asaas_id_visto_pelo_gateway(text) to authenticated, service_role;

create index if not exists asaas_eventos_payment_idx
  on public.asaas_eventos (asaas_payment_id) where asaas_payment_id is not null;
create index if not exists asaas_eventos_subscription_idx
  on public.asaas_eventos (asaas_subscription_id) where asaas_subscription_id is not null;

drop policy if exists "gold_pagamentos: criar" on public.gold_pagamentos;

create policy "gold_pagamentos: criar" on public.gold_pagamentos
  for insert to authenticated
  with check (
    public.tem_papel_admin('suporte')
    or (
      status = 'pendente'
      and pago_em is null
      and (
        asaas_payment_id is null
        or not public.asaas_id_visto_pelo_gateway(asaas_payment_id)
      )
      and exists (
        select 1
          from public.gold_solicitacoes s
          join public.gold_precos p on p.faixa = s.faixa_porte
         where s.id = gold_pagamentos.solicitacao_id
           and (
             s.solicitante_id = (select auth.uid())
             or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id))
           )
           and gold_pagamentos.quem_paga = s.quem_paga
           and gold_pagamentos.valor_centavos = p.valor_centavos
      )
    )
  );

commit;


-- ############### 079_assinaturas_posse_do_id_asaas.sql ###############

begin;

create or replace function public.asaas_cliente_de_outra_pessoa(p_customer_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_customer_id is not null and exists (
    select 1 from public.assinaturas a
     where a.asaas_customer_id = p_customer_id
       and a.usuario_id <> (select auth.uid())
  );
$function$;

revoke all on function public.asaas_cliente_de_outra_pessoa(text) from public, anon;
grant execute on function public.asaas_cliente_de_outra_pessoa(text) to authenticated, service_role;

create index if not exists assinaturas_asaas_customer_idx
  on public.assinaturas (asaas_customer_id);

drop policy if exists "assinatura: criar a propria pendente" on public.assinaturas;

create policy "assinatura: criar a propria pendente" on public.assinaturas
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and status = 'pendente'
    and ultimo_evento_em is null
    and problema_desde is null
    and not public.asaas_id_visto_pelo_gateway(asaas_subscription_id)
    and not public.asaas_cliente_de_outra_pessoa(asaas_customer_id)
  );

commit;


-- ############### 080_publicidade_contadores_por_janela.sql ###############

begin;

create table if not exists public.publicidade_vistas (
  campanha_id uuid        not null references public.publicidade_campanhas(id) on delete cascade,
  usuario_id  uuid        not null references auth.users(id) on delete cascade,
  tipo        text        not null check (tipo in ('impressao', 'clique')),
  janela      timestamptz not null,
  primary key (campanha_id, usuario_id, tipo, janela)
);

create index if not exists publicidade_vistas_janela_idx
  on public.publicidade_vistas (janela);

alter table public.publicidade_vistas enable row level security;

drop policy if exists "publicidade_vistas: comercial le" on public.publicidade_vistas;
create policy "publicidade_vistas: comercial le" on public.publicidade_vistas
  for select to authenticated
  using (public.eh_ceo() or public.tem_papel_admin('comercial'));

revoke all on table public.publicidade_vistas from public, anon, authenticated;
grant select on table public.publicidade_vistas to authenticated;
grant all on table public.publicidade_vistas to service_role;


create or replace function public.publicidade_registrar_impressao(p_campanha_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_janela  timestamptz;
  v_linhas  int;
begin
  if v_usuario is null then return; end if;
  if not public.publicidade_vigente(p_campanha_id) then return; end if;

  v_janela := date_trunc('hour', now());

  insert into public.publicidade_vistas (campanha_id, usuario_id, tipo, janela)
  values (p_campanha_id, v_usuario, 'impressao', v_janela)
  on conflict do nothing;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then return; end if;

  insert into public.publicidade_metricas (campanha_id, dia, impressoes, cliques)
  values (p_campanha_id, public.hoje_sp(), 1, 0)
  on conflict (campanha_id, dia)
  do update set impressoes = public.publicidade_metricas.impressoes + 1;

  delete from public.publicidade_vistas
   where campanha_id = p_campanha_id
     and usuario_id = v_usuario
     and janela < now() - interval '2 days';
end $function$;

create or replace function public.publicidade_registrar_clique(p_campanha_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_janela  timestamptz;
  v_linhas  int;
begin
  if v_usuario is null then return; end if;
  if not public.publicidade_vigente(p_campanha_id) then return; end if;

  v_janela := date_trunc('day', now() at time zone 'America/Sao_Paulo')
                at time zone 'America/Sao_Paulo';

  insert into public.publicidade_vistas (campanha_id, usuario_id, tipo, janela)
  values (p_campanha_id, v_usuario, 'clique', v_janela)
  on conflict do nothing;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then return; end if;

  insert into public.publicidade_metricas (campanha_id, dia, impressoes, cliques)
  values (p_campanha_id, public.hoje_sp(), 0, 1)
  on conflict (campanha_id, dia)
  do update set cliques = public.publicidade_metricas.cliques + 1;

  delete from public.publicidade_vistas
   where campanha_id = p_campanha_id
     and usuario_id = v_usuario
     and janela < now() - interval '2 days';
end $function$;

revoke all on function public.publicidade_registrar_impressao(uuid) from public, anon;
revoke all on function public.publicidade_registrar_clique(uuid) from public, anon;
grant execute on function public.publicidade_registrar_impressao(uuid) to authenticated, service_role;
grant execute on function public.publicidade_registrar_clique(uuid) to authenticated, service_role;

commit;


-- ############### 081_connect_interesses_comercial_le.sql ###############

begin;

drop policy if exists "connect_interesses: comercial le" on public.connect_interesses;

create policy "connect_interesses: comercial le" on public.connect_interesses
  for select to authenticated
  using (public.tem_papel_admin('comercial'));

commit;

commit;

-- ===========================================================================
-- CONFERENCIA
-- ===========================================================================
select 'helper asaas_id_visto_pelo_gateway (esperado 1)' as conferencia, count(*)::text as resultado
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='asaas_id_visto_pelo_gateway'
union all
select 'tabela publicidade_vistas (esperado 1)', count(*)::text
  from information_schema.tables where table_schema='public' and table_name='publicidade_vistas'
union all
select 'policy do comercial em connect_interesses (esperado 1)', count(*)::text
  from pg_policies where schemaname='public' and tablename='connect_interesses' and policyname ilike '%comercial%'
union all
select 'policies de matriz em connect_interesses preservadas (esperado >=1)', count(*)::text
  from pg_policies where schemaname='public' and tablename='connect_interesses' and policyname not ilike '%comercial%'
union all
select 'funcoes novas sem search_path fixado (esperado 0)', count(*)::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('asaas_id_visto_pelo_gateway')
   and (p.proconfig is null or not (p.proconfig::text ilike '%search_path%'));
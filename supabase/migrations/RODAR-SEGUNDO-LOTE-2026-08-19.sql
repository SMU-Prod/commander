-- ===========================================================================
-- COMMANDER — segundo lote, 19/08/2026
--
-- Cole INTEIRO no SQL Editor do Supabase e rode. Tudo numa transacao: se
-- qualquer linha falhar, NADA e aplicado. A conferencia sai no fim.
--
-- O QUE MUDA HOJE: nada quebra e ninguem perde acesso. Conferido no banco:
-- 0 assinaturas, 0 solicitacoes Gold, 0 pagamentos, 0 cotistas.
--
-- ORDEM IMPORTA SO NUM PONTO, e ja esta resolvido: o codigo do webhook que
-- usa as tabelas/colunas das migrations 075 e 076 JA ESTA NO AR, mas ele so
-- toca no banco DEPOIS de conferir o segredo `ASAAS_WEBHOOK_TOKEN` — que
-- ainda nao existe em producao. Ou seja: hoje ele devolve 401 antes de
-- qualquer consulta. Rodar este arquivo ANTES de configurar o Asaas fecha a
-- janela de vez.
--
-- DEPOIS DE RODAR, ainda falta UMA COISA pro link de cotista funcionar:
-- nenhuma das 9 embarcacoes tem cota definida. Ate o ADM definir a cota em
-- /cotistas, o link responde "sem vaga" — corretamente. Nao e bug.
-- ===========================================================================

begin;

-- ############### 074_gold_solicitante_avanca_para_pagamento.sql ###############

create or replace function public.gold_definir_estado(
  p_solicitacao_id uuid, p_novo_estado text, p_observacao text default null::text
)
returns public.gold_solicitacoes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atual text;
  v_embarcacao_id uuid;
  v_pode boolean;
  v_row public.gold_solicitacoes;
  v_avaliacao public.gold_avaliacoes;
  v_prop_id uuid;
  v_validade_ate date;
  v_selo_id uuid;
begin
  select estado, embarcacao_id into v_atual, v_embarcacao_id
    from public.gold_solicitacoes where id = p_solicitacao_id for update;
  if v_atual is null then
    raise exception 'solicitacao_nao_encontrada';
  end if;

  if p_novo_estado = 'cancelado' then
    v_pode := public.tem_papel_admin('suporte') or exists (
      select 1 from public.gold_solicitacoes s where s.id = p_solicitacao_id
        and (s.solicitante_id = auth.uid() or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id)))
    );
  elsif p_novo_estado = 'avaliacao_realizada' then
    v_pode := public.tem_papel_admin('suporte')
      or public.gold_consultor_atribuido(p_solicitacao_id)
      or public.vistoriador_ve_solicitacao(p_solicitacao_id);
  elsif p_novo_estado = 'aguardando_pagamento' then
    v_pode := public.tem_papel_admin('suporte') or (
      v_atual = 'solicitado' and exists (
        select 1 from public.gold_solicitacoes s
        where s.id = p_solicitacao_id and s.solicitante_id = auth.uid()
      )
    );
  else
    v_pode := public.tem_papel_admin('suporte');
  end if;
  if not v_pode then
    raise exception 'sem_permissao';
  end if;

  if not public.gold_transicao_valida(v_atual, p_novo_estado) then
    raise exception 'transicao_invalida_%_%', v_atual, p_novo_estado;
  end if;

  if p_novo_estado = 'aprovado' then
    select * into v_avaliacao from public.gold_avaliacoes where solicitacao_id = p_solicitacao_id;
    if v_avaliacao.id is null or v_avaliacao.data_avaliacao is null or v_avaliacao.validade_meses is null then
      raise exception 'avaliacao_incompleta';
    end if;

    if v_embarcacao_id is not null then
      v_validade_ate := (v_avaliacao.data_avaliacao + (v_avaliacao.validade_meses || ' months')::interval)::date;

      insert into public.gold_selos (
        embarcacao_id, solicitacao_id, avaliacao_id, consultor_id,
        data_avaliacao, validade_meses, validade_ate, versao_protocolo
      ) values (
        v_embarcacao_id, p_solicitacao_id, v_avaliacao.id, v_avaliacao.consultor_id,
        v_avaliacao.data_avaliacao, v_avaliacao.validade_meses, v_validade_ate, v_avaliacao.versao_protocolo
      )
      on conflict (embarcacao_id) do update set
        solicitacao_id = excluded.solicitacao_id,
        avaliacao_id = excluded.avaliacao_id,
        consultor_id = excluded.consultor_id,
        data_avaliacao = excluded.data_avaliacao,
        validade_meses = excluded.validade_meses,
        validade_ate = excluded.validade_ate,
        versao_protocolo = excluded.versao_protocolo,
        atualizado_em = now()
      returning id into v_selo_id;

      select usuario_id into v_prop_id from public.vinculos
        where embarcacao_id = v_embarcacao_id and papel = 'PROP' limit 1;
      if v_prop_id is not null then
        insert into public.premium_concessoes (usuario_id, origem, origem_id, valido_ate)
        values (v_prop_id, 'gold', p_solicitacao_id, v_validade_ate);
      end if;
    end if;
  end if;

  update public.gold_solicitacoes
    set estado = p_novo_estado, atualizado_em = now()
    where id = p_solicitacao_id
    returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.gold_definir_estado(uuid, text, text) from public, anon;
grant execute on function public.gold_definir_estado(uuid, text, text) to authenticated, service_role;


-- ############### 075_webhook_asaas_ordem_dos_eventos.sql ###############

alter table public.assinaturas
  add column if not exists ultimo_evento_em timestamptz;

comment on column public.assinaturas.ultimo_evento_em is
  'Carimbo (`dateCreated`) do evento Asaas que produziu o `status` atual. '
  'O webhook só aplica evento com carimbo >= a este — é o que impede um '
  'PAYMENT_OVERDUE reentregue de derrubar quem já regularizou (A-06). '
  '`null` = sem carimbo conhecido; nesse caso o evento passa (na dúvida, a '
  'favor de quem paga).';


-- ############### 076_webhook_asaas_registro_de_eventos.sql ###############

create table if not exists public.asaas_eventos (
  id uuid primary key default gen_random_uuid(),

  evento_id text,

  tipo text not null,

  ocorrido_em timestamptz,

  asaas_payment_id text,
  asaas_subscription_id text,

  resultado text not null check (resultado in (
    'aplicado',                 -- mudou linha no Commander
    'sem_efeito',               -- reconhecido, mas nada a mudar (ex.: já estava assim)
    'sem_correspondencia',      -- assinatura/cobrança que o Commander não conhece  ← A-07
    'fora_de_ordem',            -- carimbo mais velho que o já aplicado             ← A-06
    'evento_ignorado',          -- tipo que o Commander não trata
    'erro'                      -- falha ao gravar
  )),

  detalhe text,

  linhas_afetadas int,

  corpo jsonb not null,

  recebido_em timestamptz not null default now()
);

create index if not exists asaas_eventos_recebido_idx
  on public.asaas_eventos (recebido_em desc);

create index if not exists asaas_eventos_subscription_idx
  on public.asaas_eventos (asaas_subscription_id, recebido_em desc)
  where asaas_subscription_id is not null;

create index if not exists asaas_eventos_payment_idx
  on public.asaas_eventos (asaas_payment_id, recebido_em desc)
  where asaas_payment_id is not null;

create index if not exists asaas_eventos_nao_aplicado_idx
  on public.asaas_eventos (recebido_em desc)
  where resultado <> 'aplicado';

create index if not exists asaas_eventos_evento_id_idx
  on public.asaas_eventos (evento_id)
  where evento_id is not null;

alter table public.asaas_eventos enable row level security;

drop policy if exists "asaas_eventos: so o suporte le" on public.asaas_eventos;
create policy "asaas_eventos: so o suporte le" on public.asaas_eventos
  for select to authenticated
  using (public.tem_papel_admin('suporte'));


revoke all on table public.asaas_eventos from anon;
revoke insert, update, delete, truncate on table public.asaas_eventos from authenticated;
grant select on table public.asaas_eventos to authenticated;
grant all on table public.asaas_eventos to service_role;

comment on table public.asaas_eventos is
  'Trilha de entregas do webhook do Asaas (A-07). Uma linha por ENTREGA, '
  'inclusive reentrega. Append-only: não há policy de update nem de delete. '
  'Leitura só para Suporte/CEO. Escrita só pelo webhook (service role).';


-- ############### 077_convite_cotista_resgate.sql ###############

create or replace function public.info_convite_cotista(p_codigo text)
returns table(
  nome_embarcacao text,
  valido boolean,
  vagas_total int,
  vagas_ocupadas int,
  ja_faz_parte boolean,
  suspenso boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    e.nome,
    c.ativo,
    greatest(coalesce(e.cotas_total, 0), 0),
    (select count(*)::int from public.vinculos v
      where v.embarcacao_id = c.embarcacao_id and v.papel = 'COTISTA'),
    exists (select 1 from public.vinculos v
             where v.embarcacao_id = c.embarcacao_id and v.usuario_id = auth.uid()),
    exists (select 1 from public.vinculos v
             where v.embarcacao_id = c.embarcacao_id and v.usuario_id = auth.uid()
               and v.suspenso_em is not null)
  from public.convites_cotista c
  join public.embarcacoes e on e.id = c.embarcacao_id
  where c.codigo = p_codigo;
$function$;


revoke all on function public.info_convite_cotista(text) from public;
grant execute on function public.info_convite_cotista(text) to anon, authenticated, service_role;

create or replace function public.aceitar_convite_cotista(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  v_total int;
  v_ocupadas int;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  select * into c from public.convites_cotista
    where codigo = p_codigo and ativo
    for update;
  if not found then
    raise exception 'convite_invalido';
  end if;

  if exists (
    select 1 from public.vinculos
    where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()
  ) then
    raise exception 'ja_faz_parte';
  end if;

  select greatest(coalesce(cotas_total, 0), 0) into v_total
    from public.embarcacoes where id = c.embarcacao_id;

  select count(*) into v_ocupadas from public.vinculos
    where embarcacao_id = c.embarcacao_id and papel = 'COTISTA';

  if v_ocupadas >= v_total then
    raise exception 'sem_vaga_de_cota';
  end if;

  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel, permissoes)
  values (
    auth.uid(), c.embarcacao_id, 'COTISTA', 'operacional',
    jsonb_build_object(
      'embarcacao',  jsonb_build_object('ver', true,  'editar', false),
      'motores',     jsonb_build_object('ver', true,  'editar', false),
      'eletrica',    jsonb_build_object('ver', false, 'editar', false),
      'casco',       jsonb_build_object('ver', false, 'editar', false),
      'hidraulica',  jsonb_build_object('ver', false, 'editar', false),
      'seguranca',   jsonb_build_object('ver', false, 'editar', false),
      'equipamentos',jsonb_build_object('ver', false, 'editar', false),
      'documentos',  jsonb_build_object('ver', true,  'editar', false),
      'fotos',       jsonb_build_object('ver', true,  'editar', false),
      'contatos',    jsonb_build_object('ver', false, 'editar', false),
      'gastos',      jsonb_build_object('ver', false, 'editar', false),
      'diario',      jsonb_build_object('ver', false, 'editar', false),
      'historico',   jsonb_build_object('ver', true,  'editar', false),
      'carteira',    jsonb_build_object('ver', false, 'editar', false),
      'agenda',      jsonb_build_object('ver', false, 'editar', false)
    )
  );

  return c.embarcacao_id;
end;
$function$;

revoke all on function public.aceitar_convite_cotista(text) from public, anon;
grant execute on function public.aceitar_convite_cotista(text) to authenticated, service_role;

commit;

-- ===========================================================================
-- CONFERENCIA — o esperado esta em cada linha.
-- ===========================================================================
select 'coluna de ordem do webhook (esperado 1)' as conferencia, count(*)::text as resultado
  from information_schema.columns
 where table_schema='public' and table_name='assinaturas' and column_name='ultimo_evento_em'
union all
select 'tabela de eventos do Asaas (esperado 1)', count(*)::text
  from information_schema.tables where table_schema='public' and table_name='asaas_eventos'
union all
select 'eventos: policies de update/delete (esperado 0)', count(*)::text
  from pg_policies where schemaname='public' and tablename='asaas_eventos' and cmd in ('UPDATE','DELETE')
union all
select 'funcoes do convite de cotista (esperado 2)', count(*)::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('info_convite_cotista','aceitar_convite_cotista')
union all
select 'gold_definir_estado deixa o solicitante avancar (esperado true)',
       (pg_get_functiondef(p.oid) ilike '%aguardando_pagamento%' and pg_get_functiondef(p.oid) ilike '%solicitado%')::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='gold_definir_estado'
union all
select 'funcoes novas sem search_path fixado (esperado 0)', count(*)::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('info_convite_cotista','aceitar_convite_cotista')
   and (p.proconfig is null or not (p.proconfig::text ilike '%search_path%'));
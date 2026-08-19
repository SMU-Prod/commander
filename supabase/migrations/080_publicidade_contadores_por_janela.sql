-- ============================================================================
-- 080 — Impressão e clique de publicidade param de ser infláveis em laço
-- ============================================================================
-- FECHA: a terceira ressalva do P2-1 de docs/auditoria/2026-08-19-banco-e-rls.md
--        ("registrar_visualizacao e publicidade_registrar_clique/_impressao são
--         chamáveis por qualquer logado e incrementam contador sem idempotência
--         [...] Se esses números virarem base de cobrança, viram fraude de
--         faturamento") — parte da publicidade.
--
-- O PROBLEMA
-- ----------
-- As duas RPC vivas (lidas com `pg_get_functiondef` em 19/08/2026) são um
-- `insert ... on conflict do update set impressoes = impressoes + 1` sem
-- nenhuma noção de QUEM pediu o incremento:
--
--   begin
--     if not public.publicidade_vigente(p_campanha_id) then return; end if;
--     insert into public.publicidade_metricas (campanha_id, dia, impressoes, cliques)
--     values (p_campanha_id, public.hoje_sp(), 1, 0)
--     on conflict (campanha_id, dia)
--     do update set impressoes = public.publicidade_metricas.impressoes + 1;
--   end
--
-- Qualquer usuário logado chama a RPC em laço e leva a campanha de um parceiro
-- a qualquer número que quiser. O contrário também: o próprio parceiro infla a
-- própria campanha antes de renovar o contrato. Não vaza dado de ninguém — é
-- o NÚMERO que deixa de significar alguma coisa, e é sobre esse número que a
-- conversa comercial acontece.
--
-- A DEFESA ESCOLHIDA, E POR QUE ESTA
-- ----------------------------------
-- Uma janela por usuário + campanha + tipo. Cada pessoa logada só consegue
-- somar UMA vez por janela; a segunda chamada dentro da mesma janela cai num
-- `on conflict do nothing` e não chega a tocar em `publicidade_metricas`.
--
-- Duas janelas diferentes, e a diferença é de produto, não de implementação:
--
--   · IMPRESSÃO — 1 hora. Ver o anúncio de novo ao navegar entre telas é
--     impressão de verdade, e zerar isso mediria "pessoas alcançadas", não
--     "vezes exibido". Uma hora mantém a repetição legítima e derruba o teto
--     de infinito para 24 por pessoa/campanha/dia.
--   · CLIQUE — 1 dia (dia de São Paulo, o mesmo `hoje_sp()` da tabela de
--     métricas). Clique é intenção, e a segunda intenção da mesma pessoa no
--     mesmo dia não é uma segunda intenção. Teto: 1 por pessoa/campanha/dia.
--
-- Descartado: guardar cada evento e deduplicar na leitura (a tabela cresceria
-- com o lixo que se quer justamente não contar) e limitador por IP (o servidor
-- Next é quem chama a RPC — o banco vê um IP só, o da Vercel).
--
-- O QUE ESTA MIGRATION **NÃO** RESOLVE
-- ------------------------------------
--   · Conta descartável: quem criar 50 contas soma 50 impressões por hora. O
--     freio disso é o cadastro (o "Confirm email" do Supabase, pendência já
--     registrada em docs/OPERACAO.md), não o contador.
--   · `registrar_visualizacao()` (`parceiros.visualizacoes`) tem exatamente o
--     mesmo defeito e NÃO foi tocada aqui: é outra tabela, outro número e
--     outra decisão de produto (visualização de perfil de parceiro não é
--     inventário vendido). Fica registrado como pendência, não como esquecimento.
--   · O parceiro dono da campanha continua contando como qualquer visitante.
--     Excluir o próprio anunciante exigiria decidir se ele deixa de ser
--     "alcance" — decisão comercial, não técnica.
--
-- MUDANÇA DE SIGNIFICADO — leia antes de aplicar
-- ----------------------------------------------
-- `publicidade_metricas.impressoes` deixa de ser "quantas vezes o anúncio foi
-- pintado" e passa a ser "quantas pessoas-hora distintas o viram". `cliques`
-- passa a ser "pessoas distintas que clicaram no dia". São números MENORES e
-- mais honestos. Hoje as duas colunas somam 0 em todas as campanhas
-- (`publicidade_metricas` está vazia), então a redefinição não quebra série
-- histórica nenhuma — é de graça agora e cara depois.
--
-- Idempotente: `create table if not exists` + `create or replace function`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A tabela de janelas
-- ---------------------------------------------------------------------------
-- A chave primária É a trava: quem já apareceu nesta janela não entra de novo.
-- Não há coluna de contagem aqui de propósito — esta tabela não mede nada,
-- ela só lembra quem já foi medido. O número continua morando em
-- `publicidade_metricas`, que é onde o Comercial já olha.
create table if not exists public.publicidade_vistas (
  campanha_id uuid        not null references public.publicidade_campanhas(id) on delete cascade,
  usuario_id  uuid        not null references auth.users(id) on delete cascade,
  tipo        text        not null check (tipo in ('impressao', 'clique')),
  janela      timestamptz not null,
  primary key (campanha_id, usuario_id, tipo, janela)
);

-- Índice da faxina (o `delete` no fim de cada RPC). Sem ele a limpeza viraria
-- varredura da tabela inteira a cada janela nova.
create index if not exists publicidade_vistas_janela_idx
  on public.publicidade_vistas (janela);

alter table public.publicidade_vistas enable row level security;

-- Uma policy só, de leitura, e para quem já lê as métricas — a regra da casa é
-- que nenhuma tabela fique sem policy (conferência final do primeiro lote).
-- Escrita não tem policy nenhuma: quem escreve são as duas RPC `security
-- definer` abaixo, e o `revoke` seguinte fecha a porta do PostgREST.
drop policy if exists "publicidade_vistas: comercial le" on public.publicidade_vistas;
create policy "publicidade_vistas: comercial le" on public.publicidade_vistas
  for select to authenticated
  using (public.eh_ceo() or public.tem_papel_admin('comercial'));

revoke all on table public.publicidade_vistas from public, anon, authenticated;
grant select on table public.publicidade_vistas to authenticated;
grant all on table public.publicidade_vistas to service_role;

-- ---------------------------------------------------------------------------
-- As duas RPC
-- ---------------------------------------------------------------------------
-- O corpo abaixo é a definição VIVA (o `publicidade_vigente` + o `on conflict`
-- em `publicidade_metricas`, intactos), com a janela na frente. A assinatura
-- não muda: `lib/acoes/publicidade-medicao.ts` continua chamando igual, e o
-- `grant` continua o mesmo (`authenticated`, `service_role`; nunca `anon`).
--
-- `auth.uid() is null` sai calado, como já saía quando a campanha não estava
-- vigente. Medição nunca quebra tela — é a escolha declarada no topo de
-- `lib/acoes/publicidade-medicao.ts`, e vale igual aqui dentro.

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

  -- Janela de 1 hora. `date_trunc` sobre `now()` (UTC) — o bucket só precisa
  -- ser estável e do mesmo tamanho, não bater com o calendário de ninguém.
  v_janela := date_trunc('hour', now());

  insert into public.publicidade_vistas (campanha_id, usuario_id, tipo, janela)
  values (p_campanha_id, v_usuario, 'impressao', v_janela)
  on conflict do nothing;
  get diagnostics v_linhas = row_count;
  -- Já contou esta pessoa nesta hora. Sai sem tocar no contador — é ISTO que
  -- torna o laço inútil.
  if v_linhas = 0 then return; end if;

  insert into public.publicidade_metricas (campanha_id, dia, impressoes, cliques)
  values (p_campanha_id, public.hoje_sp(), 1, 0)
  on conflict (campanha_id, dia)
  do update set impressoes = public.publicidade_metricas.impressoes + 1;

  -- Faxina barata e sem job: só roda quando de fato abriu janela nova (no
  -- máximo 1×/hora por pessoa e campanha) e só nas linhas dessa mesma pessoa
  -- nessa mesma campanha. A tabela não precisa de retenção longa — passada a
  -- janela, a linha não decide mais nada.
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

  -- Janela de 1 dia, no fuso de São Paulo — o MESMO dia que
  -- `publicidade_metricas.dia` usa (`hoje_sp()`), pra "1 clique por dia" não
  -- significar uma coisa na trava e outra no relatório.
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

-- Reafirma o ACL que a função já tinha. `create or replace` preserva, mas
-- escrever aqui evita que uma reaplicação num banco novo nasça com EXECUTE
-- para PUBLIC/anon — mesmo cuidado da 074.
revoke all on function public.publicidade_registrar_impressao(uuid) from public, anon;
revoke all on function public.publicidade_registrar_clique(uuid) from public, anon;
grant execute on function public.publicidade_registrar_impressao(uuid) to authenticated, service_role;
grant execute on function public.publicidade_registrar_clique(uuid) to authenticated, service_role;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) As duas RPC conhecem a janela — tem de voltar 2:
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('publicidade_registrar_impressao','publicidade_registrar_clique')
--    and pg_get_functiondef(p.oid) like '%publicidade_vistas%';
--
-- 2) Continuam DEFINER com search_path fixo — tem de voltar 2:
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('publicidade_registrar_impressao','publicidade_registrar_clique')
--    and p.prosecdef and array_to_string(p.proconfig, ',') like '%search_path%';
--
-- 3) `anon` não executa nenhuma das duas — tem de voltar 0:
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('publicidade_registrar_impressao','publicidade_registrar_clique')
--    and array_to_string(p.proacl, ' ') like '%anon=X%';
--
-- 4) A tabela nova tem RLS ligada e exatamente 1 policy, de SELECT:
-- select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public' and c.relname='publicidade_vistas';           -- true
-- select policyname, cmd, roles::text from pg_policies
--  where schemaname='public' and tablename='publicidade_vistas';          -- 1 linha, SELECT
--
-- 5) `authenticated` só tem SELECT nela, e `anon` não tem nada (1 linha e 0):
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='publicidade_vistas' and grantee='authenticated';
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='publicidade_vistas' and grantee='anon';
--
-- 6) Nenhuma tabela sem policy — a regra da casa continua verde: 0
-- select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public' and c.relkind='r'
--    and not exists (select 1 from pg_policies p
--                    where p.schemaname='public' and p.tablename=c.relname);
--
-- 7) Nenhuma métrica existente foi tocada (as duas somas têm de continuar
--    iguais ao que eram antes — hoje 0 e 0):
-- select coalesce(sum(impressoes),0) as impressoes, coalesce(sum(cliques),0) as cliques
--   from public.publicidade_metricas;
--
-- 8) O teste que prova a trava (rodar como um usuário logado, não como
--    service_role — o `postgres` do editor SQL não tem `auth.uid()`):
--    chamar `publicidade_registrar_impressao` 10× seguidas na mesma campanha
--    e conferir que `impressoes` subiu exatamente 1.

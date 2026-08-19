-- ============================================================================
-- 079 — `assinaturas` deixa de aceitar o id de assinatura de outra pessoa
-- ============================================================================
-- FECHA: A-10 de docs/auditoria/2026-08-19-asaas-cobranca.md (P1)
-- DEPENDE DE: 078 (cria `public.asaas_id_visto_pelo_gateway`). Rodar 078 antes.
--
-- O PROBLEMA
-- ----------
-- A policy viva (`assinatura: criar a propria pendente`, lida com `pg_policies`
-- em 19/08/2026) exige duas coisas e só duas:
--
--   with check (usuario_id = (select auth.uid()) and status = 'pendente')
--
-- `asaas_subscription_id` é campo livre. A pessoa grava, via PostgREST, uma
-- linha sua apontando para a assinatura de OUTRO cliente do Asaas. A partir
-- daí `/menu/assinatura` (app/(app)/menu/assinatura/page.tsx:186-189) repassa
-- esse id para `listarCobrancas` / `proximaCobrancaAsaas` **com a chave da
-- conta** e exibe valor, datas e `invoiceUrl` da assinatura alheia. Não é
-- escrita no dado do outro — é leitura do dado do outro pela nossa própria
-- chave, que é pior de explicar.
--
-- Hoje isso não vale nada porque não há chave do Asaas configurada e a tabela
-- tem 0 linhas. Passa a valer no minuto em que a chave for ligada. É agora que
-- se fecha, não depois.
--
-- O QUE ESTA MIGRATION FECHA — e o que NÃO fecha
-- ----------------------------------------------
-- SQL não conversa com o Asaas: não existe, dentro do Postgres, como provar
-- que `sub_000123` foi criada por esta sessão. O que dá pra provar é o
-- CONTRÁRIO — que o id já é de alguém. Três travas, todas verificáveis aqui:
--
--   1. `asaas_subscription_id` não pode ser um id que o gateway JÁ mencionou
--      pra gente (`asaas_eventos`, migration 076 — ver o cabeçalho do helper
--      em 078). Toda assinatura real gera evento; então todo assinante real
--      fica protegido automaticamente, inclusive aquele cuja linha nunca
--      chegou às nossas tabelas — que é exatamente a janela que o índice
--      único `assinaturas_asaas_subscription_id_key` NÃO cobria e que a
--      auditoria apontou como o resto do A-10.
--   2. `asaas_customer_id` não pode ser o cliente Asaas de OUTRO usuário do
--      Commander. Sem isso, a pessoa se penduraria no cadastro de pagamento
--      alheio pela outra ponta.
--   3. `ultimo_evento_em` e `problema_desde` têm de nascer nulos. A coluna
--      `ultimo_evento_em` chegou na migration 075 (A-06) e é o filtro de ordem
--      do webhook: uma linha nascendo com carimbo no futuro faria o webhook
--      descartar TODO evento seguinte como "fora de ordem" — a própria pessoa
--      congelaria a assinatura no estado que quisesse. A 075 não podia prever
--      isto porque a policy de INSERT é desta migration; fica registrado aqui
--      que as duas se completam.
--
-- **O QUE CONTINUA ABERTO, e é preciso dizer:** a janela entre criar a
-- assinatura no Asaas e o primeiro webhook chegar. Nela, quem souber o id
-- ainda consegue reivindicá-lo. Fechar isso de vez exige UMA linha fora deste
-- diretório: `lib/acoes/assinatura.ts:115` gravar com a chave de serviço
-- (`lib/supabase/servico.ts`), como `trocarPlano` já faz no UPDATE da mesma
-- tabela e pelo mesmo motivo ("quem autoriza é o gateway ter aceitado — fato
-- que só o servidor conhece"). Com a escrita no servidor, o id nunca sai da
-- mão de quem o criou e a policy de INSERT do cliente pode simplesmente
-- deixar de existir. Enquanto essa troca não acontece, esta migration reduz a
-- janela de "qualquer assinatura do Asaas" para "assinatura recém-criada e
-- ainda sem nenhum evento entregue".
--
-- QUEM GANHA / QUEM PERDE — conferido no banco em 19/08/2026
-- ----------------------------------------------------------
--   assinaturas = 0 linhas. asaas_eventos = 0 linhas.
-- ZERO linhas existentes mudam. O caminho legítimo (`assinar`,
-- lib/acoes/assinatura.ts:115-123) grava `usuario_id`, `asaas_customer_id`,
-- `asaas_subscription_id`, `plano` e `valor_centavos` — e nada mais. Passa
-- sem alteração de código: o `status` vem do default `'pendente'`, e
-- `ultimo_evento_em`/`problema_desde` nem são mencionados.
--
-- Se um dia o INSERT começar a falhar com `new row violates row-level security
-- policy` logo depois de o Asaas aceitar a assinatura, a causa mais provável é
-- a trava 1 disparando por um webhook que chegou primeiro. O app já trata esse
-- caminho de forma correta e sem perder dinheiro: `assinatura.ts:128` cancela
-- a assinatura recém-criada no gateway antes de mostrar o erro.
--
-- Idempotente: `create or replace` + `drop policy if exists`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helper da trava 2
-- ---------------------------------------------------------------------------
-- `security definer` pelo mesmo motivo do helper da 078: a RLS de
-- `assinaturas` só deixa a pessoa enxergar a PRÓPRIA linha, então uma
-- subconsulta direta dentro da policy nunca veria a linha do outro e o
-- `not exists` seria verdade sempre — trava que parece existir e não existe.
--
-- Devolve booleano puro, nunca a linha: quem chama descobre "esse cliente é de
-- outra pessoa", jamais de quem.
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

-- Índice que o helper acabou de exigir. Aqui e não no arquivo de índices de
-- FK: `asaas_customer_id` não é chave estrangeira, é a coluna da consulta que
-- esta migration criou. Sem `concurrently` — 0 linhas, lock instantâneo, a
-- migration continua cabendo numa transação só.
create index if not exists assinaturas_asaas_customer_idx
  on public.assinaturas (asaas_customer_id);

-- ---------------------------------------------------------------------------
-- A policy
-- ---------------------------------------------------------------------------
-- Nome IDÊNTICO ao da policy viva. Policy permissiva se soma: um nome novo
-- deixaria a antiga (que não valida nada disto) em pé ao lado desta, e o
-- INSERT continuaria passando pela antiga sem que nada acusasse.
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

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) As policies de `assinaturas` continuam sendo 4, e só a de INSERT mudou
--    (1 INSERT, 2 SELECT, 1 UPDATE):
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='assinaturas' order by cmd, policyname;
--
-- 2) A de INSERT cita as quatro travas novas — tem de voltar 1:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='assinaturas' and cmd='INSERT'
--    and with_check like '%ultimo_evento_em IS NULL%'
--    and with_check like '%problema_desde IS NULL%'
--    and with_check like '%asaas_id_visto_pelo_gateway%'
--    and with_check like '%asaas_cliente_de_outra_pessoa%';
--
-- 3) O helper novo é DEFINER com search_path fixo e sem `anon` — 1 e 0:
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname='asaas_cliente_de_outra_pessoa'
--    and p.prosecdef and array_to_string(p.proconfig, ',') like '%search_path%';
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname='asaas_cliente_de_outra_pessoa'
--    and array_to_string(p.proacl, ' ') like '%anon=X%';
--
-- 4) Nenhuma assinatura existente foi tocada (0 e 0 hoje):
-- select (select count(*) from public.assinaturas)                                as assinaturas,
--        (select count(*) from public.assinaturas where ultimo_evento_em is not null) as com_carimbo;
--
-- 5) A regra da casa continua verde (nenhuma função DEFINER sem search_path): 0
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.prosecdef
--    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';

-- ============================================================================
-- 076 — Todo evento do Asaas passa a deixar rastro
-- ============================================================================
-- FECHA: A-07 e A-15 de docs/auditoria/2026-08-19-asaas-cobranca.md (P1)
--
-- O PROBLEMA
-- ----------
-- Não existe NENHUMA tabela `*asaas*` / `*webhook*` no schema `public`
-- (conferido em 19/08/2026: 0 tabelas). Hoje o webhook responde
-- `200 {atualizadas: 0}` quando o pagamento confirmado não casa com nenhuma
-- assinatura local — e esse 200 faz o Asaas considerar o evento ENTREGUE e
-- nunca mais retentar. O evento some sem deixar rastro.
--
-- O caso que isso esconde: a gravação em `assinaturas` falhou, o rollback
-- best-effort do app (`lib/acoes/assinatura.ts`, `.catch(() => {})`) não
-- conseguiu cancelar a assinatura lá fora, e o cliente está sendo cobrado
-- todo mês por um acesso que o Commander não sabe que existe. Sem registro,
-- descobrir isso significa abrir o painel do gateway e conferir na mão,
-- assinante por assinante — e só depois de alguém reclamar.
--
-- POR QUE UMA TABELA E NÃO UM `console.log`
-- -----------------------------------------
-- `console.log` numa function da Vercel tem retenção curta e não é
-- consultável por chave de negócio ("todos os eventos desta assinatura", "o
-- que aconteceu no dia 12"). Reconciliação Asaas × Commander é uma consulta,
-- não uma varredura de log. E o dono precisa conseguir responder "o dinheiro
-- entrou?" sem depender de quem escreveu o código.
--
-- DESENHO
-- -------
-- · Registra TODA entrega, inclusive reentrega do mesmo `evento_id`. Não há
--   UNIQUE em `evento_id` de propósito: duplicata não é sujeira, é o FATO que
--   se quer enxergar ("o Asaas mandou este evento três vezes"). Idempotência
--   de EFEITO é resolvida no `update` (migrations 075 e A-06); esta tabela é
--   a prova documental, e prova que apaga duplicata não prova nada.
-- · `resultado` diz o que a entrega PRODUZIU, não o que ela era. É a coluna
--   que transforma a tabela em ferramenta: `where resultado <> 'aplicado'` é
--   a lista de tudo que o Commander recebeu e não conseguiu honrar.
-- · `corpo` guarda o JSON cru. Quando a interpretação estiver errada, é o
--   único jeito de reconstruir o que o gateway realmente disse.
-- · Append-only por construção: NÃO se cria policy de UPDATE nem de DELETE —
--   a ausência delas é a garantia, do mesmo jeito que em `auditoria`
--   (migration 071). Trilha que pode ser editada não é trilha.
--
-- O QUE **NÃO** VAI NA TABELA
-- ---------------------------
-- Nenhum dado de cartão: o app nunca vê cartão (o checkout é sempre a
-- `invoiceUrl` hospedada do Asaas), e o corpo do webhook do Asaas não traz
-- PAN nem CVV. O que pode vir no `corpo` é nome/CPF/e-mail do pagador — por
-- isso a leitura é restrita ao Suporte/CEO, e não a "qualquer autenticado".
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
-- A tabela NÃO EXISTIA. Logo ninguém perde nada: não há leitura a tirar de
-- ninguém, não há linha a esconder. Quem GANHA leitura são os papéis de
-- admin: `admin_papeis` tem 1 linha ativa, e `tem_papel_admin('suporte')`
-- devolve true para 1 pessoa hoje (o `ceo` casa com qualquer papel pedido —
-- ver a definição viva de `tem_papel_admin`).
--
-- Quem ESCREVE é só o webhook, com `SUPABASE_SERVICE_ROLE_KEY`, que passa por
-- cima da RLS por desenho — o mesmo caminho que já grava `assinaturas`. Por
-- isso NÃO existe policy de INSERT: nenhum usuário logado precisa escrever
-- aqui, e não ter a policy é o que garante que nenhum consiga.
--
-- Idempotente: `create table if not exists`, `drop policy if exists`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

create table if not exists public.asaas_eventos (
  id uuid primary key default gen_random_uuid(),

  -- `id` do corpo do Asaas (ex.: `evt_05b708f9…`). Anulável porque entrega
  -- antiga do gateway pode não trazer — e um evento sem id ainda é um evento
  -- que precisa ficar registrado.
  evento_id text,

  -- `event` do corpo: PAYMENT_CONFIRMED, PAYMENT_OVERDUE, SUBSCRIPTION_DELETED…
  tipo text not null,

  -- `dateCreated` do corpo (quando o EVENTO nasceu no Asaas, precisão de
  -- segundo). É o carimbo que ordena — ver migration 075. `null` = o gateway
  -- não mandou, e nesse caso o evento é aplicado mesmo assim.
  ocorrido_em timestamptz,

  -- Chaves de negócio extraídas do corpo, para a consulta de reconciliação
  -- não precisar cavar o JSON.
  asaas_payment_id text,
  asaas_subscription_id text,

  -- O que ESTA entrega produziu. Lista fechada para a consulta ser confiável;
  -- acrescentar valor aqui exige mexer nesta constraint de propósito.
  resultado text not null check (resultado in (
    'aplicado',                 -- mudou linha no Commander
    'sem_efeito',               -- reconhecido, mas nada a mudar (ex.: já estava assim)
    'sem_correspondencia',      -- assinatura/cobrança que o Commander não conhece  ← A-07
    'fora_de_ordem',            -- carimbo mais velho que o já aplicado             ← A-06
    'evento_ignorado',          -- tipo que o Commander não trata
    'erro'                      -- falha ao gravar
  )),

  -- Frase curta de diagnóstico. Nunca substitui `resultado`: é a explicação,
  -- não o estado.
  detalhe text,

  -- Quantas linhas o evento realmente mudou. `null` = não chegou a tentar
  -- escrever — e `null` aqui NUNCA deve ser desenhado como 0: "não tentou" e
  -- "tentou e não mudou nada" são diagnósticos opostos.
  linhas_afetadas int,

  -- O JSON cru, exatamente como chegou.
  corpo jsonb not null,

  recebido_em timestamptz not null default now()
);

-- A consulta do dia a dia é "o que chegou, mais recente primeiro".
create index if not exists asaas_eventos_recebido_idx
  on public.asaas_eventos (recebido_em desc);

-- A consulta de investigação é "tudo desta assinatura / desta cobrança".
-- Índices parciais: a maioria das linhas tem só um dos dois preenchido.
create index if not exists asaas_eventos_subscription_idx
  on public.asaas_eventos (asaas_subscription_id, recebido_em desc)
  where asaas_subscription_id is not null;

create index if not exists asaas_eventos_payment_idx
  on public.asaas_eventos (asaas_payment_id, recebido_em desc)
  where asaas_payment_id is not null;

-- A consulta que justifica a tabela: "o que o Commander recebeu e não honrou".
create index if not exists asaas_eventos_nao_aplicado_idx
  on public.asaas_eventos (recebido_em desc)
  where resultado <> 'aplicado';

-- Reentrega do mesmo evento é fato a enxergar, não erro a barrar — por isso
-- este índice NÃO é unique.
create index if not exists asaas_eventos_evento_id_idx
  on public.asaas_eventos (evento_id)
  where evento_id is not null;

alter table public.asaas_eventos enable row level security;

-- Só quem administra a plataforma lê. `tem_papel_admin('suporte')` já
-- devolve true para o papel `ceo` também (definição viva) — não é preciso
-- listar os dois.
drop policy if exists "asaas_eventos: so o suporte le" on public.asaas_eventos;
create policy "asaas_eventos: so o suporte le" on public.asaas_eventos
  for select to authenticated
  using (public.tem_papel_admin('suporte'));

-- Sem policy de INSERT/UPDATE/DELETE: escreve só o webhook (service role, que
-- passa por cima da RLS), e a trilha é append-only.

-- O Supabase concede DML às roles de API por default privilege ao criar
-- tabela. `anon` não tem o que fazer aqui, e `authenticated` só lê — a RLS já
-- barraria, mas privilégio e policy são duas travas independentes e as duas
-- devem dizer a mesma coisa.
revoke all on table public.asaas_eventos from anon;
revoke insert, update, delete, truncate on table public.asaas_eventos from authenticated;
grant select on table public.asaas_eventos to authenticated;
grant all on table public.asaas_eventos to service_role;

comment on table public.asaas_eventos is
  'Trilha de entregas do webhook do Asaas (A-07). Uma linha por ENTREGA, '
  'inclusive reentrega. Append-only: não há policy de update nem de delete. '
  'Leitura só para Suporte/CEO. Escrita só pelo webhook (service role).';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) RLS ligada — tem de voltar true:
-- select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
--  where n.nspname='public' and c.relname='asaas_eventos';
--
-- 2) Exatamente 1 policy, e ela é de SELECT — tem de voltar 1 linha, cmd=SELECT:
-- select policyname, cmd, roles::text, qual from pg_policies
--  where schemaname='public' and tablename='asaas_eventos';
--
-- 3) Quem passa a ler — tem de bater com o número de admins ativos (1 hoje):
-- select count(*) from public.admin_papeis where ativo and papel in ('suporte','ceo');
--
-- 4) `anon` não tem privilégio nenhum — tem de voltar 0 linhas:
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='asaas_eventos' and grantee='anon';
--
-- 5) `authenticated` só tem SELECT — tem de voltar exatamente 1 linha (SELECT):
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema='public' and table_name='asaas_eventos' and grantee='authenticated';
--
-- 6) A checagem global do lote continua verde — nenhuma tabela sem policy: 0
-- select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname='public' and c.relkind='r'
--    and not exists (select 1 from pg_policies p
--                    where p.schemaname='public' and p.tablename=c.relname);

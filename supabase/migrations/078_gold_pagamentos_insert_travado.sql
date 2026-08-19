-- ============================================================================
-- 078 — O INSERT de `gold_pagamentos` para de aceitar pagamento inventado
-- ============================================================================
-- FECHA: A-09 de docs/auditoria/2026-08-19-asaas-cobranca.md (P1)
--
-- O PROBLEMA
-- ----------
-- A policy viva (`gold_pagamentos: criar`, lida com `pg_policies` em
-- 19/08/2026) só pergunta QUEM está escrevendo:
--
--   with check (
--     tem_papel_admin('suporte') or exists (
--       select 1 from gold_solicitacoes s
--        where s.id = gold_pagamentos.solicitacao_id
--          and (s.solicitante_id = (select auth.uid())
--               or (s.embarcacao_id is not null and eh_prop(s.embarcacao_id)))))
--
-- Não pergunta O QUE está sendo escrito. O próprio solicitante consegue
-- gravar, via PostgREST, uma linha de pagamento sua com `status = 'pago'`,
-- `pago_em = now()` e `valor_centavos = 1`.
--
-- Isso NÃO libera acesso: o avanço de estado da solicitação passa pela RPC
-- `gold_definir_estado`, e `gold_solicitacoes` não tem policy de UPDATE
-- (conferido). Mas polui o financeiro e a tela de `/admin/gold` com pagamento
-- que nunca existiu — e "o admin abre a fila e vê pagamentos falsos" é um
-- estrago de confiança que não precisa de escalada de privilégio pra doer.
--
-- `assinaturas` já faz o certo desde a migration 018: o INSERT é travado em
-- `status = 'pendente'`. Esta migration leva a MESMA regra pro Gold.
--
-- O QUE PASSA A SER EXIGIDO (para quem não é Suporte)
-- ---------------------------------------------------
--   1. `status = 'pendente'` e `pago_em is null` — quem carimba "pago" é o
--      webhook, com a chave de serviço, atrás do token do Asaas. Sempre foi
--      assim de fato; agora está escrito.
--   2. `valor_centavos` = o preço vigente da faixa de porte da solicitação,
--      lido de `gold_precos` (a tabela que `/admin/gold/precos` edita, PRD
--      §39). O valor deixa de ser campo livre — é o mesmo princípio de
--      `lib/acoes/assinatura.ts` ("o preço NUNCA é lido de formulário").
--   3. `quem_paga` = o `quem_paga` da própria solicitação. Sem isto, o
--      registro do pagamento podia contar uma história diferente da do pedido
--      que ele paga (Correção 08: EU × INTERESSADO).
--   4. `asaas_payment_id`, quando informado, não pode ser uma cobrança que o
--      gateway JÁ mencionou pra gente (ver o helper abaixo). Fecha a variante
--      do A-10 no lado do Gold: reivindicar a cobrança paga de outra pessoa
--      faria o webhook marcar `pago` e avançar a solicitação DO ATACANTE.
--
-- A condição 4 é o único ponto que exige explicação, e ela está no cabeçalho
-- do helper. Continua valendo, e é a trava principal:
-- `idx_gold_pagamentos_asaas_id` (UNIQUE parcial, já no banco) garante que uma
-- cobrança do Asaas só possa ser reivindicada por UMA linha.
--
-- Suporte continua podendo tudo — é quem concilia à mão quando o gateway e o
-- Commander divergem, e tirar isso dele transformaria um acerto de 30 segundos
-- num pedido de migration.
--
-- QUEM GANHA / QUEM PERDE — conferido no banco em 19/08/2026
-- ----------------------------------------------------------
--   gold_pagamentos = 0 linhas. gold_solicitacoes = 0 linhas.
-- ZERO linhas existentes mudam de comportamento. O caminho legítimo do app
-- (`iniciarPagamentoGold`, web/lib/acoes/gold.ts:226 e :263) já grava
-- exatamente `status: "pendente"`, `quem_paga: solicitacao.quem_paga` e
-- `valor_centavos` vindo de `gold_precos` — os três ramos passam sem alteração
-- de código.
--
-- Idempotente: `drop policy if exists` + `create policy`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helper: "o gateway já falou desse id conosco?"
-- ---------------------------------------------------------------------------
-- `asaas_eventos` (migration 076) registra UMA linha por entrega de webhook,
-- com o `asaas_payment_id` e o `asaas_subscription_id` que vieram no corpo.
-- Toda cobrança e toda assinatura REAL do Asaas gera evento — é literalmente
-- pra isso que o gateway existe. Então "esse id já apareceu em
-- `asaas_eventos`" é uma prova barata e que se atualiza sozinha de que o id
-- pertence a alguém, mesmo quando a linha correspondente nunca chegou às
-- nossas tabelas (o caso `sem_correspondencia` do A-07).
--
-- POR QUE PRECISA SER `security definer`: `asaas_eventos` só é legível por
-- Suporte/CEO. Uma subconsulta direta dentro da policy roda com a RLS de quem
-- escreve — devolveria zero linhas SEMPRE, e o `not exists` seria verdade
-- sempre. A trava viraria decoração silenciosa. Este é o mesmo padrão de
-- `permissao()` e `plano_do_usuario()`.
--
-- O QUE ISTO EXPÕE: um usuário logado consegue perguntar "esse id existe?".
-- Ids do Asaas são opacos e não enumeráveis pelo app, então o oráculo não
-- entrega nada que já não fosse preciso saber de antemão — e quem sabe o id
-- de antemão é exatamente contra quem esta trava foi escrita.
--
-- LIMITE HONESTO: não fecha a janela de uma cobrança criada no Asaas e ainda
-- sem NENHUM evento entregue. Essa janela dura o intervalo entre o `create` no
-- gateway e o primeiro webhook — e o app grava a linha milissegundos depois de
-- criar a cobrança, antes de o cliente sequer ver a fatura.
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

-- Os dois índices que o helper precisa. Ficam AQUI, e não no arquivo de
-- índices de chave estrangeira, porque não são índice de FK: são a consulta
-- que esta migration acabou de criar. Sem `concurrently` de propósito — a
-- tabela tem 0 linhas hoje, o lock é instantâneo, e assim a migration continua
-- cabendo numa transação só.
create index if not exists asaas_eventos_payment_idx
  on public.asaas_eventos (asaas_payment_id) where asaas_payment_id is not null;
create index if not exists asaas_eventos_subscription_idx
  on public.asaas_eventos (asaas_subscription_id) where asaas_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- A policy
-- ---------------------------------------------------------------------------
-- O nome é EXATAMENTE o da policy viva (`gold_pagamentos: criar`). Policy de
-- RLS se SOMA: nome diferente deixaria a antiga em pé ao lado da nova, e a
-- permissiva antiga anularia esta correção em silêncio.
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

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) Continua existindo UMA policy de INSERT, e ela cita as três travas —
--    tem de voltar 1:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='gold_pagamentos' and cmd='INSERT'
--    and with_check like '%pendente%'
--    and with_check like '%gold_precos%'
--    and with_check like '%asaas_id_visto_pelo_gateway%';
--
-- 2) Nenhuma policy sobrando (tem de voltar 2: 1 INSERT + 1 SELECT):
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='gold_pagamentos' order by cmd;
--
-- 3) O helper é DEFINER com search_path fixo — tem de voltar 1:
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname='asaas_id_visto_pelo_gateway'
--    and p.prosecdef and array_to_string(p.proconfig, ',') like '%search_path%';
--
-- 4) `anon` não executa o helper — tem de voltar 0:
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname='asaas_id_visto_pelo_gateway'
--    and array_to_string(p.proacl, ' ') like '%anon=X%';
--
-- 5) Nenhum pagamento existente ficou fora da regra nova — tem de voltar 0
--    (hoje a tabela está vazia; este SELECT é o que se roda de novo depois de
--    o Gold começar a vender, pra achar linha divergente):
-- select count(*) from public.gold_pagamentos gp
--   join public.gold_solicitacoes s on s.id = gp.solicitacao_id
--   join public.gold_precos p on p.faixa = s.faixa_porte
--  where gp.status = 'pendente'
--    and (gp.valor_centavos <> p.valor_centavos or gp.quem_paga <> s.quem_paga);

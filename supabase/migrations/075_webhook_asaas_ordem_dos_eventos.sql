-- ============================================================================
-- 075 — O webhook do Asaas passa a ter memória de ORDEM
-- ============================================================================
-- FECHA: A-06 de docs/auditoria/2026-08-19-asaas-cobranca.md (P1)
--
-- O PROBLEMA
-- ----------
-- O Asaas REENTREGA eventos (é o desenho dele: sem 2xx, retenta; e retenta
-- também depois de instabilidade de rede, quando a primeira entrega já tinha
-- chegado). O webhook aplicava sempre o ÚLTIMO que chegasse, sem olhar quando
-- o evento foi criado.
--
-- O caso concreto que isso produz: um `PAYMENT_OVERDUE` de terça é reentregue
-- na quinta, DEPOIS de um `PAYMENT_CONFIRMED` de quarta. A assinatura de quem
-- está em dia cai para `problema_pagamento` e a tela passa a gritar *"Houve um
-- problema com o pagamento"* na cara do cliente certo. Não bloqueia na hora
-- (a tolerância do §23 segura), mas é o estado local divergindo do gateway na
-- frente de quem pagou — e o cliente não tem como saber que o errado é o app.
--
-- A COLUNA, E POR QUE ELA E NÃO OUTRA COISA
-- -----------------------------------------
-- `ultimo_evento_em` guarda o carimbo do evento que produziu o `status` atual.
-- O webhook passa a escrever com o filtro
--     ultimo_evento_em is null or ultimo_evento_em <= <carimbo do evento>
-- no MESMO `update` que muda o status. Uma instrução só: duas entregas
-- concorrentes não conseguem se atropelar, porque quem perde a corrida vê o
-- valor já gravado pela outra e não casa com o filtro.
--
-- `<=` e não `<` de propósito: o carimbo do Asaas tem precisão de SEGUNDO, e
-- dois eventos distintos podem nascer no mesmo segundo. Com `<` o segundo
-- deles seria descartado por engano. Com `<=` uma reentrega do MESMO evento
-- reaplica o mesmo status — o que é inofensivo, porque o trigger
-- `assinaturas_touch` só carimba `problema_desde` na TRANSIÇÃO de entrada e
-- portanto reentrega não reinicia o relógio da tolerância.
--
-- POR QUE NÃO UM TRIGGER
-- ----------------------
-- Um trigger que recusasse o evento velho teria de escolher entre levantar
-- exceção — o webhook devolveria 500 e o Asaas retentaria o evento velho para
-- sempre — ou engolir a escrita em silêncio, que é pior: o `.select()` do app
-- voltaria a linha como se tivesse mudado e a tela mentiria "atualizado". Com
-- o filtro no `update`, o evento fora de ordem devolve ZERO linhas, o app vê
-- isso, registra `ignorado_fora_de_ordem` em `asaas_eventos` (migration 076) e
-- responde 200 — que é o que faz o Asaas parar de reentregar.
--
-- `null` NÃO É ZERO NEM É "MUITO ANTIGO"
-- --------------------------------------
-- Assinatura criada antes desta migration, ou evento antigo do Asaas sem
-- `dateCreated`, chega sem carimbo. O filtro trata `null` como "não sei" e
-- DEIXA PASSAR. O erro é deliberadamente a favor de quem paga: na dúvida, o
-- app aplica o evento em vez de descartar a confirmação de pagamento de
-- alguém. A alternativa (tratar ausência como data zero, ou como "hoje")
-- descartaria eventos legítimos.
--
-- O GOLD NÃO PRECISA DISTO
-- ------------------------
-- `gold_pagamentos` é cobrança avulsa e só avança com
-- `.neq("status","pago")`: não há par de eventos opostos para chegar fora de
-- ordem — ou o pagamento foi confirmado, ou não foi. Coluna equivalente ali
-- seria peso morto.
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
--   assinaturas = 0 linhas (0 ativas, 0 pendentes).
-- Coluna nova, anulável, sem default e sem constraint: ZERO linhas mudam,
-- ZERO policies mudam, ninguém perde leitura nem escrita. O efeito só começa
-- quando existir a primeira assinatura E o webhook estiver ligado.
--
-- Idempotente: `add column if not exists`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

alter table public.assinaturas
  add column if not exists ultimo_evento_em timestamptz;

comment on column public.assinaturas.ultimo_evento_em is
  'Carimbo (`dateCreated`) do evento Asaas que produziu o `status` atual. '
  'O webhook só aplica evento com carimbo >= a este — é o que impede um '
  'PAYMENT_OVERDUE reentregue de derrubar quem já regularizou (A-06). '
  '`null` = sem carimbo conhecido; nesse caso o evento passa (na dúvida, a '
  'favor de quem paga).';

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A coluna existe, é anulável e não tem default — tem de voltar 1 linha
--    com is_nullable = YES e column_default nulo:
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='assinaturas'
--    and column_name='ultimo_evento_em';
--
-- 2) Nenhuma linha existente foi tocada — as duas contagens têm de ser iguais
--    (0 e 0 hoje):
-- select (select count(*) from public.assinaturas) as assinaturas,
--        (select count(*) from public.assinaturas where ultimo_evento_em is null) as sem_carimbo;
--
-- 3) As policies de `assinaturas` continuam as MESMAS 4 (1 INSERT travado em
--    'pendente', 2 SELECT — dono e suporte —, 1 UPDATE que só chega a
--    'cancelada'). Nenhuma cita a coluna nova, então nada muda de escopo:
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='assinaturas' order by cmd;

-- ============================================================================
-- 086 — "Pago" passa a exigir a hora em que foi pago, para TODO MUNDO
-- ============================================================================
-- FECHA: o resíduo do A-09 de docs/auditoria/2026-08-19-asaas-cobranca.md que
--        a 078 não podia fechar, porque está fora do alcance de uma policy.
--
-- O PROBLEMA
-- ----------
-- A 078 fez o certo e fez bem: o INSERT de `gold_pagamentos` agora exige
-- `status = 'pendente'`, `pago_em is null`, valor igual ao de `gold_precos` e
-- `quem_paga` igual ao da solicitação. Conferido vivo em `pg_policies`.
--
-- Só que policy de RLS **só vale para quem passa por RLS**. Não passam:
--
--   · o webhook (`SUPABASE_SERVICE_ROLE_KEY`), que é justamente quem carimba
--     `pago`;
--   · o Suporte, que a própria 078 isenta de propósito, para poder conciliar à
--     mão quando o gateway e o Commander divergem;
--   · qualquer `update`/`insert` rodado no SQL editor pelo dono.
--
-- Para esses três, hoje, a tabela aceita qualquer combinação. Os únicos
-- `CHECK` vivos (lidos em `pg_constraint`, 19/08/2026) são
-- `gold_pagamentos_status_check` e `gold_pagamentos_quem_paga_check`, e os dois
-- limitam o DOMÍNIO do enum — nenhum relaciona duas colunas entre si. E não há
-- trigger nenhum na tabela (conferido em `pg_trigger`).
--
-- Resultado: `status = 'pago'` com `pago_em is null` é um estado que o banco
-- aceita. Ele é pior do que parece, porque é MUDO: a linha diz que o dinheiro
-- entrou e não diz quando. Toda conciliação com o extrato do Asaas é feita por
-- data. Um pagamento sem data não aparece no fechamento de nenhum mês — ele
-- não some da tela, some da CONTA. E o simétrico (`pendente` com `pago_em`
-- preenchido) é a mesma mentira ao contrário: uma cobrança que nunca foi paga
-- carregando a hora de um pagamento.
--
-- Nada disto é hipótese sobre código malicioso — é a classe de erro que um
-- `update` de conciliação feito às pressas produz sozinho, e que ninguém
-- percebe até o fechamento não bater.
--
-- A REGRA, E POR QUE ELA NÃO É SIMÉTRICA
-- --------------------------------------
--   · `pago`      → `pago_em` OBRIGATÓRIO. Não existe dinheiro que entrou sem
--                   hora em que entrou.
--   · `pendente`  → `pago_em` PROIBIDO. É o estado inicial, por definição
--                   anterior a qualquer pagamento.
--   · `falhou`,
--     `cancelado` → `pago_em` LIVRE, e isto é deliberado.
--
-- A tentação era escrever `(status = 'pago') = (pago_em is not null)`, que é
-- mais curto e está ERRADO. Estorno e contestação existem: uma cobrança paga em
-- março e estornada em abril vira `cancelado` — e o `pago_em` de março é
-- exatamente o dado que a conciliação precisa para achar a entrada que está
-- sendo desfeita. Um `CHECK` simétrico obrigaria a APAGAR essa data para poder
-- registrar o estorno. Seria uma migration de integridade destruindo o histórico
-- financeiro em nome da simetria.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- `ALTER TABLE ... ADD CONSTRAINT` valida as linhas existentes e FALHA ALTO se
-- alguma violar. Este é o modo de falhar bom, e é por isso que a constraint
-- entra validada (sem `NOT VALID`): numa tabela de dinheiro, uma trava que não
-- olha o que já está lá é uma trava que mente sobre o próprio nome.
--
-- Hoje isso é seguro porque a tabela tem 0 linhas (medido abaixo). Se um dia
-- não tiver e a migration falhar, a mensagem do Postgres já diz o que houve, e
-- a CONFERÊNCIA no fim traz o `select` que lista as linhas culpadas. **Não
-- contorne com `NOT VALID`**: uma linha incoerente que sobrevive à migration é
-- precisamente o que ela existe para impedir.
--
-- O modo de falhar SILENCIOSO é outro, e é contra ele que o bloco `do $$`
-- protege: `add constraint` dentro de um `if not exists` idempotente não
-- reclama quando já existe uma constraint de MESMO NOME e definição DIFERENTE
-- — herdada de uma tentativa anterior, por exemplo. Aí a migration "roda" e a
-- regra em vigor não é a deste arquivo. A trava confere a definição, não só o
-- nome.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   gold_pagamentos ........................................ 0 linhas
--   gold_pagamentos com status = 'pago' .................... 0 linhas
--   linhas que violariam a regra nova ...................... 0
-- ZERO linhas existentes são tocadas, e a validação da constraint é
-- instantânea. O caminho legítimo do webhook
-- (`web/app/api/asaas/webhook/route.ts:357`) já grava
-- `{ status: "pago", pago_em: agora }` — os dois na MESMA instrução, sempre —
-- e passa sem alteração de código.
--
-- Idempotente: a constraint só é criada se ainda não existir, e a trava reconta
-- igual na segunda vez.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE.
-- ============================================================================

begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'gold_pagamentos'
       and c.conname = 'gold_pagamentos_pago_com_carimbo'
  ) then
    alter table public.gold_pagamentos
      add constraint gold_pagamentos_pago_com_carimbo check (
        (status = 'pago'     and pago_em is not null)
        or (status = 'pendente' and pago_em is null)
        -- 'falhou' e 'cancelado': `pago_em` livre, de propósito — ver o
        -- cabeçalho. Estorno não pode custar o histórico da entrada.
        or status in ('falhou', 'cancelado')
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- TRAVA — a constraint em vigor tem de ser ESTA, não uma homônima
-- ---------------------------------------------------------------------------
do $$
declare
  v_def text;
  v_incoerentes int;
begin
  select pg_get_constraintdef(c.oid) into v_def
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'gold_pagamentos'
     and c.conname = 'gold_pagamentos_pago_com_carimbo';

  if v_def is null then
    raise exception
      'ABORTADO: a constraint gold_pagamentos_pago_com_carimbo nao existe depois do bloco que a cria.';
  end if;

  -- A definição tem de falar das duas colunas. Uma homônima herdada de outra
  -- tentativa passaria pelo `if not exists` acima sem reclamar, e a regra em
  -- vigor não seria a deste arquivo.
  if v_def not like '%pago_em%' or v_def not like '%status%' then
    raise exception
      'ABORTADO: existe uma constraint com este nome, mas a definicao nao e a desta migration: %',
      v_def;
  end if;

  -- Cinto e suspensório: a constraint validada já garante isto, mas medir de
  -- novo custa nada e transforma qualquer surpresa em erro alto.
  select count(*) into v_incoerentes
    from public.gold_pagamentos
   where (status = 'pago' and pago_em is null)
      or (status = 'pendente' and pago_em is not null);
  if v_incoerentes <> 0 then
    raise exception
      'ABORTADO: % linha(s) de gold_pagamentos continuam incoerentes depois da constraint. Isso nao deveria ser possivel — nao siga sem entender.',
      v_incoerentes;
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A constraint existe e é a desta migration — tem de voltar 1 linha:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'gold_pagamentos_pago_com_carimbo';
--
-- 2) `gold_pagamentos` continua com os 2 CHECK de domínio + este novo = 3:
-- select conname, pg_get_constraintdef(con.oid) from pg_constraint con
--   join pg_class t on t.oid = con.conrelid
--  where t.relname = 'gold_pagamentos' and con.contype = 'c' order by conname;
--
-- 3) Nenhuma linha incoerente — tem de voltar 0 (hoje a tabela está vazia;
--    este é o SELECT que acha as culpadas se a migration falhar ao aplicar):
-- select id, status, pago_em, valor_centavos, solicitacao_id
--   from public.gold_pagamentos
--  where (status = 'pago' and pago_em is null)
--     or (status = 'pendente' and pago_em is not null);
--
-- 4) A trava vale mesmo para quem NÃO passa por RLS — é o ponto do arquivo.
--    Rode com a chave de serviço (ou no SQL editor) e tem de DAR ERRO
--    `violates check constraint "gold_pagamentos_pago_com_carimbo"`:
-- -- insert into public.gold_pagamentos
-- --   (solicitacao_id, quem_paga, valor_centavos, status, pago_em)
-- -- values ('00000000-0000-0000-0000-000000000000','proprio',1,'pago',null);
--    (Vai falhar antes, na chave estrangeira, se o uuid não existir — use o id
--    de uma solicitação real quando houver uma. O erro que interessa é o do
--    CHECK; a FK falhando primeiro não prova nada.)
--
-- 5) Teste de fumaça, depois de a chave do Asaas estar ligada: pagar uma
--    avaliação em sandbox e conferir que a linha saiu com os dois campos
--    preenchidos juntos:
-- select status, pago_em from public.gold_pagamentos order by criado_em desc limit 1;
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE,
-- passo 22.

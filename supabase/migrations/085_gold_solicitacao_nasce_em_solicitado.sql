-- ============================================================================
-- 085 — A solicitação Gold para de poder NASCER depois do pagamento
-- ============================================================================
-- FECHA: o resíduo do A-09 de docs/auditoria/2026-08-19-asaas-cobranca.md.
--        A 078 travou O QUE se grava em `gold_pagamentos`; ninguém travou o
--        ESTADO com que `gold_solicitacoes` começa. É a mesma fresta, um degrau
--        acima, e é a que custa dinheiro de verdade.
--
-- O PROBLEMA
-- ----------
-- A policy viva (`gold_solicitacoes: criar`, lida com `pg_policies` em
-- 19/08/2026, já com 082 aplicada) pergunta QUEM cria e SOBRE O QUE:
--
--   with check (
--     solicitante_id = (select auth.uid())
--     and (
--       (embarcacao_id is not null and papel_solicitante = 'proprietario'
--        and eh_prop(embarcacao_id))
--       or (embarcacao_id is null
--           and papel_solicitante = any (array['vendedor','interessado']))))
--
-- Não pergunta EM QUE PONTO DO FUNIL. A coluna tem
-- `default 'solicitado'::text` e um `CHECK` que só limita o DOMÍNIO (os dez
-- estados). Default não é trava: quem escreve pelo PostgREST manda a coluna
-- explicitamente e o default nunca é consultado.
--
-- Ou seja: um `POST /rest/v1/gold_solicitacoes` com
-- `{"estado": "aguardando_agendamento", ...}` cria um pedido que já passou pela
-- caixa. E `aguardando_agendamento` é exatamente o estado que a fila do admin
-- (`/admin/gold`) trata como "pago, pode marcar a vistoria".
--
-- O ESTRAGO, NA ORDEM EM QUE ACONTECE
-- -----------------------------------
--   1. o pedido entra na fila do admin como se estivesse pago;
--   2. o admin agenda o consultor (`gold_agendamentos`);
--   3. o consultor VIAJA e faz a vistoria.
--
-- Isso não é sujeira no relatório: é serviço prestado, com deslocamento de
-- pessoa, sem nenhum centavo ter entrado. O A-09 dizia, com razão para o que
-- examinava, que a fresta "não libera acesso, mas polui o financeiro". Nesta
-- aqui não é poluição — é prejuízo, e não passa por `gold_pagamentos` em
-- momento nenhum, então nem a 078 nem o webhook chegam a ser consultados.
--
-- Nascer em `aprovado` é a variante barulhenta do mesmo buraco: não gera selo
-- (o selo sai de `gold_definir_estado('aprovado')`, que exige avaliação
-- completa e Suporte), mas de `aprovado` a máquina de estados não sai mais —
-- o pedido fica encravado e mentindo na tela do dono da embarcação.
--
-- A CORREÇÃO
-- ----------
-- O INSERT passa a exigir `estado = 'solicitado'`. Uma condição, e o resto da
-- policy fica idêntico caractere por caractere — nenhum ramo é alargado, nem o
-- do Suporte (que hoje NÃO cria solicitação por RLS, e continua não criando:
-- alargar isso seria decidir uma coisa que ninguém pediu).
--
-- Depois disto, sair de `solicitado` só pela RPC `gold_definir_estado`, que é
-- onde a autorização por transição já mora desde a 033/074.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- É o perigo do NOME, e ele é silencioso. Policy permissiva se SOMA (OR): um
-- `drop policy if exists` que não case o nome vivo não falha — ele não faz
-- nada, a policy antiga (sem a trava) continua de pé ao lado da nova, e o OR
-- entre as duas devolve exatamente a permissão de antes. A migration "roda com
-- sucesso" e não corrige coisa nenhuma. É o mesmo modo de falhar de que a 083
-- se defendeu, e a defesa aqui é a mesma: um bloco `do $$` antes do `commit`
-- que reconta o catálogo e LEVANTA EXCEÇÃO, desfazendo a transação inteira.
--
-- O outro perigo seria trancar o caminho legítimo. Não tranca, e a prova é
-- direta: os dois `insert` do app (`web/lib/acoes/gold.ts:131` e `:160`) não
-- mandam a coluna `estado` — deixam o default `'solicitado'` agir. Os dois
-- passam sem uma linha de código mudar.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   gold_solicitacoes ................................. 0 linhas
--   gold_solicitacoes com estado <> 'solicitado' ...... 0 linhas
--   gold_pagamentos ................................... 0 linhas
-- ZERO linhas existentes mudam de comportamento. Esta porta ainda não foi
-- atravessada por ninguém — e é de graça fechá-la agora, antes de a chave do
-- Asaas ser ligada e a fila do admin começar a andar.
--
-- Idempotente: `drop policy if exists` + `create policy`, e a trava reconta
-- igual na segunda vez.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE.
-- ============================================================================

begin;

-- O nome é EXATAMENTE o da policy viva (`gold_solicitacoes: criar`). Nome novo
-- deixaria a antiga em pé ao lado desta e anularia a correção em silêncio.
drop policy if exists "gold_solicitacoes: criar" on public.gold_solicitacoes;

create policy "gold_solicitacoes: criar" on public.gold_solicitacoes
  for insert to authenticated
  with check (
    -- NOVO, e é a única linha nova do arquivo: todo pedido começa no começo.
    estado = 'solicitado'
    -- Daqui para baixo é a policy viva, sem alteração de significado. A única
    -- diferença de escrita é o `public.` em `eh_prop`, que a 078 já adota e o
    -- catálogo normaliza para a mesma expressão armazenada.
    and solicitante_id = (select auth.uid())
    and (
      (
        embarcacao_id is not null
        and papel_solicitante = 'proprietario'
        and public.eh_prop(embarcacao_id)
      )
      or (
        embarcacao_id is null
        and papel_solicitante = any (array['vendedor', 'interessado'])
      )
    )
  );

-- ---------------------------------------------------------------------------
-- TRAVA — nada disto passa se o `drop` não tiver casado o nome vivo
-- ---------------------------------------------------------------------------
do $$
declare
  v_insert int;
  v_com_trava int;
  v_adiantadas int;
begin
  -- (i) tem de existir UMA policy de INSERT. Duas significam que o `drop` não
  --     casou o nome e a antiga (permissiva, sem trava) sobreviveu ao lado.
  select count(*) into v_insert
    from pg_policies
   where schemaname = 'public' and tablename = 'gold_solicitacoes' and cmd = 'INSERT';
  if v_insert <> 1 then
    raise exception
      'ABORTADO: gold_solicitacoes ficou com % policies de INSERT (esperado exatamente 1). Um drop nao casou o nome vivo — a antiga soma por OR e anula esta correcao. Rode: select policyname, cmd from pg_policies where schemaname=''public'' and tablename=''gold_solicitacoes'';',
      v_insert;
  end if;

  -- (ii) e ela tem de ser a NOVA. Uma policy de INSERT que não mencione
  --      `estado` é a antiga tendo sobrevivido a um `create` que falhou sem
  --      derrubar a transação.
  select count(*) into v_com_trava
    from pg_policies
   where schemaname = 'public' and tablename = 'gold_solicitacoes' and cmd = 'INSERT'
     and with_check like '%estado%';
  if v_com_trava <> 1 then
    raise exception
      'ABORTADO: a policy de INSERT de gold_solicitacoes nao menciona `estado`. A trava nao entrou.';
  end if;

  -- (iii) e nenhuma linha existente pode estar adiantada no funil sem ter
  --       passado por pagamento. Hoje a tabela tem 0 linhas; se um dia tiver,
  --       esta contagem é o alarme de que alguém já usou a porta antes de ela
  --       ser fechada — e aí a migration para, para o dono olhar antes.
  select count(*) into v_adiantadas
    from public.gold_solicitacoes s
   where s.estado in ('pago', 'aguardando_agendamento', 'agendado',
                      'avaliacao_realizada', 'em_analise', 'aprovado')
     and not exists (
       select 1 from public.gold_pagamentos p
        where p.solicitacao_id = s.id and p.status = 'pago'
     );
  if v_adiantadas <> 0 then
    raise exception
      'ABORTADO: % solicitacao(oes) ja estao adiantadas no funil SEM pagamento pago. A porta que esta migration fecha pode ter sido usada. Olhe antes de fechar: select id, estado, solicitante_id, criado_em from public.gold_solicitacoes where estado in (''pago'',''aguardando_agendamento'',''agendado'',''avaliacao_realizada'',''em_analise'',''aprovado'');',
      v_adiantadas;
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) Existe UMA policy de INSERT e ela cita `estado` — tem de voltar 1:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='gold_solicitacoes' and cmd='INSERT'
--    and with_check like '%estado%';
--
-- 2) Nenhuma policy sobrando (tem de voltar 2 linhas: 1 INSERT + 1 SELECT):
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='gold_solicitacoes' order by cmd;
--
-- 3) `gold_solicitacoes` continua SEM policy de UPDATE e SEM policy de DELETE
--    — a máquina de estados continua só na RPC. Tem de voltar 0:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='gold_solicitacoes'
--    and cmd in ('UPDATE','DELETE');
--
-- 4) Nenhuma solicitação adiantada sem pagamento — tem de voltar 0 (hoje a
--    tabela está vazia; este é o SELECT para rodar de novo depois que o Gold
--    começar a vender, e ele deve viver em 0):
-- select count(*) from public.gold_solicitacoes s
--  where s.estado in ('pago','aguardando_agendamento','agendado',
--                     'avaliacao_realizada','em_analise','aprovado')
--    and not exists (select 1 from public.gold_pagamentos p
--                     where p.solicitacao_id = s.id and p.status = 'pago');
--
-- 5) Teste de fumaça, com login comum: pedir o Commander Gold em
--    `/barco/selos/gold` (nas duas variantes — "minha embarcação" e
--    "outra embarcação"). O pedido tem de nascer e, pela 074, avançar sozinho
--    para "Aguardando pagamento". Se aparecer "Não foi possível registrar o
--    pedido", a policy recusou o INSERT — e a única causa possível é o app ter
--    passado a mandar `estado` explicitamente, o que hoje ele não faz.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE,
-- passo 21.

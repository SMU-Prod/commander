-- ===========================================================================
-- COMMANDER — QUINTO LOTE, 19/08/2026
-- O RESÍDUO DA CADEIA DE DINHEIRO (A-09, A-10, A-12)
--
-- Cole INTEIRO no SQL Editor do Supabase e rode. A conferência sai no fim.
--
-- SÃO QUATRO TRANSAÇÕES, NÃO UMA, e isso é de propósito: cada migration abre e
-- fecha a sua. Se uma do meio falhar, as anteriores já estão gravadas e as
-- seguintes não chegam a rodar — em vez de perder o lote inteiro por um passo.
--
-- A ORDEM NÃO É OBRIGATÓRIA (nenhuma depende de outra), mas é a do dinheiro e
-- está certa como está: primeiro a porta que custa serviço prestado, por fim a
-- que impede a divergência de voltar.
--
-- ---------------------------------------------------------------------------
-- ANTES DE TUDO: A-09, A-10 E A-12 JÁ ESTAVAM FECHADOS
-- ---------------------------------------------------------------------------
-- O relatório de fechamento os lista como ABERTOS. Está desatualizado. Lido no
-- banco vivo hoje: a 078 e a 079 estão aplicadas (as duas policies carregam
-- todas as travas), e o webhook dá os dois passos desde a onda 85.
--
-- Este lote é o que os três deixaram para trás — quatro portas que as correções
-- anteriores não podiam alcançar de onde estavam. Três delas são fora do
-- alcance de qualquer policy, por razões estruturais explicadas em cada arquivo.
--
-- ---------------------------------------------------------------------------
-- O QUE CADA UMA FAZ
-- ---------------------------------------------------------------------------
-- 085  O pedido Gold deixa de poder NASCER em `aguardando_agendamento`. Hoje a
--      policy pergunta quem cria e sobre o quê, e não pergunta em que ponto do
--      funil — e `default 'solicitado'` não é trava para quem escreve pelo
--      PostgREST. É a única das quatro com prejuízo direto: o pedido entra na
--      fila do admin como pago, o consultor viaja e vistoria de graça.
--
-- 086  `status = 'pago'` passa a exigir `pago_em`. Vale para o webhook, o
--      Suporte e o SQL editor — que é justamente quem a policy da 078 não
--      alcança. Pagamento sem data não some da tela, some da CONTA.
--      `falhou`/`cancelado` ficam com `pago_em` livre de propósito: estorno não
--      pode custar o histórico da entrada.
--
-- 087  O UPDATE de `assinaturas` para de poder reescrever a identidade no
--      gateway. A 079 amarrou o `asaas_subscription_id` no INSERT e o UPDATE
--      ficou livre — e como o índice é UNIQUE, quem escreve o `sub_` de outra
--      pessoa OCUPA o id e IMPEDE a vítima de assinar, com o alarme apontando
--      para o lugar errado. Chave de serviço e Suporte seguem isentos (é como
--      `trocarPlano` funciona, por desenho).
--
-- 088  A máquina de estados do Gold deixa de ser obedecida e passa a ser
--      APLICADA — inclusive para a chave de serviço. Hoje `gold_transicao_valida`
--      só é consultada de dentro de `gold_definir_estado`, e `gold_solicitacoes`
--      não tem trigger nenhum: foi por essa fresta que o webhook divergiu por
--      meses sem nada ter como notar. Ela ABORTA sozinha se a máquina de estados
--      viva não for a que a onda 85 declarou verdadeira.
--
-- ---------------------------------------------------------------------------
-- IMPACTO: ZERO LINHAS EXISTENTES. Medido hoje — gold_solicitacoes 0,
-- gold_pagamentos 0, assinaturas 0, asaas_eventos 0. Nenhuma policy é criada
-- nem apagada (a 085 recria uma com o MESMO nome), então a contagem tem de
-- continuar em 252 no fim. Nenhum caminho do app muda: os três foram conferidos
-- contra o código vivo.
--
-- SE ALGO DER ERRADO: a reversão de cada uma está escrita em
-- supabase/migrations/APLICAR-2026-08-19.md, seção QUINTO LOTE (passos 21 a 24),
-- e o passo 24 traz também a válvula para conserto manual de estado.
-- ===========================================================================


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
-- ============================================================================
-- 087 — O UPDATE de `assinaturas` para de poder reescrever de quem é a conta
--       no gateway, e por quanto
-- ============================================================================
-- FECHA: o resíduo do A-10 de docs/auditoria/2026-08-19-asaas-cobranca.md.
--        A 079 amarrou o `asaas_subscription_id` no INSERT. Ninguém olhou o
--        UPDATE — e o UPDATE chega ao mesmo lugar por outra porta.
--
-- O PROBLEMA
-- ----------
-- A policy de UPDATE viva (`assinatura: cancelar a propria`, lida em
-- `pg_policies` em 19/08/2026) é:
--
--   using      (usuario_id = (select auth.uid()))
--   with check (usuario_id = (select auth.uid()) and status = 'cancelada')
--
-- Ela decide DUAS coisas: em qual linha se pode mexer (a sua) e em que status a
-- linha pode terminar (`cancelada`). Não decide nada sobre as outras cinco
-- colunas — e um `update` escreve quantas colunas quiser numa instrução só:
--
--   PATCH /rest/v1/assinaturas?id=eq.<a minha>
--   { "status": "cancelada", "asaas_subscription_id": "sub_DA_VITIMA" }
--
-- Passa nas duas condições. É a minha linha, e ela termina em `cancelada`.
--
-- POR QUE ISSO É O A-10 DE NOVO, E NÃO UM ACHADO NOVO
-- ---------------------------------------------------
-- O A-10 é "nada amarra o `asaas_subscription_id` a quem tem direito a ele". A
-- 079 amarrou no nascimento. Mas `assinaturas_asaas_subscription_id_key` é
-- UNIQUE (conferido em `pg_indexes`): o id do gateway é um recurso EXCLUSIVO da
-- tabela inteira, não da minha linha. Quem escreve esse id na própria linha
-- OCUPA o id — para todo mundo.
--
-- O estrago, na ordem:
--
--   1. eu cancelo a minha assinatura e, na mesma instrução, escrevo no campo o
--      `sub_…` de outra pessoa;
--   2. `cancelada` me tira do índice `assinaturas_uma_viva_idx`, então eu fico
--      livre para assinar de novo — nada me denuncia;
--   3. quando a vítima for assinar, o INSERT dela bate no UNIQUE e falha. Ela
--      não consegue contratar, e a tela dela diz "não foi possível registrar a
--      assinatura. Tente de novo" — para sempre, sem ninguém entender por quê;
--   4. e os eventos do Asaas dela chegam ao webhook, casam com a MINHA linha
--      cancelada, não aplicam nada (`cancelada` é terminal, e isso está certo)
--      e viram `sem_correspondencia` em `asaas_eventos` — o alarme do A-07
--      tocando por uma causa que ninguém vai adivinhar olhando o gateway.
--
-- Não há escalada de privilégio: eu não ganho o acesso da vítima. Eu tiro o
-- dela, e o rastro aponta para o lugar errado. Para uma cadeia de dinheiro,
-- negar a contratação de um cliente pagante é tão caro quanto liberar acesso de
-- graça — e bem mais difícil de diagnosticar.
--
-- `plano` e `valor_centavos` entram na mesma trava pelo mesmo motivo: quem pode
-- reescrever o valor da própria linha escreve o número que o financeiro vai
-- somar. `plano` ainda decide limite de embarcação e de tripulação dentro da
-- RLS, via `plano_do_usuario` (conferida viva: ela lê `assinaturas.plano` para
-- quem está em `ativa`/`problema_pagamento`).
--
-- POR QUE TRIGGER, E NÃO POLICY
-- -----------------------------
-- Não dá para fazer isto com RLS, e a razão é estrutural: o `WITH CHECK` de uma
-- policy enxerga a linha NOVA; o `USING` enxerga a VELHA. Nenhum dos dois
-- enxerga as duas ao mesmo tempo, e "esta coluna não pode MUDAR" é
-- necessariamente uma comparação entre as duas. Toda tentativa de escrever essa
-- regra como policy vira uma regra diferente e mais fraca.
--
-- Trigger `BEFORE UPDATE` compara `OLD` e `NEW` — é a ferramenta certa, e a
-- única.
--
-- QUEM A TRAVA NÃO ALCANÇA, DE PROPÓSITO
-- --------------------------------------
--   · `auth.uid() is null` — a chave de serviço e o SQL rodado à mão. Este NÃO
--     é um furo: é o desenho que o app já documenta e depende. `trocarPlano`
--     (`web/lib/acoes/assinatura.ts:237-241`) muda `plano` e `valor_centavos`
--     com `supabaseServico()` **exatamente porque** essa escrita não pode ser
--     do cliente — o comentário em `:194-200` diz isso com todas as letras:
--     "quem autoriza a troca é o GATEWAY ter aceitado a mudança de cobrança —
--     fato que só o servidor conhece". A trava aqui protege a porta do cliente
--     e deixa a do servidor como está.
--   · o Suporte (`tem_papel_admin('suporte')`), que é quem concilia à mão —
--     mesma isenção que a 078 já dá no Gold, pelo mesmo motivo.
--
-- Em resumo: depois desta migration, mudar a identidade de gateway de uma
-- assinatura passa a exigir ou o servidor, ou o Suporte. Nunca o navegador de
-- quem assinou.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- Um trigger BEFORE UPDATE bom demais TRANCA O CANCELAMENTO — e o cancelamento
-- é o único UPDATE que o cliente tem. Se a lista de colunas congeladas
-- incluísse `status`, `atualizado_em`, `problema_desde` ou `ultimo_evento_em`,
-- `cancelarAssinatura` (`web/lib/acoes/assinatura.ts:170-172`) passaria a
-- falhar, e o cliente ficaria preso numa assinatura que ele já cancelou no
-- gateway. Por isso a lista é EXPLÍCITA e curta: cinco colunas nomeadas uma a
-- uma, e o resto da linha continua livre como está hoje.
--
-- Conferido, coluna por coluna, contra a definição viva de `assinaturas`
-- (`information_schema.columns`, 11 colunas): as seis não congeladas são `id`
-- (chave), `status`, `criado_em`, `atualizado_em`, `problema_desde` e
-- `ultimo_evento_em` — e as quatro últimas são justamente as que o webhook e o
-- trigger `assinaturas_touch` escrevem.
--
-- O modo de falhar SILENCIOSO aqui é o `create trigger` que não pega: se o nome
-- divergir, fica um trigger órfão ao lado, ou nenhum, e o `update` continua
-- passando. Por isso o bloco `do $$` no fim RECONTA o catálogo e levanta
-- exceção — inclusive conferindo que o trigger aponta para a função certa, e
-- não para uma homônima antiga.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   assinaturas ....................................... 0 linhas
--   asaas_eventos ..................................... 0 linhas
-- ZERO linhas existentes são tocadas. Nenhum `update` deixa de funcionar hoje,
-- porque hoje não há o que atualizar — e quando houver, os dois caminhos reais
-- (cancelar pelo cliente, trocar plano pelo servidor) já estão do lado de fora
-- da trava, por construção.
--
-- Idempotente: `create or replace function` + `drop trigger if exists`.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A função do trigger
-- ---------------------------------------------------------------------------
-- NÃO é `security definer`, e é de propósito: ela não lê tabela nenhuma por
-- conta própria — só compara `OLD` com `NEW` e delega a pergunta de papel a
-- `tem_papel_admin`, que já é DEFINER e já tem `search_path` fixo. Rodar como
-- invocador é o privilégio mínimo aqui. O `search_path` vai fixo mesmo assim,
-- porque a regra da casa é que nenhuma função nomeie um objeto sem dizer de
-- qual esquema ele é.
create or replace function public.assinatura_congela_identidade()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Sem sessão de usuário: chave de serviço (webhook, `trocarPlano`) ou SQL
  -- rodado à mão pelo dono. É o caminho do servidor — ver o cabeçalho.
  if v_uid is null then
    return new;
  end if;

  -- Suporte concilia à mão. Mesma isenção da 078 no Gold.
  if public.tem_papel_admin('suporte') then
    return new;
  end if;

  -- `is distinct from` e não `<>`: `<>` devolve NULL quando um dos lados é
  -- NULL, e um `if NULL` não entra no ramo. Com `<>`, trocar um valor por NULL
  -- passaria batido — que é exatamente o caso que interessa barrar.
  if new.usuario_id is distinct from old.usuario_id then
    raise exception 'assinatura: usuario_id nao pode ser alterado';
  end if;
  if new.asaas_customer_id is distinct from old.asaas_customer_id then
    raise exception 'assinatura: asaas_customer_id nao pode ser alterado';
  end if;
  if new.asaas_subscription_id is distinct from old.asaas_subscription_id then
    raise exception 'assinatura: asaas_subscription_id nao pode ser alterado';
  end if;
  if new.plano is distinct from old.plano then
    raise exception 'assinatura: plano so muda pelo servidor, depois de o gateway aceitar';
  end if;
  if new.valor_centavos is distinct from old.valor_centavos then
    raise exception 'assinatura: valor_centavos so muda pelo servidor, depois de o gateway aceitar';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- O trigger
-- ---------------------------------------------------------------------------
-- `assinaturas` já tem `assinaturas_touch` (BEFORE UPDATE, conferido em
-- `pg_trigger`). Dois BEFORE UPDATE na mesma tabela disparam em ordem
-- ALFABÉTICA do nome, e a ordem entre estes dois não importa: `assinaturas_touch`
-- mexe em `atualizado_em`/`problema_desde`, nenhuma das quais está congelada
-- aqui. O nome escolhido roda antes, o que só torna a recusa mais barata.
drop trigger if exists assinaturas_congela_identidade on public.assinaturas;

create trigger assinaturas_congela_identidade
  before update on public.assinaturas
  for each row execute function public.assinatura_congela_identidade();

-- ---------------------------------------------------------------------------
-- TRAVA — o trigger tem de existir E apontar para a função deste arquivo
-- ---------------------------------------------------------------------------
do $$
declare
  v_trigger int;
  v_func int;
begin
  -- (i) o trigger existe, é BEFORE UPDATE em `assinaturas`, e chama a função
  --     desta migration. Um `create trigger` que não pegou, ou um que ficou
  --     apontando para uma homônima antiga, deixa o `update` passando — e é
  --     um silêncio, não um erro.
  select count(*) into v_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public'
     and c.relname = 'assinaturas'
     and t.tgname = 'assinaturas_congela_identidade'
     and not t.tgisinternal
     and p.proname = 'assinatura_congela_identidade';
  if v_trigger <> 1 then
    raise exception
      'ABORTADO: o trigger assinaturas_congela_identidade nao ficou ligado a funcao assinatura_congela_identidade (encontrados: %). Rode: select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname=''assinaturas'' and not t.tgisinternal;',
      v_trigger;
  end if;

  -- (ii) a função congela as CINCO colunas. Se alguma sumir numa edição futura
  --      deste arquivo, a trava cai antes do commit em vez de a coluna ficar
  --      destravada sem ninguém notar.
  select count(*) into v_func
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'assinatura_congela_identidade'
     and pg_get_functiondef(p.oid) like '%usuario_id%'
     and pg_get_functiondef(p.oid) like '%asaas_customer_id%'
     and pg_get_functiondef(p.oid) like '%asaas_subscription_id%'
     and pg_get_functiondef(p.oid) like '%plano%'
     and pg_get_functiondef(p.oid) like '%valor_centavos%';
  if v_func <> 1 then
    raise exception
      'ABORTADO: assinatura_congela_identidade nao menciona as 5 colunas congeladas.';
  end if;

  -- (iii) `assinaturas_touch` continua vivo. Ele é quem carimba
  --       `atualizado_em` e `problema_desde`; perdê-lo por acidente quebraria a
  --       contagem de tolerância de `avaliarCiclo` em silêncio.
  if not exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'assinaturas'
       and t.tgname = 'assinaturas_touch' and not t.tgisinternal
  ) then
    raise exception
      'ABORTADO: o trigger assinaturas_touch sumiu. Ele NAO faz parte desta migration e tem de continuar vivo.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) `assinaturas` tem os DOIS triggers — tem de voltar 2 linhas:
-- select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--  where c.relname = 'assinaturas' and not t.tgisinternal order by t.tgname;
--    Esperado: assinaturas_congela_identidade, assinaturas_touch.
--
-- 2) As policies de `assinaturas` continuam as MESMAS 4 — esta migration não
--    toca em nenhuma:
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='assinaturas' order by cmd;
--    Esperado: 1 INSERT, 2 SELECT, 1 UPDATE.
--
-- 3) A função não é DEFINER e tem `search_path` fixo — tem de voltar
--    `f | search_path=public`:
-- select p.prosecdef, array_to_string(p.proconfig, ',') from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname='assinatura_congela_identidade';
--
-- 4) A checagem global da casa continua verde (nenhuma função DEFINER sem
--    search_path) — tem de voltar 0:
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prosecdef
--    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
--
-- 5) Teste de fumaça, com login real, DEPOIS de existir uma assinatura:
--    · cancelar pela tela `/menu/assinatura` — tem de continuar funcionando
--      (é o UPDATE que o cliente tem, e ele não toca em coluna congelada);
--    · trocar de plano pela tela — tem de continuar funcionando (passa pela
--      chave de serviço, isenta por desenho);
--    · e o que TEM de falhar, rodado com o token de um usuário comum:
--      PATCH /rest/v1/assinaturas?id=eq.<a dele>
--      { "status": "cancelada", "asaas_subscription_id": "sub_outro" }
--      Esperado: erro `assinatura: asaas_subscription_id nao pode ser alterado`.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE,
-- passo 23.
-- ============================================================================
-- 088 — A máquina de estados do Gold deixa de ser um acordo de cavalheiros
-- ============================================================================
-- FECHA: o A-12 de docs/auditoria/2026-08-19-asaas-cobranca.md, no ponto em que
--        ele ainda está aberto de verdade.
--
-- O QUE JÁ FOI DECIDIDO, E ONDE
-- -----------------------------
-- O A-12 pedia uma decisão: ou a função do banco passa a aceitar o salto
-- `aguardando_pagamento → aguardando_agendamento`, ou o webhook para de saltar.
-- A decisão foi tomada na ONDA 85 e está escrita, com os três motivos, em
-- `web/app/api/asaas/webhook/route.ts:277-345`: **o banco é a definição
-- verdadeira, e o webhook cedeu.** Ele passou a dar os dois passos
-- (`aguardando_pagamento → pago`, depois `pago → aguardando_agendamento`), cada
-- um com o estado de origem no `where`.
--
-- Conferido vivo, hoje, em `pg_get_functiondef`: `gold_transicao_valida`
-- continua dizendo `when 'aguardando_pagamento' then p_novo in ('pago',
-- 'cancelado')`. As três vozes (banco, `TRANSICOES` em `lib/domain/gold.ts`, e
-- o webhook) agora dizem a mesma coisa. Esta migration não reabre essa decisão.
--
-- O QUE CONTINUA ABERTO
-- ---------------------
-- A definição verdadeira não é APLICADA. Ela é obedecida.
--
-- `gold_transicao_valida` só é consultada de um lugar: de dentro de
-- `gold_definir_estado` (verificado — é a única função do esquema `public` cujo
-- corpo a menciona). E `gold_solicitacoes` **não tem trigger nenhum**
-- (`pg_trigger`, conferido) nem policy de UPDATE (`pg_policies`, conferido).
--
-- Isso quer dizer que a máquina de estados vale para quem escolhe passar pela
-- RPC. Quem escreve com a chave de serviço passa por cima dela sem nem sabê-la
-- existente — e o webhook, que é exatamente esse caso, foi o que aconteceu:
-- durante meses ele fez uma transição que a definição verdadeira proibia, e
-- nada no sistema teve como notar. Não foi um bug difícil; foi um bug INVISÍVEL.
-- Só uma auditoria linha a linha o encontrou.
--
-- Enquanto a regra for uma convenção, o próximo caminho que escrever nesta
-- tabela com a chave de serviço vai poder repetir a mesma divergência, pelo
-- mesmo motivo: não há nada para ele esbarrar. "Fazer sobrar uma definição" só
-- termina quando a que sobra é a que o banco EXECUTA.
--
-- O QUE ESTA MIGRATION FAZ
-- ------------------------
-- Um `BEFORE UPDATE` em `gold_solicitacoes` que, quando `estado` muda, chama
-- `gold_transicao_valida(OLD.estado, NEW.estado)` e recusa se ela disser não.
-- Nenhuma regra nova é inventada: a lista de transições continua vivendo num
-- lugar só, e este arquivo apenas a coloca no caminho de todo mundo.
--
-- A REGRA VALE PARA A CHAVE DE SERVIÇO TAMBÉM — É O PONTO
-- -------------------------------------------------------
-- A 087, ao lado, isenta a chave de serviço de propósito, porque lá o servidor
-- é a AUTORIDADE (só ele sabe que o gateway aceitou a troca de plano). Aqui é o
-- oposto, e a diferença é a lição inteira do A-12: o webhook não é autoridade
-- sobre a ORDEM do funil. Ele sabe uma coisa só — que o dinheiro entrou — e a
-- máquina de estados é quem diz o que essa notícia significa. Isentá-lo aqui
-- seria recriar o buraco no mesmo arquivo que o fecha.
--
-- Nada legítimo quebra, e isto foi verificado caminho a caminho:
--   · `gold_definir_estado` — já valida com a MESMA função antes de escrever;
--     o trigger só reconfirma (a função é IMMUTABLE, custo desprezível);
--   · o webhook, passos 1 e 2 (`route.ts:389-410`) — `aguardando_pagamento →
--     pago` e `pago → aguardando_agendamento`, as duas válidas;
--   · `gold_definir_regiao` — escreve `regiao_id`, não `estado`; cai no
--     `OLD.estado = NEW.estado` e passa sem avaliar nada;
--   · qualquer outro `update` da tabela (`atualizado_em`, campos da embarcação
--     externa) — idem.
--   · o INSERT não é tocado: quem cuida do estado inicial é a 085.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- Ela tira do dono a possibilidade de consertar um estado à mão com um `update`
-- solto. Isso é real e é o preço da correção — vale medir o preço direito:
--
--   · Todo conserto LEGÍTIMO continua possível, porque conserto legítimo é
--     transição válida, e o Suporte já pode fazer todas elas pela RPC
--     (`gold_definir_estado` autoriza o Suporte em qualquer transição da
--     máquina). O caso concreto que o próprio webhook prevê — a solicitação
--     ficar parada em `pago` porque o processo morreu entre os dois passos —
--     é `pago → aguardando_agendamento`, que é válida. Não precisa de válvula.
--   · O que deixa de ser possível é o salto ARBITRÁRIO: voltar de `agendado`
--     para `solicitado`, ressuscitar um `cancelado`. Isso hoje é possível e
--     nunca foi uma operação de produto — é a mesma coisa que a RPC recusa
--     desde a 033.
--   · Se ainda assim for preciso (migração de dados, correção de um estrago),
--     a válvula existe, é explícita e está na REVERSÃO: desligar o trigger
--     dentro da transação do conserto e religá-lo. Deliberado, visível no SQL,
--     e sem GUC mágico que alguém possa deixar ligado sem querer.
--
-- O outro perigo é o de sempre com trigger: o `create` que não pega deixa tudo
-- passando, em silêncio. Daí o bloco `do $$` no fim, que reconta o catálogo,
-- confere que o trigger aponta para a função deste arquivo, e — porque aqui dá
-- para provar de verdade — EXERCITA a regra: pergunta à
-- `gold_transicao_valida` as três respostas que definem o A-12 e levanta
-- exceção se alguma tiver mudado.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   gold_solicitacoes ..................................... 0 linhas
--   gold_solicitacoes em 'aguardando_agendamento' ......... 0 linhas
--   gold_pagamentos ....................................... 0 linhas
--   triggers em gold_solicitacoes hoje .................... 0
-- ZERO linhas existentes são tocadas. Nenhuma transição é revalidada
-- retroativamente: o trigger só olha os `update` que vierem depois dele.
--
-- Idempotente: `create or replace function` + `drop trigger if exists`.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A função do trigger
-- ---------------------------------------------------------------------------
-- Não inventa regra: delega inteirinha a `gold_transicao_valida`, que continua
-- sendo o único lugar onde a lista de transições existe. Se um dia a lista
-- mudar, muda lá, e este arquivo obedece sem ser editado — que é o que "uma
-- definição só" tem de querer dizer.
--
-- NÃO é `security definer`: não lê tabela nenhuma, só chama uma função
-- IMMUTABLE. `search_path` fixo pela regra da casa.
create or replace function public.gold_estado_respeita_maquina()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- `is not distinct from` cobre o caso de `estado` ser NULL dos dois lados.
  -- A coluna é NOT NULL hoje, mas escrever a comparação torta aqui seria
  -- reintroduzir, num arquivo sobre rigor, a mesma classe de descuido.
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if not public.gold_transicao_valida(old.estado, new.estado) then
    raise exception 'transicao_invalida_%_%', old.estado, new.estado;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- O trigger
-- ---------------------------------------------------------------------------
-- A mensagem de erro é IDÊNTICA à que `gold_definir_estado` já levanta
-- (`transicao_invalida_%_%`), de propósito: quem for depurar não precisa
-- descobrir que existem dois lugares que recusam: a recusa fala a mesma língua
-- venha de onde vier.
drop trigger if exists gold_solicitacoes_estado_valido on public.gold_solicitacoes;

create trigger gold_solicitacoes_estado_valido
  before update on public.gold_solicitacoes
  for each row execute function public.gold_estado_respeita_maquina();

-- ---------------------------------------------------------------------------
-- TRAVA — o trigger tem de estar ligado E a máquina tem de dizer o que se espera
-- ---------------------------------------------------------------------------
do $$
declare
  v_trigger int;
begin
  -- (i) o trigger existe e chama a função desta migration.
  select count(*) into v_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public'
     and c.relname = 'gold_solicitacoes'
     and t.tgname = 'gold_solicitacoes_estado_valido'
     and not t.tgisinternal
     and p.proname = 'gold_estado_respeita_maquina';
  if v_trigger <> 1 then
    raise exception
      'ABORTADO: o trigger gold_solicitacoes_estado_valido nao ficou ligado a funcao gold_estado_respeita_maquina (encontrados: %).',
      v_trigger;
  end if;

  -- (ii) a máquina de estados tem de ser a que o A-12 declarou verdadeira. Se
  --      alguém tiver alargado `gold_transicao_valida` para aceitar o salto —
  --      isto é, tiver tomado a decisão OPOSTA à da onda 85 — este trigger
  --      passaria a aplicar uma regra que o webhook não segue mais, e o
  --      resultado seria pior do que não ter trigger nenhum: duas definições,
  --      agora as duas com dentes.
  if not public.gold_transicao_valida('aguardando_pagamento', 'pago') then
    raise exception
      'ABORTADO: gold_transicao_valida nao aceita aguardando_pagamento -> pago. A maquina de estados viva nao e a que este trigger espera.';
  end if;
  if not public.gold_transicao_valida('pago', 'aguardando_agendamento') then
    raise exception
      'ABORTADO: gold_transicao_valida nao aceita pago -> aguardando_agendamento. O caminho do webhook (passo 2) ficaria trancado por este trigger.';
  end if;
  if public.gold_transicao_valida('aguardando_pagamento', 'aguardando_agendamento') then
    raise exception
      'ABORTADO: gold_transicao_valida PASSOU a aceitar o salto aguardando_pagamento -> aguardando_agendamento. Alguem decidiu o A-12 ao contrario da onda 85. Resolva a divergencia (web/app/api/asaas/webhook/route.ts:277-345) ANTES de aplicar este trigger.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) O trigger existe — tem de voltar 1 linha:
-- select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--  where c.relname = 'gold_solicitacoes' and not t.tgisinternal;
--
-- 2) A máquina de estados continua dizendo o que o A-12 declarou verdadeiro —
--    tem de voltar `true, true, false`:
-- select public.gold_transicao_valida('aguardando_pagamento','pago')     as deve_ser_true,
--        public.gold_transicao_valida('pago','aguardando_agendamento')   as deve_ser_true_2,
--        public.gold_transicao_valida('aguardando_pagamento','aguardando_agendamento')
--                                                                        as deve_ser_false;
--
-- 3) `gold_solicitacoes` continua SEM policy de UPDATE — o trigger é uma
--    segunda camada, não a substituta da primeira. Tem de voltar 0:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='gold_solicitacoes' and cmd='UPDATE';
--
-- 4) A regra tem dentes MESMO com a chave de serviço — é o ponto do arquivo.
--    Rode no SQL editor, com uma solicitação real em `solicitado`, e tem de DAR
--    ERRO `transicao_invalida_solicitado_aguardando_agendamento`:
-- -- update public.gold_solicitacoes set estado = 'aguardando_agendamento'
-- --  where estado = 'solicitado';
--    E o caminho legítimo tem de passar:
-- -- update public.gold_solicitacoes set estado = 'aguardando_pagamento'
-- --  where estado = 'solicitado';
--    (Rode os dois numa transação que você dá `rollback` no fim.)
--
-- 5) Teste de fumaça de ponta a ponta, com o Asaas em sandbox: pagar uma
--    avaliação e conferir que a solicitação chegou a `aguardando_agendamento`
--    PASSANDO por `pago`. Se o webhook devolver 500 com
--    `transicao_invalida_…`, o código voltou a saltar e o trigger o pegou —
--    que é exatamente o serviço que ele presta:
-- select estado, atualizado_em from public.gold_solicitacoes
--  order by atualizado_em desc limit 1;
-- select tipo, resultado, detalhe from public.asaas_eventos
--  order by recebido_em desc limit 5;
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE,
-- passo 24 — inclui a válvula para conserto manual de estado.


-- ===========================================================================
-- CONFERÊNCIA DO LOTE — roda sozinha, depois das quatro transações
-- ===========================================================================
-- Compare com os valores comentados. Qualquer um fora do lugar: pare e leia o
-- passo correspondente em APLICAR-2026-08-19.md, seção QUINTO LOTE.
select
  (select count(*) from pg_policies
    where schemaname='public' and tablename='gold_solicitacoes' and cmd='INSERT'
      and with_check like '%estado%')                                    as insert_travado,      -- 1
  (select count(*) from pg_policies
    where schemaname='public' and tablename='gold_solicitacoes')         as pol_solicitacoes,    -- 2
  (select count(*) from pg_constraint
    where conname = 'gold_pagamentos_pago_com_carimbo')                  as check_carimbo,       -- 1
  (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid
    where t.relname='gold_pagamentos' and c.contype='c')                 as checks_pagamentos,   -- 3
  (select count(*) from pg_trigger t
     join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='assinaturas' and not t.tgisinternal)
                                                                         as trg_assinaturas,     -- 2
  (select count(*) from pg_trigger t
     join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='gold_solicitacoes' and not t.tgisinternal)
                                                                         as trg_solicitacoes,    -- 1
  (select public.gold_transicao_valida('aguardando_pagamento','aguardando_agendamento'))
                                                                         as salto_proibido,      -- false
  (select count(*) from public.gold_solicitacoes)                        as gold_solicitacoes,   -- 0
  (select count(*) from public.gold_pagamentos)                          as gold_pagamentos,     -- 0
  (select count(*) from public.assinaturas)                              as assinaturas,         -- 0
  (select count(*) from pg_policies where schemaname='public')           as policies,            -- 252
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%')
                                                                         as definer_sem_path,    -- 0
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity)  as sem_rls;            -- 0

-- `policies` continua 252 DE PROPÓSITO. Este lote não cria nem apaga policy: a
-- 085 recria uma com o MESMO nome, e as outras três são constraint e trigger.
-- Um 253 aqui significa que o `drop` da 085 não casou o nome e a policy antiga
-- sobreviveu ao lado da nova — o modo de falhar silencioso de que o bloco
-- `do $$` dela se defende. Se a trava trabalhou, este número não se move.

-- ============================================================================
-- 082 — As 24 policies que ainda reavaliam `auth.uid()` linha a linha
-- ============================================================================
-- FECHA: P2-2 (`auth_rls_initplan`) de docs/auditoria/2026-08-19-banco-e-rls.md,
--        item 11 da lista de ABERTOS de docs/auditoria/2026-08-19-fechamento.md
--
-- O PROBLEMA
-- ----------
-- `auth.uid()` é `STABLE`, não `IMMUTABLE`. Escrita solta dentro do predicado
-- de uma policy, o planner a trata como um filtro comum e a chama UMA VEZ POR
-- LINHA examinada. Envolvida num subselect — `(select auth.uid())` — ela vira
-- um InitPlan: o Postgres avalia uma vez, guarda o escalar e compara o
-- resultado contra cada linha. Em tabela de 6 linhas isso não se mede; em
-- `carteira_movimentos` ou `agenda_eventos` daqui a um ano, mede.
--
-- POR QUE ISTO NÃO MUDA SEMÂNTICA — e por que foi conferido UMA A UMA
-- ------------------------------------------------------------------
-- `auth.uid()` não recebe argumento e não lê nenhuma coluna da linha sendo
-- examinada: o valor que ela devolve é o mesmo em todas as linhas da mesma
-- consulta. Logo `x = auth.uid()` e `x = (select auth.uid())` produzem
-- exatamente o mesmo conjunto de linhas — a diferença é só QUANTAS VEZES a
-- função roda. Isso vale inclusive dentro dos `exists (...)` correlacionados
-- (`carteira_movimentos`, `envios_cotista`, `votos`, …): o subselect é
-- NÃO correlacionado, então ele sobe para InitPlan e a correlação do `exists`
-- externo continua intacta.
--
-- Ainda assim, as 24 expressões abaixo foram transcritas do `pg_policies` VIVO
-- (lido em 19/08/2026), não dos arquivos de migration — que divergem do
-- remoto. Cada uma é a expressão viva com `auth.uid()` trocado por
-- `(select auth.uid())` e NADA MAIS. Comparar com o antes é literalmente
-- diffar as duas colunas da consulta de conferência no rodapé.
--
-- POR QUE `alter policy` E NÃO `drop` + `create`
-- ----------------------------------------------
-- É a proteção contra o modo de falha silencioso desta classe de correção:
-- policy permissiva se SOMA (OR). Um `drop policy if exists` com o nome
-- ligeiramente errado não falha — ele não faz nada, a policy antiga (lenta,
-- ou pior, mais larga) continua viva, o `create` acrescenta uma segunda ao
-- lado, e o resultado é um banco com DUAS policies onde se pensava haver uma.
-- `alter policy` não tem essa saída: ou o nome existe e a expressão é trocada
-- no lugar, ou o comando ESTOURA com `policy ... does not exist`. Falha
-- barulhenta é o comportamento desejado aqui.
--
-- Consequência prática: esta migration NÃO é idempotente por omissão, e isso é
-- de propósito. Rodar duas vezes é inofensivo (a segunda reescreve o mesmo
-- texto). Rodar contra um banco onde alguém já renomeou uma policy FALHA na
-- linha errada, dentro da transação, e o `begin/commit` desfaz tudo — nenhuma
-- correção pela metade.
--
-- ORDEM E ACOPLAMENTO COM AS VIZINHAS
-- -----------------------------------
-- · Três das 24 são as policies `FOR ALL` de `bases_operacionais`,
--   `estoque_itens` e `tanques`, que a migration **083** vai apagar e recriar
--   já separadas por comando. Corrigi-las aqui mesmo assim é deliberado: as
--   duas migrations passam a valer sozinhas, em qualquer ordem, e rodar a 082
--   sem a 083 não deixa nenhuma das três para trás.
-- · Se a **084** for aplicada (apaga `bases_operacionais`), as duas policies
--   de `bases` desta migration morrem junto com a tabela. Sem conflito: a 084
--   é a última do lote.
--
-- IMPACTO NO ACESSO: ZERO. Nenhuma pessoa passa a ver, criar, corrigir ou
-- apagar nada que já não pudesse. Nenhum nome de policy muda; nenhum papel
-- (`roles`) muda — `alter policy` sem a cláusula `to` preserva os dois.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- agenda_eventos (4)
-- ---------------------------------------------------------------------------
alter policy "agenda: criar com permissao de gerenciar eventos"
  on public.agenda_eventos
  with check (
    (criado_por = (select auth.uid()))
    and permissao(embarcacao_id, 'agenda', 'editar')
  );

alter policy "agenda: so o criador altera"
  on public.agenda_eventos
  using (
    (criado_por = (select auth.uid()))
    and permissao(embarcacao_id, 'agenda', 'editar')
  )
  with check (
    (criado_por = (select auth.uid()))
    and permissao(embarcacao_id, 'agenda', 'editar')
  );

alter policy "agenda: so o criador exclui"
  on public.agenda_eventos
  using (
    (criado_por = (select auth.uid()))
    and permissao(embarcacao_id, 'agenda', 'editar')
  );

alter policy "agenda: ver o que e meu ou foi compartilhado comigo"
  on public.agenda_eventos
  using (
    permissao(embarcacao_id, 'agenda', 'ver')
    and ((criado_por = (select auth.uid())) or agenda_participa(id))
  );

-- ---------------------------------------------------------------------------
-- agenda_participantes (2)
-- ---------------------------------------------------------------------------
alter policy "agenda participantes: criador remove, participante sai"
  on public.agenda_participantes
  using ((usuario_id = (select auth.uid())) or agenda_dono(evento_id));

-- ATENÇÃO ao nome: ele TERMINA em "event", sem o "o" final. Não é erro de
-- digitação desta migration — é o nome vivo, truncado pelo limite de 63 bytes
-- do identificador do Postgres quando a policy foi criada. Escrever
-- "…do meu evento" aqui faria o `alter` estourar.
alter policy "agenda participantes: ver a minha linha ou a lista do meu event"
  on public.agenda_participantes
  using ((usuario_id = (select auth.uid())) or agenda_dono(evento_id));

-- ---------------------------------------------------------------------------
-- assinatura_parametros (1)
-- ---------------------------------------------------------------------------
alter policy "parametros de cobranca: autenticado ve"
  on public.assinatura_parametros
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- bases_operacionais (2) — ver nota de acoplamento com 083 e 084 no cabeçalho
-- ---------------------------------------------------------------------------
alter policy "bases: o dono escreve"
  on public.bases_operacionais
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));

alter policy "bases: o dono le"
  on public.bases_operacionais
  using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- carteira_movimentos (2)
-- ---------------------------------------------------------------------------
alter policy "movimentos: tripulante devolve, pendente de confirmacao"
  on public.carteira_movimentos
  with check (
    (tipo = 'devolucao')
    and (status = 'pendente')
    and exists (
      select 1 from public.carteiras c
       where c.id = carteira_movimentos.carteira_id
         and c.tripulante_id = (select auth.uid())
         and c.ativa
         and permissao(c.embarcacao_id, 'carteira', 'editar')
    )
  );

alter policy "movimentos: ver pela carteira"
  on public.carteira_movimentos
  using (
    exists (
      select 1 from public.carteiras c
       where c.id = carteira_movimentos.carteira_id
         and (
           eh_prop(c.embarcacao_id)
           or ((c.tripulante_id = (select auth.uid()))
               and permissao(c.embarcacao_id, 'carteira', 'ver'))
         )
    )
  );

-- ---------------------------------------------------------------------------
-- carteiras (1)
-- ---------------------------------------------------------------------------
alter policy "carteiras: prop ve as do barco, tripulante ve a dele"
  on public.carteiras
  using (
    eh_prop(embarcacao_id)
    or ((tripulante_id = (select auth.uid()))
        and permissao(embarcacao_id, 'carteira', 'ver'))
  );

-- ---------------------------------------------------------------------------
-- envios_cotista (2)
-- ---------------------------------------------------------------------------
alter policy "envios: cotista envia em nome proprio"
  on public.envios_cotista
  with check (
    (cotista_id = (select auth.uid()))
    and exists (
      select 1 from public.vinculos v
       where v.embarcacao_id = envios_cotista.embarcacao_id
         and v.usuario_id = (select auth.uid())
         and v.papel = 'COTISTA'
         and v.suspenso_em is null
    )
  );

alter policy "envios: o cotista le os proprios, o dono le todos"
  on public.envios_cotista
  using ((cotista_id = (select auth.uid())) or eh_prop(embarcacao_id));

-- ---------------------------------------------------------------------------
-- estoque_itens (2) — a de ALL é reescrita pela 083; ver cabeçalho
-- ---------------------------------------------------------------------------
alter policy "estoque: o dono escreve"
  on public.estoque_itens
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));

alter policy "estoque: o dono le"
  on public.estoque_itens
  using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- estoque_movimentos (1)
-- ---------------------------------------------------------------------------
alter policy "estoque_mov: dono do item le"
  on public.estoque_movimentos
  using (
    exists (
      select 1 from public.estoque_itens i
       where i.id = estoque_movimentos.item_id
         and i.dono_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- gold_consultores (1) — esta policy é ABSORVIDA pela 083 (vira
-- "gold_consultores: ver"). Corrigida aqui para a 082 valer sozinha.
-- ---------------------------------------------------------------------------
alter policy "gold_consultores: proprio perfil"
  on public.gold_consultores
  using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- gold_precos (1)
-- ---------------------------------------------------------------------------
alter policy "gold_precos: qualquer autenticado ve"
  on public.gold_precos
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- gold_solicitacoes (1)
-- ---------------------------------------------------------------------------
alter policy "gold_solicitacoes: criar"
  on public.gold_solicitacoes
  with check (
    (solicitante_id = (select auth.uid()))
    and (
      (embarcacao_id is not null
        and papel_solicitante = 'proprietario'
        and eh_prop(embarcacao_id))
      or (embarcacao_id is null
        and papel_solicitante = any (array['vendedor', 'interessado']))
    )
  );

-- ---------------------------------------------------------------------------
-- tanque_movimentos (1)
-- ---------------------------------------------------------------------------
alter policy "tanque_mov: dono do tanque le"
  on public.tanque_movimentos
  using (
    exists (
      select 1 from public.tanques t
       where t.id = tanque_movimentos.tanque_id
         and t.dono_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- tanques (2) — a de ALL é reescrita pela 083; ver cabeçalho
-- ---------------------------------------------------------------------------
alter policy "tanques: o dono escreve"
  on public.tanques
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));

alter policy "tanques: o dono le"
  on public.tanques
  using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- votos (1)
-- ---------------------------------------------------------------------------
alter policy "votos: cotista vota uma vez, em nome proprio"
  on public.votos
  with check (
    (votante_id = (select auth.uid()))
    and exists (
      select 1
        from public.votacoes vt
        join public.vinculos vi on vi.embarcacao_id = vt.embarcacao_id
       where vt.id = votos.votacao_id
         and vt.encerrada_em is null
         and vi.usuario_id = (select auth.uid())
         and vi.papel = 'COTISTA'
         and vi.suspenso_em is null
    )
  );

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A prova principal. Tem de voltar ZERO linhas — é a mesma consulta que
--    devolvia 24 antes:
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'public'
--    and (
--      (qual is not null and qual ~ 'auth\.uid\(\)'
--        and qual !~ '\( SELECT auth\.uid\(\)')
--      or (with_check is not null and with_check ~ 'auth\.uid\(\)'
--        and with_check !~ '\( SELECT auth\.uid\(\)')
--    )
--  order by tablename, policyname;
--
-- 2) Nenhuma policy nasceu nem sumiu — tem de voltar o MESMO número de antes
--    (225 em 19/08/2026, medido na reauditoria):
-- select count(*) from pg_policies where schemaname = 'public';
--
-- 3) As 24 continuam com o mesmo comando e os mesmos papéis. Tem de voltar 24,
--    e nenhuma linha com `cmd`/`roles` diferente do que está na coluna
--    "esperado" do QUARTO LOTE em APLICAR-2026-08-19.md:
-- select tablename, policyname, cmd, roles::text from pg_policies
--  where schemaname = 'public'
--    and (qual ~ '\( SELECT auth\.uid\(\)'
--         or with_check ~ '\( SELECT auth\.uid\(\)')
--    and tablename in ('agenda_eventos','agenda_participantes',
--      'assinatura_parametros','bases_operacionais','carteira_movimentos',
--      'carteiras','envios_cotista','estoque_itens','estoque_movimentos',
--      'gold_consultores','gold_precos','gold_solicitacoes','tanque_movimentos',
--      'tanques','votos')
--  order by tablename, policyname;
--
-- 4) O advisor de performance do Supabase deixa de listar `auth_rls_initplan`
--    para `public`. (Advisors → Performance. Se ainda aparecer, é cache: force
--    a recarga.)
--
-- 5) Teste de fumaça, com login real — o objetivo é provar que NADA mudou:
--    abrir /agenda (ver e criar um evento), /carteira (ver a própria),
--    /estoque e /combustivel (listar) e /mecanica (votar). Tudo tem de se
--    comportar exatamente como antes desta migration.
--
-- REVERSÃO: repetir os 24 `alter policy` acima trocando `(select auth.uid())`
-- de volta por `auth.uid()`. O texto exato de cada expressão ANTES está
-- registrado em APLICAR-2026-08-19.md, QUARTO LOTE, passo 17.

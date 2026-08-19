-- ===========================================================================
-- COMMANDER — QUARTO (e último) LOTE, 19/08/2026
--
-- Cole INTEIRO no SQL Editor do Supabase e rode. A conferência sai no fim.
--
-- SÃO TRÊS TRANSAÇÕES, NÃO UMA, e isso é de propósito: cada migration abre e
-- fecha a sua. Se a do meio falhar, a primeira já está gravada e a terceira
-- não chega a rodar — em vez de perder o lote inteiro por causa de um passo.
--
-- A ORDEM IMPORTA e elas já estão na ordem certa aqui, não reordene: a 083
-- ainda precisa enxergar `bases_operacionais`, que a 084 apaga.
--
-- ---------------------------------------------------------------------------
-- O QUE CADA UMA FAZ
-- ---------------------------------------------------------------------------
-- 082  As policies paravam pra perguntar "quem é você?" UMA VEZ POR LINHA
--      lida. Passam a perguntar uma vez por consulta. Nenhuma regra de acesso
--      muda — só quantas vezes ela é calculada.
--
-- 083  15 policies `FOR ALL` que casavam junto com as de SELECT: toda leitura
--      avaliava as duas e somava com OR, sem que a segunda acrescentasse uma
--      linha sequer. Viram INSERT/UPDATE/DELETE explícitos. Outras 3 ficam
--      `FOR ALL` de propósito — em `convites`, `transferencias` e
--      `push_assinaturas` elas são o ÚNICO caminho de leitura, e separar
--      apagaria esse caminho.
--
-- 084  DESTRUTIVA. Apaga `bases_operacionais` e as duas colunas `base_id` que
--      apontavam pra ela. A tabela tem 0 linhas, 0 referências no app e
--      nenhuma chave preenchida — nunca foi usada. Ela se recusa a rodar se
--      qualquer uma dessas três coisas mudar: o bloco no topo levanta exceção
--      e desfaz tudo. Isso APOSENTA a migration 073, que ficou esperando
--      decisão sua — as duas são mutuamente exclusivas.
--
-- ---------------------------------------------------------------------------
-- IMPACTO NO ACESSO: ZERO. Ninguém ganha nem perde permissão. Nenhuma linha
-- de dado é lida, escrita ou movida — exceto as duas colunas vazias que a 084
-- apaga.
--
-- SE ALGO DER ERRADO: a reversão de cada uma está escrita em
-- supabase/migrations/APLICAR-2026-08-19.md, seção QUARTO LOTE.
-- ===========================================================================




-- ###########################################################################
-- ### 082_policies_auth_uid_uma_vez_por_consulta.sql
-- ###########################################################################

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


-- ###########################################################################
-- ### 083_policies_for_all_separadas_por_comando.sql
-- ###########################################################################

-- ============================================================================
-- 083 — As policies `FOR ALL` param de casar junto com as de SELECT
-- ============================================================================
-- FECHA: P2-3 (`multiple_permissive_policies`) de
--        docs/auditoria/2026-08-19-banco-e-rls.md, item 12 da lista de ABERTOS
--        de docs/auditoria/2026-08-19-fechamento.md
--
-- O PROBLEMA
-- ----------
-- Uma policy `FOR ALL` cobre os quatro comandos — inclusive SELECT. Quando a
-- mesma tabela também tem uma policy de SELECT, TODA leitura passa a avaliar
-- as duas e a somar os resultados com OR, porque policy permissiva se soma. O
-- segundo predicado nunca acrescenta uma linha (a de SELECT já é a mais larga
-- das duas em todos os casos deste arquivo) e mesmo assim roda em cima de cada
-- linha lida. É trabalho pago sem nada em troca.
--
-- A correção é separar o `FOR ALL` em `INSERT` / `UPDATE` / `DELETE`
-- explícitos, deixando o SELECT sozinho.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION, ESCRITO ANTES DE QUALQUER COMANDO
-- ============================================================================
-- Desfazer um `FOR ALL` sem cobrir os quatro comandos TIRA ACESSO, e tira em
-- silêncio: RLS não recusa a consulta, ela devolve `[]` com `error: null`.
-- Quem perdeu leitura lê "não há nada" em vez de "não posso ver".
--
-- Há DUAS formas de perder acesso aqui, e as duas foram fechadas uma a uma:
--
--   (a) Perder o SELECT. O `FOR ALL` também era o caminho de LEITURA de quem
--       ele autorizava. Ao separá-lo em I/U/D, essa leitura só sobrevive se
--       a policy de SELECT que fica já cobrir a mesma gente. Foi verificado
--       tabela a tabela abaixo, contra a definição VIVA (`pg_policies` e
--       `pg_get_functiondef`, lidos em 19/08/2026) — não contra os arquivos
--       de migration, que divergem do remoto.
--
--   (b) Perder o UPDATE/DELETE por tabela de tirar leitura. Um
--       `update ... where` ou `delete ... where` precisa LER as linhas para
--       localizá-las, e com RLS ligada essa leitura passa pela policy de
--       SELECT. Ou seja: separar o `FOR ALL` só é seguro se o predicado de
--       escrita continuar IMPLICADO por alguma policy de SELECT. Se não
--       estiver, o admin mantém a policy de UPDATE e mesmo assim não consegue
--       atualizar nada, porque o `where` não acha a linha. É a mesma prova de
--       (a), e é por isso que ela é suficiente para as duas.
--
-- A prova exigida, portanto, é sempre a mesma frase: **o predicado do
-- `FOR ALL` é um subconjunto do predicado de alguma policy de SELECT viva.**
-- Onde ela não valeu (só `gold_consultores`), o SELECT foi consolidado ANTES
-- de separar — nunca o contrário.
--
-- ============================================================================
-- AS 15 QUE MUDAM — quem perde o quê, uma a uma
-- ============================================================================
--
--  1. admin_papel_regioes · ALL "admin_papel_regioes: só o CEO define" = `eh_ceo()`
--     SELECT vivo: `eh_ceo() OR exists(admin_papeis p where p.id = papel_id
--     and p.usuario_id = (select auth.uid()))`. O CEO está no primeiro ramo,
--     literalmente a mesma chamada. NINGUÉM PERDE NADA. (0 linhas na tabela.)
--
--  2. bases_operacionais · ALL "bases: o dono escreve" = `dono_id = auth.uid()`
--     SELECT vivo "bases: o dono le" = `dono_id = auth.uid()`. Predicado
--     IDÊNTICO, caractere por caractere. NINGUÉM PERDE NADA. (0 linhas.)
--     Ver a 084: se ela for aplicada, esta tabela deixa de existir.
--
--  3. estoque_itens · ALL "estoque: o dono escreve" = `dono_id = auth.uid()`
--     SELECT vivo "estoque: o dono le" = idêntico. NINGUÉM PERDE NADA.
--     (6 linhas, todas com `dono_id` preenchido — nenhuma sai do alcance.)
--
--  4. gold_consultores · ALL "gold_consultores: suporte gerencia" =
--     `tem_papel_admin('suporte')`.
--     ESTE É O ÚNICO CASO EM QUE A SEPARAÇÃO PURA TIRARIA ACESSO. Os dois
--     SELECT vivos são "proprio perfil" (`usuario_id = auth.uid()`) e "ligado
--     ao meu agendamento" (`exists(gold_agendamentos ag where ag.consultor_id
--     = id and gold_visivel(ag.solicitacao_id))`). `gold_visivel` de fato
--     contém `tem_papel_admin('suporte')` — mas ela só é alcançada por dentro
--     de um `exists` sobre `gold_agendamentos`. Consequência: hoje o Suporte
--     enxerga um consultor SE E SOMENTE SE aquele consultor já tiver pelo
--     menos um agendamento. Um consultor recém-cadastrado, sem agendamento,
--     é invisível para o Suporte pelas policies de SELECT — só o `FOR ALL`
--     o mostrava. Separar sem mais nada quebraria a listagem de consultores
--     no admin e, por (b), impediria o próprio Suporte de EDITAR ou APAGAR
--     um consultor sem agendamento.
--     POR ISSO: os dois SELECT são consolidados numa policy única,
--     "gold_consultores: ver", que é o OR dos TRÊS predicados — o do Suporte
--     incluído. O conjunto visível é exatamente o mesmo de antes (união
--     inalterada), e as três policies permissivas de leitura viram uma.
--     NINGUÉM PERDE NADA. (0 linhas.)
--
--  5. gold_protocolo_itens · ALL "gold_protocolo_itens: escrever" =
--     `tem_papel_admin('suporte') OR gold_consultor_atribuido_avaliacao(av)
--      OR vistoriador_ve_regiao(gold_regiao_avaliacao(av))`
--     SELECT vivo "ver" = `gold_visivel_avaliacao(av)`, que expande (lido em
--     `pg_get_functiondef`) para, sobre a solicitação `s` da avaliação:
--     `tem_papel_admin('suporte') OR vistoriador_ve_regiao(s.regiao_id)
--      OR s.solicitante_id = uid OR eh_prop(s.embarcacao_id)
--      OR exists(agendamento cujo consultor sou eu)`.
--     Ramo a ramo:
--       · `tem_papel_admin('suporte')` — presente nos dois, idêntico.
--       · `vistoriador_ve_regiao(gold_regiao_avaliacao(av))` —
--         `gold_regiao_avaliacao(av)` é, por definição, o `s.regiao_id` da
--         solicitação da avaliação. As duas expressões são a MESMA chamada.
--       · `gold_consultor_atribuido_avaliacao(av)` delega a
--         `gold_consultor_atribuido(a.solicitacao_id)`, cujo corpo é
--         `exists(gold_agendamentos ag join gold_consultores c ...
--          where ag.solicitacao_id = ... and c.usuario_id = auth.uid())` —
--         palavra por palavra o quinto ramo de `gold_visivel`.
--     Os dois lados partem da mesma pré-condição (a avaliação existir). Logo
--     ALL ⊆ SELECT. NINGUÉM PERDE NADA. (0 linhas.)
--
--  6. gold_selos · ALL "gold_selos: suporte escreve" = `tem_papel_admin('suporte')`
--     SELECT vivo = `tem_papel_admin('suporte') OR pode_ver_embarcacao(...)`.
--     Primeiro ramo idêntico. NINGUÉM PERDE NADA. (0 linhas.)
--
--  7-10. motor_componentes, motor_fabricantes, motor_familias, motor_modelos
--     ALL = `eh_admin()` `to authenticated`; SELECT = `true` `to authenticated`.
--     Quem é admin é, necessariamente, autenticado. O SELECT é o predicado
--     mais largo que existe. NINGUÉM PERDE NADA. (144 linhas em
--     `motor_componentes`, todas legíveis por qualquer logado, antes e depois.)
--
--  11-13. parceiro_acomodacoes, parceiro_atividades, parceiro_vagas
--     ALL = `exists(parceiros p where p.id = parceiro_id and p.usuario_id = uid)`
--     SELECT = `exists(parceiros p where p.id = parceiro_id and (p.visivel
--               or p.usuario_id = uid))`.
--     O SELECT é o mesmo predicado com um `or p.visivel` a mais — estritamente
--     mais largo. O dono do parceiro continua lendo pelo segundo ramo, esteja
--     o parceiro visível ou não. NINGUÉM PERDE NADA. (0 linhas nas três.)
--
--  14. tanques · ALL "tanques: o dono escreve" = `dono_id = auth.uid()`
--     SELECT vivo "tanques: o dono le" = idêntico. NINGUÉM PERDE NADA.
--     (5 linhas, todas com `dono_id` preenchido.)
--
--  15. taxonomia · ALL "taxonomia: só admin escreve" = `eh_admin()`
--     SELECT vivo = `true` `to authenticated`. NINGUÉM PERDE NADA.
--     (63 linhas, legíveis por qualquer logado antes e depois.)
--
-- ============================================================================
-- AS 3 QUE **NÃO** MUDAM — e por quê
-- ============================================================================
-- `convites` ("convites: prop gerencia"), `push_assinaturas` ("push:
-- proprias") e `transferencias` ("transferencias: prop gerencia") também são
-- `FOR ALL`, e a auditoria as contou dentro dos 18. Elas ficam EXATAMENTE como
-- estão, por um motivo que inverte o argumento:
--
--   nas três, o `FOR ALL` é a ÚNICA policy da tabela.
--
-- Verificado: `select count(*) from pg_policies where tablename = …` devolve 1
-- para cada. Sem uma segunda policy, não existe sobreposição — não há duas
-- permissivas casando junto, e portanto não há nada a otimizar. O que existiria
-- se as tocássemos seria só estrago: separar em I/U/D apagaria o único caminho
-- de leitura de `convites` (o PROP deixaria de ver os próprios convites), de
-- `transferencias` (idem) e de `push_assinaturas` (o dispositivo deixaria de
-- ler a própria inscrição de push, quebrando a renovação da assinatura).
--
-- A contagem honesta, então, é: dos 18 `FOR ALL` vivos, **15 se sobrepõem a
-- uma policy de SELECT e são separados aqui; 3 não se sobrepõem a nada e
-- continuam `FOR ALL` de propósito.**
--
-- ============================================================================
-- COMO ESTE ARQUIVO SE PROTEGE DO ERRO DE NOME
-- ============================================================================
-- Policy permissiva se SOMA. Um `drop policy if exists` com o nome ligeiramente
-- errado não falha: ele não faz nada, a policy `FOR ALL` antiga continua viva,
-- as novas entram ao lado, e a correção fica anulada em silêncio — com uma
-- policy A MAIS do que antes. Dois nomes deste arquivo carregam acento
-- (`"admin_papel_regioes: só o CEO define"` e `"taxonomia: só admin escreve"`)
-- e são exatamente onde esse erro nasceria.
--
-- Por isso o `commit` só é alcançado depois de um bloco `do $$` que reconta o
-- catálogo e **levanta exceção** se sobrar qualquer `FOR ALL` nas 15 tabelas,
-- se `gold_consultores` não terminar com exatamente uma policy de SELECT, ou
-- se as 3 intocadas tiverem perdido a delas. Nome errado deixa de ser um
-- silêncio e vira um erro que desfaz a transação inteira.
--
-- Idempotente: todo `drop` é `if exists` e a reconta roda igual na segunda vez.
--
-- IMPACTO NO ACESSO: ZERO, pelas 15 provas acima. Nenhuma linha muda de dono,
-- nenhuma coluna é tocada, nenhum dado é lido ou escrito.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. admin_papel_regioes — o CEO define
-- ---------------------------------------------------------------------------
drop policy if exists "admin_papel_regioes: só o CEO define" on public.admin_papel_regioes;
drop policy if exists "admin_papel_regioes: só o CEO cria"    on public.admin_papel_regioes;
drop policy if exists "admin_papel_regioes: só o CEO corrige" on public.admin_papel_regioes;
drop policy if exists "admin_papel_regioes: só o CEO apaga"   on public.admin_papel_regioes;

create policy "admin_papel_regioes: só o CEO cria" on public.admin_papel_regioes
  for insert to authenticated with check (eh_ceo());
create policy "admin_papel_regioes: só o CEO corrige" on public.admin_papel_regioes
  for update to authenticated using (eh_ceo()) with check (eh_ceo());
create policy "admin_papel_regioes: só o CEO apaga" on public.admin_papel_regioes
  for delete to authenticated using (eh_ceo());

-- ---------------------------------------------------------------------------
-- 2. bases_operacionais — o dono escreve
-- ---------------------------------------------------------------------------
drop policy if exists "bases: o dono escreve" on public.bases_operacionais;
drop policy if exists "bases: o dono cria"    on public.bases_operacionais;
drop policy if exists "bases: o dono corrige" on public.bases_operacionais;
drop policy if exists "bases: o dono apaga"   on public.bases_operacionais;

create policy "bases: o dono cria" on public.bases_operacionais
  for insert to authenticated with check (dono_id = (select auth.uid()));
create policy "bases: o dono corrige" on public.bases_operacionais
  for update to authenticated
  using (dono_id = (select auth.uid())) with check (dono_id = (select auth.uid()));
create policy "bases: o dono apaga" on public.bases_operacionais
  for delete to authenticated using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. estoque_itens — o dono escreve
-- ---------------------------------------------------------------------------
drop policy if exists "estoque: o dono escreve" on public.estoque_itens;
drop policy if exists "estoque: o dono cria"    on public.estoque_itens;
drop policy if exists "estoque: o dono corrige" on public.estoque_itens;
drop policy if exists "estoque: o dono apaga"   on public.estoque_itens;

create policy "estoque: o dono cria" on public.estoque_itens
  for insert to authenticated with check (dono_id = (select auth.uid()));
create policy "estoque: o dono corrige" on public.estoque_itens
  for update to authenticated
  using (dono_id = (select auth.uid())) with check (dono_id = (select auth.uid()));
create policy "estoque: o dono apaga" on public.estoque_itens
  for delete to authenticated using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. gold_consultores — CONSOLIDA a leitura ANTES de separar a escrita
-- ---------------------------------------------------------------------------
-- A ORDEM AQUI É A CORREÇÃO. A policy de leitura nova nasce PRIMEIRO, com o
-- ramo do Suporte dentro dela; só depois o `FOR ALL` que carregava esse ramo
-- é apagado. Invertido, haveria uma janela (dentro da transação, mas ainda
-- assim) em que o Suporte não enxergaria consultor sem agendamento.
drop policy if exists "gold_consultores: ver" on public.gold_consultores;

create policy "gold_consultores: ver" on public.gold_consultores
  for select to public
  using (
    -- ramo 1: o que vinha do `FOR ALL` "suporte gerencia" (e que NENHUMA das
    -- duas policies de SELECT antigas cobria para consultor sem agendamento)
    tem_papel_admin('suporte')
    -- ramo 2: "gold_consultores: proprio perfil", palavra por palavra
    or (usuario_id = (select auth.uid()))
    -- ramo 3: "gold_consultores: ligado ao meu agendamento", palavra por palavra
    or exists (
      select 1 from public.gold_agendamentos ag
       where ag.consultor_id = gold_consultores.id
         and gold_visivel(ag.solicitacao_id)
    )
  );

drop policy if exists "gold_consultores: ligado ao meu agendamento" on public.gold_consultores;
drop policy if exists "gold_consultores: proprio perfil"            on public.gold_consultores;
drop policy if exists "gold_consultores: suporte gerencia"          on public.gold_consultores;
drop policy if exists "gold_consultores: suporte cria"              on public.gold_consultores;
drop policy if exists "gold_consultores: suporte corrige"           on public.gold_consultores;
drop policy if exists "gold_consultores: suporte apaga"             on public.gold_consultores;

create policy "gold_consultores: suporte cria" on public.gold_consultores
  for insert to authenticated with check (tem_papel_admin('suporte'));
create policy "gold_consultores: suporte corrige" on public.gold_consultores
  for update to authenticated
  using (tem_papel_admin('suporte')) with check (tem_papel_admin('suporte'));
create policy "gold_consultores: suporte apaga" on public.gold_consultores
  for delete to authenticated using (tem_papel_admin('suporte'));

-- ---------------------------------------------------------------------------
-- 5. gold_protocolo_itens — escrever
-- ---------------------------------------------------------------------------
drop policy if exists "gold_protocolo_itens: escrever" on public.gold_protocolo_itens;
drop policy if exists "gold_protocolo_itens: criar"    on public.gold_protocolo_itens;
drop policy if exists "gold_protocolo_itens: corrigir" on public.gold_protocolo_itens;
drop policy if exists "gold_protocolo_itens: apagar"   on public.gold_protocolo_itens;

create policy "gold_protocolo_itens: criar" on public.gold_protocolo_itens
  for insert to authenticated
  with check (
    tem_papel_admin('suporte')
    or gold_consultor_atribuido_avaliacao(avaliacao_id)
    or vistoriador_ve_regiao(gold_regiao_avaliacao(avaliacao_id))
  );
create policy "gold_protocolo_itens: corrigir" on public.gold_protocolo_itens
  for update to authenticated
  using (
    tem_papel_admin('suporte')
    or gold_consultor_atribuido_avaliacao(avaliacao_id)
    or vistoriador_ve_regiao(gold_regiao_avaliacao(avaliacao_id))
  )
  with check (
    tem_papel_admin('suporte')
    or gold_consultor_atribuido_avaliacao(avaliacao_id)
    or vistoriador_ve_regiao(gold_regiao_avaliacao(avaliacao_id))
  );
create policy "gold_protocolo_itens: apagar" on public.gold_protocolo_itens
  for delete to authenticated
  using (
    tem_papel_admin('suporte')
    or gold_consultor_atribuido_avaliacao(avaliacao_id)
    or vistoriador_ve_regiao(gold_regiao_avaliacao(avaliacao_id))
  );

-- ---------------------------------------------------------------------------
-- 6. gold_selos — suporte escreve
-- ---------------------------------------------------------------------------
drop policy if exists "gold_selos: suporte escreve" on public.gold_selos;
drop policy if exists "gold_selos: suporte cria"    on public.gold_selos;
drop policy if exists "gold_selos: suporte corrige" on public.gold_selos;
drop policy if exists "gold_selos: suporte apaga"   on public.gold_selos;

create policy "gold_selos: suporte cria" on public.gold_selos
  for insert to authenticated with check (tem_papel_admin('suporte'));
create policy "gold_selos: suporte corrige" on public.gold_selos
  for update to authenticated
  using (tem_papel_admin('suporte')) with check (tem_papel_admin('suporte'));
create policy "gold_selos: suporte apaga" on public.gold_selos
  for delete to authenticated using (tem_papel_admin('suporte'));

-- ---------------------------------------------------------------------------
-- 7. motor_componentes — so admin escreve
-- ---------------------------------------------------------------------------
drop policy if exists "motor_componentes: so admin escreve" on public.motor_componentes;
drop policy if exists "motor_componentes: so admin cria"    on public.motor_componentes;
drop policy if exists "motor_componentes: so admin corrige" on public.motor_componentes;
drop policy if exists "motor_componentes: so admin apaga"   on public.motor_componentes;

create policy "motor_componentes: so admin cria" on public.motor_componentes
  for insert to authenticated with check (eh_admin());
create policy "motor_componentes: so admin corrige" on public.motor_componentes
  for update to authenticated using (eh_admin()) with check (eh_admin());
create policy "motor_componentes: so admin apaga" on public.motor_componentes
  for delete to authenticated using (eh_admin());

-- ---------------------------------------------------------------------------
-- 8. motor_fabricantes — so admin escreve
-- ---------------------------------------------------------------------------
drop policy if exists "motor_fabricantes: so admin escreve" on public.motor_fabricantes;
drop policy if exists "motor_fabricantes: so admin cria"    on public.motor_fabricantes;
drop policy if exists "motor_fabricantes: so admin corrige" on public.motor_fabricantes;
drop policy if exists "motor_fabricantes: so admin apaga"   on public.motor_fabricantes;

create policy "motor_fabricantes: so admin cria" on public.motor_fabricantes
  for insert to authenticated with check (eh_admin());
create policy "motor_fabricantes: so admin corrige" on public.motor_fabricantes
  for update to authenticated using (eh_admin()) with check (eh_admin());
create policy "motor_fabricantes: so admin apaga" on public.motor_fabricantes
  for delete to authenticated using (eh_admin());

-- ---------------------------------------------------------------------------
-- 9. motor_familias — so admin escreve
-- ---------------------------------------------------------------------------
drop policy if exists "motor_familias: so admin escreve" on public.motor_familias;
drop policy if exists "motor_familias: so admin cria"    on public.motor_familias;
drop policy if exists "motor_familias: so admin corrige" on public.motor_familias;
drop policy if exists "motor_familias: so admin apaga"   on public.motor_familias;

create policy "motor_familias: so admin cria" on public.motor_familias
  for insert to authenticated with check (eh_admin());
create policy "motor_familias: so admin corrige" on public.motor_familias
  for update to authenticated using (eh_admin()) with check (eh_admin());
create policy "motor_familias: so admin apaga" on public.motor_familias
  for delete to authenticated using (eh_admin());

-- ---------------------------------------------------------------------------
-- 10. motor_modelos — so admin escreve
-- ---------------------------------------------------------------------------
drop policy if exists "motor_modelos: so admin escreve" on public.motor_modelos;
drop policy if exists "motor_modelos: so admin cria"    on public.motor_modelos;
drop policy if exists "motor_modelos: so admin corrige" on public.motor_modelos;
drop policy if exists "motor_modelos: so admin apaga"   on public.motor_modelos;

create policy "motor_modelos: so admin cria" on public.motor_modelos
  for insert to authenticated with check (eh_admin());
create policy "motor_modelos: so admin corrige" on public.motor_modelos
  for update to authenticated using (eh_admin()) with check (eh_admin());
create policy "motor_modelos: so admin apaga" on public.motor_modelos
  for delete to authenticated using (eh_admin());

-- ---------------------------------------------------------------------------
-- 11. parceiro_acomodacoes — só a pousada cadastra as suas
-- ---------------------------------------------------------------------------
drop policy if exists "acomodacoes: so a pousada cadastra as suas" on public.parceiro_acomodacoes;
drop policy if exists "acomodacoes: a pousada cria"    on public.parceiro_acomodacoes;
drop policy if exists "acomodacoes: a pousada corrige" on public.parceiro_acomodacoes;
drop policy if exists "acomodacoes: a pousada apaga"   on public.parceiro_acomodacoes;

create policy "acomodacoes: a pousada cria" on public.parceiro_acomodacoes
  for insert to authenticated
  with check (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_acomodacoes.parceiro_id
       and p.usuario_id = (select auth.uid())));
create policy "acomodacoes: a pousada corrige" on public.parceiro_acomodacoes
  for update to authenticated
  using (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_acomodacoes.parceiro_id
       and p.usuario_id = (select auth.uid())))
  with check (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_acomodacoes.parceiro_id
       and p.usuario_id = (select auth.uid())));
create policy "acomodacoes: a pousada apaga" on public.parceiro_acomodacoes
  for delete to authenticated
  using (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_acomodacoes.parceiro_id
       and p.usuario_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 12. parceiro_atividades — só o dono declara as suas
-- ---------------------------------------------------------------------------
drop policy if exists "atividades: so o dono declara as suas" on public.parceiro_atividades;
drop policy if exists "atividades: o dono cria"    on public.parceiro_atividades;
drop policy if exists "atividades: o dono corrige" on public.parceiro_atividades;
drop policy if exists "atividades: o dono apaga"   on public.parceiro_atividades;

create policy "atividades: o dono cria" on public.parceiro_atividades
  for insert to authenticated
  with check (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_atividades.parceiro_id
       and p.usuario_id = (select auth.uid())));
create policy "atividades: o dono corrige" on public.parceiro_atividades
  for update to authenticated
  using (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_atividades.parceiro_id
       and p.usuario_id = (select auth.uid())))
  with check (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_atividades.parceiro_id
       and p.usuario_id = (select auth.uid())));
create policy "atividades: o dono apaga" on public.parceiro_atividades
  for delete to authenticated
  using (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_atividades.parceiro_id
       and p.usuario_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 13. parceiro_vagas — só a marina declara as suas
-- ---------------------------------------------------------------------------
drop policy if exists "vagas: so a marina declara as suas" on public.parceiro_vagas;
drop policy if exists "vagas: a marina cria"    on public.parceiro_vagas;
drop policy if exists "vagas: a marina corrige" on public.parceiro_vagas;
drop policy if exists "vagas: a marina apaga"   on public.parceiro_vagas;

create policy "vagas: a marina cria" on public.parceiro_vagas
  for insert to authenticated
  with check (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_vagas.parceiro_id
       and p.usuario_id = (select auth.uid())));
create policy "vagas: a marina corrige" on public.parceiro_vagas
  for update to authenticated
  using (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_vagas.parceiro_id
       and p.usuario_id = (select auth.uid())))
  with check (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_vagas.parceiro_id
       and p.usuario_id = (select auth.uid())));
create policy "vagas: a marina apaga" on public.parceiro_vagas
  for delete to authenticated
  using (exists (
    select 1 from public.parceiros p
     where p.id = parceiro_vagas.parceiro_id
       and p.usuario_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 14. tanques — o dono escreve
-- ---------------------------------------------------------------------------
drop policy if exists "tanques: o dono escreve" on public.tanques;
drop policy if exists "tanques: o dono cria"    on public.tanques;
drop policy if exists "tanques: o dono corrige" on public.tanques;
drop policy if exists "tanques: o dono apaga"   on public.tanques;

create policy "tanques: o dono cria" on public.tanques
  for insert to authenticated with check (dono_id = (select auth.uid()));
create policy "tanques: o dono corrige" on public.tanques
  for update to authenticated
  using (dono_id = (select auth.uid())) with check (dono_id = (select auth.uid()));
create policy "tanques: o dono apaga" on public.tanques
  for delete to authenticated using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 15. taxonomia — só admin escreve
-- ---------------------------------------------------------------------------
drop policy if exists "taxonomia: só admin escreve" on public.taxonomia;
drop policy if exists "taxonomia: só admin cria"    on public.taxonomia;
drop policy if exists "taxonomia: só admin corrige" on public.taxonomia;
drop policy if exists "taxonomia: só admin apaga"   on public.taxonomia;

create policy "taxonomia: só admin cria" on public.taxonomia
  for insert to authenticated with check (eh_admin());
create policy "taxonomia: só admin corrige" on public.taxonomia
  for update to authenticated using (eh_admin()) with check (eh_admin());
create policy "taxonomia: só admin apaga" on public.taxonomia
  for delete to authenticated using (eh_admin());

-- ---------------------------------------------------------------------------
-- TRAVA — nada disto passa se um `drop` não tiver casado o nome vivo
-- ---------------------------------------------------------------------------
do $$
declare
  v_all int;
  v_sel int;
  v_intocadas int;
begin
  -- (i) nenhuma das 15 pode ter sobrado com `FOR ALL`. Se sobrou, um
  --     `drop policy if exists` não achou o nome — e a policy antiga está
  --     viva ao lado das novas, somando por OR e anulando a correção.
  select count(*) into v_all
    from pg_policies
   where schemaname = 'public' and cmd = 'ALL'
     and tablename in (
       'admin_papel_regioes','bases_operacionais','estoque_itens',
       'gold_consultores','gold_protocolo_itens','gold_selos',
       'motor_componentes','motor_fabricantes','motor_familias','motor_modelos',
       'parceiro_acomodacoes','parceiro_atividades','parceiro_vagas',
       'tanques','taxonomia');
  if v_all <> 0 then
    raise exception
      'ABORTADO: sobraram % policies FOR ALL nas 15 tabelas. Algum drop nao casou o nome vivo (suspeite dos dois com acento: "admin_papel_regioes: so o CEO define" e "taxonomia: so admin escreve"). Rode: select tablename, policyname from pg_policies where schemaname=''public'' and cmd=''ALL'';',
      v_all;
  end if;

  -- (ii) gold_consultores tem de terminar com UMA policy de SELECT — a
  --      consolidada. Duas significaria que uma das antigas ficou viva.
  select count(*) into v_sel
    from pg_policies
   where schemaname = 'public' and cmd = 'SELECT' and tablename = 'gold_consultores';
  if v_sel <> 1 then
    raise exception
      'ABORTADO: gold_consultores ficou com % policies de SELECT (esperado exatamente 1: "gold_consultores: ver").',
      v_sel;
  end if;

  -- (iii) as 3 deliberadamente intocadas continuam com o `FOR ALL` delas. Se
  --       alguma sumiu, alguém tirou o unico caminho de leitura da tabela.
  select count(*) into v_intocadas
    from pg_policies
   where schemaname = 'public' and cmd = 'ALL'
     and tablename in ('convites','push_assinaturas','transferencias');
  if v_intocadas <> 3 then
    raise exception
      'ABORTADO: convites/push_assinaturas/transferencias deveriam manter 3 policies FOR ALL e tem %. Elas NAO fazem parte desta migration.',
      v_intocadas;
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) Sobram EXATAMENTE 3 policies `FOR ALL` em `public`, e são as três
--    intocadas. Qualquer outra linha aqui é um drop que não pegou:
-- select tablename, policyname from pg_policies
--  where schemaname = 'public' and cmd = 'ALL' order by tablename;
--    Esperado, nesta ordem:
--      convites          | convites: prop gerencia
--      push_assinaturas  | push: proprias
--      transferencias    | transferencias: prop gerencia
--
-- 2) Nenhuma tabela de `public` tem mais de uma policy PERMISSIVA valendo
--    para SELECT no mesmo papel, por causa de um `FOR ALL`. Esta consulta
--    expande o `ALL` nos quatro comandos, como o planner faz. Depois da
--    083 nenhuma das 15 pode aparecer:
-- with expandido as (
--   select p.tablename, unnest(p.roles) as rol,
--          case when p.cmd = 'ALL' then c.c else p.cmd end as comando,
--          p.policyname
--     from pg_policies p
--     cross join lateral (select unnest(array['SELECT','INSERT','UPDATE','DELETE']) as c) c
--    where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
--      and (p.cmd = 'ALL' or c.c = p.cmd)
-- )
-- select tablename, rol, count(*) qtd,
--        string_agg(policyname, ' ;; ' order by policyname)
--   from expandido where comando = 'SELECT'
--  group by 1, 2 having count(*) > 1 order by 1;
--    Antes da 083 esta consulta devolvia 17 linhas. Depois tem de devolver 3,
--    e SÓ estas — são sobreposições de SELECT × SELECT, que não têm `FOR ALL`
--    nenhum e estão FORA do escopo deste arquivo:
--      assinaturas  | authenticated | assinatura: suporte enxerga status ;; assinatura: ver a propria
--      embarcacoes  | public        | embarcacao: consultor atribuido em avaliacao gold ;; embarcacao: ver
--      parceiros    | authenticated | parceiro: comercial ve todos ;; parceiro: ver visiveis ou o proprio
--    `gold_consultores` desaparece da lista — se ainda estiver, o passo (ii)
--    da trava foi burlado. (`gold_protocolo_itens` nunca apareceu nela: o
--    `FOR ALL` dele é `to authenticated` e o SELECT é `to public`, e a
--    consulta agrupa por papel declarado. A sobreposição existia de verdade
--    em tempo de execução — `public` alcança `authenticated` — e some junto.)
--
-- 3) Contagem total de policies em `public`. A conta é fechada:
--      −15  os 15 `FOR ALL` separados
--      − 2  as duas de SELECT de `gold_consultores`, consolidadas
--      +45  as 15 × 3 novas de INSERT/UPDATE/DELETE
--      + 1  "gold_consultores: ver"
--      ────
--      +29  no total
--    Então, chamando de N o número medido IMEDIATAMENTE ANTES de rodar esta
--    migration, depois tem de ser **N + 29**. Se o terceiro lote (078–081)
--    não tiver sido aplicado, N = 225 e o resultado é 254; se a 081 já tiver
--    entrado, N = 226 e o resultado é 255. O que importa é a diferença de 29,
--    não o número absoluto — meça antes e depois:
-- select count(*) from pg_policies where schemaname = 'public';
--
-- 4) Cada uma das 15 tem exatamente 1 INSERT, 1 UPDATE e 1 DELETE novos, e
--    manteve a(s) de SELECT. Tem de voltar 15 linhas, todas com qtd = 3:
-- select tablename, count(*) qtd from pg_policies
--  where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE')
--    and tablename in ('admin_papel_regioes','bases_operacionais','estoque_itens',
--      'gold_consultores','gold_protocolo_itens','gold_selos','motor_componentes',
--      'motor_fabricantes','motor_familias','motor_modelos','parceiro_acomodacoes',
--      'parceiro_atividades','parceiro_vagas','tanques','taxonomia')
--  group by 1 order by 1;
--
-- 5) O dado continua no lugar — nenhuma destas contagens pode mudar:
-- select (select count(*) from public.estoque_itens)      as estoque_itens  -- 6
--      , (select count(*) from public.tanques)            as tanques        -- 5
--      , (select count(*) from public.motor_componentes)  as componentes    -- 144
--      , (select count(*) from public.taxonomia)          as taxonomia;     -- 63
--
-- 6) Teste de fumaça, com login real. É o passo que fecha o risco (b) do
--    cabeçalho — atualizar depende de conseguir LER a linha:
--    · conta comum: /estoque e /combustivel — listar, criar um item, corrigir
--      a quantidade e apagar. Os quatro têm de funcionar.
--    · conta CEO/Suporte: /admin — abrir a lista de consultores Gold (tem de
--      continuar mostrando TODOS, inclusive quem não tem agendamento) e
--      editar um item do catálogo de motores.
--    · conta comum: abrir /convite-cotista e /mecanica para conferir que
--      `convites` e `transferencias` seguem legíveis (elas não foram tocadas,
--      mas é o par que prova a decisão de não tocá-las).
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE,
-- passo 18 — o script completo que apaga as 46 novas e recria os 15 `FOR ALL`
-- e as 2 policies de SELECT de `gold_consultores` como estavam.


-- ###########################################################################
-- ### 084_bases_operacionais_apagada.sql
-- ###########################################################################

-- ============================================================================
-- 084 — `bases_operacionais` é apagada, junto com as duas colunas `base_id`
-- ============================================================================
-- FECHA: A2 de docs/auditoria/2026-08-19-paridade-front-back.md, item 3 da
--        lista de ABERTOS de docs/auditoria/2026-08-19-fechamento.md
--
-- APOSENTA: `073_decisao_bases_operacionais_fk_restrict.sql` — ver a seção
--           própria, mais abaixo. Se esta migration rodar, a 073 não tem mais
--           o que consertar e NÃO deve ser aplicada nunca.
--
-- ############################################################################
-- ATENÇÃO: MIGRATION DESTRUTIVA. Apaga uma tabela e duas colunas em PRODUÇÃO.
-- Não há staging. Leia a seção "ANTES DE RODAR" e rode as duas conferências de
-- guarda — se qualquer uma delas voltar diferente de zero, PARE.
-- ############################################################################
--
-- O ACHADO
-- --------
-- `bases_operacionais` nasceu na `064_estoque_e_combustivel.sql:49` e nunca
-- foi usada. Medido em 19/08/2026, no banco vivo e na árvore de agora:
--
--   · `select count(*) from public.bases_operacionais`                 → 0
--   · `estoque_itens` tem 6 linhas; com `base_id` preenchido           → 0
--   · `tanques` tem 5 linhas; com `base_id` preenchido                 → 0
--   · varredura de `bases_operacionais` OU `base_id` em todo `web/`
--     (`*.ts`/`*.tsx`, fora de `node_modules` e `.next`)               → 0
--
-- Zero linha, zero referência, zero escrita. Nenhuma tela pergunta a base,
-- nenhuma consulta filtra por ela, nenhuma action a grava. A tabela existe
-- apenas no schema.
--
-- A RÉGUA, E POR QUE ELA MANDA APAGAR
-- -----------------------------------
-- É a mesma que fechou A8 e B9 no mesmo dia, e que está escrita em
-- `web/lib/domain/cotista-plano.ts:14-44` e `:96-108`: **código que ninguém
-- usa dá a impressão de que a funcionalidade existe.** Quem abre o schema
-- hoje lê "o Commander suporta múltiplas bases operacionais — marina, garagem
-- náutica, galpão" e conclui que o recurso está pronto e só falta ligar a
-- tela. Não está pronto: não existe cadastro de base, não existe seletor, não
-- existe agrupamento, e as duas FKs nunca receberam um valor. O schema está
-- prometendo uma capacidade que o produto não tem.
--
-- E a promessa não é de graça. Ela cobra três coisas hoje:
--   · duas policies de RLS mantidas e reescritas a cada faxina de banco
--     (as 082 e 083 deste mesmo lote passam por elas);
--   · uma migration inteira (`073`) parada há dias esperando decisão do dono
--     sobre uma FK de uma tabela vazia;
--   · duas colunas `base_id` que todo `select *` de `/estoque` e
--     `/combustivel` carrega e nenhuma linha jamais preenche.
--
-- O QUE SE PERDE — dito sem maquiagem
-- -----------------------------------
-- Perde-se o DESENHO de dados multi-base. Ele é legítimo: uma administradora
-- com marina e garagem náutica hoje joga estoque e tanque no mesmo pote, e o
-- conserto que a auditoria propõe para o A2 é exatamente construir a tela
-- ("seletor de base em /estoque e /combustivel gravando `estoque_itens.base_id`
-- e `tanques.base_id`, e o 'Precisa repor' agrupado por base").
--
-- A pergunta certa não é "o desenho é bom?" — é bom. É **"quanto custa
-- recriá-lo no dia em que a tela for construída?"** E a resposta é: quase
-- nada. O `create table` original tem 6 linhas e continua no repositório para
-- sempre, em `064_estoque_e_combustivel.sql:49-60`, junto com as duas policies
-- e as duas FKs (`:65` e `:123`). Recriar é copiar aquele bloco para uma
-- migration nova. Não se está jogando fora conhecimento nem dado — está-se
-- jogando fora uma prateleira vazia que finge estar cheia.
--
-- Guardar um schema *por precaução*, sem tela, sem dado e sem prazo, é o custo
-- permanente pagando por um benefício que só chega se e quando a funcionalidade
-- for priorizada. Se for priorizada, o benefício custa 6 linhas de SQL.
--
-- ============================================================================
-- O QUE ISTO FAZ COM A MIGRATION 073 — precisa estar escrito
-- ============================================================================
-- `073_decisao_bases_operacionais_fk_restrict.sql` está no repositório, NÃO
-- aplicada, com o cabeçalho "[PRECISA DE DECISÃO DO DONO]" e registrada como
-- decisão nº 8 em `docs/auditoria/2026-08-19-fechamento.md`. Ela troca
-- `bases_operacionais_dono_id_fkey` de `ON DELETE CASCADE` para `RESTRICT`,
-- para que apagar um perfil deixe de apagar a base junto.
--
-- Se a 084 rodar, a 073 fica sem objeto: não há FK para alterar, porque não há
-- tabela. A decisão do dono que a 073 pedia — "excluir conta trava ou não trava
-- quando a pessoa tem base?" — deixa de existir como pergunta, e a exclusão de
-- conta volta a ser o fluxo simples que já era.
--
-- Consequência operacional, em ordem:
--   1. Aplicar a 084 e NÃO aplicar a 073. Nunca.
--   2. A 073 continua no repositório como registro histórico. Ela ESTOURA se
--      alguém a rodar depois desta ("relation public.bases_operacionais does
--      not exist") — falha barulhenta, que é o comportamento certo.
--   3. A decisão nº 8 de `docs/auditoria/2026-08-19-fechamento.md` sai da fila
--      do dono. Das 11 decisões daquele documento passam a ser 10.
--
-- E o contrário também precisa estar escrito, porque é a saída de emergência:
-- **se o dono decidir que a funcionalidade multi-base entra**, esta migration
-- não roda, e aí a 073 volta a fazer sentido e continua esperando decisão.
-- As duas são mutuamente exclusivas: ou 073, ou 084. Nunca as duas.
--
-- ============================================================================
-- ANTES DE RODAR — as duas guardas
-- ============================================================================
-- Rode as duas. As duas TÊM de voltar 0. Se qualquer uma voltar diferente,
-- alguém começou a usar a funcionalidade entre 19/08 e agora, e esta migration
-- APAGARIA DADO REAL — pare e reabra a decisão.
--
--   select count(*) from public.bases_operacionais;                       -- 0
--   select count(*) from public.estoque_itens where base_id is not null
--        + (select count(*) from public.tanques where base_id is not null); -- 0
--
-- (a segunda está escrita assim de propósito: uma linha só, para não haver
--  como conferir metade e esquecer a outra.)
--
-- A trava no fim da transação repete as duas contagens e aborta tudo se
-- alguma não for zero — mas a conferência manual antes existe para você NÃO
-- descobrir isso por uma exceção.
--
-- ORDEM DENTRO DO LOTE: esta é a ÚLTIMA. As 082 e 083 tocam policies de
-- `bases_operacionais` que esta migration apaga junto com a tabela; rodar
-- nesta ordem faz o trabalho delas ali ser descartado sem erro. O inverso
-- (084 antes) faria a 082 estourar com "policy does not exist".
--
-- REVERSÃO: possível e barata, porque não há dado a restaurar — o script
-- completo (recria tabela, policies e as duas colunas) está em
-- supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE, passo 19.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- GUARDA — nada é apagado se houver qualquer dado em jogo
-- ---------------------------------------------------------------------------
do $$
declare
  v_bases int;
  v_ligadas int;
begin
  select count(*) into v_bases from public.bases_operacionais;
  if v_bases <> 0 then
    raise exception
      'ABORTADO: public.bases_operacionais tem % linha(s). Esta migration so pode rodar sobre uma tabela vazia — alguem comecou a usar a funcionalidade. Reabra a decisao do achado A2 antes de insistir.',
      v_bases;
  end if;

  select (select count(*) from public.estoque_itens where base_id is not null)
       + (select count(*) from public.tanques       where base_id is not null)
    into v_ligadas;
  if v_ligadas <> 0 then
    raise exception
      'ABORTADO: % linha(s) de estoque_itens/tanques tem base_id preenchido. Apagar as colunas perderia esse vinculo.',
      v_ligadas;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- As duas colunas primeiro. Cada `drop column` leva junto a FK dela
-- (`estoque_itens_base_id_fkey` e `tanques_base_id_fkey`, as duas
-- `ON DELETE SET NULL`), o que deixa a tabela sem nenhum dependente.
-- ---------------------------------------------------------------------------
alter table public.estoque_itens drop column if exists base_id;
alter table public.tanques       drop column if exists base_id;

-- ---------------------------------------------------------------------------
-- E então a tabela. Sem `cascade`: se ainda houver qualquer dependente que
-- este arquivo não previu, o comando ESTOURA em vez de arrastá-lo junto.
-- As duas policies ("bases: o dono le" e as de escrita, sejam a `FOR ALL`
-- original ou as três que a 083 cria) caem com a tabela — policy não
-- sobrevive ao objeto que protege.
-- ---------------------------------------------------------------------------
drop table if exists public.bases_operacionais;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A tabela não existe mais — tem de voltar `null`:
-- select to_regclass('public.bases_operacionais');
--
-- 2) Nenhuma policy órfã sobrou com o nome dela — tem de voltar 0:
-- select count(*) from pg_policies
--  where schemaname = 'public' and tablename = 'bases_operacionais';
--
-- 3) As duas colunas sumiram — tem de voltar 0:
-- select count(*) from information_schema.columns
--  where table_schema = 'public' and column_name = 'base_id'
--    and table_name in ('estoque_itens','tanques');
--
-- 4) NENHUMA outra FK apontava para a tabela — tem de voltar 0:
-- select count(*) from pg_constraint con
--   join pg_class ref on ref.oid = con.confrelid
--  where con.contype = 'f' and ref.relname = 'bases_operacionais';
--
-- 5) O dado que importa continua intacto — os dois números não podem mudar:
-- select (select count(*) from public.estoque_itens) as itens    -- 6
--      , (select count(*) from public.tanques)       as tanques;  -- 5
--
-- 6) Teste de fumaça, com login real: abrir /estoque e /combustivel. As duas
--    telas fazem `select *` nessas tabelas e NÃO citam `base_id` em lugar
--    nenhum (varredura de 19/08: 0 ocorrências em todo `web/`), então têm de
--    carregar, listar e aceitar um item novo exatamente como antes. Se
--    qualquer uma quebrar, a varredura estava errada — e a reversão do passo
--    19 devolve tudo em segundos, porque não há dado a restaurar.
--
-- 7) Documentação a acertar depois desta migration (nenhuma quebra nada,
--    todas são frases que passam a citar objeto inexistente):
--    · `INDICES-2026-08-19.sql:45-46` lista `estoque_itens.base_id` e
--      `tanques.base_id` entre os índices DESCARTADOS. Continua correto como
--      registro, mas as colunas não existem mais — vale uma nota.
--    · `073_decisao_bases_operacionais_fk_restrict.sql` inteira, aposentada.
--    · `docs/auditoria/2026-08-19-fechamento.md`: o achado A2 (item 3 dos
--      abertos) fecha POR APAGAMENTO, e a decisão do dono nº 8 sai da fila.
--
-- REVERSÃO: supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE, passo 19.


-- ===========================================================================
-- CONFERÊNCIA FINAL — rode este SELECT depois das três.
-- Os números esperados estão comentados na frente de cada linha. Qualquer um
-- fora do esperado significa que aquela migration não pegou.
-- ===========================================================================
select
  -- 082: tem de ser 0 (eram 24)
  (select count(*) from pg_policies
    where schemaname='public'
      and ( (qual       is not null and qual       ~ 'auth\.uid\(\)' and qual       !~ '\( SELECT auth\.uid\(\)')
         or (with_check is not null and with_check ~ 'auth\.uid\(\)' and with_check !~ '\( SELECT auth\.uid\(\)') )
  )                                                                       as initplan_pendentes,   -- 0
  -- 083: tem de ser 3 (eram 18) — convites, push_assinaturas, transferencias
  (select count(*) from pg_policies where schemaname='public' and cmd='ALL')
                                                                          as policies_for_all,     -- 3
  -- 084: a tabela tem de ter sumido
  (select to_regclass('public.bases_operacionais')::text)                 as tabela_bases,         -- null
  (select count(*) from information_schema.columns
    where table_schema='public' and column_name='base_id'
      and table_name in ('estoque_itens','tanques'))                      as colunas_base_id,      -- 0
  -- e nada de dado pode ter se movido
  (select count(*) from public.estoque_itens)                             as estoque_itens,        -- 6
  (select count(*) from public.tanques)                                   as tanques,              -- 5
  (select count(*) from public.motor_componentes)                         as componentes,          -- 144
  (select count(*) from public.taxonomia)                                 as taxonomia,            -- 63
  -- RLS continua ligada em tudo (82 tabelas agora — eram 83, menos a apagada)
  (select count(*) from pg_tables t
    where t.schemaname='public'
      and exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity))
                                                                          as tabelas_com_rls;      -- 82

-- Depois, no painel: Advisors -> Performance. `auth_rls_initplan` e
-- `multiple_permissive_policies` têm de sair da lista de `public`. As três
-- sobreposições SELECT x SELECT de `assinaturas`, `embarcacoes` e `parceiros`
-- continuam aparecendo — são outro achado, não este.

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

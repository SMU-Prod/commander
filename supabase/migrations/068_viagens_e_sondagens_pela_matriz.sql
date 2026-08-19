-- ============================================================================
-- 068 — Viagens voltam para a matriz; sondagens deixam de ser apagáveis por terceiro
-- ============================================================================
-- FECHA: P1-2 e P1-3 de docs/auditoria/2026-08-19-banco-e-rls.md
--
-- O PROBLEMA — viagens (P1-2)
-- ---------------------------
-- Policy única, `FOR ALL`, lida do banco vivo:
--     USING      pode_ver_embarcacao(embarcacao_id)
--     WITH CHECK pode_ver_embarcacao(embarcacao_id)
-- `pode_ver_embarcacao()` só pergunta "existe vínculo?" — não pergunta papel
-- nem matriz. Todo o resto do app decide escrita com
-- `permissao(emb,'diario','editar')`; `viagens` era a exceção. Na prática um
-- COTISTA — o papel de menor privilégio — apagava TODAS as viagens da
-- embarcação, trilhas de GPS importadas incluídas, e editava quilometragem e
-- horário de viagem alheia. Um CMDT com a matriz inteira em "só ver" fazia o
-- mesmo.
--
-- O PROBLEMA — sondagens (P1-3)
-- -----------------------------
--     USING      pode_ver_embarcacao(embarcacao_id)
--     WITH CHECK pode_ver_embarcacao(embarcacao_id) AND usuario_id = (select auth.uid())
-- O WITH CHECK impede forjar sondagem no nome de outro. Mas em UPDATE e DELETE
-- quem manda é o USING — e o USING não amarra o dono. Qualquer tripulante
-- apagava as sondagens de profundidade levantadas por um colega. Como sondagem
-- alimenta a malha de `corredores`, é perda de dado de navegação sem rastro (a
-- tabela não tem auditoria).
--
-- POR QUE ESTA CORREÇÃO E NÃO OUTRA
-- ---------------------------------
-- `viagens` é diário de bordo: usa a aba 'diario', a mesma que `eventos` já
-- usa. O desenho segue o padrão da casa — quatro policies explícitas
-- (ver/criar/atualizar/excluir) em vez de um `FOR ALL`, o que de quebra
-- elimina o aviso `multiple_permissive_policies` (P2-3).
-- `sondagens` NÃO entra na matriz: é dado levantado por pessoa, não por papel.
-- A leitura fica do barco inteiro (a malha é coletiva, e restringir quebraria
-- `corredores`), mas correção e exclusão ficam com quem levantou.
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
--   viagens .... 1 linha, embarcação 6ecc61ca…, único vínculo é PROP
--   sondagens .. 2 linhas, mesma embarcação, autor = o próprio PROP vinculado
-- PROP curto-circuita `permissao()` (a função devolve true para papel='PROP'
-- independentemente da matriz), e é o autor das sondagens. Logo: ZERO linhas
-- deixam de ser legíveis, editáveis ou apagáveis por quem hoje as acessa.
-- Quem perde algo no futuro é exatamente o alvo do conserto: vinculado sem
-- `diario.editar` na matriz, e terceiro tentando mexer em sondagem alheia.
--
-- ENDURECIMENTO DE BRINDE
-- -----------------------
-- As duas policies vivas estavam com `roles = {public}` (o padrão de quem
-- omite o `TO`), não `{authenticated}`. Como ambas dependem de `auth.uid()`,
-- anon nunca passou — mas as novas ficam explicitamente restritas a
-- `authenticated`, que é o padrão do resto do banco.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- viagens — quatro policies pela matriz, aba 'diario'
-- ---------------------------------------------------------------------------
drop policy if exists "viagens: tudo com vinculo" on public.viagens;
drop policy if exists "viagens: ver pela matriz" on public.viagens;
drop policy if exists "viagens: criar pela matriz" on public.viagens;
drop policy if exists "viagens: atualizar pela matriz" on public.viagens;
drop policy if exists "viagens: excluir pela matriz" on public.viagens;

create policy "viagens: ver pela matriz" on public.viagens
  for select to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'ver'));

create policy "viagens: criar pela matriz" on public.viagens
  for insert to authenticated
  with check (public.permissao(embarcacao_id, 'diario', 'editar'));

create policy "viagens: atualizar pela matriz" on public.viagens
  for update to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'editar'))
  with check (public.permissao(embarcacao_id, 'diario', 'editar'));

create policy "viagens: excluir pela matriz" on public.viagens
  for delete to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'editar'));

-- ---------------------------------------------------------------------------
-- sondagens — leitura do barco, escrita de quem levantou
-- ---------------------------------------------------------------------------
drop policy if exists "sondagens: dono grava e le as suas" on public.sondagens;
drop policy if exists "sondagens: ve as do barco" on public.sondagens;
drop policy if exists "sondagens: grava a propria" on public.sondagens;
drop policy if exists "sondagens: corrige a propria" on public.sondagens;
drop policy if exists "sondagens: apaga a propria" on public.sondagens;

create policy "sondagens: ve as do barco" on public.sondagens
  for select to authenticated
  using (public.pode_ver_embarcacao(embarcacao_id));

create policy "sondagens: grava a propria" on public.sondagens
  for insert to authenticated
  with check (
    public.pode_ver_embarcacao(embarcacao_id)
    and usuario_id = (select auth.uid())
  );

create policy "sondagens: corrige a propria" on public.sondagens
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (
    usuario_id = (select auth.uid())
    and public.pode_ver_embarcacao(embarcacao_id)
  );

create policy "sondagens: apaga a propria" on public.sondagens
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois; viagens deve voltar 4 linhas, sondagens 4)
-- ---------------------------------------------------------------------------
-- select tablename, policyname, cmd, roles::text
--   from pg_policies
--  where schemaname='public' and tablename in ('viagens','sondagens')
--  order by tablename, cmd;

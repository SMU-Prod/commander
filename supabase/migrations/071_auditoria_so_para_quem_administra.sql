-- ============================================================================
-- 071 — A trilha de auditoria passa a ser lida só por quem administra a unidade
-- ============================================================================
-- FECHA: P1-7 de docs/auditoria/2026-08-19-banco-e-rls.md
--
-- O PROBLEMA
-- ----------
-- Policy viva de SELECT:
--     USING EXISTS (select 1 from vinculos v
--                   where v.embarcacao_id = auditoria.embarcacao_id
--                     and v.usuario_id = auth.uid())
-- Sem matriz e sem papel: QUALQUER vinculado lia a trilha de auditoria inteira
-- da unidade — inclusive os eventos `bloqueou_cotista` / `desbloqueou_cotista`
-- com autor e horário, ou seja, quem mandou bloquear quem. Para uma tabela
-- cujo propósito é prestação de contas DO ADM, o público certo é quem
-- administra, não todo mundo com vínculo. Um cotista lendo a trilha de
-- decisões administrativas sobre ele mesmo e sobre os outros cotistas é
-- exposição desnecessária.
--
-- POR QUE ESTA CORREÇÃO E NÃO OUTRA
-- ---------------------------------
-- `eh_prop()` cobre o dono. `permissao(embarcacao_id,'embarcacao','editar')` é
-- o predicado que o resto do banco já usa para "quem mexe na ficha da unidade"
-- — é o mais próximo de "administra" que a matriz oferece hoje, e evita
-- inventar uma aba nova só para auditoria. Deliberadamente NÃO se cria policy
-- de UPDATE nem de DELETE: a ausência delas é o que faz esta tabela ser
-- append-only de verdade, e isso está certo e deve continuar assim.
-- A policy de INSERT desta tabela também consultava `vinculos` direto (e por
-- isso escapava do conserto de suspensão) — ela foi corrigida na migration
-- 067, não aqui, porque lá é o assunto "suspensão vale".
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
--   auditoria = 1 linha, embarcação 00ba0c9d…, que tem PROP vinculado.
--   vinculos  = 3 no total, TODOS com papel 'PROP'.
-- `eh_prop()` devolve true para os três. Logo: ZERO pessoas perdem leitura
-- hoje, e a única linha existente continua legível por quem já a lia.
--
-- ATENÇÃO PARA O FUTURO (não é problema hoje, mas é o efeito desta migration)
-- --------------------------------------------------------------------------
-- Quando existir tripulação de verdade, um ADM/ADM_GERAL que NÃO tenha
-- `embarcacao.editar` marcado na matriz deixará de ver a auditoria. Se a
-- intenção for que todo ADM leia a trilha independentemente da matriz, o certo
-- é acrescentar aqui um `or v.papel in ('ADM','ADM_GERAL')` — mas isso é
-- decisão de produto e fica registrada, não aplicada.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

drop policy if exists "auditoria: quem tem acesso a embarcacao le" on public.auditoria;
drop policy if exists "auditoria: o dono e quem administra leem" on public.auditoria;
create policy "auditoria: o dono e quem administra leem" on public.auditoria
  for select to authenticated
  using (
    public.eh_prop(embarcacao_id)
    or public.permissao(embarcacao_id, 'embarcacao', 'editar')
  );

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- Deve voltar exatamente 2 policies — 1 SELECT e 1 INSERT — e nenhuma de
-- UPDATE ou DELETE (a tabela é append-only por desenho).
-- ---------------------------------------------------------------------------
-- select policyname, cmd, qual, with_check
--   from pg_policies where schemaname='public' and tablename='auditoria'
--  order by cmd;

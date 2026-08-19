-- ============================================================================
-- 072 — [PRECISA DE DECISÃO DO DONO] PROP nunca fica suspenso
-- ============================================================================
-- NÃO APLIQUE ESTA MIGRATION SEM DECIDIR A REGRA DE PRODUTO ABAIXO.
-- As migrations 067 a 071 são correções de segurança e valem por si.
-- Esta aqui é uma REGRA DE NEGÓCIO — cinto e suspensório sobre a 067.
--
-- FECHA: a ressalva do P0-1 de docs/auditoria/2026-08-19-banco-e-rls.md
--
-- A PERGUNTA
-- ----------
-- Depois da migration 067, `eh_prop()` e `permissao()` passam a ignorar quem
-- tem `suspenso_em` preenchido. Se um PROP for suspenso, ele perde o próprio
-- barco — e como só um PROP suspende gente, ninguém sobra para desfazer.
--
-- POR QUE ISSO NÃO É UM RISCO HOJE
-- --------------------------------
-- Medido no banco vivo: `vinculos` tem UMA só policy de UPDATE,
-- `vinculos: prop atualiza quem nao e dono`, e ela carrega `papel <> 'PROP'`
-- tanto no USING quanto no WITH CHECK. Nenhum cliente consegue suspender um
-- PROP, nem outro PROP, nem a si mesmo. Não existe outra policy de UPDATE.
-- Hoje: 3 vínculos, 3 PROP, 0 suspensos — a violação é inalcançável.
--
-- O QUE ESTE CHECK ACRESCENTA
-- ---------------------------
-- Torna a regra declarativa em vez de emergente. Passa a valer também para
-- escrita via `service_role` (painel do Supabase, script de manutenção, job) —
-- os caminhos que a RLS não cobre e onde o acidente de fato aconteceria.
--
-- O QUE ELE CUSTA
-- ---------------
-- Fecha a porta para "co-proprietário inadimplente suspenso". Se um dia a
-- unidade tiver dois PROP e o produto quiser suspender um deles, este CHECK
-- terá de cair. É essa a decisão.
--
-- IMPACTO NA BASE ATUAL: ZERO — nenhuma linha viola.
-- Confirme antes de aplicar (tem de voltar 0):
--   select count(*) from public.vinculos
--    where papel = 'PROP' and suspenso_em is not null;
--
-- REVERSÃO:
--   alter table public.vinculos drop constraint vinculos_prop_nao_suspende;
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vinculos_prop_nao_suspende'
      and conrelid = 'public.vinculos'::regclass
  ) then
    alter table public.vinculos
      add constraint vinculos_prop_nao_suspende
      check (papel <> 'PROP' or suspenso_em is null);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois; deve voltar 1 linha)
-- ---------------------------------------------------------------------------
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conname = 'vinculos_prop_nao_suspende';

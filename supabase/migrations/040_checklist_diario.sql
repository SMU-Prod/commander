-- =====================================================================
-- Onda 40 · Checklist do Diário por hub (PRD §23) — "Motores/Casco/
-- Elétrica/Hidráulica/Segurança — ✓ OK / observação" + atalho "OK GERAL"
-- ao finalizar uma saída. Ver docs/auditoria/2026-08-14-prd-upgrade2-parte1.md
-- §23 ("falta e é grande") e web/lib/domain/checklist-diario.ts.
--
-- Sem tabela nova: um array jsonb na própria saída (evento tipo
-- 'navegacao'), mesmo espírito de `trilha`/`tripulacao` (migrations 006/022)
-- — o checklist é um detalhe DAQUELA saída, não uma entidade própria.
-- `null` quando ninguém tocou o checklist (nunca grava os 5 hubs "ok" por
-- omissão — silêncio não é confirmação). RLS de `eventos` já é por linha
-- (matriz via `aba_alvo`, migration 010), então uma coluna nova não precisa
-- de política própria.
-- =====================================================================

alter table public.eventos add column checklist jsonb;

comment on column public.eventos.checklist is
  'checklist rapido por hub numa saida (PRD §23) — array de {hub,estado,nota}, so os hubs tocados; null quando ninguem tocou. Quando estado=observacao e a pessoa marca "isso e um problema", nasce uma ocorrencia em paralelo (public.ocorrencias.evento_id aponta pra ca) — o array aqui e so o registro do que foi conferido nesta saida, nao duplica o estado da ocorrencia.';

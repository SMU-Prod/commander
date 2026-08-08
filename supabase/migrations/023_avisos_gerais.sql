-- 023: Avisos de mar ruim e motor parado (Onda 6, Task 6) — reusa alertas_enviados em vez de
-- criar tabela nova. Esses avisos nao amarram a um item_monitorado: o de mar ruim e por
-- embarcacao, o de motor parado e por equipamento. item_monitorado_id vira opcional e ganha
-- irmao equipamento_id; a dedupe passa a usar o primeiro id nao nulo entre os dois + embarcacao.

alter table public.alertas_enviados
  alter column item_monitorado_id drop not null,
  add column equipamento_id uuid references public.equipamentos(id) on delete cascade;

alter table public.alertas_enviados
  drop constraint alertas_enviados_janela_check,
  add constraint alertas_enviados_janela_check
    check (janela in ('d30','d15','d5','vencido','h_margem','h_vencido','mar_ruim','motor_parado'));

-- a unique antiga so cobria item_monitorado_id (not null); com ele agora opcional, troca por um
-- indice funcional que usa o primeiro id disponivel na cadeia item > equipamento > embarcacao —
-- e o que garante o "no maximo 1x por dia/ciclo" tanto para mar (so embarcacao) quanto motor (so equipamento).
alter table public.alertas_enviados drop constraint alertas_enviados_item_monitorado_id_janela_ciclo_ref_key;
create unique index alertas_enviados_dedupe_idx on public.alertas_enviados (
  coalesce(item_monitorado_id, equipamento_id, embarcacao_id), janela, ciclo_ref
);

create index if not exists idx_alertas_equipamento on public.alertas_enviados (equipamento_id);

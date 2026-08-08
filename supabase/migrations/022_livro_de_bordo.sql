-- 022: Livro de Bordo (espec v3 §10) — a saida vira registro formal de operacao.
-- Estende `eventos` em vez de criar tabela nova: o diario ja e unico no produto,
-- e uma saida ja e um evento tipo 'navegacao'.

alter table public.eventos
  add column hora_saida time,
  add column hora_retorno time,
  add column destino text,
  add column tripulacao uuid[] not null default '{}',
  add column mar_onda_m numeric,
  add column mar_vento_kt numeric;

comment on column public.eventos.tripulacao is
  'usuarios a bordo na saida — vale como comprovacao de quem estava no barco';
comment on column public.eventos.mar_onda_m is
  'condicao do mar NO MOMENTO do registro (Open-Meteo), congelada: o passado nao muda';

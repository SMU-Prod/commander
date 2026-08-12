-- 031: importar do plotter (onda 21) — anos de trilhas do Garmin/Raymarine/
-- Navionics (todos exportam GPX) viram saidas no Livro de Bordo de uma vez,
-- em vez de nascerem so das trilhas gravadas ao vivo pelo app. Mesma tabela
-- `eventos` (tipo 'navegacao'), 3 colunas novas, sem tabela nova.

alter table public.eventos
  add column importado_do_plotter boolean not null default false,
  add column trilha_sem_horario boolean not null default false,
  add column origem_hash text;

comment on column public.eventos.importado_do_plotter is
  'saida criada por importacao de arquivo GPX do plotter (onda 21), nao gravada ao vivo pelo app — vira badge na tela da saida';
comment on column public.eventos.trilha_sem_horario is
  'trilha importada cujo GPX original nao tinha <time> em algum ponto — duracao/velocidade nao podem ser calculadas honestamente (fabricar seria mentir), so a distancia (nao depende de horario) e mostrada';
comment on column public.eventos.origem_hash is
  'fingerprint da trilha original (quantidade de pontos + inicio/fim, ver hashTrilhaGpx em web/lib/domain/gpx.ts) — usado pra detectar reimportacao do mesmo arquivo GPX e nao duplicar saidas silenciosamente';

-- Consulta de idempotencia (web/lib/acoes/importar-gpx.ts) filtra por
-- embarcacao_id + origem_hash antes de cada importacao — indice parcial
-- (so linhas realmente importadas tem origem_hash) mantem a busca rapida
-- sem inflar o indice com todo o resto do diario.
create index eventos_origem_hash_idx on public.eventos (embarcacao_id, origem_hash) where origem_hash is not null;

-- 026: idempotencia no envio de sondagens (onda 14) — a fila persistente em
-- web/lib/nmea/fila.ts guarda leituras a bordo (sem sinal de celular, 20
-- milhas da costa) e reenvia em lote quando o sinal volta. Se a resposta do
-- servidor se perder no meio do caminho (rede instavel perto da costa), o
-- cliente NAO sabe se gravou ou nao — e o retry manda o MESMO lote de novo.
--
-- `origem_id` e a chave de deduplicacao gerada no cliente:
-- `${loteId}:${celulaId}`. `loteId` e um uuid sorteado UMA vez quando o lote
-- e congelado (`despachar` em fila.ts) e reusado em TODA retentativa daquele
-- lote — nunca recalculado a partir da fila atual, que pode ter crescido
-- enquanto o lote antigo ainda esta em voo. `celulaId` identifica a celula
-- dentro do lote (ja reduzido por `reduzirPorCelula`, onda 13). Um retry do
-- MESMO lote gera a MESMA chave; o unique index abaixo rejeita a segunda
-- tentativa em silencio (`upsert(...).ignoreDuplicates`) sem duplicar linha
-- nem perder a leitura original.
--
-- Nullable: linhas gravadas antes desta migration (ou por um caminho futuro
-- que nao passe pela fila) nao tem essa chave — unique padrao do Postgres
-- permite varios NULLs, entao nao exige backfill.
alter table public.sondagens add column origem_id text;
comment on column public.sondagens.origem_id is
  'Chave de deduplicacao do cliente (loteId:celulaId, ver web/lib/nmea/fila.ts) — retry do mesmo lote nunca duplica.';
create unique index sondagens_origem_id_idx on public.sondagens (origem_id) where origem_id is not null;

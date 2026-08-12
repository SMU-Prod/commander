-- 030: viagens (onda 19) — "Strava do Mar", planejar viagem com paradas.
-- Uma viagem e uma sequencia ORDENADA de paradas (origem -> parada 1 -> ... ->
-- destino final, ver web/lib/domain/viagem.ts e o glossario em
-- docs/CONTRIBUTING.md: "viagem" e "parada", nunca "trip"/"waypoint"). O
-- tracado de cada perna PELA AGUA (A* + calado + corredores) nunca e
-- persistido aqui — e recalculado sob demanda pelo motor existente
-- (web/lib/domain/rota.ts via o Worker) toda vez que a viagem e exibida,
-- exatamente como a tela /navegar ja faz pro destino unico. Isso evita
-- guardar uma rota "congelada" que ficaria desatualizada se a mascara de
-- agua, o calado do barco ou os corredores mudarem depois do planejamento.
--
-- `paradas` fica em jsonb (array ordenado de {nome, la, lo}) em vez de uma
-- tabela filha: sao poucos pontos por viagem (nunca centenas), sempre lidos
-- e escritos juntos como uma unidade (a ordem IMPORTA e e o proprio array),
-- e nao precisam ser filtrados/agregados por SQL — mesma razao pratica que
-- ja vale pra `eventos.trilha` (migration 001) pros pontos de uma trilha
-- GPS.
--
-- RLS: MESMA regua do diario (`eventos`, migration 001) — vinculo com a
-- embarcacao via `pode_ver_embarcacao`, policy unica pra tudo (select/
-- insert/update/delete). Viagem tem dono claro (embarcacao_id), diferente
-- de `corredores` (migration 029, anonimo por construcao) — nao precisa de
-- funcao security definer pra escrever, o padrao direto de `eventos`/
-- `itens_monitorados` se aplica igual.
create table public.viagens (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  nome text not null,
  data_prevista date not null,
  -- array ordenado de paradas: [{ "nome": "Marina X", "la": -23.09, "lo": -44.14 }, ...]
  -- indice 0 = origem, ultimo indice = destino final. Minimo 2 (origem +
  -- destino) — uma "viagem" de 1 ponto so nao e uma viagem.
  paradas jsonb not null,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(paradas) = 'array' and jsonb_array_length(paradas) >= 2)
);

-- Índice pro caso de uso do cartão "Próximas paradas" em /hoje: a próxima
-- viagem (data futura mais perto) de UMA embarcação — `embarcacao_id +
-- data_prevista` cobre exatamente esse `where embarcacao_id = ? and
-- data_prevista >= ? order by data_prevista limit 1`.
create index viagens_embarcacao_data_idx on public.viagens (embarcacao_id, data_prevista);

alter table public.viagens enable row level security;

create policy "viagens: tudo com vinculo" on public.viagens for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

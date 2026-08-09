-- 025: sondagem colaborativa (onda 13) — o equivalente do SonarChart do
-- Navionics. Cada linha e UMA leitura de profundidade, ja reduzida por
-- celula no cliente (ver web/lib/domain/sondagem.ts, reduzirPorCelula) antes
-- de gravar — nao guardamos o NMEA cru tick a tick.
--
-- Privacidade: a leitura BRUTA (lat/lon exatos, dono) so e visivel pra quem
-- tem vinculo com a embarcacao que a gravou — mesma regra de sempre
-- (pode_ver_embarcacao). A base so vale a pena se for compartilhada, mas
-- posicao de barco e dado sensivel (revela rota, marina, habitos); por isso
-- a leitura COLABORATIVA (o que outros usuarios enxergam) so existe via
-- `sondagens_por_celula`, uma funcao security definer que devolve AGREGADO
-- por celula (centroide, mediana, contagem) — nunca a linha individual, nunca
-- embarcacao_id/usuario_id. Ninguem le a trilha de ninguem, so o resumo da
-- celula onde ela passou.

create table public.sondagens (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  profundidade_m numeric not null check (profundidade_m > 0),
  celula_id text not null,
  -- procedencia do transporte que capturou a leitura (arquitetura pluggable,
  -- ver web/lib/nmea/) — 'signalk' funciona hoje via WebSocket no PWA,
  -- 'nativo' e o socket TCP/UDP direto do gateway WiFi, ainda sem app nativo.
  transporte text not null check (transporte in ('signalk', 'nativo')),
  medido_em timestamptz not null,
  criado_em timestamptz not null default now()
);

create index sondagens_celula_idx on public.sondagens (celula_id);
create index sondagens_lat_lon_idx on public.sondagens (lat, lon);
create index sondagens_embarcacao_idx on public.sondagens (embarcacao_id);

alter table public.sondagens enable row level security;

-- Leitura bruta: so quem tem vinculo com a propria embarcacao (mesmo
-- desenho de equipamentos/itens_monitorados/eventos). Gravar exige tambem
-- ser o usuario autenticado da leitura — evita um comandante gravar em nome
-- de outro tripulante vinculado.
create policy "sondagens: dono grava e le as suas" on public.sondagens
  for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id) and usuario_id = (select auth.uid()));

-- Leitura colaborativa: agregado por celula, pra qualquer usuario autenticado
-- (nao precisa ter vinculo com a embarcacao que gravou — o ponto e
-- compartilhar entre barcos diferentes). security definer pra poder ler
-- atraves da RLS da tabela base, mas so devolve o agregado — nunca uma
-- linha crua. Sem limiar minimo de leituras por celula: um unico ponto ja e
-- anonimo (sem embarcacao_id/usuario_id/identidade), e exigir um minimo
-- deixaria areas recem-mapeadas (as que mais precisam de dado) sem nada pra
-- mostrar logo no comeco da base.
create or replace function public.sondagens_por_celula(
  p_lat_min double precision,
  p_lat_max double precision,
  p_lon_min double precision,
  p_lon_max double precision
) returns table (
  celula_id text,
  lat double precision,
  lon double precision,
  profundidade_m numeric,
  leituras bigint,
  ultima_leitura timestamptz
) language sql security definer stable set search_path = public as $$
  select
    celula_id,
    avg(lat) as lat,
    avg(lon) as lon,
    percentile_cont(0.5) within group (order by profundidade_m) as profundidade_m,
    count(*) as leituras,
    max(medido_em) as ultima_leitura
  from public.sondagens
  where lat between p_lat_min and p_lat_max
    and lon between p_lon_min and p_lon_max
  group by celula_id
$$;

revoke all on function public.sondagens_por_celula(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.sondagens_por_celula(double precision, double precision, double precision, double precision) to authenticated;

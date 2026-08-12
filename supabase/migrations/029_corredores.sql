-- 029: corredores (onda 17) — "Strava do Mar" (decisao do dono, roteiro §Pilar
-- Strava do Mar). Toda trilha GPS gravada (salvarTrilha, web/lib/acoes/trilha.ts)
-- ensina o mapa: onde um barco de verdade passou e caminho comprovado, e o A*
-- passa a PREFERIR essas celulas (web/lib/domain/rota.ts, fatorCorredor) —
-- nunca desbloquear terra/agua rasa demais, so torcer a preferencia entre
-- caminhos ja validos.
--
-- Mesmo desenho de privacidade da sondagem colaborativa (migration 025):
-- agregado por celula, nunca a rota individual exposta, consentimento
-- explicito no cliente antes de qualquer ponto subir (ver painel de Trilha em
-- navegar-mapa.tsx). DIFERENTE da sondagem, de proposito: aqui NAO existe
-- embarcacao_id nem usuario_id NENHUM — o agregado NASCE anonimo (so o
-- contador global de passagens importa, nunca "quem passou"), entao nao ha
-- linha "bruta" pra restringir por dono, nem necessidade de uma RPC
-- agregadora security definer pra LER (o SELECT direto ja e o agregado) —
-- so pra ESCREVER (ver abaixo).
--
-- Resolucao da celula: 100 m — a MESMA da mascara fina de agua/terra
-- (RESOLUCAO_CELULA_CORREDOR_M em web/lib/domain/rota.ts, scripts/gerar-
-- mascara-agua.mjs), NAO a da sondagem (15 m). Sondagem precisa de
-- granularidade fina porque profundidade varia muito em poucos metros
-- (baixio pontual); corredor e preferencia de ROTA — so importa na
-- resolucao em que o A* decide entre celulas vizinhas, que e a resolucao da
-- grade de agua que ele consome. Uma celula de 15 m seria ruido puro (erro
-- tipico de GPS civil) sem ganhar nada, so inflando a tabela.
--
-- CUIDADO com o vicio ja visto neste banco (tabela nova nascendo com
-- USING(true) de escrita, ver blackbelt-360-estado): aqui a escrita direta
-- por `authenticated` tem que ser IMPOSSIVEL. A UNICA porta e a funcao
-- security definer `registrar_passagens_corredor`, chamada pela action de
-- trilha depois que o dono consentiu — nao existe policy nenhuma de
-- insert/update/delete pra authenticated/anon, e um `revoke` explicito
-- reforça isso mesmo que uma policy futura seja adicionada por engano.
create table public.corredores (
  celula_id text primary key,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  passagens integer not null default 0 check (passagens >= 0),
  ultima_passagem timestamptz not null default now()
);

create index corredores_lat_lon_idx on public.corredores (lat, lon);

alter table public.corredores enable row level security;

-- Leitura: qualquer autenticado, sem excecao — a tabela e anonima por
-- construcao (sem dono pra restringir), o unico proposito dela e ser
-- consultada pelo A* de QUALQUER barco.
create policy "corredores: leitura publica autenticada" on public.corredores
  for select to authenticated
  using (true);

-- Nenhuma policy de insert/update/delete pra authenticated/anon — e o
-- `revoke` abaixo garante isso mesmo que uma policy solta apareca depois.
revoke insert, update, delete on table public.corredores from authenticated, anon;

-- Escrita: SO via esta funcao, chamada por salvarTrilha depois do
-- consentimento explicito do usuario (nunca em nome dele sem isso). Aceita
-- um lote (uma trilha inteira vira varias celulas UNICAS, ja deduplicadas no
-- cliente — mas o `distinct on` abaixo protege contra um cliente que mande
-- duplicata mesmo assim: um INSERT com celula_id repetido no MESMO comando
-- faz o Postgres rejeitar com "ON CONFLICT DO UPDATE command cannot affect
-- row a second time", entao a deduplicacao aqui nao e cosmetica).
create or replace function public.registrar_passagens_corredor(p_celulas jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.corredores (celula_id, lat, lon, passagens, ultima_passagem)
  select distinct on (c->>'celulaId')
    (c->>'celulaId')::text,
    (c->>'lat')::double precision,
    (c->>'lon')::double precision,
    1,
    now()
  from jsonb_array_elements(p_celulas) as c
  where c->>'celulaId' is not null
    and (c->>'lat')::double precision between -90 and 90
    and (c->>'lon')::double precision between -180 and 180
  on conflict (celula_id) do update
    set passagens = corredores.passagens + 1,
        ultima_passagem = now();
end $$;

revoke all on function public.registrar_passagens_corredor(jsonb) from public, anon;
grant execute on function public.registrar_passagens_corredor(jsonb) to authenticated;

-- ONDA 140 — O LADO DO APP DO COMMANDER CONNECTOR (plugin Signal K).
-- Estratégia em docs/integracao/signal-k-estrategia.md: o plugin roda no
-- servidor Signal K do barco e sobe telemetria consentida para o Commander.
--
-- APLICAR NO SQL EDITOR DO SUPABASE (o MCP desta sessão está sem permissão
-- de DDL). Enquanto não aplicada, gerar token responde com erro claro e a
-- ingestão responde 503 — nada quebra, nada mente.

-- Um token por instalação de plugin, ligado à embarcação. O token em claro
-- só existe no instante da criação (o app mostra uma vez); aqui vive só o
-- hash — vazamento de banco não vira acesso.
create table if not exists conector_tokens (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references embarcacoes(id) on delete cascade,
  token_hash text not null unique,
  rotulo text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz,
  revogado_em timestamptz
);
alter table conector_tokens enable row level security;

-- Vê e gerencia quem tem vínculo com a embarcação; a camada de app ainda
-- exige podeEditar("embarcacao") por cima (mesmo desenho das outras ações).
create policy conector_tokens_select on conector_tokens for select using (
  exists (select 1 from vinculos v
          where v.embarcacao_id = conector_tokens.embarcacao_id
            and v.usuario_id = (select auth.uid()))
);
create policy conector_tokens_insert on conector_tokens for insert with check (
  exists (select 1 from vinculos v
          where v.embarcacao_id = conector_tokens.embarcacao_id
            and v.usuario_id = (select auth.uid()))
);
create policy conector_tokens_update on conector_tokens for update using (
  exists (select 1 from vinculos v
          where v.embarcacao_id = conector_tokens.embarcacao_id
            and v.usuario_id = (select auth.uid()))
) with check (
  exists (select 1 from vinculos v
          where v.embarcacao_id = conector_tokens.embarcacao_id
            and v.usuario_id = (select auth.uid()))
);

-- As leituras que o plugin sobe. Escrita SÓ pela rota de ingestão com
-- service role (nenhuma policy de insert para authenticated — é proposital:
-- o caminho de escrita é um, autenticado por token de dispositivo).
create table if not exists telemetria (
  id bigint generated always as identity primary key,
  embarcacao_id uuid not null references embarcacoes(id) on delete cascade,
  path text not null,
  valor jsonb not null,
  ts timestamptz not null,
  recebido_em timestamptz not null default now()
);
alter table telemetria enable row level security;
create policy telemetria_select on telemetria for select using (
  exists (select 1 from vinculos v
          where v.embarcacao_id = telemetria.embarcacao_id
            and v.usuario_id = (select auth.uid()))
);

-- Os dois caminhos de leitura reais: "o estado agora" (path mais recente) e
-- série temporal de um path.
create index if not exists telemetria_embarcacao_ts on telemetria (embarcacao_id, ts desc);
create index if not exists telemetria_embarcacao_path_ts on telemetria (embarcacao_id, path, ts desc);

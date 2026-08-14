-- =====================================================================
-- Onda 34 · Commander Connect — captação de interesse com triagem de
-- compatibilidade (docs/prd/commander-connect.txt, seção 3). Grava o
-- questionário curto + a classificação PRELIMINAR calculada no servidor
-- (`web/lib/domain/connect.ts` classificarCompatibilidadeConnect) — nunca
-- confiar numa classificação vinda do cliente.
-- =====================================================================

create table public.connect_interesses (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  criado_por uuid references public.profiles(id) on delete set null,

  -- Respostas do questionário — mesmo vocabulário de
  -- RespostasCompatibilidadeConnect (web/lib/domain/connect.ts).
  rede_nmea2000 text not null check (rede_nmea2000 in ('sim', 'nao', 'nao_sei')),
  dados_motor_na_rede text check (dados_motor_na_rede in ('sim', 'nao', 'nao_sei')),
  motor_digital_conhecido text not null check (motor_digital_conhecido in ('sim', 'nao', 'nao_sei')),

  -- Classificação PRELIMINAR (nunca promessa — ver comentário acima).
  classificacao text not null check (classificacao in ('ready', 'compatible', 'consultar')),

  -- Só preenchido quando a pessoa quer ajudar a "Consultar compatibilidade"
  -- (marca/modelo/ano do motor + fotos do painel, PRD seção 3).
  motor_marca text,
  motor_modelo text,
  motor_ano int check (motor_ano is null or (motor_ano between 1960 and 2100)),
  fotos_painel text[] not null default '{}',
  observacoes text,

  created_at timestamptz not null default now()
);

create index idx_connect_interesses_embarcacao on public.connect_interesses (embarcacao_id, created_at desc);

alter table public.connect_interesses enable row level security;

-- Mesma régua da ficha da embarcação (aba "embarcacao") — Connect é sobre
-- a conectividade do BARCO como um todo, não de um equipamento específico.
create policy "connect_interesses: ver pela matriz" on public.connect_interesses for select
  using (public.permissao(embarcacao_id, 'embarcacao', 'ver'));
create policy "connect_interesses: criar pela matriz" on public.connect_interesses for insert
  with check (public.permissao(embarcacao_id, 'embarcacao', 'editar'));
-- Sem update/delete: é um registro de interesse, histórico — corrigir um
-- envio errado é enviar de novo (o mesmo padrão de "sondagens" nunca
-- editam a leitura original).

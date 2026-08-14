-- 037: mural de oportunidades (PRD upgrade2-master §49, §53-54) +
-- Prestadores como TIPO de perfis_comandante (PRD §50) — reaproveita a
-- mesma tabela/RLS/trigger anti-autoverificacao do §47 (Comandantes) em vez
-- de inventar arquitetura nova, exatamente como pedido na task da onda 39.
--
-- Nomenclatura (ver auditoria docs/auditoria/2026-08-14-prd-upgrade2-parte2.md,
-- secao 1.3, e docs/CONTRIBUTING.md secao Glossario): o glossario ja tinha
-- decidido "Marketplace -> Comandantes" pra vitrine de perfis (auditoria de
-- usabilidade 08/08/2026). O "Marketplace" do PRD (oportunidades/vagas/
-- diarias/"COMPRO X") e um conceito DIFERENTE — nome final escolhido
-- "Oportunidades" (bate com o proprio texto do PRD em §53: "Marketplace e a
-- area de: Oportunidades") pra nao reintroduzir a ambiguidade que a
-- auditoria de usabilidade ja tinha resolvido. Rota nova: /oportunidades.
--
-- Comissao (10%) e preco-piso (R$350, §49) ficam DE FORA — o PRD marca como
-- "estudados, nao fechados"; decisao comercial do dono, nao desta onda. A
-- area funciona como mural de contato: publica, responde, combina fora do
-- app — nao promete intermediacao de pagamento nenhuma.

-- --- Prestadores: extensao de perfis_comandante -----------------------
-- "categoria" ja existia como texto livre (habilitacao do comandante,
-- ex. "Capitao Amador") — pro tipo "prestador" o mesmo campo guarda a
-- especialidade (ex. "Mecanico", "Eletricista"), o formulario so troca a
-- sugestao do datalist. Nenhuma coluna nova alem de `tipo`: bio, telefone,
-- disponibilidade, visivel, verificado (protegido pelo trigger da
-- migration 009, que nao muda — continua valendo pra QUALQUER linha desta
-- tabela, independente do tipo) servem os dois papeis igualmente bem.
alter table public.perfis_comandante
  add column tipo text not null default 'comandante' check (tipo in ('comandante', 'prestador'));

create index perfis_comandante_tipo_idx on public.perfis_comandante (tipo) where visivel;

-- --- Oportunidades: o mural de verdade ---------------------------------
create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('vaga', 'diaria', 'peca_servico')),
  titulo text not null,
  categoria text,
  descricao text,
  local text,
  status text not null default 'aberta' check (status in ('aberta', 'atendida', 'encerrada')),
  created_at timestamptz not null default now()
);

create index oportunidades_status_idx on public.oportunidades (status, created_at desc);

alter table public.oportunidades enable row level security;

create policy "oportunidades: ver abertas ou a propria" on public.oportunidades
  for select to authenticated
  using (status = 'aberta' or autor_id = (select auth.uid()));

create policy "oportunidades: autor publica" on public.oportunidades
  for insert to authenticated
  with check (autor_id = (select auth.uid()));

create policy "oportunidades: autor gerencia a propria" on public.oportunidades
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "oportunidades: autor exclui a propria" on public.oportunidades
  for delete to authenticated
  using (autor_id = (select auth.uid()));

-- --- Respostas: quem publicou E quem respondeu, nunca terceiros --------
create table public.respostas_oportunidade (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  respondente_id uuid not null references public.profiles(id) on delete cascade,
  mensagem text not null,
  telefone text,
  created_at timestamptz not null default now(),
  unique (oportunidade_id, respondente_id)
);

alter table public.respostas_oportunidade enable row level security;

create policy "respostas: publicador ou respondente ve" on public.respostas_oportunidade
  for select to authenticated
  using (
    respondente_id = (select auth.uid())
    or exists (
      select 1 from public.oportunidades o
      where o.id = oportunidade_id and o.autor_id = (select auth.uid())
    )
  );

create policy "respostas: responde a oportunidade aberta" on public.respostas_oportunidade
  for insert to authenticated
  with check (
    respondente_id = (select auth.uid())
    and exists (select 1 from public.oportunidades o where o.id = oportunidade_id and o.status = 'aberta')
  );

create policy "respostas: respondente retira a propria" on public.respostas_oportunidade
  for delete to authenticated
  using (respondente_id = (select auth.uid()));

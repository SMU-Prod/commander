create table public.push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_assinaturas enable row level security;
create policy "push: proprias" on public.push_assinaturas for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create table public.alertas_enviados (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  item_monitorado_id uuid not null references public.itens_monitorados(id) on delete cascade,
  janela text not null check (janela in ('d30','d15','d5','vencido','h_margem','h_vencido')),
  ciclo_ref text not null default '',
  titulo text not null default '',
  enviado_em timestamptz not null default now(),
  unique (item_monitorado_id, janela, ciclo_ref)
);
alter table public.alertas_enviados enable row level security;
create policy "alertas: ver com vinculo" on public.alertas_enviados for select
  using (public.pode_ver_embarcacao(embarcacao_id));

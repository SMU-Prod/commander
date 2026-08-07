-- 017: assinaturas Asaas — o estado espelhado do gateway.
-- Escrita de status e via webhook (service_role); o usuario so cria a propria
-- linha pendente e le/cancela a propria assinatura.

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  asaas_customer_id text not null,
  asaas_subscription_id text not null unique,
  plano text not null check (plano in ('fundador_mensal','fundador_anual')),
  status text not null default 'pendente'
    check (status in ('pendente','ativa','inadimplente','cancelada')),
  valor_centavos integer not null check (valor_centavos > 0),
  fundador_numero integer unique check (fundador_numero between 1 and 100),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index assinaturas_usuario_idx on public.assinaturas (usuario_id);
create index assinaturas_status_idx on public.assinaturas (status);

alter table public.assinaturas enable row level security;

create policy "assinatura: ver a propria" on public.assinaturas
  for select to authenticated using (usuario_id = (select auth.uid()));

-- criar: so a propria, so pendente, sem se autoproclamar fundador
create policy "assinatura: criar a propria pendente" on public.assinaturas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and status = 'pendente' and fundador_numero is null);

-- atualizar: o usuario so pode cancelar a propria (status e a unica coluna que muda)
create policy "assinatura: cancelar a propria" on public.assinaturas
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()) and status = 'cancelada');

-- numero de fundador: atribuido quando a assinatura ATIVA, na ordem de ativacao
create or replace function public.atribuir_fundador_numero()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ativa' and new.fundador_numero is null then
    select coalesce(max(fundador_numero), 0) + 1 into new.fundador_numero from public.assinaturas;
    if new.fundador_numero > 100 then new.fundador_numero := null; end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger assinaturas_fundador before update on public.assinaturas
  for each row execute function public.atribuir_fundador_numero();

-- contador da landing (pagina anonima): vagas que sobram da promo
create or replace function public.vagas_fundador_restantes()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0, 100 - count(*))::integer
  from public.assinaturas where status in ('pendente','ativa','inadimplente');
$$;
revoke all on function public.vagas_fundador_restantes() from public;
grant execute on function public.vagas_fundador_restantes() to anon, authenticated;

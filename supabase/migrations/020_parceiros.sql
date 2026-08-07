-- 020: parceiros comerciais no mapa (espec v3 §11 + conversa 07/08).
-- Autoatendimento: o parceiro e um usuario comum com linha aqui e painel proprio.
-- tem_poita/qtd_poitas sao o gancho da onda 9 (aluguel de poita) — so exibicao por ora.

create table public.parceiros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique references auth.users(id) on delete cascade,
  categoria text not null check (categoria in ('marina','posto','pousada','restaurante')),
  nome text not null,
  sobre text,
  telefone text,
  email text,
  horario text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  preco_diaria_centavos integer check (preco_diaria_centavos > 0),
  preco_diesel_centavos integer check (preco_diesel_centavos > 0),
  calado_max_m numeric,
  tem_poita boolean not null default false,
  qtd_poitas integer check (qtd_poitas >= 0),
  traslado_incluso boolean,
  vaga_cortesia boolean,
  culinaria text,
  plano text not null default 'cortesia' check (plano in ('cortesia','basico','destaque')),
  visivel boolean not null default true,
  fotos text[] not null default '{}' check (coalesce(array_length(fotos, 1), 0) <= 3),
  visualizacoes integer not null default 0,
  precos_atualizados_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index parceiros_categoria_idx on public.parceiros (categoria) where visivel;

alter table public.parceiros enable row level security;

create policy "parceiro: ver visiveis ou o proprio" on public.parceiros
  for select to authenticated
  using (visivel or usuario_id = (select auth.uid()));

create policy "parceiro: criar o proprio" on public.parceiros
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and plano = 'cortesia' and visualizacoes = 0);

create policy "parceiro: editar o proprio" on public.parceiros
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- plano quem muda e a operacao (service_role); visualizacoes so via RPC;
-- precos_atualizados_em so via trigger. Privilegio de coluna trava o resto.
revoke update on table public.parceiros from authenticated;
grant update (categoria, nome, sobre, telefone, email, horario, lat, lng,
  preco_diaria_centavos, preco_diesel_centavos, calado_max_m, tem_poita, qtd_poitas,
  traslado_incluso, vaga_cortesia, culinaria, visivel, fotos)
  on table public.parceiros to authenticated;

-- regra da espec: 1 atualizacao de preco/disponibilidade por dia
create or replace function public.parceiro_regras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.preco_diaria_centavos is distinct from old.preco_diaria_centavos)
     or (new.preco_diesel_centavos is distinct from old.preco_diesel_centavos)
     or (new.qtd_poitas is distinct from old.qtd_poitas) then
    if old.precos_atualizados_em is not null
       and old.precos_atualizados_em::date = current_date then
      raise exception 'limite de 1 atualizacao de preco/disponibilidade por dia';
    end if;
    new.precos_atualizados_em := now();
  else
    new.precos_atualizados_em := old.precos_atualizados_em;
  end if;
  new.plano := old.plano;
  new.visualizacoes := old.visualizacoes;
  new.atualizado_em := now();
  return new;
end $$;
create trigger parceiros_regras before update on public.parceiros
  for each row execute function public.parceiro_regras();
revoke execute on function public.parceiro_regras() from public, anon, authenticated;

-- contador de visualizacoes (metrica de renovacao do parceiro)
create or replace function public.registrar_visualizacao(p_parceiro_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.parceiros set visualizacoes = visualizacoes + 1
  where id = p_parceiro_id and visivel;
$$;
revoke all on function public.registrar_visualizacao(uuid) from public, anon;
grant execute on function public.registrar_visualizacao(uuid) to authenticated;

-- bucket publico de fotos do parceiro (conteudo de marketing; leitura aberta,
-- escrita so na propria pasta <usuario_id>/...)
insert into storage.buckets (id, name, public) values ('parceiros', 'parceiros', true)
  on conflict (id) do nothing;
create policy "parceiros: subir na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'parceiros' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "parceiros: apagar da propria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'parceiros' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- perfis espelham auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  telefone text,
  created_at timestamptz not null default now()
);

create table public.embarcacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  estaleiro text, modelo text, ano int,
  comprimento_m numeric, boca_m numeric, calado_m numeric,
  casco_material text, casco_numero text,
  tie text, capitania text, propulsao text, marina text,
  created_at timestamptz not null default now()
);

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  papel text not null check (papel in ('PROP','CMDT')),
  nivel text not null default 'completo' check (nivel in ('completo','operacional')),
  created_at timestamptz not null default now(),
  unique (usuario_id, embarcacao_id)
);

create table public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  tipo text not null check (tipo in ('motor','gerador','bateria','outro')),
  posicao text check (posicao in ('BB','BE','central')),
  marca text, modelo text, numero_serie text, ano int,
  potencia_hp int, combustivel text,
  horas_atuais numeric,
  ultima_leitura timestamptz,
  created_at timestamptz not null default now()
);

create table public.itens_monitorados (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  equipamento_id uuid references public.equipamentos(id) on delete cascade,
  nome text not null,
  intervalo_horas numeric,
  intervalo_meses int,
  data_fixa date,
  ultimo_ciclo_data date,
  ultimo_ciclo_horas numeric,
  created_at timestamptz not null default now(),
  check (intervalo_horas is not null or intervalo_meses is not null or data_fixa is not null)
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  equipamento_id uuid references public.equipamentos(id) on delete set null,
  item_monitorado_id uuid references public.itens_monitorados(id) on delete set null,
  tipo text not null check (tipo in ('manutencao','abastecimento','navegacao','avaria','docagem','leitura_horas')),
  data date not null default current_date,
  horas_no_momento numeric,
  descricao text,
  custo_centavos bigint,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- perfil criado automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- acesso: quem tem vínculo enxerga a embarcação
create or replace function public.pode_ver_embarcacao(emb uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = auth.uid()
  );
$$;

-- criação atômica embarcação + vínculo PROP (evita brecha de insert)
create or replace function public.criar_embarcacao(
  p_nome text, p_estaleiro text, p_modelo text, p_ano int, p_marina text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.embarcacoes (nome, estaleiro, modelo, ano, marina)
  values (p_nome, p_estaleiro, p_modelo, p_ano, p_marina)
  returning id into v_id;
  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), v_id, 'PROP');
  return v_id;
end $$;

revoke all on function public.criar_embarcacao from public, anon;
grant execute on function public.criar_embarcacao to authenticated;

-- RLS em tudo, sempre
alter table public.profiles enable row level security;
alter table public.embarcacoes enable row level security;
alter table public.vinculos enable row level security;
alter table public.equipamentos enable row level security;
alter table public.itens_monitorados enable row level security;
alter table public.eventos enable row level security;

create policy "proprio perfil: ver" on public.profiles for select using (id = auth.uid());
create policy "proprio perfil: editar" on public.profiles for update using (id = auth.uid());

create policy "embarcacao: ver" on public.embarcacoes for select using (public.pode_ver_embarcacao(id));
create policy "embarcacao: editar" on public.embarcacoes for update using (public.pode_ver_embarcacao(id));

create policy "vinculos: ver os da embarcacao" on public.vinculos for select
  using (usuario_id = auth.uid() or public.pode_ver_embarcacao(embarcacao_id));

create policy "equipamentos: tudo com vinculo" on public.equipamentos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

create policy "itens: tudo com vinculo" on public.itens_monitorados for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

create policy "eventos: tudo com vinculo" on public.eventos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

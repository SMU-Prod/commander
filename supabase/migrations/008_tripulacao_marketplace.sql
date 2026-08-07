alter table public.vinculos add column permissoes jsonb;
alter table public.vinculos drop constraint vinculos_nivel_check;

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  codigo text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  permissoes jsonb not null,
  nivel text not null default 'operacional',
  criado_por uuid references public.profiles(id) on delete set null,
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references public.profiles(id),
  usado_em timestamptz,
  created_at timestamptz not null default now()
);

create table public.perfis_comandante (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  nome_publico text not null,
  categoria text,
  cidade text,
  bio text,
  telefone text,
  disponibilidade text,
  visivel boolean not null default true,
  verificado boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.eh_prop(emb uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = auth.uid() and v.papel = 'PROP'
  );
$$;
revoke all on function public.eh_prop(uuid) from public, anon;
grant execute on function public.eh_prop(uuid) to authenticated;

create or replace function public.permissao(emb uuid, aba text, modo text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = auth.uid()
      and (
        v.papel = 'PROP'
        or coalesce((v.permissoes -> aba ->> modo)::boolean, false)
      )
  );
$$;
revoke all on function public.permissao(uuid, text, text) from public, anon;
grant execute on function public.permissao(uuid, text, text) to authenticated;

alter table public.convites enable row level security;
create policy "convites: prop gerencia" on public.convites for all
  using (public.eh_prop(embarcacao_id)) with check (public.eh_prop(embarcacao_id));

alter table public.perfis_comandante enable row level security;
create policy "perfis: vitrine" on public.perfis_comandante for select
  using (visivel = true or usuario_id = auth.uid());
create policy "perfis: proprio insert" on public.perfis_comandante for insert
  with check (usuario_id = auth.uid());
create policy "perfis: proprio update" on public.perfis_comandante for update
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "vinculos: prop atualiza cmdt" on public.vinculos for update
  using (public.eh_prop(embarcacao_id) and papel = 'CMDT')
  with check (public.eh_prop(embarcacao_id) and papel = 'CMDT');
create policy "vinculos: prop remove cmdt" on public.vinculos for delete
  using (public.eh_prop(embarcacao_id) and papel = 'CMDT');

drop policy "proprio perfil: ver" on public.profiles;
create policy "perfil: proprio ou tripulacao" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.vinculos v1
      join public.vinculos v2 on v1.embarcacao_id = v2.embarcacao_id
      where v1.usuario_id = auth.uid() and v2.usuario_id = profiles.id
    )
  );

drop policy "documentos: tudo com vinculo" on public.documentos;
create policy "documentos: ver pela matriz" on public.documentos for select
  using (public.permissao(embarcacao_id, 'documentos', 'ver'));
create policy "documentos: criar pela matriz" on public.documentos for insert
  with check (public.permissao(embarcacao_id, 'documentos', 'editar'));
create policy "documentos: atualizar pela matriz" on public.documentos for update
  using (public.permissao(embarcacao_id, 'documentos', 'editar'))
  with check (public.permissao(embarcacao_id, 'documentos', 'editar'));
create policy "documentos: excluir pela matriz" on public.documentos for delete
  using (public.permissao(embarcacao_id, 'documentos', 'editar'));

drop policy "contatos: tudo com vinculo" on public.contatos;
create policy "contatos: ver pela matriz" on public.contatos for select
  using (public.permissao(embarcacao_id, 'contatos', 'ver'));
create policy "contatos: criar pela matriz" on public.contatos for insert
  with check (public.permissao(embarcacao_id, 'contatos', 'editar'));
create policy "contatos: atualizar pela matriz" on public.contatos for update
  using (public.permissao(embarcacao_id, 'contatos', 'editar'))
  with check (public.permissao(embarcacao_id, 'contatos', 'editar'));
create policy "contatos: excluir pela matriz" on public.contatos for delete
  using (public.permissao(embarcacao_id, 'contatos', 'editar'));

drop policy "embarcacao: editar" on public.embarcacoes;
create policy "embarcacao: prop edita" on public.embarcacoes for update
  using (public.eh_prop(id)) with check (public.eh_prop(id));

drop policy "acervo: ler com vinculo" on storage.objects;
create policy "acervo: ler pela matriz" on storage.objects for select to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'ver'))
      or ((storage.foldername(name))[2] <> 'documentos'
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );

create or replace function public.info_convite(p_codigo text)
returns table (nome_embarcacao text, valido boolean)
language sql security definer stable set search_path = public as $$
  select e.nome, (c.usado_em is null and c.expira_em > now())
  from public.convites c
  join public.embarcacoes e on e.id = c.embarcacao_id
  where c.codigo = p_codigo;
$$;
revoke all on function public.info_convite(text) from public, anon;
grant execute on function public.info_convite(text) to authenticated;

create or replace function public.aceitar_convite(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into c from public.convites
    where codigo = p_codigo and usado_em is null and expira_em > now();
  if not found then
    raise exception 'convite inválido ou expirado';
  end if;
  if exists (
    select 1 from public.vinculos
    where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()
  ) then
    raise exception 'você já faz parte desta tripulação';
  end if;
  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel, permissoes)
    values (auth.uid(), c.embarcacao_id, 'CMDT', c.nivel, c.permissoes);
  update public.convites set usado_por = auth.uid(), usado_em = now() where id = c.id;
  return c.embarcacao_id;
end $$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;

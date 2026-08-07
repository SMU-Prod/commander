create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  album text not null check (album in ('exterior','interior','conves','documentacao')),
  arquivo_path text not null,
  bytes bigint not null default 0,
  legenda text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_fotos_embarcacao on public.fotos (embarcacao_id, created_at desc);

alter table public.embarcacoes add column foto_capa_path text;

alter table public.fotos enable row level security;
create policy "fotos: ver pela matriz" on public.fotos for select
  using (public.permissao(embarcacao_id, 'fotos', 'ver'));
create policy "fotos: criar pela matriz" on public.fotos for insert
  with check (public.permissao(embarcacao_id, 'fotos', 'editar'));
create policy "fotos: atualizar pela matriz" on public.fotos for update
  using (public.permissao(embarcacao_id, 'fotos', 'editar'))
  with check (public.permissao(embarcacao_id, 'fotos', 'editar'));
create policy "fotos: excluir pela matriz" on public.fotos for delete
  using (public.permissao(embarcacao_id, 'fotos', 'editar'));

-- storage: prefixo fotos/ segue a mesma matriz
drop policy "acervo: ler pela matriz" on storage.objects;
create policy "acervo: ler pela matriz" on storage.objects for select to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'ver'))
      or ((storage.foldername(name))[2] = 'fotos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'fotos', 'ver'))
      or ((storage.foldername(name))[2] not in ('documentos','fotos')
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );
drop policy "acervo: gravar pela matriz" on storage.objects;
create policy "acervo: gravar pela matriz" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'editar'))
      or ((storage.foldername(name))[2] = 'fotos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'fotos', 'editar'))
      or ((storage.foldername(name))[2] not in ('documentos','fotos')
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );
drop policy "acervo: apagar pela matriz" on storage.objects;
create policy "acervo: apagar pela matriz" on storage.objects for delete to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'editar'))
      or ((storage.foldername(name))[2] = 'fotos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'fotos', 'editar'))
      or ((storage.foldername(name))[2] not in ('documentos','fotos')
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );

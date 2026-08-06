create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  nome text not null,
  especialidade text,
  telefone text,
  avaliacao int check (avaliacao between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  nome text not null,
  arquivo_path text,
  validade date,
  item_monitorado_id uuid references public.itens_monitorados(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.itens_monitorados add column categoria text
  check (categoria in ('documento','deck','fibra','inox','vidros','estofados','casco_outros'));
alter table public.eventos add column contato_id uuid references public.contatos(id) on delete set null;
alter table public.eventos add column categoria text
  check (categoria in ('documento','deck','fibra','inox','vidros','estofados','casco_outros'));
alter table public.eventos add column anexo_path text;
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('manutencao','abastecimento','navegacao','avaria','docagem','leitura_horas','outro'));

-- seeds antigos de documento ganham a categoria
update public.itens_monitorados set categoria = 'documento'
  where equipamento_id is null and categoria is null;

alter table public.contatos enable row level security;
alter table public.documentos enable row level security;
create policy "contatos: tudo com vinculo" on public.contatos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));
create policy "documentos: tudo com vinculo" on public.documentos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

insert into storage.buckets (id, name, public) values ('acervo', 'acervo', false);
create policy "acervo: ler com vinculo" on storage.objects for select to authenticated
  using (bucket_id = 'acervo' and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid));
create policy "acervo: gravar com vinculo" on storage.objects for insert to authenticated
  with check (bucket_id = 'acervo' and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid));
create policy "acervo: apagar com vinculo" on storage.objects for delete to authenticated
  using (bucket_id = 'acervo' and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid));

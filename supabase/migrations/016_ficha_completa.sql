alter table public.equipamentos add column identificacao_interna text;
alter table public.equipamentos add column quantidade integer;
alter table public.equipamentos add column foto_path text;
alter table public.equipamentos add column observacoes text;

alter table public.itens_monitorados add column especificacao text;
alter table public.itens_monitorados add column quantidade text;

alter table public.profiles add column avatar_path text;

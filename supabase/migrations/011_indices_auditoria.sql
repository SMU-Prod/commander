create index if not exists idx_eventos_criado_por on public.eventos (criado_por);
create index if not exists idx_convites_criado_por on public.convites (criado_por);
create index if not exists idx_convites_usado_por on public.convites (usado_por);

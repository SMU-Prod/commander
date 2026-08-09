-- =====================================================================
-- Onda 15 · "Motor vivo" — sistemas do equipamento (Arrefecimento,
-- Injeção, Elétrica do motor, Transmissão...) apontando pra página certa
-- do manual do fabricante, já guardado no acervo. Pedido do Pedro: "se o
-- cara botar que o motor dele é um caterpillar, aparecer o caterpillar
-- lá... que ele clica na peça e abre a peça no manual".
-- =====================================================================

create table public.equipamento_sistemas (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references public.equipamentos(id) on delete cascade,
  nome text not null,
  -- nullable de propósito: um sistema pode existir antes do manual ser
  -- anexado ao acervo — é o estado "sem manual vinculado" da tela.
  documento_id uuid references public.documentos(id) on delete set null,
  pagina int check (pagina is null or pagina > 0),
  observacao text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_equipamento_sistemas_equipamento on public.equipamento_sistemas (equipamento_id);
create index idx_equipamento_sistemas_documento on public.equipamento_sistemas (documento_id);

-- Helper: mesma régua da aba do equipamento (motores/eletrica) — quem pode
-- ver/editar o equipamento pode ver/editar os sistemas dele. Centralizado
-- aqui em vez de repetir o join em cada policy (mesmo espírito de
-- aba_do_equipamento/aba_alvo da migration 010).
create or replace function public.permissao_sistema(p_equipamento_id uuid, p_modo text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.equipamentos e
    where e.id = p_equipamento_id
      and public.permissao(e.embarcacao_id, public.aba_do_equipamento(e.tipo), p_modo)
  );
$$;
revoke all on function public.permissao_sistema(uuid, text) from public, anon;
grant execute on function public.permissao_sistema(uuid, text) to authenticated;

alter table public.equipamento_sistemas enable row level security;

create policy "sistemas: ver pela matriz" on public.equipamento_sistemas for select
  using (public.permissao_sistema(equipamento_id, 'ver'));
create policy "sistemas: criar pela matriz" on public.equipamento_sistemas for insert
  with check (public.permissao_sistema(equipamento_id, 'editar'));
create policy "sistemas: atualizar pela matriz" on public.equipamento_sistemas for update
  using (public.permissao_sistema(equipamento_id, 'editar'))
  with check (public.permissao_sistema(equipamento_id, 'editar'));
create policy "sistemas: excluir pela matriz" on public.equipamento_sistemas for delete
  using (public.permissao_sistema(equipamento_id, 'editar'));

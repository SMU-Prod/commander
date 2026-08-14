-- =====================================================================
-- Onda 32 · Ocorrências (entidade com estado), hubs Hidráulica/Segurança
-- (categoria-based, mesmo padrão do Casco) e matriz de permissões com as
-- 13 áreas do PRD (antes 9 — faltavam Hidráulica, Segurança, Equipamentos
-- e Histórico). Ver docs/auditoria/2026-08-14-prd-upgrade2-parte1.md §5/§15/§16/§22.
-- =====================================================================

-- 1) Categorias novas em itens_monitorados/eventos: Hidráulica (3) e
--    Segurança (1) — sem tabela nova, mesmo padrão do Casco (migration 003).
alter table public.itens_monitorados drop constraint itens_monitorados_categoria_check;
alter table public.itens_monitorados add constraint itens_monitorados_categoria_check
  check (categoria in (
    'documento','deck','fibra','inox','vidros','estofados','casco_outros',
    'hidraulica_agua_doce','hidraulica_grey_water','hidraulica_black_water','seguranca'
  ));

alter table public.eventos drop constraint eventos_categoria_check;
alter table public.eventos add constraint eventos_categoria_check
  check (categoria in (
    'documento','deck','fibra','inox','vidros','estofados','casco_outros',
    'hidraulica_agua_doce','hidraulica_grey_water','hidraulica_black_water','seguranca'
  ));

-- 2) Equipamentos "outro" (colete, bote, VHF...) ganham área própria
--    (PRD §17) em vez de caírem em Elétrica. `aba_alvo` já existia
--    exatamente pra isso (migration 010) — só o mapeamento muda.
create or replace function public.aba_do_equipamento(p_tipo text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_tipo = 'motor' then 'motores'
    when p_tipo = 'outro' then 'equipamentos'
    else 'eletrica'
  end;
$$;

create or replace function public.aba_alvo(p_equipamento_id uuid, p_categoria text)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select public.aba_do_equipamento(e.tipo) from public.equipamentos e where e.id = p_equipamento_id),
    case
      when p_categoria = 'documento' then 'documentos'
      when p_categoria in ('deck','fibra','inox','vidros','estofados','casco_outros') then 'casco'
      when p_categoria in ('hidraulica_agua_doce','hidraulica_grey_water','hidraulica_black_water') then 'hidraulica'
      when p_categoria = 'seguranca' then 'seguranca'
      else 'embarcacao'
    end
  );
$$;

-- 3) Migração de acesso — vínculo CMDT existente não pode perder nem ganhar
--    acesso indevido (CLAUDE.md, seção 2). Duas áreas novas herdam o valor
--    de uma área velha que já cobria a mesma coisa na prática:
--      - "equipamentos" herda de "eletrica" (era lá que tipo='outro' caía
--        até agora — sem isso, um CMDT que já editava elétrica perderia a
--        capacidade de editar os equipamentos "outro" que já podia editar).
--      - "historico" herda de "diario" (o feed central de hoje é o próprio
--        /diario — ver quem já via o feed continua vendo o mesmo tanto).
--    Hidráulica e Segurança NÃO herdam nada: são hubs 100% novos, então o
--    default (sem a chave = ver/editar false) é o comportamento correto —
--    dar acesso de graça a algo que não existia seria "ganhar indevido".
--    PROP (permissoes is null) não passa por aqui: já tem tudo por papel.
update public.vinculos
set permissoes = permissoes
  || jsonb_build_object('equipamentos', coalesce(permissoes -> 'eletrica', '{}'::jsonb))
  || jsonb_build_object('historico', coalesce(permissoes -> 'diario', '{}'::jsonb))
where permissoes is not null;

-- 4) OCORRÊNCIAS — a entidade com estado que faltava (PRD §22). Nasce
--    ligada a um setor (aba), opcionalmente a um equipamento/manutenção e
--    ao evento de diário que a originou.
create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  aba text not null check (aba in (
    'embarcacao','motores','eletrica','casco','hidraulica','seguranca','equipamentos','documentos'
  )),
  equipamento_id uuid references public.equipamentos(id) on delete set null,
  item_monitorado_id uuid references public.itens_monitorados(id) on delete set null,
  evento_id uuid references public.eventos(id) on delete set null,
  titulo text not null,
  descricao text,
  estado text not null default 'aberta' check (estado in ('aberta','em_acompanhamento','resolvida')),
  gravidade text check (gravidade in ('baixa','media','alta')),
  anexo_path text,
  criado_por uuid references public.profiles(id) on delete set null,
  resolvida_em timestamptz,
  created_at timestamptz not null default now()
);

-- Histórico de transições de estado (PRD: "quando resolvida, o evento
-- permanece no histórico" — a ocorrência NUNCA é apagada; esta tabela é o
-- rastro de quem mudou o quê e quando).
create table public.ocorrencias_transicoes (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  estado_anterior text check (estado_anterior in ('aberta','em_acompanhamento','resolvida')),
  estado_novo text not null check (estado_novo in ('aberta','em_acompanhamento','resolvida')),
  observacao text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_ocorrencias_embarcacao on public.ocorrencias (embarcacao_id, estado, created_at desc);
create index idx_ocorrencias_evento on public.ocorrencias (evento_id);
create index idx_ocorrencias_equipamento on public.ocorrencias (equipamento_id);
create index idx_ocorrencias_transicoes_ocorrencia on public.ocorrencias_transicoes (ocorrencia_id, created_at);

alter table public.ocorrencias enable row level security;
alter table public.ocorrencias_transicoes enable row level security;

-- RLS pela matriz — mesma régua do resto (aba direta, não `aba_alvo`,
-- porque a ocorrência já grava o setor explicitamente na abertura).
create policy "ocorrencias: ver pela matriz" on public.ocorrencias for select
  using (public.permissao(embarcacao_id, aba, 'ver'));
create policy "ocorrencias: criar pela matriz" on public.ocorrencias for insert
  with check (public.permissao(embarcacao_id, aba, 'editar'));
create policy "ocorrencias: atualizar pela matriz" on public.ocorrencias for update
  using (public.permissao(embarcacao_id, aba, 'editar'))
  with check (public.permissao(embarcacao_id, aba, 'editar'));
create policy "ocorrencias: excluir pela matriz" on public.ocorrencias for delete
  using (public.permissao(embarcacao_id, aba, 'editar'));

-- Transições seguem a mesma aba da ocorrência-mãe (join, sem coluna própria
-- de embarcacao_id — evita a transição apontar pra um setor diferente do
-- registro que ela documenta).
create policy "transicoes: ver pela matriz da ocorrencia" on public.ocorrencias_transicoes for select
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = ocorrencia_id and public.permissao(o.embarcacao_id, o.aba, 'ver')
  ));
create policy "transicoes: criar pela matriz da ocorrencia" on public.ocorrencias_transicoes for insert
  with check (exists (
    select 1 from public.ocorrencias o
    where o.id = ocorrencia_id and public.permissao(o.embarcacao_id, o.aba, 'editar')
  ));

revoke all on function public.aba_do_equipamento(text) from public, anon;
revoke all on function public.aba_alvo(uuid, text) from public, anon;
grant execute on function public.aba_do_equipamento(text) to authenticated;
grant execute on function public.aba_alvo(uuid, text) to authenticated;

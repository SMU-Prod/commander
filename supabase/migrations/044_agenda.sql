-- =====================================================================
-- Onda 43 · AGENDA (PRD FINAL §8)
--
-- POR QUE `agenda_eventos` E NÃO `eventos`:
-- `public.eventos` JÁ EXISTE e é o DIÁRIO DE BORDO (saída, abastecimento,
-- manutenção realizada — o que ACONTECEU). A Agenda é o oposto: o que está
-- MARCADO pra acontecer. O PRD usa a palavra "evento" pros dois, e essa
-- colisão de vocabulário vai confundir quem ler o banco daqui a seis meses.
-- Por isso a tabela nova nasce com prefixo: `agenda_eventos` /
-- `agenda_participantes`. Nenhuma linha do Diário se move.
--
-- REGRA DE SEGURANÇA DO PRD, LITERAL:
--   "Receber um evento não concede acesso ao Hub relacionado."
-- Um compromisso pode APONTAR pra uma manutenção (`item_monitorado_id`),
-- mas nenhuma policy aqui embaixo faz join com `itens_monitorados` — quem
-- decide se o item pode ser LIDO continua sendo a RLS de
-- `itens_monitorados` (matriz por `aba_alvo`). Na prática: o comandante que
-- recebeu "Revisão dos 500h — sábado" vê o compromisso, e a consulta do
-- item volta vazia se ele não tem Motores. A tela trata isso mostrando o
-- compromisso sem o vínculo técnico, nunca o nome do item vazado no título.
--
-- ÁREA DE PERMISSÃO — DÍVIDA CONHECIDA (onda 44):
-- O PRD pede uma permissão própria, "Gerenciar eventos da embarcação"
-- (§8). A matriz (`web/lib/domain/permissoes.ts`) está sendo alterada por
-- outra frente nesta mesma janela, então NÃO se acrescenta área aqui —
-- seria conflito garantido. Enquanto isso a Agenda pega carona em
-- 'diario', a área existente mais próxima (mesma natureza operacional:
-- quem registra a saída é quem marca a saída). Consequência honesta: um
-- vínculo personalizado SEM diario não enxerga a própria agenda do barco.
-- Trocar 'diario' por 'agenda' aqui e no app é a onda 44 inteira.
--
-- APLICAÇÃO NO REMOTO: este arquivo é a fonte versionada; no projeto
-- `khgjtxvmduizyooqaoox` ele foi aplicado em 4 chamadas MCP (tabelas,
-- funções, RLS e a policy de UPDATE de participantes) porque o conector
-- rejeita blocos grandes. Mesmo SQL, mesma ordem.
-- =====================================================================

create table public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  titulo text not null,
  descricao text,
  -- Data de calendário + hora opcional: o PRD cita "Saída sábado — 08:00",
  -- mas compromisso de dia inteiro ("Vistoria na terça") é igualmente
  -- comum — por isso `hora` é nullable em vez de um timestamptz que
  -- obrigaria a inventar 00:00.
  data date not null,
  hora time,
  -- Os três modos do PRD. 'atribuido' é 'compartilhado' com um dono do
  -- recado: quem recebe está marcado como `responsavel` em
  -- agenda_participantes. Guardar o modo aqui (e não deduzir da tabela de
  -- participantes) é o que deixa a tela dizer "atribuído a Fulano" sem
  -- inventar significado a partir de uma linha solta.
  visibilidade text not null default 'particular'
    check (visibilidade in ('particular', 'compartilhado', 'atribuido')),
  -- Vínculo técnico OPCIONAL (ver "regra de segurança" no topo). Nunca
  -- amplia acesso: é só um ponteiro.
  item_monitorado_id uuid references public.itens_monitorados(id) on delete set null,
  -- "Histórico de coisas já realizadas não polui a Agenda normal" (PRD §8):
  -- concluir NÃO apaga — carimba, e o app tira da lista padrão. É o mesmo
  -- princípio do §7 ("registros finalizados não são apagados silenciosamente").
  concluido_em timestamptz,
  -- `set null` (não `cascade`) pelo mesmo motivo de `ocorrencias.criado_por`:
  -- autoria some, registro fica. Quem ainda participa continua vendo.
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.agenda_participantes (
  evento_id uuid not null references public.agenda_eventos(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  -- true = o evento foi ATRIBUÍDO a essa pessoa (não só compartilhado).
  responsavel boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

-- Mês/Semana/Lista sempre filtram por barco + faixa de datas.
create index idx_agenda_eventos_emb_data on public.agenda_eventos (embarcacao_id, data);
-- "A agenda que é minha": todo evento em que apareço, sem varrer a tabela.
create index idx_agenda_participantes_usuario on public.agenda_participantes (usuario_id);

-- ---------------------------------------------------------------------
-- Helpers SECURITY DEFINER — a razão é técnica, não preguiça: a policy de
-- `agenda_eventos` precisa consultar `agenda_participantes` e a de
-- `agenda_participantes` precisa consultar `agenda_eventos`. Escrito como
-- `exists (select ...)` direto, o Postgres entra em recursão infinita de
-- RLS. SECURITY DEFINER roda por dentro da RLS e corta o laço — mesmo
-- padrão de `public.permissao` e `public.eh_prop` (migration 008).
-- ---------------------------------------------------------------------
create or replace function public.agenda_dono(p_evento uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.agenda_eventos e
    where e.id = p_evento and e.criado_por = auth.uid()
  );
$$;

create or replace function public.agenda_participa(p_evento uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.agenda_participantes p
    where p.evento_id = p_evento and p.usuario_id = auth.uid()
  );
$$;

-- Compartilhar só com quem já tem vínculo com o MESMO barco. Sem isto, o
-- id de um usuário qualquer no formulário viraria "empurrei um compromisso
-- pra um estranho" — e pior, daria pra descobrir se um uuid existe.
create or replace function public.agenda_pode_compartilhar(p_evento uuid, p_usuario uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.agenda_eventos e
    join public.vinculos v on v.embarcacao_id = e.embarcacao_id
    where e.id = p_evento and v.usuario_id = p_usuario
  );
$$;

revoke all on function public.agenda_dono(uuid) from public, anon;
revoke all on function public.agenda_participa(uuid) from public, anon;
revoke all on function public.agenda_pode_compartilhar(uuid, uuid) from public, anon;
grant execute on function public.agenda_dono(uuid) to authenticated;
grant execute on function public.agenda_participa(uuid) to authenticated;
grant execute on function public.agenda_pode_compartilhar(uuid, uuid) to authenticated;

alter table public.agenda_eventos enable row level security;
alter table public.agenda_participantes enable row level security;

-- SELECT — PRD §8: "Agenda normal mostra somente eventos criados pelo
-- usuário ou compartilhados com ele." Repare que NÃO é "todo mundo do
-- barco vê tudo": ter acesso ao barco é condição necessária
-- (`permissao(...,'ver')`, que também garante que quem foi removido da
-- tripulação para de ver a agenda dele), mas não suficiente — ainda
-- precisa ser o criador ou estar na lista de participantes.
create policy "agenda: ver o que é meu ou foi compartilhado comigo"
  on public.agenda_eventos for select
  using (
    public.permissao(embarcacao_id, 'diario', 'ver')
    and (criado_por = auth.uid() or public.agenda_participa(id))
  );

-- INSERT — PRD §8: "Captain só pode criar/compartilhar eventos da
-- embarcação se tiver permissão 'Gerenciar eventos da embarcação'". PROP
-- passa sempre (`public.permissao` devolve true por papel).
create policy "agenda: criar com permissão de gerenciar eventos"
  on public.agenda_eventos for insert
  with check (
    criado_por = auth.uid()
    and public.permissao(embarcacao_id, 'diario', 'editar')
  );

-- UPDATE/DELETE — só quem criou mexe. Compartilhar um compromisso não é
-- entregar a caneta: quem recebeu vê, não reescreve nem apaga.
create policy "agenda: só o criador altera"
  on public.agenda_eventos for update
  using (criado_por = auth.uid() and public.permissao(embarcacao_id, 'diario', 'editar'))
  with check (criado_por = auth.uid() and public.permissao(embarcacao_id, 'diario', 'editar'));

create policy "agenda: só o criador exclui"
  on public.agenda_eventos for delete
  using (criado_por = auth.uid() and public.permissao(embarcacao_id, 'diario', 'editar'));

-- Participantes: cada um vê a própria linha; o criador vê a lista inteira
-- (precisa, pra tela dizer com quem já compartilhou).
create policy "agenda participantes: ver a minha linha ou a lista do meu evento"
  on public.agenda_participantes for select
  using (usuario_id = auth.uid() or public.agenda_dono(evento_id));

create policy "agenda participantes: só o criador compartilha"
  on public.agenda_participantes for insert
  with check (
    public.agenda_dono(evento_id)
    and public.agenda_pode_compartilhar(evento_id, usuario_id)
  );

-- Sem UPDATE, o upsert de "compartilhar de novo com quem já está" quebra, e
-- promover alguém de convidado a responsável exigiria remover e reincluir.
-- Só o criador — quem recebeu não se promove sozinho.
create policy "agenda participantes: só o criador muda o papel"
  on public.agenda_participantes for update
  using (public.agenda_dono(evento_id))
  with check (public.agenda_dono(evento_id));

-- Descompartilhar: o criador tira quem quiser; o participante pode sair
-- sozinho (recebeu um compromisso que não é dele — some da agenda dele
-- sem precisar pedir).
create policy "agenda participantes: criador remove, participante sai"
  on public.agenda_participantes for delete
  using (usuario_id = auth.uid() or public.agenda_dono(evento_id));

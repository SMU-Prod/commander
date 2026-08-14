-- =====================================================================
-- Onda 35 · Commander Gold operacional — fluxo completo (PRD de Correções
-- Correções 02/06/08/09/10/12/15/16/18/19): SOLICITAR GOLD → PAGAMENTO →
-- AGENDAMENTO → AVALIAÇÃO PRESENCIAL → PROTOCOLO COMMANDER → ANÁLISE →
-- APROVAÇÃO → COMMANDER GOLD. Nomes internos livres (Correção 18) — nunca
-- "Review" nem "vistoria" exposto ao cliente.
--
-- Ordem das tabelas importa: funções `language sql` são parseadas (e os
-- objetos referenciados resolvidos) na hora do CREATE — diferente de
-- `plpgsql`, que só valida sintaxe. Por isso toda tabela nasce ANTES de
-- qualquer função que a referencie.
-- =====================================================================

-- 0) Admin — não existia nenhum flag de papel administrativo no banco.
--    Concessão é manual via SQL pelo dono (nunca autoatendida), documentada
--    em docs/OPERACAO.md.
alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.eh_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

-- 1) Preços — configuráveis pelo admin, nunca hardcoded irreversível (PRD §39).
--    Semeados com a tabela de referência do PRD; 81+ fica "sob consulta" (null).
create table public.gold_precos (
  faixa text primary key check (faixa in ('ate_30','31_40','41_50','51_60','61_80','81_mais')),
  rotulo text not null,
  limite_pes int, -- null na última faixa (81+, sem teto)
  valor_centavos int, -- null = sob consulta
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
insert into public.gold_precos (faixa, rotulo, limite_pes, valor_centavos) values
  ('ate_30',  'Até 30 pés',  30,   199000),
  ('31_40',   '31–40 pés',   40,   249000),
  ('41_50',   '41–50 pés',   50,   349000),
  ('51_60',   '51–60 pés',   60,   449000),
  ('61_80',   '61–80 pés',   80,   599000),
  ('81_mais', '81+ pés',     null, null);

alter table public.gold_precos enable row level security;
create policy "gold_precos: qualquer autenticado ve" on public.gold_precos for select
  using (auth.uid() is not null);
create policy "gold_precos: admin atualiza" on public.gold_precos for update
  using (public.eh_admin()) with check (public.eh_admin());

-- 2) Consultores — cadastro mínimo (PRD §19, Admin > Consultores).
create table public.gold_consultores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid unique references public.profiles(id) on delete set null,
  nome text not null,
  email text,
  telefone text,
  regiao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.gold_consultores enable row level security;
create policy "gold_consultores: admin gerencia" on public.gold_consultores for all
  using (public.eh_admin()) with check (public.eh_admin());
create policy "gold_consultores: proprio perfil" on public.gold_consultores for select
  using (usuario_id = auth.uid());

-- 3) Solicitações — "minha embarcação" (embarcacao_id) OU "outra embarcação"
--    ainda não cadastrada (Correção 09: comprador/interessado avaliando
--    barco de terceiro). Estado com ciclo completo do fluxo oficial.
create table public.gold_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid references public.embarcacoes(id) on delete cascade,
  embarcacao_externa_nome text,
  embarcacao_externa_local text,
  embarcacao_externa_obs text,
  faixa_porte text not null references public.gold_precos(faixa),
  solicitante_id uuid not null references public.profiles(id) on delete cascade,
  papel_solicitante text not null check (papel_solicitante in ('proprietario','interessado')),
  quem_paga text not null check (quem_paga in ('proprio','interessado')),
  estado text not null default 'solicitado' check (estado in (
    'solicitado','aguardando_pagamento','pago','aguardando_agendamento','agendado',
    'avaliacao_realizada','em_analise','aprovado','reprovado','cancelado'
  )),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint gold_solicitacoes_embarcacao_ou_externa check (
    (embarcacao_id is not null and embarcacao_externa_nome is null)
    or (embarcacao_id is null and embarcacao_externa_nome is not null)
  )
);
create index idx_gold_solicitacoes_embarcacao on public.gold_solicitacoes (embarcacao_id);
create index idx_gold_solicitacoes_solicitante on public.gold_solicitacoes (solicitante_id, criado_em desc);
create index idx_gold_solicitacoes_estado on public.gold_solicitacoes (estado);

-- 4) Pagamentos — vinculados à solicitação, valor travado no momento do
--    pedido (preço pode mudar depois sem afetar cobrança já emitida).
create table public.gold_pagamentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.gold_solicitacoes(id) on delete cascade,
  quem_paga text not null check (quem_paga in ('proprio','interessado')),
  valor_centavos int not null,
  status text not null default 'pendente' check (status in ('pendente','pago','falhou','cancelado')),
  asaas_customer_id text,
  asaas_payment_id text,
  link_pagamento text,
  metodo text,
  pago_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index idx_gold_pagamentos_asaas_id on public.gold_pagamentos (asaas_payment_id)
  where asaas_payment_id is not null;
create index idx_gold_pagamentos_solicitacao on public.gold_pagamentos (solicitacao_id);

-- 5) Agendamentos — data/hora, consultor, local.
create table public.gold_agendamentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.gold_solicitacoes(id) on delete cascade,
  consultor_id uuid references public.gold_consultores(id) on delete set null,
  data_hora timestamptz not null,
  local text,
  status text not null default 'agendado' check (status in ('agendado','confirmado','realizado','cancelado','reagendado')),
  observacoes text,
  criado_em timestamptz not null default now()
);
create index idx_gold_agendamentos_solicitacao on public.gold_agendamentos (solicitacao_id);
create index idx_gold_agendamentos_consultor on public.gold_agendamentos (consultor_id, data_hora);

-- 6) Avaliação — uma por solicitação, criada quando o consultor começa a
--    preencher o Protocolo Commander em campo.
create table public.gold_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null unique references public.gold_solicitacoes(id) on delete cascade,
  consultor_id uuid references public.gold_consultores(id) on delete set null,
  agendamento_id uuid references public.gold_agendamentos(id) on delete set null,
  data_avaliacao date,
  versao_protocolo text not null default '1.0',
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida')),
  resultado text check (resultado in ('aprovado','reprovado')),
  validade_meses int check (validade_meses in (6,12)),
  observacoes_gerais text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 7) Itens do Protocolo Commander por hub — cada um aceita avaliado/atenção/
--    N-A (PRD §41: "nem tudo é aplicável a toda embarcação"). Granularidade
--    de hub (não sub-item) — é exatamente o que o modal do Correção 12 exibe.
create table public.gold_protocolo_itens (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.gold_avaliacoes(id) on delete cascade,
  hub text not null check (hub in (
    'motores','casco','eletrica','hidraulica','seguranca','equipamentos','documentacao','historico'
  )),
  estado text not null default 'na' check (estado in ('avaliado','atencao','na')),
  observacao text,
  atualizado_em timestamptz not null default now(),
  unique (avaliacao_id, hub)
);

-- 8) Selo persistido — hoje NÃO existe coluna de selo no banco. Uma linha por
--    embarcação (upsert a cada novo ciclo aprovado — re-avaliação depois de
--    expirado substitui a anterior). Estado (ativo/vencendo/expirado) é
--    CALCULADO a partir de `validade_ate`, nunca armazenado (evita job de
--    fundo só pra "expirar" — mesma filosofia do farol de documentos).
create table public.gold_selos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null unique references public.embarcacoes(id) on delete cascade,
  solicitacao_id uuid not null references public.gold_solicitacoes(id) on delete restrict,
  avaliacao_id uuid not null references public.gold_avaliacoes(id) on delete restrict,
  consultor_id uuid references public.gold_consultores(id) on delete set null,
  data_avaliacao date not null,
  validade_meses int not null check (validade_meses in (6,12)),
  validade_ate date not null,
  versao_protocolo text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 9) Concessão de Premium ao aprovar o Gold (PRD §16/§40) — registrado mesmo
--    o Premium ainda não bloqueando nada hoje (Correção 16 é sobre CONCEDER,
--    o gate em si é decisão de outra onda).
create table public.premium_concessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  origem text not null check (origem in ('gold')),
  origem_id uuid,
  valido_ate date not null,
  criado_em timestamptz not null default now()
);
create index idx_premium_concessoes_usuario on public.premium_concessoes (usuario_id, valido_ate desc);

-- =====================================================================
-- Funções de visibilidade (todas as tabelas acima já existem) + RLS
-- =====================================================================

-- Visibilidade central (dono da embarcação vinculada, o próprio solicitante,
-- o consultor atribuído via agendamento, ou admin) — reaproveitada pelas
-- tabelas filhas abaixo, mesmo padrão de função security definer já usado
-- em `permissao()`/`eh_prop()` (migration 008).
create or replace function public.gold_visivel(p_solicitacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gold_solicitacoes s
    where s.id = p_solicitacao_id
      and (
        public.eh_admin()
        or s.solicitante_id = auth.uid()
        or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id))
        or exists (
          select 1 from public.gold_agendamentos ag
          join public.gold_consultores c on c.id = ag.consultor_id
          where ag.solicitacao_id = s.id and c.usuario_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.gold_consultor_atribuido(p_solicitacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gold_agendamentos ag
    join public.gold_consultores c on c.id = ag.consultor_id
    where ag.solicitacao_id = p_solicitacao_id and c.usuario_id = auth.uid()
  );
$$;

create or replace function public.gold_visivel_avaliacao(p_avaliacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gold_avaliacoes a where a.id = p_avaliacao_id and public.gold_visivel(a.solicitacao_id)
  );
$$;
create or replace function public.gold_consultor_atribuido_avaliacao(p_avaliacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gold_avaliacoes a where a.id = p_avaliacao_id and public.gold_consultor_atribuido(a.solicitacao_id)
  );
$$;

alter table public.gold_solicitacoes enable row level security;
create policy "gold_solicitacoes: ver" on public.gold_solicitacoes for select
  using (public.gold_visivel(id));
create policy "gold_solicitacoes: criar" on public.gold_solicitacoes for insert
  with check (
    solicitante_id = auth.uid()
    and (
      (embarcacao_id is not null and papel_solicitante = 'proprietario' and public.eh_prop(embarcacao_id))
      or (embarcacao_id is null and papel_solicitante = 'interessado')
    )
  );
-- Sem policy de update: toda mudança de `estado` passa por
-- `gold_definir_estado()` abaixo (security definer, valida transição +
-- autoridade de quem chama num único lugar central e auditável).

alter table public.gold_pagamentos enable row level security;
create policy "gold_pagamentos: ver" on public.gold_pagamentos for select
  using (public.gold_visivel(solicitacao_id));
create policy "gold_pagamentos: criar" on public.gold_pagamentos for insert
  with check (
    public.eh_admin()
    or exists (
      select 1 from public.gold_solicitacoes s where s.id = solicitacao_id
        and (s.solicitante_id = auth.uid() or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id)))
    )
  );
-- Sem policy de update: status só muda pelo webhook do Asaas (service role,
-- mesmo padrão de `assinaturas`, migration 017) — nunca pelo cliente.

alter table public.gold_agendamentos enable row level security;
create policy "gold_agendamentos: ver" on public.gold_agendamentos for select
  using (public.gold_visivel(solicitacao_id));
create policy "gold_agendamentos: admin cria" on public.gold_agendamentos for insert
  with check (public.eh_admin());
create policy "gold_agendamentos: atualizar" on public.gold_agendamentos for update
  using (public.eh_admin() or public.gold_consultor_atribuido(solicitacao_id))
  with check (public.eh_admin() or public.gold_consultor_atribuido(solicitacao_id));

alter table public.gold_avaliacoes enable row level security;
create policy "gold_avaliacoes: ver" on public.gold_avaliacoes for select
  using (public.gold_visivel(solicitacao_id));
create policy "gold_avaliacoes: criar" on public.gold_avaliacoes for insert
  with check (public.eh_admin() or public.gold_consultor_atribuido(solicitacao_id));
create policy "gold_avaliacoes: atualizar" on public.gold_avaliacoes for update
  using (public.eh_admin() or public.gold_consultor_atribuido(solicitacao_id))
  with check (public.eh_admin() or public.gold_consultor_atribuido(solicitacao_id));

alter table public.gold_protocolo_itens enable row level security;
create policy "gold_protocolo_itens: ver" on public.gold_protocolo_itens for select
  using (public.gold_visivel_avaliacao(avaliacao_id));
create policy "gold_protocolo_itens: escrever" on public.gold_protocolo_itens for all
  using (public.eh_admin() or public.gold_consultor_atribuido_avaliacao(avaliacao_id))
  with check (public.eh_admin() or public.gold_consultor_atribuido_avaliacao(avaliacao_id));

alter table public.gold_selos enable row level security;
create policy "gold_selos: ver quem tem vinculo" on public.gold_selos for select
  using (public.eh_admin() or public.pode_ver_embarcacao(embarcacao_id));
create policy "gold_selos: admin escreve" on public.gold_selos for all
  using (public.eh_admin()) with check (public.eh_admin());

alter table public.premium_concessoes enable row level security;
create policy "premium_concessoes: ver proprio ou admin" on public.premium_concessoes for select
  using (usuario_id = auth.uid() or public.eh_admin());
create policy "premium_concessoes: admin cria" on public.premium_concessoes for insert
  with check (public.eh_admin());

-- `gold_consultores` também visível para quem enxerga a solicitação ligada
-- ao agendamento (dono/solicitante precisam ver o nome do consultor
-- atribuído, não só o próprio consultor/admin).
create policy "gold_consultores: ligado ao meu agendamento" on public.gold_consultores for select
  using (
    exists (
      select 1 from public.gold_agendamentos ag
      where ag.consultor_id = gold_consultores.id and public.gold_visivel(ag.solicitacao_id)
    )
  );

-- =====================================================================
-- Máquina de estados da solicitação
-- =====================================================================

-- Transições válidas do estado da solicitação — único lugar que decide
-- "de onde pra onde" (mantém o SQL como fonte da verdade; a UI espelha isso
-- em `web/lib/domain/gold.ts` só pra desabilitar botão sem round-trip).
create or replace function public.gold_transicao_valida(p_atual text, p_novo text)
returns boolean language sql immutable as $$
  select case p_atual
    when 'solicitado'              then p_novo in ('aguardando_pagamento','cancelado')
    when 'aguardando_pagamento'    then p_novo in ('pago','cancelado')
    when 'pago'                    then p_novo in ('aguardando_agendamento','cancelado')
    when 'aguardando_agendamento'  then p_novo in ('agendado','cancelado')
    when 'agendado'                then p_novo in ('avaliacao_realizada','cancelado')
    when 'avaliacao_realizada'     then p_novo in ('em_analise')
    when 'em_analise'              then p_novo in ('aprovado','reprovado')
    else false
  end;
$$;

-- Ponto único de escrita do `estado` — checa autoridade de quem chama (admin
-- sempre; consultor atribuído só até "avaliação realizada"; solicitante/dono
-- só pra cancelar) e a transição, depois grava. Ao aprovar: lê a avaliação
-- (precisa ter `validade_meses` definido pelo admin), grava/atualiza o selo
-- na embarcação (upsert — reavaliação após expirar substitui o ciclo
-- anterior) e concede 6/12 meses de Premium ao PROP da embarcação (PRD
-- §16). Solicitação de "outra embarcação" (sem `embarcacao_id`) pode ser
-- aprovada, mas não gera selo — não existe embarcação Commander pra prender
-- o selo (Correção 09: o valor pro interessado é o RESULTADO da avaliação,
-- não um selo que ele não pode exibir num barco que ainda não é dele no app).
create or replace function public.gold_definir_estado(
  p_solicitacao_id uuid, p_novo_estado text, p_observacao text default null
)
returns public.gold_solicitacoes
language plpgsql security definer set search_path = public as $$
declare
  v_atual text;
  v_embarcacao_id uuid;
  v_pode boolean;
  v_row public.gold_solicitacoes;
  v_avaliacao public.gold_avaliacoes;
  v_prop_id uuid;
  v_validade_ate date;
  v_selo_id uuid;
begin
  select estado, embarcacao_id into v_atual, v_embarcacao_id
    from public.gold_solicitacoes where id = p_solicitacao_id for update;
  if v_atual is null then
    raise exception 'solicitacao_nao_encontrada';
  end if;

  if p_novo_estado = 'cancelado' then
    v_pode := public.eh_admin() or exists (
      select 1 from public.gold_solicitacoes s where s.id = p_solicitacao_id
        and (s.solicitante_id = auth.uid() or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id)))
    );
  elsif p_novo_estado = 'avaliacao_realizada' then
    v_pode := public.eh_admin() or public.gold_consultor_atribuido(p_solicitacao_id);
  else
    v_pode := public.eh_admin();
  end if;
  if not v_pode then
    raise exception 'sem_permissao';
  end if;

  if not public.gold_transicao_valida(v_atual, p_novo_estado) then
    raise exception 'transicao_invalida_%_%', v_atual, p_novo_estado;
  end if;

  if p_novo_estado = 'aprovado' then
    select * into v_avaliacao from public.gold_avaliacoes where solicitacao_id = p_solicitacao_id;
    if v_avaliacao.id is null or v_avaliacao.data_avaliacao is null or v_avaliacao.validade_meses is null then
      raise exception 'avaliacao_incompleta';
    end if;

    if v_embarcacao_id is not null then
      v_validade_ate := (v_avaliacao.data_avaliacao + (v_avaliacao.validade_meses || ' months')::interval)::date;

      insert into public.gold_selos (
        embarcacao_id, solicitacao_id, avaliacao_id, consultor_id,
        data_avaliacao, validade_meses, validade_ate, versao_protocolo
      ) values (
        v_embarcacao_id, p_solicitacao_id, v_avaliacao.id, v_avaliacao.consultor_id,
        v_avaliacao.data_avaliacao, v_avaliacao.validade_meses, v_validade_ate, v_avaliacao.versao_protocolo
      )
      on conflict (embarcacao_id) do update set
        solicitacao_id = excluded.solicitacao_id,
        avaliacao_id = excluded.avaliacao_id,
        consultor_id = excluded.consultor_id,
        data_avaliacao = excluded.data_avaliacao,
        validade_meses = excluded.validade_meses,
        validade_ate = excluded.validade_ate,
        versao_protocolo = excluded.versao_protocolo,
        atualizado_em = now()
      returning id into v_selo_id;

      select usuario_id into v_prop_id from public.vinculos
        where embarcacao_id = v_embarcacao_id and papel = 'PROP' limit 1;
      if v_prop_id is not null then
        insert into public.premium_concessoes (usuario_id, origem, origem_id, valido_ate)
        values (v_prop_id, 'gold', v_selo_id, v_validade_ate);
      end if;
    end if;
  end if;

  update public.gold_solicitacoes set estado = p_novo_estado, atualizado_em = now()
    where id = p_solicitacao_id
    returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.gold_definir_estado(uuid, text, text) from public, anon;
grant execute on function public.gold_definir_estado(uuid, text, text) to authenticated;

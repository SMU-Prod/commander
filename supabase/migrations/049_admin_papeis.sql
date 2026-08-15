-- =====================================================================
-- 049 · PAPÉIS ADMINISTRATIVOS COM ESCOPO + LOGS (PRD §21 e §22)
--
-- O PRD §22 é literal: "Admin deve operar por permissões de função, não por
-- simples 'admin=true'". Hoje o banco tem exatamente isso — um
-- `profiles.is_admin boolean` (migration 033) que liga TUDO de uma vez.
-- Esta migration troca o flag por papéis, e um deles (Vistoriador) tem
-- ESCOPO REGIONAL — o §21 diz "somente às regiões autorizadas. Não concede
-- acesso nacional irrestrito". Escopo de leitura de dado é regra de banco,
-- não de tela: um vistoriador de Angra não pode nem SELECIONAR uma vistoria
-- de Salvador, mesmo chamando a API na mão.
--
-- ---------------------------------------------------------------------------
-- O QUE `eh_admin()` PASSA A SIGNIFICAR — e por quê
-- ---------------------------------------------------------------------------
-- `eh_admin()` já é usada por ~25 policies (Gold, taxonomia, negócios). Não
-- dá pra mudar o nome sem reescrever tudo, e não dá pra deixar como está.
-- A escolha aqui:
--
--   eh_admin()  ==  "tem papel administrativo de ALCANCE NACIONAL"
--                   (ceo, suporte ou comercial — NUNCA vistoriador)
--
-- Por que excluir o vistoriador em vez de "qualquer papel": toda policy
-- legada foi escrita presumindo alcance nacional ("admin vê tudo"). Se
-- `eh_admin()` passasse a incluir o vistoriador, TODAS elas passariam a
-- conceder acesso nacional a ele de uma vez — exatamente o que o §21 proíbe —
-- e o erro seria silencioso. Excluindo, cada policy legada continua
-- significando o que significava, e o vistoriador só entra onde alguém
-- escreveu explicitamente a regra regional. Falha fechada, não aberta.
-- O mesmo vale pro futuro: uma policy nova que esqueça de pensar no
-- vistoriador nega, não concede.
--
-- Pra porta do painel (`/admin`), que o vistoriador precisa abrir, existe
-- `eh_admin_qualquer()`. E pra regra fina, `tem_papel_admin('suporte')`,
-- com CEO implicando todos os papéis ("Acesso total", §21).
--
-- ---------------------------------------------------------------------------
-- ISTO NÃO É A MATRIZ DE `lib/domain/permissoes.ts`
-- ---------------------------------------------------------------------------
-- Existem DOIS sistemas de permissão no Commander e eles não se encostam:
--   · Acesso à EMBARCAÇÃO (PROP/COMANDANTE/TRIPULANTE, migration 008 +
--     `lib/domain/permissoes.ts`): quem pode mexer no barco de quem. É uma
--     relação entre uma pessoa e UMA embarcação.
--   · Papel ADMINISTRATIVO (este arquivo): quem opera o Commander como
--     empresa. Não dá acesso a barco nenhum por si só — um CEO continua sem
--     enxergar o Diário de Bordo de um cliente, porque `pode_ver_embarcacao`
--     não olha papel administrativo.
-- Misturar os dois viraria "admin vê tudo de todo mundo", que é justamente o
-- que o §22 ("isolamento entre embarcações e contas") proíbe.
-- =====================================================================

-- ===========================================================================
-- 1) PAPÉIS
-- ===========================================================================
-- Linha por (pessoa, papel): alguém pode acumular Suporte + Comercial sem
-- precisar de um papel "suporte_comercial" inventado. `ativo=false` é a
-- SUSPENSÃO do §21 ("cria/edita/suspende administradores") — a linha fica,
-- com histórico, em vez de sumir.
create table public.admin_papeis (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  papel text not null check (papel in ('ceo', 'suporte', 'comercial', 'vistoriador')),
  ativo boolean not null default true,
  observacao text,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, papel)
);

create index admin_papeis_usuario_idx on public.admin_papeis (usuario_id) where ativo;

-- Regiões autorizadas — só fazem sentido pro papel 'vistoriador'. Aponta pra
-- `taxonomia` (tipo='regiao', migration 046) em vez de texto livre porque é a
-- mesma lista que o Marketplace e o cadastro usam: região escrita à mão em
-- dois lugares vira "Angra" ≠ "Angra dos Reis" e o escopo deixa de fechar.
create table public.admin_papel_regioes (
  papel_id uuid not null references public.admin_papeis(id) on delete cascade,
  regiao_id uuid not null references public.taxonomia(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (papel_id, regiao_id)
);

-- ===========================================================================
-- 2) FUNÇÕES DE PAPEL
-- ===========================================================================
-- Todas `security definer`: a policy de `admin_papeis` (abaixo) só deixa o
-- CEO ler a tabela inteira, então a checagem precisa rodar por fora da RLS —
-- mesmo padrão de `eh_prop()`/`permissao()` (migration 008).

-- CEO implica todos os papéis: §21 diz "Acesso total" na primeira linha da
-- tabela de funções. Sem isso, o dono precisaria se auto-conceder os quatro
-- papéis pra operar, e a conta-mãe deixaria de ser conta-mãe.
create or replace function public.tem_papel_admin(p_papel text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.admin_papeis p
    where p.usuario_id = (select auth.uid())
      and p.ativo
      and (p.papel = p_papel or p.papel = 'ceo')
  );
$$;
revoke all on function public.tem_papel_admin(text) from public, anon;
grant execute on function public.tem_papel_admin(text) to authenticated;

create or replace function public.eh_ceo()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.admin_papeis p
    where p.usuario_id = (select auth.uid()) and p.ativo and p.papel = 'ceo'
  );
$$;
revoke all on function public.eh_ceo() from public, anon;
grant execute on function public.eh_ceo() to authenticated;

-- Porta do painel: inclui o vistoriador. Serve pra saber "esta pessoa é
-- funcionário?", nunca pra liberar dado — o dado é liberado pelas funções
-- de papel específico.
create or replace function public.eh_admin_qualquer()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.admin_papeis p where p.usuario_id = (select auth.uid()) and p.ativo
  );
$$;
revoke all on function public.eh_admin_qualquer() from public, anon;
grant execute on function public.eh_admin_qualquer() to authenticated;

-- "Esta região está na lista deste vistoriador?" — responde SÓ sobre o papel
-- 'vistoriador'. De propósito não devolve true pro CEO: quem é nacional entra
-- pela outra metade do `or` na policy, e assim a função continua sendo uma
-- resposta honesta sobre escopo regional, legível em qualquer policy.
create or replace function public.vistoriador_ve_regiao(p_regiao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select p_regiao_id is not null and exists (
    select 1
    from public.admin_papeis p
    join public.admin_papel_regioes r on r.papel_id = p.id
    where p.usuario_id = (select auth.uid())
      and p.ativo
      and p.papel = 'vistoriador'
      and r.regiao_id = p_regiao_id
  );
$$;
revoke all on function public.vistoriador_ve_regiao(uuid) from public, anon;
grant execute on function public.vistoriador_ve_regiao(uuid) to authenticated;

-- ===========================================================================
-- 3) MIGRAÇÃO DO `is_admin` E A NOVA DEFINIÇÃO DE `eh_admin()`
-- ===========================================================================
-- Quem era `is_admin = true` vira CEO — era o único papel que existia, e ele
-- tinha acesso total. Hoje isso são ZERO linhas em produção (conferido antes
-- de escrever: 0 admins, 0 assinaturas, 2 usuários), mas a migração precisa
-- estar certa pra qualquer outro ambiente que tenha o flag ligado.
insert into public.admin_papeis (usuario_id, papel, observacao)
select p.id, 'ceo', 'Migrado de profiles.is_admin (onda 48)'
from public.profiles p
where p.is_admin
on conflict (usuario_id, papel) do nothing;

-- A nova definição precisa entrar ANTES do `drop column`: a função é
-- `language sql`, então o Postgres guarda a dependência com a coluna.
create or replace function public.eh_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.admin_papeis p
    where p.usuario_id = (select auth.uid())
      and p.ativo
      and p.papel in ('ceo', 'suporte', 'comercial')
  );
$$;

-- O flag sai de vez. Deixar uma coluna morta que não concede mais nada é pior
-- do que remover: alguém liga `is_admin = true` no Studio, acha que virou
-- admin e não vira — e o §22 pede o contrário de um interruptor único.
alter table public.profiles drop column is_admin;

-- ===========================================================================
-- 4) RLS DOS PAPÉIS
-- ===========================================================================
alter table public.admin_papeis enable row level security;

-- Cada admin enxerga o próprio papel (a tela precisa dizer "você é Suporte");
-- a lista inteira é só do CEO, que é quem gerencia os demais (§21).
create policy "admin_papeis: ceo vê todos, cada um vê o seu" on public.admin_papeis
  for select to authenticated
  using (public.eh_ceo() or usuario_id = (select auth.uid()));

-- "O CEO/Super Admin é a conta-mãe que cria e gerencia os demais
-- administradores" (§21) — literalmente a policy abaixo. Ninguém se
-- autopromove: sem papel nenhum, `eh_ceo()` é false e o insert é negado.
-- O PRIMEIRO CEO nasce por SQL direto do dono (ver docs/OPERACAO.md).
create policy "admin_papeis: só o CEO cria" on public.admin_papeis
  for insert to authenticated with check (public.eh_ceo());
create policy "admin_papeis: só o CEO edita" on public.admin_papeis
  for update to authenticated using (public.eh_ceo()) with check (public.eh_ceo());

-- Sem policy de DELETE de propósito: suspender é `ativo = false`, que preserva
-- o histórico de quem teve acesso a quê e quando. Apagar a linha apagaria a
-- resposta de "quem era admin em março?".

alter table public.admin_papel_regioes enable row level security;

create policy "admin_papel_regioes: ceo vê todas, cada um vê a sua" on public.admin_papel_regioes
  for select to authenticated
  using (
    public.eh_ceo()
    or exists (
      select 1 from public.admin_papeis p
      where p.id = papel_id and p.usuario_id = (select auth.uid())
    )
  );
-- Escopo regional é a própria trava do §21 — só a conta-mãe define. Se o
-- vistoriador pudesse editar a própria lista, o escopo não seria escopo.
create policy "admin_papel_regioes: só o CEO define" on public.admin_papel_regioes
  for all to authenticated using (public.eh_ceo()) with check (public.eh_ceo());

-- ===========================================================================
-- 5) LOGS ADMINISTRATIVOS (§21.3)
-- ===========================================================================
-- "Toda ação administrativa relevante registra quem, quando, função, ação,
-- entidade afetada e mudança de status" — uma coluna pra cada palavra dessa
-- frase. `papel` é gravado como TEXTO no momento da ação, não como FK: se
-- amanhã o papel for revogado, o log tem que continuar dizendo em que
-- qualidade a pessoa agiu naquele dia.
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  papel text not null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  status_antes text,
  status_depois text,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create index admin_logs_criado_idx on public.admin_logs (criado_em desc);
create index admin_logs_admin_idx on public.admin_logs (admin_id, criado_em desc);

alter table public.admin_logs enable row level security;

-- Leitura: CEO vê tudo (é a auditoria dele); os demais veem só as próprias
-- ações, o que basta pra conferência e não transforma o log num painel de
-- vigilância lateral entre colegas.
create policy "admin_logs: ceo lê tudo, admin lê o próprio" on public.admin_logs
  for select to authenticated
  using (public.eh_ceo() or admin_id = (select auth.uid()));

-- "Logs não são apagáveis por administradores comuns" (§21.3). Aqui não são
-- apagáveis por NINGUÉM logado — nem pelo CEO. Não existe policy de UPDATE
-- nem de DELETE (RLS nega por omissão) E os privilégios de tabela são
-- revogados, que é o cinto além do suspensório: policy inexistente já basta,
-- mas o revoke garante que uma migration futura que crie uma policy larga por
-- descuido ainda esbarre na permissão de tabela.
revoke insert, update, delete, truncate on public.admin_logs from anon, authenticated;

-- Única porta de escrita. `security definer` carimba `auth.uid()` e o papel
-- vigente — o cliente não escolhe quem assinou o log, que é o ponto inteiro
-- de um registro de auditoria.
create or replace function public.registrar_log_admin(
  p_acao text,
  p_entidade text,
  p_entidade_id text default null,
  p_status_antes text default null,
  p_status_depois text default null,
  p_detalhes jsonb default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_papel text;
  v_id uuid;
begin
  select string_agg(papel, '+' order by papel) into v_papel
  from public.admin_papeis
  where usuario_id = (select auth.uid()) and ativo;

  if v_papel is null then
    raise exception 'sem_papel_administrativo';
  end if;

  insert into public.admin_logs (
    admin_id, papel, acao, entidade, entidade_id, status_antes, status_depois, detalhes
  ) values (
    (select auth.uid()), v_papel, p_acao, p_entidade, p_entidade_id, p_status_antes, p_status_depois, p_detalhes
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.registrar_log_admin(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.registrar_log_admin(text, text, text, text, text, jsonb) to authenticated;

-- ===========================================================================
-- 6) ESCOPO REGIONAL DA VISTORIA — a parte que precisa estar na RLS
-- ===========================================================================
-- `gold_solicitacoes` não tinha região: o barco pode ser "outra embarcação"
-- (Correção 09), então nem dá pra derivar do cadastro. Sem uma região na
-- linha, "vistoriador só da região dele" seria impossível de escrever em SQL
-- e viraria filtro de tela — que não é trava.
alter table public.gold_solicitacoes
  add column regiao_id uuid references public.taxonomia(id) on delete set null;
create index gold_solicitacoes_regiao_idx on public.gold_solicitacoes (regiao_id);

comment on column public.gold_solicitacoes.regiao_id is
  'Região da vistoria (taxonomia tipo=regiao). Null = ainda não atribuída: nenhum vistoriador enxerga, só CEO/Suporte.';

-- Região de uma solicitação/avaliação, pra usar dentro das policies sem
-- repetir subselect. `stable`, não `immutable`: lê tabela.
create or replace function public.gold_regiao(p_solicitacao_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select regiao_id from public.gold_solicitacoes where id = p_solicitacao_id;
$$;
revoke all on function public.gold_regiao(uuid) from public, anon;
grant execute on function public.gold_regiao(uuid) to authenticated;

create or replace function public.gold_regiao_avaliacao(p_avaliacao_id uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select s.regiao_id
  from public.gold_avaliacoes a
  join public.gold_solicitacoes s on s.id = a.solicitacao_id
  where a.id = p_avaliacao_id;
$$;
revoke all on function public.gold_regiao_avaliacao(uuid) from public, anon;
grant execute on function public.gold_regiao_avaliacao(uuid) to authenticated;

-- Atalho: "sou vistoriador autorizado nesta solicitação?"
create or replace function public.vistoriador_ve_solicitacao(p_solicitacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.vistoriador_ve_regiao(public.gold_regiao(p_solicitacao_id));
$$;
revoke all on function public.vistoriador_ve_solicitacao(uuid) from public, anon;
grant execute on function public.vistoriador_ve_solicitacao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Visibilidade central do Gold — reescrita
-- ---------------------------------------------------------------------------
-- Mudanças em relação à 033:
--   · `eh_admin()` (que agora inclui Comercial) vira `tem_papel_admin
--     ('suporte')`: vistoria é operação, não é assunto comercial. CEO segue
--     entrando, porque CEO implica todo papel.
--   · entra o vistoriador, e SÓ na região dele.
create or replace function public.gold_visivel(p_solicitacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.gold_solicitacoes s
    where s.id = p_solicitacao_id
      and (
        public.tem_papel_admin('suporte')
        or public.vistoriador_ve_regiao(s.regiao_id)
        or s.solicitante_id = (select auth.uid())
        or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id))
        or exists (
          select 1 from public.gold_agendamentos ag
          join public.gold_consultores c on c.id = ag.consultor_id
          where ag.solicitacao_id = s.id and c.usuario_id = (select auth.uid())
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Policies do Gold: quem escreve
-- ---------------------------------------------------------------------------
-- Preço é matéria comercial (§20: "configurável no Admin/Comercial").
drop policy if exists "gold_precos: admin atualiza" on public.gold_precos;
create policy "gold_precos: comercial atualiza" on public.gold_precos for update
  to authenticated
  using (public.tem_papel_admin('comercial')) with check (public.tem_papel_admin('comercial'));

-- Cadastro de consultor é operação de Suporte, não de Comercial.
drop policy if exists "gold_consultores: admin gerencia" on public.gold_consultores;
create policy "gold_consultores: suporte gerencia" on public.gold_consultores for all
  to authenticated
  using (public.tem_papel_admin('suporte')) with check (public.tem_papel_admin('suporte'));

drop policy if exists "gold_pagamentos: criar" on public.gold_pagamentos;
create policy "gold_pagamentos: criar" on public.gold_pagamentos for insert
  to authenticated
  with check (
    public.tem_papel_admin('suporte')
    or exists (
      select 1 from public.gold_solicitacoes s where s.id = solicitacao_id
        and (s.solicitante_id = (select auth.uid()) or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id)))
    )
  );

-- Agendar/atualizar visita: Suporte em qualquer região; vistoriador só na
-- dele. É o "agenda e registros de visita" do §21 com o limite regional junto.
drop policy if exists "gold_agendamentos: admin cria" on public.gold_agendamentos;
create policy "gold_agendamentos: suporte ou vistoriador da região cria" on public.gold_agendamentos
  for insert to authenticated
  with check (public.tem_papel_admin('suporte') or public.vistoriador_ve_solicitacao(solicitacao_id));

drop policy if exists "gold_agendamentos: atualizar" on public.gold_agendamentos;
create policy "gold_agendamentos: atualizar" on public.gold_agendamentos for update
  to authenticated
  using (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido(solicitacao_id)
    or public.vistoriador_ve_solicitacao(solicitacao_id)
  )
  with check (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido(solicitacao_id)
    or public.vistoriador_ve_solicitacao(solicitacao_id)
  );

drop policy if exists "gold_avaliacoes: criar" on public.gold_avaliacoes;
create policy "gold_avaliacoes: criar" on public.gold_avaliacoes for insert
  to authenticated
  with check (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido(solicitacao_id)
    or public.vistoriador_ve_solicitacao(solicitacao_id)
  );

drop policy if exists "gold_avaliacoes: atualizar" on public.gold_avaliacoes;
create policy "gold_avaliacoes: atualizar" on public.gold_avaliacoes for update
  to authenticated
  using (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido(solicitacao_id)
    or public.vistoriador_ve_solicitacao(solicitacao_id)
  )
  with check (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido(solicitacao_id)
    or public.vistoriador_ve_solicitacao(solicitacao_id)
  );

drop policy if exists "gold_protocolo_itens: escrever" on public.gold_protocolo_itens;
create policy "gold_protocolo_itens: escrever" on public.gold_protocolo_itens for all
  to authenticated
  using (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido_avaliacao(avaliacao_id)
    or public.vistoriador_ve_regiao(public.gold_regiao_avaliacao(avaliacao_id))
  )
  with check (
    public.tem_papel_admin('suporte')
    or public.gold_consultor_atribuido_avaliacao(avaliacao_id)
    or public.vistoriador_ve_regiao(public.gold_regiao_avaliacao(avaliacao_id))
  );

-- Selo e Premium concedido: decisão de Suporte/CEO. O vistoriador levanta o
-- laudo em campo, não emite o selo — o §21 dá a ele "vistorias e registros de
-- visita", não a aprovação.
drop policy if exists "gold_selos: ver quem tem vinculo" on public.gold_selos;
create policy "gold_selos: ver quem tem vinculo" on public.gold_selos for select
  to authenticated
  using (public.tem_papel_admin('suporte') or public.pode_ver_embarcacao(embarcacao_id));

drop policy if exists "gold_selos: admin escreve" on public.gold_selos;
create policy "gold_selos: suporte escreve" on public.gold_selos for all
  to authenticated
  using (public.tem_papel_admin('suporte')) with check (public.tem_papel_admin('suporte'));

drop policy if exists "premium_concessoes: ver proprio ou admin" on public.premium_concessoes;
create policy "premium_concessoes: ver proprio ou admin" on public.premium_concessoes for select
  to authenticated
  using (usuario_id = (select auth.uid()) or public.tem_papel_admin('suporte'));

drop policy if exists "premium_concessoes: admin cria" on public.premium_concessoes;
create policy "premium_concessoes: suporte cria" on public.premium_concessoes for insert
  to authenticated
  with check (public.tem_papel_admin('suporte'));

-- ---------------------------------------------------------------------------
-- Máquina de estados do Gold — só a parte de AUTORIDADE muda
-- ---------------------------------------------------------------------------
-- Corpo idêntico ao da 033 exceto o bloco `v_pode`: `eh_admin()` vira
-- `tem_papel_admin('suporte')` e o vistoriador da região ganha o direito de
-- marcar "avaliação realizada" — que é o registro de visita dele. Aprovar e
-- reprovar continuam fora do alcance dele.
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
    v_pode := public.tem_papel_admin('suporte') or exists (
      select 1 from public.gold_solicitacoes s where s.id = p_solicitacao_id
        and (s.solicitante_id = auth.uid() or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id)))
    );
  elsif p_novo_estado = 'avaliacao_realizada' then
    v_pode := public.tem_papel_admin('suporte')
      or public.gold_consultor_atribuido(p_solicitacao_id)
      or public.vistoriador_ve_solicitacao(p_solicitacao_id);
  else
    v_pode := public.tem_papel_admin('suporte');
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
        values (v_prop_id, 'gold', p_solicitacao_id, v_validade_ate);
      end if;
    end if;
  end if;

  update public.gold_solicitacoes
    set estado = p_novo_estado, atualizado_em = now()
    where id = p_solicitacao_id
    returning * into v_row;

  return v_row;
end;
$$;

-- `gold_solicitacoes` não tem (e não deve ter) policy de UPDATE: a 033 decidiu
-- que toda mudança passa por `gold_definir_estado()`, pra que a máquina de
-- estados não possa ser contornada. Definir a região precisa da mesma porta
-- estreita — uma policy de UPDATE larga deixaria o Suporte escrever `estado`
-- direto e furaria a máquina inteira.
create or replace function public.gold_definir_regiao(p_solicitacao_id uuid, p_regiao_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Só Suporte/CEO atribui região. O vistoriador não escolhe onde trabalha:
  -- se pudesse, o escopo regional do §21 seria autoatendido.
  if not public.tem_papel_admin('suporte') then
    raise exception 'sem_permissao';
  end if;

  if p_regiao_id is not null and not exists (
    select 1 from public.taxonomia t where t.id = p_regiao_id and t.tipo = 'regiao'
  ) then
    raise exception 'regiao_invalida';
  end if;

  update public.gold_solicitacoes set regiao_id = p_regiao_id, atualizado_em = now()
  where id = p_solicitacao_id;

  if not found then
    raise exception 'solicitacao_nao_encontrada';
  end if;
end;
$$;
revoke all on function public.gold_definir_regiao(uuid, uuid) from public, anon;
grant execute on function public.gold_definir_regiao(uuid, uuid) to authenticated;

-- Sem policy de DELETE a RLS nega em silêncio (0 linhas afetadas) e o chamador
-- acha que apagou. Revogando o privilégio o erro é explícito, e o histórico de
-- "quem foi admin quando" fica protegido como os logs: suspende, não apaga.
revoke delete, truncate on public.admin_papeis from anon, authenticated;
revoke delete, truncate on public.admin_papel_regioes from anon, authenticated;

-- ===========================================================================
-- 7) TAXONOMIA (§21.2) — quem administra o vocabulário
-- ===========================================================================
-- Vocabulário do produto é conteúdo, não vistoria: Suporte e Comercial
-- mexem, vistoriador não. Como `eh_admin()` agora é exatamente
-- "ceo|suporte|comercial", as policies da 046 já expressam isso e ficam
-- como estão — este bloco existe só pra registrar que a decisão foi
-- consciente, não esquecimento.
--
-- Idem `negocios`/`negocios_confirmacoes` (§21.1, métricas comerciais) e
-- `taxonomia_solicitacoes`: continuam em `eh_admin()`.

-- ===========================================================================
-- 8) LEITURA DE PERFIS PELO ADMIN
-- ===========================================================================
-- Pra CRIAR um administrador o CEO precisa escolher uma pessoa, e hoje
-- `profiles` só é legível por você mesmo e por quem divide embarcação com
-- você (migration 010). Abrimos pro papel de Suporte (CEO implicado), que é
-- quem o §21 encarrega de "Usuários" — Comercial e vistoriador continuam
-- sem enxergar a base de usuários.
create policy "perfil: suporte enxerga a base" on public.profiles
  for select to authenticated
  using (public.tem_papel_admin('suporte'));

-- ===========================================================================
-- 9) MÉTRICAS DO DASHBOARD CEO (§21.1)
-- ===========================================================================
-- Quatro funções pequenas em vez de uma grande, cada uma sobre uma fonte.
-- O motivo é operacional: se a onda 47 mexer no formato de `assinaturas`,
-- só `admin_metricas_assinaturas()` quebra — a tela captura o erro daquela
-- fonte e mostra "não foi possível ler", em vez de derrubar o painel inteiro.
-- Todas são `security definer` e devolvem APENAS AGREGADO: o CEO vê quantos
-- assinantes existem, nunca a linha financeira de uma pessoa (§22).

create or replace function public.admin_metricas_pessoas()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when not public.eh_ceo() then null::jsonb else jsonb_build_object(
    'usuarios', (select count(*) from public.profiles),
    'usuarios_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'embarcacoes', (select count(*) from public.embarcacoes),
    'embarcacoes_ativas_90d', (
      select count(distinct e.id) from public.embarcacoes e
      where exists (select 1 from public.eventos ev where ev.embarcacao_id = e.id and ev.created_at >= now() - interval '90 days')
         or exists (select 1 from public.viagens vg where vg.embarcacao_id = e.id and vg.created_at >= now() - interval '90 days')
    )
  ) end;
$$;
revoke all on function public.admin_metricas_pessoas() from public, anon;
grant execute on function public.admin_metricas_pessoas() to authenticated;

create or replace function public.admin_metricas_assinaturas()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when not public.eh_ceo() then null::jsonb else jsonb_build_object(
    'total', (select count(*) from public.assinaturas),
    'ativas', (select count(*) from public.assinaturas where status = 'ativa'),
    'inadimplentes', (select count(*) from public.assinaturas where status = 'inadimplente'),
    'canceladas', (select count(*) from public.assinaturas where status = 'cancelada'),
    'novas_30d', (select count(*) from public.assinaturas where criado_em >= now() - interval '30 days'),
    'canceladas_30d', (select count(*) from public.assinaturas where status = 'cancelada' and atualizado_em >= now() - interval '30 days'),
    -- MRR: mensal conta cheio, anual entra dividido por 12. Somar o anual
    -- inteiro num indicador MENSAL infla o número em 12x.
    'mrr_centavos', (
      select coalesce(sum(case when plano like '%anual%' then valor_centavos / 12 else valor_centavos end), 0)
      from public.assinaturas where status = 'ativa'
    )
  ) end;
$$;
revoke all on function public.admin_metricas_assinaturas() from public, anon;
grant execute on function public.admin_metricas_assinaturas() to authenticated;

create or replace function public.admin_metricas_gold()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when not public.eh_ceo() then null::jsonb else jsonb_build_object(
    'solicitados', (select count(*) from public.gold_solicitacoes),
    'pagos', (select count(*) from public.gold_pagamentos where status = 'pago'),
    'agendados', (select count(*) from public.gold_solicitacoes where estado = 'agendado'),
    -- Ativo/expirado saem do selo, não do estado da solicitação: o estado
    -- para em 'aprovado' pra sempre, quem vence é o selo (validade_ate).
    'selos_ativos', (select count(*) from public.gold_selos where validade_ate >= public.hoje_sp()),
    'selos_expirados', (select count(*) from public.gold_selos where validade_ate < public.hoje_sp())
  ) end;
$$;
revoke all on function public.admin_metricas_gold() from public, anon;
grant execute on function public.admin_metricas_gold() to authenticated;

create or replace function public.admin_metricas_parceiros()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when not public.eh_ceo() then null::jsonb else jsonb_build_object(
    'total', (select count(*) from public.parceiros),
    'visiveis', (select count(*) from public.parceiros where visivel),
    'cortesia', (select count(*) from public.parceiros where plano = 'cortesia')
  ) end;
$$;
revoke all on function public.admin_metricas_parceiros() from public, anon;
grant execute on function public.admin_metricas_parceiros() to authenticated;

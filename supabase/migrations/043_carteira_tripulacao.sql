-- =====================================================================
-- Onda 42 · CARTEIRA DA TRIPULAÇÃO (PRD FINAL §9.4).
--
-- A frase que manda em tudo aqui, do próprio PRD: "A Carteira é um
-- controle contábil de valores informados. O Commander não guarda,
-- transfere ou movimenta dinheiro." Nada neste arquivo integra meio de
-- pagamento, e nenhuma coluna guarda dado bancário — é um caderno de
-- quanto foi repassado, quanto foi gasto e quanto sobrou, com dois nomes
-- em cima. A tela repete isso em texto (não só o código sabe).
--
-- Regras do PRD que viraram estrutura, não convenção:
--   · "Somente o proprietário cria/libera uma Carteira" → RLS de escrita
--     em `carteiras` é `eh_prop`, sem exceção;
--   · "Repasse registrado não vira despesa; vira saldo sob
--     responsabilidade do tripulante" → repasse NÃO cria lançamento no
--     Financeiro. Só o gasto cria (bloco 4);
--   · "cada gasto reduz o saldo da Carteira e alimenta o Financeiro da
--     embarcação" → um gasto aprovado gera UM lançamento central, ligado
--     por `lancamentos_financeiros.carteira_movimento_id` (índice único —
--     nunca dois lançamentos pro mesmo gasto);
--   · "Proprietário pode exigir comprovante obrigatório ou opcional" →
--     `carteiras.exige_comprovante`, checado no banco, não só na tela;
--   · "Proprietário pode escolher Registro Direto ou Aprovação do
--     Proprietário" → `carteiras.modo`, que decide o status inicial do
--     gasto dentro da função (o cliente não escolhe o próprio status);
--   · "Financeiro completo e Carteira são permissões independentes" →
--     área nova `carteira` na matriz, sem herdar nada de `gastos`.
-- =====================================================================

-- 1) A carteira — uma por (embarcação, tripulante). O PRD diz "para um
--    tripulante específico em uma embarcação específica", então a unicidade
--    é do par, não do usuário: o mesmo marinheiro pode ter carteira em dois
--    barcos, com regras diferentes em cada um.
create table public.carteiras (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  tripulante_id uuid not null references public.profiles(id) on delete cascade,
  -- Encerrar é `ativa = false`, nunca delete: o extrato do que já foi
  -- repassado e gasto é histórico da embarcação (mesma regra de "remover
  -- acesso não apaga registros", PRD §7/§19).
  ativa boolean not null default true,
  exige_comprovante boolean not null default true,
  modo text not null default 'aprovacao' check (modo in ('direto', 'aprovacao')),
  observacao text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (embarcacao_id, tripulante_id)
);

comment on table public.carteiras is
  'Controle contábil de valores informados (PRD §9.4). O Commander não guarda, transfere nem movimenta dinheiro — nenhuma coluna aqui é dado bancário e nenhuma ação neste módulo fala com meio de pagamento.';

-- 2) Os movimentos. Três tipos, um sinal cada:
--      repasse   (+) dinheiro entregue pelo proprietário ao tripulante;
--      gasto     (−) o tripulante gastou daquele valor (vira despesa da
--                    embarcação no Financeiro, ver bloco 4);
--      devolucao (−) o tripulante devolveu o que sobrou.
--    Devolução NÃO é entrada no Financeiro pelo mesmo motivo que repasse
--    não é despesa: o dinheiro nunca foi receita do barco, só voltou de
--    onde saiu. Lançar as duas pontas inflaria despesa e entrada com o
--    mesmo valor e sujaria todo relatório.
create table public.carteira_movimentos (
  id uuid primary key default gen_random_uuid(),
  carteira_id uuid not null references public.carteiras(id) on delete cascade,
  tipo text not null check (tipo in ('repasse', 'gasto', 'devolucao')),
  valor_centavos bigint not null check (valor_centavos > 0),
  data date not null default current_date,
  descricao text not null,
  -- Só o gasto usa: é a categoria com que ele entra no Financeiro. Mesma
  -- lista da migration 042 — se as duas divergirem, o lançamento gerado
  -- estoura o check da outra tabela, que é justamente o que queremos.
  categoria text check (categoria in (
    'marina_vaga', 'combustivel', 'manutencao', 'tripulacao', 'seguro',
    'documentacao_taxas', 'limpeza_conservacao', 'pecas_equipamentos', 'transporte', 'outros'
  )),
  comprovante_path text,
  observacao text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  motivo_recusa text,
  criado_por uuid references public.profiles(id) on delete set null,
  decidido_por uuid references public.profiles(id) on delete set null,
  decidido_em timestamptz,
  created_at timestamptz not null default now(),
  -- Gasto sempre tem categoria (senão não sabe entrar no Financeiro);
  -- repasse e devolução nunca têm.
  check ((tipo = 'gasto') = (categoria is not null))
);

create index idx_carteiras_embarcacao on public.carteiras (embarcacao_id, ativa);
create index idx_carteiras_tripulante on public.carteiras (tripulante_id);
create index idx_movimentos_carteira on public.carteira_movimentos (carteira_id, data desc);
create index idx_movimentos_pendentes on public.carteira_movimentos (status) where status = 'pendente';

-- 3) A ponte com o Financeiro fica do lado do Financeiro (a fonte do
--    dinheiro é ele, decisão da migration 042). Índice único: um gasto da
--    carteira gera no máximo um lançamento, pra sempre.
alter table public.lancamentos_financeiros
  add column carteira_movimento_id uuid references public.carteira_movimentos(id) on delete set null;
create unique index idx_lancamentos_movimento_unico
  on public.lancamentos_financeiros (carteira_movimento_id) where carteira_movimento_id is not null;

-- 4) RLS.
--    Ver: o proprietário vê as carteiras do barco dele; o tripulante vê a
--    DELE — e só se tiver a área `carteira` liberada. Note que não basta
--    `permissao(...)`: sem o `tripulante_id = auth.uid()` um tripulante com
--    carteira veria o extrato dos colegas, que é dado de terceiro.
alter table public.carteiras enable row level security;
alter table public.carteira_movimentos enable row level security;

create policy "carteiras: prop ve as do barco, tripulante ve a dele" on public.carteiras for select
  using (
    public.eh_prop(embarcacao_id)
    or (tripulante_id = auth.uid() and public.permissao(embarcacao_id, 'carteira', 'ver'))
  );

-- Criar/alterar/encerrar: só o proprietário, e só pra quem já é tripulação
-- do barco — carteira pra alguém sem vínculo seria conta paralela.
create policy "carteiras: so o prop cria" on public.carteiras for insert
  with check (
    public.eh_prop(embarcacao_id)
    and exists (
      select 1 from public.vinculos v
      where v.embarcacao_id = carteiras.embarcacao_id and v.usuario_id = carteiras.tripulante_id
    )
  );
create policy "carteiras: so o prop altera" on public.carteiras for update
  using (public.eh_prop(embarcacao_id)) with check (public.eh_prop(embarcacao_id));

-- Movimentos: leitura acompanha a carteira.
create policy "movimentos: ver pela carteira" on public.carteira_movimentos for select
  using (exists (
    select 1 from public.carteiras c
    where c.id = carteira_movimentos.carteira_id
      and (
        public.eh_prop(c.embarcacao_id)
        or (c.tripulante_id = auth.uid() and public.permissao(c.embarcacao_id, 'carteira', 'ver'))
      )
  ));

-- Escrita direta cobre só repasse (proprietário) e devolução. GASTO NÃO
-- ENTRA POR AQUI de propósito: ele precisa nascer junto do lançamento no
-- Financeiro quando já vem aprovado, e isso é indivisível — mora na função
-- `carteira_registrar_gasto` (bloco 5). Um insert de gasto direto na tabela
-- é barrado pelas duas policies abaixo.
create policy "movimentos: prop repassa e devolve" on public.carteira_movimentos for insert
  with check (
    tipo in ('repasse', 'devolucao')
    and status = 'aprovado'
    and exists (
      select 1 from public.carteiras c
      where c.id = carteira_movimentos.carteira_id and public.eh_prop(c.embarcacao_id) and c.ativa
    )
  );

-- Devolução partindo do tripulante nasce PENDENTE — o PRD diz "devolução de
-- saldo, confirmada pelo proprietário". Quem confirma é a função do bloco 5.
create policy "movimentos: tripulante devolve, pendente de confirmacao" on public.carteira_movimentos for insert
  with check (
    tipo = 'devolucao'
    and status = 'pendente'
    and exists (
      select 1 from public.carteiras c
      where c.id = carteira_movimentos.carteira_id
        and c.tripulante_id = auth.uid()
        and c.ativa
        and public.permissao(c.embarcacao_id, 'carteira', 'editar')
    )
  );

create policy "movimentos: prop corrige" on public.carteira_movimentos for update
  using (exists (
    select 1 from public.carteiras c
    where c.id = carteira_movimentos.carteira_id and public.eh_prop(c.embarcacao_id)
  ))
  with check (exists (
    select 1 from public.carteiras c
    where c.id = carteira_movimentos.carteira_id and public.eh_prop(c.embarcacao_id)
  ));

create policy "movimentos: prop exclui" on public.carteira_movimentos for delete
  using (exists (
    select 1 from public.carteiras c
    where c.id = carteira_movimentos.carteira_id and public.eh_prop(c.embarcacao_id)
  ));

-- 5) As duas escritas que precisam ser atômicas.
--
--    `carteira_lancar_no_financeiro` é o ÚNICO lugar que cria o lançamento
--    de um gasto de carteira. Idempotente por construção (sai fora se já
--    tem lançamento) — chamar duas vezes não duplica número na tela.
--    Ele é SECURITY DEFINER porque o tripulante que registra o gasto
--    normalmente NÃO tem a área `gastos` (as duas permissões são
--    independentes, PRD §9.4): sem definer, o gasto dele nunca alimentaria
--    o Financeiro da embarcação, que é exatamente o que o PRD manda.
create or replace function public.carteira_lancar_no_financeiro(p_movimento_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m record;
  c record;
  v_id uuid;
begin
  select * into m from public.carteira_movimentos where id = p_movimento_id;
  if not found then
    raise exception 'movimento não encontrado';
  end if;
  if m.tipo <> 'gasto' or m.status <> 'aprovado' then
    return null;
  end if;
  -- Idempotência: se este gasto já virou lançamento, sai sem criar outro.
  select id into v_id from public.lancamentos_financeiros where carteira_movimento_id = m.id;
  if v_id is not null then
    return v_id;
  end if;
  select * into c from public.carteiras where id = m.carteira_id;

  insert into public.lancamentos_financeiros (
    embarcacao_id, tipo, categoria, descricao, valor_centavos, data, status,
    comprovante_path, observacao, carteira_movimento_id, criado_por
  ) values (
    c.embarcacao_id, 'despesa', m.categoria, m.descricao, m.valor_centavos, m.data, 'pago',
    m.comprovante_path, m.observacao, m.id, m.criado_por
  )
  returning id into v_id;
  return v_id;
end $$;

--    `carteira_registrar_gasto` — a porta única do gasto. Decide o status
--    pelo MODO da carteira (nunca pelo que o cliente mandou) e cobra o
--    comprovante quando a carteira exige.
create or replace function public.carteira_registrar_gasto(
  p_carteira_id uuid,
  p_valor_centavos bigint,
  p_data date,
  p_descricao text,
  p_categoria text,
  p_comprovante_path text,
  p_observacao text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_eh_prop boolean;
  v_status text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into c from public.carteiras where id = p_carteira_id;
  if not found then
    raise exception 'carteira não encontrada';
  end if;

  v_eh_prop := public.eh_prop(c.embarcacao_id);
  if not v_eh_prop and not (
    c.tripulante_id = auth.uid() and public.permissao(c.embarcacao_id, 'carteira', 'editar')
  ) then
    raise exception 'sem acesso a esta carteira';
  end if;
  if not c.ativa then
    raise exception 'esta carteira está encerrada';
  end if;
  if p_valor_centavos is null or p_valor_centavos <= 0 then
    raise exception 'valor inválido';
  end if;
  if coalesce(btrim(p_descricao), '') = '' then
    raise exception 'descrição obrigatória';
  end if;
  if c.exige_comprovante and coalesce(btrim(p_comprovante_path), '') = '' then
    raise exception 'esta carteira exige comprovante em todo gasto';
  end if;

  -- Registro Direto já nasce aprovado; Aprovação do Proprietário nasce
  -- pendente. O próprio proprietário lançando pelo tripulante não espera
  -- aprovação de si mesmo.
  v_status := case when v_eh_prop or c.modo = 'direto' then 'aprovado' else 'pendente' end;

  insert into public.carteira_movimentos (
    carteira_id, tipo, valor_centavos, data, descricao, categoria,
    comprovante_path, observacao, status, criado_por, decidido_por, decidido_em
  ) values (
    p_carteira_id, 'gasto', p_valor_centavos, coalesce(p_data, current_date),
    btrim(p_descricao), coalesce(nullif(btrim(p_categoria), ''), 'outros'),
    nullif(btrim(p_comprovante_path), ''), nullif(btrim(p_observacao), ''),
    v_status, auth.uid(),
    case when v_status = 'aprovado' then auth.uid() end,
    case when v_status = 'aprovado' then now() end
  )
  returning id into v_id;

  if v_status = 'aprovado' then
    perform public.carteira_lancar_no_financeiro(v_id);
  end if;
  return v_id;
end $$;

--    `carteira_decidir_movimento` — aprovar/recusar o que está pendente
--    (gasto no modo Aprovação, devolução registrada pelo tripulante). Só o
--    proprietário. Aprovar gasto puxa o lançamento no Financeiro pela mesma
--    função de sempre.
create or replace function public.carteira_decidir_movimento(
  p_movimento_id uuid,
  p_decisao text,
  p_motivo text
) returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
  c record;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  if p_decisao not in ('aprovado', 'recusado') then
    raise exception 'decisão inválida';
  end if;
  select * into m from public.carteira_movimentos where id = p_movimento_id;
  if not found then
    raise exception 'movimento não encontrado';
  end if;
  select * into c from public.carteiras where id = m.carteira_id;
  if not public.eh_prop(c.embarcacao_id) then
    raise exception 'só o proprietário decide sobre a Carteira';
  end if;
  if m.status <> 'pendente' then
    raise exception 'este movimento já foi decidido';
  end if;

  update public.carteira_movimentos
    set status = p_decisao,
        motivo_recusa = case when p_decisao = 'recusado' then nullif(btrim(p_motivo), '') end,
        decidido_por = auth.uid(),
        decidido_em = now()
    where id = p_movimento_id;

  if p_decisao = 'aprovado' and m.tipo = 'gasto' then
    perform public.carteira_lancar_no_financeiro(p_movimento_id);
  end if;
end $$;

-- `carteira_lancar_no_financeiro` não é chamada pelo app: é detalhe interno
-- das duas funções acima, e dar execute a `authenticated` deixaria qualquer
-- um forçar o lançamento de um movimento que ainda não foi aprovado.
-- `authenticated` está explícito no revoke porque o Supabase concede execute
-- a esse papel por default privilege — só revogar de `public` deixa a função
-- publicada em /rest/v1/rpc (flagrado pelo advisor de segurança na onda 42).
revoke all on function public.carteira_lancar_no_financeiro(uuid) from public, anon, authenticated;
revoke all on function public.carteira_registrar_gasto(uuid, bigint, date, text, text, text, text) from public, anon;
revoke all on function public.carteira_decidir_movimento(uuid, text, text) from public, anon;
grant execute on function public.carteira_registrar_gasto(uuid, bigint, date, text, text, text, text) to authenticated;
grant execute on function public.carteira_decidir_movimento(uuid, text, text) to authenticated;

-- 6) Transferência de propriedade — mesma regra do dinheiro (PRD §17): a
--    carteira é acerto pessoal entre o dono ANTIGO e a tripulação dele.
--    Sem esta linha, o dono novo herdaria "Fulano deve R$ 1.200 ao barco",
--    dívida que não é dele nem com ele. Os movimentos caem por cascade.
create or replace function public.aceitar_transferencia(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into t from public.transferencias
    where codigo = p_codigo and status = 'pendente' and expira_em > now();
  if not found then
    raise exception 'transferência inválida ou expirada';
  end if;
  if v_email = '' or lower(t.destinatario_email) <> v_email then
    raise exception 'este convite foi enviado para outro e-mail';
  end if;

  delete from public.vinculos where embarcacao_id = t.embarcacao_id and papel = 'CMDT';
  delete from public.vinculos where embarcacao_id = t.embarcacao_id and usuario_id = t.de_usuario_id and papel = 'PROP';

  update public.eventos
    set custo_centavos = null, passageiros = '{}', tripulacao = '{}'
    where embarcacao_id = t.embarcacao_id;
  delete from public.contatos where embarcacao_id = t.embarcacao_id;
  delete from public.carteiras where embarcacao_id = t.embarcacao_id;
  delete from public.lancamentos_financeiros where embarcacao_id = t.embarcacao_id;
  delete from public.recorrencias_financeiras where embarcacao_id = t.embarcacao_id;

  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), t.embarcacao_id, 'PROP');

  update public.transferencias
    set status = 'aceita', para_usuario_id = auth.uid(), aceita_em = now()
    where id = t.id;

  return t.embarcacao_id;
end $$;

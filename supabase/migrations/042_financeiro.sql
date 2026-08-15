-- =====================================================================
-- Onda 42 · FINANCEIRO (PRD FINAL §9.1–9.3) — a aba oficial que faltava.
-- Ver docs/prd/upgrade2-master-final.txt §9 e a auditoria
-- docs/auditoria/2026-08-15-prd-final-vs-codigo.md §3 ("Financeiro — não
-- existe. Hoje há só `custo_centavos` solto em `eventos`").
--
-- DECISÃO DE ARQUITETURA (a mais importante deste arquivo): o Financeiro
-- passa a ser a FONTE do dinheiro do barco, e `eventos.custo_centavos`
-- vira registro histórico daquele evento do Diário, não mais a base de
-- soma de nenhuma tela. O PRD é explícito: um Hub que oferece "Adicionar
-- ao Financeiro" "cria o mesmo lançamento central, não uma cópia". Se o
-- mesmo gasto aparecesse somado nos dois lugares, seria bug — por isso:
--   · toda linha antiga de `eventos` com custo é migrada pra cá (bloco 4);
--   · o lançamento nascido de um evento aponta pra ele (`evento_id`) e há
--     índice ÚNICO nesse campo — "Adicionar ao Financeiro" duas vezes no
--     mesmo evento não cria dois lançamentos, esbarra no índice;
--   · quem soma (Visão Geral, Relatórios, cartão de /hoje) lê SÓ daqui.
--
-- ÁREA DE PERMISSÃO: continua sendo `gastos`. O PRD chama a aba de
-- "Financeiro" e o rótulo na interface mudou pra isso, mas a CHAVE do
-- jsonb de `vinculos.permissoes` fica como está — ela já está gravada em
-- todos os vínculos existentes, e trocar a chave faria todo mundo que já
-- foi convidado perder (ou ganhar) acesso silenciosamente. Renomear
-- rótulo é decisão de vocabulário; renomear chave seria migração de
-- acesso, que a CLAUDE.md proíbe fazer de graça.
-- =====================================================================

-- 1) LANÇAMENTOS — a linha do dinheiro. Despesa e entrada na mesma tabela
--    porque tudo que o PRD pede (saldo, comparação entre períodos, por
--    categoria) é a mesma consulta com um `tipo` a mais; duas tabelas só
--    duplicariam RLS e relatório.
create table public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'entrada')),
  -- As 10 categorias sugeridas do PRD §9.1, na ordem em que ele lista.
  categoria text not null check (categoria in (
    'marina_vaga', 'combustivel', 'manutencao', 'tripulacao', 'seguro',
    'documentacao_taxas', 'limpeza_conservacao', 'pecas_equipamentos', 'transporte', 'outros'
  )),
  descricao text not null,
  -- Dinheiro SEMPRE em centavos (padrão da casa, ver `eventos.custo_centavos`
  -- e `formatarReais` em web/lib/domain/gastos.ts). `bigint` e não `int`:
  -- um lançamento de reforma de barco grande estoura 21 milhões de centavos
  -- com folga menor do que parece, e migrar tipo de coluna cheia é caro.
  valor_centavos bigint not null check (valor_centavos > 0),
  data date not null,
  -- pago/pendente para despesa, recebido/pendente para entrada — o PRD usa
  -- os dois pares, mas é o MESMO estado ("o dinheiro já circulou?"). Guardar
  -- um par só evita que relatório precise de dois caminhos; o rótulo certo
  -- por tipo mora em web/lib/domain/financeiro.ts (`rotuloStatus`).
  status text not null default 'pago' check (status in ('pago', 'pendente')),
  fornecedor text,
  forma_pagamento text check (forma_pagamento in (
    'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'outro'
  )),
  comprovante_path text,
  observacao text,
  -- Evento do Diário que originou este lançamento (Hub → "Adicionar ao
  -- Financeiro"). `on delete set null`: apagar a saída do Diário não pode
  -- apagar o dinheiro que saiu de verdade da conta.
  evento_id uuid references public.eventos(id) on delete set null,
  -- Série recorrente que gerou este vencimento (bloco 2). Null = lançamento
  -- avulso/variável — é assim que o relatório separa "recorrentes vs
  -- variáveis" que o PRD §9.3 pede, sem coluna redundante.
  recorrencia_id uuid,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.lancamentos_financeiros is
  'Fonte única do dinheiro da embarcação (PRD §9.1). Regra do PRD que o formulário e a tela repetem: "Orçamento/proposta não é despesa. Somente gasto efetivado/confirmado pode ser registrado como despesa" — por isso não existe estado "orçado"/"proposto" aqui, só pago e pendente (conta assumida que ainda não foi paga).';

-- 2) RECORRENTES (PRD §9.2). A série guarda a REGRA; os vencimentos não
--    nascem gravados. Motivo: "Um vencimento não é automaticamente pago;
--    usuário marca como pago" — se materializássemos linha por linha
--    (precisaria de cron, que este projeto não tem), o banco ficaria cheio
--    de dívida futura que ninguém confirmou. Os vencimentos são calculados
--    em memória (web/lib/domain/financeiro.ts, `vencimentosNoIntervalo`) e
--    só viram linha em `lancamentos_financeiros` quando alguém marca pago
--    ou muda o valor daquele mês — o índice único (recorrencia_id, data)
--    logo abaixo garante que o mesmo vencimento nunca vire dois.
create table public.recorrencias_financeiras (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'entrada')),
  categoria text not null check (categoria in (
    'marina_vaga', 'combustivel', 'manutencao', 'tripulacao', 'seguro',
    'documentacao_taxas', 'limpeza_conservacao', 'pecas_equipamentos', 'transporte', 'outros'
  )),
  descricao text not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  frequencia text not null check (frequencia in ('semanal', 'mensal', 'trimestral', 'semestral', 'anual')),
  inicio date not null,
  -- Última data ainda coberta por esta série. Fica preenchido quando o dono
  -- escolhe "este e os próximos" ao mudar o valor: a série velha é FECHADA
  -- no dia anterior e nasce uma nova com o valor novo (`origem_id` liga as
  -- duas). Assim o histórico do que foi combinado antes nunca é reescrito —
  -- alternativa seria sobrescrever o valor da série e mentir sobre quanto
  -- custava a vaga da marina no ano passado.
  fim date,
  fornecedor text,
  forma_pagamento text check (forma_pagamento in (
    'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia', 'outro'
  )),
  observacao text,
  ativa boolean not null default true,
  origem_id uuid references public.recorrencias_financeiras(id) on delete set null,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

alter table public.lancamentos_financeiros
  add constraint lancamentos_recorrencia_fk
  foreign key (recorrencia_id) references public.recorrencias_financeiras(id) on delete set null;

create index idx_lancamentos_embarcacao_data
  on public.lancamentos_financeiros (embarcacao_id, data desc);
create index idx_lancamentos_recorrencia
  on public.lancamentos_financeiros (recorrencia_id);
create unique index idx_lancamentos_evento_unico
  on public.lancamentos_financeiros (evento_id) where evento_id is not null;
create unique index idx_lancamentos_vencimento_unico
  on public.lancamentos_financeiros (recorrencia_id, data) where recorrencia_id is not null;
create index idx_recorrencias_embarcacao
  on public.recorrencias_financeiras (embarcacao_id, ativa);

-- 3) RLS pela matriz — área `gastos` (ver cabeçalho: chave antiga, rótulo
--    novo). Mesma régua do resto do app: ver para ler, editar para escrever.
alter table public.lancamentos_financeiros enable row level security;
alter table public.recorrencias_financeiras enable row level security;

create policy "lancamentos: ver pela matriz" on public.lancamentos_financeiros for select
  using (public.permissao(embarcacao_id, 'gastos', 'ver'));
create policy "lancamentos: criar pela matriz" on public.lancamentos_financeiros for insert
  with check (public.permissao(embarcacao_id, 'gastos', 'editar'));
create policy "lancamentos: atualizar pela matriz" on public.lancamentos_financeiros for update
  using (public.permissao(embarcacao_id, 'gastos', 'editar'))
  with check (public.permissao(embarcacao_id, 'gastos', 'editar'));
create policy "lancamentos: excluir pela matriz" on public.lancamentos_financeiros for delete
  using (public.permissao(embarcacao_id, 'gastos', 'editar'));

create policy "recorrencias: ver pela matriz" on public.recorrencias_financeiras for select
  using (public.permissao(embarcacao_id, 'gastos', 'ver'));
create policy "recorrencias: criar pela matriz" on public.recorrencias_financeiras for insert
  with check (public.permissao(embarcacao_id, 'gastos', 'editar'));
create policy "recorrencias: atualizar pela matriz" on public.recorrencias_financeiras for update
  using (public.permissao(embarcacao_id, 'gastos', 'editar'))
  with check (public.permissao(embarcacao_id, 'gastos', 'editar'));
create policy "recorrencias: excluir pela matriz" on public.recorrencias_financeiras for delete
  using (public.permissao(embarcacao_id, 'gastos', 'editar'));

-- 4) MIGRAÇÃO DO QUE JÁ EXISTE. Todo custo já lançado no Diário vira
--    lançamento aqui, senão a tela nova nasceria zerada pra quem usa o app
--    há meses — e o cartão "Gastos do mês" de /hoje, que passa a ler daqui,
--    diria R$ 0,00 pra quem gastou. Categoria deduzida do que o evento já
--    dizia de si (tipo/categoria); nada é inventado além disso, o resto
--    cai em "Outros".
--    `status = 'pago'`: um custo lançado no Diário é gasto que já aconteceu.
insert into public.lancamentos_financeiros (
  embarcacao_id, tipo, categoria, descricao, valor_centavos, data, status,
  comprovante_path, evento_id, criado_por, created_at
)
select
  e.embarcacao_id,
  'despesa',
  case
    when e.categoria = 'documento' then 'documentacao_taxas'
    when e.categoria in ('deck', 'fibra', 'inox', 'vidros', 'estofados', 'casco_outros') then 'limpeza_conservacao'
    when e.categoria in ('motor_oleo', 'motor_filtro_oleo', 'motor_filtro_combustivel', 'motor_filtro_ar', 'motor_filtro_outros') then 'manutencao'
    when e.tipo = 'abastecimento' then 'combustivel'
    when e.tipo in ('manutencao', 'avaria', 'docagem') then 'manutencao'
    else 'outros'
  end,
  coalesce(nullif(btrim(e.descricao), ''), 'Gasto registrado no Diário'),
  e.custo_centavos,
  e.data,
  'pago',
  e.anexo_path,
  e.id,
  e.criado_por,
  e.created_at
from public.eventos e
where e.custo_centavos is not null and e.custo_centavos > 0;

comment on column public.eventos.custo_centavos is
  'HISTÓRICO daquele evento do Diário. Desde a onda 42 (PRD §9) quem SOMA dinheiro lê public.lancamentos_financeiros — este campo continua sendo gravado junto do evento e um lançamento espelho nasce com evento_id apontando pra ele. Nunca some as duas fontes: seria contar o mesmo gasto duas vezes.';

-- 5) TRANSFERÊNCIA DE PROPRIEDADE — o PRD §17 manda NÃO transferir
--    "informações financeiras pessoais", e a onda 41 já implementava isso
--    limpando `eventos.custo_centavos`. Com o Financeiro, o dinheiro passou
--    a morar em outro lugar: sem este bloco, o dono novo herdaria o extrato
--    inteiro do dono antigo — exatamente o que a regra proíbe, só que por
--    uma porta nova. Mesma transação da troca de dono, mesmo caráter
--    irreversível já avisado na tela.
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
  delete from public.lancamentos_financeiros where embarcacao_id = t.embarcacao_id;
  delete from public.recorrencias_financeiras where embarcacao_id = t.embarcacao_id;

  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), t.embarcacao_id, 'PROP');

  update public.transferencias
    set status = 'aceita', para_usuario_id = auth.uid(), aceita_em = now()
    where id = t.id;

  return t.embarcacao_id;
end $$;

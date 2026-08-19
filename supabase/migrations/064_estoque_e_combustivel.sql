-- =====================================================================
-- Onda 73 · ESTOQUE E HUB COMBUSTÍVEL.
-- PRD-UPGRADE-3-COTAS §10 e §11.
--
-- Os dois §§ abrem com a mesma trava, cada um do seu jeito: "logística
-- simples de materiais; NÃO CRIAR WMS/ERP". Ficaram de fora: endereço de
-- prateleira, curva ABC, lote, validade por série, inventário rotativo.
-- O que existe aqui responde três perguntas do pátio — o que tem, o que
-- está acabando, e para onde foi.
--
-- ---------------------------------------------------------------------
-- POR QUE ESTOQUE E TANQUE PERTENCEM AO DONO, E NÃO À EMBARCAÇÃO
-- ---------------------------------------------------------------------
-- Todo o resto do Commander é por embarcação. Estoque não: o §10 pede
-- "múltiplas bases/localizações" e o §11 fala em tanque que ABASTECE
-- várias unidades. Uma prateleira de filtros não é de um Jet — é da
-- empresa, e o Jet consome dela.
--
-- Por isso `dono_id` e não `embarcacao_id`, com RLS simples (`= auth.uid()`).
-- O vínculo com a unidade acontece no MOVIMENTO ("este filtro foi para
-- aquele Jet"), que é exatamente onde o §10 quer o rastro e o custo.
--
-- ---------------------------------------------------------------------
-- AS DUAS CONSTRAINTS QUE CARREGAM REGRA DE NEGÓCIO
-- ---------------------------------------------------------------------
-- 1. `estoque_itens.quantidade >= 0`. Saldo negativo é a maneira de o app
--    parar de saber quanto existe de verdade. Quem retirou mais do que o
--    sistema achava que havia ajusta o estoque (com motivo, §22) — não
--    empurra o saldo abaixo de zero. A mesma recusa vive em
--    `retirarDoEstoque`, com teste e com frase em português.
--
-- 2. `tanque_saida_tem_destino`. O §11 diz "Saída: destino OBRIGATÓRIO
--    (Jet/unidade ou outro destino autorizado)". É a regra que faz o tanque
--    próprio valer alguma coisa: litro que sai sem destino some do sistema
--    e o consumo por unidade — o relatório que o §11 pede — fica sem base.
--    Aceita destino de frota OU destino livre; exige um dos dois.
--
-- ---------------------------------------------------------------------
-- MEDIÇÃO É UM MOVIMENTO, NÃO UM CAMPO
-- ---------------------------------------------------------------------
-- `tanque_movimentos.tipo` inclui 'medicao'. A régua física medida num dia
-- é um FATO datado, com autor — não o estado atual do tanque. Guardar só
-- "saldo atual" apagaria o histórico de conferências, que é justamente o
-- que mostra se o tanque vive divergindo. O saldo teórico é calculado
-- (`saldoTeorico`, no domínio), nunca guardado: número derivado que se
-- guarda é número que sai de sincronia.
-- =====================================================================

create table public.bases_operacionais (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);

alter table public.bases_operacionais enable row level security;
create policy "bases: o dono le" on public.bases_operacionais
  for select to authenticated using (dono_id = auth.uid());
create policy "bases: o dono escreve" on public.bases_operacionais
  for all to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());

create table public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.profiles(id) on delete cascade,
  base_id uuid references public.bases_operacionais(id) on delete set null,
  nome text not null,
  -- As nove categorias que o §10 lista, palavra por palavra.
  categoria text not null check (categoria in (
    'peca','oleo','filtro','bateria','vela','cabo','seguranca','consumivel','outro'
  )),
  unidade text,
  -- Ver o cabeçalho, constraint 1.
  quantidade numeric not null default 0 check (quantidade >= 0),
  -- `null` = ninguém pediu pra acompanhar este item. `estadoDoItem` não
  -- inventa mínimo, então o app não alerta sobre o que não foi pedido.
  minimo numeric check (minimo is null or minimo >= 0),
  fornecedor text,
  custo_unitario_centavos bigint check (custo_unitario_centavos is null or custo_unitario_centavos >= 0),
  criado_em timestamptz not null default now()
);

create index estoque_itens_dono_idx on public.estoque_itens (dono_id, categoria, nome);

alter table public.estoque_itens enable row level security;
create policy "estoque: o dono le" on public.estoque_itens
  for select to authenticated using (dono_id = auth.uid());
create policy "estoque: o dono escreve" on public.estoque_itens
  for all to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());

create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.estoque_itens(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','retirada','ajuste')),
  quantidade numeric not null,
  -- O rastro que o §10 pede: para qual unidade foi, e em qual serviço.
  embarcacao_id uuid references public.embarcacoes(id) on delete set null,
  servico_id uuid references public.servicos_mecanica(id) on delete set null,
  -- §22: ajuste que gera divergência exige motivo.
  motivo text,
  autor_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index estoque_movimentos_item_idx on public.estoque_movimentos (item_id, criado_em desc);

alter table public.estoque_movimentos enable row level security;
create policy "estoque_mov: dono do item le" on public.estoque_movimentos
  for select to authenticated using (exists (
    select 1 from public.estoque_itens i where i.id = estoque_movimentos.item_id and i.dono_id = auth.uid()
  ));
-- `autor_id = auth.uid()`: movimento em nome de outra pessoa esvaziaria o
-- "usuário, data/hora" que o §10 exige na movimentação.
create policy "estoque_mov: dono do item registra" on public.estoque_movimentos
  for insert to authenticated with check (
    autor_id = auth.uid() and exists (
      select 1 from public.estoque_itens i where i.id = estoque_movimentos.item_id and i.dono_id = auth.uid()
    )
  );

create table public.tanques (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.profiles(id) on delete cascade,
  base_id uuid references public.bases_operacionais(id) on delete set null,
  nome text not null,
  combustivel text,
  capacidade_litros numeric check (capacidade_litros is null or capacidade_litros > 0),
  -- O ponto de partida do balanço do §11. O saldo ATUAL não fica aqui: é
  -- calculado a partir dele mais os movimentos (ver cabeçalho).
  saldo_inicial_litros numeric not null default 0,
  minimo_litros numeric check (minimo_litros is null or minimo_litros >= 0),
  criado_em timestamptz not null default now()
);

alter table public.tanques enable row level security;
create policy "tanques: o dono le" on public.tanques
  for select to authenticated using (dono_id = auth.uid());
create policy "tanques: o dono escreve" on public.tanques
  for all to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());

create table public.tanque_movimentos (
  id uuid primary key default gen_random_uuid(),
  tanque_id uuid not null references public.tanques(id) on delete cascade,
  -- 'medicao' é a régua física conferida: fato datado, não estado.
  tipo text not null check (tipo in ('entrada','saida','medicao')),
  litros numeric not null check (litros >= 0),
  destino_embarcacao_id uuid references public.embarcacoes(id) on delete set null,
  destino_livre text,
  fornecedor text,
  valor_centavos bigint check (valor_centavos is null or valor_centavos >= 0),
  comprovante_path text,
  motivo text,
  autor_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  -- Ver o cabeçalho, constraint 2.
  constraint tanque_saida_tem_destino
    check (tipo <> 'saida' or destino_embarcacao_id is not null or destino_livre is not null)
);

create index tanque_movimentos_tanque_idx on public.tanque_movimentos (tanque_id, criado_em desc);

alter table public.tanque_movimentos enable row level security;
create policy "tanque_mov: dono do tanque le" on public.tanque_movimentos
  for select to authenticated using (exists (
    select 1 from public.tanques t where t.id = tanque_movimentos.tanque_id and t.dono_id = auth.uid()
  ));
create policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos
  for insert to authenticated with check (
    autor_id = auth.uid() and exists (
      select 1 from public.tanques t where t.id = tanque_movimentos.tanque_id and t.dono_id = auth.uid()
    )
  );

-- O abastecimento POR UNIDADE do §11. Esta tabela é por embarcação (ao
-- contrário do estoque e do tanque) porque o abastecimento é fato da
-- unidade: ela consumiu tantos litros, custou tanto, com o horímetro em tal
-- ponto. `tanque_movimento_id` liga o abastecimento à saída do tanque
-- próprio quando veio de lá — é o que o §11 chama de "abastecimento pelo
-- tanque baixa saldo E registra automaticamente no Jet". Nulo quando foi
-- em posto externo.
create table public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  tanque_movimento_id uuid references public.tanque_movimentos(id) on delete set null,
  litros numeric not null check (litros > 0),
  valor_centavos bigint check (valor_centavos is null or valor_centavos >= 0),
  horas numeric,
  posto text,
  comprovante_path text,
  responsavel_id uuid references public.profiles(id) on delete set null,
  abastecido_em timestamptz not null default now()
);

create index abastecimentos_embarcacao_idx on public.abastecimentos (embarcacao_id, abastecido_em desc);

alter table public.abastecimentos enable row level security;
-- Ler é do Financeiro (é custo), registrar é do Diário (quem abastece é
-- quem opera). Duas áreas diferentes de propósito: o funcionário do pátio
-- anota o abastecimento sem enxergar o custo da frota.
create policy "abastecimentos: quem ve o financeiro le" on public.abastecimentos
  for select to authenticated using (public.permissao(embarcacao_id, 'gastos', 'ver'));
create policy "abastecimentos: quem edita o diario registra" on public.abastecimentos
  for insert to authenticated with check (public.permissao(embarcacao_id, 'diario', 'editar'));
create policy "abastecimentos: quem edita o financeiro corrige" on public.abastecimentos
  for update to authenticated
  using (public.permissao(embarcacao_id, 'gastos', 'editar'))
  with check (public.permissao(embarcacao_id, 'gastos', 'editar'));

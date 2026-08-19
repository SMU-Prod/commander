-- ============================================================================
-- 091 — Transferir a embarcação PRESERVA o financeiro do dono anterior
-- ============================================================================
-- ⚠️  ESCRITA E **NÃO APLICADA**. Aplicar é decisão do dono, não do time —
--     ver "POR QUE ISTO NÃO FOI APLICADO" no fim deste cabeçalho.
--
-- FECHA: o achado 1.1 da auditoria de produto de 19/08/2026
--        (`docs/auditoria/2026-08-19-produto-promessa-x-entrega.md`), descrito
--        lá como "o achado mais caro do app".
--
-- O PROBLEMA, NA VOZ DE QUEM USA
-- ------------------------------
-- A tela `/barco/transferir` mostrava ao dono uma caixa "O que acontece quando
-- for aceito" com três marcadores, e os três falavam do que CONTINUA:
--   · Você perde o acesso a esta embarcação — não dá pra desfazer.
--   · A tripulação atual também perde o acesso.
--   · Motores, horas, manutenções, ocorrências, fotos e documentos continuam.
--
-- A definição VIVA de `aceitar_transferencia`, lida do banco com
-- `pg_get_functiondef` (não do arquivo da migration 038, que diverge do
-- remoto neste projeto), faz cinco escritas que nenhum dos três marcadores
-- menciona:
--
--   update public.eventos
--     set custo_centavos = null, passageiros = '{}', tripulacao = '{}'
--     where embarcacao_id = t.embarcacao_id;
--   delete from public.contatos                 where embarcacao_id = ...;
--   delete from public.carteiras                where embarcacao_id = ...;
--   delete from public.lancamentos_financeiros  where embarcacao_id = ...;
--   delete from public.recorrencias_financeiras where embarcacao_id = ...;
--
-- Ou seja: no instante em que o comprador clica em aceitar, TODO o Financeiro
-- daquele barco, todas as contas recorrentes, todas as Carteiras da tripulação,
-- a agenda inteira de contatos de confiança e o custo de cada saída do Diário
-- são DESTRUÍDOS. E há um sexto estrago que nem aparece na função:
-- `carteira_movimentos.carteira_id` é `on delete cascade`, então apagar as
-- Carteiras leva junto TODO o extrato de repasses e devoluções da tripulação —
-- destruição por arrasto, que é a que ninguém audita. Não são ocultados, não são transferidos, não são exportados
-- antes. E quem autoriza é justamente quem perde: o dono que está vendendo o
-- barco e que vai precisar desse histórico para declarar imposto ou para
-- justificar preço na negociação seguinte. É o mesmo histórico que a landing
-- vende como argumento — "um histórico que vale dinheiro na hora de vender".
--
-- ISTO TAMBÉM NÃO É O QUE O PRD PEDE
-- ----------------------------------
-- §17 (`upgrade2-master-final.txt:398`): "Não transferir automaticamente:
-- dados pessoais, passageiros, custos privados, informações financeiras
-- pessoais". **Não transferir ≠ apagar.** O §7 (`:206`) vai na direção
-- contrária e é explícito: "Registros finalizados relevantes não são apagados
-- silenciosamente".
--
-- O `DELETE` cumpre o §17 por acidente — ao destruir, garante que não
-- transfere — e viola o §7 por desenho. Esta migration cumpre os dois: o dado
-- sai do barco e FICA COM QUEM O CRIOU.
--
-- ============================================================================
-- A ESCOLHA DE DESENHO — arquivar no lugar, não mover para outra tabela
-- ============================================================================
-- (Alternativa descartada.) A saída óbvia seria copiar as linhas para tabelas
-- `*_arquivadas` e apagar as originais. Descartada por três motivos:
--   1. duplica cinco esquemas que já existem, e toda coluna nova em
--      `lancamentos_financeiros` daqui pra frente teria de ser lembrada duas
--      vezes — o tipo de dívida que ninguém paga;
--   2. quebra as chaves estrangeiras internas do financeiro
--      (`lancamentos.recorrencia_id`, `lancamentos.evento_id`,
--      `lancamentos.carteira_movimento_id`), que é justamente o que dá sentido
--      ao histórico: "esta despesa nasceu daquela conta fixa";
--   3. um `insert ... select` + `delete` sob RLS é onde nasce a perda de dado
--      silenciosa que este projeto já pagou caro (escrita sem `.select()`).
--
-- O que esta migration faz é mais simples: a linha continua onde está, ganha
-- um CARIMBO de arquivamento, e a RLS passa a ler esse carimbo. Uma linha
-- arquivada deixa de existir para a tripulação do barco e passa a existir só
-- para o dono anterior. Nenhum byte se move, nenhuma FK se rompe.
--
-- Três colunas, iguais nas quatro tabelas:
--   arquivado_em                  — quando (null = linha viva)
--   arquivado_para                — de quem passa a ser (o dono anterior)
--   arquivado_por_transferencia   — por causa de qual transferência
-- A terceira não é enfeite: é a única resposta possível ao dia em que alguém
-- perguntar "por que este lançamento sumiu do meu barco?". Mesma razão pela
-- qual a 089 guardou a coluna `origem` em `avisos_demanda`.
--
-- O CASO DE `eventos` É DIFERENTE, E POR ISSO TEM TABELA PRÓPRIA
-- --------------------------------------------------------------
-- A saída em si é história do BARCO (data, destino, horas de motor, trilha) e
-- tem de continuar com ele — é metade do valor do dossiê que o comprador
-- recebe. O que não pode passar são três campos DENTRO da linha:
-- `custo_centavos`, `passageiros` e `tripulacao` (§17, literalmente: "custos
-- privados" e "passageiros"). Carimbar a linha inteira esconderia a saída;
-- por isso os três campos saem para `eventos_privados_arquivados`, com uma
-- fotografia do que a saída era (nome do barco, data, tipo, destino) para o
-- arquivo continuar legível mesmo se a saída for apagada depois pelo novo
-- dono.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- (1) VAZAMENTO PARA O NOVO DONO — o perigo principal, e é o inverso exato do
--     defeito atual. Se a policy de SELECT continuasse como está, parar de
--     apagar significaria ENTREGAR ao comprador o extrato financeiro completo
--     do vendedor: quanto ele pagou, a quem, com que forma de pagamento, com
--     comprovante anexado. Seria trocar uma perda de dado por um vazamento de
--     dado, e o vazamento é pior porque é irreversível de outro jeito.
--     Por isso TODA policy de SELECT das quatro tabelas passa a ter dois
--     ramos, e o primeiro carrega a negação:
--        (arquivado_em is null  AND <a regra que já existia>)
--        OR
--        (arquivado_em is not null AND arquivado_para = auth.uid())
--     Enquanto viva, a linha obedece à matriz de permissão de sempre. Depois
--     de arquivada, ela pertence a UMA pessoa e a mais ninguém — nem ao novo
--     dono, nem à tripulação nova, nem à antiga.
--
-- (2) ARQUIVO FORJADO. Se qualquer tripulante pudesse escrever
--     `arquivado_para`, ele plantaria lançamentos na conta de outra pessoa —
--     ou, pior, esconderia despesas do barco carimbando-as em nome próprio,
--     que é fraude de prestação de contas com dois cliques. Por isso as
--     policies de INSERT e UPDATE passam a exigir, no `with check`,
--     `arquivado_em is null and arquivado_para is null`: pela porta da frente
--     ninguém arquiva nada. Quem carimba é `aceitar_transferencia`, que é
--     `security definer` e roda depois de conferir o e-mail do JWT.
--
-- (3) ARQUIVO EDITADO DEPOIS. Um lançamento arquivado é prova — de imposto, de
--     custo na negociação. Ele não pode ser alterado nem apagado por ninguém,
--     inclusive pelo próprio dono anterior: a policy de UPDATE e a de DELETE
--     exigem `arquivado_em is null` no `using`, então a linha vira somente
--     leitura no segundo em que é arquivada. Isso é decisão, não descuido — o
--     mesmo espírito de `admin/logs` ("o registro não é editável nem apagável
--     — nem por você").
--
-- (4) DADO PRESERVADO E INVISÍVEL. Depois desta migration o dado EXISTE e o
--     app ainda não tem tela que o mostre ao dono anterior. Isso é melhor do
--     que apagar (é recuperável, e é a base sobre a qual a tela é construída
--     depois), e é PIOR do que a promessa completa. **Enquanto a tela não
--     existir, a frase da tela de transferência não pode dizer que o dono
--     "continua com" o financeiro** — ela precisa dizer que ele sai do barco e
--     fica guardado. É por isso que o app de hoje diz o que diz: a caixa
--     vermelha de `/barco/transferir` descreve o DELETE, porque é o DELETE que
--     roda hoje. Aplicar esta migration OBRIGA a reescrever aquela caixa no
--     mesmo dia — as duas coisas viajam juntas ou a tela volta a mentir, só
--     que na direção contrária.
--
-- (5) CASCADE POR CIMA DA RLS. `on delete cascade` não passa por policy. Se um
--     dia alguém apagar a linha de `embarcacoes` (hoje impossível pelo app:
--     `embarcacoes` não tem policy de DELETE, só service role/admin alcança),
--     as linhas arquivadas vão junto — elas continuam presas ao barco pela FK.
--     Registrado como limite conhecido e NÃO resolvido aqui: resolver pede
--     decidir se apagar um barco pode apagar o histórico fiscal de um
--     ex-dono, que é a mesma classe de pergunta que esta migration levanta.
--
-- ============================================================================
-- IMPACTO MEDIDO NO BANCO VIVO `khgjtxvmduizyooqaoox` — 19/08/2026
-- ============================================================================
--   transferencias .......................... 0 linhas
--     · dessas, com status 'aceita' ......... 0
--   lancamentos_financeiros ................. 2 linhas
--   recorrencias_financeiras ................ 0 linhas
--   carteiras ............................... 0 linhas
--     · carteira_movimentos (arrasto) ....... 0 linhas
--   contatos ................................ 2 linhas
--   eventos ................................. 9 linhas
--     · com custo_centavos preenchido ....... 2
--     · com passageiros preenchidos ......... 0
--     · com tripulacao preenchida ........... 0
--   embarcacoes ............................. 9 linhas
--   vinculos ................................ 3 linhas
--
-- LEITURA DESSES NÚMEROS: **nenhuma transferência foi criada, quanto mais
-- aceita.** Ninguém foi ferido ainda, e é exatamente por isso que dá tempo de
-- consertar. O custo do defeito é inteiramente futuro — e vira irreversível na
-- primeira vez que acontecer, porque `DELETE` não tem desfazer e este projeto
-- não tem backup point-in-time contratado (não verificado nesta sessão).
--
-- As 4 linhas que hoje seriam destruídas (2 lançamentos + 2 contatos) são de
-- teste. O ganho desta migration não está no que ela salva hoje; está em ela
-- estar de pé ANTES do primeiro cliente que vender um barco.
--
-- ============================================================================
-- POR QUE ISTO NÃO FOI APLICADO
-- ============================================================================
-- Porque muda o que o produto PROMETE, e isso é decisão do dono:
--   · hoje o Commander destrói o financeiro na transferência. Depois disto ele
--     GUARDA — e guardar dado financeiro de quem já não é cliente tem
--     consequência de LGPD (base legal, prazo de retenção, direito de
--     eliminação) que a política de privacidade atual não descreve;
--   · a promessa da tela muda junto (perigo 4), e com ela a expectativa de
--     quem compra o barco, que passa a saber que recebe o casco sem o caixa;
--   · falta a tela que mostra o arquivo ao dono anterior — sem ela a
--     preservação é real mas muda. Fazer a tela é a onda seguinte.
--
-- O que JÁ ENTROU no app hoje, sem depender desta decisão, é a honestidade: a
-- caixa de aviso de `/barco/transferir` e a de `/convite/[codigo]` passaram a
-- dizer, com todas as letras, o que é apagado. Parar de esconder não é decisão
-- de produto.
--
-- Idempotente: `add column if not exists`, `create table if not exists`,
-- `create index if not exists`, `drop policy if exists` + `create policy`,
-- `create or replace function`.
--
-- REVERSÃO: no fim do arquivo.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. O CARIMBO — três colunas, iguais nas quatro tabelas
-- ---------------------------------------------------------------------------
-- `arquivado_para` aponta para `profiles`, e não para `auth.users`, porque é
-- o que as quatro tabelas já fazem em `criado_por`. `on delete set null`: se
-- a conta do dono anterior for apagada, a linha continua existindo como
-- registro do barco-que-foi, sem apontar para ninguém — e some do alcance de
-- todo mundo, já que o ramo de leitura exige `arquivado_para = auth.uid()`.

alter table public.lancamentos_financeiros
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_para uuid references public.profiles(id) on delete set null,
  add column if not exists arquivado_por_transferencia uuid references public.transferencias(id) on delete set null;

alter table public.recorrencias_financeiras
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_para uuid references public.profiles(id) on delete set null,
  add column if not exists arquivado_por_transferencia uuid references public.transferencias(id) on delete set null;

alter table public.carteiras
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_para uuid references public.profiles(id) on delete set null,
  add column if not exists arquivado_por_transferencia uuid references public.transferencias(id) on delete set null;

alter table public.contatos
  add column if not exists arquivado_em timestamptz,
  add column if not exists arquivado_para uuid references public.profiles(id) on delete set null,
  add column if not exists arquivado_por_transferencia uuid references public.transferencias(id) on delete set null;

-- Índices PARCIAIS. O caminho quente continua sendo "as linhas vivas deste
-- barco", e é ele que ganha o índice — um índice parcial sobre
-- `arquivado_em is null` é menor que o total e não cresce com o arquivo.
-- O segundo índice serve à tela que ainda não existe (perigo 4): "meu
-- arquivo, mais novo primeiro".
create index if not exists idx_lancamentos_vivos
  on public.lancamentos_financeiros (embarcacao_id, data desc) where arquivado_em is null;
create index if not exists idx_lancamentos_arquivo
  on public.lancamentos_financeiros (arquivado_para, arquivado_em desc) where arquivado_em is not null;

create index if not exists idx_recorrencias_vivas
  on public.recorrencias_financeiras (embarcacao_id) where arquivado_em is null;
create index if not exists idx_recorrencias_arquivo
  on public.recorrencias_financeiras (arquivado_para, arquivado_em desc) where arquivado_em is not null;

create index if not exists idx_carteiras_vivas
  on public.carteiras (embarcacao_id) where arquivado_em is null;
create index if not exists idx_carteiras_arquivo
  on public.carteiras (arquivado_para, arquivado_em desc) where arquivado_em is not null;

create index if not exists idx_contatos_vivos
  on public.contatos (embarcacao_id) where arquivado_em is null;
create index if not exists idx_contatos_arquivo
  on public.contatos (arquivado_para, arquivado_em desc) where arquivado_em is not null;

-- ---------------------------------------------------------------------------
-- 2. O ARQUIVO DOS TRÊS CAMPOS PRIVADOS DO DIÁRIO
-- ---------------------------------------------------------------------------
-- Ver "O CASO DE `eventos` É DIFERENTE" no cabeçalho: a saída fica com o
-- barco, os três campos do §17 saem dela.
create table if not exists public.eventos_privados_arquivados (
  id uuid primary key default gen_random_uuid(),
  transferencia_id uuid not null references public.transferencias(id) on delete cascade,
  arquivado_para uuid references public.profiles(id) on delete set null,
  -- `on delete set null` e não `cascade`: se o novo dono apagar a saída do
  -- Diário dele, o custo que o ex-dono pagou continua existindo. Uma nota
  -- fiscal não deixa de ter existido porque o comprador jogou fora o registro
  -- da viagem.
  evento_id uuid references public.eventos(id) on delete set null,
  -- A FOTOGRAFIA. Sem ela, uma linha com `evento_id` nulo é um valor solto sem
  -- data nem destino — dado preservado que não serve pra nada, que é o mesmo
  -- que dado perdido com passos extras.
  embarcacao_nome text not null,
  evento_data date not null,
  evento_tipo text not null,
  evento_destino text,
  custo_centavos bigint,
  passageiros text[] not null default '{}',
  tripulacao uuid[] not null default '{}',
  arquivado_em timestamptz not null default now()
);

-- Trava contra o arquivamento duplicado do mesmo evento na mesma
-- transferência (retry do Next, clique duplo, reprocessamento). O `insert` da
-- RPC usa `on conflict do nothing` contra este índice.
create unique index if not exists eventos_privados_arquivados_dedupe_idx
  on public.eventos_privados_arquivados (evento_id, transferencia_id);

create index if not exists idx_eventos_privados_arquivados_dono
  on public.eventos_privados_arquivados (arquivado_para, evento_data desc);

alter table public.eventos_privados_arquivados enable row level security;

drop policy if exists "eventos arquivados: so o dono anterior" on public.eventos_privados_arquivados;
create policy "eventos arquivados: so o dono anterior" on public.eventos_privados_arquivados
  for select to authenticated
  using (arquivado_para = (select auth.uid()));

-- SEM policy de INSERT/UPDATE/DELETE, e é decisão — mesmo desenho da 089 e de
-- `alertas_enviados`. Com RLS ligada, ausência de policy é negação. Só a
-- função `security definer` escreve aqui.
revoke all on public.eventos_privados_arquivados from anon;

-- ---------------------------------------------------------------------------
-- 3. AS POLICIES — o ramo que impede o vazamento (perigo 1)
-- ---------------------------------------------------------------------------
-- Cada policy abaixo REPETE literalmente a regra que já estava no banco (lida
-- de `pg_policies` em 19/08/2026) e acrescenta o carimbo. Nada de permissão
-- muda para linha viva; o que muda é que linha arquivada sai do alcance da
-- matriz e entra no alcance de uma pessoa só.
--
-- `(select auth.uid())` e não `auth.uid()`: regra da casa desde a migration
-- 082 — dentro de policy, a forma com subselect é avaliada uma vez por
-- consulta em vez de uma vez por linha.

-- ---- lancamentos_financeiros ----------------------------------------------
drop policy if exists "lancamentos: ver pela matriz" on public.lancamentos_financeiros;
create policy "lancamentos: ver pela matriz" on public.lancamentos_financeiros
  for select
  using (
    (arquivado_em is null and permissao(embarcacao_id, 'gastos', 'ver'))
    or (arquivado_em is not null and arquivado_para = (select auth.uid()))
  );

drop policy if exists "lancamentos: criar pela matriz" on public.lancamentos_financeiros;
create policy "lancamentos: criar pela matriz" on public.lancamentos_financeiros
  for insert
  with check (
    arquivado_em is null and arquivado_para is null
    and permissao(embarcacao_id, 'gastos', 'editar')
  );

drop policy if exists "lancamentos: atualizar pela matriz" on public.lancamentos_financeiros;
create policy "lancamentos: atualizar pela matriz" on public.lancamentos_financeiros
  for update
  using (arquivado_em is null and permissao(embarcacao_id, 'gastos', 'editar'))
  with check (
    arquivado_em is null and arquivado_para is null
    and permissao(embarcacao_id, 'gastos', 'editar')
  );

drop policy if exists "lancamentos: excluir pela matriz" on public.lancamentos_financeiros;
create policy "lancamentos: excluir pela matriz" on public.lancamentos_financeiros
  for delete
  using (arquivado_em is null and permissao(embarcacao_id, 'gastos', 'editar'));

-- ---- recorrencias_financeiras ---------------------------------------------
drop policy if exists "recorrencias: ver pela matriz" on public.recorrencias_financeiras;
create policy "recorrencias: ver pela matriz" on public.recorrencias_financeiras
  for select
  using (
    (arquivado_em is null and permissao(embarcacao_id, 'gastos', 'ver'))
    or (arquivado_em is not null and arquivado_para = (select auth.uid()))
  );

drop policy if exists "recorrencias: criar pela matriz" on public.recorrencias_financeiras;
create policy "recorrencias: criar pela matriz" on public.recorrencias_financeiras
  for insert
  with check (
    arquivado_em is null and arquivado_para is null
    and permissao(embarcacao_id, 'gastos', 'editar')
  );

drop policy if exists "recorrencias: atualizar pela matriz" on public.recorrencias_financeiras;
create policy "recorrencias: atualizar pela matriz" on public.recorrencias_financeiras
  for update
  using (arquivado_em is null and permissao(embarcacao_id, 'gastos', 'editar'))
  with check (
    arquivado_em is null and arquivado_para is null
    and permissao(embarcacao_id, 'gastos', 'editar')
  );

drop policy if exists "recorrencias: excluir pela matriz" on public.recorrencias_financeiras;
create policy "recorrencias: excluir pela matriz" on public.recorrencias_financeiras
  for delete
  using (arquivado_em is null and permissao(embarcacao_id, 'gastos', 'editar'));

-- ---- contatos --------------------------------------------------------------
drop policy if exists "contatos: ver pela matriz" on public.contatos;
create policy "contatos: ver pela matriz" on public.contatos
  for select
  using (
    (arquivado_em is null and permissao(embarcacao_id, 'contatos', 'ver'))
    or (arquivado_em is not null and arquivado_para = (select auth.uid()))
  );

drop policy if exists "contatos: criar pela matriz" on public.contatos;
create policy "contatos: criar pela matriz" on public.contatos
  for insert
  with check (
    arquivado_em is null and arquivado_para is null
    and permissao(embarcacao_id, 'contatos', 'editar')
  );

drop policy if exists "contatos: atualizar pela matriz" on public.contatos;
create policy "contatos: atualizar pela matriz" on public.contatos
  for update
  using (arquivado_em is null and permissao(embarcacao_id, 'contatos', 'editar'))
  with check (
    arquivado_em is null and arquivado_para is null
    and permissao(embarcacao_id, 'contatos', 'editar')
  );

drop policy if exists "contatos: excluir pela matriz" on public.contatos;
create policy "contatos: excluir pela matriz" on public.contatos
  for delete
  using (arquivado_em is null and permissao(embarcacao_id, 'contatos', 'editar'));

-- ---- carteiras -------------------------------------------------------------
-- `carteiras` não tem policy de DELETE hoje, e continua sem — não é
-- esquecimento desta migration, é o estado que ela encontrou.
drop policy if exists "carteiras: prop ve as do barco, tripulante ve a dele" on public.carteiras;
create policy "carteiras: prop ve as do barco, tripulante ve a dele" on public.carteiras
  for select
  using (
    (
      arquivado_em is null
      and (
        eh_prop(embarcacao_id)
        or (tripulante_id = (select auth.uid()) and permissao(embarcacao_id, 'carteira', 'ver'))
      )
    )
    or (arquivado_em is not null and arquivado_para = (select auth.uid()))
  );

drop policy if exists "carteiras: so o prop cria" on public.carteiras;
create policy "carteiras: so o prop cria" on public.carteiras
  for insert
  with check (
    arquivado_em is null and arquivado_para is null
    and eh_prop(embarcacao_id)
    and exists (
      select 1 from public.vinculos v
       where v.embarcacao_id = carteiras.embarcacao_id
         and v.usuario_id = carteiras.tripulante_id
    )
  );

drop policy if exists "carteiras: so o prop altera" on public.carteiras;
create policy "carteiras: so o prop altera" on public.carteiras
  for update
  using (arquivado_em is null and eh_prop(embarcacao_id))
  with check (arquivado_em is null and arquivado_para is null and eh_prop(embarcacao_id));

-- ---- carteira_movimentos ---------------------------------------------------
-- ARRASTO NECESSÁRIO, e vale explicar por que ele aparece aqui.
-- `carteira_movimentos` não tem `embarcacao_id`: as policies dele decidem por
-- um `exists` sobre `carteiras`. Expressão de policy é avaliada COM a RLS da
-- tabela referenciada, então, no instante em que a carteira é arquivada, os
-- movimentos dela somem sozinhos para a tripulação do barco — o perigo (1)
-- se resolve de graça e é bom que assim seja.
-- O efeito colateral é o contrário: some para o dono anterior também, porque a
-- regra pede `eh_prop(c.embarcacao_id)` e ele deixou de ser PROP. Sem o ramo
-- abaixo, a Carteira arquivada existiria com saldo e sem um único movimento
-- que o explique — pior do que não ter guardado.
-- As policies de escrita NÃO precisam de ramo: as três já exigem `eh_prop` ou
-- `c.ativa` sobre uma carteira que, arquivada, é invisível para quem escreve.
drop policy if exists "movimentos: ver pela carteira" on public.carteira_movimentos;
create policy "movimentos: ver pela carteira" on public.carteira_movimentos
  for select
  using (
    exists (
      select 1 from public.carteiras c
       where c.id = carteira_movimentos.carteira_id
         and (
           (
             c.arquivado_em is null
             and (
               eh_prop(c.embarcacao_id)
               or (c.tripulante_id = (select auth.uid()) and permissao(c.embarcacao_id, 'carteira', 'ver'))
             )
           )
           or (c.arquivado_em is not null and c.arquivado_para = (select auth.uid()))
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. A RPC — arquivar onde antes apagava
-- ---------------------------------------------------------------------------
-- O que NÃO mudou, e é de propósito: as três checagens de entrada (autenticado,
-- transferência válida e não expirada, e-mail do JWT batendo com o
-- destinatário), a remoção dos vínculos de CMDT e do PROP anterior, a criação
-- do vínculo novo e o carimbo em `transferencias`. Este arquivo troca cinco
-- comandos destrutivos por cinco carimbos e um insert; o resto é a 038.
create or replace function public.aceitar_transferencia(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t record;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_agora timestamptz := now();
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado';
  end if;
  select * into t from public.transferencias
    where codigo = p_codigo and status = 'pendente' and expira_em > now();
  if not found then
    raise exception 'transferencia invalida ou expirada';
  end if;
  if v_email = '' or lower(t.destinatario_email) <> v_email then
    raise exception 'este convite foi enviado para outro e-mail';
  end if;

  -- A fotografia do nome do barco precisa ser tirada ANTES de qualquer
  -- escrita: depois daqui a embarcação é de outra pessoa e pode ser renomeada
  -- a qualquer momento, e o arquivo do ex-dono ficaria dizendo o nome novo.
  select nome into v_nome from public.embarcacoes where id = t.embarcacao_id;

  delete from public.vinculos where embarcacao_id = t.embarcacao_id and papel = 'CMDT';
  delete from public.vinculos where embarcacao_id = t.embarcacao_id and usuario_id = t.de_usuario_id and papel = 'PROP';

  -- ---- o que antes era DELETE -------------------------------------------
  -- `and arquivado_em is null` em todos: um barco pode ser transferido mais de
  -- uma vez ao longo da vida, e o arquivo do dono de dois donos atrás não pode
  -- ser reetiquetado em nome do dono anterior. Cada arquivo pertence a quem o
  -- criou, para sempre.
  update public.lancamentos_financeiros
     set arquivado_em = v_agora,
         arquivado_para = t.de_usuario_id,
         arquivado_por_transferencia = t.id
   where embarcacao_id = t.embarcacao_id and arquivado_em is null;

  update public.recorrencias_financeiras
     set arquivado_em = v_agora,
         arquivado_para = t.de_usuario_id,
         arquivado_por_transferencia = t.id
   where embarcacao_id = t.embarcacao_id and arquivado_em is null;

  update public.carteiras
     set arquivado_em = v_agora,
         arquivado_para = t.de_usuario_id,
         arquivado_por_transferencia = t.id
   where embarcacao_id = t.embarcacao_id and arquivado_em is null;

  update public.contatos
     set arquivado_em = v_agora,
         arquivado_para = t.de_usuario_id,
         arquivado_por_transferencia = t.id
   where embarcacao_id = t.embarcacao_id and arquivado_em is null;

  -- ---- os três campos privados do Diário ---------------------------------
  -- Só as saídas que TÊM algo a guardar entram no arquivo: sem o filtro, uma
  -- transferência de barco com 400 saídas geraria 400 linhas vazias e o
  -- arquivo do ex-dono nasceria como um extrato de nadas.
  insert into public.eventos_privados_arquivados (
    transferencia_id, arquivado_para, evento_id, embarcacao_nome,
    evento_data, evento_tipo, evento_destino,
    custo_centavos, passageiros, tripulacao, arquivado_em
  )
  select t.id, t.de_usuario_id, e.id, coalesce(v_nome, '(embarcação sem nome)'),
         e.data, e.tipo, e.destino,
         e.custo_centavos, e.passageiros, e.tripulacao, v_agora
    from public.eventos e
   where e.embarcacao_id = t.embarcacao_id
     and (
       e.custo_centavos is not null
       or array_length(e.passageiros, 1) is not null
       or array_length(e.tripulacao, 1) is not null
     )
  on conflict (evento_id, transferencia_id) do nothing;

  -- A saída continua com o barco; os três campos do §17 saem dela. Este
  -- `update` é o ÚNICO comando destrutivo que sobrou nesta função, e ele só é
  -- aceitável porque a linha acima já guardou o que ele apaga.
  update public.eventos
     set custo_centavos = null, passageiros = '{}', tripulacao = '{}'
   where embarcacao_id = t.embarcacao_id;

  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), t.embarcacao_id, 'PROP');

  update public.transferencias
    set status = 'aceita', para_usuario_id = auth.uid(), aceita_em = v_agora
    where id = t.id;

  return t.embarcacao_id;
end $function$;

-- ---------------------------------------------------------------------------
-- 5. TRAVA — a migration não passa se qualquer garantia faltar
-- ---------------------------------------------------------------------------
do $$
declare
  v_faltando text;
  v_rls boolean;
  v_escrita int;
  v_def text;
begin
  -- (i) as três colunas existem nas quatro tabelas. Sem elas as policies
  --     abaixo nem compilariam, mas o erro sairia ilegível.
  select string_agg(format('%s.%s', t.tabela, c.coluna), ', ')
    into v_faltando
    from (values
            ('lancamentos_financeiros'), ('recorrencias_financeiras'),
            ('carteiras'), ('contatos')
         ) as t(tabela)
   cross join (values
            ('arquivado_em'), ('arquivado_para'), ('arquivado_por_transferencia')
         ) as c(coluna)
   where not exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = t.tabela
        and ic.column_name = c.coluna
   );
  if v_faltando is not null then
    raise exception 'ABORTADO: faltaram colunas de arquivamento: %', v_faltando;
  end if;

  -- (ii) RLS ligada na tabela nova. Sem RLS, "nenhuma policy de INSERT" deixa
  --      de negar e passa a LIBERAR — o desenho inteiro se inverte.
  select relrowsecurity into v_rls
    from pg_class where oid = 'public.eventos_privados_arquivados'::regclass;
  if not coalesce(v_rls, false) then
    raise exception
      'ABORTADO: RLS nao ficou ligada em eventos_privados_arquivados. Sem ela, o custo privado de todo ex-dono fica aberto a qualquer autenticado.';
  end if;

  select count(*) into v_escrita
    from pg_policies
   where schemaname = 'public' and tablename = 'eventos_privados_arquivados'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if v_escrita <> 0 then
    raise exception
      'ABORTADO: eventos_privados_arquivados ficou com % policy(ies) de escrita (esperado 0). Escrita aqui permite plantar ou adulterar o arquivo fiscal de outra pessoa.', v_escrita;
  end if;

  -- (iii) A RPC não pode ter sobrado com nenhum `delete` no financeiro. Esta
  --       é a trava que dá nome ao arquivo: se a substituição não pegou, a
  --       migration precisa falhar em vez de anunciar uma preservação que não
  --       aconteceu.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'aceitar_transferencia';
  if v_def is null then
    raise exception 'ABORTADO: aceitar_transferencia nao existe depois do replace.';
  end if;
  if v_def ~* 'delete\s+from\s+public\.(lancamentos_financeiros|recorrencias_financeiras|carteiras|contatos)' then
    raise exception
      'ABORTADO: aceitar_transferencia ainda apaga financeiro. Rode: select pg_get_functiondef(oid) from pg_proc where proname=''aceitar_transferencia'';';
  end if;

  -- (iv) E precisa ter ganhado o arquivamento. Ausência de delete sem
  --      presença de arquivamento seria a função tendo virado uma que
  --      simplesmente não faz nada com o financeiro — e aí o dado ficaria
  --      visível pro novo dono, que é o perigo (1).
  if v_def !~* 'eventos_privados_arquivados' or v_def !~* 'arquivado_para' then
    raise exception
      'ABORTADO: aceitar_transferencia nao arquiva. Sem o carimbo, o financeiro do ex-dono fica VISIVEL pro novo dono.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A RPC não apaga mais e passou a arquivar — inspeção visual do corpo:
-- select pg_get_functiondef(p.oid) from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname='aceitar_transferencia';
--
-- 2) Toda policy de SELECT das quatro tabelas tem os dois ramos — o `qual` de
--    cada uma tem de conter `arquivado_em`:
-- select tablename, policyname, cmd, qual from pg_policies
--  where schemaname='public'
--    and tablename in ('lancamentos_financeiros','recorrencias_financeiras','carteiras','contatos','carteira_movimentos')
--  order by tablename, cmd;
--
-- 3) Nenhuma policy de escrita aceita linha já arquivada — o `with_check` de
--    INSERT/UPDATE tem de conter `arquivado_para IS NULL`:
-- select tablename, policyname, cmd, with_check from pg_policies
--  where schemaname='public'
--    and tablename in ('lancamentos_financeiros','recorrencias_financeiras','carteiras','contatos')
--    and cmd in ('INSERT','UPDATE');
--
-- 4) TESTE DE FUMAÇA PONTA A PONTA, com duas contas — é o único jeito de saber
--    que o perigo (1) está fechado, e ele precisa ser feito antes de qualquer
--    cliente real transferir:
--    a) conta A cria barco, lança 2 despesas, 1 recorrente, 1 contato e uma
--       saída no Diário com custo;
--    b) conta A gera o link em `/barco/transferir` e conta B aceita;
--    c) conta B abre `/financeiro`: tem de ver ZERO lançamento e ZERO
--       recorrente; `/barco/historico` tem de mostrar a saída SEM custo;
--    d) conta B roda, com o token dela, `select count(*) from
--       lancamentos_financeiros` — tem de voltar 0. Se voltar 2, o ramo da
--       policy não pegou e ISTO É UM VAZAMENTO: reverta na hora;
--    e) conta A roda, com o token dela, o mesmo select — tem de voltar 2. Se
--       voltar 0, o dado foi preservado e ficou inalcançável, que é o perigo
--       (4) na sua forma pior;
--    f) conta B tenta apagar um lançamento arquivado por id direto: tem de
--       recusar (0 linhas afetadas).
--
-- 5) Nada ficou órfão de carimbo — tem de voltar vazio:
-- select 'lancamentos' as t, count(*) from public.lancamentos_financeiros
--  where arquivado_em is not null and arquivado_para is null
-- union all select 'contatos', count(*) from public.contatos
--  where arquivado_em is not null and arquivado_para is null;
--
-- ---------------------------------------------------------------------------
-- REVERSÃO
-- ---------------------------------------------------------------------------
-- ATENÇÃO: reverter devolve o comportamento que DESTRÓI. Se já houver linha
-- arquivada quando a reversão rodar, ela vai ficar visível para o dono ATUAL
-- do barco — que é o vazamento do perigo (1) acontecendo de trás pra frente.
-- Confira antes:
--   select count(*) from public.lancamentos_financeiros where arquivado_em is not null;
-- Se for maior que zero, exporte para o ex-dono ANTES de reverter.
--
-- begin;
--   -- as policies voltam ao texto lido em 19/08/2026 (sem o ramo do carimbo)
--   drop policy if exists "lancamentos: ver pela matriz" on public.lancamentos_financeiros;
--   create policy "lancamentos: ver pela matriz" on public.lancamentos_financeiros
--     for select using (permissao(embarcacao_id, 'gastos', 'ver'));
--   -- … idem para as demais (o texto original de cada uma está reproduzido
--   --   dentro de cada `create policy` da seção 3, sem o ramo `arquivado_em`)
--
--   drop table if exists public.eventos_privados_arquivados;
--   alter table public.lancamentos_financeiros
--     drop column if exists arquivado_em,
--     drop column if exists arquivado_para,
--     drop column if exists arquivado_por_transferencia;
--   -- … idem para recorrencias_financeiras, carteiras e contatos
--
--   -- e a RPC volta a apagar (corpo da 038, lido do banco vivo em 19/08/2026)
-- commit;

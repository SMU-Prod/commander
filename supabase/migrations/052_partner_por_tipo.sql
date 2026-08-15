-- =====================================================================
-- 052 · COMMANDER PARTNER POR TIPO (PRD FINAL §13 inteira, 13.1 a 13.6)
--       + o que o EXPLORAR PARCEIROS (§10) precisa pra filtrar por tipo,
--         categoria/atividade e região usando a MESMA taxonomia do
--         Marketplace (§21.2).
--
-- ---------------------------------------------------------------------
-- POR QUE ESTENDER `parceiros` EM VEZ DE CRIAR UM CADASTRO NOVO
-- ---------------------------------------------------------------------
-- §13 abre com a regra que decide a modelagem inteira: "Um Partner possui
-- UM tipo principal e pode ter atividades complementares", e o §10 repete
-- "sem duplicar perfil". A tabela `parceiros` (migration 020) já é
-- exatamente isso — uma linha por conta, com `categoria` fazendo o papel
-- do tipo principal, `plano`, fotos, ponto no mapa, contador de
-- visualizações e RLS pronta. Criar `partners` ao lado daria duas
-- verdades pro mesmo cadastro e duas RLS pra manter em sincronia; a
-- coisa honesta é dizer que `parceiros.categoria` É o "tipo de Partner"
-- do §13 e completar o que falta.
--
-- Falta, e é o que este arquivo entrega:
--   1. o tipo `prestador` (§13.1) — o CHECK de 041 não o tinha;
--   2. região padronizada (§10: "regiões ... compartilhadas com o
--      Marketplace") — hoje o parceiro só tem lat/lng, e ponto no mapa
--      não é filtro de lista;
--   3. atividades complementares (§13.1 "Também vendo produtos" / §13.2
--      "Também presto serviços") e as categorias/marcas/combustíveis que
--      cada tipo declara — tudo por FK em `taxonomia`, nunca texto livre;
--   4. vagas secas/molhadas da Marina (§13.3);
--   5. galeria de Cardápio separada das fotos do estabelecimento (§13.5);
--   6. acomodações e check-in/out da Pousada/Hotel (§13.6).
--
-- ---------------------------------------------------------------------
-- O QUE NÃO ENTRA AQUI, DE PROPÓSITO
-- ---------------------------------------------------------------------
-- · Catálogo/estoque/carrinho da Loja — §13.2: "Não há catálogo/estoque/
--   carrinho no Upgrade 2". Não existe tabela de produto neste arquivo.
-- · Reserva/booking/pagamento de Marina, Restaurante e Pousada — §13.3
--   ("não é estoque/reserva transacional"), §13.5 ("Sem reserva, pagamento
--   ou pedido interno") e §13.6 ("Sem calendário de disponibilidade,
--   Booking interno ou pagamento"). `parceiro_vagas.disponiveis` é um
--   NÚMERO DECLARADO pela Marina, não um saldo que o app debita: nada
--   neste arquivo escreve nessa coluna a não ser a própria Marina.
-- · Solicitações de Caminhão do Posto (§13.4) — já existem: são as
--   `demandas` do tipo `caminhao` (migration 046) e a resposta é uma
--   `proposta` com preco_litro/quantidade/taxa_deslocamento/valor_estimado,
--   colunas que o §11.5 já pediu e o 046 já criou. O que faltava era o
--   Posto declarar QUAIS combustíveis fornece pra o matching funcionar —
--   isso entra em `parceiro_atividades` (tipo `combustivel`).
-- =====================================================================

-- ===========================================================================
-- 1) O TIPO PRINCIPAL GANHA `prestador` (§13.1)
-- ===========================================================================
-- CUIDADO — existem DOIS "prestador" no Commander e eles não são a mesma
-- coisa:
--   · `perfis_comandante` com tipo='prestador' (migration 037, tela
--     /prestadores) é PESSOA: o profissional autônomo que aparece na rede
--     profissional junto com os Comandantes;
--   · `parceiros` com categoria='prestador' (aqui) é CONTA PARTNER: o
--     §13.1 descreve um plano de R$ 24,90 com menu, dashboard, propostas
--     e histórico comercial próprios.
-- Os dois convivem de propósito e nenhum é migrado pro outro: unificar
-- agora quebraria a rede profissional (§12) sem o PRD ter pedido. Quem
-- for os dois tem as duas linhas, cada uma no seu lugar.
alter table public.parceiros drop constraint parceiros_categoria_check;
alter table public.parceiros add constraint parceiros_categoria_check
  check (categoria in (
    'prestador',      -- §13.1 Prestador de Serviço — R$ 24,90
    'loja_nautica',   -- §13.2 Loja Náutica — R$ 24,90
    'marina',         -- §13.3 grátis
    'posto',          -- §13.4 grátis
    'restaurante',    -- §13.5 grátis inicialmente
    'pousada',        -- §13.6 Pousada/Hotel — grátis inicialmente
    'outros'          -- §10, "outros parceiros pertinentes"
  ));

comment on column public.parceiros.categoria is
  'TIPO PRINCIPAL do Commander Partner (PRD §13). "Commander Partner" é o nome do PLANO/ecossistema B2B — o que a tela exibe é o tipo real ("Marina", "Loja Náutica", "Prestador de Serviço"). Rótulos em web/lib/domain/partner.ts.';

-- O default de ícone por categoria (migration 024) não conhecia `prestador`
-- e caía no `else 'ancora'` — âncora pra um eletricista. Espelha
-- ICONE_PADRAO_POR_CATEGORIA de web/lib/mapa/pino-parceiro.ts, como o
-- comentário da 024 exige dos dois lados.
create or replace function public.parceiro_icone_cor_padrao()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.icone is null then
    new.icone := case new.categoria
      when 'marina' then 'ancora'
      when 'posto' then 'oleo'
      when 'pousada' then 'inicio'
      when 'restaurante' then 'estrela'
      when 'prestador' then 'ferramenta'
      when 'loja_nautica' then 'ferramenta'
      else 'embarcacao'
    end;
  end if;
  if new.cor is null then
    new.cor := '#d4af37';
  end if;
  return new;
end $$;

-- ===========================================================================
-- 2) REGIÃO PADRONIZADA (§10) E ATIVIDADES COMPLEMENTARES (§13.1/§13.2)
-- ===========================================================================
-- §10: "Categorias e regiões são padronizadas e compartilhadas com o
-- Marketplace." Um `text` de cidade digitado à mão devolveria "Angra",
-- "angra dos reis" e "Angra d. Reis" como três regiões diferentes — que é
-- exatamente o que o §21.2 quer evitar ("evitar duplicatas livres"). Por
-- isso é FK pra `taxonomia`, a MESMA tabela que as demandas usam: filtrar
-- o Explorar por "Angra dos Reis" e publicar uma demanda em "Angra dos
-- Reis" passa a ser o mesmo uuid.
alter table public.parceiros
  add column regiao_id uuid references public.taxonomia(id) on delete restrict;

-- Backfill: quem já existe vai pra "Outra região" — a saída honesta que o
-- 046 criou justamente pra isto. O parceiro corrige no próprio painel.
update public.parceiros set regiao_id = (
  select id from public.taxonomia where tipo = 'regiao' and slug = 'outra-regiao'
) where regiao_id is null;

alter table public.parceiros alter column regiao_id set not null;

-- Índice do Explorar: o filtro do §10 é tipo + região, e só linha visível
-- entra na vitrine.
create index parceiros_explorar_idx on public.parceiros (categoria, regiao_id) where visivel;

-- §13.1: "Pode ativar 'Também vendo produtos'"; §13.2: "Pode ativar
-- 'Também presto serviços'". São DUAS flags e não um "tipo secundário"
-- porque o tipo principal continua sendo um só (§13): a flag não troca o
-- menu nem o dashboard, só amplia o que a pessoa recebe no Marketplace.
alter table public.parceiros
  add column tambem_vende_produtos boolean not null default false,
  add column tambem_presta_servicos boolean not null default false;

-- ===========================================================================
-- 3) CAMPOS DE PERFIL QUE CADA TIPO PEDE (§13.3, §13.5, §13.6)
-- ===========================================================================
-- Colunas na própria linha (e não numa tabela de "atributos") porque são
-- poucas, fixas e vêm nominalmente do PRD. Todas nullable: cada tipo
-- preenche as suas e ignora as outras — quem decide o que aparece no
-- formulário é web/lib/domain/partner.ts, não um CHECK gigante que
-- impediria o parceiro de corrigir o tipo depois de cadastrar errado.
alter table public.parceiros
  -- §13.3 Marina ("acesso náutico, estrutura, atracação") e, na mesma
  -- coluna de acesso, §13.5 ("informações náuticas pertinentes") e §13.6
  -- ("informações de acesso pelo mar"): é a MESMA pergunta — "como se
  -- chega aqui pela água" — então é uma coluna só, não três sinônimos.
  add column acesso_nautico text,
  add column estrutura text,
  add column atracacao text,
  -- §13.3: "combustível quando aplicável" na Marina. O Posto tem
  -- `preco_diesel_centavos` desde a 020; aqui é só o fato de existir bomba.
  add column tem_combustivel boolean not null default false,
  -- §13.6 Pousada/Hotel — "check-in/out". `time` e não `text` porque é
  -- horário de verdade e a tela formata em pt-BR.
  add column check_in time,
  add column check_out time,
  -- §13.5 Restaurante — "Fotos separadas em estabelecimento e Cardápio;
  -- cardápio é galeria de imagens, não cadastro de pratos". As fotos do
  -- estabelecimento continuam em `fotos` (020); o cardápio ganha o seu
  -- próprio array pra as duas galerias nunca se misturarem na tela. Teto
  -- maior porque um cardápio real tem várias páginas.
  add column fotos_cardapio text[] not null default '{}'
    check (coalesce(array_length(fotos_cardapio, 1), 0) <= 12);

comment on column public.parceiros.fotos_cardapio is
  'PRD §13.5 — galeria de IMAGENS do cardápio. Não existe cadastro de prato/preço, e não existe reserva/pedido/pagamento no Upgrade 2.';

-- Privilégio de coluna (mesma disciplina da migration 020: `revoke update
-- on table` + grant nominal). Sem esta linha as colunas novas ficariam
-- fora do grant e nem o próprio parceiro conseguiria editá-las.
grant update (
  regiao_id, tambem_vende_produtos, tambem_presta_servicos,
  acesso_nautico, estrutura, atracacao, tem_combustivel,
  check_in, check_out, fotos_cardapio
) on table public.parceiros to authenticated;

-- ===========================================================================
-- 4) ATIVIDADES DECLARADAS (§13.1, §13.2, §13.4, §11.4)
-- ===========================================================================
-- "Loja cadastra categorias e marcas" (§13.2), "selecionar categorias de
-- produto" (§13.1), "selecionar serviços oferecidos" (§13.2) e o
-- combustível do Posto (§13.4/§11.1) são a MESMA operação: ligar o
-- parceiro a itens de `taxonomia`. Uma tabela de junção resolve as quatro
-- — quatro colunas `uuid[]` não teriam integridade referencial e quatro
-- tabelas teriam quatro RLS idênticas pra manter.
--
-- `tipo` é duplicado aqui (e amarrado por FK composta) só pra o CHECK
-- poder existir: Postgres não deixa um CHECK consultar outra tabela, e
-- sem ele nada impediria uma Loja de declarar "Angra dos Reis" como
-- categoria de produto.
alter table public.taxonomia add constraint taxonomia_id_tipo_key unique (id, tipo);

create table public.parceiro_atividades (
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  taxonomia_id uuid not null,
  tipo text not null check (tipo in ('categoria_servico', 'categoria_produto', 'marca', 'combustivel')),
  criado_em timestamptz not null default now(),
  primary key (parceiro_id, taxonomia_id),
  foreign key (taxonomia_id, tipo) references public.taxonomia (id, tipo) on delete restrict
);

create index parceiro_atividades_busca_idx on public.parceiro_atividades (tipo, taxonomia_id);

alter table public.parceiro_atividades enable row level security;

-- Quem enxerga o parceiro enxerga o que ele declara — é vitrine, e é o
-- que o §10 pede pra filtrar por "categoria/atividade". A visibilidade
-- vem da linha em `parceiros`, nunca de `using (true)`.
create policy "atividades: quem vê o parceiro vê" on public.parceiro_atividades
  for select to authenticated
  using (exists (
    select 1 from public.parceiros p
    where p.id = parceiro_id and (p.visivel or p.usuario_id = (select auth.uid()))
  ));

create policy "atividades: só o dono declara as suas" on public.parceiro_atividades
  for all to authenticated
  using (exists (
    select 1 from public.parceiros p where p.id = parceiro_id and p.usuario_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.parceiros p where p.id = parceiro_id and p.usuario_id = (select auth.uid())
  ));

-- ===========================================================================
-- 5) VAGAS DA MARINA (§13.3)
-- ===========================================================================
-- "Vagas secas/molhadas: total, disponíveis informadas manualmente, porte
-- máximo, diária/mensal e preços opcionais/sob consulta."
--
-- A frase que manda na modelagem é a seguinte: "Informação de
-- disponibilidade é DECLARADA pela Marina; não é estoque/reserva
-- transacional." Consequências concretas, não decorativas:
--   · não existe RPC de "reservar" nem trigger que decremente
--     `disponiveis` — a única escrita possível é a da própria Marina;
--   · `declarado_em` carimba QUANDO ela declarou, pra tela poder dizer a
--     idade do número em vez de fingir que é tempo real (o app já faz
--     isso com `precos_atualizados_em` no card do parceiro);
--   · `disponiveis` NÃO herda o limite de "1 atualização por dia" do
--     trigger `parceiro_regras` (migration 020). Aquele limite existe pra
--     preço não virar isca; disponibilidade declarada precisa do
--     contrário — quanto mais atualizada, melhor.
create table public.parceiro_vagas (
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  tipo text not null check (tipo in ('seca', 'molhada')),
  total int check (total >= 0),
  disponiveis int check (disponiveis >= 0),
  porte_max_pes int check (porte_max_pes > 0 and porte_max_pes <= 400),
  preco_diaria_centavos int check (preco_diaria_centavos > 0),
  preco_mensal_centavos int check (preco_mensal_centavos > 0),
  -- §13.3: "preços opcionais/sob consulta". Sob consulta é ESTADO, não
  -- preço zero — mesma decisão que o §16/Gold tomou pra "81+ pés".
  sob_consulta boolean not null default false,
  declarado_em timestamptz not null default now(),
  primary key (parceiro_id, tipo),
  constraint parceiro_vagas_disponiveis_cabem
    check (total is null or disponiveis is null or disponiveis <= total),
  constraint parceiro_vagas_preco_ou_consulta
    check (not (sob_consulta and (preco_diaria_centavos is not null or preco_mensal_centavos is not null)))
);

alter table public.parceiro_vagas enable row level security;

create policy "vagas: quem vê a marina vê" on public.parceiro_vagas
  for select to authenticated
  using (exists (
    select 1 from public.parceiros p
    where p.id = parceiro_id and (p.visivel or p.usuario_id = (select auth.uid()))
  ));

create policy "vagas: só a marina declara as suas" on public.parceiro_vagas
  for all to authenticated
  using (exists (
    select 1 from public.parceiros p where p.id = parceiro_id and p.usuario_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.parceiros p where p.id = parceiro_id and p.usuario_id = (select auth.uid())
  ));

-- `declarado_em` é do banco, não do formulário: se viesse do cliente, uma
-- marina poderia declarar disponibilidade "de hoje" sem ter tocado nela.
create or replace function public.parceiro_vaga_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.declarado_em := now();
  return new;
end $$;
create trigger parceiro_vagas_carimbo before insert or update on public.parceiro_vagas
  for each row execute function public.parceiro_vaga_carimbo();
revoke execute on function public.parceiro_vaga_carimbo() from public, anon, authenticated;

-- ===========================================================================
-- 6) ACOMODAÇÕES DA POUSADA/HOTEL (§13.6)
-- ===========================================================================
-- "Perfil, fotos, acomodações, valores opcionais, check-in/out e
-- informações de acesso pelo mar." Acomodação é lista (uma pousada tem
-- "Chalé", "Suíte vista mar", "Quarto standard"), então é tabela; o resto
-- são colunas na linha do parceiro, na seção 3 acima.
--
-- `valor_diaria_centavos` é nullable porque o PRD diz "valores
-- OPCIONAIS", e não existe nenhuma coluna de data/ocupação: §13.6 é
-- explícito — "Sem calendário de disponibilidade, Booking interno ou
-- pagamento no Upgrade 2".
create table public.parceiro_acomodacoes (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 2 and 80),
  capacidade int check (capacidade > 0 and capacidade <= 50),
  valor_diaria_centavos int check (valor_diaria_centavos > 0),
  descricao text,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create index parceiro_acomodacoes_parceiro_idx on public.parceiro_acomodacoes (parceiro_id, ordem, criado_em);

alter table public.parceiro_acomodacoes enable row level security;

create policy "acomodações: quem vê a pousada vê" on public.parceiro_acomodacoes
  for select to authenticated
  using (exists (
    select 1 from public.parceiros p
    where p.id = parceiro_id and (p.visivel or p.usuario_id = (select auth.uid()))
  ));

create policy "acomodações: só a pousada cadastra as suas" on public.parceiro_acomodacoes
  for all to authenticated
  using (exists (
    select 1 from public.parceiros p where p.id = parceiro_id and p.usuario_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.parceiros p where p.id = parceiro_id and p.usuario_id = (select auth.uid())
  ));

-- ===========================================================================
-- 7) NADA DISSO É PÚBLICO
-- ===========================================================================
-- Mesmo motivo do bloco final da migration 050: o grant padrão do Supabase
-- para `anon` é aberto, e RLS sem grant revogado ainda deixa a role anônima
-- na porta. Vitrine de parceiro é conteúdo de assinante logado (§2.3 corta
-- até pra quem está no Free) — não de visitante sem conta.
revoke all on table public.parceiro_atividades from anon;
revoke all on table public.parceiro_vagas from anon;
revoke all on table public.parceiro_acomodacoes from anon;

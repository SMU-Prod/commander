-- 046: MARKETPLACE ORIENTADO POR DEMANDA (PRD upgrade2-master-final §11 inteira,
-- §21.2 taxonomia, §22 privacidade do proprietário).
--
-- ---------------------------------------------------------------------------
-- POR QUE SUBSTITUIR `oportunidades` EM VEZ DE ESTENDER
-- ---------------------------------------------------------------------------
-- A migration 037 criou `oportunidades` como MURAL de texto livre: `titulo`
-- digitado pela pessoa, `categoria`/`local` como texto solto, 3 tipos, e uma
-- resposta que era só mensagem + telefone. O PRD FINAL pede outra coisa em
-- quase todos os eixos:
--   · 5 tipos, não 3 (§11.1);
--   · campos PADRONIZADOS vindos de taxonomia, não texto livre (§11.2, §21.2:
--     "evitar duplicatas livres");
--   · "O Commander gera o título/cartão final do anúncio a partir dos campos"
--     (§11.2) — ou seja, `titulo` não pode nem existir como coluna digitável;
--   · expiração própria (§11.2), proposta com campos por tipo (§11.5),
--     negócio com confirmação bilateral (§11.6).
-- Estender significaria manter uma coluna `titulo not null` que o produto
-- proíbe, um `categoria text` que a taxonomia proíbe, e um check de 3 tipos
-- pra reescrever de qualquer jeito. Sobraria a casca e nenhuma das regras.
-- Por isso: tabelas novas com o formato certo, DADOS MIGRADOS linha a linha
-- (nenhum registro órfão — ver bloco "MIGRAÇÃO DOS DADOS" no fim) e as
-- tabelas antigas removidas no mesmo passo, pra não sobrar duas verdades.
--
-- ---------------------------------------------------------------------------
-- O QUE NÃO ENTRA AQUI (de propósito)
-- ---------------------------------------------------------------------------
-- · Comissão sobre transação — §11.6: "Não cobrar comissão sobre transações no
--   Upgrade 2". Não existe coluna de comissão em lugar nenhum deste arquivo.
-- · Gate por plano (Free publica? Captain Pro publica disponibilidade?
--   vitrine por plano do Partner) — §2.3/§11.3 amarram isso a planos que ainda
--   não estão definidos. Os pontos ficam marcados no código da aplicação.
-- · Avaliação (§14) — é outra onda. O que fica pronto aqui é o FATO que a
--   libera: negócio com confirmação bilateral registrada.

-- ===========================================================================
-- 0) "Hoje" no fuso do barco
-- ===========================================================================
-- `current_date` no Supabase é UTC: entre 21h e meia-noite em São Paulo ele já
-- virou o dia seguinte, e uma demanda que expira hoje sumiria da vitrine três
-- horas antes da hora. O app inteiro já calcula o dia em America/Sao_Paulo
-- (`hojeISO`, web/lib/domain/datas.ts) — a RLS passa a usar a mesma régua.
create or replace function public.hoje_sp()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.hoje_sp() from public, anon;
grant execute on function public.hoje_sp() to authenticated;

-- ===========================================================================
-- 1) TAXONOMIA (§21.2) — uma tabela, vários tipos, compartilhada com Explorar
-- ===========================================================================
-- Uma tabela só com discriminador `tipo` em vez de seis tabelas quase iguais:
-- o PRD trata todas como a mesma coisa administrativa ("Admin controla
-- categorias de serviço/produto, marcas, regiões, funções profissionais...")
-- e o app precisa da mesma operação em todas — listar ativas, ordenar, criar.
-- `slug` é a chave estável pro código referenciar sem depender de uuid gerado.
create table public.taxonomia (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'regiao', 'categoria_servico', 'categoria_produto', 'funcao', 'marca', 'combustivel'
  )),
  slug text not null,
  nome text not null,
  uf text,                       -- só faz sentido em 'regiao'
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (tipo, slug)
);

create index taxonomia_tipo_idx on public.taxonomia (tipo, ordem, nome) where ativo;

alter table public.taxonomia enable row level security;

-- Leitura aberta a qualquer pessoa logada: é vocabulário do produto, não dado
-- de ninguém. Escrita só admin (§21.2 — "Admin controla ... taxonomias").
create policy "taxonomia: todo mundo logado lê" on public.taxonomia
  for select to authenticated using (true);
create policy "taxonomia: só admin escreve" on public.taxonomia
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Pedido de inclusão (§21.2: "Usuário pode solicitar inclusão de marca/
-- categoria ausente; evitar duplicatas livres") — a válvula de escape que
-- impede a pessoa de inventar texto livre quando não acha o que precisa.
create table public.taxonomia_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in (
    'regiao', 'categoria_servico', 'categoria_produto', 'funcao', 'marca', 'combustivel'
  )),
  nome text not null,
  observacao text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  criado_em timestamptz not null default now()
);

alter table public.taxonomia_solicitacoes enable row level security;

create policy "taxonomia_solicitacoes: própria ou admin" on public.taxonomia_solicitacoes
  for select to authenticated
  using (solicitante_id = (select auth.uid()) or public.eh_admin());
create policy "taxonomia_solicitacoes: pede a própria" on public.taxonomia_solicitacoes
  for insert to authenticated
  with check (solicitante_id = (select auth.uid()) and status = 'pendente');
create policy "taxonomia_solicitacoes: admin decide" on public.taxonomia_solicitacoes
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- --- Sementes -------------------------------------------------------------
-- Curadoria inicial, não lista definitiva: o Admin edita daqui pra frente.
-- 'outra-regiao' existe de propósito — é o destino das demandas antigas
-- (migradas mais abaixo) e a saída honesta pra quem navega fora da lista,
-- que aí pede a inclusão da sua região em taxonomia_solicitacoes.
insert into public.taxonomia (tipo, slug, nome, uf, ordem) values
  ('regiao', 'angra-dos-reis',      'Angra dos Reis',        'RJ', 10),
  ('regiao', 'paraty',              'Paraty',                'RJ', 20),
  ('regiao', 'rio-de-janeiro',      'Rio de Janeiro',        'RJ', 30),
  ('regiao', 'niteroi',             'Niterói',               'RJ', 40),
  ('regiao', 'buzios',              'Búzios',                'RJ', 50),
  ('regiao', 'cabo-frio',           'Cabo Frio',             'RJ', 60),
  ('regiao', 'ilhabela',            'Ilhabela',              'SP', 70),
  ('regiao', 'sao-sebastiao',       'São Sebastião',         'SP', 80),
  ('regiao', 'ubatuba',             'Ubatuba',               'SP', 90),
  ('regiao', 'santos-guaruja',      'Santos e Guarujá',      'SP', 100),
  ('regiao', 'florianopolis',       'Florianópolis',         'SC', 110),
  ('regiao', 'balneario-camboriu',  'Balneário Camboriú',    'SC', 120),
  ('regiao', 'vitoria',             'Vitória',               'ES', 130),
  ('regiao', 'salvador',            'Salvador',              'BA', 140),
  ('regiao', 'outra-regiao',        'Outra região',          null, 999);

insert into public.taxonomia (tipo, slug, nome, ordem) values
  ('categoria_servico', 'mecanica',              'Mecânica',                     10),
  ('categoria_servico', 'eletrica',              'Elétrica',                     20),
  ('categoria_servico', 'eletronica-navegacao',  'Eletrônica e navegação',       30),
  ('categoria_servico', 'hidraulica',            'Hidráulica',                   40),
  ('categoria_servico', 'fibra-pintura',         'Fibra e pintura',              50),
  ('categoria_servico', 'estofamento',           'Estofamento e capotaria',      60),
  ('categoria_servico', 'refrigeracao',          'Refrigeração e ar',            70),
  ('categoria_servico', 'solda-inox',            'Solda e inox',                 80),
  ('categoria_servico', 'mergulho-casco',        'Mergulho e limpeza de casco',  90),
  ('categoria_servico', 'limpeza-conservacao',   'Limpeza e conservação',       100),
  ('categoria_servico', 'icamento-transporte',   'Içamento e transporte',       110),
  ('categoria_servico', 'outros-servicos',       'Outros serviços náuticos',    999);

insert into public.taxonomia (tipo, slug, nome, ordem) values
  ('categoria_produto', 'motor-pecas',           'Motor e peças',                10),
  ('categoria_produto', 'radio-comunicacao',     'Rádio e comunicação',          20),
  ('categoria_produto', 'eletronica-navegacao',  'Eletrônica e navegação',       30),
  ('categoria_produto', 'seguranca',             'Material de segurança',        40),
  ('categoria_produto', 'eletrica-baterias',     'Elétrica e baterias',          50),
  ('categoria_produto', 'ancoragem-amarracao',   'Âncoras, cabos e amarração',   60),
  ('categoria_produto', 'estofados-capas',       'Estofados e capas',            70),
  ('categoria_produto', 'tinta-manutencao',      'Tinta e manutenção',           80),
  ('categoria_produto', 'acessorios-conves',        'Acessórios de convés',         90),
  ('categoria_produto', 'outros-produtos',       'Outros produtos náuticos',    999);

insert into public.taxonomia (tipo, slug, nome, ordem) values
  ('funcao', 'comandante',         'Comandante',           10),
  ('funcao', 'marinheiro',         'Marinheiro',           20),
  ('funcao', 'ajudante-conves',      'Ajudante de convés',   30),
  ('funcao', 'imediato',           'Imediato',             40),
  ('funcao', 'mecanico-bordo',     'Mecânico de bordo',    50),
  ('funcao', 'cozinheiro',         'Cozinheiro(a)',        60),
  ('funcao', 'camareira',          'Camareira',            70);

insert into public.taxonomia (tipo, slug, nome, ordem) values
  ('combustivel', 'diesel-s10',          'Diesel S10',           10),
  ('combustivel', 'diesel-s500',         'Diesel S500',          20),
  ('combustivel', 'gasolina-comum',      'Gasolina comum',       30),
  ('combustivel', 'gasolina-aditivada',  'Gasolina aditivada',   40);

insert into public.taxonomia (tipo, slug, nome, ordem) values
  ('marca', 'volvo-penta',       'Volvo Penta',       10),
  ('marca', 'mercury',           'Mercury',           20),
  ('marca', 'yamaha',            'Yamaha',            30),
  ('marca', 'yanmar',            'Yanmar',            40),
  ('marca', 'cummins',           'Cummins',           50),
  ('marca', 'man',               'MAN',               60),
  ('marca', 'caterpillar',       'Caterpillar',       70),
  ('marca', 'honda',             'Honda',             80),
  ('marca', 'suzuki',            'Suzuki',            90),
  ('marca', 'garmin',            'Garmin',           100),
  ('marca', 'raymarine',         'Raymarine',        110),
  ('marca', 'furuno',            'Furuno',           120),
  ('marca', 'simrad',            'Simrad',           130),
  ('marca', 'icom',              'Icom',             140),
  ('marca', 'standard-horizon',  'Standard Horizon', 150);

-- ===========================================================================
-- 2) DEMANDAS (§11.1, §11.2) — o pedido do proprietário
-- ===========================================================================
-- Não existe coluna `titulo`: o título do cartão é GERADO a partir destes
-- campos por `tituloDaDemanda` (web/lib/domain/marketplace.ts), como o §11.2
-- manda. Guardar um título congelado aqui criaria a duplicata que a taxonomia
-- veio justamente evitar (renomear "Elétrica" no Admin deixaria títulos velhos
-- mentindo). `observacao` é o "texto livre é apenas observação curta
-- complementar" do PRD — nunca a fonte do título.
create table public.demandas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete cascade,
  -- Nome autodeclarado: `profiles` tem RLS de "próprio ou tripulação"
  -- (migration 008) e quem publica não é tripulante de quem responde — um
  -- JOIN voltaria vazio SEM erro. Mesmo raciocínio da migration 038.
  autor_nome text not null default '',
  tipo text not null check (tipo in (
    'profissional',      -- "Preciso de eletricista em Angra"
    'tripulacao',        -- "Preciso de marinheiro sábado"
    'produto',           -- "Procuro rádio VHF"
    'vaga_embarcacao',   -- "Procuro vaga molhada para 80 pés"
    'caminhao'           -- "Preciso de 1.500 L de diesel"
  )),
  regiao_id uuid not null references public.taxonomia(id) on delete restrict,
  categoria_id uuid references public.taxonomia(id) on delete restrict,
  funcao_id uuid references public.taxonomia(id) on delete restrict,
  marca_id uuid references public.taxonomia(id) on delete restrict,
  combustivel_id uuid references public.taxonomia(id) on delete restrict,
  porte_pes int check (porte_pes > 0 and porte_pes <= 400),
  tipo_vaga text check (tipo_vaga in ('seca', 'molhada')),
  quantidade_litros int check (quantidade_litros > 0),
  data_desejada date,
  data_fim date,
  observacao text,
  status text not null default 'aberta'
    check (status in ('aberta', 'em_negociacao', 'fechada', 'cancelada')),
  -- Expiração (§11.2): sem data específica -> 30 dias; com data/período ->
  -- o próprio prazo da demanda. Calculado por `calcularExpiracao` no app.
  -- Não existe status 'expirada': expirar é uma comparação com a data de
  -- hoje, não um estado que alguém precisa lembrar de gravar (um cron
  -- atrasado deixaria demanda vencida aparecendo como aberta).
  expira_em date not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- §11.4 fala em "requisitos específicos (porte máximo, combustível,
  -- função)" — o banco exige o requisito de cada tipo pra que o matching
  -- nunca receba uma demanda que não dá pra rotear.
  constraint demandas_campos_por_tipo check (
    case tipo
      when 'profissional'    then categoria_id is not null
      when 'tripulacao'      then funcao_id is not null
      when 'produto'         then categoria_id is not null
      when 'vaga_embarcacao' then porte_pes is not null and tipo_vaga is not null
      when 'caminhao'        then combustivel_id is not null and quantidade_litros is not null
    end
  ),
  constraint demandas_periodo check (
    data_fim is null or data_desejada is null or data_fim >= data_desejada
  )
);

create index demandas_vitrine_idx on public.demandas (status, expira_em, criado_em desc);
create index demandas_autor_idx on public.demandas (autor_id, criado_em desc);
create index demandas_matching_idx on public.demandas (tipo, regiao_id) where status = 'aberta';

alter table public.demandas enable row level security;

-- Quem vê: qualquer pessoa logada vê demanda ainda viva (aberta ou em
-- negociação, dentro do prazo) — §11.4 diz que o matching "prioriza
-- compatibilidade", não que esconde o resto; a priorização é da tela. O autor
-- vê sempre as próprias, inclusive fechadas e vencidas.
create policy "demandas: viva pra todo mundo, própria pro autor" on public.demandas
  for select to authenticated
  using (
    autor_id = (select auth.uid())
    or (status in ('aberta', 'em_negociacao') and expira_em >= public.hoje_sp())
  );

create policy "demandas: autor publica" on public.demandas
  for insert to authenticated
  with check (autor_id = (select auth.uid()));

create policy "demandas: autor gerencia a própria" on public.demandas
  for update to authenticated
  using (autor_id = (select auth.uid()))
  with check (autor_id = (select auth.uid()));

create policy "demandas: autor exclui a própria" on public.demandas
  for delete to authenticated
  using (autor_id = (select auth.uid()));

create or replace function public.demanda_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
create trigger demandas_carimbo before update on public.demandas
  for each row execute function public.demanda_carimbo();
revoke execute on function public.demanda_carimbo() from public, anon, authenticated;

-- ===========================================================================
-- 3) PROPOSTAS E CANDIDATURAS (§11.5)
-- ===========================================================================
-- Uma tabela só, com as colunas de cada tipo do §11.5 — o tipo da DEMANDA
-- decide quais aparecem no formulário (CAMPOS_PROPOSTA em
-- web/lib/domain/marketplace.ts). Cinco tabelas quase idênticas dariam o
-- mesmo resultado e cinco RLS pra manter em sincronia.
create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  autor_nome text not null default '',
  -- Telefone de QUEM PROPÕE é oferta voluntária dele (§22 protege o
  -- proprietário, que não escolheu quem ia ler o anúncio) — o parceiro digita
  -- sabendo que está entregando o contato pra fechar negócio.
  telefone text,

  -- comuns a serviço/tripulação/marina
  disponibilidade text,
  data_possivel date,
  valor_centavos int check (valor_centavos > 0),
  valor_a_combinar boolean not null default false,
  observacao text,

  -- serviço (§11.5 "Serviço: ... necessidade de visita")
  precisa_visita boolean,

  -- produto (§11.5 "Produto: marca/modelo, condição, valor, entrega/retirada, prazo")
  marca_modelo text,
  condicao text check (condicao in ('novo', 'seminovo', 'usado', 'recondicionado')),
  entrega text check (entrega in ('entrega', 'retirada', 'ambos')),
  prazo_dias int check (prazo_dias >= 0),

  -- marina (§11.5 "Marina: tipo de vaga, diária/mensal/período, água/energia")
  tipo_vaga text check (tipo_vaga in ('seca', 'molhada')),
  periodo text check (periodo in ('diaria', 'mensal', 'periodo')),
  tem_agua_energia boolean,

  -- posto (§11.5 "Posto: preço/L, quantidade, data/período, taxa de deslocamento, valor estimado")
  preco_litro_centavos int check (preco_litro_centavos > 0),
  quantidade_litros int check (quantidade_litros > 0),
  taxa_deslocamento_centavos int check (taxa_deslocamento_centavos >= 0),
  valor_estimado_centavos int check (valor_estimado_centavos > 0),

  status text not null default 'enviada'
    check (status in ('enviada', 'aceita', 'recusada', 'retirada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Uma proposta por pessoa por demanda (mesma regra do mural antigo).
  unique (demanda_id, autor_id),
  -- "valor estimado/a combinar" (§11.5) são alternativas, não um par.
  constraint propostas_valor check (not (valor_a_combinar and valor_centavos is not null))
);

create index propostas_demanda_idx on public.propostas (demanda_id, criado_em);
create index propostas_autor_idx on public.propostas (autor_id, criado_em desc);

alter table public.propostas enable row level security;

-- Proposta é conversa de dois: quem propôs e o dono da demanda. Nunca vira
-- vitrine pública (o concorrente não vê o preço do outro).
create policy "propostas: proponente e dono da demanda" on public.propostas
  for select to authenticated
  using (
    autor_id = (select auth.uid())
    or exists (select 1 from public.demandas d where d.id = demanda_id and d.autor_id = (select auth.uid()))
  );

create policy "propostas: propõe em demanda viva de outra pessoa" on public.propostas
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and status = 'enviada'
    and exists (
      select 1 from public.demandas d
      where d.id = demanda_id
        and d.autor_id <> (select auth.uid())
        and d.status in ('aberta', 'em_negociacao')
        and d.expira_em >= public.hoje_sp()
    )
  );

create policy "propostas: os dois lados mexem no status" on public.propostas
  for update to authenticated
  using (
    autor_id = (select auth.uid())
    or exists (select 1 from public.demandas d where d.id = demanda_id and d.autor_id = (select auth.uid()))
  )
  with check (
    autor_id = (select auth.uid())
    or exists (select 1 from public.demandas d where d.id = demanda_id and d.autor_id = (select auth.uid()))
  );

-- Só `status` é editável depois de enviada. Sem isso, o dono da demanda (que
-- precisa de UPDATE pra aceitar) poderia reescrever o preço da proposta
-- alheia — a política de linha sozinha não distingue coluna.
revoke update on table public.propostas from authenticated;
grant update (status) on table public.propostas to authenticated;

-- E quem pode virar o quê: proponente só RETIRA a sua; dono da demanda só
-- ACEITA ou RECUSA. A política diz "esses dois podem mexer"; o trigger diz
-- "cada um pode mexer pra quê".
create or replace function public.proposta_transicao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dono_demanda uuid;
  v_quem uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    select autor_id into v_dono_demanda from public.demandas where id = old.demanda_id;
    if v_quem = old.autor_id then
      if new.status <> 'retirada' then
        raise exception 'quem propos so pode retirar a propria proposta';
      end if;
    elsif v_quem = v_dono_demanda then
      if new.status not in ('aceita', 'recusada') then
        raise exception 'quem publicou a demanda so pode aceitar ou recusar';
      end if;
    else
      raise exception 'sem permissao para mudar o status desta proposta';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger propostas_transicao before update on public.propostas
  for each row execute function public.proposta_transicao();
revoke execute on function public.proposta_transicao() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3.1) CONTATO DO PROPRIETÁRIO — §22, e é RLS, não tela
-- ---------------------------------------------------------------------------
-- §22: "Partner não recebe telefone/dados sensíveis do proprietário antes do
-- ponto de liberação previsto no fluxo." Se o telefone morasse numa coluna de
-- `demandas`, qualquer parceiro leria o telefone de todo proprietário do país
-- com um único select — esconder no React não protege nada. Por isso ele mora
-- em tabela separada, e o "ponto de liberação" está escrito na política: só
-- depois que o autor ACEITA a proposta daquela pessoa. (Fica depois de
-- `propostas` porque a política referencia essa tabela — política não pode
-- citar tabela que ainda não existe.)
create table public.demandas_contato (
  demanda_id uuid primary key references public.demandas(id) on delete cascade,
  telefone text,
  email text,
  criado_em timestamptz not null default now()
);

alter table public.demandas_contato enable row level security;

create policy "contato: autor sempre, proponente só depois de aceito" on public.demandas_contato
  for select to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demandas_contato.demanda_id and d.autor_id = (select auth.uid())
    )
    or exists (
      select 1 from public.propostas p
      where p.demanda_id = demandas_contato.demanda_id
        and p.autor_id = (select auth.uid())
        and p.status = 'aceita'
    )
  );

create policy "contato: autor grava o próprio" on public.demandas_contato
  for insert to authenticated
  with check (
    exists (
      select 1 from public.demandas d
      where d.id = demandas_contato.demanda_id and d.autor_id = (select auth.uid())
    )
  );

create policy "contato: autor edita o próprio" on public.demandas_contato
  for update to authenticated
  using (exists (
    select 1 from public.demandas d
    where d.id = demandas_contato.demanda_id and d.autor_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.demandas d
    where d.id = demandas_contato.demanda_id and d.autor_id = (select auth.uid())
  ));

create policy "contato: autor apaga o próprio" on public.demandas_contato
  for delete to authenticated
  using (exists (
    select 1 from public.demandas d
    where d.id = demandas_contato.demanda_id and d.autor_id = (select auth.uid())
  ));

-- ===========================================================================
-- 4) NEGÓCIO E CONFIRMAÇÃO BILATERAL (§11.6)
-- ===========================================================================
-- "Um lado marca como realizado; o outro confirma ou nega."
-- O estado de verdade são as DUAS declarações, não um campo que alguém
-- carimba: `negocios` guarda o fato comercial, `negocios_confirmacoes` guarda
-- uma linha por lado. O estado derivado (aguardando / confirmado / negado)
-- é calculado por `estadoDoNegocio` (web/lib/domain/marketplace.ts) — não
-- existe coluna-cache pra divergir das linhas que a originaram.
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  proposta_id uuid not null unique references public.propostas(id) on delete cascade,
  cliente_id uuid not null references public.profiles(id) on delete cascade,     -- quem publicou a demanda
  fornecedor_id uuid not null references public.profiles(id) on delete cascade,  -- quem propôs
  -- §11.6: "Valor final é opcional e pode ser diferente do valor inicialmente
  -- proposto." Por isso é nullable e não copia o valor da proposta.
  valor_final_centavos int check (valor_final_centavos >= 0),
  criado_em timestamptz not null default now()
);

create index negocios_partes_idx on public.negocios (cliente_id, fornecedor_id);

alter table public.negocios enable row level security;

create policy "negocios: as duas partes (e o admin, §21.1)" on public.negocios
  for select to authenticated
  using (
    cliente_id = (select auth.uid()) or fornecedor_id = (select auth.uid()) or public.eh_admin()
  );

-- Só nasce a partir de proposta ACEITA, e só por um dos dois envolvidos.
create policy "negocios: parte registra a partir de proposta aceita" on public.negocios
  for insert to authenticated
  with check (
    (cliente_id = (select auth.uid()) or fornecedor_id = (select auth.uid()))
    and exists (
      select 1 from public.propostas p join public.demandas d on d.id = p.demanda_id
      where p.id = proposta_id
        and p.status = 'aceita'
        and p.demanda_id = negocios.demanda_id
        and d.autor_id = negocios.cliente_id
        and p.autor_id = negocios.fornecedor_id
    )
  );

-- Sem update e sem delete de propósito: negócio informado não se reescreve.
-- Discordou do valor? O outro lado NEGA a confirmação, e isso fica registrado.

create table public.negocios_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  papel text not null check (papel in ('cliente', 'fornecedor')),
  decisao text not null check (decisao in ('realizado', 'confirmado', 'negado')),
  observacao text,
  criado_em timestamptz not null default now(),
  -- Uma declaração por pessoa: é o que impede quem marcou "realizado" de
  -- também "confirmar" sozinho e fabricar uma confirmação bilateral.
  unique (negocio_id, usuario_id)
);

create index negocios_confirmacoes_negocio_idx on public.negocios_confirmacoes (negocio_id);

alter table public.negocios_confirmacoes enable row level security;

create policy "confirmações: as duas partes (e o admin)" on public.negocios_confirmacoes
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or exists (
      select 1 from public.negocios n
      where n.id = negocio_id
        and (n.cliente_id = (select auth.uid()) or n.fornecedor_id = (select auth.uid()))
    )
    or public.eh_admin()
  );

create policy "confirmações: cada um declara a sua, no papel certo" on public.negocios_confirmacoes
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (
      select 1 from public.negocios n
      where n.id = negocio_id
        and (
          (n.cliente_id = (select auth.uid()) and papel = 'cliente')
          or (n.fornecedor_id = (select auth.uid()) and papel = 'fornecedor')
        )
    )
  );

-- Sem update/delete: uma declaração registrada é histórico (mesma régua do
-- §7 — "registros finalizados não são apagados silenciosamente").

-- ===========================================================================
-- 5) INTERESSES DO PARCEIRO (§11.4) — a base do matching
-- ===========================================================================
-- "Parceiro escolhe no cadastro suas regiões e áreas de interesse/atuação."
-- Uma linha = "me mande demandas DESTE tipo, NESTA região, (opcionalmente)
-- desta categoria/função/combustível, até este porte". Vale igual pra pessoa
-- (prestador, comandante) e pra estabelecimento (marina, posto) — o matching
-- não precisa saber qual dos dois é, só o que a pessoa quer receber.
create table public.interesses_marketplace (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  tipo_demanda text not null check (tipo_demanda in (
    'profissional', 'tripulacao', 'produto', 'vaga_embarcacao', 'caminhao'
  )),
  regiao_id uuid not null references public.taxonomia(id) on delete cascade,
  -- null = "qualquer uma" (não é o mesmo que "nenhuma"): quem atende toda a
  -- região não precisa marcar as 12 categorias uma a uma.
  categoria_id uuid references public.taxonomia(id) on delete cascade,
  funcao_id uuid references public.taxonomia(id) on delete cascade,
  combustivel_id uuid references public.taxonomia(id) on delete cascade,
  -- Teto da marina: uma demanda de 80 pés não vai pra quem só tem vaga de 40.
  porte_max_pes int check (porte_max_pes > 0 and porte_max_pes <= 400),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index interesses_marketplace_unico on public.interesses_marketplace (
  usuario_id,
  tipo_demanda,
  regiao_id,
  coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(funcao_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(combustivel_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

alter table public.interesses_marketplace enable row level security;

-- O interesse é a caixa de entrada da pessoa, não uma vitrine: o matching
-- roda sempre do lado de quem lê ("quais demandas batem com o que EU marquei"),
-- então ninguém precisa ler o interesse de terceiro.
create policy "interesses: só os próprios" on public.interesses_marketplace
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "interesses: cria o próprio" on public.interesses_marketplace
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "interesses: edita o próprio" on public.interesses_marketplace
  for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy "interesses: apaga o próprio" on public.interesses_marketplace
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- ===========================================================================
-- 6) OFEREÇO / ESTOU DISPONÍVEL (§11.3)
-- ===========================================================================
-- O espelho da demanda de tripulação: o profissional anuncia o próprio
-- período. Campos padronizados (função e região vêm da taxonomia), texto
-- livre só em observação — mesma regra do §11.2.
-- O PRD amarra a PUBLICAÇÃO ao Captain Pro; o gate não entra aqui porque os
-- planos ainda não estão definidos (ver comentário em lib/acoes/marketplace.ts).
create table public.disponibilidades (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.profiles(id) on delete cascade,
  autor_nome text not null default '',
  funcao_id uuid not null references public.taxonomia(id) on delete restrict,
  regiao_id uuid not null references public.taxonomia(id) on delete restrict,
  tipo_trabalho text not null check (tipo_trabalho in ('diaria', 'temporada', 'fixo', 'eventual')),
  data_inicio date,
  data_fim date,
  experiencia_anos int check (experiencia_anos >= 0 and experiencia_anos <= 80),
  porte_max_pes int check (porte_max_pes > 0 and porte_max_pes <= 400),
  certificacoes text,
  observacao text,
  telefone text,
  expira_em date not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint disponibilidades_periodo check (
    data_fim is null or data_inicio is null or data_fim >= data_inicio
  )
);

create index disponibilidades_vitrine_idx on public.disponibilidades (regiao_id, funcao_id, expira_em)
  where ativo;

alter table public.disponibilidades enable row level security;

create policy "disponibilidades: viva pra todo mundo, própria pro autor" on public.disponibilidades
  for select to authenticated
  using (autor_id = (select auth.uid()) or (ativo and expira_em >= public.hoje_sp()));
create policy "disponibilidades: publica a própria" on public.disponibilidades
  for insert to authenticated with check (autor_id = (select auth.uid()));
create policy "disponibilidades: gerencia a própria" on public.disponibilidades
  for update to authenticated
  using (autor_id = (select auth.uid())) with check (autor_id = (select auth.uid()));
create policy "disponibilidades: apaga a própria" on public.disponibilidades
  for delete to authenticated using (autor_id = (select auth.uid()));

-- ===========================================================================
-- 7) MIGRAÇÃO DOS DADOS — nenhum registro órfão
-- ===========================================================================
-- `oportunidades` (037/038) vira `demandas`; `respostas_oportunidade` vira
-- `propostas`. Os ids são preservados, então qualquer link antigo
-- (/oportunidades/<id>) continua encontrando o registro em /marketplace/<id>.
--
-- Mapa de tipo, com a perda honesta declarada:
--   vaga, diaria    -> 'tripulacao'   (os dois eram "preciso de comandante",
--                                      um fixo e um pontual; a distinção vira
--                                      observação, não some)
--   peca_servico    -> 'profissional' (era "COMPRO X" OU "serviço específico";
--                                      sem campo estruturado não dá pra saber
--                                      qual dos dois era, e 'profissional' é o
--                                      que ainda deixa o autor corrigir sem
--                                      perder as respostas já recebidas)
-- `titulo`/`descricao`/`local` viram `observacao` — o título antigo era
-- digitado à mão, e o novo é gerado; jogar o texto velho em observação
-- preserva a informação sem fingir que era campo estruturado.
insert into public.demandas (
  id, autor_id, autor_nome, tipo, regiao_id, categoria_id, funcao_id,
  observacao, status, expira_em, criado_em, atualizado_em
)
select
  o.id,
  o.autor_id,
  coalesce(nullif(o.autor_nome, ''), 'Comandante'),
  case when o.tipo = 'peca_servico' then 'profissional' else 'tripulacao' end,
  (select t.id from public.taxonomia t where t.tipo = 'regiao' and t.slug = 'outra-regiao'),
  case when o.tipo = 'peca_servico'
    then (select t.id from public.taxonomia t where t.tipo = 'categoria_servico' and t.slug = 'outros-servicos')
  end,
  case when o.tipo <> 'peca_servico'
    then (select t.id from public.taxonomia t where t.tipo = 'funcao' and t.slug = 'comandante')
  end,
  nullif(concat_ws(
    E'\n',
    o.titulo,
    nullif(o.descricao, ''),
    case when nullif(o.local, '') is not null then 'Local informado: ' || o.local end,
    case when nullif(o.categoria, '') is not null then 'Categoria informada: ' || o.categoria end,
    case o.tipo when 'diaria' then 'Publicada como diária no mural anterior.'
                when 'vaga' then 'Publicada como vaga no mural anterior.'
                else 'Publicada como peça/serviço no mural anterior.' end
  ), ''),
  case o.status when 'aberta' then 'aberta' when 'atendida' then 'fechada' else 'cancelada' end,
  (o.created_at + interval '30 days')::date,
  o.created_at,
  o.created_at
from public.oportunidades o;

insert into public.propostas (
  id, demanda_id, autor_id, autor_nome, telefone, observacao, status, criado_em, atualizado_em
)
select
  r.id, r.oportunidade_id, r.respondente_id,
  coalesce(nullif(r.nome, ''), 'Comandante'),
  r.telefone, r.mensagem, 'enviada', r.created_at, r.created_at
from public.respostas_oportunidade r;

drop table public.respostas_oportunidade;
drop table public.oportunidades;

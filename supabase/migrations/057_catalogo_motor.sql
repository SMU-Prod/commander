-- =====================================================================
-- Onda 64 · O CATÁLOGO DE MOTOR — a hierarquia de peça do PRD 3D §16.
--
-- O §16 do PRD-3D-ENGINE é uma ordem de arquitetura, não um detalhe:
--
--     "IMPORTANTE: o banco de manutenção NÃO PODE DEPENDER DO 3D."
--     Manufacturer → Engine Family → Engine Model → Variant/Year →
--     Component → OEM Part Number → Maintenance Plan
--
-- E fecha explicando o porquê: "se amanhã trocarmos o modelo 3D, o
-- histórico da embarcação continua intacto".
--
-- Por isso esta migration NÃO tem uma linha de 3D. Ela entrega a corrente
-- inteira de manutenção — componente → peça → part number → plano — e o
-- 3D, quando vier (ondas 66/67), pendura os assets AQUI. Se o 3D nunca
-- sair, o catálogo continua valendo sozinho: hoje um motor é
-- `marca = 'Volvo Penta'`, `modelo = 'D6-440'` em TEXTO LIVRE, e dois donos
-- que digitam diferente ("Volvo penta", "VOLVO PENTA IPS", "D6 440")
-- viram dois motores diferentes pro app. O catálogo dá identidade.
--
-- ---------------------------------------------------------------------
-- ADITIVA, E SÓ (mesma disciplina das 055 e 056)
-- ---------------------------------------------------------------------
-- `equipamentos.marca` e `.modelo` CONTINUAM existindo e continuam texto
-- livre. O vínculo com o catálogo é uma coluna NULLABLE por cima: motor já
-- cadastrado não muda, não é migrado em massa e não perde nada. Quem quiser
-- identidade escolhe do catálogo; quem tiver um motor que não está lá
-- continua digitando. Não se inventa dado em registro de ninguém.
--
-- ---------------------------------------------------------------------
-- POR QUE O COMPONENTE PENDURA NA FAMÍLIA, E NÃO NO MODELO
-- ---------------------------------------------------------------------
-- O §24 ("Famílias compartilhadas") manda investigar motores que
-- compartilham bloco, arquitetura, carcaça e geometria, e diz que um asset
-- de FAMÍLIA pode atender vários modelos "enquanto dados de potência, ano,
-- peças e manutenção permanecem individualizados".
--
-- A leitura aplicada aqui: o D6-400 e o D6-440 têm o MESMO filtro de óleo
-- na mesma posição — muda a potência, não o bloco. Então componente e
-- intervalo são da família; potência e faixa de ano são do modelo. Isso
-- também é o que deixa a onda 67 pendurar hotspot em família e servir a
-- linha inteira, em vez de remarcar o mesmo alternador dezenas de vezes.
--
-- ---------------------------------------------------------------------
-- RLS — MESMO PADRÃO DE `taxonomia`
-- ---------------------------------------------------------------------
-- Catálogo é VOCABULÁRIO do produto, não dado de ninguém: qualquer pessoa
-- logada lê, só admin escreve (`public.eh_admin()`). Idêntico ao que a
-- migration da taxonomia já fez, e pelo mesmo motivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fabricante — o topo da hierarquia do §16
-- ---------------------------------------------------------------------
create table public.motor_fabricantes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  -- Agrupamento do §20 do PRD, que separa o levantamento por natureza do
  -- motor. Não é enfeite: é o filtro que a busca do cadastro usa pra não
  -- oferecer MTU de 2000 hp a quem tem um Jet.
  segmento text not null check (segmento in ('popa', 'centro_rabeta', 'diesel_interno')),
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index motor_fabricantes_ordem_idx
  on public.motor_fabricantes (segmento, ordem, nome) where ativo;

-- ---------------------------------------------------------------------
-- 2. Família — onde moram bloco, arquitetura e (na onda 67) os hotspots
-- ---------------------------------------------------------------------
create table public.motor_familias (
  id uuid primary key default gen_random_uuid(),
  fabricante_id uuid not null references public.motor_fabricantes(id) on delete cascade,
  slug text not null,
  nome text not null,
  observacao text,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (fabricante_id, slug)
);

create index motor_familias_fabricante_idx
  on public.motor_familias (fabricante_id, ordem, nome) where ativo;

-- ---------------------------------------------------------------------
-- 3. Modelo/Variante — o que individualiza potência e ano (§24)
-- ---------------------------------------------------------------------
create table public.motor_modelos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.motor_familias(id) on delete cascade,
  slug text not null,
  nome text not null,
  potencia_hp int,
  -- Faixa de produção. As duas nullable: motor em linha não tem ano final,
  -- e de motor antigo às vezes não se sabe o inicial. `null` aqui é
  -- "não sei", nunca 0 — a mesma regra de honestidade do resto do app.
  ano_inicio int,
  ano_fim int,
  combustivel text,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (familia_id, slug),
  -- Faixa invertida é erro de digitação, não dado.
  constraint motor_modelos_faixa_de_ano_coerente
    check (ano_inicio is null or ano_fim is null or ano_inicio <= ano_fim)
);

create index motor_modelos_familia_idx
  on public.motor_modelos (familia_id, ordem, nome) where ativo;

-- Busca por nome no cadastro de motor ("D6-440", "Verado 400"). O catálogo
-- é pequeno e cresce devagar; um índice de trigram seria peso sem ganho.
create index motor_modelos_nome_idx on public.motor_modelos (lower(nome)) where ativo;

-- ---------------------------------------------------------------------
-- 4. Componente + Part Number + plano de manutenção
--    (os três últimos elos do §16, numa linha só)
-- ---------------------------------------------------------------------
-- O §16 desenha Component → OEM Part Number → Maintenance Plan em três
-- degraus. Aqui é uma tabela: o part number é ATRIBUTO do componente (o
-- filtro de óleo do D6 TEM um código) e o plano é o par
-- intervalo_horas/intervalo_meses — exatamente os dois campos que
-- `itens_monitorados` já usa e que `calcularSemaforo` já sabe ler. Três
-- tabelas para três atributos seria hierarquia de enfeite.
create table public.motor_componentes (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.motor_familias(id) on delete cascade,
  slug text not null,
  nome text not null,
  -- O "Sistema: Lubrificação" que o §2 do PRD mostra no painel da peça.
  sistema text not null check (sistema in (
    'lubrificacao', 'combustivel', 'arrefecimento', 'eletrica',
    'transmissao', 'admissao_escape', 'propulsao', 'outro'
  )),
  part_number_oem text,
  -- O plano sugerido. Nullable: nem todo componente vence por tempo ou por
  -- hora (um impelidor vence por hora, um anodo por mês, e há peça que só
  -- se troca quando quebra — essa fica com os dois nulos e não finge plano).
  intervalo_horas int,
  intervalo_meses int,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (familia_id, slug),
  constraint motor_componentes_intervalo_positivo
    check ((intervalo_horas is null or intervalo_horas > 0)
       and (intervalo_meses is null or intervalo_meses > 0))
);

create index motor_componentes_familia_idx
  on public.motor_componentes (familia_id, sistema, ordem, nome) where ativo;

-- ---------------------------------------------------------------------
-- 5. As duas pontes com o que já existe
-- ---------------------------------------------------------------------

-- O equipamento aponta pro modelo do catálogo. `on delete set null`: se um
-- modelo sair do catálogo, o motor do dono NÃO some nem quebra — ele volta
-- a valer pelo texto livre de `marca`/`modelo`, que nunca foi apagado.
alter table public.equipamentos
  add column motor_modelo_id uuid references public.motor_modelos(id) on delete set null;

create index equipamentos_motor_modelo_idx
  on public.equipamentos (motor_modelo_id) where motor_modelo_id is not null;

-- O item monitorado (que JÁ É o "componente com plano de manutenção" do
-- Commander) ganha os dois elos finais do §16.
alter table public.itens_monitorados
  -- Part number DO DONO. Separado do part number do catálogo de propósito:
  -- o catálogo diz o código OEM, e o dono pode usar um equivalente de
  -- fornecedor. Quando os dois existirem, quem manda na ficha é este.
  add column part_number_oem text,
  add column motor_componente_id uuid references public.motor_componentes(id) on delete set null;

create index itens_monitorados_componente_idx
  on public.itens_monitorados (motor_componente_id) where motor_componente_id is not null;

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
-- As colunas novas em `equipamentos` e `itens_monitorados` herdam as
-- policies dessas tabelas — nada novo a policiar ali. As quatro tabelas de
-- catálogo seguem `taxonomia`: vocabulário do produto, leitura aberta a
-- quem está logado, escrita só admin.
alter table public.motor_fabricantes enable row level security;
alter table public.motor_familias    enable row level security;
alter table public.motor_modelos     enable row level security;
alter table public.motor_componentes enable row level security;

create policy "motor_fabricantes: todo mundo logado lê" on public.motor_fabricantes
  for select to authenticated using (true);
create policy "motor_fabricantes: só admin escreve" on public.motor_fabricantes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create policy "motor_familias: todo mundo logado lê" on public.motor_familias
  for select to authenticated using (true);
create policy "motor_familias: só admin escreve" on public.motor_familias
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create policy "motor_modelos: todo mundo logado lê" on public.motor_modelos
  for select to authenticated using (true);
create policy "motor_modelos: só admin escreve" on public.motor_modelos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

create policy "motor_componentes: todo mundo logado lê" on public.motor_componentes
  for select to authenticated using (true);
create policy "motor_componentes: só admin escreve" on public.motor_componentes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

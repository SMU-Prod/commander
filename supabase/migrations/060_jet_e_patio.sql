-- =====================================================================
-- Onda 70 · COMMANDER JET E O PÁTIO.
-- PRD-UPGRADE-3-COTAS §5 (unidade Jet) e §6 (Operações / Pátio).
--
-- ---------------------------------------------------------------------
-- 1. O TIPO 'jet'
-- ---------------------------------------------------------------------
-- O §1 do PRD é categórico: "A interface se adapta ao tipo de embarcação.
-- Jet Ski NÃO recebe uma interface de lancha apenas reduzida." Sem valor
-- no enum, nenhuma tela consegue sequer perguntar "isto é um Jet?".
--
-- `add value` num enum não pode rodar dentro da mesma transação que o
-- usa — por isso ele vem sozinho, antes de tudo. O vocabulário espelhado
-- vive em web/lib/domain/tipo-embarcacao.ts.
--
-- ---------------------------------------------------------------------
-- 2. O MOVIMENTO DE PÁTIO (§6)
-- ---------------------------------------------------------------------
-- Check-out e check-in são UMA LINHA, não duas. O §6 pede "comparação com
-- check-out e duração/horas de uso" — com duas linhas soltas, essa
-- comparação viraria uma busca por pares em toda leitura, e a pergunta
-- "este Jet está fora?" precisaria varrer a tabela inteira. Numa linha, a
-- saída aberta é `retorno_em is null`, e o índice parcial único logo
-- abaixo garante que só existe uma por unidade.
--
-- QUASE TUDO É NULLABLE, e isso é a régua do §6, não desleixo: "home de
-- campo deve ser rápida, com botões grandes e poucos passos". Quem usa é
-- o funcionário de pé, com o Jet na rampa e o cotista esperando. Cada
-- campo obrigatório a mais são minutos somados no fim do dia. O domínio
-- (`web/lib/domain/patio.ts`) devolve `null` no que falta em vez de
-- inventar — e a tela diz o que não sabe.
--
-- As duas constraints existem porque são as únicas coisas que NÃO podem
-- acontecer: retorno antes da saída, e horímetro andando pra trás. O
-- domínio checa as duas de novo — ele não confia em dado já gravado.
--
-- `saida_combustivel_pct` é PERCENTUAL, não litro: no pátio se lê o
-- ponteiro do painel, não se mede tanque. Litro é assunto do Hub
-- Combustível (§11, onda 73), que é outra coisa.
--
-- ---------------------------------------------------------------------
-- 3. RLS — PEGA CARONA NA ÁREA `diario`
-- ---------------------------------------------------------------------
-- Movimento de pátio É registro de saída e retorno da unidade, ou seja, a
-- mesma natureza do Diário de Bordo — e o preset `operacional` (e o
-- `OPERACOES` do Enterprise) já dá `diario: editar` a quem opera o barco.
-- Criar uma área nova na matriz de 15 obrigaria a migrar o jsonb de todo
-- vínculo existente pra que ninguém perdesse acesso; pegando carona,
-- quem já registra saída já registra check-out, sem migração de dado.
--
-- `movimentos_patio_uma_saida_aberta` é índice ÚNICO PARCIAL: impede que
-- a mesma unidade tenha duas saídas abertas. Sem ele, dois toques no
-- botão (ou dois funcionários no mesmo Jet) criariam duas saídas, e a
-- comparação do retorno não saberia com qual casar.
-- =====================================================================

-- Ver o cabeçalho: `add value` fica isolado.
alter type public.tipo_embarcacao add value 'jet';

create table public.movimentos_patio (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  -- `set null` e não `cascade`: funcionário que sai da empresa não apaga o
  -- histórico de movimentação da frota (mesma regra da auditoria, §22).
  responsavel_id uuid references public.profiles(id) on delete set null,

  -- CHECK-OUT (§6)
  saida_em timestamptz not null default now(),
  saida_horas numeric,
  saida_combustivel_pct int check (saida_combustivel_pct between 0 and 100),
  saida_estado text,
  saida_foto_path text,

  -- CHECK-IN (§6) — tudo nulo enquanto a unidade está fora.
  retorno_em timestamptz,
  retorno_horas numeric,
  retorno_combustivel_pct int check (retorno_combustivel_pct between 0 and 100),
  retorno_estado text,
  retorno_foto_path text,
  -- Quem devolve pode não ser quem tirou.
  retorno_responsavel_id uuid references public.profiles(id) on delete set null,

  -- §6: "Se houver problema no retorno, permitir transformar imediatamente
  -- em avaria." A ocorrência criada fica ligada ao movimento que a originou,
  -- pra ficha da avaria poder dizer de onde veio.
  ocorrencia_id uuid references public.ocorrencias(id) on delete set null,

  -- §3, régua de aprovação. `true` por padrão porque check-in/out NÃO são
  -- ações críticas (ver `ACOES_ENTERPRISE` em enterprise.ts): travar o pátio
  -- esperando ADM pra soltar um Jet é a fricção que o §6 manda evitar. Quem
  -- estiver no modo "tudo exige aprovação" grava `false` e o ADM confirma.
  aprovado boolean not null default true,
  aprovado_por uuid references public.profiles(id) on delete set null,
  aprovado_em timestamptz,

  criado_em timestamptz not null default now(),

  constraint movimentos_patio_retorno_depois_da_saida
    check (retorno_em is null or retorno_em >= saida_em),
  constraint movimentos_patio_horimetro_nao_anda_pra_tras
    check (retorno_horas is null or saida_horas is null or retorno_horas >= saida_horas)
);

create index movimentos_patio_embarcacao_idx
  on public.movimentos_patio (embarcacao_id, saida_em desc);

-- Ver o cabeçalho: uma saída aberta por unidade, garantido pelo banco.
create unique index movimentos_patio_uma_saida_aberta
  on public.movimentos_patio (embarcacao_id) where retorno_em is null;

alter table public.movimentos_patio enable row level security;

create policy "movimentos_patio: quem ve o diario le" on public.movimentos_patio
  for select to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'ver'));

create policy "movimentos_patio: quem edita o diario registra" on public.movimentos_patio
  for insert to authenticated
  with check (public.permissao(embarcacao_id, 'diario', 'editar'));

-- Sem policy de `delete`, de propósito: movimento errado se corrige pelo
-- retorno e pela avaria, não apagando a passagem da unidade pelo pátio.
create policy "movimentos_patio: quem edita o diario fecha" on public.movimentos_patio
  for update to authenticated
  using (public.permissao(embarcacao_id, 'diario', 'editar'))
  with check (public.permissao(embarcacao_id, 'diario', 'editar'));

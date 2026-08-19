-- =====================================================================
-- Onda 74 · FINANCEIRO ENTERPRISE — de onde cada custo veio.
-- PRD-UPGRADE-3-COTAS §12.
--
-- ---------------------------------------------------------------------
-- POR QUE NÃO EXISTE UM LIVRO-CAIXA NOVO
-- ---------------------------------------------------------------------
-- O Commander já tem `lancamentos_financeiros` desde a onda 42, com
-- categorias, status pago/pendente, recorrentes e relatórios. Criar um
-- "financeiro_enterprise" ao lado daria DUAS respostas pra "quanto esta
-- unidade custou" — e o §12 pede consolidado por frota E individual por
-- unidade, o que exige uma resposta só.
--
-- Então esta migration é uma coluna, não uma tabela: o que faltava não era
-- onde guardar dinheiro, era saber QUEM GEROU o lançamento.
--
-- ---------------------------------------------------------------------
-- `origem` — a tabela do §12 virou um check de seis valores
-- ---------------------------------------------------------------------
-- O §12 lista "Origem → Entrada automática no Financeiro": Combustível,
-- Mecânica (serviço confirmado pelo ADM), Estoque (materiais consumidos),
-- Avaria, Documentação e Manual ("exceções e despesas não cobertas").
--
-- Nulo é permitido de propósito: todo lançamento que já existe no banco
-- nasceu antes desta coluna, e marcá-los em massa como 'manual' seria
-- inventar procedência. Sem origem = "lançado antes de o app perguntar".
--
-- ---------------------------------------------------------------------
-- `lancamentos_uma_entrada_por_origem` — a trava contra custo dobrado
-- ---------------------------------------------------------------------
-- Índice ÚNICO PARCIAL sobre (origem, origem_id). Ele garante que a mesma
-- retirada de estoque, o mesmo serviço de mecânica ou o mesmo
-- abastecimento não vire dois lançamentos — o que aconteceria com um duplo
-- clique, um retry de rede, ou o mesmo serviço sendo confirmado duas vezes
-- pelo ADM.
--
-- É importante entender o que ele NÃO resolve: a duplicidade que o §12
-- descreve na última linha ("perguntar se peças já estão incluídas no
-- valor") é outra coisa — são dois lançamentos LEGÍTIMOS, um do estoque e
-- um da oficina, que por acidente cobrem a mesma peça. Índice nenhum pega
-- isso, porque as duas linhas são diferentes e ambas corretas. Quem trata
-- essa é `avisoDeDuplicidade` (lib/domain/financeiro-frota.ts), que
-- pergunta ao ADM em vez de adivinhar.
--
-- `where origem_id is not null` para o índice não colidir nos lançamentos
-- manuais, que não têm registro de origem nenhum.
-- =====================================================================

alter table public.lancamentos_financeiros
  add column origem text check (origem in (
    'combustivel','mecanica','estoque','avaria','documentacao','manual'
  )),
  -- A linha que gerou o custo: a retirada de estoque, o serviço, o
  -- abastecimento. Nulo em lançamento manual — não há o que apontar.
  add column origem_id uuid;

-- O consolidado do §12 filtra por unidade + origem no período.
create index lancamentos_origem_idx
  on public.lancamentos_financeiros (embarcacao_id, origem, data desc)
  where origem is not null;

-- Ver o cabeçalho: trava contra o MESMO fato virar dois custos.
create unique index lancamentos_uma_entrada_por_origem
  on public.lancamentos_financeiros (origem, origem_id)
  where origem_id is not null;

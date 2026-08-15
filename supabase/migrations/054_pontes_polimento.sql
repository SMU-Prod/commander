-- =====================================================================
-- Onda 53 · AS PONTES QUE FICARAM COMO TODO ENTRE OS MÓDULOS
-- PRD FINAL (docs/prd/upgrade2-master-final.txt) §11.6 + §9.1.
--
-- Uma ponte só precisa de banco: "Após confirmação bilateral, liberar
-- avaliação e oferecer 'Adicionar ao Financeiro'" (§11.6). A avaliação já
-- nasceu na migration 050; o lançamento nasce aqui.
--
-- As outras pontas desta onda (notificações de Agenda/Marketplace/
-- Financeiro, visão consolidada do Commander Pro, §24) são leitura e tela:
-- não pedem nem coluna nem policy nova, e por isso não estão neste arquivo.
--
-- ---------------------------------------------------------------------
-- DE QUE LADO O LANÇAMENTO NASCE, E POR QUÊ
-- ---------------------------------------------------------------------
-- Do lado do CLIENTE — quem publicou a demanda (`negocios.cliente_id`,
-- que é sempre `demandas.autor_id`). Três razões, na ordem em que pesam:
--
--  1. `lancamentos_financeiros.embarcacao_id` é NOT NULL, e o Financeiro é
--     da EMBARCAÇÃO (§9.1). O Commander Partner não tem embarcação — do
--     lado dele o lançamento não teria onde pousar. Criar uma segunda
--     tabela "financeiro do parceiro" seria inventar módulo que o PRD não
--     pediu (§26 empurra o que é do Partner pro Upgrade 3).
--  2. Os cinco tipos de demanda do §11.1 são todos o dono GASTANDO
--     (preciso de profissional / de tripulação / compro / vaga / caminhão).
--     Então o lançamento é sempre DESPESA, nunca entrada — e a categoria
--     sai do tipo da demanda (`categoriaFinanceiraDaDemanda`, em
--     web/lib/domain/financeiro.ts).
--  3. §9.1: "a ação cria o mesmo lançamento central, não uma cópia". O
--     central é `lancamentos_financeiros`. Por isso aqui não nasce tabela
--     nenhuma: nasce uma COLUNA de origem, exatamente como `evento_id`
--     (Diário) e `carteira_movimento_id` (Carteira) já fazem.
--
-- ---------------------------------------------------------------------
-- E POR QUE A TRAVA É DO BANCO, NÃO DA TELA
-- ---------------------------------------------------------------------
-- §9.1: "Orçamento/proposta não é despesa. Somente gasto efetivado/
-- confirmado pode ser registrado como despesa." Se essa regra morasse só
-- no React, um POST direto transformaria proposta em despesa e o número
-- do relatório mentiria. Mesma decisão da migration 050, que colocou a
-- confirmação bilateral na RLS da avaliação em vez de num `if` da tela —
-- e por isso este arquivo REUSA a `public.negocio_confirmado()` de lá:
-- duas cópias da mesma regra é a receita pra elas divergirem.
-- =====================================================================

-- 1) A COLUNA DE ORIGEM ------------------------------------------------
--    `on delete set null` pelo mesmo motivo de `evento_id`: apagar o
--    registro comercial não pode apagar o dinheiro que saiu de verdade da
--    conta. O lançamento sobrevive órfão, como qualquer despesa avulsa.
alter table public.lancamentos_financeiros
  add column if not exists negocio_id uuid references public.negocios(id) on delete set null;

comment on column public.lancamentos_financeiros.negocio_id is
  'Negócio do Marketplace confirmado bilateralmente que originou este lançamento (PRD §11.6, "Adicionar ao Financeiro"). Índice único: o mesmo negócio nunca vira dois lançamentos, por mais vezes que a pessoa clique.';

-- O segundo clique esbarra AQUI, não numa checagem da tela que uma aba
-- duplicada venceria. Idêntico ao `idx_lancamentos_evento_unico` da 042.
create unique index if not exists idx_lancamentos_negocio_unico
  on public.lancamentos_financeiros (negocio_id) where negocio_id is not null;

-- 2) A GUARDA ----------------------------------------------------------
--    Só roda quando `negocio_id` está preenchido: lançamento avulso,
--    vindo do Diário ou vindo da Carteira passa reto, sem custo nenhum.
--
--    No INSERT, duas perguntas:
--      · o negócio está confirmado pelos DOIS lados? (§9.1/§11.6)
--      · quem está lançando é o cliente daquele negócio?
--    A segunda existe porque o fornecedor não tem Financeiro de embarcação
--    (ver cabeçalho) e porque um terceiro com `gastos:editar` em outro
--    barco não pode pendurar o negócio alheio na conta dele.
--
--    No UPDATE, a origem é IMUTÁVEL e nada mais é checado — senão o
--    tripulante com `gastos:editar` não conseguiria nem marcar a despesa
--    como paga (ele não é o cliente do negócio, e não precisa ser).
create or replace function public.lancamento_de_negocio_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cliente uuid;
begin
  if tg_op = 'UPDATE' then
    if new.negocio_id is distinct from old.negocio_id then
      raise exception 'origem_do_lancamento_e_imutavel';
    end if;
    return new;
  end if;

  if new.negocio_id is null then
    return new;
  end if;

  if not public.negocio_confirmado(new.negocio_id) then
    raise exception 'negocio_nao_confirmado';
  end if;

  select n.cliente_id into v_cliente from public.negocios n where n.id = new.negocio_id;
  if v_cliente is null or auth.uid() is distinct from v_cliente then
    raise exception 'so_o_cliente_lanca_o_negocio';
  end if;

  return new;
end $$;

drop trigger if exists lancamentos_negocio_guarda on public.lancamentos_financeiros;
create trigger lancamentos_negocio_guarda
  before insert or update on public.lancamentos_financeiros
  for each row execute function public.lancamento_de_negocio_guarda();

-- Ninguém chama a guarda direto — ela só existe pendurada no trigger.
revoke execute on function public.lancamento_de_negocio_guarda() from public, anon, authenticated;

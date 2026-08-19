-- ============================================================================
-- 074 — O solicitante do Commander Gold leva o PRÓPRIO pedido até o pagamento
-- ============================================================================
-- FECHA: A-04 de docs/auditoria/2026-08-19-asaas-cobranca.md (P0)
--
-- O PROBLEMA
-- ----------
-- `criarSolicitacaoGold` (web/lib/acoes/gold.ts) grava a linha em
-- `gold_solicitacoes` — que nasce em `estado = 'solicitado'` — e em seguida
-- chama a RPC `gold_definir_estado(id, 'aguardando_pagamento')` com a SESSÃO
-- DO USUÁRIO. Na definição viva da RPC, `aguardando_pagamento` não tem ramo
-- próprio: cai no `else`, que exige `tem_papel_admin('suporte')`.
--
-- Resultado medido: todo pedido de Gold de cliente comum grava a linha, a RPC
-- levanta `sem_permissao`, e a tela mostra *"Pedido registrado, mas não foi
-- possível avançar pro pagamento. Recarregue e tente de novo."* Recarregar
-- nunca resolve — é muro de permissão, não erro transitório. E como
-- `iniciarPagamentoGold` só aceita `estado = 'aguardando_pagamento'`, o pedido
-- morre em `solicitado` para sempre. O Commander Gold é INVENDÁVEL hoje, e
-- isso não tem nada a ver com o Asaas: mesmo com a chave de API ligada, o
-- fluxo continuaria travado exatamente aqui.
--
-- POR QUE ESTA CORREÇÃO E NÃO OUTRA
-- ---------------------------------
-- Havia dois caminhos. (a) Fazer a solicitação NASCER em
-- `aguardando_pagamento`, mexendo no `default` da coluna ou no INSERT do app.
-- (b) Deixar a RPC aceitar o próprio solicitante nesta transição.
--
-- Escolhido (b), por três motivos:
--   · o estado `solicitado` existe e é lido pela tela
--     (`DESCRICAO_ESTADO_SOLICITACAO`, lib/domain/gold.ts); apagá-lo de fato
--     seria mudar a máquina de estados publicada, não consertar um bug;
--   · a autoridade de transição fica num lugar só — a RPC —, que é a regra
--     que o repositório já escolheu ("nunca um `.update()` direto", comentário
--     no topo de lib/acoes/gold.ts). Um `default` diferente espalharia a
--     máquina de estados por dois lugares;
--   · o INSERT do app não pode escolher o estado de qualquer jeito: NÃO existe
--     policy de UPDATE em `gold_solicitacoes` (conferido), e é essa ausência
--     que garante que o cliente não se promova sozinho. Manter a transição na
--     RPC preserva essa garantia.
--
-- O QUE ESTA MIGRATION **NÃO** ABRE — a parte que importa
-- ------------------------------------------------------
-- O ramo novo é o mais estreito possível e exige as QUATRO condições juntas:
--   1. o estado atual é exatamente `solicitado`;
--   2. o estado novo é exatamente `aguardando_pagamento`;
--   3. quem chama é o `solicitante_id` da própria linha;
--   4. `gold_transicao_valida('solicitado','aguardando_pagamento')` continua
--      sendo consultada logo abaixo, como para todos os outros estados.
--
-- A condição 1 é redundante com a 4 (a máquina de estados viva só admite
-- `solicitado → aguardando_pagamento`), e está escrita mesmo assim: se um dia
-- alguém acrescentar outra origem para `aguardando_pagamento` em
-- `gold_transicao_valida`, esta função NÃO passa a conceder essa origem nova
-- ao cliente por tabela. Trava explícita vale mais que trava por coincidência.
--
-- Continuam exigindo Suporte, sem exceção: `pago`, `aguardando_agendamento`,
-- `agendado`, `em_analise`, `aprovado`, `reprovado` — ou seja, tudo que vale
-- dinheiro ou vira selo. `avaliacao_realizada` continua com consultor/
-- vistoriador, `cancelado` continua com solicitante/PROP/Suporte. Nada mais
-- mudou: o corpo abaixo é a definição VIVA lida com `pg_get_functiondef` em
-- 19/08/2026, com o único acréscimo do `elsif`.
--
-- QUEM GANHA / QUEM PERDE — conferido no banco em 19/08/2026
-- ----------------------------------------------------------
--   gold_solicitacoes = 0 linhas (0 abertas). gold_pagamentos = 0.
-- Portanto: ZERO linhas mudam de comportamento hoje, ninguém perde acesso a
-- nada, e a única diferença é que o PRÓXIMO pedido de Gold consegue chegar à
-- tela de pagamento em vez de morrer com "recarregue e tente de novo".
--
-- Idempotente: `create or replace`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

create or replace function public.gold_definir_estado(
  p_solicitacao_id uuid, p_novo_estado text, p_observacao text default null::text
)
returns public.gold_solicitacoes
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atual text;
  v_embarcacao_id uuid;
  v_pode boolean;
  v_row public.gold_solicitacoes;
  v_avaliacao public.gold_avaliacoes;
  v_prop_id uuid;
  v_validade_ate date;
  v_selo_id uuid;
begin
  select estado, embarcacao_id into v_atual, v_embarcacao_id
    from public.gold_solicitacoes where id = p_solicitacao_id for update;
  if v_atual is null then
    raise exception 'solicitacao_nao_encontrada';
  end if;

  if p_novo_estado = 'cancelado' then
    v_pode := public.tem_papel_admin('suporte') or exists (
      select 1 from public.gold_solicitacoes s where s.id = p_solicitacao_id
        and (s.solicitante_id = auth.uid() or (s.embarcacao_id is not null and public.eh_prop(s.embarcacao_id)))
    );
  elsif p_novo_estado = 'avaliacao_realizada' then
    v_pode := public.tem_papel_admin('suporte')
      or public.gold_consultor_atribuido(p_solicitacao_id)
      or public.vistoriador_ve_solicitacao(p_solicitacao_id);
  elsif p_novo_estado = 'aguardando_pagamento' then
    -- A-04: o próprio solicitante leva o PRÓPRIO pedido de `solicitado` para
    -- `aguardando_pagamento`, e SÓ essa transição. Sem isto o Gold não vende.
    -- `v_atual = 'solicitado'` é trava explícita, não decoração — ver cabeçalho.
    v_pode := public.tem_papel_admin('suporte') or (
      v_atual = 'solicitado' and exists (
        select 1 from public.gold_solicitacoes s
        where s.id = p_solicitacao_id and s.solicitante_id = auth.uid()
      )
    );
  else
    v_pode := public.tem_papel_admin('suporte');
  end if;
  if not v_pode then
    raise exception 'sem_permissao';
  end if;

  if not public.gold_transicao_valida(v_atual, p_novo_estado) then
    raise exception 'transicao_invalida_%_%', v_atual, p_novo_estado;
  end if;

  if p_novo_estado = 'aprovado' then
    select * into v_avaliacao from public.gold_avaliacoes where solicitacao_id = p_solicitacao_id;
    if v_avaliacao.id is null or v_avaliacao.data_avaliacao is null or v_avaliacao.validade_meses is null then
      raise exception 'avaliacao_incompleta';
    end if;

    if v_embarcacao_id is not null then
      v_validade_ate := (v_avaliacao.data_avaliacao + (v_avaliacao.validade_meses || ' months')::interval)::date;

      insert into public.gold_selos (
        embarcacao_id, solicitacao_id, avaliacao_id, consultor_id,
        data_avaliacao, validade_meses, validade_ate, versao_protocolo
      ) values (
        v_embarcacao_id, p_solicitacao_id, v_avaliacao.id, v_avaliacao.consultor_id,
        v_avaliacao.data_avaliacao, v_avaliacao.validade_meses, v_validade_ate, v_avaliacao.versao_protocolo
      )
      on conflict (embarcacao_id) do update set
        solicitacao_id = excluded.solicitacao_id,
        avaliacao_id = excluded.avaliacao_id,
        consultor_id = excluded.consultor_id,
        data_avaliacao = excluded.data_avaliacao,
        validade_meses = excluded.validade_meses,
        validade_ate = excluded.validade_ate,
        versao_protocolo = excluded.versao_protocolo,
        atualizado_em = now()
      returning id into v_selo_id;

      select usuario_id into v_prop_id from public.vinculos
        where embarcacao_id = v_embarcacao_id and papel = 'PROP' limit 1;
      if v_prop_id is not null then
        insert into public.premium_concessoes (usuario_id, origem, origem_id, valido_ate)
        values (v_prop_id, 'gold', p_solicitacao_id, v_validade_ate);
      end if;
    end if;
  end if;

  update public.gold_solicitacoes
    set estado = p_novo_estado, atualizado_em = now()
    where id = p_solicitacao_id
    returning * into v_row;

  return v_row;
end;
$function$;

-- Os grants não mudam (a função já era executável por `authenticated`), mas
-- ficam explícitos: `create or replace` preserva o ACL, e reafirmar aqui evita
-- que uma reaplicação num banco novo nasça com EXECUTE para PUBLIC/anon.
revoke all on function public.gold_definir_estado(uuid, text, text) from public, anon;
grant execute on function public.gold_definir_estado(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A função conhece o ramo novo — tem de voltar 1:
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname='gold_definir_estado'
--    and pg_get_functiondef(p.oid) like '%elsif p_novo_estado = ''aguardando_pagamento''%';
--
-- 2) Continua DEFINER com search_path fixo — tem de voltar 1:
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname='gold_definir_estado'
--    and p.prosecdef and array_to_string(p.proconfig, ',') like '%search_path%';
--
-- 3) A máquina de estados NÃO foi alterada — tem de voltar exatamente
--    {aguardando_pagamento,cancelado} e nada mais:
-- select public.gold_transicao_valida('solicitado','aguardando_pagamento') as deve_ser_true,
--        public.gold_transicao_valida('solicitado','pago')                 as deve_ser_false,
--        public.gold_transicao_valida('aguardando_pagamento','pago')       as deve_ser_true;
--
-- 4) Ninguém foi promovido por engano — tem de voltar 0 (não há solicitação):
-- select count(*) from public.gold_solicitacoes where estado <> 'solicitado';

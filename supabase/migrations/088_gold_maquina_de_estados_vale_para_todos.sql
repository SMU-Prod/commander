-- ============================================================================
-- 088 — A máquina de estados do Gold deixa de ser um acordo de cavalheiros
-- ============================================================================
-- FECHA: o A-12 de docs/auditoria/2026-08-19-asaas-cobranca.md, no ponto em que
--        ele ainda está aberto de verdade.
--
-- O QUE JÁ FOI DECIDIDO, E ONDE
-- -----------------------------
-- O A-12 pedia uma decisão: ou a função do banco passa a aceitar o salto
-- `aguardando_pagamento → aguardando_agendamento`, ou o webhook para de saltar.
-- A decisão foi tomada na ONDA 85 e está escrita, com os três motivos, em
-- `web/app/api/asaas/webhook/route.ts:277-345`: **o banco é a definição
-- verdadeira, e o webhook cedeu.** Ele passou a dar os dois passos
-- (`aguardando_pagamento → pago`, depois `pago → aguardando_agendamento`), cada
-- um com o estado de origem no `where`.
--
-- Conferido vivo, hoje, em `pg_get_functiondef`: `gold_transicao_valida`
-- continua dizendo `when 'aguardando_pagamento' then p_novo in ('pago',
-- 'cancelado')`. As três vozes (banco, `TRANSICOES` em `lib/domain/gold.ts`, e
-- o webhook) agora dizem a mesma coisa. Esta migration não reabre essa decisão.
--
-- O QUE CONTINUA ABERTO
-- ---------------------
-- A definição verdadeira não é APLICADA. Ela é obedecida.
--
-- `gold_transicao_valida` só é consultada de um lugar: de dentro de
-- `gold_definir_estado` (verificado — é a única função do esquema `public` cujo
-- corpo a menciona). E `gold_solicitacoes` **não tem trigger nenhum**
-- (`pg_trigger`, conferido) nem policy de UPDATE (`pg_policies`, conferido).
--
-- Isso quer dizer que a máquina de estados vale para quem escolhe passar pela
-- RPC. Quem escreve com a chave de serviço passa por cima dela sem nem sabê-la
-- existente — e o webhook, que é exatamente esse caso, foi o que aconteceu:
-- durante meses ele fez uma transição que a definição verdadeira proibia, e
-- nada no sistema teve como notar. Não foi um bug difícil; foi um bug INVISÍVEL.
-- Só uma auditoria linha a linha o encontrou.
--
-- Enquanto a regra for uma convenção, o próximo caminho que escrever nesta
-- tabela com a chave de serviço vai poder repetir a mesma divergência, pelo
-- mesmo motivo: não há nada para ele esbarrar. "Fazer sobrar uma definição" só
-- termina quando a que sobra é a que o banco EXECUTA.
--
-- O QUE ESTA MIGRATION FAZ
-- ------------------------
-- Um `BEFORE UPDATE` em `gold_solicitacoes` que, quando `estado` muda, chama
-- `gold_transicao_valida(OLD.estado, NEW.estado)` e recusa se ela disser não.
-- Nenhuma regra nova é inventada: a lista de transições continua vivendo num
-- lugar só, e este arquivo apenas a coloca no caminho de todo mundo.
--
-- A REGRA VALE PARA A CHAVE DE SERVIÇO TAMBÉM — É O PONTO
-- -------------------------------------------------------
-- A 087, ao lado, isenta a chave de serviço de propósito, porque lá o servidor
-- é a AUTORIDADE (só ele sabe que o gateway aceitou a troca de plano). Aqui é o
-- oposto, e a diferença é a lição inteira do A-12: o webhook não é autoridade
-- sobre a ORDEM do funil. Ele sabe uma coisa só — que o dinheiro entrou — e a
-- máquina de estados é quem diz o que essa notícia significa. Isentá-lo aqui
-- seria recriar o buraco no mesmo arquivo que o fecha.
--
-- Nada legítimo quebra, e isto foi verificado caminho a caminho:
--   · `gold_definir_estado` — já valida com a MESMA função antes de escrever;
--     o trigger só reconfirma (a função é IMMUTABLE, custo desprezível);
--   · o webhook, passos 1 e 2 (`route.ts:389-410`) — `aguardando_pagamento →
--     pago` e `pago → aguardando_agendamento`, as duas válidas;
--   · `gold_definir_regiao` — escreve `regiao_id`, não `estado`; cai no
--     `OLD.estado = NEW.estado` e passa sem avaliar nada;
--   · qualquer outro `update` da tabela (`atualizado_em`, campos da embarcação
--     externa) — idem.
--   · o INSERT não é tocado: quem cuida do estado inicial é a 085.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- Ela tira do dono a possibilidade de consertar um estado à mão com um `update`
-- solto. Isso é real e é o preço da correção — vale medir o preço direito:
--
--   · Todo conserto LEGÍTIMO continua possível, porque conserto legítimo é
--     transição válida, e o Suporte já pode fazer todas elas pela RPC
--     (`gold_definir_estado` autoriza o Suporte em qualquer transição da
--     máquina). O caso concreto que o próprio webhook prevê — a solicitação
--     ficar parada em `pago` porque o processo morreu entre os dois passos —
--     é `pago → aguardando_agendamento`, que é válida. Não precisa de válvula.
--   · O que deixa de ser possível é o salto ARBITRÁRIO: voltar de `agendado`
--     para `solicitado`, ressuscitar um `cancelado`. Isso hoje é possível e
--     nunca foi uma operação de produto — é a mesma coisa que a RPC recusa
--     desde a 033.
--   · Se ainda assim for preciso (migração de dados, correção de um estrago),
--     a válvula existe, é explícita e está na REVERSÃO: desligar o trigger
--     dentro da transação do conserto e religá-lo. Deliberado, visível no SQL,
--     e sem GUC mágico que alguém possa deixar ligado sem querer.
--
-- O outro perigo é o de sempre com trigger: o `create` que não pega deixa tudo
-- passando, em silêncio. Daí o bloco `do $$` no fim, que reconta o catálogo,
-- confere que o trigger aponta para a função deste arquivo, e — porque aqui dá
-- para provar de verdade — EXERCITA a regra: pergunta à
-- `gold_transicao_valida` as três respostas que definem o A-12 e levanta
-- exceção se alguma tiver mudado.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   gold_solicitacoes ..................................... 0 linhas
--   gold_solicitacoes em 'aguardando_agendamento' ......... 0 linhas
--   gold_pagamentos ....................................... 0 linhas
--   triggers em gold_solicitacoes hoje .................... 0
-- ZERO linhas existentes são tocadas. Nenhuma transição é revalidada
-- retroativamente: o trigger só olha os `update` que vierem depois dele.
--
-- Idempotente: `create or replace function` + `drop trigger if exists`.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A função do trigger
-- ---------------------------------------------------------------------------
-- Não inventa regra: delega inteirinha a `gold_transicao_valida`, que continua
-- sendo o único lugar onde a lista de transições existe. Se um dia a lista
-- mudar, muda lá, e este arquivo obedece sem ser editado — que é o que "uma
-- definição só" tem de querer dizer.
--
-- NÃO é `security definer`: não lê tabela nenhuma, só chama uma função
-- IMMUTABLE. `search_path` fixo pela regra da casa.
create or replace function public.gold_estado_respeita_maquina()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- `is not distinct from` cobre o caso de `estado` ser NULL dos dois lados.
  -- A coluna é NOT NULL hoje, mas escrever a comparação torta aqui seria
  -- reintroduzir, num arquivo sobre rigor, a mesma classe de descuido.
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if not public.gold_transicao_valida(old.estado, new.estado) then
    raise exception 'transicao_invalida_%_%', old.estado, new.estado;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- O trigger
-- ---------------------------------------------------------------------------
-- A mensagem de erro é IDÊNTICA à que `gold_definir_estado` já levanta
-- (`transicao_invalida_%_%`), de propósito: quem for depurar não precisa
-- descobrir que existem dois lugares que recusam: a recusa fala a mesma língua
-- venha de onde vier.
drop trigger if exists gold_solicitacoes_estado_valido on public.gold_solicitacoes;

create trigger gold_solicitacoes_estado_valido
  before update on public.gold_solicitacoes
  for each row execute function public.gold_estado_respeita_maquina();

-- ---------------------------------------------------------------------------
-- TRAVA — o trigger tem de estar ligado E a máquina tem de dizer o que se espera
-- ---------------------------------------------------------------------------
do $$
declare
  v_trigger int;
begin
  -- (i) o trigger existe e chama a função desta migration.
  select count(*) into v_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public'
     and c.relname = 'gold_solicitacoes'
     and t.tgname = 'gold_solicitacoes_estado_valido'
     and not t.tgisinternal
     and p.proname = 'gold_estado_respeita_maquina';
  if v_trigger <> 1 then
    raise exception
      'ABORTADO: o trigger gold_solicitacoes_estado_valido nao ficou ligado a funcao gold_estado_respeita_maquina (encontrados: %).',
      v_trigger;
  end if;

  -- (ii) a máquina de estados tem de ser a que o A-12 declarou verdadeira. Se
  --      alguém tiver alargado `gold_transicao_valida` para aceitar o salto —
  --      isto é, tiver tomado a decisão OPOSTA à da onda 85 — este trigger
  --      passaria a aplicar uma regra que o webhook não segue mais, e o
  --      resultado seria pior do que não ter trigger nenhum: duas definições,
  --      agora as duas com dentes.
  if not public.gold_transicao_valida('aguardando_pagamento', 'pago') then
    raise exception
      'ABORTADO: gold_transicao_valida nao aceita aguardando_pagamento -> pago. A maquina de estados viva nao e a que este trigger espera.';
  end if;
  if not public.gold_transicao_valida('pago', 'aguardando_agendamento') then
    raise exception
      'ABORTADO: gold_transicao_valida nao aceita pago -> aguardando_agendamento. O caminho do webhook (passo 2) ficaria trancado por este trigger.';
  end if;
  if public.gold_transicao_valida('aguardando_pagamento', 'aguardando_agendamento') then
    raise exception
      'ABORTADO: gold_transicao_valida PASSOU a aceitar o salto aguardando_pagamento -> aguardando_agendamento. Alguem decidiu o A-12 ao contrario da onda 85. Resolva a divergencia (web/app/api/asaas/webhook/route.ts:277-345) ANTES de aplicar este trigger.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) O trigger existe — tem de voltar 1 linha:
-- select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--  where c.relname = 'gold_solicitacoes' and not t.tgisinternal;
--
-- 2) A máquina de estados continua dizendo o que o A-12 declarou verdadeiro —
--    tem de voltar `true, true, false`:
-- select public.gold_transicao_valida('aguardando_pagamento','pago')     as deve_ser_true,
--        public.gold_transicao_valida('pago','aguardando_agendamento')   as deve_ser_true_2,
--        public.gold_transicao_valida('aguardando_pagamento','aguardando_agendamento')
--                                                                        as deve_ser_false;
--
-- 3) `gold_solicitacoes` continua SEM policy de UPDATE — o trigger é uma
--    segunda camada, não a substituta da primeira. Tem de voltar 0:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='gold_solicitacoes' and cmd='UPDATE';
--
-- 4) A regra tem dentes MESMO com a chave de serviço — é o ponto do arquivo.
--    Rode no SQL editor, com uma solicitação real em `solicitado`, e tem de DAR
--    ERRO `transicao_invalida_solicitado_aguardando_agendamento`:
-- -- update public.gold_solicitacoes set estado = 'aguardando_agendamento'
-- --  where estado = 'solicitado';
--    E o caminho legítimo tem de passar:
-- -- update public.gold_solicitacoes set estado = 'aguardando_pagamento'
-- --  where estado = 'solicitado';
--    (Rode os dois numa transação que você dá `rollback` no fim.)
--
-- 5) Teste de fumaça de ponta a ponta, com o Asaas em sandbox: pagar uma
--    avaliação e conferir que a solicitação chegou a `aguardando_agendamento`
--    PASSANDO por `pago`. Se o webhook devolver 500 com
--    `transicao_invalida_…`, o código voltou a saltar e o trigger o pegou —
--    que é exatamente o serviço que ele presta:
-- select estado, atualizado_em from public.gold_solicitacoes
--  order by atualizado_em desc limit 1;
-- select tipo, resultado, detalhe from public.asaas_eventos
--  order by recebido_em desc limit 5;
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE,
-- passo 24 — inclui a válvula para conserto manual de estado.

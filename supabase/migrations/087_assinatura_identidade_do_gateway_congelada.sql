-- ============================================================================
-- 087 — O UPDATE de `assinaturas` para de poder reescrever de quem é a conta
--       no gateway, e por quanto
-- ============================================================================
-- FECHA: o resíduo do A-10 de docs/auditoria/2026-08-19-asaas-cobranca.md.
--        A 079 amarrou o `asaas_subscription_id` no INSERT. Ninguém olhou o
--        UPDATE — e o UPDATE chega ao mesmo lugar por outra porta.
--
-- O PROBLEMA
-- ----------
-- A policy de UPDATE viva (`assinatura: cancelar a propria`, lida em
-- `pg_policies` em 19/08/2026) é:
--
--   using      (usuario_id = (select auth.uid()))
--   with check (usuario_id = (select auth.uid()) and status = 'cancelada')
--
-- Ela decide DUAS coisas: em qual linha se pode mexer (a sua) e em que status a
-- linha pode terminar (`cancelada`). Não decide nada sobre as outras cinco
-- colunas — e um `update` escreve quantas colunas quiser numa instrução só:
--
--   PATCH /rest/v1/assinaturas?id=eq.<a minha>
--   { "status": "cancelada", "asaas_subscription_id": "sub_DA_VITIMA" }
--
-- Passa nas duas condições. É a minha linha, e ela termina em `cancelada`.
--
-- POR QUE ISSO É O A-10 DE NOVO, E NÃO UM ACHADO NOVO
-- ---------------------------------------------------
-- O A-10 é "nada amarra o `asaas_subscription_id` a quem tem direito a ele". A
-- 079 amarrou no nascimento. Mas `assinaturas_asaas_subscription_id_key` é
-- UNIQUE (conferido em `pg_indexes`): o id do gateway é um recurso EXCLUSIVO da
-- tabela inteira, não da minha linha. Quem escreve esse id na própria linha
-- OCUPA o id — para todo mundo.
--
-- O estrago, na ordem:
--
--   1. eu cancelo a minha assinatura e, na mesma instrução, escrevo no campo o
--      `sub_…` de outra pessoa;
--   2. `cancelada` me tira do índice `assinaturas_uma_viva_idx`, então eu fico
--      livre para assinar de novo — nada me denuncia;
--   3. quando a vítima for assinar, o INSERT dela bate no UNIQUE e falha. Ela
--      não consegue contratar, e a tela dela diz "não foi possível registrar a
--      assinatura. Tente de novo" — para sempre, sem ninguém entender por quê;
--   4. e os eventos do Asaas dela chegam ao webhook, casam com a MINHA linha
--      cancelada, não aplicam nada (`cancelada` é terminal, e isso está certo)
--      e viram `sem_correspondencia` em `asaas_eventos` — o alarme do A-07
--      tocando por uma causa que ninguém vai adivinhar olhando o gateway.
--
-- Não há escalada de privilégio: eu não ganho o acesso da vítima. Eu tiro o
-- dela, e o rastro aponta para o lugar errado. Para uma cadeia de dinheiro,
-- negar a contratação de um cliente pagante é tão caro quanto liberar acesso de
-- graça — e bem mais difícil de diagnosticar.
--
-- `plano` e `valor_centavos` entram na mesma trava pelo mesmo motivo: quem pode
-- reescrever o valor da própria linha escreve o número que o financeiro vai
-- somar. `plano` ainda decide limite de embarcação e de tripulação dentro da
-- RLS, via `plano_do_usuario` (conferida viva: ela lê `assinaturas.plano` para
-- quem está em `ativa`/`problema_pagamento`).
--
-- POR QUE TRIGGER, E NÃO POLICY
-- -----------------------------
-- Não dá para fazer isto com RLS, e a razão é estrutural: o `WITH CHECK` de uma
-- policy enxerga a linha NOVA; o `USING` enxerga a VELHA. Nenhum dos dois
-- enxerga as duas ao mesmo tempo, e "esta coluna não pode MUDAR" é
-- necessariamente uma comparação entre as duas. Toda tentativa de escrever essa
-- regra como policy vira uma regra diferente e mais fraca.
--
-- Trigger `BEFORE UPDATE` compara `OLD` e `NEW` — é a ferramenta certa, e a
-- única.
--
-- QUEM A TRAVA NÃO ALCANÇA, DE PROPÓSITO
-- --------------------------------------
--   · `auth.uid() is null` — a chave de serviço e o SQL rodado à mão. Este NÃO
--     é um furo: é o desenho que o app já documenta e depende. `trocarPlano`
--     (`web/lib/acoes/assinatura.ts:237-241`) muda `plano` e `valor_centavos`
--     com `supabaseServico()` **exatamente porque** essa escrita não pode ser
--     do cliente — o comentário em `:194-200` diz isso com todas as letras:
--     "quem autoriza a troca é o GATEWAY ter aceitado a mudança de cobrança —
--     fato que só o servidor conhece". A trava aqui protege a porta do cliente
--     e deixa a do servidor como está.
--   · o Suporte (`tem_papel_admin('suporte')`), que é quem concilia à mão —
--     mesma isenção que a 078 já dá no Gold, pelo mesmo motivo.
--
-- Em resumo: depois desta migration, mudar a identidade de gateway de uma
-- assinatura passa a exigir ou o servidor, ou o Suporte. Nunca o navegador de
-- quem assinou.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- Um trigger BEFORE UPDATE bom demais TRANCA O CANCELAMENTO — e o cancelamento
-- é o único UPDATE que o cliente tem. Se a lista de colunas congeladas
-- incluísse `status`, `atualizado_em`, `problema_desde` ou `ultimo_evento_em`,
-- `cancelarAssinatura` (`web/lib/acoes/assinatura.ts:170-172`) passaria a
-- falhar, e o cliente ficaria preso numa assinatura que ele já cancelou no
-- gateway. Por isso a lista é EXPLÍCITA e curta: cinco colunas nomeadas uma a
-- uma, e o resto da linha continua livre como está hoje.
--
-- Conferido, coluna por coluna, contra a definição viva de `assinaturas`
-- (`information_schema.columns`, 11 colunas): as seis não congeladas são `id`
-- (chave), `status`, `criado_em`, `atualizado_em`, `problema_desde` e
-- `ultimo_evento_em` — e as quatro últimas são justamente as que o webhook e o
-- trigger `assinaturas_touch` escrevem.
--
-- O modo de falhar SILENCIOSO aqui é o `create trigger` que não pega: se o nome
-- divergir, fica um trigger órfão ao lado, ou nenhum, e o `update` continua
-- passando. Por isso o bloco `do $$` no fim RECONTA o catálogo e levanta
-- exceção — inclusive conferindo que o trigger aponta para a função certa, e
-- não para uma homônima antiga.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   assinaturas ....................................... 0 linhas
--   asaas_eventos ..................................... 0 linhas
-- ZERO linhas existentes são tocadas. Nenhum `update` deixa de funcionar hoje,
-- porque hoje não há o que atualizar — e quando houver, os dois caminhos reais
-- (cancelar pelo cliente, trocar plano pelo servidor) já estão do lado de fora
-- da trava, por construção.
--
-- Idempotente: `create or replace function` + `drop trigger if exists`.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A função do trigger
-- ---------------------------------------------------------------------------
-- NÃO é `security definer`, e é de propósito: ela não lê tabela nenhuma por
-- conta própria — só compara `OLD` com `NEW` e delega a pergunta de papel a
-- `tem_papel_admin`, que já é DEFINER e já tem `search_path` fixo. Rodar como
-- invocador é o privilégio mínimo aqui. O `search_path` vai fixo mesmo assim,
-- porque a regra da casa é que nenhuma função nomeie um objeto sem dizer de
-- qual esquema ele é.
create or replace function public.assinatura_congela_identidade()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- Sem sessão de usuário: chave de serviço (webhook, `trocarPlano`) ou SQL
  -- rodado à mão pelo dono. É o caminho do servidor — ver o cabeçalho.
  if v_uid is null then
    return new;
  end if;

  -- Suporte concilia à mão. Mesma isenção da 078 no Gold.
  if public.tem_papel_admin('suporte') then
    return new;
  end if;

  -- `is distinct from` e não `<>`: `<>` devolve NULL quando um dos lados é
  -- NULL, e um `if NULL` não entra no ramo. Com `<>`, trocar um valor por NULL
  -- passaria batido — que é exatamente o caso que interessa barrar.
  if new.usuario_id is distinct from old.usuario_id then
    raise exception 'assinatura: usuario_id nao pode ser alterado';
  end if;
  if new.asaas_customer_id is distinct from old.asaas_customer_id then
    raise exception 'assinatura: asaas_customer_id nao pode ser alterado';
  end if;
  if new.asaas_subscription_id is distinct from old.asaas_subscription_id then
    raise exception 'assinatura: asaas_subscription_id nao pode ser alterado';
  end if;
  if new.plano is distinct from old.plano then
    raise exception 'assinatura: plano so muda pelo servidor, depois de o gateway aceitar';
  end if;
  if new.valor_centavos is distinct from old.valor_centavos then
    raise exception 'assinatura: valor_centavos so muda pelo servidor, depois de o gateway aceitar';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- O trigger
-- ---------------------------------------------------------------------------
-- `assinaturas` já tem `assinaturas_touch` (BEFORE UPDATE, conferido em
-- `pg_trigger`). Dois BEFORE UPDATE na mesma tabela disparam em ordem
-- ALFABÉTICA do nome, e a ordem entre estes dois não importa: `assinaturas_touch`
-- mexe em `atualizado_em`/`problema_desde`, nenhuma das quais está congelada
-- aqui. O nome escolhido roda antes, o que só torna a recusa mais barata.
drop trigger if exists assinaturas_congela_identidade on public.assinaturas;

create trigger assinaturas_congela_identidade
  before update on public.assinaturas
  for each row execute function public.assinatura_congela_identidade();

-- ---------------------------------------------------------------------------
-- TRAVA — o trigger tem de existir E apontar para a função deste arquivo
-- ---------------------------------------------------------------------------
do $$
declare
  v_trigger int;
  v_func int;
begin
  -- (i) o trigger existe, é BEFORE UPDATE em `assinaturas`, e chama a função
  --     desta migration. Um `create trigger` que não pegou, ou um que ficou
  --     apontando para uma homônima antiga, deixa o `update` passando — e é
  --     um silêncio, não um erro.
  select count(*) into v_trigger
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
   where n.nspname = 'public'
     and c.relname = 'assinaturas'
     and t.tgname = 'assinaturas_congela_identidade'
     and not t.tgisinternal
     and p.proname = 'assinatura_congela_identidade';
  if v_trigger <> 1 then
    raise exception
      'ABORTADO: o trigger assinaturas_congela_identidade nao ficou ligado a funcao assinatura_congela_identidade (encontrados: %). Rode: select tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname=''assinaturas'' and not t.tgisinternal;',
      v_trigger;
  end if;

  -- (ii) a função congela as CINCO colunas. Se alguma sumir numa edição futura
  --      deste arquivo, a trava cai antes do commit em vez de a coluna ficar
  --      destravada sem ninguém notar.
  select count(*) into v_func
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'assinatura_congela_identidade'
     and pg_get_functiondef(p.oid) like '%usuario_id%'
     and pg_get_functiondef(p.oid) like '%asaas_customer_id%'
     and pg_get_functiondef(p.oid) like '%asaas_subscription_id%'
     and pg_get_functiondef(p.oid) like '%plano%'
     and pg_get_functiondef(p.oid) like '%valor_centavos%';
  if v_func <> 1 then
    raise exception
      'ABORTADO: assinatura_congela_identidade nao menciona as 5 colunas congeladas.';
  end if;

  -- (iii) `assinaturas_touch` continua vivo. Ele é quem carimba
  --       `atualizado_em` e `problema_desde`; perdê-lo por acidente quebraria a
  --       contagem de tolerância de `avaliarCiclo` em silêncio.
  if not exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'assinaturas'
       and t.tgname = 'assinaturas_touch' and not t.tgisinternal
  ) then
    raise exception
      'ABORTADO: o trigger assinaturas_touch sumiu. Ele NAO faz parte desta migration e tem de continuar vivo.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) `assinaturas` tem os DOIS triggers — tem de voltar 2 linhas:
-- select t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t
--   join pg_class c on c.oid = t.tgrelid
--  where c.relname = 'assinaturas' and not t.tgisinternal order by t.tgname;
--    Esperado: assinaturas_congela_identidade, assinaturas_touch.
--
-- 2) As policies de `assinaturas` continuam as MESMAS 4 — esta migration não
--    toca em nenhuma:
-- select policyname, cmd from pg_policies
--  where schemaname='public' and tablename='assinaturas' order by cmd;
--    Esperado: 1 INSERT, 2 SELECT, 1 UPDATE.
--
-- 3) A função não é DEFINER e tem `search_path` fixo — tem de voltar
--    `f | search_path=public`:
-- select p.prosecdef, array_to_string(p.proconfig, ',') from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public' and p.proname='assinatura_congela_identidade';
--
-- 4) A checagem global da casa continua verde (nenhuma função DEFINER sem
--    search_path) — tem de voltar 0:
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.prosecdef
--    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path%';
--
-- 5) Teste de fumaça, com login real, DEPOIS de existir uma assinatura:
--    · cancelar pela tela `/menu/assinatura` — tem de continuar funcionando
--      (é o UPDATE que o cliente tem, e ele não toca em coluna congelada);
--    · trocar de plano pela tela — tem de continuar funcionando (passa pela
--      chave de serviço, isenta por desenho);
--    · e o que TEM de falhar, rodado com o token de um usuário comum:
--      PATCH /rest/v1/assinaturas?id=eq.<a dele>
--      { "status": "cancelada", "asaas_subscription_id": "sub_outro" }
--      Esperado: erro `assinatura: asaas_subscription_id nao pode ser alterado`.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md, QUINTO LOTE,
-- passo 23.

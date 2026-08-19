-- ============================================================================
-- 077 — O link de cotista finalmente pode ser resgatado
-- ============================================================================
-- FECHA: P1-6 de docs/auditoria/2026-08-19-banco-e-rls.md
--        (deixado de fora do lote 067–073 por exigir decisão de desenho)
--
-- O PROBLEMA
-- ----------
-- `/cotistas` gera o link, `convites_cotista` guarda o código, a rota
-- `/convite-cotista/[codigo]` existe — e o ciclo não fecha, porque do lado do
-- banco falta o par que o convite de tripulação tem desde a migration 008
-- (`info_convite` + `aceitar_convite`):
--
--   · `convites_cotista` só é legível por `eh_prop(embarcacao_id)`. Quem
--     recebeu o link e ainda não faz parte da unidade não consegue nem ler o
--     nome dela — a tela não tem como dizer para onde o convite aponta;
--   · `vinculos` NÃO TEM policy de INSERT nenhuma (e isso está certo: é a
--     peça estrutural que impede alguém de se dar acesso a barco alheio).
--     Logo o cliente não consegue criar o próprio vínculo por fora, e não há
--     função `security definer` que crie por ele.
--
-- Resultado medido: 0 vínculos com papel `COTISTA`, 0 votos, 0 envios. O
-- módulo de cotas inteiro — vaga, suspensão, votação, envios, relatório —
-- depende de uma porta que nunca foi construída.
--
-- POR QUE DUAS FUNÇÕES, E ESPELHANDO A 008
-- ----------------------------------------
-- Separar LER de ACEITAR é o que permite a tela ser honesta antes do clique:
-- `info_convite_cotista` responde "de que unidade é este convite e ainda cabe
-- alguém?", e a tela mostra o nome e a recusa certa SEM escrever nada. Só o
-- botão chama `aceitar_convite_cotista`. Uma função só obrigaria a tela a
-- tentar entrar para descobrir que não podia — que é exatamente o gesto que
-- não se pode oferecer a quem chegou por um link do grupo do barco.
--
-- QUEM GANHA LEITURA, E O QUE EXATAMENTE
-- --------------------------------------
-- `info_convite_cotista` é executável por `anon` — a única função deste
-- repositório que abre algo para quem não tem conta, e por isso vale escrever
-- o que ela expõe e o que não expõe.
--
--   EXPÕE, e só para quem apresenta o código exato: o NOME da unidade e os
--   dois números da vaga (total e ocupadas).
--   NÃO EXPÕE: id da embarcação, quem são os cotistas, qualquer dado de
--   operação, financeiro, documento ou foto. Não há como listar convites nem
--   varrer códigos: a função só responde por igualdade em `codigo`, que é
--   único e tem 12 caracteres hexadecimais.
--
-- Por que anon e não só `authenticated`: sem isso a tela de convite não pode
-- dizer o nome da unidade ANTES do login, e quem recebeu o link é obrigado a
-- criar conta às cegas para descobrir do que se trata. É o mesmo defeito que
-- `info_convite` (migration 008) tem hoje — ela é só `authenticated`, e a
-- tela `/convite/[codigo]` fica muda para quem não entrou. Aqui a decisão é
-- consciente e o dado exposto é o mínimo.
--
-- Se o dono preferir NÃO abrir para anônimo, o ajuste é uma linha:
--   revoke execute on function public.info_convite_cotista(text) from anon;
-- e a tela passa a pedir login antes de nomear a unidade — sem quebrar nada.
--
-- AS TRÊS RECUSAS SÃO AS MESMAS DO DOMÍNIO
-- ----------------------------------------
-- `podeEntrarComLink` (web/lib/domain/cotistas.ts) já decide, com teste, entre
-- `ja_e_cotista`, `link_desativado` e `sem_vaga`. A função abaixo repete
-- exatamente essas três regras — a tela usa o domínio para não oferecer um
-- botão condenado, e o banco repete porque a action pode ser chamada direto.
-- Duas travas, uma regra.
--
-- ERRO COM CÓDIGO, NÃO COM FRASE
-- ------------------------------
-- `aceitar_convite` (008) levanta prosa acentuada ("convite inválido ou
-- expirado") e o app casa substring — que quebra quando alguém melhora o
-- texto. Aqui os erros são códigos: `nao_autenticado`, `convite_invalido`,
-- `ja_faz_parte`, `sem_vaga_de_cota`. A frase que a pessoa lê é do app.
--
-- A MATRIZ COM QUE O COTISTA NASCE
-- --------------------------------
-- Espelha `PRESET_ENTERPRISE.COTISTA` de web/lib/domain/enterprise.ts, que sai
-- do §13 ("Cotista visualiza a própria unidade; não administra a frota"):
-- `ver` em embarcação, motores, documentos, fotos e histórico; `editar` em
-- NADA, em nenhuma das 15 áreas. Sem esta matriz o vínculo nasceria com
-- `permissoes = null`, `permissao()` devolveria false para tudo, e o cotista
-- entraria numa unidade em que não enxerga nem a ficha — a funcionalidade
-- nasceria quebrada.
--
-- As duas cópias são vigiadas por teste: `MATRIZ_COTISTA_NO_BANCO`
-- (web/lib/domain/cotistas.ts) reproduz este JSON e o teste compara com o
-- preset. Mexer num lado sem o outro quebra `npm test`, de propósito.
--
-- CORRIDA DE VAGA
-- ---------------
-- O `for update` trava a LINHA DO CONVITE antes de contar as vagas. Como o
-- índice `convites_cotista_um_ativo_por_unidade` garante no máximo um convite
-- ativo por unidade, travar o convite serializa toda tentativa de entrada
-- naquela unidade — duas pessoas clicando ao mesmo tempo na última vaga não
-- passam as duas.
--
-- O QUE ESTA MIGRATION **NÃO** FAZ
-- --------------------------------
-- Não cria `expira_em` em `convites_cotista`. O código de cotista continua
-- valendo até alguém redefinir o link — a auditoria registra isso como
-- pendência e a validade é decisão de produto (o link é REUTILIZÁVEL por
-- desenho: dez cotistas entram pelo mesmo código, ao contrário do convite de
-- tripulação, que é de uso único). Colocar prazo aqui mudaria o produto sem
-- o dono ter decidido.
-- Também não mexe em `aceitar_convite` (008), que continua criando `CMDT`.
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
-- NINGUÉM. As duas funções não existiam (0 em `pg_proc`), nenhuma policy é
-- alterada, nenhuma linha é tocada. É acréscimo puro.
--
-- O que a base de hoje responde, para não haver surpresa no teste de fumaça:
--   convites_cotista = 1 linha, ativa;
--   a unidade desse convite tem `cotas_total = 0` (nenhuma das 9 embarcações
--   tem cota definida);
--   vínculos com papel COTISTA = 0.
-- Portanto, HOJE, `aceitar_convite_cotista` desse único código levanta
-- `sem_vaga_de_cota` — corretamente: unidade sem cota definida não é unidade
-- de cotas. Para o ciclo fechar de verdade, o ADM precisa antes definir as
-- cotas em `/cotistas` (`definirCotas`). A tela diz isso com todas as letras.
--
-- Idempotente: `create or replace`.
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Ler o convite sem entrar nele
-- ---------------------------------------------------------------------------
-- Zero linhas = código não existe. A tela trata isso como "não encontrado", e
-- NUNCA como "inválido": são coisas diferentes e a segunda acusa o portador.
create or replace function public.info_convite_cotista(p_codigo text)
returns table(
  nome_embarcacao text,
  valido boolean,
  vagas_total int,
  vagas_ocupadas int,
  -- As duas últimas falam do CHAMADOR, nunca de terceiros: para `anon` são
  -- sempre false. É o que a tela precisa para escolher entre "entrar",
  -- "abrir a unidade" e a frase de suspensão, sem uma segunda consulta que
  -- exigiria expor `embarcacao_id`.
  ja_faz_parte boolean,
  suspenso boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    e.nome,
    c.ativo,
    greatest(coalesce(e.cotas_total, 0), 0),
    (select count(*)::int from public.vinculos v
      where v.embarcacao_id = c.embarcacao_id and v.papel = 'COTISTA'),
    exists (select 1 from public.vinculos v
             where v.embarcacao_id = c.embarcacao_id and v.usuario_id = auth.uid()),
    exists (select 1 from public.vinculos v
             where v.embarcacao_id = c.embarcacao_id and v.usuario_id = auth.uid()
               and v.suspenso_em is not null)
  from public.convites_cotista c
  join public.embarcacoes e on e.id = c.embarcacao_id
  where c.codigo = p_codigo;
$function$;

-- Cotista suspenso continua OCUPANDO a vaga (a contagem acima não filtra
-- `suspenso_em`): §13 — suspender é cobrança, não é tirar o lugar da pessoa.
-- Quem libera vaga é o botão de REMOVER acesso, que apaga o vínculo.

revoke all on function public.info_convite_cotista(text) from public;
grant execute on function public.info_convite_cotista(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 · Entrar
-- ---------------------------------------------------------------------------
create or replace function public.aceitar_convite_cotista(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c record;
  v_total int;
  v_ocupadas int;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado';
  end if;

  -- `ativo` faz parte do filtro: link desativado não é encontrado, e o app
  -- consulta `info_convite_cotista` antes para saber diferenciar "código que
  -- não existe" de "link que o ADM redefiniu".
  select * into c from public.convites_cotista
    where codigo = p_codigo and ativo
    for update;
  if not found then
    raise exception 'convite_invalido';
  end if;

  -- Qualquer vínculo, não só COTISTA: o PROP que abre o próprio link para
  -- conferir não pode virar cotista da própria unidade.
  if exists (
    select 1 from public.vinculos
    where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()
  ) then
    raise exception 'ja_faz_parte';
  end if;

  select greatest(coalesce(cotas_total, 0), 0) into v_total
    from public.embarcacoes where id = c.embarcacao_id;

  select count(*) into v_ocupadas from public.vinculos
    where embarcacao_id = c.embarcacao_id and papel = 'COTISTA';

  -- `cotas_total = 0` (o default) cai aqui: unidade sem cota definida não é
  -- unidade de cotas, e deixar entrar seria criar acesso que o ADM não pediu.
  if v_ocupadas >= v_total then
    raise exception 'sem_vaga_de_cota';
  end if;

  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel, permissoes)
  values (
    auth.uid(), c.embarcacao_id, 'COTISTA', 'operacional',
    -- Espelho de PRESET_ENTERPRISE.COTISTA — ver cabeçalho. As 15 áreas estão
    -- escritas por extenso: área omitida cairia no `coalesce(..., false)` de
    -- `permissao()` e daria no mesmo, mas aí a próxima pessoa a ler não saberia
    -- se a ausência foi decisão ou esquecimento.
    jsonb_build_object(
      'embarcacao',  jsonb_build_object('ver', true,  'editar', false),
      'motores',     jsonb_build_object('ver', true,  'editar', false),
      'eletrica',    jsonb_build_object('ver', false, 'editar', false),
      'casco',       jsonb_build_object('ver', false, 'editar', false),
      'hidraulica',  jsonb_build_object('ver', false, 'editar', false),
      'seguranca',   jsonb_build_object('ver', false, 'editar', false),
      'equipamentos',jsonb_build_object('ver', false, 'editar', false),
      'documentos',  jsonb_build_object('ver', true,  'editar', false),
      'fotos',       jsonb_build_object('ver', true,  'editar', false),
      'contatos',    jsonb_build_object('ver', false, 'editar', false),
      'gastos',      jsonb_build_object('ver', false, 'editar', false),
      'diario',      jsonb_build_object('ver', false, 'editar', false),
      'historico',   jsonb_build_object('ver', true,  'editar', false),
      'carteira',    jsonb_build_object('ver', false, 'editar', false),
      'agenda',      jsonb_build_object('ver', false, 'editar', false)
    )
  );

  return c.embarcacao_id;
end;
$function$;

revoke all on function public.aceitar_convite_cotista(text) from public, anon;
grant execute on function public.aceitar_convite_cotista(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) As duas funções existem, são DEFINER e têm search_path fixo —
--    tem de voltar 2:
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('info_convite_cotista','aceitar_convite_cotista')
--    and p.prosecdef
--    and array_to_string(p.proconfig, ',') like '%search_path%';
--
-- 2) Só `info_convite_cotista` é executável por anon — tem de voltar
--    info_convite_cotista com anon=X e aceitar_convite_cotista SEM anon:
-- select p.proname, array_to_string(p.proacl, ' | ') as acl
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname='public'
--    and p.proname in ('info_convite_cotista','aceitar_convite_cotista');
--
-- 3) O convite que existe hoje é lido pela função — tem de voltar 1 linha,
--    com `valido = true` e `vagas_total = 0` (é a resposta certa: a unidade
--    ainda não tem cota definida):
-- select i.* from public.convites_cotista c
--   cross join lateral public.info_convite_cotista(c.codigo) i
--  where c.ativo;
--
-- 4) Nada foi criado por engano — tem de voltar 0 (nenhum COTISTA entrou só
--    por a função existir):
-- select count(*) from public.vinculos where papel = 'COTISTA';
--
-- 5) Esta migration não cria nem remove policy — o total tem de ser o mesmo
--    de antes dela: 224 (leitura de 19/08/2026, com 067–071 já aplicadas)
--    mais 1 se a 076 já tiver rodado, ou seja 225:
-- select count(*) from pg_policies where schemaname = 'public';
--
-- 6) `vinculos` continua SEM policy de INSERT — tem de voltar 0. É a trava
--    estrutural do isolamento entre contas, e esta migration não a afrouxa:
-- select count(*) from pg_policies
--  where schemaname='public' and tablename='vinculos' and cmd='INSERT';

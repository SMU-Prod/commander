-- ============================================================================
-- 089 — O pedido publicado passa a AVISAR quem atende
-- ============================================================================
-- FECHA: o buraco que a auditoria de 19/08 registrou como A20 e que a onda 98
--        deixou escrito, em português, dentro de
--        `web/app/(app)/marketplace/[id]/page.tsx`: "Ninguém foi avisado: não
--        há push, e-mail nem notificação nenhuma na publicação de um pedido".
--
-- O PROBLEMA, NA VOZ DE QUEM USA
-- ------------------------------
-- Hoje o dono publica um pedido e o Marketplace fica em silêncio. O prestador
-- só descobre se ABRIR o Marketplace por conta própria — e ninguém abre um
-- mural vazio duas vezes. O efeito não é "demora um pouco mais": é o dono
-- lendo o silêncio como "ninguém quis o serviço" quando o fato é "ninguém
-- ficou sabendo". Um marketplace que depende de a outra ponta lembrar de
-- olhar não roda; ele morre na primeira semana e leva junto o motivo de o
-- prestador voltar ao app.
--
-- A régua de QUEM avisar já existe, testada, em duas funções puras que as
-- telas já usam:
--   · `usuariosCompativeis` / `interesseAtendeDemanda` (§11.4) sobre
--     `interesses_marketplace` — quem NÃO é Partner e declarou o que quer
--     receber em `/marketplace/interesses`;
--   · `demandaCompativelComPartner` (§11.4 + §13) sobre
--     `parceiros` + `parceiro_atividades` + `parceiro_vagas` — o Partner, que
--     declara região e atividades no próprio perfil (`/parceiro/perfil` diz,
--     com estas palavras: "É por aqui que os pedidos do Marketplace chegam
--     até você").
-- Não falta régua. Falta o LUGAR ONDE SE ANOTA que fulano já foi avisado
-- daquele pedido — e é só isso que esta migration cria.
--
-- POR QUE UMA TABELA, E NÃO UM CAMPO EM `demandas`
-- ------------------------------------------------
-- O aviso é uma relação (pedido × pessoa), não um atributo do pedido. Um
-- contador em `demandas` não responde a pergunta que importa na hora do
-- disparo — "esta pessoa já foi avisada DESTE pedido?" — e é justamente essa
-- pergunta que impede o segundo push. A mesma escolha que `alertas_enviados`
-- fez na 004/023, pelo mesmo motivo.
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- (1) VAZAMENTO POR NOTIFICAÇÃO. Uma tabela que liga PEDIDO a PESSOA é, lida
--     de fora, a lista de "quem atende o quê e onde" — o cadastro comercial
--     inteiro da plataforma, derivado. Se a policy de SELECT for frouxa, um
--     concorrente publica um pedido isca e lê a carteira de prestadores da
--     região. Por isso o SELECT é `usuario_id = auth.uid()` e NADA MAIS: nem
--     o autor do pedido enxerga as linhas. Ele recebe só a CONTAGEM, por uma
--     função `security definer` que devolve número e nunca identidade.
--
-- (2) AVISO FABRICADO. Se qualquer pessoa autenticada pudesse inserir aqui,
--     daria para plantar avisos na caixa de entrada alheia — spam com a cara
--     do app. Esta tabela nasce SEM policy de INSERT, UPDATE ou DELETE: com
--     RLS ligada, ausência de policy é negação. Só a chave de serviço
--     escreve, a partir do servidor, depois de a régua pura ter decidido.
--     É o mesmo desenho de `alertas_enviados`, que também só tem SELECT.
--
-- (3) AVISO DUPLICADO. É o defeito que destrói a confiança no sino mais
--     rápido do que a ausência de aviso. A trava é o índice único
--     `(demanda_id, usuario_id)` — no BANCO, não no código: dois publicares
--     simultâneos, um retry do Next, um clique duplo no formulário, todos
--     esbarram na mesma unique. O código insere com `on conflict do nothing`
--     e usa as linhas que VOLTARAM do insert para decidir a quem mandar
--     push: quem já estava lá não volta, logo não recebe de novo.
--     A 023 precisou de índice funcional com `coalesce(...)` porque o alvo
--     dela varia (item, equipamento ou embarcação, o primeiro não nulo).
--     Aqui as duas colunas são sempre presentes e sempre as mesmas, então o
--     índice é direto — mesmo espírito, sem o `coalesce` que não teria o que
--     resolver.
--
-- (4) LIXO ETERNO. Toda linha morre junto com o pedido (`on delete cascade`
--     em `demandas`) ou com a conta (`on delete cascade` em `auth.users`).
--     Nada aqui sobrevive ao que descreve.
--
-- IMPACTO MEDIDO NO BANCO VIVO — 19/08/2026
-- -----------------------------------------
--   demandas ................................ 0 linhas
--   interesses_marketplace .................. 0 linhas
--   parceiros ............................... 1 linha
--   parceiro_atividades ..................... 0 linhas
--   perfis_comandante ....................... 0 linhas
--   propostas ............................... 0 linhas
-- Tabela nova, zero linha existente muda de comportamento. O primeiro pedido
-- publicado depois desta migration é também o primeiro a avisar alguém.
--
-- Idempotente: `create table if not exists`, `create index if not exists`,
-- `drop policy if exists` + `create policy`, `create or replace function`.
--
-- REVERSÃO (em comentário, no fim do arquivo).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A tabela
-- ---------------------------------------------------------------------------
create table if not exists public.avisos_demanda (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  -- POR QUE esta pessoa foi avisada. Não é enfeite: é a única resposta
  -- possível ao dia em que uma marina perguntar "por que recebi um pedido de
  -- eletricista?". Sem isto, a investigação seria reconstruir o cadastro dela
  -- como estava naquele instante — impossível, porque o cadastro muda.
  --   interesse             -> `interesses_marketplace` (§11.4, quem não é Partner)
  --   partner               -> `parceiros` + atividades + vagas (§13)
  --   perfil_profissional   -> `perfis_comandante` (§11.1, demanda de tripulação)
  origem text not null check (origem in ('interesse', 'partner', 'perfil_profissional')),
  criado_em timestamptz not null default now()
);

-- A TRAVA CONTRA O AVISO DUPLICADO. Ver o perigo (3) no cabeçalho: ela é o
-- motivo de este arquivo existir tanto quanto a tabela é.
create unique index if not exists avisos_demanda_dedupe_idx
  on public.avisos_demanda (demanda_id, usuario_id);

-- A leitura real do app: "meus avisos, mais novos primeiro". Sem este índice
-- a Central de Notificações varreria a tabela inteira a cada abertura de
-- tela, que é o custo O(plataforma) que a auditoria de 18/08 já cobrou uma
-- vez em `carregarPainel`.
create index if not exists idx_avisos_demanda_usuario
  on public.avisos_demanda (usuario_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- RLS — uma policy só, e é de leitura
-- ---------------------------------------------------------------------------
alter table public.avisos_demanda enable row level security;

drop policy if exists "avisos_demanda: só os meus" on public.avisos_demanda;
create policy "avisos_demanda: só os meus" on public.avisos_demanda
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- SEM policy de INSERT/UPDATE/DELETE, e é decisão, não esquecimento — ver o
-- perigo (2). Com RLS ligada e nenhuma policy para o comando, o comando é
-- negado para `authenticated` e para `anon`. Quem escreve é a chave de
-- serviço (`web/lib/supabase/servico.ts`), chamada de dentro do servidor
-- depois de a regra pura ter escolhido a lista.

-- A 002 revoga privilégios de `anon` por padrão neste projeto; repetimos aqui
-- para a tabela nova não depender de a 002 ter alcance sobre o que veio
-- depois dela.
revoke all on public.avisos_demanda from anon;

-- ---------------------------------------------------------------------------
-- A CONTAGEM QUE O AUTOR DO PEDIDO PODE VER — e só ela
-- ---------------------------------------------------------------------------
-- A tela do pedido precisa dizer a verdade sobre o disparo: "avisamos 7
-- pessoas" ou "ninguém que atende isso na sua região está cadastrado ainda".
-- As duas frases mudam o que o dono FAZ a seguir, e é por isso que a onda 98
-- teve de apagar a frase antiga (que afirmava um aviso inexistente).
--
-- Mas o autor não pode ver QUEM: a lista de prestadores de uma região é o
-- ativo da plataforma, e "publicou um pedido" não é credencial para baixá-la.
-- Daí uma função que devolve INTEIRO, nunca linha.
--
-- `null` (e não 0) para quem não é o autor: no Commander `null` nunca vira
-- zero desenhado (regra da casa, `lib/domain/patio.ts`). Zero aqui quer dizer
-- "ninguém compatível", que é um fato; devolver zero a um estranho seria
-- inventar esse fato para ele.
create or replace function public.avisos_da_demanda(p_demanda uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when exists (
      select 1 from public.demandas d
       where d.id = p_demanda and d.autor_id = (select auth.uid())
    )
    then (select count(*)::int from public.avisos_demanda a where a.demanda_id = p_demanda)
    else null
  end;
$function$;

revoke all on function public.avisos_da_demanda(uuid) from public;
revoke all on function public.avisos_da_demanda(uuid) from anon;
grant execute on function public.avisos_da_demanda(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- TRAVA — a migration não passa se qualquer uma das três garantias faltar
-- ---------------------------------------------------------------------------
do $$
declare
  v_rls boolean;
  v_policies int;
  v_escrita int;
  v_unique int;
begin
  -- (i) RLS ligada. Sem ela, a ausência de policy de INSERT não nega nada —
  --     ela LIBERA tudo, e o desenho inteiro do perigo (2) se inverte.
  select relrowsecurity into v_rls
    from pg_class where oid = 'public.avisos_demanda'::regclass;
  if not coalesce(v_rls, false) then
    raise exception
      'ABORTADO: RLS nao ficou ligada em avisos_demanda. Sem RLS, a tabela fica aberta a qualquer usuario autenticado.';
  end if;

  -- (ii) exatamente UMA policy, e ela é de SELECT. Duas policies de SELECT se
  --      somam por OR e a mais frouxa vence — o modo de falhar que a 083 e a
  --      085 já documentaram neste projeto.
  select count(*) into v_policies
    from pg_policies where schemaname = 'public' and tablename = 'avisos_demanda';
  select count(*) into v_escrita
    from pg_policies
   where schemaname = 'public' and tablename = 'avisos_demanda'
     and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
  if v_policies <> 1 or v_escrita <> 0 then
    raise exception
      'ABORTADO: avisos_demanda ficou com % policy(ies), sendo % de escrita (esperado 1 e 0). Policy de escrita aqui permite plantar aviso na caixa de entrada alheia. Rode: select policyname, cmd from pg_policies where schemaname=''public'' and tablename=''avisos_demanda'';',
      v_policies, v_escrita;
  end if;

  -- (iii) o índice único existe. É ele — e não o código do app — que impede o
  --       segundo aviso do mesmo pedido para a mesma pessoa.
  select count(*) into v_unique
    from pg_indexes
   where schemaname = 'public' and tablename = 'avisos_demanda'
     and indexname = 'avisos_demanda_dedupe_idx';
  if v_unique <> 1 then
    raise exception
      'ABORTADO: o indice unico avisos_demanda_dedupe_idx nao existe. Sem ele o mesmo pedido avisa a mesma pessoa a cada republicacao/retry.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) UMA policy, de SELECT, e nenhuma de escrita — tem de voltar 1 linha,
--    cmd = 'SELECT':
-- select policyname, cmd, qual from pg_policies
--  where schemaname='public' and tablename='avisos_demanda';
--
-- 2) RLS ligada — tem de voltar true:
-- select relrowsecurity from pg_class where oid='public.avisos_demanda'::regclass;
--
-- 3) O índice único está lá — tem de voltar 1:
-- select count(*) from pg_indexes
--  where schemaname='public' and tablename='avisos_demanda'
--    and indexname='avisos_demanda_dedupe_idx';
--
-- 4) A contagem só responde ao autor. Com login comum, sobre um pedido que
--    NÃO é seu, tem de voltar null:
-- select public.avisos_da_demanda('<id-de-pedido-de-outra-pessoa>');
--
-- 5) Teste de fumaça, ponta a ponta, com duas contas:
--    a) conta A entra em `/marketplace/interesses` e cadastra
--       "Preciso de profissional" + a região X (categoria em branco = todas);
--    b) conta B publica em `/marketplace/nova` um pedido de profissional na
--       região X;
--    c) conta A abre `/notificacoes`: tem de existir um aviso "Novo pedido
--       combina com você", nível Importante, e o sino tem de contá-lo;
--    d) conta B, na ficha do pedido, tem de ler "Avisamos 1 pessoa…" no lugar
--       da frase antiga;
--    e) conta B publica um SEGUNDO pedido igual: a conta A recebe um segundo
--       aviso (pedido diferente). Já reprocessar o MESMO pedido não pode
--       gerar linha nova — é o que a unique garante:
--       select demanda_id, usuario_id, count(*) from public.avisos_demanda
--        group by 1,2 having count(*) > 1;   -- tem de voltar vazio
--
-- ---------------------------------------------------------------------------
-- REVERSÃO
-- ---------------------------------------------------------------------------
-- Derruba o disparo inteiro e devolve o Marketplace ao silêncio da onda 98.
-- Antes de rodar, lembre que a frase da tela do pedido volta a mentir se o
-- código do app não for revertido junto (ela passa a falar em aviso):
--
-- begin;
--   drop function if exists public.avisos_da_demanda(uuid);
--   drop table if exists public.avisos_demanda;   -- cascade não é preciso: nada aponta pra ela
-- commit;

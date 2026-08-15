-- =====================================================================
-- 053 · PUBLICIDADE E DESTAQUES (§20, §3.4) + TELAS DE SUPORTE E
--       COMERCIAL (§21)
--
-- PRD: `docs/prd/upgrade2-master-final.txt` §20 inteira, §3.4 (onde o
-- patrocínio aparece no Dashboard), §21 (papéis e escopo), §21.1 (o CEO
-- quer "Publicidade ativa, impressões e cliques") e §22 (dado sensível).
--
-- ---------------------------------------------------------------------
-- O QUE ESTA MIGRATION DECIDE — e por quê
-- ---------------------------------------------------------------------
--
-- 1) PREÇO NÃO MORA NO CÓDIGO. O §20 é literal: "Preço não deve ser
--    hardcoded; configurável no Admin/Comercial". Por isso existe
--    `publicidade_produtos`, com uma linha por produto e um preço que se
--    muda com UPDATE, não com deploy. Mesmo desenho de `gold_precos`
--    (migration 033), inclusive o `null = sob consulta`.
--
--    As três linhas nascem SEM preço, de propósito. O §20 lista os
--    produtos mas não tabela valor nenhum — inventar "R$ 199,00" aqui
--    seria eu tomando uma decisão comercial que ninguém me delegou, e o
--    número falso viraria verdade no primeiro print de tela. Sem preço, a
--    tela do Comercial mostra "sob consulta" e pede que alguém defina.
--
-- 2) O VALOR COBRADO FICA CONGELADO NA CAMPANHA (`valor_centavos`).
--    O preço do produto muda; o que foi cobrado naquela campanha não pode
--    mudar junto, senão o histórico comercial se reescreve sozinho toda
--    vez que a tabela de preços é reajustada.
--
-- 3) ANÚNCIO NÃO TEM URL EXTERNA. Não existe coluna de destino: o clique
--    leva ao perfil do próprio Partner dentro do app. Um campo de URL
--    livre num app de gestão pago é superfície de phishing (quem edita a
--    campanha é interno, mas o dia em que virar self-service o campo já
--    está lá) e um salto pra fora que ninguém audita. Se um dia precisar
--    sair do app, que seja uma decisão explícita numa migration própria.
--
-- 4) MÉTRICA É CONTADOR DIÁRIO, NÃO LOG DE EVENTO. `publicidade_metricas`
--    guarda (campanha, dia, impressões, cliques) e NÃO guarda quem viu.
--    Duas razões: volume (uma linha por impressão vira milhões) e §22 —
--    pra saber que um anúncio performou não é preciso saber que o
--    proprietário fulano o viu às 14h32. O que não se grava não vaza.
--
-- 5) PUBLICIDADE NÃO ENCOSTA EM REPUTAÇÃO. "Publicidade nunca interfere
--    na nota/reputação do Partner" (§20). A garantia aqui é estrutural, e
--    é a mais forte que existe: NENHUMA tabela de avaliação ganhou coluna
--    de campanha, e nenhuma tabela desta migration guarda nota. Não há
--    caminho de dado entre `publicidade_campanhas` e `avaliacoes` — nem
--    por JOIN acidental, porque não existe chave que as ligue além do
--    `parceiros.id`, e nenhuma view as junta. Ver também o comentário no
--    topo de `calcularReputacao` em `lib/domain/avaliacoes.ts`.
--
-- 6) SUPORTE LÊ, NÃO EDITA (§21: "Usuários, embarcações, planos/status
--    (...) sem configurações estratégicas críticas"). As policies novas
--    de `embarcacoes`, `vinculos` e `assinaturas` são SELECT e só. O
--    Suporte enxerga o cadastro do barco pra atender — não mexe em hora
--    de motor, manutenção, documento, foto nem lançamento financeiro,
--    porque nada disso ganhou policy. O §22 ("isolamento entre
--    embarcações e contas deve ser obrigatório no backend") continua
--    valendo pro resto do dossiê.
--
-- 7) COMERCIAL NÃO VÊ PROPRIETÁRIO. O Comercial ganha leitura de
--    `parceiros` (perfil comercial, que já é vitrine pública) e NADA de
--    `profiles`, `embarcacoes` ou `demandas_contato`. O §22 diz que
--    "Partner não recebe telefone/dados sensíveis do proprietário antes
--    do ponto de liberação previsto no fluxo" — o mesmo princípio vale
--    pra dentro de casa: quem vende destaque não precisa do telefone de
--    ninguém pra vender destaque.
--
-- 8) SUSPENDER PARTNER É RPC, NÃO POLICY DE UPDATE. RLS não filtra
--    COLUNA: uma policy `for update` pro Comercial deixaria ele reescrever
--    telefone, preço e descrição do Partner inteiro. `parceiro_admin_
--    definir_visibilidade()` toca UMA coluna e nenhuma outra. Plano do
--    Partner o Comercial LÊ (§21 pede "ver plano"), não escreve.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PRODUTOS E PREÇOS (§20)
-- ---------------------------------------------------------------------
create table public.publicidade_produtos (
  produto text primary key check (produto in ('destaque_explorar','destaque_superior','patrocinio_dashboard')),
  rotulo text not null,
  -- null = "sob consulta". É um ESTADO, não um preço: não gera cobrança
  -- automática nenhuma (mesma leitura da faixa 81+ pés do Gold).
  preco_mensal_centavos int check (preco_mensal_centavos is null or preco_mensal_centavos > 0),
  ativo boolean not null default true,
  atualizado_por uuid references public.profiles(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

insert into public.publicidade_produtos (produto, rotulo) values
  ('destaque_explorar',    'Destaque no Explorar'),
  ('destaque_superior',    'Destaque superior'),
  ('patrocinio_dashboard', 'Patrocínio no Dashboard');

alter table public.publicidade_produtos enable row level security;

-- Qualquer pessoa logada lê a tabela de preços — é o que permite um
-- Partner saber quanto custa antes de falar com o Comercial, e é o mesmo
-- que `gold_precos` já fazia. Nunca `using (true)`: anônimo não entra.
create policy "publicidade_produtos: autenticado ve" on public.publicidade_produtos
  for select to authenticated using ((select auth.uid()) is not null);

-- "configurável no Admin/Comercial" (§20), palavra por palavra.
create policy "publicidade_produtos: comercial atualiza" on public.publicidade_produtos
  for update to authenticated
  using (public.eh_ceo() or public.tem_papel_admin('comercial'))
  with check (public.eh_ceo() or public.tem_papel_admin('comercial'));

-- Os três produtos são a definição do §20. Ninguém inventa um quarto pela
-- API nem apaga um existente: sem policy de insert/delete, e privilégio
-- revogado por cima (cinto além do suspensório).
revoke insert, delete, truncate on public.publicidade_produtos from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) CAMPANHAS (§20)
-- ---------------------------------------------------------------------
-- "Regra única para qualquer Commander Partner, pago ou gratuito" — por
-- isso a campanha aponta pra `parceiros` e ponto: não há check de plano,
-- não há produto que só o Partner pago possa comprar. Uma Marina (grátis
-- no §2) compra destaque exatamente como um Prestador (pago).
create table public.publicidade_campanhas (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  produto text not null references public.publicidade_produtos(produto),
  status text not null default 'rascunho'
    check (status in ('rascunho','ativa','pausada','encerrada')),
  inicio date not null default public.hoje_sp(),
  -- null = sem data de término prevista. Não é "para sempre": encerrar é
  -- uma decisão registrada (status 'encerrada'), não um vencimento mudo.
  fim date,
  -- Segmentação (§20: "Segmentação mínima recomendada: região; categoria
  -- quando aplicável"). NULL = sem restrição — uma campanha sem região
  -- alcança todo mundo, o que é diferente de uma campanha com região que
  -- não bate com a de quem está olhando.
  regiao_id uuid references public.taxonomia(id) on delete restrict,
  categoria_id uuid references public.taxonomia(id) on delete restrict,
  -- Desempate do carrossel e do destaque. Nada a ver com nota: ver o item
  -- 5 do cabeçalho.
  prioridade int not null default 0,
  -- O que foi cobrado NESTA campanha, congelado (item 2 do cabeçalho).
  valor_centavos int check (valor_centavos is null or valor_centavos >= 0),
  -- Frase curta que aparece no anúncio. Sem HTML, sem link: o clique vai
  -- pro perfil do Partner (item 3 do cabeçalho).
  chamada text,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint publicidade_periodo_coerente check (fim is null or fim >= inicio)
);

create index publicidade_campanhas_vigencia_idx
  on public.publicidade_campanhas (produto, status, inicio, fim);
create index publicidade_campanhas_parceiro_idx
  on public.publicidade_campanhas (parceiro_id);

create or replace function public.publicidade_campanhas_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
revoke execute on function public.publicidade_campanhas_touch() from public, anon, authenticated;

create trigger publicidade_campanhas_touch before update on public.publicidade_campanhas
  for each row execute function public.publicidade_campanhas_touch();

-- Vigência: uma campanha só é veiculável quando ATIVA e dentro do
-- período. Está em função pra que a policy de SELECT, a de contagem de
-- impressão e a leitura da tela usem a MESMA definição — três definições
-- de "no ar" viram três respostas diferentes pro mesmo anúncio.
create or replace function public.publicidade_vigente(p_campanha_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.publicidade_campanhas c
    where c.id = p_campanha_id
      and c.status = 'ativa'
      and c.inicio <= public.hoje_sp()
      and (c.fim is null or c.fim >= public.hoje_sp())
  );
$$;
revoke all on function public.publicidade_vigente(uuid) from public, anon;
grant execute on function public.publicidade_vigente(uuid) to authenticated;

alter table public.publicidade_campanhas enable row level security;

-- Leitura em três faixas, e a ordem importa:
--   · campanha VIGENTE é legível por qualquer pessoa logada — é um
--     anúncio, existe pra ser visto; sem isso o carrossel do Dashboard
--     não teria o que renderizar;
--   · o próprio Partner vê as dele, vigentes ou não (é ele quem paga);
--   · Comercial e CEO veem todas.
-- Rascunho/pausada/encerrada de terceiro NÃO vaza pra cliente nenhum.
create policy "publicidade_campanhas: vigente e visivel, dona ou comercial"
  on public.publicidade_campanhas for select to authenticated
  using (
    (status = 'ativa' and inicio <= public.hoje_sp() and (fim is null or fim >= public.hoje_sp()))
    or exists (
      select 1 from public.parceiros p
      where p.id = publicidade_campanhas.parceiro_id and p.usuario_id = (select auth.uid())
    )
    or public.eh_ceo() or public.tem_papel_admin('comercial')
  );

-- "Partners, destaques, campanhas, publicidade e métricas comerciais"
-- (§21) — quem cria e mexe em campanha é o Comercial (CEO implicado).
-- O Partner NÃO cria a própria campanha: publicidade é venda, e venda
-- passa pelo Comercial. Se um dia virar self-service, é policy nova.
create policy "publicidade_campanhas: comercial cria" on public.publicidade_campanhas
  for insert to authenticated
  with check (public.eh_ceo() or public.tem_papel_admin('comercial'));

create policy "publicidade_campanhas: comercial edita" on public.publicidade_campanhas
  for update to authenticated
  using (public.eh_ceo() or public.tem_papel_admin('comercial'))
  with check (public.eh_ceo() or public.tem_papel_admin('comercial'));

-- Campanha não se apaga: 'encerrada' é o caminho de saída. Apagar levaria
-- junto as impressões e os cliques (cascade), e histórico comercial que
-- some sob demanda não serve de histórico.
revoke delete, truncate on public.publicidade_campanhas from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) IMPRESSÕES E CLIQUES (§21.1)
-- ---------------------------------------------------------------------
create table public.publicidade_metricas (
  campanha_id uuid not null references public.publicidade_campanhas(id) on delete cascade,
  dia date not null default public.hoje_sp(),
  impressoes int not null default 0,
  cliques int not null default 0,
  primary key (campanha_id, dia)
);

alter table public.publicidade_metricas enable row level security;

create policy "publicidade_metricas: dona ou comercial" on public.publicidade_metricas
  for select to authenticated
  using (
    public.eh_ceo() or public.tem_papel_admin('comercial')
    or exists (
      select 1 from public.publicidade_campanhas c
      join public.parceiros p on p.id = c.parceiro_id
      where c.id = publicidade_metricas.campanha_id and p.usuario_id = (select auth.uid())
    )
  );

-- Contador não se escreve na mão. Sem policy de insert/update/delete e
-- com privilégio revogado: a única porta são as duas funções abaixo, que
-- só contam campanha VIGENTE — sem isso, uma campanha pausada continuaria
-- somando impressão e o Comercial cobraria por veiculação que não houve.
--
-- LIMITE HONESTO: qualquer pessoa logada pode chamar a RPC e inflar o
-- contador da campanha que ela conseguir ler. É contador interno de
-- produto, não faturamento auditado por terceiro; blindar isso exigiria
-- token por impressão e não é o problema desta onda. Fica escrito pra
-- que, no dia em que a publicidade for cobrada por impressão, ninguém
-- descubra a fragilidade pelo extrato.
revoke insert, update, delete, truncate on public.publicidade_metricas from anon, authenticated;

create or replace function public.publicidade_registrar_impressao(p_campanha_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.publicidade_vigente(p_campanha_id) then return; end if;
  insert into public.publicidade_metricas (campanha_id, dia, impressoes, cliques)
  values (p_campanha_id, public.hoje_sp(), 1, 0)
  on conflict (campanha_id, dia)
  do update set impressoes = public.publicidade_metricas.impressoes + 1;
end $$;
revoke all on function public.publicidade_registrar_impressao(uuid) from public, anon;
grant execute on function public.publicidade_registrar_impressao(uuid) to authenticated;

create or replace function public.publicidade_registrar_clique(p_campanha_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.publicidade_vigente(p_campanha_id) then return; end if;
  insert into public.publicidade_metricas (campanha_id, dia, impressoes, cliques)
  values (p_campanha_id, public.hoje_sp(), 0, 1)
  on conflict (campanha_id, dia)
  do update set cliques = public.publicidade_metricas.cliques + 1;
end $$;
revoke all on function public.publicidade_registrar_clique(uuid) from public, anon;
grant execute on function public.publicidade_registrar_clique(uuid) to authenticated;

-- §21.1: "Publicidade ativa, impressões e cliques quando implementado".
-- Agora está implementado — a fonte que `lib/domain/admin-metricas.ts`
-- declarava como `sem_fonte` passa a existir de verdade.
create or replace function public.admin_metricas_publicidade()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when not public.eh_ceo() then null::jsonb else jsonb_build_object(
    'ativos', (
      select count(*) from public.publicidade_campanhas
      where status = 'ativa' and inicio <= public.hoje_sp()
        and (fim is null or fim >= public.hoje_sp())
    ),
    'impressoes', (select coalesce(sum(impressoes), 0) from public.publicidade_metricas),
    'cliques',    (select coalesce(sum(cliques), 0)    from public.publicidade_metricas)
  ) end;
$$;
revoke all on function public.admin_metricas_publicidade() from public, anon;
grant execute on function public.admin_metricas_publicidade() to authenticated;

-- ---------------------------------------------------------------------
-- 4) REGIÃO DA EMBARCAÇÃO — o que torna a segmentação possível
-- ---------------------------------------------------------------------
-- O §20 pede "segmentação mínima: região". Do lado do Partner isso já
-- existe (`parceiros.regiao_id`, migration 052), mas do lado de QUEM OLHA
-- o Dashboard não havia nada: `embarcacoes` guarda o NOME da marina e
-- coordenadas, nunca um item da taxonomia. Coluna nova, opcional,
-- apontando pra mesma lista `regiao` que o Marketplace já usa.
--
-- Fica NULA por padrão e ninguém preenche por adivinhação a partir de
-- lat/lon: se a região do barco é desconhecida, a regra de exibição serve
-- só campanha SEM segmentação regional. Mostrar anúncio de Angra pra quem
-- pode estar em Salvador seria pior que não mostrar nada.
alter table public.embarcacoes
  add column regiao_id uuid references public.taxonomia(id) on delete set null;

-- ---------------------------------------------------------------------
-- 5) O QUE O COMERCIAL ENXERGA DE `parceiros` (§21, §22)
-- ---------------------------------------------------------------------
-- A policy da onda 10 só deixa ver Partner VISÍVEL (ou o próprio). Pra
-- gerir a carteira — inclusive reativar quem está suspenso — o Comercial
-- precisa ver os invisíveis também.
create policy "parceiro: comercial ve todos" on public.parceiros
  for select to authenticated
  using (public.eh_ceo() or public.tem_papel_admin('comercial'));

-- Suspender/reativar mexe em UMA coluna. Ver item 8 do cabeçalho: policy
-- de update daria o perfil inteiro, e o Comercial não tem por que
-- reescrever o telefone ou o preço da diária de um parceiro.
create or replace function public.parceiro_admin_definir_visibilidade(
  p_parceiro_id uuid,
  p_visivel boolean
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_antes boolean;
begin
  if not (public.eh_ceo() or public.tem_papel_admin('comercial')) then
    raise exception 'sem_permissao_comercial';
  end if;

  select visivel into v_antes from public.parceiros where id = p_parceiro_id;
  if v_antes is null then
    raise exception 'parceiro_inexistente';
  end if;

  update public.parceiros set visivel = p_visivel, atualizado_em = now()
  where id = p_parceiro_id;

  return v_antes;
end $$;
revoke all on function public.parceiro_admin_definir_visibilidade(uuid, boolean) from public, anon;
grant execute on function public.parceiro_admin_definir_visibilidade(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 6) O QUE O SUPORTE ENXERGA (§21) — e o que continua fechado
-- ---------------------------------------------------------------------
-- §21, Suporte: "Usuários, embarcações, planos/status, chamados e
-- operação de suporte; sem configurações estratégicas críticas".
--
-- `profiles` já abriu na 049. Faltavam as três abaixo, todas SELECT:
create policy "embarcacao: suporte enxerga o cadastro" on public.embarcacoes
  for select to authenticated using (public.tem_papel_admin('suporte'));

create policy "vinculos: suporte enxerga quem tem acesso" on public.vinculos
  for select to authenticated using (public.tem_papel_admin('suporte'));

-- "planos/status" — o Suporte precisa saber em que plano a pessoa está e
-- se o pagamento falhou, senão não atende ninguém. É status de
-- assinatura, não extrato: `assinaturas` guarda plano, status e valor do
-- plano, nunca meio de pagamento nem dado bancário (§22, "dados
-- financeiros pessoais não devem ser expostos por padrão").
create policy "assinatura: suporte enxerga status" on public.assinaturas
  for select to authenticated using (public.tem_papel_admin('suporte'));

-- E o que NÃO abriu, de propósito, pra ficar registrado que foi escolha:
-- `eventos` (Diário), `itens_monitorados`, `equipamentos`,
-- `lancamentos_financeiros`, `carteiras`, `fotos`, `documentos`,
-- `ocorrencias` e `demandas_contato` continuam invisíveis pro Suporte. O
-- §21 dá "embarcações", não "o dossiê técnico e financeiro da
-- embarcação"; e o §22 manda o isolamento ser obrigatório no backend, o
-- que só vale alguma coisa se ele resistir ao próprio time.

-- ---------------------------------------------------------------------
-- 7) CORTESIA DO SUPORTE — a única escrita que o Suporte ganha
-- ---------------------------------------------------------------------
-- Nada a fazer aqui: `premium_concessoes` já tem a policy "suporte cria"
-- (049) e o check de `origem` já aceita 'cortesia' desde a 048. Ou seja,
-- a capacidade existia e não tinha tela. Ela entra em
-- `/admin/usuarios/[id]` como ação EXPLÍCITA e logada
-- (`registrar_log_admin`), nunca como efeito colateral de abrir a ficha.
--
-- O bloco fica escrito pra registrar que a ausência de DDL foi verificada,
-- não presumida.

-- ---------------------------------------------------------------------
-- 8) O QUE ESTA MIGRATION NÃO FEZ
-- ---------------------------------------------------------------------
--   · não criou tabela de "chamados" (§21 cita "chamados" no escopo do
--     Suporte, mas não descreve o objeto em lugar nenhum do PRD). O
--     atendimento registrado hoje vira linha em `admin_logs`, que já
--     responde "quem, quando, função, ação, entidade". Inventar um
--     helpdesk inteiro a partir de uma palavra seria construir o módulo
--     errado;
--   · não tocou em `avaliacoes`, `avaliacoes_respostas` nem
--     `avaliacoes_contestacoes` — ver item 5 do cabeçalho;
--   · não criou cobrança de campanha. `valor_centavos` REGISTRA o que foi
--     acertado; quem fatura é o gateway do §23, e ele ainda não existe.

-- 050: AVALIAÇÕES E CONTESTAÇÕES (PRD upgrade2-master-final §14 inteira,
-- incluindo 14.1 respostas prontas e 14.2 motivos) + PREÇO DO GOLD POR PORTE
-- (§16 e §20).
--
-- ---------------------------------------------------------------------------
-- POR QUE A AVALIAÇÃO SÓ EXISTE DEPOIS DO NEGÓCIO CONFIRMADO
-- ---------------------------------------------------------------------------
-- §14, primeira linha: "Avaliação somente após negócio confirmado
-- bilateralmente no Commander". Essa trava é o produto inteiro — é ela que
-- sustenta a indicação "Negócio confirmado pelo Commander" que o perfil
-- exibe. Se ela morasse só na tela, bastaria um POST fora do app pra encher
-- de nota um concorrente que nunca contratou ninguém, e o selo viraria
-- decoração. Por isso ela é uma condição da POLICY de insert
-- (`negocio_confirmado()`), não um `if` no React.
--
-- O fato que a destrava já existia: a onda 45 criou `negocios` +
-- `negocios_confirmacoes` (uma declaração por lado, unique por pessoa). Aqui
-- só se lê esse fato — nenhuma tabela nova de "negócio" foi inventada.
--
-- ---------------------------------------------------------------------------
-- QUEM AVALIA QUEM
-- ---------------------------------------------------------------------------
-- Uma direção só: o CLIENTE (quem publicou a demanda) avalia o FORNECEDOR
-- (quem propôs). O §14 fala sempre em "cliente" e "avaliado", em "perfil" com
-- média e em "Contestar" na mão de quem foi avaliado — é reputação de quem
-- vende, não nota mútua. Avaliação recíproca (fornecedor avaliando cliente)
-- não está no PRD e traria retaliação ("me deu 2, te dou 2") sem nenhuma
-- regra escrita pra arbitrar. Se o dono quiser depois, entra como uma segunda
-- linha com `avaliador_id = fornecedor_id` — o modelo já comporta.
--
-- ---------------------------------------------------------------------------
-- O QUE NÃO ENTRA AQUI (de propósito)
-- ---------------------------------------------------------------------------
-- · Papéis de Admin (§21: CEO / Suporte / Comercial / Gold). A moderação usa
--   `eh_admin()`, o único conceito de administrador que existe hoje — e que
--   já resolve pelo modelo de papéis em construção (hoje responde "tem papel
--   ceo, suporte ou comercial ativo"). O refino "quem modera avaliação é o
--   Suporte" é uma troca por `tem_papel_admin('suporte')` depois que aquele
--   módulo assentar; inventar um papel aqui criaria uma segunda verdade sobre
--   quem é admin enquanto ele está sendo reescrito em paralelo.
-- · Texto livre na resposta do avaliado — §14 diz "respostas do avaliado são
--   padronizadas". O banco guarda só o CÓDIGO da frase escolhida; a prosa
--   literal do §14.1 mora em `web/lib/domain/avaliacoes.ts`, testada contra o
--   PRD. Duas cópias da mesma frase (uma no banco, outra no código) seria a
--   receita pra elas divergirem.

-- ===========================================================================
-- 1) O fato que destrava tudo: negócio confirmado bilateralmente (§11.6)
-- ===========================================================================
-- Mesma regra de `estadoDoNegocio` (web/lib/domain/marketplace.ts), na mesma
-- ordem: qualquer "negado" derruba; duas declarações de papéis diferentes e
-- nenhuma negação = confirmado. `security definer` porque a policy precisa
-- enxergar as confirmações independentemente da RLS de quem está inserindo.
create or replace function public.negocio_confirmado(p_negocio_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (
      select 1 from public.negocios_confirmacoes c
      where c.negocio_id = p_negocio_id and c.decisao = 'negado'
    )
    and (
      select count(distinct c.papel) from public.negocios_confirmacoes c
      where c.negocio_id = p_negocio_id
    ) = 2;
$$;
revoke all on function public.negocio_confirmado(uuid) from public, anon;
grant execute on function public.negocio_confirmado(uuid) to authenticated;

-- ===========================================================================
-- 2) Faixas da nota (§14.1) — três tons de resposta pronta
-- ===========================================================================
-- 1–2 negativa (é a mesma faixa que libera "Contestar", §14), 3 intermediária,
-- 4–5 positiva. Fica no banco porque a POLICY precisa recusar uma resposta
-- "Agradecemos pelo reconhecimento" colada numa avaliação de 1 estrela — sem
-- isso, "resposta padronizada" seria só um select bonito na tela.
create or replace function public.faixa_da_nota(p_nota int)
returns text language sql immutable set search_path = public as $$
  select case when p_nota <= 2 then 'negativa' when p_nota = 3 then 'intermediaria' else 'positiva' end;
$$;

create or replace function public.faixa_da_resposta(p_codigo text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_codigo in ('pos_confianca', 'pos_preferencia', 'pos_reconhecimento') then 'positiva'
    when p_codigo in ('int_feedback', 'int_experiencia', 'int_observacoes') then 'intermediaria'
    when p_codigo in ('neg_contato', 'neg_analise_equipe', 'neg_lamentamos',
                      'neg_compreensao_diferente', 'neg_nao_dependeu', 'neg_ja_tratada') then 'negativa'
  end;
$$;

-- ===========================================================================
-- 3) AVALIAÇÕES (§14)
-- ===========================================================================
-- `avaliador_nome`/`avaliado_nome` autodeclarados no insert: `profiles` tem
-- RLS de "próprio ou tripulação" (migration 008) e quem lê o perfil não é
-- tripulante de ninguém — um JOIN voltaria vazio SEM erro. Mesma solução das
-- migrations 038 e 046, mantida porque o problema é o mesmo.
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  -- unique: um negócio confirmado rende UMA avaliação. Sem isso, o cliente
  -- apagaria o limite dos 30 dias de edição publicando uma segunda nota.
  negocio_id uuid not null unique references public.negocios(id) on delete cascade,
  avaliador_id uuid not null references public.profiles(id) on delete cascade,
  avaliado_id uuid not null references public.profiles(id) on delete cascade,
  avaliador_nome text not null default '',
  avaliado_nome text not null default '',
  nota int not null check (nota between 1 and 5),
  comentario text,

  -- Moderação (§14): "Admin analisa e pode Manter ou Ocultar por violação".
  -- Não existe DELETE nesta tabela — ocultar é um estado, não um apagão, e o
  -- avaliado precisa continuar vendo o que foi ocultado (e o autor, o que
  -- escreveu). Quem oculta e por quê fica registrado.
  visibilidade text not null default 'publica'
    check (visibilidade in ('publica', 'oculta_violacao')),
  ocultada_em timestamptz,
  ocultada_por uuid references public.profiles(id) on delete set null,
  ocultacao_nota text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint avaliacoes_partes_distintas check (avaliador_id <> avaliado_id)
);

create index avaliacoes_avaliado_idx on public.avaliacoes (avaliado_id, criado_em desc);
create index avaliacoes_avaliador_idx on public.avaliacoes (avaliador_id, criado_em desc);

alter table public.avaliacoes enable row level security;

-- Reputação é pública pra quem está logado — é o ponto de uma avaliação. As
-- ocultas continuam visíveis pras duas partes e pro admin: esconder do
-- avaliado o que foi ocultado o deixaria sem saber do que se defendeu, e
-- esconder do autor apagaria o texto dele sem aviso.
create policy "avaliações: pública pra todos, oculta pras partes" on public.avaliacoes
  for select to authenticated
  using (
    visibilidade = 'publica'
    or avaliador_id = (select auth.uid())
    or avaliado_id = (select auth.uid())
    or public.eh_admin()
  );

-- A TRAVA CENTRAL do §14, em RLS. Três exigências ao mesmo tempo:
-- quem avalia é o cliente daquele negócio, quem é avaliado é o fornecedor
-- daquele negócio, e o negócio está confirmado pelos dois lados.
create policy "avaliações: só o cliente, e só com negócio confirmado" on public.avaliacoes
  for insert to authenticated
  with check (
    avaliador_id = (select auth.uid())
    and visibilidade = 'publica'
    and exists (
      select 1 from public.negocios n
      where n.id = negocio_id
        and n.cliente_id = (select auth.uid())
        and n.fornecedor_id = avaliado_id
    )
    and public.negocio_confirmado(negocio_id)
  );

-- §14: "Cliente pode editar a própria avaliação por até 30 dias." O prazo é
-- do banco, não da tela — passou, a linha para de aceitar update e vira
-- histórico.
create policy "avaliações: o autor edita a própria por 30 dias" on public.avaliacoes
  for update to authenticated
  using (avaliador_id = (select auth.uid()) and criado_em > now() - interval '30 days')
  with check (avaliador_id = (select auth.uid()));

-- Sem policy de DELETE: avaliação publicada não some. Arrependeu-se? Edita
-- dentro dos 30 dias. Violou? O admin oculta, e fica registrado que ocultou.

-- §14: "Admin nunca altera a nota." Isto é privilégio de COLUNA, não
-- disciplina: `visibilidade` e companhia não estão no grant, então nem o
-- admin consegue um `update avaliacoes set visibilidade=...` direto — a
-- moderação passa obrigatoriamente pela RPC `avaliacao_moderar` (definer,
-- auditável, e que não menciona `nota` em lugar nenhum).
revoke update on table public.avaliacoes from authenticated;
grant update (nota, comentario) on table public.avaliacoes to authenticated;

-- Cinto e suspensório do parágrafo acima: mesmo que uma policy futura afrouxe,
-- a nota só muda pela mão do próprio autor e dentro do prazo, e a identidade
-- do negócio/das partes não muda nunca.
create or replace function public.avaliacao_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.negocio_id is distinct from old.negocio_id
     or new.avaliador_id is distinct from old.avaliador_id
     or new.avaliado_id is distinct from old.avaliado_id
     or new.criado_em is distinct from old.criado_em then
    raise exception 'avaliacao_imutavel';
  end if;

  if new.nota is distinct from old.nota then
    if auth.uid() is distinct from old.avaliador_id then
      raise exception 'so_o_autor_altera_a_nota';
    end if;
    if old.criado_em <= now() - interval '30 days' then
      raise exception 'prazo_de_edicao_encerrado';
    end if;
  end if;

  new.atualizado_em := now();
  return new;
end $$;
create trigger avaliacoes_guarda before update on public.avaliacoes
  for each row execute function public.avaliacao_guarda();
revoke execute on function public.avaliacao_guarda() from public, anon, authenticated;

-- Visibilidade de uma avaliação, reaproveitada pelas três tabelas filhas —
-- mesmo padrão de `gold_visivel()` (migration 033).
create or replace function public.avaliacao_visivel(p_avaliacao_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.avaliacoes a
    where a.id = p_avaliacao_id
      and (
        a.visibilidade = 'publica'
        or a.avaliador_id = auth.uid()
        or a.avaliado_id = auth.uid()
        or public.eh_admin()
      )
  );
$$;
revoke all on function public.avaliacao_visivel(uuid) from public, anon;
grant execute on function public.avaliacao_visivel(uuid) to authenticated;

-- ===========================================================================
-- 4) RESPOSTA DO AVALIADO (§14.1) — uma, e padronizada
-- ===========================================================================
-- "Uma resposta por avaliação" é a PK: não é um limite que alguém precisa
-- lembrar de checar, é o formato da tabela. E não há coluna de texto livre —
-- só o código da frase escolhida na lista do §14.1.
create table public.avaliacoes_respostas (
  avaliacao_id uuid primary key references public.avaliacoes(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  resposta_codigo text not null check (resposta_codigo in (
    'pos_confianca', 'pos_preferencia', 'pos_reconhecimento',
    'int_feedback', 'int_experiencia', 'int_observacoes',
    'neg_contato', 'neg_analise_equipe', 'neg_lamentamos',
    'neg_compreensao_diferente', 'neg_nao_dependeu', 'neg_ja_tratada'
  )),
  criado_em timestamptz not null default now()
);

alter table public.avaliacoes_respostas enable row level security;

create policy "respostas: enxerga quem enxerga a avaliação" on public.avaliacoes_respostas
  for select to authenticated using (public.avaliacao_visivel(avaliacao_id));

-- Quem responde é o avaliado, e a frase tem que ser do tom da nota: elogio
-- pronto colado numa avaliação de 1 estrela seria deboche automatizado.
create policy "respostas: o avaliado responde no tom da nota" on public.avaliacoes_respostas
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id
        and a.avaliado_id = (select auth.uid())
        and public.faixa_da_nota(a.nota) = public.faixa_da_resposta(resposta_codigo)
    )
  );

-- Sem update/delete: a resposta é pública e definitiva, como a avaliação.

-- ===========================================================================
-- 5) CONTESTAÇÃO (§14.2) — só nota 1 ou 2, e não remove nada sozinha
-- ===========================================================================
-- §14: "1 ou 2 estrelas liberam botão 'Contestar avaliação'" e "Contestação
-- não remove avaliação automaticamente". As duas frases estão no banco: a
-- primeira como condição do insert, a segunda pela ausência de qualquer
-- gatilho que mexa em `avaliacoes.visibilidade` daqui — quem muda isso é o
-- admin, pela RPC, depois de analisar.
create table public.avaliacoes_contestacoes (
  id uuid primary key default gen_random_uuid(),
  -- unique: uma contestação por avaliação. Contestar de novo o mesmo texto
  -- seria fila de spam pro admin, não um argumento novo.
  avaliacao_id uuid not null unique references public.avaliacoes(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  -- Os 8 motivos do §14.2, nesta ordem. A prosa literal está em
  -- web/lib/domain/avaliacoes.ts.
  motivo_codigo text not null check (motivo_codigo in (
    'nao_corresponde', 'informacoes_incorretas', 'nao_causado_por_nos',
    'cliente_nao_cumpriu', 'conteudo_ofensivo', 'ja_solucionada',
    'uso_indevido', 'outro'
  )),
  detalhe text,
  status text not null default 'pendente' check (status in ('pendente', 'analisada')),
  decisao text check (decisao in ('manter', 'ocultar')),
  decidido_por uuid references public.profiles(id) on delete set null,
  decidido_em timestamptz,
  nota_admin text,
  criado_em timestamptz not null default now(),
  constraint contestacoes_decisao_coerente check (
    (status = 'pendente' and decisao is null and decidido_em is null)
    or (status = 'analisada' and decisao is not null and decidido_em is not null)
  )
);

create index avaliacoes_contestacoes_fila_idx on public.avaliacoes_contestacoes (criado_em)
  where status = 'pendente';

alter table public.avaliacoes_contestacoes enable row level security;

-- O autor da avaliação também vê a contestação: ela é um argumento contra o
-- que ELE escreveu, e ele pode ser chamado a confirmar "problema solucionado"
-- logo em seguida. Deixá-lo no escuro seria julgar sem contraditório.
create policy "contestações: avaliado, autor da avaliação e admin" on public.avaliacoes_contestacoes
  for select to authenticated
  using (
    autor_id = (select auth.uid())
    or public.eh_admin()
    or exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.avaliador_id = (select auth.uid())
    )
  );

create policy "contestações: só o avaliado, e só nota 1 ou 2" on public.avaliacoes_contestacoes
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and status = 'pendente'
    and decisao is null
    and exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id
        and a.avaliado_id = (select auth.uid())
        and a.nota <= 2
    )
  );

-- Sem update/delete pro cliente: a decisão é do admin e entra pela RPC.

-- ===========================================================================
-- 6) "PROBLEMA SOLUCIONADO" (§14) — e a nota não muda por causa disso
-- ===========================================================================
-- §14: "Avaliado pode marcar 'Problema solucionado'; cliente confirma ou nega.
-- A nota não muda automaticamente."
-- A garantia de que a nota não muda é ESTRUTURAL: esta tabela não tem coluna
-- de nota, não existe trigger daqui pra `avaliacoes`, e o guarda de update lá
-- em cima só deixa o próprio autor mexer na nota. Ou seja: nem por acidente.
create table public.avaliacoes_solucoes (
  avaliacao_id uuid primary key references public.avaliacoes(id) on delete cascade,
  marcado_por uuid not null references public.profiles(id) on delete cascade,
  descricao text,
  marcado_em timestamptz not null default now(),
  -- null = o cliente ainda não respondeu.
  resposta text check (resposta in ('confirmado', 'negado')),
  respondido_em timestamptz
);

alter table public.avaliacoes_solucoes enable row level security;

create policy "soluções: enxerga quem enxerga a avaliação" on public.avaliacoes_solucoes
  for select to authenticated using (public.avaliacao_visivel(avaliacao_id));

create policy "soluções: o avaliado marca" on public.avaliacoes_solucoes
  for insert to authenticated
  with check (
    marcado_por = (select auth.uid())
    and resposta is null
    and exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.avaliado_id = (select auth.uid())
    )
  );

-- O cliente responde uma vez só (`resposta is null` no using) — e responder
-- não é reabrir a discussão indefinidamente.
create policy "soluções: o cliente confirma ou nega" on public.avaliacoes_solucoes
  for update to authenticated
  using (
    resposta is null
    and exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.avaliador_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.avaliacoes a
      where a.id = avaliacao_id and a.avaliador_id = (select auth.uid())
    )
  );

-- E o cliente só encosta nas duas colunas da resposta: sem isto ele poderia
-- reescrever a `descricao` que o avaliado deu do próprio atendimento.
revoke update on table public.avaliacoes_solucoes from authenticated;
grant update (resposta, respondido_em) on table public.avaliacoes_solucoes to authenticated;

-- ===========================================================================
-- 7) MODERAÇÃO (§14) — ponto único, e sem acesso à nota
-- ===========================================================================
-- "Admin analisa e pode Manter ou Ocultar por violação. Admin nunca altera a
-- nota." Esta função é o único caminho de escrita em `visibilidade`, e a
-- palavra `nota` não aparece no UPDATE — não é uma promessa, é o texto do
-- comando. Serve também pra ocultar sem contestação (denúncia por outro
-- canal): nesse caso não há linha em `avaliacoes_contestacoes` pra atualizar.
--
-- TODO (§21): quando o modelo de papéis do Admin estiver de pé, trocar
-- `eh_admin()` por "Suporte ou CEO". Hoje `eh_admin()` é o único conceito de
-- administrador que existe no banco.
create or replace function public.avaliacao_moderar(
  p_avaliacao_id uuid, p_decisao text, p_nota_admin text default null
)
returns public.avaliacoes
language plpgsql security definer set search_path = public as $$
declare
  v_row public.avaliacoes;
begin
  if not public.eh_admin() then
    raise exception 'sem_permissao';
  end if;
  if p_decisao not in ('manter', 'ocultar') then
    raise exception 'decisao_invalida';
  end if;

  -- A contestação não é apagada: ela guarda o veredito e quem o deu (§21.3,
  -- "toda ação administrativa relevante registra quem, quando, ação").
  update public.avaliacoes_contestacoes
     set status = 'analisada',
         decisao = p_decisao,
         decidido_por = auth.uid(),
         decidido_em = now(),
         nota_admin = coalesce(p_nota_admin, nota_admin)
   where avaliacao_id = p_avaliacao_id and status = 'pendente';

  update public.avaliacoes
     set visibilidade   = case when p_decisao = 'ocultar' then 'oculta_violacao' else 'publica' end,
         ocultada_em    = case when p_decisao = 'ocultar' then now() else null end,
         ocultada_por   = case when p_decisao = 'ocultar' then auth.uid() else null end,
         ocultacao_nota = case when p_decisao = 'ocultar' then p_nota_admin else null end
   where id = p_avaliacao_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'avaliacao_nao_encontrada';
  end if;
  return v_row;
end $$;
revoke all on function public.avaliacao_moderar(uuid, text, text) from public, anon;
grant execute on function public.avaliacao_moderar(uuid, text, text) to authenticated;

-- ===========================================================================
-- 7.1) Nada disto é público sem login
-- ===========================================================================
-- Todas as policies acima são `to authenticated`, então o `anon` já não passa.
-- O revoke é explícito mesmo assim: reputação é dado de gente identificável, e
-- uma policy futura escrita sem o `to authenticated` não deve virar vazamento
-- só porque o grant padrão do Supabase estava aberto.
revoke all on table public.avaliacoes from anon;
revoke all on table public.avaliacoes_respostas from anon;
revoke all on table public.avaliacoes_contestacoes from anon;
revoke all on table public.avaliacoes_solucoes from anon;

-- ===========================================================================
-- 8) GOLD POR PORTE (§16, §20) — o que faltava
-- ===========================================================================
-- A tabela de preço por porte JÁ existe desde a migration 033
-- (`gold_precos`), semeada com exatamente os valores de referência do §16 e
-- editável em /admin/gold/precos — que é o que o §20 exige ("preço não deve
-- ser hardcoded; configurável no Admin/Comercial"). "81+ pés" é
-- `valor_centavos = null`, e null ali significa SOB CONSULTA, não grátis:
-- `iniciarPagamentoGold` recusa gerar cobrança nesse caso.
--
-- O que faltava do §16 é outra frase: "Pode ser solicitado por proprietário,
-- VENDEDOR ou interessado/comprador". O check nascido na 033 só conhecia dois
-- papéis, e o vendedor (o corretor que quer o Gold pra vender melhor) não
-- tinha como se declarar — ficava obrigado a mentir "interessado".
alter table public.gold_solicitacoes drop constraint gold_solicitacoes_papel_solicitante_check;
alter table public.gold_solicitacoes add constraint gold_solicitacoes_papel_solicitante_check
  check (papel_solicitante in ('proprietario', 'vendedor', 'interessado'));

-- Vendedor e interessado entram pelo braço da embarcação NÃO cadastrada. O
-- braço da embarcação cadastrada continua exclusivo do proprietário: deixar
-- um "vendedor" pedir Gold do barco alheio já cadastrado seria abrir a ficha
-- de um terceiro a quem se autodeclara corretor.
drop policy "gold_solicitacoes: criar" on public.gold_solicitacoes;
create policy "gold_solicitacoes: criar" on public.gold_solicitacoes for insert
  with check (
    solicitante_id = auth.uid()
    and (
      (embarcacao_id is not null and papel_solicitante = 'proprietario' and public.eh_prop(embarcacao_id))
      or (embarcacao_id is null and papel_solicitante in ('vendedor', 'interessado'))
    )
  );

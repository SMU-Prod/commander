-- ============================================================================
-- 090 — A CONVERSA ENTRE AS DUAS PARTES MORA DENTRO DO APP
-- ============================================================================
-- ABRE: o pedido do dono — "as mensagens devem ser trocadas no próprio app".
--
-- NÃO É o §65 do PRD ("CHAT COMMANDER"). Aquele é falar com a EQUIPE Commander
-- (suporte) e o próprio PRD admite WhatsApp/Intercom para ele. Isto aqui é
-- outra coisa: conversa entre PESSOAS do app — quem publicou um pedido do
-- Marketplace e quem respondeu a ele. Nenhuma tabela deste arquivo serve
-- suporte, e nenhuma delas deve ganhar um participante que não seja uma das
-- duas partes de uma proposta.
--
-- O PROBLEMA
-- ----------
-- Hoje o Marketplace vai até a proposta e PARA. §22 libera o telefone quando a
-- proposta é aceita e a conversa sai do app pro WhatsApp. Com isso o Commander
-- perde exatamente o que ele vende — "o dossiê do seu barco" — na hora em que o
-- registro mais vale: o combinado. Quando as duas partes discordam depois
-- ("você disse que o prazo era 3 dias"), o app não tem nada a mostrar, e o §14
-- (avaliação, contestação) julga sem prova nenhuma.
--
-- O QUE ESTE ARQUIVO CRIA
-- -----------------------
--   conversas           uma por PROPOSTA, entre exatamente duas pessoas
--   mensagens           linhas imutáveis; só o autor apaga a própria
--   conversas_leitura   até onde CADA UM leu (estado de quem lê, não da linha)
--   conversa_minha()    "sou uma das duas partes desta conversa?"
--   conversa_par_valido() "este par (dono, parceiro) é o de uma proposta real?"
--   mensagem_so_apagar()  gatilho que torna a mensagem um registro
--   conversa_tocar()      gatilho que carimba a última atividade da conversa
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION, ESCRITO ANTES DE QUALQUER COMANDO
-- ============================================================================
-- Este é o dado mais privado que o Commander vai passar a guardar. Documento
-- vencido vazado é constrangimento; conversa comercial vazada é processo. E o
-- vazamento aqui tem a forma silenciosa de sempre: RLS larga demais não
-- levanta erro nenhum — ela simplesmente ENTREGA a linha, e ninguém percebe
-- até alguém ler a negociação de outra pessoa.
--
-- Por isso as três decisões abaixo, e cada uma tem um "não" explícito:
--
--   (a) NÃO EXISTE POLICY DE ADMIN, EM NENHUMA DAS TRÊS TABELAS.
--       `negocios`, `negocios_confirmacoes` e `avaliacoes` têm `or eh_admin()`
--       no SELECT, e está certo lá: o §21.1 manda o Admin medir volume
--       financeiro e o §14 manda ele MODERAR avaliação — as duas coisas são
--       impossíveis sem ler a linha. Aqui não há tarefa equivalente: não há
--       métrica que exija o TEXTO da conversa, e não há moderação de conversa
--       privada no PRD. Um `eh_admin()` aqui seria acesso sem consumidor — ou
--       seja, risco puro. Se um dia existir denúncia de abuso, o caminho é uma
--       tabela de DENÚNCIA que copia a mensagem denunciada (com o denunciante
--       declarando o que copiou), nunca uma policy que abre a caixa inteira.
--
--   (b) A LEITURA DO OUTRO É INVISÍVEL PARA MIM, POR RLS.
--       `conversas_leitura` só devolve a MINHA linha. Não é escolha de tela: é
--       o banco tornando impossível desenhar "visto às 14h". A regra da casa
--       proíbe status fabricado, e a forma mais segura de nunca fabricar um é
--       não conseguir ler o dado que o sustentaria.
--
--   (c) AS DUAS FKs DE `conversas` SÃO `on delete restrict`, NÃO `cascade`.
--       `demandas` tem policy de DELETE ("demandas: autor exclui a própria").
--       O app nunca a usa — `atualizarStatusDemanda` só muda status — mas um
--       DELETE direto no PostgREST existiria, e com `cascade` ele apagaria a
--       conversa junto. Ou seja: o autor do pedido teria um botão indireto pra
--       destruir o registro da negociação DO OUTRO. `restrict` fecha isso: a
--       demanda com conversa deixa de poder ser apagada de vez, que é
--       exatamente o que "o valor da conversa é ser registro" quer dizer.
--       Nada quebra por causa disso hoje, porque nada apaga demanda hoje.
--
-- IMPACTO NO ACESSO EXISTENTE: ZERO. Nenhuma policy de outra tabela é tocada,
-- nenhuma coluna existente muda, nenhuma linha é lida ou escrita. As três
-- tabelas nascem vazias.
--
-- Idempotente: `create table if not exists`, `create or replace function`,
-- `drop policy if exists` antes de cada `create policy`, `drop trigger if
-- exists` antes de cada `create trigger`.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. conversas — uma por PROPOSTA, e por que não uma por demanda
-- ---------------------------------------------------------------------------
-- A conversa nasce ancorada na PROPOSTA, não na demanda. Um pedido com três
-- respostas vira três conversas separadas, uma com cada pessoa — e é o único
-- desenho que fecha, porque:
--
--   · uma conversa por DEMANDA colocaria três prestadores concorrentes na
--     mesma sala, cada um lendo o preço do outro. É vazamento por modelagem,
--     e nenhuma policy conserta depois;
--   · a proposta é também o CONSENTIMENTO dos dois lados: quem publicou abriu
--     um pedido público, quem propôs escolheu responder. Ninguém puxa conversa
--     com um estranho — o par já existia antes da primeira mensagem;
--   · e o par de participantes é DERIVÁVEL dela (`demandas.autor_id` e
--     `propostas.autor_id`), o que permite a trava do INSERT lá embaixo.
--
-- `dono_id` e `parceiro_id` são cópias desses dois ids, e a cópia é
-- deliberada: a policy de SELECT tem de ser um teste na PRÓPRIA linha, sem
-- `exists` nenhum, senão toda leitura de mensagem paga dois JOINs e a RLS de
-- `demandas` (que expira!) passaria a decidir quem lê uma conversa antiga.
-- Conversa não expira com o anúncio. A trava contra cópia errada é a
-- `conversa_par_valido()` no INSERT.
--
-- ASSUNTO E NOMES SÃO CÓPIA, E A CÓPIA É O ÚNICO DESENHO QUE FUNCIONA.
--
-- O §11.2 diz que o Commander GERA o título do anúncio a partir dos campos, e
-- por isso `demandas` não tem coluna de título — gravado, ele congelaria o nome
-- de uma categoria que o Admin renomeasse depois. Aqui a conclusão se inverte,
-- por um fato de RLS:
--
--   a policy de SELECT de `demandas` é `autor_id = uid OR (status vivo AND
--   expira_em >= hoje_sp())`. Ou seja: **quando o pedido vence, quem RESPONDEU
--   deixa de conseguir ler a demanda.** Sem cópia, a conversa dele passaria a
--   exibir "pedido indisponível" no cabeçalho — justo depois do negócio
--   acontecer, que é quando o registro do combinado mais vale.
--
-- E há um segundo motivo, do mesmo tamanho: `profiles` tem RLS de "próprio ou
-- tripulação" (migration 008), então NENHUM JOIN devolve o nome do outro lado.
-- É exatamente por isso que `demandas.autor_nome` e `propostas.autor_nome` já
-- existem como cópia (migrations 038/046) — este arquivo segue o padrão da
-- casa, não inventa um.
--
-- O QUE A CÓPIA CUSTA, dito na cara: quem cria a conversa escreve os três
-- campos, então um POST feito à mão poderia escrever um `dono_nome` falso. O
-- mesmo vale hoje para `autor_nome`, e o estrago é o mesmo: nenhum — a mentira
-- não abre acesso a coisa alguma e só é exibida para a ÚNICA pessoa capaz de
-- detectá-la na hora (o dono, que conhece o próprio nome e o próprio pedido).
-- Trocar isso por uma trava no `with check` custaria um terceiro JOIN em toda
-- criação para proteger contra um ataque cujo prêmio é confundir a vítima.
create table if not exists public.conversas (
  id           uuid primary key default gen_random_uuid(),
  demanda_id   uuid not null references public.demandas(id)  on delete restrict,
  proposta_id  uuid not null references public.propostas(id) on delete restrict,
  dono_id      uuid not null references auth.users(id)       on delete cascade,
  parceiro_id  uuid not null references auth.users(id)       on delete cascade,
  -- O título gerado (`tituloDaDemanda`) no instante em que a conversa nasceu.
  assunto        text not null,
  dono_nome      text not null,
  parceiro_nome  text not null,
  criado_em            timestamptz not null default now(),
  -- Carimbo da última atividade. Existe pra ordenar a caixa de entrada sem um
  -- `max(criado_em)` agregado por linha; quem o mantém é o gatilho
  -- `conversa_tocar`, e NÃO existe policy de UPDATE nesta tabela — ou seja,
  -- ninguém consegue empurrar a própria conversa pro topo da lista alheia.
  ultima_mensagem_em   timestamptz not null default now(),
  -- Uma conversa por proposta. Sem isto, dois toques no botão "Conversar"
  -- criariam duas salas e metade do combinado ficaria em cada uma.
  constraint conversas_uma_por_proposta unique (proposta_id),
  -- Ninguém conversa consigo mesmo. A RLS de `propostas` já impede propor na
  -- própria demanda, então isto é cinto e suspensório — mas é barato e o custo
  -- de errar é uma sala com um participante só, que nenhuma tela sabe desenhar.
  constraint conversas_duas_pessoas_diferentes check (dono_id <> parceiro_id),
  -- Cópia vazia é pior que cópia: o cabeçalho da conversa ficaria em branco e
  -- ninguém saberia dizer se é bug de tela ou pedido sem nome.
  constraint conversas_assunto_preenchido check (
    char_length(btrim(assunto)) > 0
    and char_length(btrim(dono_nome)) > 0
    and char_length(btrim(parceiro_nome)) > 0
  )
);

-- ---------------------------------------------------------------------------
-- 2. mensagens — linhas de registro, não de rascunho
-- ---------------------------------------------------------------------------
-- `apagada_em` + `corpo = ''` é a marca de que existiu: a linha FICA, com
-- autor e horário, e o texto sai. Não é meio-termo por indecisão — é o que
-- separa "apaguei o telefone errado que colei" de "apaguei a frase que agora
-- me incrimina": nos dois casos o outro lado continua vendo que houve uma
-- mensagem sua, naquele minuto.
--
-- O CHECK amarra os dois estados um no outro para não existir linha meio-viva
-- (apagada com texto dentro, ou viva com texto vazio). Quem faz a transição é
-- o gatilho `mensagem_so_apagar`, que normaliza os dois campos de uma vez.
create table if not exists public.mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.conversas(id) on delete cascade,
  autor_id     uuid not null references auth.users(id)       on delete cascade,
  corpo        text not null,
  apagada_em   timestamptz,
  criado_em    timestamptz not null default now(),
  -- 2000 caracteres: é recado de negociação, não contrato. Acima disso a
  -- pessoa manda um arquivo — e anexo ficou fora da v1 de propósito (ver o
  -- rodapé deste arquivo).
  constraint mensagens_corpo_no_limite check (char_length(corpo) <= 2000),
  constraint mensagens_viva_ou_apagada check (
    (apagada_em is null     and char_length(btrim(corpo)) > 0)
    or
    (apagada_em is not null and corpo = '')
  )
);

-- ---------------------------------------------------------------------------
-- 3. conversas_leitura — "não lida" é estado de QUEM LÊ
-- ---------------------------------------------------------------------------
-- Duas pessoas na mesma conversa têm contagens diferentes, e é por isso que
-- isto NÃO é uma coluna `lida` em `mensagens`: lá, marcar como lida seria
-- ESCREVER na mensagem do outro, que é justamente o que o resto deste arquivo
-- proíbe.
--
-- É uma marca d'água por conversa (`lido_ate`), não uma linha por mensagem: a
-- conversa é de duas pessoas e estritamente cronológica, então "li até as
-- 14:32" responde a pergunta inteira com uma linha em vez de N.
--
-- A CHAVE É (usuario_id, conversa_id) NESSA ORDEM, e a ordem é a consulta: a
-- caixa de entrada pergunta "todas as minhas marcas" (`where usuario_id = eu`),
-- e só um índice que comece por `usuario_id` responde isso sem varrer a tabela.
create table if not exists public.conversas_leitura (
  conversa_id  uuid not null references public.conversas(id) on delete cascade,
  usuario_id   uuid not null references auth.users(id)       on delete cascade,
  lido_ate     timestamptz not null default now(),
  primary key (usuario_id, conversa_id)
);

-- ---------------------------------------------------------------------------
-- 4. Os índices que as consultas realmente pedem — e só eles
-- ---------------------------------------------------------------------------
-- Caixa de entrada: `where dono_id = eu or parceiro_id = eu order by
-- ultima_mensagem_em desc`. Um `or` sobre duas colunas diferentes não usa um
-- índice composto; usa DOIS índices num BitmapOr. Por isso são dois, e cada um
-- já carrega a ordenação no segundo termo.
create index if not exists conversas_do_dono_idx
  on public.conversas (dono_id, ultima_mensagem_em desc);
create index if not exists conversas_do_parceiro_idx
  on public.conversas (parceiro_id, ultima_mensagem_em desc);

-- A ficha do pedido pergunta "existe conversa para estas propostas?" com um
-- `in (...)`. `proposta_id` já tem índice único pela constraint; `demanda_id`
-- não tinha nenhum, e é por ele que a porta do Marketplace entra.
create index if not exists conversas_da_demanda_idx
  on public.conversas (demanda_id);

-- A thread inteira, em ordem — e também a contagem de não lidas, que filtra
-- `conversa_id = X and criado_em > lido_ate`. O mesmo índice serve as duas.
create index if not exists mensagens_da_conversa_idx
  on public.mensagens (conversa_id, criado_em);

-- FK sem índice do lado filho faz o `on delete cascade` varrer a tabela. A PK
-- começa por `usuario_id`, então `conversa_id` precisa do seu.
create index if not exists conversas_leitura_da_conversa_idx
  on public.conversas_leitura (conversa_id);

-- ---------------------------------------------------------------------------
-- 5. conversa_minha() — a pergunta que a RLS de mensagens faz o tempo todo
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER de propósito, e o motivo é o oposto do que parece: NÃO é
-- pra dar acesso a mais gente, é pra que a regra de quem lê mensagem pare de
-- depender da RLS de `conversas`. Escrita como `exists` cru dentro da policy,
-- toda mudança futura na visibilidade de `conversas` mudaria em silêncio quem
-- lê MENSAGEM — e "em silêncio" é a assinatura do vazamento que este arquivo
-- teme. Aqui a regra está escrita uma vez, e é `auth.uid() in (as duas
-- partes)`, sem intermediário.
--
-- `stable` (não `volatile`) para o planner poder chamá-la uma vez por linha em
-- vez de uma vez por avaliação; `set search_path` porque função SECURITY
-- DEFINER sem isso é escada pra escalonamento de privilégio.
create or replace function public.conversa_minha(p_conversa uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.conversas c
     where c.id = p_conversa
       and (select auth.uid()) in (c.dono_id, c.parceiro_id)
  );
$function$;

-- ---------------------------------------------------------------------------
-- 6. conversa_par_valido() — a trava que impede inventar um interlocutor
-- ---------------------------------------------------------------------------
-- Sem ela, alguém com um POST direto no PostgREST criaria uma conversa
-- declarando `parceiro_id` = qualquer usuário do app, e ganharia um canal
-- privado com um estranho. A policy de INSERT sozinha não fecha isso: ela só
-- sabe exigir que EU seja uma das duas partes — o outro lado seria escolhido
-- por quem escreve o POST.
--
-- SECURITY DEFINER porque a pergunta é sobre um FATO ("existe esta proposta,
-- desta demanda, com estes dois autores?") e não sobre o que o chamador
-- enxerga. Sem isso, o proponente não conseguiria abrir conversa depois que o
-- anúncio vencesse — a RLS de `demandas` esconde demanda expirada de quem não
-- é o autor, e a validação falharia por invisibilidade, não por falsidade.
--
-- `p.status <> 'retirada'`: quem retirou a proposta desistiu do negócio. Uma
-- conversa JÁ ABERTA continua legível (esta função não é consultada na
-- leitura, só no nascimento) — o que se fecha é abrir uma nova depois de
-- desistir.
--
-- Não é oráculo de dados: responde sim/não a quem já conhece os quatro uuids,
-- e não revela nenhum deles. Ainda assim o EXECUTE é revogado de `anon` — a
-- caixa de entrada é de gente logada.
create or replace function public.conversa_par_valido(
  p_demanda uuid, p_proposta uuid, p_dono uuid, p_parceiro uuid
)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
      from public.propostas p
      join public.demandas d on d.id = p.demanda_id
     where p.id = p_proposta
       and p.demanda_id = p_demanda
       and d.autor_id   = p_dono
       and p.autor_id   = p_parceiro
       and p.status <> 'retirada'
  );
$function$;

revoke execute on function public.conversa_minha(uuid) from anon;
revoke execute on function public.conversa_par_valido(uuid, uuid, uuid, uuid) from anon;

-- ---------------------------------------------------------------------------
-- 7. mensagem_so_apagar() — o gatilho que faz da mensagem um registro
-- ---------------------------------------------------------------------------
-- A policy de UPDATE consegue dizer "só o autor mexe". Ela NÃO consegue dizer
-- "só pode mexer neste campo, e só nesta direção", porque `with check` não
-- enxerga o valor ANTIGO da linha. Sem este gatilho, o autor reescreveria o
-- próprio `corpo` depois de o outro ter lido e respondido — e a conversa
-- deixaria de ser prova de coisa nenhuma.
--
-- Ele é deliberadamente autoritário: qualquer UPDATE que o autor faça vira
-- "apagar", com o carimbo e o esvaziamento decididos AQUI. Assim o cliente
-- não precisa (nem consegue) mandar `apagada_em` — data de apagamento é fato
-- do banco, não campo de formulário.
create or replace function public.mensagem_so_apagar()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.apagada_em is not null then
    raise exception 'Esta mensagem já foi apagada — mensagem apagada não muda mais.';
  end if;
  if new.id <> old.id
     or new.conversa_id <> old.conversa_id
     or new.autor_id <> old.autor_id
     or new.criado_em <> old.criado_em then
    raise exception 'Mensagem é registro: conversa, autor e horário não mudam.';
  end if;
  if new.apagada_em is null then
    raise exception 'A única alteração possível numa mensagem é apagar a sua própria.';
  end if;
  -- Normaliza os dois campos juntos: o CHECK da tabela exige o par, e deixar
  -- o cliente escolher os valores seria deixá-lo escolher a hora do próprio
  -- apagamento.
  new.apagada_em := now();
  new.corpo := '';
  return new;
end
$function$;

drop trigger if exists mensagem_so_apagar_trg on public.mensagens;
create trigger mensagem_so_apagar_trg
  before update on public.mensagens
  for each row execute function public.mensagem_so_apagar();

-- ---------------------------------------------------------------------------
-- 8. conversa_tocar() — quem carimba a última atividade
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER porque `conversas` NÃO TEM policy de UPDATE — e não vai
-- ter. Se o carimbo dependesse de uma policy, existiria um caminho para
-- alguém escrever direto em `ultima_mensagem_em`, e a ordem da caixa de
-- entrada do outro passaria a ser editável por fora da conversa.
--
-- Só sobe: `greatest` protege contra uma inserção com `criado_em` antigo
-- puxando a conversa para trás na lista.
create or replace function public.conversa_tocar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.conversas
     set ultima_mensagem_em = greatest(ultima_mensagem_em, new.criado_em)
   where id = new.conversa_id;
  return new;
end
$function$;

drop trigger if exists conversa_tocar_trg on public.mensagens;
create trigger conversa_tocar_trg
  after insert on public.mensagens
  for each row execute function public.conversa_tocar();

-- ---------------------------------------------------------------------------
-- 9. RLS — policy por policy, com o motivo de cada uma
-- ---------------------------------------------------------------------------
alter table public.conversas          enable row level security;
alter table public.mensagens          enable row level security;
alter table public.conversas_leitura  enable row level security;

-- --- conversas -------------------------------------------------------------
-- SELECT: as duas partes, e ninguém mais. Teste na própria linha, sem `exists`
-- e sem função: é a leitura mais quente do módulo (a caixa de entrada e o
-- cabeçalho de toda thread) e não há por que ela pagar um JOIN.
-- `(select auth.uid())` e não `auth.uid()` pelo motivo da migration 082: a
-- forma com subselect é avaliada UMA vez por consulta em vez de uma por linha.
drop policy if exists "conversas: só as duas partes" on public.conversas;
create policy "conversas: só as duas partes" on public.conversas
  for select to authenticated
  using ((select auth.uid()) in (dono_id, parceiro_id));

-- INSERT: dois testes, e os dois são necessários.
--   · `auth.uid() in (dono_id, parceiro_id)` — só participo de conversa minha;
--   · `conversa_par_valido(...)` — e o par não é inventado: existe a proposta,
--     ela é desta demanda, e os dois ids são os autores de verdade.
-- Os DOIS lados podem abrir. Quem publicou escolhe com quem falar (é o gesto
-- do §11.5), e quem propôs pode acrescentar informação sem esperar ser
-- escolhido — negar isso empurraria de volta pro WhatsApp exatamente o caso
-- que motivou o módulo.
drop policy if exists "conversas: nasce de uma proposta real" on public.conversas;
create policy "conversas: nasce de uma proposta real" on public.conversas
  for insert to authenticated
  with check (
    (select auth.uid()) in (dono_id, parceiro_id)
    and public.conversa_par_valido(demanda_id, proposta_id, dono_id, parceiro_id)
  );

-- SEM UPDATE E SEM DELETE, DE PROPÓSITO. A linha de conversa não tem nada que
-- alguém precise corrigir: os quatro ids vêm da proposta e o carimbo é do
-- gatilho. Sem policy de UPDATE, `ultima_mensagem_em` é intocável por fora;
-- sem policy de DELETE, ninguém apaga a sala com o registro do outro dentro.

-- --- mensagens -------------------------------------------------------------
-- SELECT: só quem está na conversa. Nem admin (ver (a) no cabeçalho).
drop policy if exists "mensagens: só quem está na conversa" on public.mensagens;
create policy "mensagens: só quem está na conversa" on public.mensagens
  for select to authenticated
  using (public.conversa_minha(conversa_id));

-- INSERT: escrevo como eu mesmo, numa conversa minha, e nasço viva.
-- `apagada_em is null` está aqui e não só no CHECK porque o CHECK aceitaria
-- uma linha que nascesse já apagada (corpo vazio) — uma mensagem fantasma que
-- ocupa lugar na thread sem nunca ter dito nada.
drop policy if exists "mensagens: escrevo como eu, na minha conversa" on public.mensagens;
create policy "mensagens: escrevo como eu, na minha conversa" on public.mensagens
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and apagada_em is null
    and public.conversa_minha(conversa_id)
  );

-- UPDATE: só o autor, e só a própria. O QUE ele pode fazer com esse update é
-- assunto do gatilho `mensagem_so_apagar` — a policy diz QUEM, o gatilho diz O
-- QUÊ. Separado assim porque `with check` não enxerga a linha antiga, e sem o
-- gatilho esta policy autorizaria reescrever o texto.
-- `conversa_minha` também entra: se um dia alguém sair de uma conversa, o
-- autor não continua mexendo em mensagem de sala que não é mais dele.
drop policy if exists "mensagens: o autor só apaga a própria" on public.mensagens;
create policy "mensagens: o autor só apaga a própria" on public.mensagens
  for update to authenticated
  using (autor_id = (select auth.uid()) and public.conversa_minha(conversa_id))
  with check (autor_id = (select auth.uid()));

-- SEM DELETE. Apagar é o UPDATE acima, que deixa a marca. Um DELETE de
-- verdade tiraria a linha da thread e o outro lado veria a conversa mudar de
-- forma sem explicação — que é a diferença entre "apagou o que disse" e
-- "reescreveu a história".

-- --- conversas_leitura -----------------------------------------------------
-- SELECT: só a MINHA marca. É esta linha que torna "visto às 14h"
-- impossível de desenhar, em vez de apenas proibido (ver (b) no cabeçalho).
drop policy if exists "leitura: só a minha marca" on public.conversas_leitura;
create policy "leitura: só a minha marca" on public.conversas_leitura
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists "leitura: marco a minha, na minha conversa" on public.conversas_leitura;
create policy "leitura: marco a minha, na minha conversa" on public.conversas_leitura
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and public.conversa_minha(conversa_id)
  );

-- UPDATE existe porque a marca AVANÇA a cada visita — é o único dado deste
-- módulo que muda de valor legitimamente.
drop policy if exists "leitura: avanço a minha marca" on public.conversas_leitura;
create policy "leitura: avanço a minha marca" on public.conversas_leitura
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- SEM DELETE: apagar a própria marca só serviria pra "marcar tudo como não
-- lido", que o produto não oferece. Quando oferecer, a policy nasce junto com
-- a tela.

-- ---------------------------------------------------------------------------
-- TRAVA — nada disto passa se uma policy tiver ficado pra trás
-- ---------------------------------------------------------------------------
-- Mesmo espírito da 083: `drop policy if exists` com nome errado não falha,
-- ele não faz nada. Aqui o risco maior é o inverso — uma policy NÃO ter sido
-- criada (erro de digitação no nome da tabela, por exemplo) e o módulo subir
-- com RLS ligada e nenhuma regra, ou com uma regra a menos. Três dos nomes
-- carregam acento (`só`, `está`, `própria`), que é onde esse erro nasce.
do $$
declare
  v_conversas int;
  v_mensagens int;
  v_leitura   int;
  v_rls       int;
begin
  select count(*) into v_conversas from pg_policies
   where schemaname = 'public' and tablename = 'conversas';
  select count(*) into v_mensagens from pg_policies
   where schemaname = 'public' and tablename = 'mensagens';
  select count(*) into v_leitura from pg_policies
   where schemaname = 'public' and tablename = 'conversas_leitura';

  if v_conversas <> 2 then
    raise exception 'ABORTADO: conversas ficou com % policies (esperado 2: select + insert).', v_conversas;
  end if;
  if v_mensagens <> 3 then
    raise exception 'ABORTADO: mensagens ficou com % policies (esperado 3: select + insert + update).', v_mensagens;
  end if;
  if v_leitura <> 3 then
    raise exception 'ABORTADO: conversas_leitura ficou com % policies (esperado 3: select + insert + update).', v_leitura;
  end if;

  -- RLS ligada nas três. Tabela nova com policy e SEM `enable row level
  -- security` é o pior dos dois mundos: parece protegida na revisão do
  -- arquivo e devolve tudo para todo mundo em produção.
  select count(*) into v_rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('conversas','mensagens','conversas_leitura')
     and c.relrowsecurity;
  if v_rls <> 3 then
    raise exception 'ABORTADO: só % das 3 tabelas do módulo estão com RLS ligada.', v_rls;
  end if;

  -- Nenhuma das três pode ter policy que mencione admin. É a decisão (a) do
  -- cabeçalho, verificada em vez de só escrita: um `or eh_admin()` colado aqui
  -- numa migration futura passa despercebido numa revisão de diff grande.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('conversas','mensagens','conversas_leitura')
       and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%eh_admin%'
  ) then
    raise exception 'ABORTADO: alguma policy do módulo de conversa cita eh_admin(). Conversa privada não tem leitor administrativo — ver a decisão (a) no cabeçalho da 090.';
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) As oito policies, e SÓ elas. Nenhuma linha a mais, nenhuma com `ALL`:
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'public'
--    and tablename in ('conversas','mensagens','conversas_leitura')
--  order by tablename, cmd, policyname;
--    Esperado (8 linhas):
--      conversas          | conversas: nasce de uma proposta real          | INSERT
--      conversas          | conversas: só as duas partes                   | SELECT
--      conversas_leitura  | leitura: marco a minha, na minha conversa      | INSERT
--      conversas_leitura  | leitura: só a minha marca                      | SELECT
--      conversas_leitura  | leitura: avanço a minha marca                  | UPDATE
--      mensagens          | mensagens: escrevo como eu, na minha conversa  | INSERT
--      mensagens          | mensagens: só quem está na conversa            | SELECT
--      mensagens          | mensagens: o autor só apaga a própria          | UPDATE
--
-- 2) RLS ligada e forçada nas três:
-- select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname='public' and relname in ('conversas','mensagens','conversas_leitura');
--    Os três `relrowsecurity` têm de ser `t`.
--
-- 3) O TESTE QUE IMPORTA — VAZAMENTO. Com DUAS contas reais e uma TERCEIRA de
--    fora, e é este passo que decide se a migration está certa:
--    · conta A publica um pedido; conta B responde; A abre a conversa e as
--      duas trocam mensagem. As duas veem as duas mensagens.
--    · conta C (logada, sem relação nenhuma) chama:
--        select count(*) from conversas;   -- tem de voltar 0
--        select count(*) from mensagens;   -- tem de voltar 0
--      Zero, não erro: RLS não recusa, ela devolve vazio. Se voltar 1, PARE e
--      reverta.
--    · conta C tenta ler a conversa pelo id (que ela obteria de um link
--      compartilhado por engano):
--        select * from mensagens where conversa_id = '<id da conversa de A e B>';
--      Zero linhas.
--    · conta B tenta ver a marca de leitura de A:
--        select * from conversas_leitura;  -- só a linha de B, nunca a de A
--
-- 4) A IMUTABILIDADE, com login real (conta A, na própria mensagem):
--      update mensagens set corpo = 'outra coisa' where id = '<msg de A>';
--        -> erro "A única alteração possível numa mensagem é apagar a sua própria."
--      update mensagens set apagada_em = now() where id = '<msg de A>';
--        -> sucesso; a linha fica com corpo = '' e apagada_em carimbado
--      update mensagens set apagada_em = now() where id = '<a mesma>';
--        -> erro "Esta mensagem já foi apagada"
--      update mensagens set apagada_em = now() where id = '<msg de B>';
--        -> 0 linhas (a policy nem deixa achar), nunca erro
--      delete from mensagens where id = '<msg de A>';
--        -> 0 linhas: não há policy de DELETE
--
-- 5) A trava do interlocutor inventado (conta A, com um uuid qualquer de
--    outro usuário no lugar de `parceiro_id`):
--      insert into conversas (demanda_id, proposta_id, dono_id, parceiro_id)
--      values ('<demanda de A>', '<proposta de B>', '<A>', '<C>');
--        -> recusado pela policy (`conversa_par_valido` devolve false)
--
-- 6) O carimbo de atividade não é editável por fora:
--      update conversas set ultima_mensagem_em = now() where id = '<a conversa>';
--        -> 0 linhas: não há policy de UPDATE em `conversas`
--
-- 7) Os índices existem e a caixa de entrada os usa:
-- explain (analyze, buffers)
--   select * from conversas
--    where dono_id = auth.uid() or parceiro_id = auth.uid()
--    order by ultima_mensagem_em desc;
--    Esperado: BitmapOr sobre `conversas_do_dono_idx` e
--    `conversas_do_parceiro_idx`, nunca Seq Scan.
--
-- ---------------------------------------------------------------------------
-- REVERSÃO
-- ---------------------------------------------------------------------------
-- APAGA DADO: as três tabelas saem inteiras, e com elas toda conversa já
-- trocada. Faça o dump antes se já houver linha:
--   \copy (select * from public.conversas)         to 'conversas.csv'  csv header
--   \copy (select * from public.mensagens)         to 'mensagens.csv'  csv header
--   \copy (select * from public.conversas_leitura) to 'leitura.csv'    csv header
--
-- begin;
--   drop trigger if exists conversa_tocar_trg    on public.mensagens;
--   drop trigger if exists mensagem_so_apagar_trg on public.mensagens;
--   drop table if exists public.conversas_leitura;
--   drop table if exists public.mensagens;
--   drop table if exists public.conversas;
--   drop function if exists public.conversa_tocar();
--   drop function if exists public.mensagem_so_apagar();
--   drop function if exists public.conversa_par_valido(uuid, uuid, uuid, uuid);
--   drop function if exists public.conversa_minha(uuid);
-- commit;
--
-- Ordem importa: `conversas_leitura` e `mensagens` apontam para `conversas`.
-- As funções saem por último porque as policies das tabelas dependem delas.
--
-- ---------------------------------------------------------------------------
-- O QUE FICOU DE FORA DESTA MIGRATION, E POR QUÊ
-- ---------------------------------------------------------------------------
-- · ANEXO (foto do defeito, PDF do orçamento). Exige bucket próprio no
--   Storage com policy espelhando `conversa_minha` — um segundo sistema de
--   permissão para o mesmo dado, e o Storage do Supabase é onde um erro de
--   policy vira URL pública. Fora da v1; entra quando alguém pedir, com a
--   policy do bucket escrita no mesmo commit.
-- · REALTIME. `mensagens` NÃO foi adicionada à publication
--   `supabase_realtime`, e é decisão: a tela se atualiza por recarga
--   declarada (ver `components/mensagens/atualizacao-viva.tsx`). Realtime
--   ligado e falhando em silêncio produz exatamente a tela que parece viva e
--   não é — o defeito que a regra da casa proíbe. Quando entrar, entra com o
--   canal autorizado por RLS e com a tela dizendo quando a conexão caiu.
-- · CONVERSA FORA DO MARKETPLACE (dono ↔ tripulante, dono ↔ cotista). O
--   modelo é ancorado na proposta de propósito: é ela que dá o consentimento
--   dos dois lados. Outro contexto precisa da própria âncora, não de um
--   `conversas.contexto_tipo` genérico que aceitaria qualquer par.

-- =====================================================================
-- Onda 72 · MECÂNICA, ORÇAMENTOS E VOTAÇÃO.
-- PRD-UPGRADE-3-COTAS §7 e §9. Primeiro P1 do Enterprise.
--
-- O §7 abre com a trava de escopo: "Módulo simples e objetivo; NÃO CRIAR
-- ERP DE OFICINA." O que não está aqui saiu por causa dessa frase: ordem
-- de serviço numerada, apontamento de mão de obra por hora, fila de
-- bancada, faturamento. O Commander registra o que foi feito no barco;
-- quem gerencia a oficina é a oficina.
--
-- ---------------------------------------------------------------------
-- A POLICY MAIS IMPORTANTE DESTE ARQUIVO
-- ---------------------------------------------------------------------
-- §7, repetido nos critérios de aceite do §25: "Todo registro da Mecânica
-- vai ao ADM antes de ser publicado aos cotistas" / "Mecânica NUNCA
-- publica diretamente aos cotistas."
--
-- Isso vira `servicos_mecanica.publicado_em` + a policy de leitura:
--
--   quem EDITA motores (mecânico, ADM)  → vê tudo, publicado ou não
--   quem só VÊ motores (cotista)        → vê SÓ o que tem publicado_em
--
-- Ou seja: a barreira mora no banco, não numa tela que esconde botão. Um
-- cotista que chame a API direto continua sem enxergar laudo não
-- publicado — que é o que o §22 exige ao dizer "permissões aplicadas no
-- backend".
--
-- ---------------------------------------------------------------------
-- VOTAÇÃO — O QUE O BANCO GARANTE E O QUE ELE SE RECUSA A DECIDIR
-- ---------------------------------------------------------------------
-- Garante: um voto por cotista (`unique (votacao_id, votante_id)`), uma
-- votação por orçamento (`orcamento_id unique`), voto só em nome próprio,
-- só de quem é COTISTA daquela unidade, só enquanto a votação está aberta,
-- e só se o acesso não estiver suspenso (§13 — inadimplente suspenso não
-- vota).
--
-- Recusa-se a decidir: NÃO existe coluna de "resultado". O §9 fecha
-- dizendo que "o Commander não executa pagamento e NÃO DETERMINA
-- JURIDICAMENTE O QUÓRUM da empresa" — em algumas cotas basta maioria, em
-- outras exige-se unanimidade, em outras o administrador decide sozinho.
-- Gravar "aprovada" seria o app decidindo por um contrato de sociedade que
-- ele não conhece. O banco guarda os VOTOS; a leitura (`apurarVotacao` em
-- lib/domain/mecanica.ts) só carimba o único caso que o §9 autoriza, que é
-- a unanimidade.
--
-- Sem policy de `delete` em `votos`: voto dado é fato, e apagar voto
-- esvaziaria a auditoria que o §9 pede ("votos mantêm usuário, data/hora e
-- auditoria").
-- =====================================================================

create table public.servicos_mecanica (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  -- De onde veio o serviço (§8: a avaria origina a manutenção).
  ocorrencia_id uuid references public.ocorrencias(id) on delete set null,
  -- Os campos do §7, na ordem em que ele os lista.
  problema_informado text,
  diagnostico text,
  conserto text,
  horas numeric,
  entrada_em date,
  inicio_em date,
  conclusao_em date,
  anexo_path text,
  estado text not null default 'em_diagnostico'
    check (estado in ('em_diagnostico','em_conserto','aguardando_peca','concluido')),
  -- Ver o cabeçalho: é esta coluna que separa o cotista do laudo cru.
  publicado_em timestamptz,
  publicado_por uuid references public.profiles(id) on delete set null,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index servicos_mecanica_embarcacao_idx
  on public.servicos_mecanica (embarcacao_id, criado_em desc);
-- O painel do ADM pergunta "quantas unidades estão na mecânica agora".
create index servicos_mecanica_abertos_idx
  on public.servicos_mecanica (embarcacao_id) where estado <> 'concluido';

create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  servico_id uuid references public.servicos_mecanica(id) on delete set null,
  -- Os campos que o §9 lista para o orçamento.
  problema text,
  servico_proposto text not null,
  fornecedor text,
  pecas text,
  valor_centavos bigint check (valor_centavos is null or valor_centavos >= 0),
  valido_ate date,
  anexo_path text,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index orcamentos_embarcacao_idx on public.orcamentos (embarcacao_id, criado_em desc);

create table public.votacoes (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  -- Uma votação por orçamento: votar duas vezes o mesmo preço confundiria
  -- qualquer apuração.
  orcamento_id uuid not null unique references public.orcamentos(id) on delete cascade,
  aberta_por uuid references public.profiles(id) on delete set null,
  aberta_em timestamptz not null default now(),
  encerrada_em timestamptz
  -- Ver o cabeçalho: sem coluna de resultado, de propósito.
);

create index votacoes_embarcacao_idx on public.votacoes (embarcacao_id, aberta_em desc);

create table public.votos (
  id uuid primary key default gen_random_uuid(),
  votacao_id uuid not null references public.votacoes(id) on delete cascade,
  votante_id uuid not null references public.profiles(id) on delete cascade,
  -- §9: "APROVAR ou NÃO APROVAR. Sem comentários no voto." Não há coluna
  -- de comentário: o §9 dá ao cotista o Chat com a administradora
  -- justamente pra dúvida não virar debate dentro do voto.
  voto text not null check (voto in ('aprovar','nao_aprovar')),
  votado_em timestamptz not null default now(),
  unique (votacao_id, votante_id)
);

alter table public.servicos_mecanica enable row level security;
alter table public.orcamentos enable row level security;
alter table public.votacoes enable row level security;
alter table public.votos enable row level security;

-- A barreira do §7/§25, no banco. Ver o cabeçalho.
create policy "servicos_mecanica: quem ve motores le o publicado ou proprio" on public.servicos_mecanica
  for select to authenticated
  using (
    public.permissao(embarcacao_id, 'motores', 'editar')
    or (publicado_em is not null and public.permissao(embarcacao_id, 'motores', 'ver'))
  );

create policy "servicos_mecanica: quem edita motores registra" on public.servicos_mecanica
  for insert to authenticated
  with check (public.permissao(embarcacao_id, 'motores', 'editar'));

create policy "servicos_mecanica: quem edita motores atualiza" on public.servicos_mecanica
  for update to authenticated
  using (public.permissao(embarcacao_id, 'motores', 'editar'))
  with check (public.permissao(embarcacao_id, 'motores', 'editar'));

-- Orçamento é preço, não laudo: quem vê motores vê. O que o cotista faz com
-- ele (votar) tem regra própria abaixo.
create policy "orcamentos: quem ve motores le" on public.orcamentos
  for select to authenticated
  using (public.permissao(embarcacao_id, 'motores', 'ver'));

create policy "orcamentos: quem edita motores cria" on public.orcamentos
  for insert to authenticated
  with check (public.permissao(embarcacao_id, 'motores', 'editar'));

create policy "orcamentos: quem edita motores atualiza" on public.orcamentos
  for update to authenticated
  using (public.permissao(embarcacao_id, 'motores', 'editar'))
  with check (public.permissao(embarcacao_id, 'motores', 'editar'));

-- §9: "O ADM pode criar uma votação". Abrir e encerrar é do dono da conta.
create policy "votacoes: quem ve a embarcacao le" on public.votacoes
  for select to authenticated
  using (public.pode_ver_embarcacao(embarcacao_id));

create policy "votacoes: so o dono abre" on public.votacoes
  for insert to authenticated
  with check (public.eh_prop(embarcacao_id));

create policy "votacoes: so o dono encerra" on public.votacoes
  for update to authenticated
  using (public.eh_prop(embarcacao_id))
  with check (public.eh_prop(embarcacao_id));

create policy "votos: quem ve a votacao le" on public.votos
  for select to authenticated
  using (exists (
    select 1 from public.votacoes v
    where v.id = votos.votacao_id and public.pode_ver_embarcacao(v.embarcacao_id)
  ));

-- Cinco condições numa policy só, e cada uma sai de uma linha do PRD: em
-- nome próprio, votação aberta, é cotista DESTA unidade, e não está
-- suspenso (§13 — inadimplente suspenso não vota). A sexta (um voto só) é
-- o `unique` da tabela.
create policy "votos: cotista vota uma vez, em nome proprio" on public.votos
  for insert to authenticated
  with check (
    votante_id = auth.uid()
    and exists (
      select 1 from public.votacoes vt
      join public.vinculos vi on vi.embarcacao_id = vt.embarcacao_id
      where vt.id = votos.votacao_id
        and vt.encerrada_em is null
        and vi.usuario_id = auth.uid()
        and vi.papel = 'COTISTA'
        and vi.suspenso_em is null
    )
  );

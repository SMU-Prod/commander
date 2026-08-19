-- =====================================================================
-- Ondas 75 e 77 · ENVIOS DO COTISTA E AFAZERES.
-- PRD-UPGRADE-3-COTAS §14, §15 (plano do cotista) e §20, §21 (afazeres).
--
-- ---------------------------------------------------------------------
-- 1. ENVIOS DO COTISTA (§15) — UM PEDIDO, NUNCA UM FATO
-- ---------------------------------------------------------------------
-- §15: "NADA enviado pelo cotista altera automaticamente o registro
-- oficial." E: "Manter procedência: informado por cotista X; incorporado
-- por ADM Y."
--
-- É por isso que `envios_cotista` é uma TABELA SEPARADA e não uma escrita
-- direta em `eventos`, `equipamentos` ou `ocorrencias`. Se o envio do
-- cotista pudesse tocar a ficha da unidade, dez cotistas com opiniões
-- diferentes sobre o horímetro escreveriam por cima uns dos outros — e a
-- administradora perderia a única versão pela qual ela responde.
--
-- O caminho é sempre: cotista envia → fica `aguardando` → o ADM decide
-- (`acao`) → vira `incorporado` ou `arquivado`, com `decidido_por` e
-- `decidido_em`. As duas pontas da procedência ficam gravadas.
--
-- A policy de INSERT exige `papel = 'COTISTA'` E `suspenso_em is null`:
-- quem teve o acesso suspenso por inadimplência (§13) não envia nada — do
-- contrário a suspensão seria só visual.
--
-- E só o dono faz UPDATE: o cotista não pode "desarquivar" o próprio
-- envio nem mudar a decisão do ADM.
--
-- ---------------------------------------------------------------------
-- 2. AFAZERES (§20) — E UMA CORREÇÃO AO PRD
-- ---------------------------------------------------------------------
-- O §20 diz "reaproveitar módulo de Afazeres JÁ EXISTENTE". Não existe
-- módulo de Afazeres no Commander e nunca existiu — isto é construção, não
-- adaptação. Fica registrado porque a diferença muda a estimativa de quem
-- ler o PRD sem abrir o código.
--
-- `embarcacao_id` é NULLABLE de propósito: nem toda tarefa é de uma
-- unidade ("comprar filtros para a base", "levar a van para revisão"). O
-- que nunca é nulo é `dono_id` — a lista é da empresa, e é por ela que a
-- RLS decide, como o estoque da onda 73.
--
-- `origem_tipo`/`origem_id` guardam a manutenção ou avaria que virou
-- tarefa (§20: "manutenção/avaria pode ser convertida em afazer"). Ficam
-- nulos na tarefa criada do zero.
--
-- O QUE ESTA MIGRATION NÃO FAZ, e é o ponto do §20: não há trigger
-- nenhum criando afazer a partir de alerta. "Não gerar automaticamente uma
-- tarefa para cada alerta" — uma frota de 40 unidades produz dezenas de
-- alertas por semana, e a lista viraria coisa que ninguém aceitou fazer.
-- Alerta é aviso; afazer é compromisso. A conversão existe e passa por
-- gente (`converterEmAfazer`, no domínio).
-- =====================================================================

create table public.envios_cotista (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  cotista_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('uso','ocorrencia','observacao')),
  texto text,
  horas numeric,
  combustivel_pct int check (combustivel_pct between 0 and 100),
  foto_path text,
  estado text not null default 'aguardando'
    check (estado in ('aguardando','incorporado','arquivado')),
  -- A segunda ponta da procedência do §15.
  decidido_por uuid references public.profiles(id) on delete set null,
  decidido_em timestamptz,
  -- As seis ações que o §15 dá ao ADM.
  acao text check (acao in (
    'adicionar_a_unidade','atualizar_horas','criar_avaria',
    'adicionar_observacao','incorporar_ao_historico','arquivar'
  )),
  criado_em timestamptz not null default now()
);

create index envios_cotista_embarcacao_idx
  on public.envios_cotista (embarcacao_id, criado_em desc);
-- O hub do ADM abre na fila do que ainda não foi analisado.
create index envios_cotista_aguardando_idx
  on public.envios_cotista (embarcacao_id) where estado = 'aguardando';

alter table public.envios_cotista enable row level security;

create policy "envios: o cotista le os proprios, o dono le todos" on public.envios_cotista
  for select to authenticated
  using (cotista_id = auth.uid() or public.eh_prop(embarcacao_id));

-- Ver o cabeçalho: cotista suspenso não envia.
create policy "envios: cotista envia em nome proprio" on public.envios_cotista
  for insert to authenticated
  with check (
    cotista_id = auth.uid()
    and exists (
      select 1 from public.vinculos v
      where v.embarcacao_id = envios_cotista.embarcacao_id
        and v.usuario_id = auth.uid()
        and v.papel = 'COTISTA'
        and v.suspenso_em is null
    )
  );

create policy "envios: so o dono decide" on public.envios_cotista
  for update to authenticated
  using (public.eh_prop(embarcacao_id))
  with check (public.eh_prop(embarcacao_id));

create table public.afazeres (
  id uuid primary key default gen_random_uuid(),
  -- Nulo quando a tarefa não é de uma unidade ("comprar filtros pra base").
  embarcacao_id uuid references public.embarcacoes(id) on delete cascade,
  dono_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null,
  detalhe text,
  destino text not null default 'qualquer' check (destino in ('operacoes','mecanica','qualquer')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  prazo date,
  estado text not null default 'aberto' check (estado in ('aberto','em_andamento','concluido')),
  -- §20: manutenção/avaria convertida em tarefa. Nulo na tarefa do zero.
  origem_tipo text check (origem_tipo in ('manutencao','avaria')),
  origem_id uuid,
  criado_por uuid references public.profiles(id) on delete set null,
  concluido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index afazeres_dono_idx on public.afazeres (dono_id, estado, criado_em desc);
create index afazeres_abertos_idx on public.afazeres (dono_id) where estado <> 'concluido';

alter table public.afazeres enable row level security;

-- Quem executa precisa enxergar e atualizar o que é dele — daí
-- `responsavel_id` entrar no SELECT e no UPDATE. Apagar continua só do dono:
-- tarefa some da lista de quem mandou fazer, não de quem foi mandado.
create policy "afazeres: dono e responsavel leem" on public.afazeres
  for select to authenticated
  using (dono_id = auth.uid() or responsavel_id = auth.uid());

create policy "afazeres: o dono cria" on public.afazeres
  for insert to authenticated
  with check (dono_id = auth.uid());

create policy "afazeres: dono e responsavel atualizam" on public.afazeres
  for update to authenticated
  using (dono_id = auth.uid() or responsavel_id = auth.uid())
  with check (dono_id = auth.uid() or responsavel_id = auth.uid());

create policy "afazeres: so o dono apaga" on public.afazeres
  for delete to authenticated
  using (dono_id = auth.uid());

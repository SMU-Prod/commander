-- =====================================================================
-- Onda 69 · ENTERPRISE P0 — perfis, régua de aprovação e auditoria.
-- PRD-UPGRADE-3-COTAS §3, §22 e §24 (fase "P0 — Base Enterprise").
--
-- ---------------------------------------------------------------------
-- 1. OS CINCO PERFIS (§3)
-- ---------------------------------------------------------------------
-- `vinculos.papel` vinha da migration 001 aceitando dois valores: PROP e
-- CMDT. O Enterprise pede cinco a mais — ADM Geral, ADM, Operações,
-- Mecânica e Cotista.
--
-- Trocar o `check` é aditivo por construção: nenhum vínculo existente
-- muda de valor, e as policies que já dizem `papel = 'PROP'` simplesmente
-- não casam com os papéis novos. Isso é o comportamento DESEJADO — papel
-- novo nasce sem privilégio nenhum e só ganha acesso pelo jsonb de
-- `permissoes`, que é onde o acesso mora desde a onda 32.
--
-- Os presets de cada perfil vivem em `web/lib/domain/enterprise.ts`
-- (`PRESET_ENTERPRISE`), com teste. Não há sistema de permissão novo: o
-- perfil Enterprise é um recorte da MESMA matriz de 15 áreas que
-- `completo`/`operacional` já usam. Dois sistemas dariam duas verdades
-- sobre quem pode o quê — e a onda 63 já mostrou o preço disso.
--
-- ---------------------------------------------------------------------
-- 2. A RÉGUA DE APROVAÇÃO (§3)
-- ---------------------------------------------------------------------
-- "O ADM controla a régua de confiança por usuário e/ou ação." O PRD dá o
-- exemplo: horas lançadas por funcionário experiente entram direto;
-- funcionário novo pode exigir conferência 1 a 1.
--
-- Mora no VÍNCULO (e não no perfil) exatamente por isso: dois membros de
-- Operações na mesma empresa podem ter réguas diferentes. `default
-- 'sem_aprovacao'` mantém todo vínculo existente funcionando igual —
-- ninguém acorda com lançamento pendente por causa desta migration.
--
-- O que a coluna NÃO decide: a publicação da Mecânica pro cotista. O §7 e
-- o §25 dizem que ela SEMPRE passa pelo ADM, "mesmo que o mecânico seja
-- confiável" — então `exigeAprovacao` (enterprise.ts) checa essa exceção
-- ANTES do modo, e nem 'sem_aprovacao' a libera.
--
-- ---------------------------------------------------------------------
-- 3. A AUDITORIA (§22)
-- ---------------------------------------------------------------------
-- O §22 lista o que precisa ficar registrado: autor e data/hora em todo
-- lançamento; antes/depois nas alterações relevantes; quem aprovou e
-- quando; qual ADM publicou; bloqueio/desbloqueio de cotista; e motivo
-- nos ajustes de tanque/estoque que gerarem divergência. Uma tabela
-- cobre os seis, com `antes`/`depois` em jsonb e `motivo` texto.
--
-- A POLICY QUE FALTA É DE PROPÓSITO: não existe policy de `update` nem de
-- `delete`. Com RLS ligada, ausência de policy é negação — ou seja, a
-- trilha é APPEND-ONLY para qualquer usuário autenticado, inclusive o ADM
-- Geral. Trilha de auditoria que o auditado pode editar não é trilha.
-- (Manutenção e correção de dados continuam possíveis pelo service role,
-- fora do alcance do app.)
--
-- `autor_id` é `on delete set null` e não `cascade`: se a pessoa sair da
-- plataforma, o REGISTRO do que ela fez continua — some o nome, não o
-- fato. Cascade apagaria justamente o histórico que o §22 manda manter.
-- =====================================================================

alter table public.vinculos drop constraint vinculos_papel_check;
alter table public.vinculos add constraint vinculos_papel_check
  check (papel in ('PROP','CMDT','ADM_GERAL','ADM','OPERACOES','MECANICA','COTISTA'));

alter table public.vinculos
  add column modo_aprovacao text not null default 'sem_aprovacao'
    check (modo_aprovacao in ('sem_aprovacao','somente_criticos','tudo'));

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  -- Ver o cabeçalho: `set null`, nunca `cascade`.
  autor_id uuid references public.profiles(id) on delete set null,
  evento text not null check (evento in (
    'criou','alterou','excluiu','aprovou','recusou',
    'publicou_para_cotistas','bloqueou_cotista','desbloqueou_cotista',
    'ajustou_com_divergencia'
  )),
  -- Que tabela sofreu a ação ("ocorrencias", "itens_monitorados"...) e qual
  -- linha. `entidade_id` nullable porque nem todo evento tem linha (um
  -- bloqueio de cotista tem pessoa, não registro).
  entidade text not null,
  entidade_id uuid,
  -- Quem/o que sofreu a ação, em texto legível: "João Lima" no bloqueio.
  alvo text,
  antes jsonb,
  depois jsonb,
  -- §22: obrigatório quando o ajuste gera divergência. A obrigatoriedade é
  -- da ação (`exigeMotivoDeAjuste`, com teste), não uma constraint aqui —
  -- a coluna serve a nove eventos e só um deles exige motivo.
  motivo text,
  criado_em timestamptz not null default now()
);

create index auditoria_embarcacao_idx on public.auditoria (embarcacao_id, criado_em desc);
create index auditoria_entidade_idx on public.auditoria (entidade, entidade_id);

alter table public.auditoria enable row level security;

create policy "auditoria: quem tem acesso a embarcacao le" on public.auditoria
  for select to authenticated
  using (exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = auditoria.embarcacao_id and v.usuario_id = auth.uid()
  ));

-- `autor_id = auth.uid()` no `with check`: ninguém registra evento em nome
-- de outra pessoa. Sem isso, a trilha poderia ser forjada por quem tem
-- acesso à embarcação — o que a esvaziaria como prova.
create policy "auditoria: registra em nome proprio, na embarcacao que acessa" on public.auditoria
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.vinculos v
      where v.embarcacao_id = auditoria.embarcacao_id and v.usuario_id = auth.uid()
    )
  );

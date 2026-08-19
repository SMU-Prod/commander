-- =====================================================================
-- Onda 71 · COTISTAS — vagas, convite por link e suspensão.
-- PRD-UPGRADE-3-COTAS §13 ("Cotistas — acesso básico Enterprise").
--
-- ---------------------------------------------------------------------
-- POR QUE A VAGA MORA NA UNIDADE, E NÃO NO LINK
-- ---------------------------------------------------------------------
-- O §13 pede duas coisas que, juntas, decidem a modelagem:
--
--   "cada cadastro ocupa 1 vaga (1/10 ... 10/10)"
--   "ADM pode remover acesso, liberando vaga, e REDEFINIR O LINK SEM
--    REMOVER USUÁRIOS EXISTENTES"
--
-- Se a contagem morasse no link, redefinir o link zeraria a contagem e a
-- unidade passaria a aceitar 10 cotistas NOVOS além dos 10 que já tinha.
--
-- Por isso `cotas_total` é coluna da EMBARCAÇÃO, e a ocupação é DERIVADA:
-- é o número de vínculos com papel 'COTISTA'. Não existe contador a manter
-- em sincronia — e "remover acesso libera vaga" acontece sozinho, sem
-- trigger nenhum. O link vira só uma porta, trocável a qualquer hora.
--
-- `default 0` e não 10: unidade que não é de cotas não ganha vaga
-- fantasma, e o ADM define o número quando (e se) for o caso.
--
-- ---------------------------------------------------------------------
-- SUSPENSÃO — E A FRONTEIRA QUE O PRD DESENHA
-- ---------------------------------------------------------------------
-- §13: "Cobrança acontece FORA do Commander. ADM pode marcar cotista como
-- inadimplente e suspender o acesso."
--
-- Repare no que NÃO tem aqui: valor, vencimento, boleto, status de
-- pagamento. O Commander não sabe se a pessoa deve e não tem como saber.
-- Ele guarda só o fato operacional — o acesso foi suspenso, quando, e por
-- quem — porque é isso que ele consegue afirmar com honestidade e é isso
-- que o §22 manda auditar.
--
-- Suspender NÃO apaga o vínculo, de propósito: reativar tem que devolver o
-- acesso sem refazer convite, e a vaga continua ocupada enquanto a pessoa
-- estiver suspensa (ela não perdeu o lugar dela por estar em atraso — quem
-- decide tirar é o ADM, com o botão de remover).
--
-- ---------------------------------------------------------------------
-- UM LINK ATIVO POR UNIDADE
-- ---------------------------------------------------------------------
-- O índice único parcial garante isso. "Redefinir o link" é desativar o
-- atual e criar outro; os antigos ficam na tabela como histórico (quem
-- entrou por qual link é pergunta de auditoria) mas não abrem mais porta.
-- =====================================================================

alter table public.embarcacoes
  add column cotas_total int not null default 0 check (cotas_total >= 0);

alter table public.vinculos
  add column suspenso_em timestamptz,
  add column suspenso_por uuid references public.profiles(id) on delete set null;

create table public.convites_cotista (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  -- 12 caracteres: o link é compartilhado em grupo de WhatsApp, então
  -- precisa ser curto o bastante pra caber numa mensagem e longo o
  -- bastante pra não ser adivinhado por tentativa.
  codigo text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  ativo boolean not null default true,
  criado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Ver o cabeçalho: um link ativo por unidade; os desativados viram histórico.
create unique index convites_cotista_um_ativo_por_unidade
  on public.convites_cotista (embarcacao_id) where ativo;

create index convites_cotista_codigo_idx on public.convites_cotista (codigo) where ativo;

alter table public.convites_cotista enable row level security;

-- `eh_prop` e não a matriz de áreas: gerar e revogar convite de cotista é
-- ato de dono da conta, não permissão de área — do mesmo jeito que o
-- convite de tripulação da migration 008 já era. Quem entra pelo link nunca
-- LÊ esta tabela; a validação do código acontece na server action, com
-- service role, justamente pra o convite não precisar ser público.
create policy "convites_cotista: quem gerencia tripulacao le" on public.convites_cotista
  for select to authenticated
  using (public.eh_prop(embarcacao_id));

create policy "convites_cotista: quem gerencia tripulacao cria" on public.convites_cotista
  for insert to authenticated
  with check (public.eh_prop(embarcacao_id));

-- Sem policy de `delete`: link se desativa (`ativo = false`), não se apaga —
-- apagar levaria junto a resposta pra "por qual link esta pessoa entrou?".
create policy "convites_cotista: quem gerencia tripulacao desativa" on public.convites_cotista
  for update to authenticated
  using (public.eh_prop(embarcacao_id))
  with check (public.eh_prop(embarcacao_id));

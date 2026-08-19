-- ============================================================================
-- 069 — Afazeres entram na matriz e o responsável passa a ser gente do barco
-- ============================================================================
-- FECHA: P1-4 de docs/auditoria/2026-08-19-banco-e-rls.md
--
-- O PROBLEMA
-- ----------
-- `afazeres` (migration 066) tem `embarcacao_id` e mesmo assim nenhuma das 4
-- policies chamava `permissao()`. Lido do banco vivo:
--     SELECT : dono_id = auth.uid() OR responsavel_id = auth.uid()
--     INSERT : dono_id = auth.uid()
--     UPDATE : dono_id = auth.uid() OR responsavel_id = auth.uid()
--     DELETE : dono_id = auth.uid()
-- O INSERT só exige que eu seja dono da tarefa que eu mesmo criei. Não exige
-- vínculo com a `embarcacao_id` que eu declarar, nem que o `responsavel_id`
-- seja alguém daquele barco. Dois abusos, ambos alcançáveis direto pelo
-- PostgREST (o app não faz isso — `criarAfazer()` nem envia `responsavel_id`
-- — mas a RLS é a fronteira, não o código do cliente):
--
--   1. INJETAR TAREFA NA LISTA DE UM ESTRANHO. Basta gravar `responsavel_id`
--      com o uuid de qualquer usuário do sistema: o SELECT casa por
--      `responsavel_id` e a linha aparece na tela da vítima, com título
--      arbitrário. É canal de spam/phishing dentro do app.
--   2. CARIMBAR TAREFA CONTRA BARCO ALHEIO. Pôr `embarcacao_id` de uma
--      embarcação sem vínculo nenhum. Não vaza dado (ninguém do outro barco lê
--      a linha), mas polui a chave estrangeira e qualquer relatório futuro por
--      embarcação.
--
-- POR QUE ESTA CORREÇÃO E NÃO OUTRA
-- ---------------------------------
-- A trava tem de ficar no WITH CHECK do INSERT, porque é o momento em que os
-- dois campos são declarados. Reescrever só o SELECT não resolveria: a linha
-- já teria nascido apontando para onde não devia. A aba escolhida é 'diario'
-- (a mesma de `eventos`) por ser a aba de operação do dia a dia — `afazeres`
-- tem `destino` em ('operacoes','mecanica','qualquer'), que NÃO são abas da
-- matriz; se um dia virarem, esta policy é o ponto único a mudar.
-- `embarcacao_id is null` continua permitido: é a tarefa pessoal, fora de
-- unidade. Nesse caso o responsável só pode ser o próprio dono — senão a
-- brecha 1 voltaria pela porta dos fundos, bastando omitir a embarcação.
--
-- MUDANÇA DE PRODUTO NO SELECT (amplia, não restringe)
-- ----------------------------------------------------
-- Hoje o PROP não enxerga as tarefas do próprio barco criadas pela tripulação
-- — o SELECT só casa dono/responsável. Isso quase certamente não é o desejado
-- para uma lista de afazeres da unidade. O SELECT passa a incluir
-- `eh_prop(embarcacao_id)`. É ampliação de leitura DENTRO da unidade (o helper
-- exige vínculo PROP não suspenso na mesma embarcação); não abre nada entre
-- contas. Se o desenho pretendido for outro, esta é a linha a remover.
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
--   afazeres = 3 linhas · com responsavel_id preenchido = 0 · com
--   embarcacao_id preenchido = 3, todas na embarcação 00ba0c9d…, cujo dono da
--   tarefa é o PROP vinculado.
-- PROP curto-circuita `permissao()`. Logo: ZERO linhas ficam inacessíveis e
-- ZERO criações que o app faz hoje passam a falhar. O SELECT só ganha
-- alcance. Quem perde é o abuso descrito acima, que nunca aconteceu.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- INSERT — o dono cria, dentro de uma unidade que ele acessa, e o responsável
-- tem de ser tripulante ativo daquela mesma unidade
-- ---------------------------------------------------------------------------
drop policy if exists "afazeres: o dono cria" on public.afazeres;
create policy "afazeres: o dono cria" on public.afazeres
  for insert to authenticated
  with check (
    dono_id = (select auth.uid())
    and (
      embarcacao_id is null
      or public.permissao(embarcacao_id, 'diario', 'editar')
    )
    and (
      responsavel_id is null
      or responsavel_id = dono_id
      or exists (
        select 1 from public.vinculos v
        where v.embarcacao_id = afazeres.embarcacao_id
          and v.usuario_id = afazeres.responsavel_id
          and v.suspenso_em is null
      )
    )
  );

-- ---------------------------------------------------------------------------
-- SELECT — dono, responsável e o dono da unidade
-- ---------------------------------------------------------------------------
drop policy if exists "afazeres: dono e responsavel leem" on public.afazeres;
drop policy if exists "afazeres: dono, responsavel e a unidade leem" on public.afazeres;
create policy "afazeres: dono, responsavel e a unidade leem" on public.afazeres
  for select to authenticated
  using (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
    or (embarcacao_id is not null and public.eh_prop(embarcacao_id))
  );

-- ---------------------------------------------------------------------------
-- UPDATE — mesmo predicado de antes, só trocando auth.uid() por
-- (select auth.uid()) para resolver o `auth_rls_initplan` (P2-2).
-- Sem mudança de quem pode o quê.
-- ---------------------------------------------------------------------------
drop policy if exists "afazeres: dono e responsavel atualizam" on public.afazeres;
create policy "afazeres: dono e responsavel atualizam" on public.afazeres
  for update to authenticated
  using (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
  )
  with check (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- DELETE — idem: só o dono apaga, agora sem reavaliar auth.uid() por linha
-- ---------------------------------------------------------------------------
drop policy if exists "afazeres: so o dono apaga" on public.afazeres;
create policy "afazeres: so o dono apaga" on public.afazeres
  for delete to authenticated
  using (dono_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois; deve voltar 4 linhas, todas em {authenticated})
-- ---------------------------------------------------------------------------
-- select policyname, cmd, roles::text, qual, with_check
--   from pg_policies where schemaname='public' and tablename='afazeres'
--  order by cmd;

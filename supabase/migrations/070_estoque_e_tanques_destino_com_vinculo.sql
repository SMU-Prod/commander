-- ============================================================================
-- 070 — Consumo de estoque e de combustível só pode apontar para barco que o
--       autor de fato acessa
-- ============================================================================
-- FECHA: P1-5(b) de docs/auditoria/2026-08-19-banco-e-rls.md
--
-- O PROBLEMA
-- ----------
-- `estoque_movimentos.embarcacao_id` e `tanque_movimentos.destino_embarcacao_id`
-- são chaves estrangeiras para `embarcacoes` e não eram validadas contra
-- vínculo nenhum. Policy viva de INSERT de `estoque_movimentos`:
--     WITH CHECK autor_id = auth.uid()
--                AND EXISTS (select 1 from estoque_itens i
--                            where i.id = item_id and i.dono_id = auth.uid())
--     -- embarcacao_id: livre
-- Ou seja: o dono de um estoque lançava consumo de peça — ou de combustível,
-- no caso dos tanques — apontando para o barco de QUALQUER outra conta. A
-- linha não é lida pelo outro barco, então não é vazamento; é poluição de
-- referência, e vira número errado no instante em que existir relatório de
-- custo por embarcação. `lancamentos_financeiros.origem` já prevê 'estoque' e
-- 'combustivel' (migration 065), então esse relatório está a caminho.
--
-- POR QUE ESTA CORREÇÃO E NÃO OUTRA
-- ---------------------------------
-- A trava natural seria a matriz, mas estas tabelas foram desenhadas fora dela
-- (escopo por `dono_id`, ver ressalva abaixo). Redesenhá-las aqui seria trocar
-- o dono do dado no meio de uma correção de segurança. O mínimo correto e
-- reversível é exigir que o DESTINO seja uma embarcação que o autor enxerga —
-- `pode_ver_embarcacao()`, que depois da migration 067 também respeita
-- suspensão. `is null` continua aceito: movimento de estoque sem barco
-- (compra, ajuste de inventário) é caso legítimo e frequente.
--
-- O QUE ESTA MIGRATION NÃO RESOLVE — P1-5(a), fica para decisão do dono
-- --------------------------------------------------------------------
-- `bases_operacionais`, `estoque_itens` e `tanques` pertencem a uma PESSOA
-- (`dono_id = auth.uid()`), não à empresa: ninguém mais da operação enxerga o
-- estoque, nem o PROP da unidade, nem o mecânico. Se quem cadastrou sair da
-- empresa, o estoque some do alcance de todo mundo. Corrigir isso é redesenho
-- de produto ("papéis Enterprise"), não conserto de RLS, e por isso não entra
-- aqui. A troca do CASCADE de `bases_operacionais_dono_id_fkey` está separada
-- na migration 073, marcada como decisão do dono.
--
-- QUEM PERDE ACESSO — conferido no banco em 19/08/2026
-- ----------------------------------------------------
--   estoque_movimentos = 1 linha, com `embarcacao_id` preenchido, embarcação
--                        00ba0c9d…, e o autor É o PROP vinculado dela.
--   tanque_movimentos  = 0 linhas.
-- Nenhum INSERT que o app faz hoje passa a falhar; nenhuma linha existente é
-- afetada (WITH CHECK só vale para linha nova). ZERO impacto na base atual.
-- Estas policies são de INSERT: leitura e histórico ficam intactos.
--
-- REVERSÃO: ver supabase/migrations/APLICAR-2026-08-19.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- estoque_movimentos — autor em nome próprio, dono do item, destino acessível
-- ---------------------------------------------------------------------------
drop policy if exists "estoque_mov: dono do item registra" on public.estoque_movimentos;
create policy "estoque_mov: dono do item registra" on public.estoque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.estoque_itens i
      where i.id = estoque_movimentos.item_id
        and i.dono_id = (select auth.uid())
    )
    and (
      embarcacao_id is null
      or public.pode_ver_embarcacao(embarcacao_id)
    )
  );

-- ---------------------------------------------------------------------------
-- tanque_movimentos — idem, com o destino do abastecimento
-- ---------------------------------------------------------------------------
drop policy if exists "tanque_mov: dono do tanque registra" on public.tanque_movimentos;
create policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.tanques t
      where t.id = tanque_movimentos.tanque_id
        and t.dono_id = (select auth.uid())
    )
    and (
      destino_embarcacao_id is null
      or public.pode_ver_embarcacao(destino_embarcacao_id)
    )
  );

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois; as duas policies devem citar pode_ver_embarcacao)
-- ---------------------------------------------------------------------------
-- select tablename, policyname, cmd, with_check
--   from pg_policies
--  where schemaname='public'
--    and tablename in ('estoque_movimentos','tanque_movimentos')
--    and cmd = 'INSERT';

-- ============================================================================
-- 073 — [PRECISA DE DECISÃO DO DONO] Apagar um perfil deixa de apagar a base
--       operacional junto
-- ============================================================================
-- NÃO APLIQUE ESTA MIGRATION SEM DECIDIR O FLUXO DE EXCLUSÃO DE CONTA.
-- As migrations 067 a 071 são correções de segurança e valem por si.
--
-- FECHA: a parte de integridade do P1-5(a) de
--        docs/auditoria/2026-08-19-banco-e-rls.md
--
-- O PROBLEMA
-- ----------
-- Constraint viva:
--   bases_operacionais_dono_id_fkey
--     FOREIGN KEY (dono_id) REFERENCES profiles(id) ON DELETE CASCADE
-- Apagar o perfil de quem cadastrou a base apaga A BASE INTEIRA. E como
-- `estoque_itens.base_id` e `tanques.base_id` apontam para ela, o estoque e os
-- tanques daquela base ficam órfãos (`base_id` vira NULL). Uma pessoa sai da
-- empresa, a conta dela é removida, e a estrutura física da operação some
-- junto — sem confirmação e sem rastro.
--
-- A CORREÇÃO
-- ----------
-- Trocar CASCADE por RESTRICT: o banco recusa apagar o perfil enquanto houver
-- base no nome dele. Força transferir a base antes — que é o comportamento
-- correto para um ativo da empresa.
--
-- O QUE ELA CUSTA — e é por isso que está separada
-- ------------------------------------------------
-- Qualquer fluxo de "excluir minha conta" passa a FALHAR com erro de chave
-- estrangeira se a pessoa tiver base cadastrada, em vez de completar. Isso
-- tem implicação de LGPD (pedido de exclusão) e de suporte. Aplicar esta
-- migration sem antes existir uma tela de transferência de base troca um
-- problema silencioso por um erro barulhento no fluxo de exclusão.
--
-- A alternativa, se a prioridade for nunca travar exclusão de conta, é
-- `ON DELETE SET NULL` com `dono_id` nullable — a base sobrevive sem dono e é
-- readotada depois. Isso exige alterar a coluna e ajustar as policies (que
-- hoje são `dono_id = auth.uid()`, e uma base sem dono ficaria invisível para
-- todo mundo). Não foi escrito aqui justamente por mexer no desenho.
--
-- Segue de pé, e NÃO é resolvido por esta migration, o P1-5(a) de produto:
-- estoque, tanques e bases pertencem a uma PESSOA, não à empresa. Ninguém mais
-- da operação enxerga — nem o PROP da unidade. Isso é redesenho.
--
-- IMPACTO NA BASE ATUAL: ZERO — `bases_operacionais` tem 0 linhas hoje, então
-- nenhuma exclusão de perfil existente muda de comportamento.
-- Confirme antes de aplicar (tem de voltar 0):
--   select count(*) from public.bases_operacionais;
--
-- REVERSÃO:
--   alter table public.bases_operacionais
--     drop constraint bases_operacionais_dono_id_fkey,
--     add  constraint bases_operacionais_dono_id_fkey
--          foreign key (dono_id) references public.profiles(id) on delete cascade;
-- ============================================================================

alter table public.bases_operacionais
  drop constraint if exists bases_operacionais_dono_id_fkey;

alter table public.bases_operacionais
  add constraint bases_operacionais_dono_id_fkey
  foreign key (dono_id) references public.profiles(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois; o def tem de terminar em ON DELETE RESTRICT)
-- ---------------------------------------------------------------------------
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conname = 'bases_operacionais_dono_id_fkey';

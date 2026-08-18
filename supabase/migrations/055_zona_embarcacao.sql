-- =====================================================================
-- Onda 61 · Mapa da Embarcação — a zona física nasce no banco.
-- Spec docs/superpowers/specs/2026-08-16-mapa-embarcacao-design.md §2.1:
-- sete zonas fixas, enum no banco, coluna NULLABLE em `equipamentos`.
--
-- ADITIVA e só isso, de propósito:
--   · sem default e sem update em massa — equipamento existente fica com
--     zona = null e aparece no mapa como "Não mapeado", convidando o dono
--     a classificar (não se inventa dado);
--   · nada de RLS aqui — a coluna herda as policies de `equipamentos`;
--     nada novo a policiar.
-- O vocabulário espelhado no código vive em
-- web/lib/domain/mapa-embarcacao.ts (ZONAS / ROTULO_ZONA).
-- =====================================================================

create type public.zona_embarcacao as enum
  ('proa','conves','casaria','flybridge','praca_de_maquinas','popa','casco');

alter table public.equipamentos add column zona public.zona_embarcacao;

-- =====================================================================
-- Onda 62 · Onboarding em wizard — o tipo da embarcação nasce no banco.
-- Canvas docs/design-mobile/tela-3j.html ("Onboarding — cadastrar
-- embarcação"): os chips de Tipo do passo "Qual é a sua embarcação?" são
-- Lancha, Veleiro, Iate e Bote — exatamente estes quatro, na ordem do
-- canvas. Aprovado pelo dono depois do relato do C1 (a fatia pedia uma
-- decisão de produto: o campo não existia no banco).
--
-- ADITIVA e só isso, de propósito (mesma disciplina da 055):
--   · coluna NULLABLE, sem default e sem update em massa — barco existente
--     fica com tipo = null e o dono completa quando quiser em
--     /barco/editar (não se inventa dado);
--   · nada de RLS aqui — a coluna herda as policies de `embarcacoes`;
--     nada novo a policiar.
--
-- ARQUITETURA (decisão do dono): o `tipo` é também o SELETOR DO MODELO 3D
-- do Mapa da Embarcação de uma onda futura — "modelo padrão baseado na
-- escolha do barco". Quando o corte lateral ganhar o casco em 3D, é este
-- enum que diz qual modelo padrão carregar — por isso enum fechado no
-- banco, e não texto livre: texto livre não seleciona modelo nenhum.
--
-- O vocabulário espelhado no código vive em
-- web/lib/domain/tipo-embarcacao.ts (TIPOS_EMBARCACAO / ROTULO_TIPO_EMBARCACAO).
-- =====================================================================

create type public.tipo_embarcacao as enum ('lancha','veleiro','iate','bote');

alter table public.embarcacoes add column tipo public.tipo_embarcacao;

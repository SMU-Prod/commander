-- ============================================================================
-- 084 — `bases_operacionais` é apagada, junto com as duas colunas `base_id`
-- ============================================================================
-- FECHA: A2 de docs/auditoria/2026-08-19-paridade-front-back.md, item 3 da
--        lista de ABERTOS de docs/auditoria/2026-08-19-fechamento.md
--
-- APOSENTA: `073_decisao_bases_operacionais_fk_restrict.sql` — ver a seção
--           própria, mais abaixo. Se esta migration rodar, a 073 não tem mais
--           o que consertar e NÃO deve ser aplicada nunca.
--
-- ############################################################################
-- ATENÇÃO: MIGRATION DESTRUTIVA. Apaga uma tabela e duas colunas em PRODUÇÃO.
-- Não há staging. Leia a seção "ANTES DE RODAR" e rode as duas conferências de
-- guarda — se qualquer uma delas voltar diferente de zero, PARE.
-- ############################################################################
--
-- O ACHADO
-- --------
-- `bases_operacionais` nasceu na `064_estoque_e_combustivel.sql:49` e nunca
-- foi usada. Medido em 19/08/2026, no banco vivo e na árvore de agora:
--
--   · `select count(*) from public.bases_operacionais`                 → 0
--   · `estoque_itens` tem 6 linhas; com `base_id` preenchido           → 0
--   · `tanques` tem 5 linhas; com `base_id` preenchido                 → 0
--   · varredura de `bases_operacionais` OU `base_id` em todo `web/`
--     (`*.ts`/`*.tsx`, fora de `node_modules` e `.next`)               → 0
--
-- Zero linha, zero referência, zero escrita. Nenhuma tela pergunta a base,
-- nenhuma consulta filtra por ela, nenhuma action a grava. A tabela existe
-- apenas no schema.
--
-- A RÉGUA, E POR QUE ELA MANDA APAGAR
-- -----------------------------------
-- É a mesma que fechou A8 e B9 no mesmo dia, e que está escrita em
-- `web/lib/domain/cotista-plano.ts:14-44` e `:96-108`: **código que ninguém
-- usa dá a impressão de que a funcionalidade existe.** Quem abre o schema
-- hoje lê "o Commander suporta múltiplas bases operacionais — marina, garagem
-- náutica, galpão" e conclui que o recurso está pronto e só falta ligar a
-- tela. Não está pronto: não existe cadastro de base, não existe seletor, não
-- existe agrupamento, e as duas FKs nunca receberam um valor. O schema está
-- prometendo uma capacidade que o produto não tem.
--
-- E a promessa não é de graça. Ela cobra três coisas hoje:
--   · duas policies de RLS mantidas e reescritas a cada faxina de banco
--     (as 082 e 083 deste mesmo lote passam por elas);
--   · uma migration inteira (`073`) parada há dias esperando decisão do dono
--     sobre uma FK de uma tabela vazia;
--   · duas colunas `base_id` que todo `select *` de `/estoque` e
--     `/combustivel` carrega e nenhuma linha jamais preenche.
--
-- O QUE SE PERDE — dito sem maquiagem
-- -----------------------------------
-- Perde-se o DESENHO de dados multi-base. Ele é legítimo: uma administradora
-- com marina e garagem náutica hoje joga estoque e tanque no mesmo pote, e o
-- conserto que a auditoria propõe para o A2 é exatamente construir a tela
-- ("seletor de base em /estoque e /combustivel gravando `estoque_itens.base_id`
-- e `tanques.base_id`, e o 'Precisa repor' agrupado por base").
--
-- A pergunta certa não é "o desenho é bom?" — é bom. É **"quanto custa
-- recriá-lo no dia em que a tela for construída?"** E a resposta é: quase
-- nada. O `create table` original tem 6 linhas e continua no repositório para
-- sempre, em `064_estoque_e_combustivel.sql:49-60`, junto com as duas policies
-- e as duas FKs (`:65` e `:123`). Recriar é copiar aquele bloco para uma
-- migration nova. Não se está jogando fora conhecimento nem dado — está-se
-- jogando fora uma prateleira vazia que finge estar cheia.
--
-- Guardar um schema *por precaução*, sem tela, sem dado e sem prazo, é o custo
-- permanente pagando por um benefício que só chega se e quando a funcionalidade
-- for priorizada. Se for priorizada, o benefício custa 6 linhas de SQL.
--
-- ============================================================================
-- O QUE ISTO FAZ COM A MIGRATION 073 — precisa estar escrito
-- ============================================================================
-- `073_decisao_bases_operacionais_fk_restrict.sql` está no repositório, NÃO
-- aplicada, com o cabeçalho "[PRECISA DE DECISÃO DO DONO]" e registrada como
-- decisão nº 8 em `docs/auditoria/2026-08-19-fechamento.md`. Ela troca
-- `bases_operacionais_dono_id_fkey` de `ON DELETE CASCADE` para `RESTRICT`,
-- para que apagar um perfil deixe de apagar a base junto.
--
-- Se a 084 rodar, a 073 fica sem objeto: não há FK para alterar, porque não há
-- tabela. A decisão do dono que a 073 pedia — "excluir conta trava ou não trava
-- quando a pessoa tem base?" — deixa de existir como pergunta, e a exclusão de
-- conta volta a ser o fluxo simples que já era.
--
-- Consequência operacional, em ordem:
--   1. Aplicar a 084 e NÃO aplicar a 073. Nunca.
--   2. A 073 continua no repositório como registro histórico. Ela ESTOURA se
--      alguém a rodar depois desta ("relation public.bases_operacionais does
--      not exist") — falha barulhenta, que é o comportamento certo.
--   3. A decisão nº 8 de `docs/auditoria/2026-08-19-fechamento.md` sai da fila
--      do dono. Das 11 decisões daquele documento passam a ser 10.
--
-- E o contrário também precisa estar escrito, porque é a saída de emergência:
-- **se o dono decidir que a funcionalidade multi-base entra**, esta migration
-- não roda, e aí a 073 volta a fazer sentido e continua esperando decisão.
-- As duas são mutuamente exclusivas: ou 073, ou 084. Nunca as duas.
--
-- ============================================================================
-- ANTES DE RODAR — as duas guardas
-- ============================================================================
-- Rode as duas. As duas TÊM de voltar 0. Se qualquer uma voltar diferente,
-- alguém começou a usar a funcionalidade entre 19/08 e agora, e esta migration
-- APAGARIA DADO REAL — pare e reabra a decisão.
--
--   select count(*) from public.bases_operacionais;                       -- 0
--   select count(*) from public.estoque_itens where base_id is not null
--        + (select count(*) from public.tanques where base_id is not null); -- 0
--
-- (a segunda está escrita assim de propósito: uma linha só, para não haver
--  como conferir metade e esquecer a outra.)
--
-- A trava no fim da transação repete as duas contagens e aborta tudo se
-- alguma não for zero — mas a conferência manual antes existe para você NÃO
-- descobrir isso por uma exceção.
--
-- ORDEM DENTRO DO LOTE: esta é a ÚLTIMA. As 082 e 083 tocam policies de
-- `bases_operacionais` que esta migration apaga junto com a tabela; rodar
-- nesta ordem faz o trabalho delas ali ser descartado sem erro. O inverso
-- (084 antes) faria a 082 estourar com "policy does not exist".
--
-- REVERSÃO: possível e barata, porque não há dado a restaurar — o script
-- completo (recria tabela, policies e as duas colunas) está em
-- supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE, passo 19.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- GUARDA — nada é apagado se houver qualquer dado em jogo
-- ---------------------------------------------------------------------------
do $$
declare
  v_bases int;
  v_ligadas int;
begin
  select count(*) into v_bases from public.bases_operacionais;
  if v_bases <> 0 then
    raise exception
      'ABORTADO: public.bases_operacionais tem % linha(s). Esta migration so pode rodar sobre uma tabela vazia — alguem comecou a usar a funcionalidade. Reabra a decisao do achado A2 antes de insistir.',
      v_bases;
  end if;

  select (select count(*) from public.estoque_itens where base_id is not null)
       + (select count(*) from public.tanques       where base_id is not null)
    into v_ligadas;
  if v_ligadas <> 0 then
    raise exception
      'ABORTADO: % linha(s) de estoque_itens/tanques tem base_id preenchido. Apagar as colunas perderia esse vinculo.',
      v_ligadas;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- As duas colunas primeiro. Cada `drop column` leva junto a FK dela
-- (`estoque_itens_base_id_fkey` e `tanques_base_id_fkey`, as duas
-- `ON DELETE SET NULL`), o que deixa a tabela sem nenhum dependente.
-- ---------------------------------------------------------------------------
alter table public.estoque_itens drop column if exists base_id;
alter table public.tanques       drop column if exists base_id;

-- ---------------------------------------------------------------------------
-- E então a tabela. Sem `cascade`: se ainda houver qualquer dependente que
-- este arquivo não previu, o comando ESTOURA em vez de arrastá-lo junto.
-- As duas policies ("bases: o dono le" e as de escrita, sejam a `FOR ALL`
-- original ou as três que a 083 cria) caem com a tabela — policy não
-- sobrevive ao objeto que protege.
-- ---------------------------------------------------------------------------
drop table if exists public.bases_operacionais;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A tabela não existe mais — tem de voltar `null`:
-- select to_regclass('public.bases_operacionais');
--
-- 2) Nenhuma policy órfã sobrou com o nome dela — tem de voltar 0:
-- select count(*) from pg_policies
--  where schemaname = 'public' and tablename = 'bases_operacionais';
--
-- 3) As duas colunas sumiram — tem de voltar 0:
-- select count(*) from information_schema.columns
--  where table_schema = 'public' and column_name = 'base_id'
--    and table_name in ('estoque_itens','tanques');
--
-- 4) NENHUMA outra FK apontava para a tabela — tem de voltar 0:
-- select count(*) from pg_constraint con
--   join pg_class ref on ref.oid = con.confrelid
--  where con.contype = 'f' and ref.relname = 'bases_operacionais';
--
-- 5) O dado que importa continua intacto — os dois números não podem mudar:
-- select (select count(*) from public.estoque_itens) as itens    -- 6
--      , (select count(*) from public.tanques)       as tanques;  -- 5
--
-- 6) Teste de fumaça, com login real: abrir /estoque e /combustivel. As duas
--    telas fazem `select *` nessas tabelas e NÃO citam `base_id` em lugar
--    nenhum (varredura de 19/08: 0 ocorrências em todo `web/`), então têm de
--    carregar, listar e aceitar um item novo exatamente como antes. Se
--    qualquer uma quebrar, a varredura estava errada — e a reversão do passo
--    19 devolve tudo em segundos, porque não há dado a restaurar.
--
-- 7) Documentação a acertar depois desta migration (nenhuma quebra nada,
--    todas são frases que passam a citar objeto inexistente):
--    · `INDICES-2026-08-19.sql:45-46` lista `estoque_itens.base_id` e
--      `tanques.base_id` entre os índices DESCARTADOS. Continua correto como
--      registro, mas as colunas não existem mais — vale uma nota.
--    · `073_decisao_bases_operacionais_fk_restrict.sql` inteira, aposentada.
--    · `docs/auditoria/2026-08-19-fechamento.md`: o achado A2 (item 3 dos
--      abertos) fecha POR APAGAMENTO, e a decisão do dono nº 8 sai da fila.
--
-- REVERSÃO: supabase/migrations/APLICAR-2026-08-19.md, QUARTO LOTE, passo 19.

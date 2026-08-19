-- ============================================================================
-- 092 — A distância da trilha é GRAVADA uma vez, não recalculada a cada tela
-- ============================================================================
-- ⚠️  ESCRITA E **NÃO APLICADA**. Aplicar é decisão do dono, não do time —
--     ver "POR QUE ISTO NÃO FOI APLICADO" no fim deste cabeçalho.
--
-- FECHA: o achado A-03 da auditoria de tecnologia e escala de 19/08/2026
--        (`docs/auditoria/2026-08-19-tecnologia-e-escala.md`), descrito lá como
--        "a correção de melhor retorno financeiro do documento".
--
-- O PROBLEMA, NA VOZ DE QUEM USA
-- ------------------------------
-- A tela inicial baixa a trilha GPS INTEIRA de todas as saídas do ano para
-- escrever um número de três dígitos: "Distância — 412 MN". O Diário faz o
-- mesmo, com teto de 300 registros, para desenhar um chip por saída
-- ("TRILHA 12,4 MN"). O relatório do ano repete. Nenhuma das três desenha o
-- traçado; as três baixam o traçado.
--
-- MEDIDO NESTE BANCO, EM LEITURA (19/08/2026)
-- -------------------------------------------
-- Trilha no teto do app (`MAX_PONTOS_TRILHA = 4000`, `lib/domain/geo.ts`),
-- construída dentro do próprio Postgres e medida com `octet_length`:
--
--     octet_length(trilha::text) .......... 210.578 bytes  (205,6 kB)
--     bytes por ponto ..................... 52,6
--     144 saídas (3×/semana, dezembro) .... 29,6 MB por abertura de /hoje
--     300 saídas (teto do Diário) ......... 61,6 MB por abertura de /diario
--
-- E 61,6 MB não é só banda: o `statement_timeout` do papel `authenticated`
-- neste projeto é de 8 s. A tela grande não fica lenta — ela quebra.
--
-- O QUE JÁ ESTAVA MEIO PRONTO, E O QUE A AUDITORIA ERROU SOBRE ISSO
-- -----------------------------------------------------------------
-- (1) `lib/acoes/trilha.ts` JÁ chamava `resumoTrilha(validos)` na hora de
--     gravar — e usava o resultado só para montar a frase de `descricao`,
--     jogando os números fora. O mesmo em `lib/acoes/importar-gpx.ts`.
--
-- (2) A auditoria diz que a coluna `tem_trilha` "não é usada em consulta
--     nenhuma" e propõe passar a gravá-la. **Ela não pode ser gravada.** Lido
--     do catálogo vivo (`information_schema.columns`, não do arquivo da
--     migration 007):
--
--       tem_trilha | is_generated = ALWAYS | generation_expression = (trilha IS NOT NULL)
--
--     É coluna GERADA E ARMAZENADA. O Postgres recusa qualquer INSERT ou
--     UPDATE que a mencione, e ela já está correta em todas as linhas — hoje,
--     e para sempre, sem backfill. Ou seja: metade do conserto que a auditoria
--     pediu já existia e estava certa; o que faltava era só o NÚMERO.
--     Esta migration não toca em `tem_trilha`.
--
-- ============================================================================
-- A ESCOLHA DE DESENHO — coluna comum, preenchida pelo app
-- ============================================================================
-- (Alternativa descartada.) O caminho aparentemente mais seguro seria fazer
-- `distancia_nm` também ser GERADA, como `tem_trilha`: uma função plpgsql
-- IMMUTABLE somando haversine sobre o jsonb, e o Postgres mantendo o número em
-- dia sozinho, impossível de divergir do traçado. Descartada por um motivo que
-- vale mais que a garantia:
--
--   ISSO CRIARIA UMA SEGUNDA IMPLEMENTAÇÃO DA MESMA REGRA, VIVA PARA SEMPRE.
--
-- A conta de distância tem um dono só neste projeto: `resumoTrilha`, em
-- `lib/domain/geo.ts`, com teste. Uma haversine em SQL dentro do esquema seria
-- uma segunda cópia — e cópia de regra é onde nasce divergência (é a mesma
-- razão pela qual `registrarCorredorMelhorEsforco` é compartilhada entre a
-- trilha ao vivo e o GPX: "MESMA porta de escrita, nunca duas implementações").
-- Pior: mudar a fórmula em TypeScript passaria a exigir um `ALTER TABLE` com
-- reescrita da tabela inteira, e esquecer disso faria o número da tela
-- discordar do número do banco sem nenhum sinal.
--
-- Nesta migration a haversine em SQL aparece UMA VEZ, no backfill da seção 2,
-- e morre com este arquivo: as linhas novas vêm do app, que usa o dono da
-- regra. A cópia existe só para as linhas que foram escritas antes de a coluna
-- existir.
--
-- CONFERIDO, NÃO SUPOSTO: a soma escrita em SQL abaixo e `resumoTrilha` foram
-- rodadas sobre a MESMA trilha sintética de 4.000 pontos e devolveram
--
--     SQL .......... 35,038275 nm
--     TypeScript ... 35,038275 nm
--     diferença .... 4,5 × 10⁻⁷ nm
--
-- — sete ordens de grandeza abaixo do arredondamento de 1 casa decimal que a
-- tela mostra. Nenhuma saída muda de número por causa do backfill.
--
-- POR QUE `numeric` E NÃO `double precision`: é o tipo que `horas_no_momento`,
-- `mar_onda_m` e `mar_vento_kt` já usam nesta mesma tabela. Coerência de tabela
-- vale mais que o ganho teórico de um float aqui, e o valor é somado no
-- JavaScript de qualquer jeito.
--
-- POR QUE `null` E NÃO `default 0`: `null` é "esta saída não tem trilha";
-- zero é "tem trilha e não saiu do lugar". A régua da casa está escrita em
-- `lib/domain/patio.ts` ("null virando fato desenhado […] é '0 h' no lugar de
-- 'não sei'"), e é ela que faz a tela mostrar "sem GPS" em vez de "0 MN" para
-- uma saída registrada à mão. Um `default 0` transformaria toda saída sem GPS
-- em uma saída que andou zero milha — e a soma do ano continuaria certa
-- enquanto a linha do Diário passaria a mentir.
--
-- POR QUE NÃO ENTRA `duracao_h` JUNTO (a auditoria sugere as duas): porque ela
-- nasceria sem leitor. Tempo no mar, nas telas de lista, sai de
-- `hora_saida`/`hora_retorno` — colunas que já existem e que o próprio
-- `salvarTrilha` deriva dos pontos extremos. Uma coluna de duração seria
-- exatamente a prateleira vazia que a migration 084 derrubou, e que
-- `tem_trilha` foi por sete ondas. Quando existir a tela que precisa dela,
-- ela entra com o leitor junto.
--
-- SEM ÍNDICE, e é decisão: nenhuma consulta filtra nem ordena por distância —
-- ela é lida junto da linha que já vem por `embarcacao_id`. Índice aqui seria
-- escrita a mais em toda gravação de saída para nunca ser usado (a auditoria
-- já registra 47 índices sem uso neste banco).
--
-- ============================================================================
-- O PERIGO DESTA MIGRATION
-- ============================================================================
-- (1) SAÍDA ANTIGA PERDENDO AS MILHAS QUE JÁ MOSTRA. É o perigo principal.
--     Depois que o app passa a LER `distancia_nm`, toda saída com trilha que
--     não tiver a coluna preenchida vira "sem GPS" na tela e some da soma do
--     ano — uma perda visível, silenciosa e que parece perda de dado (o
--     traçado continua lá). Por isso o backfill da seção 2 não é opcional, e
--     por isso a trava da seção 3 ABORTA a migration inteira se sobrar uma
--     única saída com trilha de 2+ pontos e distância nula.
--     Ordem obrigatória: **esta migration primeiro, o deploy do app depois.**
--     Invertido, a janela entre os dois é uma janela de "sem GPS" em massa.
--
-- (2) `null` VIRANDO ZERO. Ver a decisão acima. O backfill escreve número só
--     para trilha com 2 pontos ou mais — que é EXATAMENTE o critério que o app
--     usava para decidir se calculava (`Array.isArray(trilha) && length >= 2`).
--     Trilha de 1 ponto continua sem distância, como sempre esteve.
--
-- (3) DIVERGÊNCIA FUTURA ENTRE O NÚMERO E O TRAÇADO. Hoje é impossível: não
--     existe UPDATE em `eventos.trilha` em lugar nenhum do app (conferido em
--     19/08/2026 — as duas únicas escritas são os INSERT de `lib/acoes/
--     trilha.ts` e `lib/acoes/importar-gpx.ts`). Um trigger que recalculasse
--     resolveria o problema que não existe pagando com a segunda
--     implementação que a seção de desenho acabou de recusar. Fica como LIMITE
--     CONHECIDO: quem um dia escrever um caminho que altera `trilha` precisa
--     alterar `distancia_nm` no mesmo comando. A consulta (4) da conferência
--     detecta o dia em que isso for esquecido.
--
-- (4) GRANT DE COLUNA NOVA. Conferido no catálogo vivo antes de escrever:
--     `eventos` tem grant de TABELA para `authenticated` (arwdDxtm) e ZERO
--     colunas com ACL própria — então a coluna nova nasce legível e gravável
--     sem nenhum `grant` aqui. Se um dia alguém trocar isso por grants por
--     coluna, esta migration passa e o app quebra em silêncio.
--
-- (5) REESCRITA DE TABELA. `add column` de coluna NULLABLE e sem default não
--     reescreve a tabela no Postgres 11+; o `update` do backfill reescreve as
--     linhas que tocar. Com as 9 linhas de hoje é instantâneo. Se esta
--     migration for aplicada só daqui a muitos meses, com trilha de verdade no
--     banco, o `update` do backfill vira o comando caro do arquivo — rode fora
--     do horário de pico.
--
-- ============================================================================
-- IMPACTO MEDIDO NO BANCO VIVO `khgjtxvmduizyooqaoox` — 19/08/2026
-- ============================================================================
--   eventos ................................. 9 linhas
--     · do tipo 'navegacao' ................. 0
--     · com a coluna `trilha` preenchida .... 0
--     · com trilha de 2+ pontos (backfill) .. 0
--     · com trilha de 1 ponto ............... 0
--     · com `trilha_sem_horario` ............ 0
--   bytes de trilha hoje no banco ........... 0
--
-- LEITURA DESSES NÚMEROS: **o backfill vai tocar zero linhas hoje.** Isso não
-- o torna dispensável — ele é o que faz esta migration continuar correta no dia
-- em que for aplicada, que pode ser depois do primeiro cliente com um ano de
-- saídas gravadas. O ganho desta migration também é inteiramente futuro: ela
-- não conserta uma conta de banda que já chegou, ela impede a que chegaria —
-- US$ 1.417/mês de egress a 10.000 barcos, pela conta da Frente 2 da auditoria.
--
-- ============================================================================
-- POR QUE ISTO NÃO FOI APLICADO
-- ============================================================================
-- Porque aplicar banco é decisão do dono neste projeto, e porque esta migration
-- e o deploy do app são um par ordenado (perigo 1): aplicada sozinha, não muda
-- nada e não quebra nada; o app novo sem ela é que faria toda saída com trilha
-- aparecer como "sem GPS". A ordem certa é migration → deploy.
--
-- Idempotente: `add column if not exists`, e o backfill só escreve onde a
-- coluna ainda está nula.
--
-- REVERSÃO: no fim do arquivo.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. A COLUNA
-- ---------------------------------------------------------------------------
-- Nullable de propósito (perigo 2). Sem default, sem check: distância negativa
-- é impossível pela construção de haversine, e um `check (distancia_nm >= 0)`
-- só recusaria uma linha no dia em que a fórmula quebrasse — tarde demais e
-- com erro ilegível no lugar de um número errado visível.
alter table public.eventos
  add column if not exists distancia_nm numeric;

comment on column public.eventos.distancia_nm is
  'Distância da trilha em milhas náuticas, calculada por resumoTrilha (lib/domain/geo.ts) no momento de gravar a saída. NULL = sem trilha (nunca "andou zero"); 0 = trilha existe e não saiu do lugar. Migration 092.';

-- ---------------------------------------------------------------------------
-- 2. O BACKFILL — a única haversine em SQL deste projeto, e ela morre aqui
-- ---------------------------------------------------------------------------
-- Reproduz `resumoTrilha` linha a linha:
--   · RAIO_TERRA_NM = 3440.065 (o mesmo literal de lib/domain/geo.ts);
--   · soma haversine entre pontos CONSECUTIVOS, na ordem do array — `with
--     ordinality` garante essa ordem, que é a ordem em que os pontos foram
--     gravados (o app nunca reordena a trilha);
--   · o `continue` do TypeScript quando `dt <= 0` NÃO é reproduzido de
--     propósito: ele existe para não dividir por zero no cálculo de
--     VELOCIDADE, e a distância é somada antes dele na função original. Somar
--     todos os segmentos é o que `resumoTrilha` faz.
--
-- `where distancia_nm is null` faz o comando ser repetível sem reescrever o
-- que já foi calculado — e, principalmente, sem sobrescrever com a cópia SQL
-- um número que o app (o dono da regra) já tenha gravado.
--
-- O corte em 2 pontos é o mesmo critério que as telas usavam antes desta
-- migration: com menos de 2 pontos não há segmento, não há distância, e a
-- coluna fica NULL — "sem GPS", como sempre apareceu.
update public.eventos e
   set distancia_nm = calculada.total
  from (
    select
      ev.id,
      sum(
        2 * 3440.065 * asin(sqrt(
          power(sin(radians(p.la - p.la_ant) / 2), 2)
          + cos(radians(p.la_ant)) * cos(radians(p.la))
            * power(sin(radians(p.lo - p.lo_ant) / 2), 2)
        ))
      )::numeric as total
      from public.eventos ev
      cross join lateral (
        select
          (ponto ->> 'la')::float8 as la,
          (ponto ->> 'lo')::float8 as lo,
          lag((ponto ->> 'la')::float8) over (order by ord) as la_ant,
          lag((ponto ->> 'lo')::float8) over (order by ord) as lo_ant
          from jsonb_array_elements(ev.trilha) with ordinality as t(ponto, ord)
      ) p
     where jsonb_typeof(ev.trilha) = 'array'
       and jsonb_array_length(ev.trilha) >= 2
       and ev.distancia_nm is null
       and p.la_ant is not null
     group by ev.id
  ) as calculada
 where e.id = calculada.id;

-- ---------------------------------------------------------------------------
-- 3. TRAVA — a migration não passa se alguma saída ficar sem o número
-- ---------------------------------------------------------------------------
-- É a trava do perigo (1): uma saída com traçado e sem distância vira "sem
-- GPS" na tela depois do deploy, ou seja, uma perda visível de informação que
-- o dono do barco leria como dado apagado. Melhor a migration falhar aqui,
-- dentro da transação, do que a tela mentir depois.
do $$
declare
  v_orfas int;
  v_gerada text;
  v_negativas int;
begin
  -- (i) ninguém ficou para trás.
  select count(*) into v_orfas
    from public.eventos
   where jsonb_typeof(trilha) = 'array'
     and jsonb_array_length(trilha) >= 2
     and distancia_nm is null;
  if v_orfas > 0 then
    raise exception
      'ABORTADO: % saida(s) com trilha de 2+ pontos ficaram sem distancia_nm. Depois do deploy elas apareceriam como "sem GPS" e sumiriam da soma do ano. Investigue com: select id, jsonb_array_length(trilha) from public.eventos where jsonb_typeof(trilha)=''array'' and jsonb_array_length(trilha)>=2 and distancia_nm is null;', v_orfas;
  end if;

  -- (ii) trilha de 1 ponto (ou nenhuma) continua sem número — o backfill não
  --      pode ter inventado zero para elas, que é o perigo (2).
  select count(*) into v_negativas
    from public.eventos
   where distancia_nm is not null
     and (trilha is null or jsonb_typeof(trilha) <> 'array' or jsonb_array_length(trilha) < 2);
  if v_negativas > 0 then
    raise exception
      'ABORTADO: % linha(s) sem trilha valida ganharam distancia_nm. Isso e "0 MN" no lugar de "sem GPS" — exatamente a confusao entre zero e nao-sei que a regua de lib/domain/patio.ts proibe.', v_negativas;
  end if;

  -- (iii) `tem_trilha` continua sendo coluna GERADA. Se alguém a tiver
  --       transformado em coluna comum entre a leitura de hoje e a aplicação
  --       desta migration, o app passa a poder gravá-la — e a partir daí ela
  --       pode discordar da `trilha`, que é a classe de defeito que este
  --       arquivo inteiro existe para não repetir.
  select attgenerated::text into v_gerada
    from pg_attribute
   where attrelid = 'public.eventos'::regclass and attname = 'tem_trilha';
  if coalesce(v_gerada, '') <> 's' then
    raise exception
      'ABORTADO: eventos.tem_trilha deixou de ser coluna gerada (attgenerated=%). Confira o catalogo antes de seguir.', coalesce(v_gerada, '(inexistente)');
  end if;
end
$$;

commit;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rodar depois)
-- ---------------------------------------------------------------------------
-- 1) A coluna existe, é nullable e não tem default:
-- select column_name, data_type, is_nullable, column_default, is_generated
--   from information_schema.columns
--  where table_schema='public' and table_name='eventos' and column_name='distancia_nm';
--
-- 2) O retrato do backfill — as três contagens têm de fechar entre si:
-- select count(*) filter (where jsonb_typeof(trilha)='array' and jsonb_array_length(trilha)>=2) as com_trilha_util,
--        count(*) filter (where distancia_nm is not null) as com_distancia,
--        count(*) filter (where jsonb_typeof(trilha)='array' and jsonb_array_length(trilha)>=2 and distancia_nm is null) as orfas
--   from public.eventos;
--
-- 3) A ECONOMIA, medida na própria tabela — o quanto /hoje deixa de baixar:
-- select coalesce(sum(octet_length(trilha::text)), 0) as bytes_que_desciam,
--        count(*) filter (where distancia_nm is not null) * 8 as bytes_que_descem_agora
--   from public.eventos
--  where tipo='navegacao' and data >= date_trunc('year', current_date);
--
-- 4) DETECTOR DE DIVERGÊNCIA (perigo 3) — recalcula e compara. Tem de voltar
--    vazio; qualquer linha aqui é uma trilha que foi alterada sem atualizar o
--    número. Vale rodar de vez em quando, não a cada deploy:
-- select e.id, e.distancia_nm as gravada, round(c.total, 6) as recalculada
--   from public.eventos e
--   join lateral (
--     select sum(2*3440.065*asin(sqrt(
--              power(sin(radians(p.la - p.la_ant)/2),2)
--              + cos(radians(p.la_ant))*cos(radians(p.la))*power(sin(radians(p.lo - p.lo_ant)/2),2))))::numeric as total
--       from (select (ponto->>'la')::float8 la, (ponto->>'lo')::float8 lo,
--                    lag((ponto->>'la')::float8) over (order by ord) la_ant,
--                    lag((ponto->>'lo')::float8) over (order by ord) lo_ant
--               from jsonb_array_elements(e.trilha) with ordinality as t(ponto, ord)) p
--      where p.la_ant is not null
--   ) c on true
--  where jsonb_typeof(e.trilha)='array' and jsonb_array_length(e.trilha)>=2
--    and abs(coalesce(e.distancia_nm, -1) - c.total) > 0.001;
--
-- 5) TESTE DE FUMAÇA, com o app já em pé (é o que prova o perigo 1 fechado):
--    a) grave uma trilha nova por `/navegar` e confirme que `/diario` mostra a
--       mesma distância que a frase de `descricao` da própria saída diz;
--    b) importe um GPX SEM horário por `/diario/importar` e confirme que a
--       saída continua mostrando distância (e continua SEM duração — os campos
--       de tempo são escondidos de propósito para trilha sem horário);
--    c) abra `/hoje` e confira que "Distância" bate com a soma dos chips do
--       Diário do ano;
--    d) uma saída registrada À MÃO (sem GPS) tem de continuar dizendo
--       "sem GPS", nunca "0 MN".
--
-- ---------------------------------------------------------------------------
-- REVERSÃO
-- ---------------------------------------------------------------------------
-- ATENÇÃO: reverter SEM voltar o app junto faz toda saída perder a distância na
-- tela (o app novo lê `distancia_nm`, e a coluna deixaria de existir). A ordem
-- da reversão é a inversa da aplicação: **volte o deploy do app primeiro, o
-- banco depois.**
--
-- Nada se perde ao reverter: a trilha crua continua inteira em `eventos.trilha`
-- e a distância volta a ser recalculada a cada abertura de tela, como era antes
-- — com os 205,6 kB por saída de volta no caminho.
--
-- begin;
--   alter table public.eventos drop column if exists distancia_nm;
-- commit;

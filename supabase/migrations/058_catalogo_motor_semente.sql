-- =====================================================================
-- Onda 64 · SEMENTE DO CATÁLOGO — as famílias que o PRD 3D §20 e §23 pedem.
--
-- O §23 é explícito sobre não exagerar: "Não tentar cadastrar centenas de
-- motores imediatamente. Identificar primeiro as famílias de maior
-- relevância para a frota atendida pelo Commander." E fecha dizendo que a
-- lista definitiva sai do levantamento (onda 65) e depois do ranking real
-- de solicitações dos usuários.
--
-- Então esta semente é a lista de prioridade do §23, e nada além dela.
--
-- ---------------------------------------------------------------------
-- O QUE ESTA SEMENTE **NÃO** PREENCHE, E POR QUÊ
-- ---------------------------------------------------------------------
-- Duas colunas nascem NULAS de propósito, e a decisão é de segurança do
-- produto, não de preguiça:
--
--   `part_number_oem`  — código OEM é dado do fabricante. Inventar um
--                        plausível seria pior que não ter: o dono compraria
--                        a peça errada confiando no app. Fica nulo até vir
--                        de fonte oficial (o levantamento da onda 65) ou do
--                        próprio dono, que digita o que ele comprou.
--
--   `intervalo_horas`  — intervalo de manutenção é o que decide se alguém
--   `intervalo_meses`    troca o óleo na hora certa. Chutar "250 h porque
--                        diesel costuma ser 250" num app que EXISTE pra
--                        avisar de manutenção é o tipo de erro que estraga
--                        motor. Fica nulo até sair do manual do fabricante.
--
-- O que É seguro semear, e está aqui: a ESTRUTURA. Um D6 tem filtro de
-- óleo, filtro de combustível, impelidor, trocador de calor e anodo — isso
-- é mecânica, não é palpite. E `planoSugerido` (catalogo-motor.ts) já
-- devolve `null` pra componente sem intervalo, então a tela não finge plano
-- nenhum enquanto o número não vier.
--
-- Ano de fabricação também fica nulo: "D6-440" diz a potência no nome
-- (440 hp) e por isso `potencia_hp` vem preenchida, mas a faixa de anos de
-- produção eu não tenho de fonte confiável. `faixaDeAno` devolve `null` e a
-- tela não mostra faixa — melhor que mostrar uma faixa errada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fabricantes — a lista do §20, pelos três segmentos que ele separa
-- ---------------------------------------------------------------------
insert into public.motor_fabricantes (slug, nome, segmento, ordem) values
  ('mercury',        'Mercury',            'popa',            1),
  ('yamaha',         'Yamaha',             'popa',            2),
  ('suzuki',         'Suzuki',             'popa',            3),
  ('honda-marine',   'Honda Marine',       'popa',            4),
  ('tohatsu',        'Tohatsu',            'popa',            5),
  ('hidea',          'Hidea',              'popa',            6),
  ('mercruiser',     'Mercury MerCruiser', 'centro_rabeta',   1),
  ('volvo-penta',    'Volvo Penta',        'diesel_interno',  1),
  ('cummins-marine', 'Cummins Marine',     'diesel_interno',  2),
  ('caterpillar',    'Caterpillar Marine', 'diesel_interno',  3),
  ('man',            'MAN / Everllence',   'diesel_interno',  4),
  ('mtu',            'MTU',                'diesel_interno',  5);

-- ---------------------------------------------------------------------
-- Famílias — §23, "prioridade inicial de pesquisa"
-- ---------------------------------------------------------------------
insert into public.motor_familias (fabricante_id, slug, nome, ordem)
select f.id, v.slug, v.nome, v.ordem
from (values
  ('volvo-penta',  'd4',      'D4',       1),
  ('volvo-penta',  'd6',      'D6',       2),
  ('volvo-penta',  'd8',      'D8',       3),
  ('volvo-penta',  'd11',     'D11',      4),
  ('volvo-penta',  'd13',     'D13',      5),
  ('mercury',      'fourstroke', 'FourStroke', 1),
  ('mercury',      'verado',  'Verado',   2),
  ('yamaha',       'f',       'F',        1),
  ('mercruiser',   'sterndrive', 'Sterndrive', 1),
  ('cummins-marine', 'qsb',   'QSB',      1),
  ('caterpillar',  'c',       'C',        1),
  ('man',          'i6',      'i6',       1),
  ('mtu',          'series-2000', 'Series 2000', 1)
) as v(fab, slug, nome, ordem)
join public.motor_fabricantes f on f.slug = v.fab;

-- ---------------------------------------------------------------------
-- Modelos — `potencia_hp` sai do PRÓPRIO NOME do modelo (D6-440 = 440 hp,
-- F300 = 300 hp), que é a única fonte que eu tenho sem consultar manual.
-- ---------------------------------------------------------------------
insert into public.motor_modelos (familia_id, slug, nome, potencia_hp, ordem)
select fam.id, v.slug, v.nome, v.hp, v.ordem
from (values
  -- Volvo Penta (§23)
  ('volvo-penta', 'd4',  'd4-320',   'D4-320',   320, 1),
  ('volvo-penta', 'd6',  'd6-400',   'D6-400',   400, 1),
  ('volvo-penta', 'd6',  'd6-440',   'D6-440',   440, 2),
  ('volvo-penta', 'd8',  'd8-600',   'D8-600',   600, 1),
  ('volvo-penta', 'd11', 'd11-670',  'D11-670',  670, 1),
  ('volvo-penta', 'd13', 'd13-800',  'D13-800',  800, 1),
  ('volvo-penta', 'd13', 'd13-900',  'D13-900',  900, 2),
  -- Mercury (§23)
  ('mercury', 'fourstroke', '115', '115',  115, 1),
  ('mercury', 'fourstroke', '150', '150',  150, 2),
  ('mercury', 'fourstroke', '200', '200',  200, 3),
  ('mercury', 'fourstroke', '250', '250',  250, 4),
  ('mercury', 'fourstroke', '300', '300',  300, 5),
  ('mercury', 'verado', 'verado-300', 'Verado 300', 300, 1),
  ('mercury', 'verado', 'verado-350', 'Verado 350', 350, 2),
  ('mercury', 'verado', 'verado-400', 'Verado 400', 400, 3),
  ('mercury', 'verado', 'verado-450', 'Verado 450', 450, 4),
  -- Yamaha (§23)
  ('yamaha', 'f', 'f150', 'F150', 150, 1),
  ('yamaha', 'f', 'f200', 'F200', 200, 2),
  ('yamaha', 'f', 'f250', 'F250', 250, 3),
  ('yamaha', 'f', 'f300', 'F300', 300, 4),
  ('yamaha', 'f', 'f350', 'F350', 350, 5),
  ('yamaha', 'f', 'f425', 'F425', 425, 6),
  ('yamaha', 'f', 'f450', 'F450', 450, 7)
) as v(fab, fam, slug, nome, hp, ordem)
join public.motor_fabricantes f on f.slug = v.fab
join public.motor_familias fam on fam.fabricante_id = f.id and fam.slug = v.fam;

-- ---------------------------------------------------------------------
-- Componentes — a ESTRUTURA mecânica, por segmento
-- ---------------------------------------------------------------------
-- Diesel interno e centro-rabeta compartilham a mesma lista: os dois têm
-- circuito de água salgada, trocador de calor e transmissão. Popa tem vela
-- de ignição e rabeta no lugar do trocador.
--
-- `cross join` de propósito: o componente é da FAMÍLIA (§24 — o D6-400 e o
-- D6-440 têm o mesmo filtro de óleo no mesmo lugar), então toda família do
-- segmento recebe a lista inteira.

insert into public.motor_componentes (familia_id, slug, nome, sistema, ordem)
select fam.id, c.slug, c.nome, c.sistema, c.ordem
from public.motor_familias fam
join public.motor_fabricantes fab on fab.id = fam.fabricante_id
cross join (values
  ('oleo-motor',        'Óleo do motor',                    'lubrificacao',    1),
  ('filtro-oleo',       'Filtro de óleo',                   'lubrificacao',    2),
  ('filtro-comb-prim',  'Filtro de combustível primário',   'combustivel',     3),
  ('filtro-comb-sec',   'Filtro de combustível secundário', 'combustivel',     4),
  ('filtro-ar',         'Filtro de ar',                     'admissao_escape', 5),
  ('impelidor',         'Impelidor da bomba de água salgada', 'arrefecimento', 6),
  ('liquido-arref',     'Líquido de arrefecimento',         'arrefecimento',   7),
  ('trocador-calor',    'Trocador de calor',                'arrefecimento',   8),
  ('correia',           'Correia do alternador',            'eletrica',        9),
  ('alternador',        'Alternador',                       'eletrica',       10),
  ('anodos',            'Anodos de sacrifício',             'arrefecimento',  11),
  ('oleo-transmissao',  'Óleo da transmissão',              'transmissao',    12)
) as c(slug, nome, sistema, ordem)
where fab.segmento in ('diesel_interno', 'centro_rabeta');

insert into public.motor_componentes (familia_id, slug, nome, sistema, ordem)
select fam.id, c.slug, c.nome, c.sistema, c.ordem
from public.motor_familias fam
join public.motor_fabricantes fab on fab.id = fam.fabricante_id
cross join (values
  ('oleo-motor',       'Óleo do motor',                      'lubrificacao', 1),
  ('filtro-oleo',      'Filtro de óleo',                     'lubrificacao', 2),
  ('filtro-comb',      'Filtro de combustível',              'combustivel',  3),
  ('velas',            'Velas de ignição',                   'eletrica',     4),
  ('impelidor',        'Impelidor da bomba de água',         'arrefecimento', 5),
  ('anodos',           'Anodos de sacrifício',               'arrefecimento', 6),
  ('oleo-rabeta',      'Óleo da rabeta',                     'transmissao',  7),
  ('helice',           'Hélice',                             'propulsao',    8)
) as c(slug, nome, sistema, ordem)
where fab.segmento = 'popa';

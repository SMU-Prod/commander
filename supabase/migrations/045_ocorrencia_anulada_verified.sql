-- =====================================================================
-- Onda 44 · Três itens do PRD MASTER UPGRADE 2 FINAL que faltavam:
--   1) Ocorrência ANULADA com registro          (PRD §7)
--   2) Notificações respeitam permissões        (PRD §5.2)
--   3) Verified com prazo de regularização      (PRD §15)
-- Ver docs/prd/upgrade2-master-final.txt e
-- docs/auditoria/2026-08-15-prd-final-vs-codigo.md (seção 3).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) OCORRÊNCIA ANULADA (PRD §7)
--    "ABERTA → EM ACOMPANHAMENTO → RESOLVIDA; pode também ser anulada
--     com registro quando criada por engano."
--
--    "Com registro" é a parte que importa: anular NÃO é apagar. A linha
--    fica no histórico com motivo, autor e data — o mesmo §7 diz que
--    "registros finalizados relevantes não são apagados silenciosamente".
--    Por isso as três colunas nascem amarradas num check: não existe
--    ocorrência anulada sem motivo escrito, nem por bug do app, nem por
--    alguém mexendo direto no banco.
-- ---------------------------------------------------------------------

alter table public.ocorrencias
  add column motivo_anulacao text,
  add column anulada_em timestamptz,
  add column anulada_por uuid references public.profiles(id) on delete set null;

alter table public.ocorrencias drop constraint ocorrencias_estado_check;
alter table public.ocorrencias add constraint ocorrencias_estado_check
  check (estado in ('aberta','em_acompanhamento','resolvida','anulada'));

-- Os dois lados da regra:
--   anulada  -> precisa de motivo com conteúdo (>= 5 caracteres, mesmo piso
--               de `validarMotivoAnulacao` no front) e da data;
--               `anulada_por` pode ficar null se o perfil for removido
--               depois (on delete set null) — a autoria completa segue viva
--               em `ocorrencias_transicoes`, que nunca é apagada.
--   não anulada -> as três colunas ficam limpas, pra nenhuma consulta que
--               olhe só as colunas achar que ainda está anulada.
alter table public.ocorrencias add constraint ocorrencias_anulacao_com_registro check (
  (
    estado = 'anulada'
    and anulada_em is not null
    and motivo_anulacao is not null
    and char_length(btrim(motivo_anulacao)) >= 5
  )
  or (
    estado <> 'anulada'
    and anulada_em is null
    and anulada_por is null
    and motivo_anulacao is null
  )
);

-- O histórico de transições precisa aceitar o estado novo nas duas pontas
-- (de onde veio e pra onde foi) — senão anular gravaria a ocorrência e
-- falharia ao registrar a mudança, que é o oposto de "com registro".
alter table public.ocorrencias_transicoes drop constraint ocorrencias_transicoes_estado_anterior_check;
alter table public.ocorrencias_transicoes add constraint ocorrencias_transicoes_estado_anterior_check
  check (estado_anterior in ('aberta','em_acompanhamento','resolvida','anulada'));

alter table public.ocorrencias_transicoes drop constraint ocorrencias_transicoes_estado_novo_check;
alter table public.ocorrencias_transicoes add constraint ocorrencias_transicoes_estado_novo_check
  check (estado_novo in ('aberta','em_acompanhamento','resolvida','anulada'));

-- ---------------------------------------------------------------------
-- 2) NOTIFICAÇÕES RESPEITAM PERMISSÕES (PRD §5.2)
--    "Notificações sempre respeitam permissões do usuário."
--
--    A política antiga de `alertas_enviados` era `pode_ver_embarcacao`:
--    QUALQUER pessoa com vínculo lia o título de TODO alerta do barco.
--    Um tripulante sem acesso a Documentos via "Seguro da embarcação —
--    vencido" no histórico de avisos. Agora a leitura segue a mesma matriz
--    do resto do app, pela área do alvo do alerta:
--      - alerta de item monitorado -> aba do item  (`aba_alvo`, igual à RLS de itens_monitorados)
--      - alerta de equipamento     -> aba do equipamento (`aba_do_equipamento`)
--      - aviso sem alvo (mar ruim) -> não pertence a hub nenhum: todo mundo com vínculo
--
--    O disparo em si (quem recebe push/e-mail) roda com service role e
--    ignora RLS por construção; a régua equivalente lá é aplicada em
--    código, em `app/api/alertas/disparar/route.ts`, com as MESMAS funções
--    de permissão do front.
-- ---------------------------------------------------------------------

drop policy "alertas: ver com vinculo" on public.alertas_enviados;

create policy "alertas: ver pela matriz da area do alerta" on public.alertas_enviados for select
  using (
    case
      when public.alertas_enviados.item_monitorado_id is not null then exists (
        select 1 from public.itens_monitorados i
        where i.id = public.alertas_enviados.item_monitorado_id
          and public.permissao(i.embarcacao_id, public.aba_alvo(i.equipamento_id, i.categoria), 'ver')
      )
      when public.alertas_enviados.equipamento_id is not null then exists (
        select 1 from public.equipamentos e
        where e.id = public.alertas_enviados.equipamento_id
          and public.permissao(e.embarcacao_id, public.aba_do_equipamento(e.tipo), 'ver')
      )
      else public.pode_ver_embarcacao(public.alertas_enviados.embarcacao_id)
    end
  );

-- ---------------------------------------------------------------------
-- 3) VERIFIED COM PRAZO DE REGULARIZAÇÃO (PRD §15)
--    "Se requisito deixar de ser atendido: 'Atualização necessária — 15
--     dias'. Se regularizar dentro dos 15 dias: mantém o selo. Se não
--     regularizar: Verified suspenso. Ao corrigir, reavaliação automática
--     e reativação."
--
--    O prazo exige memória: sem saber DESDE QUANDO o requisito está
--    falhando, não existe "15 dias". Este é o dado mínimo pra isso —
--    duas datas por embarcação, nada mais:
--
--      conquistado_em  primeira vez que os cinco pilares ficaram de pé.
--                      É o que separa "nunca teve o selo" (não há o que
--                      suspender) de "tinha e caiu" (aí o relógio corre).
--                      Nunca é reescrito depois.
--      pendencia_desde quando o pilar caiu. Volta a null assim que tudo é
--                      regularizado — é isso que faz a reativação ser
--                      automática, sem ninguém aprovar nada.
--
--    QUAL pilar caiu não é guardado de propósito: é recalculado dos dados
--    reais do barco a cada leitura (`lib/domain/verified.ts`). Guardar a
--    lista criaria uma segunda verdade pra sair de sincronia com a
--    primeira.
--
--    Não há coluna de "suspenso": suspensão é derivada
--    (pendencia_desde + 15 dias < agora). Estado derivado não desatualiza
--    por falta de um cron rodando.
-- ---------------------------------------------------------------------

create table public.verified_estado (
  embarcacao_id uuid primary key references public.embarcacoes(id) on delete cascade,
  conquistado_em timestamptz,
  pendencia_desde timestamptz,
  atualizado_em timestamptz not null default now(),
  -- Pendência só faz sentido pra quem já conquistou: não dá pra suspender
  -- um selo que nunca foi dado.
  constraint verified_pendencia_exige_conquista
    check (pendencia_desde is null or conquistado_em is not null)
);

alter table public.verified_estado enable row level security;

-- Mesma régua do resto: quem vê a ficha da embarcação vê a situação do
-- selo; quem edita a ficha é quem pode gravar a avaliação. Nunca using(true).
create policy "verified_estado: ver pela matriz" on public.verified_estado for select
  using (public.permissao(embarcacao_id, 'embarcacao', 'ver'));
create policy "verified_estado: criar pela matriz" on public.verified_estado for insert
  with check (public.permissao(embarcacao_id, 'embarcacao', 'editar'));
create policy "verified_estado: atualizar pela matriz" on public.verified_estado for update
  using (public.permissao(embarcacao_id, 'embarcacao', 'editar'))
  with check (public.permissao(embarcacao_id, 'embarcacao', 'editar'));

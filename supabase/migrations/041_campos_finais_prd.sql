-- =====================================================================
-- Onda 41 · Fecha os campos que as duas auditorias marcaram como
-- "falta e é pequeno" (docs/auditoria/2026-08-14-prd-upgrade2-parte1.md
-- §"Falta e é pequeno" e -parte2.md §5). Nenhuma tabela nova: só colunas
-- e opções que o PRD lista e o banco ainda não aceitava.
-- =====================================================================

-- 1) Contatos (PRD §20) — a lista pedia Nome/Empresa/Especialidade/
--    Telefone/E-mail/Observações/Avaliação; faltavam três.
alter table public.contatos add column if not exists empresa text;
alter table public.contatos add column if not exists email text;
alter table public.contatos add column if not exists observacoes text;

-- 2) Fotos (PRD §19) — o quinto álbum da lista.
alter table public.fotos drop constraint fotos_album_check;
alter table public.fotos add constraint fotos_album_check
  check (album in ('exterior','interior','conves','documentacao','outros'));

-- 3) Diário / abertura da saída (PRD §23) — "Local de saída" e
--    "Passageiros" eram campos próprios no PRD e viravam texto solto na
--    descrição. `passageiros` é text[] (nomes digitados) e não uuid[] de
--    propósito: passageiro não é usuário do app, diferente de `tripulacao`.
alter table public.eventos add column if not exists local_saida text;
alter table public.eventos add column if not exists passageiros text[] not null default '{}';

comment on column public.eventos.passageiros is
  'Nomes livres de quem estava a bordo sem ser tripulação cadastrada. DADO PESSOAL: o PRD §27 lista "Passageiros" entre o que NÃO acompanha a embarcação numa transferência de propriedade — ver aceitar_transferencia abaixo.';

-- 4) Explorar / Parceiros (PRD §52, §60) — faltavam duas das seis
--    categorias ("Loja náutica" e "Outros parceiros pertinentes").
alter table public.parceiros drop constraint parceiros_categoria_check;
alter table public.parceiros add constraint parceiros_categoria_check
  check (categoria in ('marina','posto','pousada','restaurante','loja_nautica','outros'));

-- 5) Elétrica (PRD §14) — "Baterias: Tipo" e "Sistema/painel de bordo".
--    O painel entra como tipo de equipamento (cai em Elétrica pelo `else`
--    de aba_do_equipamento, igual gerador e bateria — nada muda na RLS).
alter table public.equipamentos add column if not exists tipo_bateria text
  check (tipo_bateria in ('chumbo_acido','agm','gel','litio','outro'));

alter table public.equipamentos drop constraint equipamentos_tipo_check;
alter table public.equipamentos add constraint equipamentos_tipo_check
  check (tipo in ('motor','gerador','bateria','painel','outro'));

comment on column public.equipamentos.tipo_bateria is
  'Só faz sentido quando tipo = ''bateria''. Fica null nos demais — não é erro.';

-- 6) Motores: Óleo e Filtros com tipo (PRD §11) — mesma mecânica
--    categoria-based do Casco (migration 003) e da Hidráulica (032), sem
--    tabela nova. Estes itens sempre têm `equipamento_id` (o motor), e
--    `aba_alvo` já resolve pelo equipamento antes de olhar a categoria —
--    então a área continua sendo Motores. O `when` novo em aba_alvo
--    abaixo é só a rede de segurança pro caso de um item ficar órfão do
--    motor (equipamento apagado): sem ele cairia em 'embarcacao', área
--    errada.
alter table public.itens_monitorados drop constraint itens_monitorados_categoria_check;
alter table public.itens_monitorados add constraint itens_monitorados_categoria_check
  check (categoria in (
    'documento','deck','fibra','inox','vidros','estofados','casco_outros',
    'hidraulica_agua_doce','hidraulica_grey_water','hidraulica_black_water','seguranca',
    'motor_oleo','motor_filtro_oleo','motor_filtro_combustivel','motor_filtro_ar','motor_filtro_outros'
  ));

alter table public.eventos drop constraint eventos_categoria_check;
alter table public.eventos add constraint eventos_categoria_check
  check (categoria in (
    'documento','deck','fibra','inox','vidros','estofados','casco_outros',
    'hidraulica_agua_doce','hidraulica_grey_water','hidraulica_black_water','seguranca',
    'motor_oleo','motor_filtro_oleo','motor_filtro_combustivel','motor_filtro_ar','motor_filtro_outros'
  ));

create or replace function public.aba_alvo(p_equipamento_id uuid, p_categoria text)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select public.aba_do_equipamento(e.tipo) from public.equipamentos e where e.id = p_equipamento_id),
    case
      when p_categoria = 'documento' then 'documentos'
      when p_categoria in ('deck','fibra','inox','vidros','estofados','casco_outros') then 'casco'
      when p_categoria in ('hidraulica_agua_doce','hidraulica_grey_water','hidraulica_black_water') then 'hidraulica'
      when p_categoria = 'seguranca' then 'seguranca'
      when p_categoria in ('motor_oleo','motor_filtro_oleo','motor_filtro_combustivel','motor_filtro_ar','motor_filtro_outros') then 'motores'
      else 'embarcacao'
    end
  );
$$;

-- 7) Transferência de propriedade (PRD §27) — a lista "NÃO transferir
--    automaticamente" (dados pessoais, informações privadas, passageiros,
--    custos privados, informações financeiras pessoais) não estava sendo
--    aplicada: a onda 39 trocava o vínculo de PROP e o dono novo herdava
--    o dossiê inteiro, inclusive quanto o dono antigo pagou em cada
--    serviço e quem ele levou a bordo.
--
--    O que fica (dados técnicos, PRD §27): motores, horas, manutenções,
--    ocorrências, histórico, documentos, fotos.
--    O que é apagado aqui, em transação com a troca de dono:
--      · eventos.custo_centavos → null  (informação financeira pessoal)
--      · eventos.passageiros    → '{}'  (nominalmente citado no PRD)
--      · eventos.tripulacao     → '{}'  (quem estava a bordo é dado pessoal
--                                        de terceiro; e esses usuários já
--                                        perdem o vínculo logo acima)
--      · contatos               → apagados (PRD §20 abre a seção com
--                                 "Lista PESSOAL de contatos de confiança"
--                                 — é a agenda do dono, com telefone e
--                                 e-mail de terceiros, não do barco)
--    Irreversível de propósito e avisado na tela antes de iniciar.
create or replace function public.aceitar_transferencia(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into t from public.transferencias
    where codigo = p_codigo and status = 'pendente' and expira_em > now();
  if not found then
    raise exception 'transferência inválida ou expirada';
  end if;
  if v_email = '' or lower(t.destinatario_email) <> v_email then
    raise exception 'este convite foi enviado para outro e-mail';
  end if;

  delete from public.vinculos where embarcacao_id = t.embarcacao_id and papel = 'CMDT';
  delete from public.vinculos where embarcacao_id = t.embarcacao_id and usuario_id = t.de_usuario_id and papel = 'PROP';

  update public.eventos
    set custo_centavos = null, passageiros = '{}', tripulacao = '{}'
    where embarcacao_id = t.embarcacao_id;
  delete from public.contatos where embarcacao_id = t.embarcacao_id;

  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), t.embarcacao_id, 'PROP');

  update public.transferencias
    set status = 'aceita', para_usuario_id = auth.uid(), aceita_em = now()
    where id = t.id;

  return t.embarcacao_id;
end $$;

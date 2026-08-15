-- =====================================================================
-- Onda 47 · PLANOS, PREÇOS E CICLO DE ASSINATURA
-- PRD FINAL `docs/prd/upgrade2-master-final.txt` §2, §2.1, §2.2, §2.3,
-- §19 e §23 · decisões congeladas do §28.
--
-- CONTEXTO QUE PERMITE ESTA MIGRATION SER TÃO DIRETA: em 15/08/2026 o banco
-- de produção tinha ZERO assinaturas (nenhuma ativa, nenhuma cancelada),
-- 2 usuários e 2 embarcações. Mudar preço, nome de plano e vocabulário de
-- status agora não afeta cobrança de ninguém. É a melhor janela possível, e
-- ela não volta.
--
-- O QUE ESTA MIGRATION *NÃO* FAZ, DE PROPÓSITO:
--   · não apaga nada de ninguém. §23 é explícito — "preservando dados e
--     histórico; recursos pagos ficam bloqueados, não apagados". Os limites
--     novos (2 Diários no Free, 1 embarcação no Commander, 2 acessos por
--     embarcação) valem só pra CRIAÇÃO NOVA; nenhuma linha existente é
--     removida, e nenhuma policy de SELECT foi apertada;
--   · não toca em `profiles.is_admin` nem no painel de Admin (outra onda
--     está reconstruindo os papéis administrativos);
--   · não guarda o preço dos planos no banco. O catálogo vive em
--     `web/lib/domain/planos.ts` (fonte única, regra pura com teste) e aqui
--     só entra a CONSTRAINT dos ids válidos — preço em dois lugares vira
--     preço divergente na primeira mudança.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) `assinaturas`: os planos do §2 e o vocabulário de status do §23
-- ---------------------------------------------------------------------

-- Só plano PAGO e disponível vira linha de assinatura. Free não gera
-- cobrança (não existe assinatura de plano grátis) e Enterprise é "reservado /
-- Em breve" (§2) — vender o que ainda não foi definido seria prometer produto
-- inexistente.
alter table public.assinaturas drop constraint assinaturas_plano_check;
alter table public.assinaturas add constraint assinaturas_plano_check
  check (plano in ('commander','commander_pro','captain_pro','partner_prestador','partner_loja'));

-- "inadimplente" era vocabulário de cobrança; o PRD §23 fala em status
-- "problema de pagamento", que é o que o cliente lê. O UPDATE abaixo existe
-- por higiene (hoje afeta 0 linhas) pra migration ser segura se rodar em
-- qualquer cópia do banco.
update public.assinaturas set status = 'problema_pagamento' where status = 'inadimplente';
alter table public.assinaturas drop constraint assinaturas_status_check;
alter table public.assinaturas add constraint assinaturas_status_check
  check (status in ('pendente','ativa','problema_pagamento','cancelada'));

-- §23: "Período de tolerância recomendado deve ser configurável". Pra existir
-- tolerância é preciso saber DESDE QUANDO o pagamento falha — sem esta coluna
-- não há como contar prazo nenhum. Gravada pelo trigger abaixo, nunca pela
-- aplicação: assim o relógio não depende de ninguém abrir tela.
alter table public.assinaturas add column problema_desde timestamptz;

-- ---------------------------------------------------------------------
-- 2) Aposenta a promo dos 100 fundadores
-- ---------------------------------------------------------------------
-- O PRD FINAL não menciona o plano fundador em lugar nenhum e ninguém chegou
-- a assiná-lo. O MECANISMO (preço promocional temporário) não se perdeu:
-- virou `assinatura_promocoes` no item 4, atendendo §2.1 e §2.2.
drop trigger if exists assinaturas_fundador on public.assinaturas;
drop function if exists public.atribuir_fundador_numero();
drop function if exists public.vagas_fundador_restantes();

-- A policy de INSERT da migration 017 exigia `fundador_numero is null` (pra
-- ninguém se autoproclamar fundador). Sem a coluna, a trava vira o que sempre
-- importou: a pessoa só cria a PRÓPRIA linha, e só como pendente — quem muda
-- pra 'ativa' continua sendo o webhook, via service role.
drop policy "assinatura: criar a propria pendente" on public.assinaturas;
create policy "assinatura: criar a propria pendente" on public.assinaturas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and status = 'pendente');

alter table public.assinaturas drop column fundador_numero;

-- O trigger antigo também mantinha `atualizado_em` — o substituto cuida disso
-- e, de quebra, liga/desliga o relógio da tolerância no mesmo lugar.
create or replace function public.assinaturas_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  if new.status = 'problema_pagamento' and coalesce(old.status, '') <> 'problema_pagamento' then
    new.problema_desde := coalesce(new.problema_desde, now());
  elsif new.status <> 'problema_pagamento' then
    -- Voltou a pagar (ou cancelou): o relógio zera. Sem isso, uma segunda
    -- recusa meses depois herdaria a data da primeira e bloquearia na hora.
    new.problema_desde := null;
  end if;
  return new;
end $$;
revoke execute on function public.assinaturas_touch() from public, anon, authenticated;

create trigger assinaturas_touch before update on public.assinaturas
  for each row execute function public.assinaturas_touch();

-- ---------------------------------------------------------------------
-- 3) Parâmetros de cobrança — a tolerância CONFIGURÁVEL do §23
-- ---------------------------------------------------------------------
-- Linha única (o `check (id)` com PK boolean garante que só existe uma).
-- Trocar o prazo é um UPDATE, não um deploy — que é exatamente o que "não
-- hardcoded" quer dizer.
create table public.assinatura_parametros (
  id boolean primary key default true check (id),
  tolerancia_dias int not null default 7 check (tolerancia_dias between 0 and 60),
  atualizado_em timestamptz not null default now()
);
insert into public.assinatura_parametros (id) values (true);

alter table public.assinatura_parametros enable row level security;
-- Qualquer pessoa logada precisa ler o prazo (é o que a tela dela mostra
-- durante a tolerância). Nunca `using (true)`: anônimo não entra.
create policy "parametros de cobranca: autenticado ve" on public.assinatura_parametros
  for select to authenticated using (auth.uid() is not null);
-- Sem policy de INSERT/UPDATE/DELETE: mudar a tolerância é operação do dono,
-- via service role / SQL — nenhum cliente muda o próprio prazo.

-- ---------------------------------------------------------------------
-- 4) Promoções (§2.1 migração de concorrente, §2.2 entrada pelo Gold)
-- ---------------------------------------------------------------------
create table public.assinatura_promocoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  promocao text not null check (promocao in ('migracao_concorrente','entrada_gold')),
  plano text not null check (plano in ('commander','commander_pro','captain_pro','partner_prestador','partner_loja')),
  -- Quanto o cliente paga por mês enquanto a promoção vale. 0 = incluído
  -- (§2.2: "recebe 6 meses do plano Commander incluídos").
  valor_promocional_centavos int not null check (valor_promocional_centavos >= 0),
  -- §2.1: "20% de desconto na avaliação para Commander Gold" durante os
  -- mesmos 3 meses. 0 nas promoções que não dão desconto no Gold.
  desconto_gold_percentual int not null default 0 check (desconto_gold_percentual between 0 and 100),
  valido_ate date not null,
  origem_id uuid,
  criado_em timestamptz not null default now()
);
create index idx_assinatura_promocoes_usuario on public.assinatura_promocoes (usuario_id, valido_ate desc);

-- §2.1, última linha: "Benefícios promocionais de migração NÃO ACUMULAM com a
-- oferta de entrada direta pelo Gold." Índice parcial não serve aqui
-- (`current_date` não é immutable), então a trava é trigger.
create or replace function public.assinatura_promocao_nao_acumula()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.assinatura_promocoes p
    where p.usuario_id = new.usuario_id and p.valido_ate >= current_date
  ) then
    raise exception 'promocao_ja_vigente';
  end if;
  if exists (
    select 1 from public.premium_concessoes c
    where c.usuario_id = new.usuario_id and c.valido_ate >= current_date
  ) then
    raise exception 'promocao_ja_vigente';
  end if;
  return new;
end $$;
revoke execute on function public.assinatura_promocao_nao_acumula() from public, anon, authenticated;

create trigger assinatura_promocoes_nao_acumula before insert on public.assinatura_promocoes
  for each row execute function public.assinatura_promocao_nao_acumula();

alter table public.assinatura_promocoes enable row level security;
create policy "promocoes: ver a propria" on public.assinatura_promocoes
  for select to authenticated using (usuario_id = (select auth.uid()));
-- Sem policy de escrita: promoção é concedida pela operação (service role) ou
-- por função security definer (o Gold, item 7). Ninguém se autopromove.

-- ---------------------------------------------------------------------
-- 5) `premium_concessoes` passa a dizer QUAL plano concede
-- ---------------------------------------------------------------------
-- Até aqui a concessão dizia só "Premium" — que era binário. Com sete planos,
-- "6 meses do plano Commander" (§2.2) precisa nomear o plano.
alter table public.premium_concessoes
  add column plano_concedido text not null default 'commander'
  check (plano_concedido in ('commander','commander_pro','captain_pro'));

alter table public.premium_concessoes drop constraint premium_concessoes_origem_check;
alter table public.premium_concessoes add constraint premium_concessoes_origem_check
  check (origem in ('gold','migracao','cortesia'));

-- ---------------------------------------------------------------------
-- 6) Plano vigente e limites — fonte única no banco
-- ---------------------------------------------------------------------
-- Espelha `nivelPlano` de `web/lib/domain/plano-acesso.ts`. Existe porque §27.2
-- exige: "Permissões devem ser aplicadas tanto na interface quanto no
-- backend/API" — e um limite que só o front respeita não é limite.
--
-- `problema_pagamento` conta como plano vigente AQUI de propósito: a decisão
-- de bloquear depois da tolerância é da aplicação (`avaliarCiclo`), e o banco
-- ser generoso garante que um problema de cartão nunca vire perda de dado.
create or replace function public.plano_do_usuario(p_usuario uuid)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (
      select a.plano from public.assinaturas a
      where a.usuario_id = p_usuario and a.status in ('ativa','problema_pagamento')
      order by case a.plano when 'commander_pro' then 2 else 1 end desc
      limit 1
    ),
    (
      select c.plano_concedido from public.premium_concessoes c
      where c.usuario_id = p_usuario and c.valido_ate >= current_date
      order by c.valido_ate desc
      limit 1
    ),
    'proprietario_free'
  );
$$;
-- Sem grant pra `authenticated`: tudo em `public` vira endpoint
-- `/rest/v1/rpc/<nome>`, e esta função recebe um uuid ARBITRário sem checar
-- quem chama — aberta, qualquer assinante perguntaria o plano de outra
-- pessoa. Ela só roda de dentro de outras funções `security definer`, onde o
-- usuário efetivo já é o dono do banco. O app lê o próprio plano pela RLS de
-- `assinaturas` (`carregarAssinatura`), nunca por RPC.
revoke all on function public.plano_do_usuario(uuid) from public, anon, authenticated;

-- §2/§28: Commander 1 embarcação, Commander Pro até 4. Free também 1 —
-- "Pode cadastrar 1 embarcação" (§2.3).
create or replace function public.limite_embarcacoes(p_plano text)
returns int language sql immutable set search_path = public as $$
  select case p_plano when 'commander_pro' then 4 else 1 end;
$$;

-- §19/§28: "até 2 acessos de tripulação por embarcação". Free: nenhum —
-- §2.3, "Não pode adicionar tripulação".
create or replace function public.limite_acessos_tripulacao(p_plano text)
returns int language sql immutable set search_path = public as $$
  select case p_plano when 'commander' then 2 when 'commander_pro' then 2 else 0 end;
$$;

-- ---------------------------------------------------------------------
-- 7) Limite de embarcações na criação
-- ---------------------------------------------------------------------
-- Mesma assinatura de antes (migration 001) — a action `concluirOnboarding`
-- não muda de contrato, só passa a receber um erro nomeado quando o plano
-- acabou. Downgrade NÃO apaga barco: quem já tem 4 e cai pro Commander
-- continua com os 4 no banco; a gestão dos excedentes é que fica pausada, e
-- isso é decidido na aplicação (`dividirEmbarcacoesPorPlano`).
create or replace function public.criar_embarcacao(
  p_nome text, p_estaleiro text, p_modelo text, p_ano int, p_marina text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_ja int;
  v_limite int;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  select count(*) into v_ja from public.vinculos
    where usuario_id = auth.uid() and papel = 'PROP';
  v_limite := public.limite_embarcacoes(public.plano_do_usuario(auth.uid()));
  if v_ja >= v_limite then
    raise exception 'limite_embarcacoes_%', v_limite;
  end if;

  insert into public.embarcacoes (nome, estaleiro, modelo, ano, marina)
  values (p_nome, p_estaleiro, p_modelo, p_ano, p_marina)
  returning id into v_id;
  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), v_id, 'PROP');
  return v_id;
end $$;
revoke all on function public.criar_embarcacao from public, anon;
grant execute on function public.criar_embarcacao to authenticated;

-- ---------------------------------------------------------------------
-- 8) Limite de acessos de tripulação — §19, "convite pendente ocupa vaga"
-- ---------------------------------------------------------------------
create or replace function public.acessos_ocupados(p_embarcacao uuid)
returns int language sql security definer stable set search_path = public as $$
  select (
    (select count(*) from public.vinculos v
       where v.embarcacao_id = p_embarcacao and v.papel = 'CMDT')
    + (select count(*) from public.convites c
       where c.embarcacao_id = p_embarcacao and c.usado_em is null and c.expira_em > now())
  )::int;
$$;
-- Mesmo motivo de `plano_do_usuario`: uuid arbitrário, sem dono. A tela conta
-- tripulação por `carregarUsoTripulacao`, que passa pela RLS.
revoke all on function public.acessos_ocupados(uuid) from public, anon, authenticated;

-- O limite da embarcação é o do plano do PROPRIETÁRIO dela — não do usuário
-- que está fazendo a operação. Sem isso, um Captain com "Gerenciar tripulação"
-- (§19) herdaria o limite do plano dele, que não paga por esta embarcação.
create or replace function public.limite_acessos_da_embarcacao(p_embarcacao uuid)
returns int language sql security definer stable set search_path = public as $$
  select public.limite_acessos_tripulacao(
    public.plano_do_usuario(
      (select v.usuario_id from public.vinculos v
        where v.embarcacao_id = p_embarcacao and v.papel = 'PROP' limit 1)
    )
  );
$$;
revoke all on function public.limite_acessos_da_embarcacao(uuid) from public, anon, authenticated;

-- A regra em si mora numa função COMUM (não de trigger), pra os dois triggers
-- abaixo compartilharem exatamente a mesma conta — plpgsql não deixa um
-- trigger chamar outro como função normal.
create or replace function public.checar_limite_acessos(p_embarcacao uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_limite int;
  v_ocupados int;
begin
  v_limite := public.limite_acessos_da_embarcacao(p_embarcacao);
  v_ocupados := public.acessos_ocupados(p_embarcacao);
  if v_ocupados >= v_limite then
    raise exception 'limite_acessos_%_%', v_limite, v_ocupados;
  end if;
end $$;
revoke all on function public.checar_limite_acessos(uuid) from public, anon, authenticated;

create or replace function public.barrar_convite_excedente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.checar_limite_acessos(new.embarcacao_id);
  return new;
end $$;
revoke execute on function public.barrar_convite_excedente() from public, anon, authenticated;

-- Convite novo ocupa vaga na hora de ser CRIADO (§19) — é o que impede o dono
-- de espalhar cinco links e descobrir o limite só quando o quinto aceitar.
create trigger convites_respeitam_limite before insert on public.convites
  for each row execute function public.barrar_convite_excedente();

-- E o vínculo também é checado, porque nem todo vínculo nasce de convite
-- (transferência de propriedade, operação manual, futura ação de Captain com
-- "Gerenciar tripulação"). Só pra CMDT: PROP nunca ocupa vaga de tripulação,
-- e barrar PROP quebraria `criar_embarcacao`.
create or replace function public.barrar_vinculo_excedente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.papel = 'CMDT' then
    perform public.checar_limite_acessos(new.embarcacao_id);
  end if;
  return new;
end $$;
revoke execute on function public.barrar_vinculo_excedente() from public, anon, authenticated;

create trigger vinculos_respeitam_limite before insert on public.vinculos
  for each row execute function public.barrar_vinculo_excedente();

-- `aceitar_convite` precisa marcar o convite como USADO antes de inserir o
-- vínculo: senão o próprio convite que está sendo aceito ainda conta como
-- "pendente" na hora do trigger, e o aceite da última vaga falharia por
-- excesso de 1. Fora essa inversão, a função é a mesma da migration 008.
create or replace function public.aceitar_convite(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into c from public.convites
    where codigo = p_codigo and usado_em is null and expira_em > now()
    for update;
  if not found then
    raise exception 'convite inválido ou expirado';
  end if;
  if exists (
    select 1 from public.vinculos
    where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()
  ) then
    raise exception 'você já faz parte desta tripulação';
  end if;
  update public.convites set usado_por = auth.uid(), usado_em = now() where id = c.id;
  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel, permissoes)
    values (auth.uid(), c.embarcacao_id, 'CMDT', c.nivel, c.permissoes);
  return c.embarcacao_id;
end $$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;

-- ---------------------------------------------------------------------
-- 9) §2.2 — entrada direta pelo Gold concede 6 meses de Commander
-- ---------------------------------------------------------------------
-- A regra vive num TRIGGER de `premium_concessoes`, e não dentro de
-- `gold_definir_estado()`. A primeira tentativa foi recriar aquela função
-- inteira só pra trocar o bloco da concessão — e isso REVERTEU, sem querer, a
-- mudança de autoridade que a onda do Admin (migration 049) tinha acabado de
-- aplicar na MESMA função. Duas ondas reescrevendo a mesma função grande é
-- receita de perder trabalho: a última a rodar ganha, em silêncio.
--
-- Aqui a regra fica onde o dado nasce, então vale pra QUALQUER caminho que
-- conceda Gold — hoje ou depois — e nenhuma das duas ondas precisa saber da
-- outra. `gold_definir_estado()` não é tocada por esta migration.
--
-- §2.2: "Cliente NÃO ASSINANTE contrata a avaliação Gold no preço integral. Se
-- a embarcação for aprovada, recebe 6 MESES do plano Commander incluídos."
--   · quem já paga não recebe concessão (não se "dá" o que a pessoa já tem, e o
--     plano dela continua intacto);
--   · a validade é de 6 meses fixos, desacoplada da validade do SELO — são
--     coisas diferentes: o selo vale 6 ou 12 meses conforme a avaliação, o
--     benefício comercial vale 6.
-- §2.1: "Benefícios promocionais não acumulam" — concessão ou promoção ainda
-- vigente cancela a nova.
--
-- Devolver `null` num BEFORE INSERT descarta a linha SEM erro, de propósito: a
-- aprovação do Gold nunca pode falhar porque o cliente já era assinante.
create or replace function public.normalizar_concessao_gold()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origem <> 'gold' then
    return new;
  end if;

  if exists (
    select 1 from public.assinaturas a
    where a.usuario_id = new.usuario_id and a.status in ('ativa','problema_pagamento')
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.premium_concessoes c
    where c.usuario_id = new.usuario_id and c.valido_ate >= current_date
  ) or exists (
    select 1 from public.assinatura_promocoes p
    where p.usuario_id = new.usuario_id and p.valido_ate >= current_date
  ) then
    return null;
  end if;

  new.plano_concedido := 'commander';
  new.valido_ate := (current_date + interval '6 months')::date;
  return new;
end $$;
revoke execute on function public.normalizar_concessao_gold() from public, anon, authenticated;

create trigger premium_concessoes_gold_seis_meses before insert on public.premium_concessoes
  for each row execute function public.normalizar_concessao_gold();

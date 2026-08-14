-- =====================================================================
-- Onda 37 · Transferência de propriedade (PRD §27) — "o proprietário pode
-- mudar, enquanto a embarcação e sua memória técnica continuam existindo".
-- Reaproveita o MESMO desenho do convite de tripulação (migration 008):
-- tabela com código de 10 caracteres + RPC info_* (lida antes de logar,
-- security definer) + RPC aceitar_* (age, security definer) — só que aqui
-- quem aceita vira PROP (não CMDT) e precisa confirmar o e-mail de destino
-- (mesmo padrão de "clamar por e-mail do JWT" da migration 035).
-- =====================================================================

create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  de_usuario_id uuid not null references public.profiles(id) on delete cascade,
  codigo text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  destinatario_email text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aceita', 'cancelada')),
  para_usuario_id uuid references public.profiles(id),
  expira_em timestamptz not null default now() + interval '7 days',
  aceita_em timestamptz,
  cancelada_em timestamptz,
  criado_em timestamptz not null default now()
);

-- só uma transferência pendente por embarcação de cada vez — pedir uma nova
-- cancela a anterior (feito pela action, ver web/lib/acoes/transferencia.ts)
-- antes de inserir; este índice é o cinto-e-suspensório que barra uma
-- corrida de dois inserts pendentes simultâneos pra códigos diferentes.
create unique index idx_transferencias_uma_pendente on public.transferencias (embarcacao_id) where status = 'pendente';
create index idx_transferencias_embarcacao on public.transferencias (embarcacao_id, status);

alter table public.transferencias enable row level security;

-- só o PROP atual gerencia (cria/lê/cancela) as transferências do próprio barco.
create policy "transferencias: prop gerencia" on public.transferencias for all
  using (public.eh_prop(embarcacao_id)) with check (public.eh_prop(embarcacao_id));

revoke all on table public.transferencias from public, anon;
grant select, insert, update on table public.transferencias to authenticated;

-- Info pública mínima pro destinatário ler ANTES de aceitar — mesmo
-- contrato de info_convite (migration 008). Sem isso, o destinatário (que
-- ainda não tem vínculo com o barco) veria "não encontrado" mesmo logado,
-- porque a policy acima só deixa o PROP enxergar a linha.
create or replace function public.info_transferencia(p_codigo text)
returns table (nome_embarcacao text, valido boolean, destinatario_email text)
language sql security definer stable set search_path = public as $$
  select e.nome, (t.status = 'pendente' and t.expira_em > now()), t.destinatario_email
  from public.transferencias t
  join public.embarcacoes e on e.id = t.embarcacao_id
  where t.codigo = p_codigo;
$$;
revoke all on function public.info_transferencia(text) from public, anon;
grant execute on function public.info_transferencia(text) to authenticated;

-- Aceitar: só o dono do e-mail convidado pode aceitar (compara com o e-mail
-- do JWT em sessão, igual à migration 035) — sem essa checagem, quem
-- adivinhasse o código de 10 caracteres de outra pessoa poderia virar dono.
--
-- Decisões tomadas aqui (justificadas no relatório da onda 37, PRD não fecha):
--   1) Tripulação (CMDT) existente é REVOGADA — o novo dono reconvida quem
--      quiser. Manter acesso de gente que o novo dono nunca escolheu seria
--      vazamento, não continuidade.
--   2) Fotos/documentos/histórico técnico FICAM — são linhas com
--      embarcacao_id, nunca tocadas aqui (a memória é do barco, PRD §26).
--   3) Dono anterior PERDE o acesso — seu vínculo PROP é removido. A tela
--      de início da transferência avisa isso antes de confirmar
--      (web/app/(app)/barco/transferir/page.tsx).
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

  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), t.embarcacao_id, 'PROP');

  update public.transferencias
    set status = 'aceita', para_usuario_id = auth.uid(), aceita_em = now()
    where id = t.id;

  return t.embarcacao_id;
end $$;
revoke all on function public.aceitar_transferencia(text) from public, anon;
grant execute on function public.aceitar_transferencia(text) to authenticated;

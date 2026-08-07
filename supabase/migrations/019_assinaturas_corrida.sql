-- 019: achados das revisoes das tasks 1 e 2.
-- (a) double-submit do form criava DUAS assinaturas reais no Asaas: nada
--     impedia duas linhas vivas do mesmo usuario. O unique parcial faz o
--     segundo insert falhar, e a action ja desfaz a assinatura no Asaas
--     nesse caminho. De quebra, fecha o spam de pendentes que zerava o
--     contador da promo na landing.
-- (b) dois webhooks ativando assinaturas ao mesmo tempo liam o mesmo
--     max(fundador_numero) e o perdedor estourava o unique com erro 500.
--     O advisory lock serializa so essa atribuicao.

create unique index assinaturas_uma_viva_idx
  on public.assinaturas (usuario_id) where status <> 'cancelada';

create or replace function public.atribuir_fundador_numero()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ativa' and new.fundador_numero is null then
    perform pg_advisory_xact_lock(hashtext('fundador_numero'));
    select coalesce(max(fundador_numero), 0) + 1 into new.fundador_numero from public.assinaturas;
    if new.fundador_numero > 100 then new.fundador_numero := null; end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

-- 021: conserta o no-op do contador (achado da task 1).
-- O trigger clampava plano/visualizacoes em TODO update — inclusive no da
-- propria RPC registrar_visualizacao (security definer) e num futuro upgrade
-- de plano via service_role. A protecao contra o usuario ja existe na camada
-- certa: privilegio de coluna (authenticated nao tem UPDATE em plano nem em
-- visualizacoes). O trigger fica so com o que e dele: regra de 1 atualizacao
-- de preco/dia e os timestamps.

create or replace function public.parceiro_regras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.preco_diaria_centavos is distinct from old.preco_diaria_centavos)
     or (new.preco_diesel_centavos is distinct from old.preco_diesel_centavos)
     or (new.qtd_poitas is distinct from old.qtd_poitas) then
    if old.precos_atualizados_em is not null
       and old.precos_atualizados_em::date = current_date then
      raise exception 'limite de 1 atualizacao de preco/disponibilidade por dia';
    end if;
    new.precos_atualizados_em := now();
  else
    new.precos_atualizados_em := old.precos_atualizados_em;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

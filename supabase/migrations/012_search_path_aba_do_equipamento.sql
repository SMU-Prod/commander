create or replace function public.aba_do_equipamento(p_tipo text)
returns text language sql immutable set search_path = public as $$
  select case when p_tipo = 'motor' then 'motores' else 'eletrica' end;
$$;

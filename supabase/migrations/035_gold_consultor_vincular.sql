-- Onda 35 · Autoatendimento do consultor: o admin cadastra nome/e-mail em
-- `gold_consultores` (sem saber o id do usuário Supabase, que não é
-- consultável por e-mail sem service role) e o consultor, já logado, "clama"
-- o próprio registro comparando o e-mail do JWT — nunca uma busca cross-user
-- feita pelo admin.
create or replace function public.gold_reivindicar_consultor()
returns public.gold_consultores
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row public.gold_consultores;
begin
  if v_email = '' then
    raise exception 'sem_email';
  end if;
  update public.gold_consultores
    set usuario_id = auth.uid()
    where lower(email) = v_email and usuario_id is null
    returning * into v_row;
  if v_row.id is null then
    raise exception 'consultor_nao_encontrado';
  end if;
  return v_row;
end;
$$;
revoke all on function public.gold_reivindicar_consultor() from public, anon;
grant execute on function public.gold_reivindicar_consultor() to authenticated;

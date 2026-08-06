revoke all on function public.pode_ver_embarcacao(uuid) from public, anon;
grant execute on function public.pode_ver_embarcacao(uuid) to authenticated;

-- A capa precisa ser uma foto real DAQUELA embarcação: sem isso, um editor
-- de fotos podia gravar qualquer string e quebrar o hero silenciosamente.
create or replace function public.definir_capa(p_embarcacao_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.permissao(p_embarcacao_id, 'fotos', 'editar') then
    raise exception 'sem permissão para alterar a capa';
  end if;
  if p_path is not null and not exists (
    select 1 from public.fotos
    where embarcacao_id = p_embarcacao_id and arquivo_path = p_path
  ) then
    raise exception 'foto não pertence a esta embarcação';
  end if;
  update public.embarcacoes set foto_capa_path = p_path where id = p_embarcacao_id;
end $$;
revoke all on function public.definir_capa(uuid, text) from public, anon;
grant execute on function public.definir_capa(uuid, text) to authenticated;

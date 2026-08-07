-- A capa é atributo do álbum, não dado cadastral: quem pode editar fotos
-- pode definir a capa. Sem isso, a policy de embarcacoes (eh_prop) fazia a
-- escrita virar no-op silencioso para o comandante.
create or replace function public.definir_capa(p_embarcacao_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.permissao(p_embarcacao_id, 'fotos', 'editar') then
    raise exception 'sem permissão para alterar a capa';
  end if;
  update public.embarcacoes set foto_capa_path = p_path where id = p_embarcacao_id;
end $$;
revoke all on function public.definir_capa(uuid, text) from public, anon;
grant execute on function public.definir_capa(uuid, text) to authenticated;

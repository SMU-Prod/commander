create or replace function public.bloquear_selo_verificado()
returns trigger language plpgsql set search_path = public as $$
begin
  -- so o service role concede o selo; usuario comum nunca escreve verificado
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verificado := false;
    elsif new.verificado is distinct from old.verificado then
      new.verificado := old.verificado;
    end if;
  end if;
  return new;
end $$;

create trigger perfis_selo_protegido
before insert or update on public.perfis_comandante
for each row execute function public.bloquear_selo_verificado();

drop policy "acervo: gravar com vinculo" on storage.objects;
create policy "acervo: gravar pela matriz" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'editar'))
      or ((storage.foldername(name))[2] <> 'documentos'
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );

drop policy "acervo: apagar com vinculo" on storage.objects;
create policy "acervo: apagar pela matriz" on storage.objects for delete to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'editar'))
      or ((storage.foldername(name))[2] <> 'documentos'
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );

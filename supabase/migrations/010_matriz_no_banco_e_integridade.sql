-- =====================================================================
-- Onda 0 · Fecha o bypass de autorização e a corrida do convite,
-- indexa as FKs consultadas e reduz custo de RLS por linha.
-- =====================================================================

-- 1) Helper: qual aba da matriz governa um alvo (equipamento ou categoria)
create or replace function public.aba_do_equipamento(p_tipo text)
returns text language sql immutable set search_path = public as $$
  select case when p_tipo = 'motor' then 'motores' else 'eletrica' end;
$$;

create or replace function public.aba_alvo(p_equipamento_id uuid, p_categoria text)
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select public.aba_do_equipamento(e.tipo) from public.equipamentos e where e.id = p_equipamento_id),
    case
      when p_categoria = 'documento' then 'documentos'
      when p_categoria in ('deck','fibra','inox','vidros','estofados','casco_outros') then 'casco'
      else 'embarcacao'
    end
  );
$$;
revoke all on function public.aba_do_equipamento(text) from public, anon;
revoke all on function public.aba_alvo(uuid, text) from public, anon;
grant execute on function public.aba_do_equipamento(text) to authenticated;
grant execute on function public.aba_alvo(uuid, text) to authenticated;

-- 2) EQUIPAMENTOS pela matriz (motores / eletrica)
drop policy "equipamentos: tudo com vinculo" on public.equipamentos;
create policy "equipamentos: ver pela matriz" on public.equipamentos for select
  using (public.permissao(embarcacao_id, public.aba_do_equipamento(tipo), 'ver'));
create policy "equipamentos: criar pela matriz" on public.equipamentos for insert
  with check (public.permissao(embarcacao_id, public.aba_do_equipamento(tipo), 'editar'));
create policy "equipamentos: atualizar pela matriz" on public.equipamentos for update
  using (public.permissao(embarcacao_id, public.aba_do_equipamento(tipo), 'editar'))
  with check (public.permissao(embarcacao_id, public.aba_do_equipamento(tipo), 'editar'));
create policy "equipamentos: excluir pela matriz" on public.equipamentos for delete
  using (public.permissao(embarcacao_id, public.aba_do_equipamento(tipo), 'editar'));

-- 3) ITENS MONITORADOS pela matriz (aba do alvo)
drop policy "itens: tudo com vinculo" on public.itens_monitorados;
create policy "itens: ver pela matriz" on public.itens_monitorados for select
  using (public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'ver'));
create policy "itens: criar pela matriz" on public.itens_monitorados for insert
  with check (public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar'));
create policy "itens: atualizar pela matriz" on public.itens_monitorados for update
  using (public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar'))
  with check (public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar'));
create policy "itens: excluir pela matriz" on public.itens_monitorados for delete
  using (public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar'));

-- 4) EVENTOS: diário OU aba do sistema (o diário é transversal por desenho)
drop policy "eventos: tudo com vinculo" on public.eventos;
create policy "eventos: ver pela matriz" on public.eventos for select
  using (
    public.permissao(embarcacao_id, 'diario', 'ver')
    or public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'ver')
  );
create policy "eventos: criar pela matriz" on public.eventos for insert
  with check (
    public.permissao(embarcacao_id, 'diario', 'editar')
    or public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar')
  );
create policy "eventos: atualizar pela matriz" on public.eventos for update
  using (
    public.permissao(embarcacao_id, 'diario', 'editar')
    or public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar')
  )
  with check (
    public.permissao(embarcacao_id, 'diario', 'editar')
    or public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar')
  );
create policy "eventos: excluir pela matriz" on public.eventos for delete
  using (
    public.permissao(embarcacao_id, 'diario', 'editar')
    or public.permissao(embarcacao_id, public.aba_alvo(equipamento_id, categoria), 'editar')
  );

-- 5) Convite: consumo atômico (update-first). Rollback desfaz se já for tripulante.
create or replace function public.aceitar_convite(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_emb uuid; v_nivel text; v_perm jsonb;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  update public.convites
     set usado_por = auth.uid(), usado_em = now()
   where codigo = p_codigo and usado_em is null and expira_em > now()
   returning embarcacao_id, nivel, permissoes into v_emb, v_nivel, v_perm;
  if v_emb is null then
    raise exception 'convite inválido ou expirado';
  end if;
  if exists (
    select 1 from public.vinculos where embarcacao_id = v_emb and usuario_id = auth.uid()
  ) then
    raise exception 'você já faz parte desta tripulação';
  end if;
  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel, permissoes)
    values (auth.uid(), v_emb, 'CMDT', v_nivel, v_perm);
  return v_emb;
end $$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;

-- 6) Índices das FKs realmente filtradas nas telas quentes
create index if not exists idx_eventos_embarcacao on public.eventos (embarcacao_id, data desc);
create index if not exists idx_eventos_equipamento on public.eventos (equipamento_id);
create index if not exists idx_eventos_item on public.eventos (item_monitorado_id);
create index if not exists idx_eventos_contato on public.eventos (contato_id);
create index if not exists idx_itens_embarcacao on public.itens_monitorados (embarcacao_id);
create index if not exists idx_itens_equipamento on public.itens_monitorados (equipamento_id);
create index if not exists idx_equipamentos_embarcacao on public.equipamentos (embarcacao_id);
create index if not exists idx_documentos_embarcacao on public.documentos (embarcacao_id);
create index if not exists idx_documentos_item on public.documentos (item_monitorado_id);
create index if not exists idx_contatos_embarcacao on public.contatos (embarcacao_id);
create index if not exists idx_vinculos_embarcacao on public.vinculos (embarcacao_id);
create index if not exists idx_vinculos_usuario on public.vinculos (usuario_id);
create index if not exists idx_alertas_embarcacao on public.alertas_enviados (embarcacao_id);
create index if not exists idx_alertas_item on public.alertas_enviados (item_monitorado_id);
create index if not exists idx_convites_embarcacao on public.convites (embarcacao_id);
create index if not exists idx_push_usuario on public.push_assinaturas (usuario_id);

-- 7) Superfície RPC: trigger não deve ser chamável
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 8) auth.uid() reavaliado por linha -> initplan
drop policy "perfil: proprio ou tripulacao" on public.profiles;
create policy "perfil: proprio ou tripulacao" on public.profiles for select
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.vinculos v1
      join public.vinculos v2 on v1.embarcacao_id = v2.embarcacao_id
      where v1.usuario_id = (select auth.uid()) and v2.usuario_id = profiles.id
    )
  );
drop policy "proprio perfil: editar" on public.profiles;
create policy "proprio perfil: editar" on public.profiles for update
  using (id = (select auth.uid()));

drop policy "vinculos: ver os da embarcacao" on public.vinculos;
create policy "vinculos: ver os da embarcacao" on public.vinculos for select
  using (usuario_id = (select auth.uid()) or public.pode_ver_embarcacao(embarcacao_id));

drop policy "push: proprias" on public.push_assinaturas;
create policy "push: proprias" on public.push_assinaturas for all
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy "perfis: vitrine" on public.perfis_comandante;
create policy "perfis: vitrine" on public.perfis_comandante for select
  using (visivel = true or usuario_id = (select auth.uid()));
drop policy "perfis: proprio insert" on public.perfis_comandante;
create policy "perfis: proprio insert" on public.perfis_comandante for insert
  with check (usuario_id = (select auth.uid()));
drop policy "perfis: proprio update" on public.perfis_comandante;
create policy "perfis: proprio update" on public.perfis_comandante for update
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

alter table public.push_assinaturas drop constraint push_assinaturas_endpoint_key;
alter table public.push_assinaturas add constraint push_assinaturas_usuario_endpoint_key unique (usuario_id, endpoint);

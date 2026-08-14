-- 038: nome autodeclarado em oportunidades/respostas_oportunidade (migration
-- 037). `public.profiles` tem RLS restrita a "proprio ou tripulacao"
-- (migration 008, policy "perfil: proprio ou tripulacao") — quem publica uma
-- oportunidade e quem responde quase nunca sao tripulantes um do outro, entao
-- um JOIN em profiles pra mostrar o nome de quem publicou/respondeu voltaria
-- SEM a linha (RLS bloqueando silenciosamente), nao com erro. Em vez de abrir
-- profiles pra qualquer autenticado (mudaria a superficie de privacidade do
-- app inteiro, fora do escopo desta onda), cada nome fica autodeclarado no
-- momento do post/resposta — mesmo espirito de "nome_publico" em
-- perfis_comandante, que ja e o padrao do app pra nome exibido a estranhos.

alter table public.oportunidades add column autor_nome text not null default '';
alter table public.respostas_oportunidade add column nome text not null default '';

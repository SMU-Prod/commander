-- =====================================================================
-- Onda 50 · CAPTAIN E CARREIRA PROFISSIONAL
-- PRD FINAL `docs/prd/upgrade2-master-final.txt` §12 inteiro, com §2
-- (Captain Free x Captain Pro), §11.3 (disponibilidade) e §14 (avaliações).
--
-- ---------------------------------------------------------------------
-- AS DUAS COISAS QUE O §12 SEPARA — E QUE ESTA MIGRATION PRECISA MANTER
-- SEPARADAS NO BANCO, NÃO SÓ NA TELA
-- ---------------------------------------------------------------------
--   1. ACESSO À EMBARCAÇÃO. Vem do CONVITE do proprietário e da matriz de
--      permissões dele (`vinculos.permissoes`). "Captain Free pode operar a
--      embarcação conforme permissões do proprietário; isso NÃO DEPENDE de
--      Captain Pro." Um comandante contratado nunca fica sem trabalhar por
--      não assinar nada.
--   2. CARREIRA PROFISSIONAL. Vem da ASSINATURA da própria pessoa. "Captain
--      Pro R$24,90 desbloqueia camada profissional: perfil ativo, Explorar
--      completo, Marketplace, candidaturas, disponibilidade, avaliações e
--      histórico de trabalhos."
--
-- E a frase que amarra as duas: "Captain Pro NUNCA concede acesso adicional
-- à embarcação por si só."
--
-- Por isso esta migration NÃO TOCA em `vinculos`, `embarcacoes`, `eventos`,
-- `equipamentos`, `itens_monitorados`, `fotos`, `documentos`, `contatos`,
-- `ocorrencias`, `viagens` nem em `permissao()`/`eh_prop()`. A ausência é a
-- garantia — e, pra ela não depender de boa memória, o item 7 no fim do
-- arquivo TRANSFORMA ESSA AUSÊNCIA EM ASSERÇÃO EXECUTÁVEL: se alguém um dia
-- escrever uma policy de embarcação que consulta plano, a migration falha.
--
-- ---------------------------------------------------------------------
-- O QUE ESTA MIGRATION *NÃO* FAZ, DE PROPÓSITO
-- ---------------------------------------------------------------------
--   · não cria contador de trabalhos. §12 pede "trabalhos confirmados" e a
--     migration 046/050 já guarda o fato (negócio + confirmação bilateral);
--     um contador paralelo divergiria do histórico na primeira correção;
--   · não cria tabela de perfil nova. `perfis_comandante` (008/037) já é o
--     perfil profissional — ganha as colunas do §12 e nada mais;
--   · não mexe no fluxo de convite. `aceitar_convite` (010/048) já vincula a
--     conta EXISTENTE de quem aceita (`auth.uid()`), sem criar usuário
--     nenhum: "Se já existir conta, apenas vincular embarcação; não duplicar
--     usuário" já é o comportamento, e reescrever a função só pra dizer isso
--     de novo é a receita de perder trabalho de outra onda (ver o aviso na
--     migration 048 sobre `gold_definir_estado`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Foto do perfil profissional (§12, "Perfil profissional: foto, ...")
-- ---------------------------------------------------------------------
-- Bucket próprio e público, no mesmo formato do `parceiros` (migration 020):
-- leitura aberta porque foto de perfil profissional É a vitrine, escrita só
-- na pasta `<usuario_id>/`. Bucket separado do `parceiros` de propósito —
-- são vitrines diferentes (pessoa x estabelecimento) e uma limpeza futura de
-- uma não pode levar a outra junto.
insert into storage.buckets (id, name, public) values ('perfis', 'perfis', true)
  on conflict (id) do nothing;

drop policy if exists "perfis: subir na propria pasta" on storage.objects;
create policy "perfis: subir na propria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'perfis' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "perfis: apagar da propria pasta" on storage.objects;
create policy "perfis: apagar da propria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'perfis' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- 2) As colunas do perfil profissional do §12
-- ---------------------------------------------------------------------
-- "Perfil profissional: foto, função, região, experiência, certificações,
--  embarcações/portes, disponibilidade, avaliações e trabalhos confirmados."
--
-- Função e região são `taxonomia` (migration 046), NÃO texto livre — §11.2
-- e §21.2 já mandam isso pro Marketplace, e um comandante que se cadastra
-- como "comandante" enquanto a demanda pede "Comandante" nunca casaria no
-- matching. Disponibilidade estruturada continua em `disponibilidades`
-- (§11.3); avaliações em `avaliacoes` (§14); trabalhos em `negocios` (§11.6).
-- Nenhuma delas vira coluna aqui: o perfil LÊ essas três, não as copia.
--
-- As colunas antigas `categoria`, `cidade` e `disponibilidade` (texto livre,
-- onda 39) NÃO são apagadas — §23: "preservando dados e histórico". Elas
-- continuam aparecendo enquanto os campos novos estiverem vazios, e o
-- formulário novo escreve nos dois eixos: nome padronizado no id, texto
-- antigo intocado.
alter table public.perfis_comandante
  add column if not exists foto_path text,
  add column if not exists funcao_id uuid references public.taxonomia(id) on delete set null,
  add column if not exists regiao_id uuid references public.taxonomia(id) on delete set null,
  add column if not exists experiencia_anos int
    check (experiencia_anos is null or (experiencia_anos >= 0 and experiencia_anos <= 80)),
  add column if not exists porte_max_pes int
    check (porte_max_pes is null or (porte_max_pes > 0 and porte_max_pes <= 400)),
  add column if not exists certificacoes text,
  add column if not exists atualizado_em timestamptz not null default now();

-- Índice da vitrine: o filtro real é "quem atende ESTA região nesta função".
create index if not exists perfis_comandante_regiao_funcao_idx
  on public.perfis_comandante (tipo, regiao_id, funcao_id) where visivel;

create or replace function public.perfil_comandante_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
revoke execute on function public.perfil_comandante_carimbo() from public, anon, authenticated;

drop trigger if exists perfis_comandante_carimbo on public.perfis_comandante;
create trigger perfis_comandante_carimbo before update on public.perfis_comandante
  for each row execute function public.perfil_comandante_carimbo();

-- ---------------------------------------------------------------------
-- 3) Qual plano ATIVA o perfil de cada tipo
-- ---------------------------------------------------------------------
-- §12: Captain Pro desbloqueia "perfil ativo" para o comandante.
-- §13.1: Prestador de Serviço R$24,90 tem "Perfil ativo" pela mesma lógica.
-- Os dois tipos moram na MESMA tabela desde a migration 037, então o mapa
-- tipo -> plano fica num lugar só: mudar a regra de um dos dois é editar um
-- `case`, não caçar policy espalhada.
--
-- O espelho desta função em TypeScript é `PLANO_QUE_ATIVA_PERFIL` em
-- `web/lib/domain/captain.ts`, com teste. Duas cópias porque as duas
-- precisam responder: a tela pra explicar, o banco pra garantir.
create or replace function public.plano_que_ativa_perfil(p_tipo text)
returns text language sql immutable set search_path = public as $$
  select case p_tipo when 'prestador' then 'partner_prestador' else 'captain_pro' end;
$$;

-- "Eu sou Captain Pro?" — sobre MIM, nunca sobre terceiro. Por isso não
-- recebe uuid: `plano_do_usuario(uuid)` continua fechada (migration 048,
-- revoke de `authenticated`) justamente porque um uuid arbitrário deixaria
-- qualquer assinante perguntar o plano de outra pessoa. Esta aqui responde
-- só sobre quem chama, então pode ser usada em policy.
create or replace function public.eh_captain_pro()
returns boolean language sql security definer stable set search_path = public as $$
  select public.plano_do_usuario((select auth.uid())) = 'captain_pro';
$$;
revoke all on function public.eh_captain_pro() from public, anon;
grant execute on function public.eh_captain_pro() to authenticated;

-- "O perfil profissional DESTA pessoa está no ar?" — a pergunta que a vitrine
-- faz. Repare que ela só devolve `true` quando existe perfil visível E o
-- plano bate: passar um uuid qualquer não revela plano de ninguém que não
-- tenha perfil profissional, e pra quem tem, a resposta é exatamente o que a
-- vitrine mostraria de qualquer jeito. É o mínimo de exposição que ainda
-- responde a pergunta.
create or replace function public.perfil_profissional_ativo(p_usuario uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.perfis_comandante p
    where p.usuario_id = p_usuario
      and p.visivel
      and public.plano_do_usuario(p.usuario_id) = public.plano_que_ativa_perfil(p.tipo)
  );
$$;
revoke all on function public.perfil_profissional_ativo(uuid) from public, anon;
grant execute on function public.perfil_profissional_ativo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4) A vitrine passa a exigir o plano — o paywall do §12 na RLS
-- ---------------------------------------------------------------------
-- Antes (008/010): `visivel = true or usuario_id = auth.uid()`. Ou seja, o
-- perfil profissional estava no ar de graça, e "perfil ativo" não significava
-- nada. Agora o marcador `visivel` continua sendo a VONTADE da pessoa
-- (quero/não quero aparecer) e o plano é a CONDIÇÃO — as duas precisam ser
-- verdade.
--
-- O dono continua vendo o PRÓPRIO perfil sempre, mesmo sem plano: §1.1 quer
-- o gratuito como "demonstração interativa", então preencher o perfil inteiro
-- e ver como ele fica é grátis; o que custa é aparecer para os outros. A tela
-- (`/comandantes/perfil`) diz isso em voz alta em vez de deixar a pessoa
-- achar que salvou errado.
--
-- Admin enxerga tudo (§21.1) — sem isso, o suporte não consegue ajudar quem
-- liga dizendo "meu perfil sumiu".
drop policy if exists "perfis: vitrine" on public.perfis_comandante;
create policy "perfis: vitrine" on public.perfis_comandante
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or public.eh_admin()
    or (visivel and public.perfil_profissional_ativo(usuario_id))
  );

-- INSERT/UPDATE continuam livres pro dono do perfil (policies de 008/010,
-- intocadas): Captain Free PREENCHE o perfil inteiro. O portão é só de
-- vitrine. Bloquear a escrita transformaria o paywall em "não pode nem se
-- preparar", que é o oposto do §1.1.

-- ---------------------------------------------------------------------
-- 5) §11.3 na RLS — só Captain Pro publica disponibilidade
-- ---------------------------------------------------------------------
-- "Somente Captain Pro pode publicar disponibilidade profissional
-- estruturada." Até aqui isso vivia SÓ na action (`publicarDisponibilidade`,
-- onda 47) e a policy aceitava qualquer autor logado — ou seja, um POST
-- direto no PostgREST publicava de graça. Regra de acesso a dado mora na RLS.
--
-- Só o INSERT ganha o portão. UPDATE (encerrar) e DELETE continuam abertos
-- pro autor de propósito: quem deixou de pagar precisa continuar podendo
-- TIRAR do ar o que publicou. Prender o anúncio de alguém porque a assinatura
-- caiu seria punir com dado que é dele.
drop policy if exists "disponibilidades: publica a própria" on public.disponibilidades;
create policy "disponibilidades: publica a própria" on public.disponibilidades
  for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.eh_captain_pro());

-- ---------------------------------------------------------------------
-- 6) Trabalhos confirmados (§12) — lidos de `negocios`, não contados à parte
-- ---------------------------------------------------------------------
-- §12 põe "trabalhos confirmados" no perfil, e §11.6 já define o que conta:
-- negócio cujo fechamento foi declarado pelos DOIS lados. A fonte é
-- `negocios` + `negocios_confirmacoes` (migration 046) e a régua é a mesma de
-- `negocio_confirmado()` (migration 050) — nenhum número novo é guardado.
--
-- Precisa ser `security definer` porque `negocios` só é legível pelas duas
-- partes (e admin, §21.1) — e está certo assim: quem visita um perfil não
-- pode ler COM QUEM a pessoa trabalhou, quanto cobrou nem o que foi
-- negociado. Esta função devolve UM INTEIRO e nada mais. É a menor janela que
-- ainda responde "esse profissional já fechou trabalho aqui dentro?".
--
-- Só conta o lado FORNECEDOR: trabalho confirmado é o que a pessoa PRESTOU.
-- Quem contratou dez serviços não tem dez trabalhos no currículo.
create or replace function public.trabalhos_confirmados(p_usuario uuid)
returns int language sql security definer stable set search_path = public as $$
  select count(*)::int
  from public.negocios n
  where n.fornecedor_id = p_usuario
    and exists (
      select 1 from public.negocios_confirmacoes c
      where c.negocio_id = n.id and c.decisao = 'realizado'
    )
    and exists (
      select 1 from public.negocios_confirmacoes c
      where c.negocio_id = n.id and c.decisao = 'confirmado'
    )
    and not exists (
      select 1 from public.negocios_confirmacoes c
      where c.negocio_id = n.id and c.decisao = 'negado'
    );
$$;
revoke all on function public.trabalhos_confirmados(uuid) from public, anon;
grant execute on function public.trabalhos_confirmados(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7) A TRAVA DO §12, EXECUTÁVEL
-- ---------------------------------------------------------------------
-- "Captain Pro nunca concede acesso adicional à embarcação por si só."
--
-- Um comentário dizendo isso envelhece; esta asserção não. Ela varre as
-- policies das tabelas que guardam a EMBARCAÇÃO e falha se alguma delas
-- passar a consultar plano/assinatura. Se um dia alguém tentar transformar
-- assinatura em acesso a barco — de boa fé, achando que "Pro vê mais" — a
-- migration não sobe e a pessoa lê o porquê aqui.
--
-- A lista de tabelas é a superfície completa de dado de embarcação hoje. Ela
-- é escrita à mão de propósito: uma tabela nova que precise entrar aqui é
-- uma decisão consciente de quem a criou, não um efeito colateral de um
-- `like 'emb%'`.
do $$
declare v_ruim text;
begin
  select string_agg(format('%s -> %s', tablename, policyname), ', ')
    into v_ruim
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'embarcacoes', 'vinculos', 'equipamentos', 'equipamento_sistemas',
      'itens_monitorados', 'eventos', 'fotos', 'documentos', 'contatos',
      'ocorrencias', 'ocorrencias_transicoes', 'viagens', 'sondagens',
      'agenda_eventos', 'agenda_participantes', 'lancamentos_financeiros',
      'recorrencias_financeiras', 'carteiras', 'carteira_movimentos',
      'verified_estado', 'convites'
    )
    and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
        ~ '(captain_pro|partner_|eh_captain_pro|plano_do_usuario|perfil_profissional_ativo)';
  if v_ruim is not null then
    raise exception
      'PRD 12: plano de carreira nao pode conceder acesso a embarcacao. Policies em falta: %', v_ruim;
  end if;
end $$;

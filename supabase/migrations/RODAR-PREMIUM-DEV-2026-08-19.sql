-- ===========================================================================
-- ACESSO PREMIUM PARA A CONTA DO DONO/DEV — 19/08/2026
--
-- Cole no SQL Editor do Supabase e rode. Roda em transacao: se falhar, nada
-- e aplicado. A ultima consulta imprime a conferencia sozinha.
--
-- POR QUE POR AQUI, E NAO POR UMA ASSINATURA FALSA
-- ------------------------------------------------
-- O jeito ERRADO seria inserir uma linha em `assinaturas` com status 'ativa'.
-- Ela apareceria na tela de assinatura como cobranca real, pediria um id de
-- assinatura do Asaas que nao existe, e no dia em que a cobranca for ligada
-- essa linha viraria lixo indistinguivel de um assinante de verdade — alem de
-- envenenar qualquer contagem de receita.
--
-- `premium_concessoes` e a porta certa e ela JA EXISTE no produto: e por ela
-- que passam cortesia, Gold e migracao de concorrente. A funcao
-- `plano_do_usuario()` le assinatura viva PRIMEIRO e concessao vigente DEPOIS,
-- caindo em 'proprietario_free' se nao houver nenhuma — entao a concessao
-- libera o acesso sem nunca se disfarcar de pagamento.
--
-- `origem = 'cortesia'` deixa isso legivel pra quem abrir o banco em 2027.
--
-- VALIDADE, E POR QUE NAO E "PARA SEMPRE"
-- ---------------------------------------
-- 5 anos. Concessao sem prazo vira acesso fantasma que ninguem lembra de
-- revisar — o mesmo vicio das excecoes de teste que a onda 88 apagou. Cinco
-- anos e mais que suficiente pra desenvolvimento e ainda assim tem data.
-- Pra renovar, rode de novo: o `on conflict` abaixo so estende a validade.
--
-- PLANO CONCEDIDO: `commander_pro`, o teto do lado do proprietario (multiplas
-- embarcacoes + tudo que o `commander` abre). Nao existe plano acima dele pro
-- dono de barco; os `partner_*` sao de estabelecimento e os `captain_*` de
-- comandante — dar um deles nao somaria nada e confundiria a leitura.
-- ===========================================================================

begin;

-- Indice unico pra este script poder ser rodado de novo sem duplicar a
-- concessao. Idempotente: se ja existir, nada acontece.
create unique index if not exists premium_concessoes_cortesia_por_usuario_idx
  on public.premium_concessoes (usuario_id)
  where origem = 'cortesia';

insert into public.premium_concessoes (usuario_id, origem, plano_concedido, valido_ate)
select u.id, 'cortesia', 'commander_pro', (current_date + interval '5 years')::date
  from auth.users u
 where lower(u.email) = 'erickrussomat@gmail.com'
on conflict (usuario_id) where origem = 'cortesia'
do update set plano_concedido = excluded.plano_concedido,
              valido_ate      = excluded.valido_ate;

commit;

-- ===========================================================================
-- CONFERENCIA — o esperado esta em cada linha.
-- ===========================================================================
select 'plano vigente da conta (esperado commander_pro)' as conferencia,
       public.plano_do_usuario(u.id) as resultado
  from auth.users u
 where lower(u.email) = 'erickrussomat@gmail.com'
union all
select 'concessoes vigentes desta conta (esperado 1)',
       count(*)::text
  from public.premium_concessoes c
  join auth.users u on u.id = c.usuario_id
 where lower(u.email) = 'erickrussomat@gmail.com'
   and c.valido_ate >= current_date
union all
select 'assinaturas criadas por este script (esperado 0)',
       count(*)::text
  from public.assinaturas a
  join auth.users u on u.id = a.usuario_id
 where lower(u.email) = 'erickrussomat@gmail.com';

-- Onda 35 · Fecha os avisos do advisor de segurança deixados pela 033: quatro
-- funções SECURITY DEFINER do Gold nasceram sem `revoke ... from public,
-- anon` (mesmo lapso que a 002 já corrigiu pro helper mais antigo) e
-- `gold_transicao_valida` sem `search_path` fixo.
revoke all on function public.gold_visivel(uuid) from public, anon;
grant execute on function public.gold_visivel(uuid) to authenticated;

revoke all on function public.gold_consultor_atribuido(uuid) from public, anon;
grant execute on function public.gold_consultor_atribuido(uuid) to authenticated;

revoke all on function public.gold_visivel_avaliacao(uuid) from public, anon;
grant execute on function public.gold_visivel_avaliacao(uuid) to authenticated;

revoke all on function public.gold_consultor_atribuido_avaliacao(uuid) from public, anon;
grant execute on function public.gold_consultor_atribuido_avaliacao(uuid) to authenticated;

create or replace function public.gold_transicao_valida(p_atual text, p_novo text)
returns boolean language sql immutable set search_path = public as $$
  select case p_atual
    when 'solicitado'              then p_novo in ('aguardando_pagamento','cancelado')
    when 'aguardando_pagamento'    then p_novo in ('pago','cancelado')
    when 'pago'                    then p_novo in ('aguardando_agendamento','cancelado')
    when 'aguardando_agendamento'  then p_novo in ('agendado','cancelado')
    when 'agendado'                then p_novo in ('avaliacao_realizada','cancelado')
    when 'avaliacao_realizada'     then p_novo in ('em_analise')
    when 'em_analise'              then p_novo in ('aprovado','reprovado')
    else false
  end;
$$;

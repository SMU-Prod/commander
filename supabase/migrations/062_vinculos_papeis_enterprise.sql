-- =====================================================================
-- Onda 69b · O BURACO QUE A ONDA 69 ABRIU E SÓ A TELA MOSTROU.
--
-- A migration 059 estendeu `vinculos.papel` de dois valores (PROP, CMDT)
-- pra sete, somando os cinco papéis Enterprise do §3. O `check` da coluna
-- foi atualizado. As POLICIES não foram — e elas estavam cravadas em
-- 'CMDT' desde a migration 008:
--
--   UPDATE: eh_prop(embarcacao_id) AND papel = 'CMDT'
--   DELETE: eh_prop(embarcacao_id) AND papel = 'CMDT'
--
-- Resultado: um vínculo ADM, Operações, Mecânica ou Cotista podia ser
-- CRIADO mas nunca mais alterado nem removido por ninguém pelo app. O
-- proprietário não conseguia suspender um cotista inadimplente (§13) nem
-- tirar do barco um funcionário demitido. O acesso entrava e não saía.
--
-- Nenhum teste pegou isso, e não pegaria: o domínio estava certo, a
-- migration 061 estava certa, e a policy que bloqueava mora numa migration
-- de 2026 que ninguém tinha motivo pra reler. Quem achou foi a PROVA
-- VISUAL da tela de cotistas — o botão "Suspender acesso" que não suspendia.
-- É o argumento pra não empilhar fundação sem tela, escrito em SQL.
--
-- ---------------------------------------------------------------------
-- A CORREÇÃO, E POR QUE `<> 'PROP'` E NÃO UMA LISTA
-- ---------------------------------------------------------------------
-- Trocar 'CMDT' por uma lista dos sete valores resolveria hoje e quebraria
-- de novo no próximo papel — foi exatamente assim que este bug nasceu.
-- `papel <> 'PROP'` diz a regra de verdade: o dono gerencia todo mundo que
-- não é dono, qualquer que seja o papel, inclusive papéis que ainda não
-- existem.
--
-- O que a regra PRESERVA: um PROP continua intocável por outro PROP. A
-- policy antiga também protegia isso (só que por acidente, ao listar
-- 'CMDT'); aqui a proteção é explícita e continua valendo.
-- =====================================================================

drop policy "vinculos: prop atualiza cmdt" on public.vinculos;
drop policy "vinculos: prop remove cmdt" on public.vinculos;

create policy "vinculos: prop atualiza quem nao e dono" on public.vinculos
  for update to authenticated
  using (public.eh_prop(embarcacao_id) and papel <> 'PROP')
  with check (public.eh_prop(embarcacao_id) and papel <> 'PROP');

create policy "vinculos: prop remove quem nao e dono" on public.vinculos
  for delete to authenticated
  using (public.eh_prop(embarcacao_id) and papel <> 'PROP');

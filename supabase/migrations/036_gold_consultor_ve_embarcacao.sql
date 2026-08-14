-- Onda 35 · Sem isso, o consultor atribuído a uma avaliação não conseguia
-- ler NEM O NOME da embarcação que vai visitar — `embarcacoes` só é visível
-- por quem tem vínculo (`pode_ver_embarcacao`, migration 001), e o consultor
-- não é tripulante. Adiciona uma segunda policy de select, sem tocar na
-- existente.
create policy "embarcacao: consultor atribuido em avaliacao gold" on public.embarcacoes for select
  using (
    exists (
      select 1 from public.gold_solicitacoes s
      where s.embarcacao_id = embarcacoes.id and public.gold_consultor_atribuido(s.id)
    )
  );

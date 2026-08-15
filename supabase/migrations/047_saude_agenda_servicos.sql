-- =====================================================================
-- Onda 46 · A AGENDA GANHA ÁREA PRÓPRIA NA MATRIZ DE PERMISSÕES
--           (PRD FINAL §8 · dívida assumida no topo da migration 044)
--
-- POR QUE ESTA MIGRATION EXISTE
-- A onda 43 entregou a Agenda (`agenda_eventos`, migration 044) com as seis
-- policies citando a área 'diario'. Aquilo foi declarado no próprio arquivo
-- como dívida: a matriz (`web/lib/domain/permissoes.ts`) estava sendo mexida
-- por outra frente na mesma janela e acrescentar área ali seria conflito
-- garantido. A consequência era real e não teórica: um vínculo personalizado
-- SEM 'diario' não enxergava a agenda do próprio barco, mesmo sendo a agenda
-- dele. E o PRD §8 pede uma permissão NOMEADA — "Gerenciar eventos da
-- embarcação" —, que aqui é o `editar` da área nova.
--
-- NINGUÉM PODE PERDER ACESSO QUE JÁ TINHA (CLAUDE.md, seção 2)
-- 'agenda' herda o valor de 'diario' em todo vínculo já gravado. É
-- exatamente o padrão da migration 032, quando 'historico' herdou de
-- 'diario' pelo mesmo motivo: até ontem a área velha ERA a porta da
-- funcionalidade, então copiar o valor mantém o mundo idêntico ao que era.
-- Herança é UMA VEZ, aqui: `normalizarPermissoes` no app continua devolvendo
-- {ver:false, editar:false} pra chave ausente, e quem for convidado a partir
-- de agora recebe 'agenda' explícita pelo formulário. PROP (permissoes is
-- null) não passa por aqui — já tem tudo por papel.
--
-- CONTEXTO DA JANELA: conferido no banco de produção em 15/08/2026 — 0
-- assinaturas, 0 admins, 2 usuários, 2 embarcações, 9 registros de Diário.
-- É a melhor janela possível pra trocar a área de uma policy.
--
-- O QUE ESTA MIGRATION **NÃO** FAZ
-- - Não cria tabela nem coluna: `vinculos.permissoes` é jsonb e
--   `public.permissao(emb, aba, modo)` (migration 008) lê o caminho jsonb
--   dinamicamente. Área nova não precisa de constraint nova.
-- - Não toca em nada da Saúde da Embarcação nem da aba Serviços, apesar do
--   nome do arquivo cobrir a onda inteira: as outras duas mudanças da onda 46
--   são 100% de aplicação (régua declarativa do PRD §5 em
--   `lib/domain/saude.ts` e remoção da rota `/servicos`). Nenhuma das duas
--   guarda estado no banco — a Saúde sempre foi calculada em tempo de leitura
--   e Serviços lia `perfis_comandante`, que continua igual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Herança de acesso: 'agenda' recebe o que 'diario' já tinha.
--    `coalesce(..., '{}')`: vínculo sem a chave 'diario' vira objeto vazio,
--    e `permissao()` devolve false por `coalesce(... , false)` — que é
--    exatamente o comportamento correto (não tinha, não passa a ter).
-- ---------------------------------------------------------------------
update public.vinculos
set permissoes = permissoes
  || jsonb_build_object('agenda', coalesce(permissoes -> 'diario', '{}'::jsonb))
where permissoes is not null;

-- ---------------------------------------------------------------------
-- 2) As 6 chamadas a `permissao(..., 'diario', ...)` da migration 044 viram
--    'agenda'. São 4 policies (o UPDATE conta duas vezes: `using` e
--    `with check`), todas em `agenda_eventos`. As 4 policies de
--    `agenda_participantes` NÃO são tocadas de propósito: elas não citam
--    área nenhuma (dependem só de `agenda_dono` /
--    `agenda_pode_compartilhar`), e recriar policy que não precisa mudar é
--    risco de digitação sem ganho.
--
--    Postgres não tem "alter policy ... using" que troque a expressão sem
--    reescrever, então é drop + create com a MESMA regra — só a área muda. A
--    justificativa de cada uma (por que o SELECT exige ser criador ou
--    participante, por que só o criador altera) continua no cabeçalho da
--    044; não é reescrita aqui pra não existirem duas versões da mesma
--    explicação.
--
--    ⚠ ACHADO DE 15/08/2026 — NOME DE POLICY PERDE ACENTO NO CAMINHO.
--    Ao aplicar isto no remoto, `pg_policies` mostrou que as policies da 044
--    NÃO existem lá com o nome que está no arquivo versionado: no banco elas
--    se chamam "agenda: so o criador exclui", "agenda: ver o que e meu ou foi
--    compartilhado comigo", "agenda: criar com permissao de gerenciar
--    eventos". O conector MCP que aplicou a 044 (em 4 chamadas, ver o
--    cabeçalho dela) transliterou os acentos. Uma delas ainda foi truncada
--    pelo limite de 63 bytes de identificador do Postgres ("...do meu
--    event"). As REGRAS estavam corretas; só os nomes divergiram — mas um
--    `drop policy "nome com acento"` falha com 42704 nesse banco.
--
--    Por isso, e pra nunca mais: (a) o drop é `if exists` nas DUAS grafias,
--    então roda tanto num banco criado do zero por este repositório quanto
--    no remoto de hoje; (b) os nomes recriados são ASCII puro, que
--    atravessa qualquer conector sem se transformar. É a única exceção
--    consciente ao português com acento do resto do projeto: nome de policy
--    é identificador, não texto de tela.
-- ---------------------------------------------------------------------

drop policy if exists "agenda: ver o que é meu ou foi compartilhado comigo" on public.agenda_eventos;
drop policy if exists "agenda: ver o que e meu ou foi compartilhado comigo" on public.agenda_eventos;
create policy "agenda: ver o que e meu ou foi compartilhado comigo"
  on public.agenda_eventos for select
  using (
    public.permissao(embarcacao_id, 'agenda', 'ver')
    and (criado_por = auth.uid() or public.agenda_participa(id))
  );

-- "Gerenciar eventos da embarcação" (PRD §8) = `editar` na área 'agenda'.
drop policy if exists "agenda: criar com permissão de gerenciar eventos" on public.agenda_eventos;
drop policy if exists "agenda: criar com permissao de gerenciar eventos" on public.agenda_eventos;
create policy "agenda: criar com permissao de gerenciar eventos"
  on public.agenda_eventos for insert
  with check (
    criado_por = auth.uid()
    and public.permissao(embarcacao_id, 'agenda', 'editar')
  );

drop policy if exists "agenda: só o criador altera" on public.agenda_eventos;
drop policy if exists "agenda: so o criador altera" on public.agenda_eventos;
create policy "agenda: so o criador altera"
  on public.agenda_eventos for update
  using (criado_por = auth.uid() and public.permissao(embarcacao_id, 'agenda', 'editar'))
  with check (criado_por = auth.uid() and public.permissao(embarcacao_id, 'agenda', 'editar'));

drop policy if exists "agenda: só o criador exclui" on public.agenda_eventos;
drop policy if exists "agenda: so o criador exclui" on public.agenda_eventos;
create policy "agenda: so o criador exclui"
  on public.agenda_eventos for delete
  using (criado_por = auth.uid() and public.permissao(embarcacao_id, 'agenda', 'editar'));

-- Fim. `agenda_participantes` continua exatamente como a 044 a deixou.

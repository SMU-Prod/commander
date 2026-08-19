# Auditoria de banco e RLS — Commander

**Data:** 19/08/2026
**Alvo:** projeto Supabase `khgjtxvmduizyooqaoox` (produção, `commander-tau.vercel.app`)
**Método:** leitura do banco VIVO (`pg_policies`, `pg_proc`, `pg_constraint`, `information_schema`), advisors de segurança e desempenho, e cruzamento com o código em `web/lib/`. Nenhum DDL, nenhuma escrita, nenhuma migration. Só `SELECT`.

> Os arquivos em `supabase/migrations/` não foram usados como fonte de verdade. O remoto tem **117 migrations aplicadas** (a mais nova é `cotista_envios_e_afazeres`, de hoje), mais do que se supunha. Tudo abaixo saiu da definição viva.

---

## Veredito

**O isolamento ENTRE CONTAS se sustenta.** Não existe tabela com RLS desligada, não existe tabela sem policy, e nenhuma policy libera dado de negócio com `USING (true)`. O motivo é estrutural e vale registrar: **`vinculos` não tem policy de INSERT nenhuma**. Ninguém cria o próprio vínculo — ele só nasce dentro de `criar_embarcacao()` e `aceitar_convite()`, que são `SECURITY DEFINER`. E como toda tabela de embarcação passa por `permissao()`, `pode_ver_embarcacao()` ou `eh_prop()`, e as três exigem uma linha em `vinculos` para o `auth.uid()` da vez, um usuário sem vínculo não enxerga nada de barco alheio. Os 67 `SECURITY DEFINER` têm `search_path` fixado, e o papel `authenticated` não tem `CREATE` no schema `public` — então não há o caminho clássico de escalada por sequestro de `search_path`. **O que NÃO se sustenta é a revogação DENTRO do barco:** suspender um cotista é hoje um carimbo cosmético — a pessoa suspensa continua lendo tudo o que lia antes. E cinco tabelas da onda mais nova (pátio/estoque/combustível/afazeres) saíram do padrão da matriz de permissão e usam `dono_id = auth.uid()`, o que abre buracos de escrita cruzada descritos no P1.

---

## Inventário

Números medidos, não estimados:

| Métrica | Valor |
|---|---|
| Tabelas em `public` (`relkind='r'`) | **82** |
| Tabelas com RLS **desligada** | **0** |
| Tabelas **sem nenhuma policy** | **0** |
| Total de policies | **218** |
| Policies com `USING`/`WITH CHECK` literal `true` | **6** (todas catálogo — ver abaixo) |
| Funções `SECURITY DEFINER` em `public` | **67** |
| ...**sem** `search_path` fixado | **0** |
| `authenticated` pode `CREATE` em `public`? | **Não** |

Nenhuma linha em vermelho no critério pedido: **não há tabela com RLS desligada nem tabela sem policy.** Este projeto corrigiu o vício histórico de nascer com `USING (true)` — as 6 ocorrências restantes são deliberadas e defensáveis.

### As 6 policies `true` — todas aceitáveis

| Tabela | Policy | Por que está certo |
|---|---|---|
| `taxonomia` | `taxonomia: todo mundo logado lê` | Catálogo de regiões/categorias/funções. Escrita é `eh_admin()`. |
| `motor_fabricantes` | `todo mundo logado le` | Catálogo de motor (onda 057). Escrita é `eh_admin()`. |
| `motor_familias` | `todo mundo logado le` | idem |
| `motor_modelos` | `todo mundo logado le` | idem |
| `motor_componentes` | `todo mundo logado le` | idem |
| `corredores` | `leitura publica autenticada` | Só `celula_id, lat, lon, passagens, ultima_passagem`. É malha agregada, sem `usuario_id` e sem `embarcacao_id` — não dá pra reidentificar barco. Escrita só via `registrar_passagens_corredor()`. |

### Inventário por tabela

Todas as 82 têm RLS ligada. Agrupei por número de policies; o veredito é sobre o desenho, não sobre o RLS estar ligado (está, em todas).

| Tabela | RLS | Nº policies | Veredito |
|---|---|---|---|
| `admin_logs` | ✅ | 1 | OK — leitura CEO/próprio; escrita só via `registrar_log_admin()` |
| `alertas_enviados` | ✅ | 1 | OK — leitura pela matriz da área; escrita só service_role |
| `assinatura_parametros` | ✅ | 1 | OK — tabela de preço, leitura para logado |
| `assinatura_promocoes` | ✅ | 1 | OK — só a própria |
| `convites` | ✅ | 1 | OK — `ALL` sob `eh_prop` |
| `corredores` | ✅ | 1 | OK — malha agregada (ver acima) |
| `publicidade_metricas` | ✅ | 1 | OK — dona da campanha ou comercial |
| `push_assinaturas` | ✅ | 1 | OK — só as próprias |
| `sondagens` | ✅ | 1 | ⚠️ **P1-3** — `ALL` com `USING` sem dono |
| `transferencias` | ✅ | 1 | OK — `ALL` sob `eh_prop` |
| `viagens` | ✅ | 1 | ⚠️ **P1-2** — `ALL` só com vínculo, sem matriz |
| `admin_papel_regioes`, `auditoria`, `avaliacoes_contestacoes`, `avaliacoes_respostas`, `connect_interesses`, `gold_*`, `motor_*`, `negocios`, `negocios_confirmacoes`, `ocorrencias_transicoes`, `parceiro_*`, `premium_concessoes`, `publicidade_produtos`, `taxonomia`, `votos` | ✅ | 2 | OK |
| `bases_operacionais`, `estoque_itens`, `estoque_movimentos`, `tanques`, `tanque_movimentos` | ✅ | 2 | ⚠️ **P1-4/P1-5** — escopo por `dono_id`, fora da matriz |
| `abastecimentos`, `admin_papeis`, `avaliacoes`, `avaliacoes_solucoes`, `carteiras`, `convites_cotista`, `envios_cotista`, `gold_agendamentos`, `gold_avaliacoes`, `gold_consultores`, `movimentos_patio`, `orcamentos`, `perfis_comandante`, `profiles`, `propostas`, `publicidade_campanhas`, `servicos_mecanica`, `taxonomia_solicitacoes`, `verified_estado`, `votacoes` | ✅ | 3 | OK |
| `afazeres` | ✅ | 4 | ⚠️ **P1-4** — sem matriz, `responsavel_id` livre |
| `agenda_eventos`, `agenda_participantes`, `assinaturas`, `contatos`, `demandas`, `demandas_contato`, `disponibilidades`, `documentos`, `embarcacoes`, `equipamento_sistemas`, `equipamentos`, `eventos`, `fotos`, `interesses_marketplace`, `itens_monitorados`, `lancamentos_financeiros`, `ocorrencias`, `parceiros`, `recorrencias_financeiras`, `vinculos` | ✅ | 4 | OK — matriz completa (ver/criar/editar/excluir) |
| `carteira_movimentos` | ✅ | 5 | OK |

---

## Achados

### P0 — vazamento entre contas

#### P0-1 · Suspender um cotista não tira o acesso dele

O produto promete o contrário. `lib/acoes/cotistas.ts:71` diz, citando o §13 do PRD: *"ADM pode marcar cotista como inadimplente e suspender o acesso"*. A action `alternarSuspensao()` grava `suspenso_em` e `suspenso_por`, audita o evento, e a UI anuncia "Acesso suspenso".

Só que **as três funções que decidem todo o acesso a dado de barco não olham `suspenso_em`**:

```sql
-- permissao(): decide ver/editar em ~25 tabelas
select 1 from public.vinculos v
where v.embarcacao_id = emb and v.usuario_id = auth.uid()
  and (v.papel = 'PROP' or coalesce((v.permissoes -> aba ->> modo)::boolean, false));
-- não há filtro de suspensão

-- pode_ver_embarcacao() e eh_prop(): idem, nenhuma menção a suspenso_em
```

**Prova (rodada, read-only):**
```sql
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('permissao','pode_ver_embarcacao','eh_prop')
      and pg_get_functiondef(p.oid) ilike '%suspenso%')            as helpers_que_checam,  -- => 0
  (select count(*) from pg_policies where schemaname='public'
      and (coalesce(qual,'')||coalesce(with_check,'')) ilike '%suspenso%') as policies_que_checam; -- => 2
```
Retornou `helpers_que_checam = 0` e `policies_que_checam = 2`. As duas únicas policies que respeitam a suspensão são `envios_cotista: cotista envia em nome proprio` e `votos: cotista vota uma vez, em nome proprio` — ou seja, o cotista suspenso **para de votar e de mandar envio, mas continua lendo**.

**O que um cotista suspenso consegue fazer hoje:** continua lendo o diário de bordo, os documentos, as fotos, os equipamentos, as ocorrências, as viagens, a auditoria e — se a matriz dele tiver `gastos.ver` — **o financeiro inteiro da embarcação**, indefinidamente, mesmo depois do dono clicar em "suspender acesso". O único jeito que funciona hoje é "remover acesso" (DELETE do vínculo), que é outro botão e tem outro significado de produto (libera a vaga de cota).

Hoje há 3 vínculos e 0 suspensos, então **não há dano consumado** — mas o botão está no ar e a primeira suspensão real vai falhar em silêncio.

**Correção sugerida (NÃO executada):**
```sql
create or replace function public.permissao(emb uuid, aba text, modo text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = (select auth.uid())
      and v.suspenso_em is null
      and (v.papel = 'PROP' or coalesce((v.permissoes -> aba ->> modo)::boolean, false))
  );
$$;

create or replace function public.pode_ver_embarcacao(emb uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = (select auth.uid())
      and v.suspenso_em is null
  );
$$;

create or replace function public.eh_prop(emb uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = (select auth.uid())
      and v.papel = 'PROP' and v.suspenso_em is null
  );
$$;
```
Duas coisas de brinde nesse mesmo patch: o `(select auth.uid())` resolve de quebra parte do `auth_rls_initplan` (P2-2), e **`eh_prop` merece uma decisão explícita do dono** — suspender um PROP é caso de borda (hoje `vinculos: prop atualiza quem nao e dono` impede suspender outro PROP, mas não impede um PROP suspender a si mesmo e se trancar para fora). Se a intenção for que PROP nunca seja suspensível, o certo é o `CHECK` abaixo em vez do filtro em `eh_prop`:
```sql
alter table public.vinculos
  add constraint vinculos_prop_nao_suspende
  check (papel <> 'PROP' or suspenso_em is null);
```

---

### P1 — integridade ou escalada de privilégio

#### P1-2 · `viagens`: qualquer vinculado apaga o histórico de navegação do barco

Policy única, `ALL`:
```sql
-- pg_policies: viagens / "viagens: tudo com vinculo"
USING      pode_ver_embarcacao(embarcacao_id)
WITH CHECK pode_ver_embarcacao(embarcacao_id)
```
`pode_ver_embarcacao()` só pergunta "existe vínculo?". Não pergunta papel nem matriz. Todo o resto do app decide escrita com `permissao(emb,'diario','editar')` — `viagens` não.

**Concretamente:** um COTISTA — o papel de menor privilégio, que por regra de produto nem cria tarefa — **consegue apagar todas as viagens da embarcação**, inclusive as trilhas de GPS importadas, e consegue editar quilometragem e horário de viagem alheia. Um CMDT com a matriz inteira em "só ver" consegue a mesma coisa.

**Prova:**
```sql
select policyname, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename='viagens';
-- 1 linha, cmd=ALL, qual=pode_ver_embarcacao(embarcacao_id)
```

**Correção sugerida (NÃO executada):**
```sql
drop policy "viagens: tudo com vinculo" on public.viagens;

create policy "viagens: ver pela matriz" on public.viagens
  for select to authenticated using (permissao(embarcacao_id, 'diario', 'ver'));
create policy "viagens: criar pela matriz" on public.viagens
  for insert to authenticated with check (permissao(embarcacao_id, 'diario', 'editar'));
create policy "viagens: atualizar pela matriz" on public.viagens
  for update to authenticated
  using (permissao(embarcacao_id, 'diario', 'editar'))
  with check (permissao(embarcacao_id, 'diario', 'editar'));
create policy "viagens: excluir pela matriz" on public.viagens
  for delete to authenticated using (permissao(embarcacao_id, 'diario', 'editar'));
```

#### P1-3 · `sondagens`: o `USING` não amarra o dono, só o `WITH CHECK`

```sql
-- pg_policies: sondagens / "sondagens: dono grava e le as suas"
USING      pode_ver_embarcacao(embarcacao_id)
WITH CHECK (pode_ver_embarcacao(embarcacao_id) AND (usuario_id = (select auth.uid())))
```
O `WITH CHECK` impede forjar sondagem no nome de outro. O `USING` não impede **apagar** nem **alterar** a de outro: em `UPDATE`/`DELETE` quem manda é o `USING`.

**Concretamente:** qualquer tripulante consegue apagar as sondagens de profundidade que um colega levantou no mesmo barco. Como sondagem alimenta a malha de `corredores`, é perda de dado de navegação sem rastro (a tabela não tem auditoria).

**Correção sugerida (NÃO executada):**
```sql
drop policy "sondagens: dono grava e le as suas" on public.sondagens;

create policy "sondagens: ve as do barco" on public.sondagens
  for select to authenticated using (pode_ver_embarcacao(embarcacao_id));
create policy "sondagens: grava a propria" on public.sondagens
  for insert to authenticated
  with check (pode_ver_embarcacao(embarcacao_id) and usuario_id = (select auth.uid()));
create policy "sondagens: corrige a propria" on public.sondagens
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "sondagens: apaga a propria" on public.sondagens
  for delete to authenticated using (usuario_id = (select auth.uid()));
```

#### P1-4 · `afazeres`: fora da matriz, e o `responsavel_id` é campo livre

`afazeres` (migration `cotista_envios_e_afazeres`, de hoje) tem `embarcacao_id` e mesmo assim **nenhuma das 4 policies chama `permissao()`**:
```sql
SELECT : (dono_id = auth.uid()) OR (responsavel_id = auth.uid())
INSERT : (dono_id = auth.uid())
UPDATE : (dono_id = auth.uid()) OR (responsavel_id = auth.uid())
DELETE : (dono_id = auth.uid())
```
O `INSERT` só exige que eu seja dono da tarefa que eu mesmo criei. Não exige que eu tenha vínculo com a `embarcacao_id` que eu declarar, nem que o `responsavel_id` seja alguém daquele barco.

**Concretamente, um usuário logado qualquer consegue:**
1. **Injetar tarefa na lista de um estranho** — `insert into afazeres (dono_id, responsavel_id, titulo) values (auth.uid(), '<uuid de qualquer pessoa>', 'texto arbitrário')`. A vítima passa a ler a linha (o `SELECT` casa por `responsavel_id`) e a tarefa aparece na tela dela. É canal de spam/phishing dentro do app.
2. **Carimbar tarefa contra barco alheio** — pôr `embarcacao_id` de uma embarcação com a qual não tem vínculo nenhum. Não vaza dado (ninguém do outro barco lê a linha), mas suja o FK e qualquer relatório futuro por embarcação.

O app não faz isso — `criarAfazer()` em `lib/acoes/enterprise.ts:389` nem envia `responsavel_id`. Mas a RLS é a fronteira, e PostgREST aceita o campo direto.

Nota de produto: como `SELECT` é só dono/responsável, **o PROP não enxerga as tarefas do próprio barco** criadas pela tripulação. Provavelmente não é o desejado.

**Correção sugerida (NÃO executada):**
```sql
drop policy "afazeres: o dono cria" on public.afazeres;
create policy "afazeres: o dono cria" on public.afazeres
  for insert to authenticated
  with check (
    dono_id = (select auth.uid())
    and (embarcacao_id is null or permissao(embarcacao_id, 'diario', 'editar'))
    and (responsavel_id is null or exists (
      select 1 from public.vinculos v
      where v.embarcacao_id = afazeres.embarcacao_id
        and v.usuario_id = afazeres.responsavel_id
        and v.suspenso_em is null
    ))
  );

-- e, se o dono da unidade deve enxergar as tarefas dela:
drop policy "afazeres: dono e responsavel leem" on public.afazeres;
create policy "afazeres: dono, responsavel e a unidade leem" on public.afazeres
  for select to authenticated
  using (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
    or (embarcacao_id is not null and eh_prop(embarcacao_id))
  );
```

#### P1-5 · Estoque, tanques e bases: escopo por `dono_id`, com FK solto para embarcação alheia

`bases_operacionais`, `estoque_itens`, `estoque_movimentos`, `tanques` e `tanque_movimentos` são escopadas por `dono_id = auth.uid()` (ou pelo dono do item/tanque pai). Não passam pela matriz.

Duas consequências, uma de produto e uma de integridade:

**(a) Produto:** o estoque e os tanques pertencem a uma *pessoa*, não à empresa. Ninguém mais da operação enxerga — nem o PROP da unidade, nem o mecânico. Se quem cadastrou sair da empresa, o estoque some do alcance de todo mundo (e `bases_operacionais_dono_id_fkey` é `ON DELETE CASCADE`: apagar o perfil **apaga a base inteira**, e os `estoque_itens.base_id`/`tanques.base_id` viram `NULL`). Para "papéis Enterprise", isso provavelmente não é o desenho pretendido.

**(b) Integridade:** `estoque_movimentos.embarcacao_id` e `tanque_movimentos.destino_embarcacao_id` **não são validados contra vínculo nenhum**:
```sql
-- estoque_movimentos, INSERT
WITH CHECK ((autor_id = auth.uid()) AND EXISTS (
  select 1 from estoque_itens i where i.id = item_id and i.dono_id = auth.uid()))
-- embarcacao_id: livre
```
Ou seja: o dono de um estoque **consegue lançar consumo de peça/combustível apontando para o barco de qualquer outra conta**. A linha não é lida pelo outro barco, então não é vazamento — é poluição de referência, e vira número errado assim que existir relatório de custo por embarcação (`lancamentos_financeiros.origem` já prevê `'estoque'` e `'combustivel'`).

**Correção sugerida (NÃO executada)** — amarrar o destino a quem o autor de fato acessa:
```sql
drop policy "estoque_mov: dono do item registra" on public.estoque_movimentos;
create policy "estoque_mov: dono do item registra" on public.estoque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.estoque_itens i
                where i.id = item_id and i.dono_id = (select auth.uid()))
    and (embarcacao_id is null or pode_ver_embarcacao(embarcacao_id))
  );

drop policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos;
create policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.tanques t
                where t.id = tanque_id and t.dono_id = (select auth.uid()))
    and (destino_embarcacao_id is null or pode_ver_embarcacao(destino_embarcacao_id))
  );

-- e trocar o CASCADE que apaga a base junto com o perfil:
alter table public.bases_operacionais
  drop constraint bases_operacionais_dono_id_fkey,
  add  constraint bases_operacionais_dono_id_fkey
       foreign key (dono_id) references public.profiles(id) on delete restrict;
```

#### P1-6 · O link de cotista não tem como ser resgatado

`convites_cotista` existe, tem RLS correta (`eh_prop` nas três operações), e `/cotistas` gera o link (`lib/acoes/cotistas.ts:62`). Mas **nada consome esse código**:

- não existe função `aceitar_convite_cotista` (varri `pg_proc` inteiro);
- `aceitar_convite()` existe, mas cria vínculo com `papel = 'CMDT'` **fixo no código** — nunca `COTISTA`;
- a rota `/convite/[codigo]` só chama `info_convite` e `info_transferencia`;
- `vinculos` não tem policy de INSERT, então o cliente não pode criar o vínculo por fora.

**Consequência:** hoje é impossível um COTISTA entrar pelo fluxo documentado. A vaga de cota (`embarcacoes.cotas_total`, migration 061) não tem como ser ocupada, e por tabela `envios_cotista`/`votos`/`convites_cotista` estão todas com 0 linhas — coerente com a funcionalidade nunca ter completado o ciclo.

Além disso, o código de cotista **não expira**: `convites_cotista` tem só `ativo boolean default true`, sem `expira_em` (`convites` e `transferencias` têm `now() + 7 days`). Um link vazado vale para sempre até alguém clicar em "redefinir link".

**Correção sugerida (NÃO executada)** — a função que falta, já com as travas de vaga e suspensão:
```sql
create or replace function public.aceitar_convite_cotista(p_codigo text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare c record; v_ocupadas int; v_total int;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select * into c from public.convites_cotista
    where codigo = p_codigo and ativo
      and (expira_em is null or expira_em > now()) for update;
  if not found then raise exception 'convite invalido ou expirado'; end if;

  if exists (select 1 from public.vinculos
             where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()) then
    raise exception 'voce ja faz parte desta tripulacao';
  end if;

  select cotas_total into v_total from public.embarcacoes where id = c.embarcacao_id;
  select count(*) into v_ocupadas from public.vinculos
    where embarcacao_id = c.embarcacao_id and papel = 'COTISTA';
  if v_ocupadas >= coalesce(v_total, 0) then raise exception 'sem_vaga_de_cota'; end if;

  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel)
    values (auth.uid(), c.embarcacao_id, 'COTISTA', 'operacional');
  return c.embarcacao_id;
end $$;

revoke all on function public.aceitar_convite_cotista(text) from public, anon;
grant execute on function public.aceitar_convite_cotista(text) to authenticated;

-- e dar prazo ao código, como nos outros convites:
alter table public.convites_cotista
  add column expira_em timestamptz;
```

#### P1-7 · A auditoria da unidade é legível por qualquer vinculado

```sql
-- auditoria, SELECT
USING EXISTS (select 1 from vinculos v
              where v.embarcacao_id = auditoria.embarcacao_id and v.usuario_id = auth.uid())
```
Sem matriz e sem papel. **Um COTISTA lê a trilha de auditoria inteira da unidade** — inclusive `bloqueou_cotista`/`desbloqueou_cotista` com autor e horário, ou seja, quem mandou bloquear quem. Para uma tabela cujo propósito é prestação de contas do ADM, o público certo é o dono/ADM, não todo mundo com vínculo.

Do lado bom: `auditoria` não tem policy de `UPDATE` nem de `DELETE` — é append-only de verdade. Isso está certo e deve ficar.

**Correção sugerida (NÃO executada):**
```sql
drop policy "auditoria: quem tem acesso a embarcacao le" on public.auditoria;
create policy "auditoria: o dono e quem administra leem" on public.auditoria
  for select to authenticated
  using (eh_prop(embarcacao_id) or permissao(embarcacao_id, 'embarcacao', 'editar'));
```

---

### P2 — desempenho e higiene

#### P2-1 · Advisors de segurança: 51 avisos, 50 são ruído legítimo

- **50 × `authenticated_security_definer_function_executable`** — "usuário logado pode chamar função `SECURITY DEFINER`". **É ruído neste desenho**, e conferi uma a uma nas sensíveis: `avaliacao_moderar` abre com `if not eh_admin() then raise 'sem_permissao'`; `gold_definir_regiao` exige `tem_papel_admin('suporte')`; `parceiro_admin_definir_visibilidade` exige CEO ou comercial; `carteira_decidir_movimento` exige `eh_prop`; `registrar_log_admin` recusa quem não tem papel; `admin_metricas_*` retornam `null` se não for CEO; `definir_capa` exige `permissao(...,'fotos','editar')`. **Todas se autoverificam.** São RPC de aplicação — precisam mesmo ser chamáveis pelo `authenticated`.
- **1 × `auth_leaked_password_protection`** — desligado. **Risco real e barato de resolver:** é o cruzamento com HaveIBeenPwned no cadastro. Liga no painel (Authentication → Policies), não em SQL.

Duas ressalvas que os advisors **não** pegam e valem registro:
- `gold_reivindicar_consultor()` reivindica a linha de consultor casando `lower(auth.jwt() ->> 'email')`. Se a confirmação de e-mail estiver desligada no Auth, alguém se cadastra com o e-mail de um consultor e assume o papel. **Confirmar que "Confirm email" está ligado** — não dá pra verificar por SQL.
- `registrar_visualizacao()` e `publicidade_registrar_clique()`/`_impressao()` são chamáveis por qualquer logado e incrementam contador sem idempotência. Qualquer usuário consegue inflar as métricas de um parceiro (`parceiros.visualizacoes`) ou de uma campanha em laço. Se esses números virarem base de cobrança, viram fraude de faturamento.

#### P2-2 · `auth_rls_initplan` — 32 policies reavaliam `auth.uid()` por linha

O padrão antigo do repo usa `(select auth.uid())`, que o planner avalia uma vez. **A onda nova voltou a escrever `auth.uid()` puro.** As 17 tabelas afetadas são quase exatamente a leva de hoje: `afazeres` (4), `agenda_eventos` (4), `estoque_itens` (2), `estoque_movimentos` (2), `tanques` (2), `tanque_movimentos` (2), `bases_operacionais` (2), `envios_cotista` (2), `auditoria` (2), `carteira_movimentos` (2), `agenda_participantes` (2), `votos`, `carteiras`, `gold_consultores`, `gold_precos`, `gold_solicitacoes`, `assinatura_parametros`.

Hoje não dói (a maior dessas tem 6 linhas). Dói em escala. Os patches de P0-1 e P1-2..5 acima já reescrevem boa parte delas com `(select auth.uid())`.

#### P2-3 · `multiple_permissive_policies` — 33 combinações

Causa raiz quase sempre a mesma: uma policy `FOR ALL` (nome "…escreve"/"…gerencia") também casa em `SELECT`, e roda junto com a policy de leitura. Ex.: `estoque_itens` tem `estoque: o dono escreve` (ALL) + `estoque: o dono le` (SELECT) — a de leitura é redundante, já que o `ALL` cobre `SELECT` com o mesmo predicado. Idem `tanques`, `bases_operacionais`, `motor_*`, `taxonomia`, `gold_protocolo_itens`, `gold_selos`.

Correção genérica: trocar o `FOR ALL` por policies explícitas de `INSERT`/`UPDATE`/`DELETE`, deixando o `SELECT` sozinho. Vale fazer junto com os patches acima, não como faxina separada.

#### P2-4 · Índices: 86 FK sem cobertura, 34 índices sem uso

**Ressalva honesta antes dos números:** este banco tem entre 0 e 144 linhas por tabela. `idx_scan = 0` aqui significa **"a funcionalidade ainda não rodou"**, não "índice morto". Não recomendo apagar nenhum dos 34 com base nesta medição — a leitura correta é refazer o `pg_stat_user_indexes` depois de uns meses de uso real. Registro a lista só como linha de base.

Já as **86 FK sem índice** são risco previsível, e o subconjunto que importa é o que o código realmente filtra. Cruzando com `lib/consultas-patio.ts`, `lib/acoes/enterprise.ts` e as telas de `/afazeres`, `/estoque`, `/combustivel`, `/mecanica`, os quentes são:

```sql
-- FK que o app filtra a cada carga de tela
create index on public.afazeres (embarcacao_id);
create index on public.afazeres (responsavel_id);
create index on public.estoque_movimentos (embarcacao_id);
create index on public.estoque_movimentos (servico_id);
create index on public.estoque_itens (base_id);
create index on public.tanques (base_id);
create index on public.tanques (dono_id);
create index on public.tanque_movimentos (destino_embarcacao_id);
create index on public.movimentos_patio (responsavel_id);
create index on public.movimentos_patio (ocorrencia_id);
create index on public.orcamentos (servico_id);
create index on public.servicos_mecanica (ocorrencia_id);
create index on public.lancamentos_financeiros (criado_por);
create index on public.votos (votante_id);
create index on public.envios_cotista (cotista_id);
```
As outras ~70 são `criado_por`/`decidido_por`/`atualizado_por` apontando para `profiles` — só pesam em `DELETE` de perfil. Deixar para depois.

#### P2-5 · Código × banco

Bateu melhor do que o esperado. Não achei **nenhuma** coluna que `web/lib/db/types.ts` declare e o banco não tenha, nem tabela lida pelo código que não exista. Conferi campo a campo `Vinculo`, `MovimentoPatio` e `ConviteCotista` contra `information_schema` — idênticos, inclusive `suspenso_em`/`suspenso_por`.

O desvio é de organização: **as tabelas da onda nova não estão em `types.ts`**. `Afazer`, `Tanque`, `EstoqueItem`, `Orcamento`, `Votacao` estão declaradas *inline dentro das páginas* (`app/(app)/afazeres/page.tsx:43`, `app/(app)/combustivel/page.tsx:42`, `app/(app)/mecanica/page.tsx:78-82`). `types.ts` deixou de ser o contrato único — que era o ponto dele. Não é bug, é dívida: o próximo que mudar uma coluna não tem um lugar só para olhar.

---

## Para rodar depois de revisar

Ordem proposta, do que protege dado para o que só acelera. **Nada disto foi executado.** Rodar em transação, um bloco por vez, conferindo entre eles.

```sql
-- =====================================================================
-- BLOCO 1 — P0-1: suspensão passa a valer (o mais urgente)
-- =====================================================================
begin;

create or replace function public.permissao(emb uuid, aba text, modo text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = (select auth.uid())
      and v.suspenso_em is null
      and (v.papel = 'PROP' or coalesce((v.permissoes -> aba ->> modo)::boolean, false))
  );
$$;

create or replace function public.pode_ver_embarcacao(emb uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = (select auth.uid())
      and v.suspenso_em is null
  );
$$;

-- PROP nunca fica suspenso (evita o dono se trancar pra fora)
alter table public.vinculos
  add constraint vinculos_prop_nao_suspende
  check (papel <> 'PROP' or suspenso_em is null);

commit;

-- Conferência (deve voltar 2):
-- select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and p.proname in ('permissao','pode_ver_embarcacao')
--    and pg_get_functiondef(p.oid) ilike '%suspenso%';


-- =====================================================================
-- BLOCO 2 — P1-2 e P1-3: viagens e sondagens voltam para a matriz
-- =====================================================================
begin;

drop policy "viagens: tudo com vinculo" on public.viagens;
create policy "viagens: ver pela matriz" on public.viagens
  for select to authenticated using (permissao(embarcacao_id, 'diario', 'ver'));
create policy "viagens: criar pela matriz" on public.viagens
  for insert to authenticated with check (permissao(embarcacao_id, 'diario', 'editar'));
create policy "viagens: atualizar pela matriz" on public.viagens
  for update to authenticated
  using (permissao(embarcacao_id, 'diario', 'editar'))
  with check (permissao(embarcacao_id, 'diario', 'editar'));
create policy "viagens: excluir pela matriz" on public.viagens
  for delete to authenticated using (permissao(embarcacao_id, 'diario', 'editar'));

drop policy "sondagens: dono grava e le as suas" on public.sondagens;
create policy "sondagens: ve as do barco" on public.sondagens
  for select to authenticated using (pode_ver_embarcacao(embarcacao_id));
create policy "sondagens: grava a propria" on public.sondagens
  for insert to authenticated
  with check (pode_ver_embarcacao(embarcacao_id) and usuario_id = (select auth.uid()));
create policy "sondagens: corrige a propria" on public.sondagens
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "sondagens: apaga a propria" on public.sondagens
  for delete to authenticated using (usuario_id = (select auth.uid()));

commit;


-- =====================================================================
-- BLOCO 3 — P1-4: afazeres entra na matriz e o responsável vira alguém do barco
-- =====================================================================
begin;

drop policy "afazeres: o dono cria" on public.afazeres;
create policy "afazeres: o dono cria" on public.afazeres
  for insert to authenticated
  with check (
    dono_id = (select auth.uid())
    and (embarcacao_id is null or permissao(embarcacao_id, 'diario', 'editar'))
    and (responsavel_id is null or exists (
      select 1 from public.vinculos v
      where v.embarcacao_id = afazeres.embarcacao_id
        and v.usuario_id = afazeres.responsavel_id
        and v.suspenso_em is null
    ))
  );

drop policy "afazeres: dono e responsavel leem" on public.afazeres;
create policy "afazeres: dono, responsavel e a unidade leem" on public.afazeres
  for select to authenticated
  using (
    dono_id = (select auth.uid())
    or responsavel_id = (select auth.uid())
    or (embarcacao_id is not null and eh_prop(embarcacao_id))
  );

drop policy "afazeres: dono e responsavel atualizam" on public.afazeres;
create policy "afazeres: dono e responsavel atualizam" on public.afazeres
  for update to authenticated
  using (dono_id = (select auth.uid()) or responsavel_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()) or responsavel_id = (select auth.uid()));

drop policy "afazeres: so o dono apaga" on public.afazeres;
create policy "afazeres: so o dono apaga" on public.afazeres
  for delete to authenticated using (dono_id = (select auth.uid()));

commit;


-- =====================================================================
-- BLOCO 4 — P1-5: destino de estoque/combustível amarrado a vínculo
-- =====================================================================
begin;

drop policy "estoque_mov: dono do item registra" on public.estoque_movimentos;
create policy "estoque_mov: dono do item registra" on public.estoque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.estoque_itens i
                where i.id = item_id and i.dono_id = (select auth.uid()))
    and (embarcacao_id is null or pode_ver_embarcacao(embarcacao_id))
  );

drop policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos;
create policy "tanque_mov: dono do tanque registra" on public.tanque_movimentos
  for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.tanques t
                where t.id = tanque_id and t.dono_id = (select auth.uid()))
    and (destino_embarcacao_id is null or pode_ver_embarcacao(destino_embarcacao_id))
  );

alter table public.bases_operacionais
  drop constraint bases_operacionais_dono_id_fkey,
  add  constraint bases_operacionais_dono_id_fkey
       foreign key (dono_id) references public.profiles(id) on delete restrict;

commit;


-- =====================================================================
-- BLOCO 5 — P1-7: auditoria só para quem administra
-- =====================================================================
begin;
drop policy "auditoria: quem tem acesso a embarcacao le" on public.auditoria;
create policy "auditoria: o dono e quem administra leem" on public.auditoria
  for select to authenticated
  using (eh_prop(embarcacao_id) or permissao(embarcacao_id, 'embarcacao', 'editar'));
commit;


-- =====================================================================
-- BLOCO 6 — P1-6: fecha o ciclo do cotista (decidir o desenho ANTES de rodar)
-- =====================================================================
begin;

alter table public.convites_cotista add column expira_em timestamptz;

create or replace function public.aceitar_convite_cotista(p_codigo text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare c record; v_ocupadas int; v_total int;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;

  select * into c from public.convites_cotista
    where codigo = p_codigo and ativo
      and (expira_em is null or expira_em > now()) for update;
  if not found then raise exception 'convite invalido ou expirado'; end if;

  if exists (select 1 from public.vinculos
             where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()) then
    raise exception 'voce ja faz parte desta tripulacao';
  end if;

  select cotas_total into v_total from public.embarcacoes where id = c.embarcacao_id;
  select count(*) into v_ocupadas from public.vinculos
    where embarcacao_id = c.embarcacao_id and papel = 'COTISTA';
  if v_ocupadas >= coalesce(v_total, 0) then raise exception 'sem_vaga_de_cota'; end if;

  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel)
    values (auth.uid(), c.embarcacao_id, 'COTISTA', 'operacional');
  return c.embarcacao_id;
end $$;

revoke all on function public.aceitar_convite_cotista(text) from public, anon;
grant execute on function public.aceitar_convite_cotista(text) to authenticated;

commit;

-- Depois deste bloco, /convite/[codigo] precisa passar a tentar
-- aceitar_convite_cotista além de info_convite e info_transferencia.


-- =====================================================================
-- BLOCO 7 — P2-4: índices das FK que o app filtra de verdade
-- =====================================================================
create index concurrently if not exists afazeres_embarcacao_idx        on public.afazeres (embarcacao_id);
create index concurrently if not exists afazeres_responsavel_idx       on public.afazeres (responsavel_id);
create index concurrently if not exists estoque_mov_embarcacao_idx     on public.estoque_movimentos (embarcacao_id);
create index concurrently if not exists estoque_mov_servico_idx        on public.estoque_movimentos (servico_id);
create index concurrently if not exists estoque_itens_base_idx         on public.estoque_itens (base_id);
create index concurrently if not exists tanques_base_idx               on public.tanques (base_id);
create index concurrently if not exists tanques_dono_idx               on public.tanques (dono_id);
create index concurrently if not exists tanque_mov_destino_idx         on public.tanque_movimentos (destino_embarcacao_id);
create index concurrently if not exists movimentos_patio_resp_idx      on public.movimentos_patio (responsavel_id);
create index concurrently if not exists movimentos_patio_ocorrencia_idx on public.movimentos_patio (ocorrencia_id);
create index concurrently if not exists orcamentos_servico_idx         on public.orcamentos (servico_id);
create index concurrently if not exists servicos_mecanica_ocorrencia_idx on public.servicos_mecanica (ocorrencia_id);
create index concurrently if not exists lancamentos_criado_por_idx     on public.lancamentos_financeiros (criado_por);
create index concurrently if not exists votos_votante_idx              on public.votos (votante_id);
create index concurrently if not exists envios_cotista_cotista_idx     on public.envios_cotista (cotista_id);
-- `concurrently` não roda dentro de transação: executar solto.
```

### Fora do SQL

1. **Ligar o "Leaked password protection"** no painel (Authentication → Policies).
2. **Confirmar que "Confirm email" está ligado** — `gold_reivindicar_consultor()` confia no e-mail do JWT para conceder papel de consultor.
3. **Decidir sobre os contadores de publicidade** — `registrar_visualizacao` e `publicidade_registrar_clique` são infláveis por qualquer logado. Se viram base de cobrança, precisam de idempotência por usuário/dia.
4. **Levar os tipos da onda nova para `web/lib/db/types.ts`** (`Afazer`, `Tanque`, `EstoqueItem`, `Orcamento`, `Votacao`), hoje declarados dentro das páginas.
5. **Não apagar os 34 índices "sem uso"** com base nesta auditoria — a base é pequena demais para essa conclusão. Remedir depois de uso real.

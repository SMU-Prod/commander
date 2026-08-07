# Auditoria CTO — Commander (GEST-NAV)

Data: 2026-08-07 · Base: branch `main`, migrations 001–009, `web/` Next 16.3 · Supabase `khgjtxvmduizyooqaoox`
Estado: 5 fases construídas, 75 testes (100% domínio puro), nunca rodou em produção, Confirm-email ainda ON (signup real nunca exercido).

Legenda de severidade: **P0** bloqueia lançamento · **P1** antes de escalar · **P2** débito.

---

## P0 — Bloqueiam lançamento

### P0-1. Autorização por aba (Ver/Editar) NÃO é aplicada no banco para motores, itens, eventos e gastos — só na UI
**Evidência:** `supabase/migrations/001_nucleo.sql:127-137` cria as policies de `equipamentos`, `itens_monitorados` e `eventos` como `for all using (pode_ver_embarcacao) with check (pode_ver_embarcacao)`. A migration 008 (`008_tripulacao_marketplace.sql:84-104`) só migrou `documentos` e `contatos` para a matriz `permissao(emb, aba, modo)`. `equipamentos`/`itens`/`eventos` continuam abertos a **qualquer vínculo**, independentemente da matriz.
**Impacto concreto:** um CMDT marcado como "só Ver" (ou sem permissão nenhuma naquelas abas) é bloqueado apenas no front (`podeVer()` em `hoje/page.tsx:21`, `gastos/page.tsx:13`). Via PostgREST direto (o anon key é público, o token do CMDT é dele), ele faz `INSERT/UPDATE/DELETE` em `equipamentos` (zera horímetro, apaga motor), `itens_monitorados` (apaga toda a manutenção) e `eventos` — e como **gasto é uma linha de `eventos`** (`gastos/page.tsx:17-19`), um CMDT "sem acesso a gastos" lê e escreve o financeiro do PROP. É o débito já triado "I2 permissao() … forms visíveis p/ CMDT ver-only", mas a gravidade real é *bypass total de autorização*, não cosmético. A matriz de permissões — feature central da fase 5 — é decorativa para 4 das 6 abas.
**Correção:** trocar as 3 policies `for all` por 4 policies por comando (select via `permissao(...,'ver')`, insert/update/delete via `permissao(...,'editar')`), espelhando o que 008 fez com documentos. ~60 linhas SQL + 1 migration. 3–4 h com teste de RLS por papel.

### P0-2. Não existe cobrança — o modelo de negócio (§2, §9) não está implementado
**Evidência:** `list_tables` retorna 12 tabelas, nenhuma de assinatura/fatura/pagamento. Nenhuma action em `web/lib/acoes/` toca gateway. Espec §9 (assinatura R$119/mês, cartão/Pix, split) e §7 (comissão 10%) não têm código.
**Impacto:** o produto não pode faturar. Todo acesso hoje é grátis e ilimitado; não há gate de assinatura, nem trial, nem bloqueio de PROP inadimplente. Lançar assim é operar sem receita e sem controle de acesso pago.
**Correção:** integração de gateway + tabela `assinaturas` + gate no `middleware.ts`/`carregarPainel`. Fora do escopo de fix — é uma fase inteira. Sinalizado como blocker de *lançamento comercial*, não de deploy técnico.

### P0-3. Corrida no aceite de convite: 1 código single-use pode virar N tripulantes
**Evidência:** `008_tripulacao_marketplace.sql:132-154` (`aceitar_convite`): `SELECT ... where usado_em is null` → `INSERT vinculos` → `UPDATE convites set usado_em`. Sem `FOR UPDATE` nem update condicional com checagem de linhas afetadas.
**Impacto:** dois usuários **diferentes** enviando o mesmo código simultaneamente passam ambos pelo `usado_em is null` (a leitura não trava a linha), ambos inserem vínculo (o `unique(usuario_id, embarcacao_id)` só protege o *mesmo* usuário) e ambos marcam usado. Resultado: um convite pago para "1 acesso CMDT" (§2) libera vários. Débito já triado ("corrida aceitar_convite (for update)") — mas é corrupção de regra de negócio faturável.
**Correção:** `select ... for update` na linha do convite **ou** transformar o consumo em `update convites set usado_por=auth.uid(), usado_em=now() where codigo=? and usado_em is null returning embarcacao_id` e só inserir o vínculo se retornou linha. ~8 linhas. 1 h.

---

## P1 — Antes de escalar

### P1-1. 16 FKs sem índice de cobertura — Postgres não cria índice de FK
**Evidência:** query em `pg_constraint`/`pg_index` e advisor `unindexed_foreign_keys`: faltam índices em **todas** as FKs consultadas por filtro, incluindo `eventos.embarcacao_id`, `eventos.equipamento_id`, `eventos.item_monitorado_id`, `itens_monitorados.embarcacao_id`, `itens_monitorados.equipamento_id`, `equipamentos.embarcacao_id`, `documentos.embarcacao_id`, `contatos.embarcacao_id`, `vinculos.embarcacao_id`, `alertas_enviados.embarcacao_id`, `convites.embarcacao_id`. As páginas filtram exatamente por essas colunas (`diario/page.tsx:27` `.eq("embarcacao_id",...)` com `limit(300)`; `consultas.ts:37-38`; `equipamento/[id]/page.tsx:26` `.eq("equipamento_id",id)`).
**Impacto:** hoje as tabelas têm 0–6 linhas, então tudo é seq scan barato. Com 100 PROPs × histórico de eventos por barco, cada render de `/diario`, `/hoje`, `/barco`, `/gastos` vira seq scan na `eventos` inteira. Degrada de forma silenciosa e simultânea em todas as telas quentes.
**Correção:** `create index` nas ~11 FKs realmente filtradas (as `criado_por`/`usado_por`/`contato_id` são menos críticas). 1 migration, ~15 linhas. 1 h.

### P1-2. Cron de alertas: full-scan sem filtro + laço O(itens × usuários × assinaturas) sequencial, sem `maxDuration`, sem alerta de falha
**Evidência:** `app/api/alertas/disparar/route.ts:30-36` carrega `itens_monitorados`, `equipamentos`, `vinculos`, `push_assinaturas`, `alertas_enviados` com `select("*")` **sem `.eq`/paginação** (tabelas inteiras). Depois, `:56-122`, laço aninhado com `await webpush.sendNotification` e `await fetch(resend)` **sequenciais** por usuário. Sem `export const maxDuration`. Falha só retorna JSON — nada notifica a operação.
**Impacto:** é o coração do produto ("alertas automáticos", §4.2). Com volume, o handler puxa a base toda para memória a cada execução e envia push/e-mail em série; estoura o timeout de função (10 s hobby / 60 s+ conforme plano), entregando alertas parciais e silenciosamente. Se o cron parar, ninguém percebe — não há dead-man switch. Débitos já listados (maxDuration, log removidas, sender Resend).
**Correção:** filtrar itens por status candidato no SQL (ou paginar), paralelizar envios com `Promise.allSettled` em lotes, `export const maxDuration = 60`, e um ping de heartbeat (log/health) que dispare alerta se o cron não rodar. 4–6 h.

### P1-3. Sem rate limiting em auth; enumeração de e-mail; proteção de senha vazada desligada
**Evidência:** `lib/acoes/auth.ts` (`entrar`/`cadastrar`) chama Supabase Auth sem qualquer throttle de aplicação. Advisor de segurança: `auth_leaked_password_protection` = **WARN (desligado)**. Confirm-email ON mas fluxo nunca testado (memória do projeto).
**Impacto:** credential stuffing e signup-spam sem fricção; o front usa mensagem genérica no cadastro (bom contra enumeração), mas o login (`auth.ts:13-15`) devolve "E-mail ou senha incorretos" e o signup de e-mail já existente tem timing/erro distinto — enumeração ainda viável. Senhas do HaveIBeenPwned aceitas.
**Correção:** ligar leaked-password protection e rate limits no dashboard (grátis); rate limit por IP nas actions de auth (ou WAF/Vercel). 2–3 h + config.

### P1-4. LGPD: posição GPS é dado sensível, sem exclusão de conta, sem export, sem política, retenção indefinida
**Evidência:** trilha GPS gravada em `eventos.trilha` jsonb (`lib/acoes/trilha.ts:36-43`) e `embarcacoes.marina_lat/lon` (`006_gps_tier0.sql`). `profiles` **não tem policy de DELETE** (migration 001 só `select`/`update`; débito "perfis sem DELETE (LGPD)"). Não há rota de export, nem página de privacidade, nem retenção. `perfis_comandante` expõe telefone de terceiros (`marketplace/page.tsx:38`).
**Impacto:** operar no Brasil coletando localização + telefone de terceiros sem base de exclusão/portabilidade é exposição de compliance direta. GPS histórico é rastreamento de padrão de uso do proprietário.
**Correção:** fluxo de exclusão de conta (hard-delete + cascade já existe nas FKs), export JSON básico, política de privacidade, definição de retenção da trilha. 1–2 dias (jurídico + código).

### P1-5. Storage sem cota (espec §4.6 exige) e sem validação real de conteúdo
**Evidência:** `lib/acervo.ts:3-11` valida só `file.type` (MIME **enviado pelo cliente**, spoofável) e tamanho ≤10 MB; sem checagem de magic bytes, sem AV. Nenhuma contagem de cota por embarcação — espec §4.6 pede cota com barra de progresso. Bucket `acervo` privado (`003_fase2.sql:44`) — isso está certo.
**Impacto:** upload ilimitado no plano de R$119/mês = custo de storage sem teto (bomba de custo). MIME falsificado permite subir conteúdo arbitrário rotulado como PDF; como o download usa signed URL e `target=_blank` (`documentos/page.tsx:64`), o risco é moderado, mas não há varredura.
**Correção:** cota por embarcação (somar `metadata.size` do bucket, bloquear acima do limite + UI), validação de magic bytes no server. 1 dia.

### P1-6. Escritas múltiplas não-atômicas em várias actions (estados parciais)
**Evidência:** `onboarding.ts:44-85` (rpc atômica só cria embarcação+vínculo; depois loop de `equipamentos`+`itens`+`documentos` fora de transação, conta `falhas`); `registro.ts:34-61` (loop update `equipamentos` + insert `eventos`, conta `falhas`); `eventos.ts:64-92` (insert evento → update ciclo do item, sem transação); `documentos.ts:20-59` (insert item → upload → insert doc, compensação manual best-effort).
**Impacto:** falha no meio deixa dados parciais (motor sem itens de manutenção, leitura gravada sem evento, ciclo não zerado). Hoje mitigado com mensagem ao usuário, mas não há atomicidade — sob concorrência/erro transitório o barco fica com estado inconsistente e o usuário precisa corrigir na mão. Também: leitura de horímetro é last-write-wins sem lock otimista (`registro.ts:22-48` valida contra `painel` possivelmente stale).
**Correção:** mover os fluxos de escrita composta para RPCs `plpgsql` transacionais (como já foi feito em `criar_embarcacao`/`aceitar_convite`). ~1 dia para os 3 fluxos principais.

---

## P2 — Débito técnico

### P2-1. Zero cobertura de server actions, páginas e RLS; sem e2e; sem CI; sem seed
**Evidência:** 75 testes, todos em `lib/domain/*.test.ts` e `lib/seguranca/destino.test.ts` (domínio puro). Nenhum teste toca `lib/acoes/`, páginas, ou policies. Sem `.github/` (confirmado: "sem .github"). Sem script de seed.
**Impacto:** as camadas onde moram os bugs deste relatório (RLS, atomicidade, autorização) são exatamente as **não testadas**. Regressão de RLS passa despercebida — P0-1 é justamente uma policy que "parecia" coberta pela migração 008 e não estava. Sem CI, nada roda os 75 testes no push.
**Correção:** GitHub Actions (lint+test+build) — 1 h. Testes de RLS com dois usuários via SQL — 1–2 dias. E2e de signup→onboarding→registro (Playwright) — 2–3 dias.

### P2-2. N+1 de signed URLs na página de documentos
**Evidência:** `documentos/page.tsx:32-35` + `:48-51`: uma chamada `createSignedUrl` (REST ao storage) **por documento**, dentro de `Promise.all` por item e repetido para avulsos. Débito já listado ("signed URLs em lote").
**Impacto:** com muitos documentos, dezenas de round-trips ao storage por render. Existe `createSignedUrls` (plural, em lote).
**Correção:** trocar por chamada única em lote. 1–2 h.

### P2-3. RLS re-avalia `auth.<fn>()` por linha (7 policies) — advisor `auth_rls_initplan`
**Evidência:** advisor de performance lista `profiles` (2 policies), `vinculos`, `push_assinaturas`, `perfis_comandante` (3) com `auth.uid()` sem `(select ...)`.
**Impacto:** custo por linha em scans grandes. Baixo hoje, some com o crescimento das tabelas.
**Correção:** trocar `auth.uid()` por `(select auth.uid())` nas policies afetadas. 1 migration, ~30 min.

### P2-4. `middleware.ts` deprecado no Next 16.3 (migrar p/ `proxy.ts`); `nivel operacional` sem efeito no SQL
**Evidência:** `web/middleware.ts` existe, `proxy.ts` não; débito recorrente no ledger ("middleware.ts deprecado … migrar p/ proxy.ts"). `vinculos.nivel` (`001:24`) é usado só como rótulo — a autorização real deveria vir da matriz (ver P0-1).
**Impacto:** dívida de plataforma; risco de quebrar no próximo major. Baixo.
**Correção:** renomear/adaptar para `proxy.ts` quando estabilizar. 1–2 h.

### P2-5. Observabilidade zero
**Evidência:** nenhum `console` estruturado, sem Sentry/PostHog, sem métricas (grep vazio). `error.tsx` genérico.
**Impacto:** primeiro incidente em produção será diagnosticado às cegas. Sem backup/restore testado nem runbook (não há docs de operação).
**Correção:** error tracking (Sentry) + logs estruturados nas actions + runbook mínimo. 1 dia.

### P2-6. 8 funções SECURITY DEFINER expostas via `/rpc` (advisor)
**Evidência:** advisor de segurança lista `handle_new_user` executável por **anon** e 7 outras por `authenticated`. As `criar_embarcacao`/`aceitar_convite`/`info_convite`/`eh_prop`/`permissao`/`pode_ver_embarcacao` têm `revoke from public, anon` explícito nas migrations — mas `handle_new_user` (trigger) não deveria ser chamável por RPC.
**Impacto:** `handle_new_user` via `/rest/v1/rpc/handle_new_user` como anon — é trigger, chamada direta não deveria existir; baixo risco prático (insere profile do próprio `new.id`), mas é superfície desnecessária.
**Correção:** `revoke execute on function handle_new_user from public, anon, authenticated`. 5 min.

---

## Resumo de esforço
- **P0 (3):** P0-1 e P0-3 são SQL pequeno e urgente (~5 h somados); P0-2 é fase inteira (pagamento).
- **P1 (6):** ~1 semana somada — índices (1 h) e leaked-password (config) dão o maior retorno imediato.
- **P2 (6):** CI e revoke são triviais e devem entrar já; testes de RLS/e2e são o investimento estrutural que teria pego P0-1.

**Achado mais perigoso:** P0-1 — a matriz de permissões, principal entrega da fase 5, não protege motores/itens/eventos/gastos no banco; a autorização vive só na UI.

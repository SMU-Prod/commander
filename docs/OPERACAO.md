# Operação do Commander

## Deploy na Vercel
Roteiro para publicar o Commander pela primeira vez. Siga na ordem — cada passo depende
do anterior. Hospedagem: Vercel (plano free). Domínio: `commander.soumardivers.com`
(Cloudflare gerencia o DNS).

### 1. Criar o projeto na Vercel
1. Entre em vercel.com com a conta GitHub que tem acesso a este repositório.
2. **Add New… → Project** e importe o repositório do Commander.
3. Antes de clicar em Deploy, clique em **Edit** ao lado de "Root Directory" e digite
   `web` (o projeto Next.js vive dentro dessa pasta, não na raiz do repo). O framework
   Next.js é detectado automaticamente.

### 2. Colar as variáveis de ambiente
Ainda na tela de configuração (ou depois em **Settings → Environment Variables**), cole
uma por uma as variáveis. A lista completa, com um comentário explicando o que é cada
uma e onde conseguir o valor real, está em `web/.env.example` — abra esse arquivo ao
lado e copie o **nome** exatamente igual, colando o **valor real** (nunca o texto de
exemplo) para cada uma. Marque pelo menos o ambiente **Production**.

Duas variáveis ficam **vazias por enquanto** — elas são ligadas depois, no passo 7:
`NEXT_PUBLIC_COBRANCA_ATIVA`. As demais (Supabase, VAPID, Resend, Asaas) já entram
preenchidas. Depois de colar tudo, clique em **Deploy**.

### 3. Domínio custom
1. No projeto criado, **Settings → Domains → Add**.
2. Digite `commander.soumardivers.com` e confirme.
3. A Vercel mostra um registro CNAME para você criar (algo como `cname.vercel-dns.com`)
   — anote esse valor exato, ele aparece na própria tela.

### 4. DNS no Cloudflare — sempre "DNS only" (nuvem cinza)
1. No Cloudflare, abra o DNS do domínio `soumardivers.com`.
2. **Add record**: Type `CNAME`, Name `commander`, Target = o valor que a Vercel mostrou
   no passo anterior.
3. **Importante:** clique no ícone de nuvem ao lado do registro até ele ficar **cinza**
   ("DNS only"). Se ficar **laranja** ("Proxied"), o proxy do Cloudflare entra em
   conflito com o certificado TLS da Vercel e o site fica em loop de redirecionamento /
   erro de certificado. Deixe sempre cinza.
4. Volte na Vercel e aguarde o domínio mostrar "Valid Configuration" (pode levar alguns
   minutos para propagar).

### 5. Webhook do Asaas
1. No painel do Asaas: **Integrações → Webhooks → novo webhook**.
2. URL: `https://commander.soumardivers.com/api/asaas/webhook`.
3. Token de autenticação: o mesmo valor colado em `ASAAS_WEBHOOK_TOKEN` na Vercel (o
   Asaas envia esse token no header `asaas-access-token`, e a rota confere antes de
   aceitar o evento).
4. Eventos: pelo menos `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` e
   `SUBSCRIPTION_DELETED`.

### 6. Secrets no GitHub (para os workflows automáticos rodarem)
No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
Crie:
- `APP_URL` = `https://commander.soumardivers.com` (lido pelo workflow do relatório
  mensal, `.github/workflows/relatorio.yml`).
- `COMMANDER_URL` = `https://commander.soumardivers.com` (mesmo valor — lido pelo
  workflow de alertas, `.github/workflows/alertas.yml`; os dois workflows usam nomes
  diferentes para a mesma URL, então cadastre os dois secrets).
- `ALERTAS_SEGREDO` = o mesmo valor colado na Vercel.

### 7. Ligar as flags — nessa ordem, uma de cada vez
Não ligue as três juntas: confirme que cada uma funciona antes de ligar a próxima.

1. **`ALERTAS_ATIVOS`** — aba **Variables** da mesma tela de Secrets/Variables do GitHub
   → New repository variable → nome `ALERTAS_ATIVOS`, valor `true`. Teste rodando
   manualmente em **Actions → Alertas do Commander → Run workflow** e confira que a
   execução termina verde.
2. **`RELATORIOS_ATIVOS`** — mesma tela, nome `RELATORIOS_ATIVOS`, valor `1`. Teste
   rodando manualmente **Actions → Relatório mensal do Commander → Run workflow**.
3. **`NEXT_PUBLIC_COBRANCA_ATIVA`** — só depois de validar um pagamento de teste
   completo no Asaas (sandbox) e confirmar que o webhook do passo 5 está atualizando a
   assinatura. Na Vercel: **Settings → Environment Variables**, edite o valor para `1` e
   faça um **redeploy** (variáveis `NEXT_PUBLIC_*` só atualizam em um novo build, não
   basta salvar).

### 8. Supabase Auth antes de abrir para o público
- **Confirm email**: hoje está **desligado** para facilitar o desenvolvimento. Antes de
  divulgar o domínio publicamente, volte a ligar em dashboard Supabase →
  **Authentication → Sign In / Providers → Email → Confirm email**.
- **Site URL / Redirect URLs**: dashboard Supabase → **Authentication → URL
  Configuration**. Defina Site URL como `https://commander.soumardivers.com` e adicione
  a mesma URL (e `https://commander.soumardivers.com/**`) em Redirect URLs — sem isso o
  fluxo de login e confirmação de e-mail quebra em produção.

## Alertas automáticos
O motor de alertas é a rota `POST /api/alertas/disparar`, protegida por
`Authorization: Bearer $ALERTAS_SEGREDO`. Ela varre todos os barcos, calcula o semáforo
com o mesmo domínio das telas, grava em `alertas_enviados` (o que dedupe por item+janela+ciclo)
e envia push (+ e-mail se `RESEND_API_KEY` existir).

**Para ligar em produção:**
1. Cadastre no GitHub os secrets `COMMANDER_URL` (ex.: `https://app.commander.com.br`) e `ALERTAS_SEGREDO`.
2. Crie a variável de repositório `ALERTAS_ATIVOS = true`.
3. O workflow `.github/workflows/alertas.yml` roda todo dia às 08:00 de Brasília.
4. Confira a primeira execução em Actions: a resposta traz `{alertas, pushes, emails, removidas}`.

**Se os alertas pararem:** o workflow falha (exit ≠ 0) quando a rota não responde 200 — o GitHub
notifica por e-mail. Rode manualmente por "Run workflow" para testar.

## Relatório mensal por e-mail
A rota `POST /api/relatorio/mensal`, protegida pelo mesmo `Authorization: Bearer $ALERTAS_SEGREDO`
dos alertas, fecha o mês anterior ao atual (em America/Sao_Paulo) para cada embarcação — horas de
motor, gastos, saídas registradas e o que vence no mês seguinte — e manda um e-mail de texto só para
os PROPs de cada barco (`vinculos.papel = 'PROP'`, e-mail via `admin.auth.admin.getUserById`). Essa
é a defesa nº 1 contra churn: o assinante sente o valor da fatura mesmo sem abrir o app.

Embarcação sem nenhum movimento no mês (0 horas, 0 gastos, 0 saídas, nada a vencer) **não** recebe
e-mail — um relatório vazio treina o dono a ignorar a mensagem. Ela entra na contagem de `puladas`
do log. Falha ao montar ou enviar o e-mail de uma embarcação não aborta as demais (try/catch por
embarcação, igual ao padrão dos alertas).

Sem `RESEND_API_KEY` configurada a rota responde `500 {erro}` — diferente do disparo de alertas
(onde o e-mail é best-effort), aqui o e-mail É o produto, então a chave é obrigatória.

**Para ligar em produção:**
1. Garanta que `COMMANDER_URL`/`APP_URL` e `ALERTAS_SEGREDO` já estão cadastrados no GitHub (mesmos
   secrets dos alertas — a rota de relatório usa o secret `APP_URL`).
2. Crie a variável de repositório `RELATORIOS_ATIVOS = 1`.
3. O workflow `.github/workflows/relatorio.yml` roda no dia 1 de cada mês, 09:00 de Brasília, e
   fecha o mês que acabou de terminar (inclusive na virada de ano: relatório de janeiro cobre
   dezembro do ano anterior).
4. Para testar sem esperar o cron, rode manualmente por Actions → "Relatório mensal do Commander" →
   "Run workflow". A resposta traz `{embarcacoes, enviadas, puladas, falhas}`.

**Se o relatório parar:** o workflow falha (exit ≠ 0) quando a rota não responde 200 — o GitHub
notifica por e-mail, igual aos alertas.

## Variáveis de ambiente
| Nome | Onde | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | app | acesso do cliente com RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | só servidor | rotas de alertas e relatório (ignoram RLS) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | app / servidor | Web Push |
| `ALERTAS_SEGREDO` | servidor + CI | proteção das rotas de disparo (alertas e relatório) |
| `RESEND_API_KEY` | servidor | e-mail de alerta (opcional) e do relatório mensal (obrigatório) |
| `NEXT_PUBLIC_APP_URL` | app | link do convite de tripulação |
| `APP_URL` | CI (secret) | URL da rota chamada pelo `relatorio.yml` |

Lista completa e sempre atual de toda variável usada pelo app (incluindo Asaas,
PostHog e o gate de cobrança), com comentário de onde obter cada uma: `web/.env.example`.

## Banco
Migrations em `supabase/migrations/`, aplicadas via MCP no projeto `khgjtxvmduizyooqaoox`.
Antes de mexer em RLS, leia `docs/auditoria/auditoria-cto.md`.

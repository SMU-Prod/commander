# Operação do Commander

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

## Banco
Migrations em `supabase/migrations/`, aplicadas via MCP no projeto `khgjtxvmduizyooqaoox`.
Antes de mexer em RLS, leia `docs/auditoria/auditoria-cto.md`.

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
- `COMMANDER_URL` = `https://commander.soumardivers.com` (lido pelos dois workflows,
  `.github/workflows/alertas.yml` e `.github/workflows/relatorio.yml`).
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

### 9. Desabilitar Boleto na conta Asaas (pendência do dono)
A espec pede cartão de crédito + Pix, sem boleto. `criarAssinaturaAsaas` (`web/lib/asaas.ts`)
manda `billingType: "UNDEFINED"` — é o único jeito de oferecer **mais de um** meio de pagamento
numa assinatura: a API não aceita uma lista (ex.: `[CREDIT_CARD, PIX]`), só um valor único
(`BOLETO`, `CREDIT_CARD`, `PIX`) ou `UNDEFINED` (o assinante escolhe entre o que estiver
habilitado **na conta**). Não existe parâmetro de API para excluir Boleto e manter os outros
dois — a exclusão só é possível desabilitando o Boleto na conta:
1. Entre no painel Asaas → menu do usuário → **Minha conta → Configurações → Configurações
   do sistema**.
2. Localize a forma de pagamento **Boleto Bancário** e desabilite (o Pix tem o mesmo tipo de
   toggle ali do lado — "Disponibilizar recebimento por Pix" — mas esse já deve ficar
   **habilitado**; só o Boleto sai).
3. Sem essa configuração, o Boleto continua aparecendo como opção pro assinante mesmo com
   `billingType: "UNDEFINED"` no código — o código não pode resolver isso sozinho.

Fontes: [Forma de pagamento — Asaas Docs](https://docs.asaas.com/docs/forma-de-pagamento),
[Quais as formas de pagamento disponíveis para cobranças — Central de Ajuda Asaas](https://central.ajuda.asaas.com/hc/pt-br/articles/31689121385627-Quais-as-formas-de-pagamento-dispon%C3%ADveis-para-cobran%C3%A7as).

## Alertas automáticos
O motor de alertas é a rota `POST /api/alertas/disparar`, protegida por
`Authorization: Bearer $ALERTAS_SEGREDO`. Ela varre todos os barcos, calcula o semáforo
com o mesmo domínio das telas, grava em `alertas_enviados` e envia push (+ e-mail se
`RESEND_API_KEY` existir). Além dos alertas de vencimento (por item monitorado), a mesma rota
dispara dois avisos gerais (Onda 6): **mar ruim** (por embarcação com marina cadastrada, boletim
Open-Meteo, no máximo 1×/dia) e **motor parado** (por motor sem leitura de horas há mais de 30
dias). Nenhum dos dois tem `item_monitorado_id` — a dedupe usa o primeiro id não nulo entre
`item_monitorado_id` / `equipamento_id` / `embarcacao_id` (índice funcional da migration 023),
já que `item_monitorado_id` deixou de ser obrigatório na tabela.

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
1. Usa os mesmos secrets `COMMANDER_URL` e `ALERTAS_SEGREDO` já cadastrados para os
   alertas (passo 6 do roteiro de deploy) — nenhum secret adicional.
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
| `COMMANDER_URL` | CI (secret) | URL da rota chamada por `alertas.yml` e `relatorio.yml` |

Lista completa e sempre atual de toda variável usada pelo app (incluindo Asaas,
PostHog e o gate de cobrança), com comentário de onde obter cada uma: `web/.env.example`.

## Mapa (Mapbox + OpenSeaMap)

O mapa de `/navegar` e o seletor de ponto do painel do parceiro usam Mapbox GL JS.

1. Crie a conta em account.mapbox.com e copie o token público (`pk.*`) de
   **Access tokens** para `NEXT_PUBLIC_MAPBOX_TOKEN` (local: `.env.local`;
   produção: envs da Vercel). É um token público por natureza — sem ele o app
   builda e roda, só o mapa degrada com aviso.
2. Custo: free tier de 50.000 map loads/mês (1 load = cada abertura do mapa);
   acima disso ~US$ 5 por mil. Na escala atual não há custo.
3. A sinalização náutica (boias/faróis) vem do OpenSeaMap como overlay —
   licença CC-BY-SA: a atribuição "© OpenSeaMap" no mapa é OBRIGATÓRIA, não
   remova. O disclaimer "auxílio à navegação — não substitui as cartas náuticas
   oficiais" também é fixo, por segurança e por juridico.

## Máscara de água

Grid raster (PNG grayscale) que marca, célula a célula, o que é água navegável e o
que é terra/margem no circuito real dos barcos atendidos pelo Commander: **Ilhabela/São
Sebastião → Ubatuba → Paraty → Angra/Ilha Grande → Rio → Cabo Frio/Búzios**
(`lngMin -45.75, latMin -24.05, lngMax -41.75, latMax -22.65`). É a base da rota
marítima: o roteador só pode passar por onde a máscara diz que é água — se ela estiver
errada, a rota manda o barco por cima de terra ou de uma ilha.

- **Resolução:** 100 m/célula (`METROS_POR_CELULA` no topo do script). A região cobre
  ~6,3 milhões de células — em 80 m/célula ficaria perto de 10 milhões, e o A* (ver
  abaixo) estouraria o orçamento de memória num celular. 100 m fecha com folga.
- **Margem de segurança da costa:** a dilatação de terra é sempre 2 células
  (`MARGEM_CELULAS_TERRA`), então a resolução determina a distância física da margem:
  **200 m** nessa região (era 160 m quando a resolução era 80 m). O raio padrão de
  snap de `acharCaminho` (`RAIO_SNAP_PADRAO_CELULAS = 20`) também escala junto: ~2 km
  agora, contra ~1,6 km antes.
- **Orçamento de memória do A\*:** `web/lib/domain/rota.ts` aloca, por célula da grade,
  `gScore` (Float32Array, 4 bytes) + `pai` (Int32Array, 4 bytes) + `fechado`
  (Uint8Array, 1 byte) = **9 bytes/célula**, mais um heap de prioridade cujo tamanho é
  limitado por `LIMITE_NOS_EXPANDIDOS` (2.000.000 nós), não pelo tamanho da grade — o
  `fScore` de cada nó vive dentro do próprio heap, não num array do tamanho da grade
  inteira (antes da onda 5 eram 21 bytes/célula: `gScore`+`fScore` em Float64Array +
  `pai`, sem contar o heap). Na região nova (~6,32M células), isso dá ~69,5 MB de
  alocação total — dentro do orçamento de 80 MB. Em 80 m/célula (~9,88M células) o
  mesmo cálculo passaria de 100 MB, por isso a resolução ficou em 100 m.
- **Arquivos gerados:** `web/public/mapa/mascara-agua.png` (255 = água, 0 = terra,
  8 bits grayscale) + `web/public/mapa/mascara-agua.json` (bbox da região, dimensões
  em células, `metrosPorCelula`, `margemCelulas` e a data de geração).
- **Como regerar:** `node scripts/gerar-mascara-agua.mjs` a partir da raiz do repo
  (ou `npm run mascara` dentro de `web/`). O script busca a linha de costa
  (`natural=coastline`) no Overpass, rasteriza, faz flood fill a partir de um ponto
  de oceano aberto, dilata a terra em 2 células de margem de segurança e por fim poda
  bolsões de água que a dilatação isolou do oceano aberto (BFS 8-conectado sem cortar
  quina, a mesma regra de movimento do A* — sem essa poda, reentrâncias estreitas de
  marina/porto podem virar pixels de água "presos" que travam o snap da rota com "sem
  rota" mesmo perto da costa). A resposta do Overpass fica em cache local
  (`scripts/.cache/coastline.json`, ignorado pelo git) — apagar esse arquivo força uma
  nova consulta. **Atenção ao trocar a região:** o script não valida se o cache
  corresponde à região atual, então ao mudar `REGIAO` apague o cache manualmente antes
  de regerar.
- **Origem do dado:** OpenStreetMap contributors, linha de costa (`natural=coastline`),
  extraída via Overpass API. Licença **ODbL — atribuição obrigatória** em qualquer
  lugar que exiba essa camada ("© OpenStreetMap contributors"), igual à sinalização
  do OpenSeaMap acima.
- **Aviso importante:** a máscara conhece **terra**, não **profundidade**. Ela impede a
  rota de cruzar terra firme ou ilhas, mas não sabe onde tem baixio, recife ou água
  rasa demais para o casco — isso não substitui carta náutica nem sonda de
  profundidade.

## Camada de profundidade (batimetria)

`web/public/mapa/batimetria.png` + `.json` — sombreamento de profundidade por faixas
(0-5 m, 5-10 m, 10-20 m, 20-50 m, >50 m) na mesma bbox da máscara de água, desenhado
no mapa como source `image` (sobreposição de bbox fixa, sem tiles).

- **Regerar:** `node scripts/gerar-batimetria.mjs` a partir da raiz.
- **Origem do dado:** **ETOPO 2022 15 Arc-Second Global Relief Model (NOAA/NCEI)**,
  obtido via ERDDAP griddap. **Domínio público dos EUA** — sem restrição de uso
  comercial; citamos a fonte por transparência (aparece na atribuição do mapa).
- **Resolução ~450 m.** É orientação geral, não sondagem. A camada nasce DESLIGADA no
  app e, quando ligada, o painel avisa: "Profundidade aproximada — NÃO substitui a
  carta náutica oficial".

### Por que NÃO usamos as cartas da Marinha

As cartas raster do CHM/DHN são de download gratuito, mas o termo de uso proíbe
**reproduzir, compilar ou derivar para fins comerciais** — e o Commander é um produto
pago. Usá-las exigiria **acordo comercial com a EMGEPRON** (representante oficial da
DHN para venda de cartas). Enquanto esse acordo não existir, nenhum dado da
Marinha/DHN/CHM entra no produto. Se um dia entrar, a camada já está pronta para
receber: é trocar a fonte do tile/imagem e a atribuição.

## Banco
Migrations em `supabase/migrations/`, aplicadas via MCP no projeto `khgjtxvmduizyooqaoox`.
Antes de mexer em RLS, leia `docs/auditoria/auditoria-cto.md`.

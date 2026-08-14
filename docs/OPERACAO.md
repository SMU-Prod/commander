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

## Máscara nacional + recorte por trecho (`onda-11-rota-nacional`)

Antes desta onda, a rota que contorna terra só funcionava dentro do bbox da máscara
fina (Ilhabela/São Sebastião → Búzios) — fora dali a tela caía pro rumo direto com
"Fora da área com rota". O dono pediu navegação em todo o mapa. Gerar a mesma máscara
(linha de costa OSM, 100 m/célula) pra costa brasileira inteira daria bilhões de
células — não cabe em memória de celular. A solução tem duas partes:

### 1. Máscara nacional (grossa, `mascara-nacional.png`/`.json`)

Cobre a costa brasileira inteira, mas **derivada de elevação**, não de linha de
costa vetorial — a query do Overpass pra costa inteira seria pesada demais, e o
dado fino de OSM não faz diferença nessa escala.

- **Reaproveita literalmente o pipeline (e o cache) da batimetria.**
  `scripts/gerar-batimetria.mjs` exporta agora `baixarGradeBatimetria` e
  `parseEsriAscii` (guardadas atrás de um check de execução direta — `import`
  não dispara mais a geração das 2 camadas como efeito colateral) e
  `scripts/gerar-mascara-nacional.mjs` as importa, apontando pro **MESMO**
  `cachePath` da camada "ampla" de batimetria (`scripts/.cache/batimetria-ampla.asc`,
  já baixado do ERDDAP na onda 10) — **zero download novo**. Classificação:
  `z < 0` (ETOPO 2022, elevação em metros) → água; `z ≥ 0` → terra.
- **Resolução obtida: ~3,6 km/célula** (mesma bbox + dataset + stride 2 da
  camada "ampla" de batimetria — `ETOPO_2022_v1_60s`, `lngMin -58, latMin -34.5,
  lngMax -20, latMax 6`; grid 1141×1216 = ~1,39 M células), **mais grossa que os
  ~1 km cogitados inicialmente**. Decisão consciente: baixar mais fino (ex.:
  stride 1, ~1,85 km) exigiria um NOVO download de ~4× o volume já cacheado —
  não há motivo pra pagar esse custo de tempo quando 3,6 km já cabe com folga
  no orçamento de PNG e de memória do A* pro trecho recortado (ver seção 2).
- **Dilatação de segurança:** MESMA contagem de células da máscara fina (2,
  `MARGEM_CELULAS_TERRA` em `gerar-mascara-nacional.mjs`) — como a célula é
  ~37× maior, isso já dá uma margem física proporcionalmente maior (~7,4 km,
  contra 200 m na fina), coerente com o aviso da tela (rota pela nacional é
  "margem de segurança maior").
- **Tamanho medido:** PNG grayscale (255=água, 0=terra, mesmo formato da
  fina) com **5,7 KB** — bem abaixo do orçamento de ~800 KB.
- **Verificação visual (Read no PNG):** a costa brasileira é claramente
  reconhecível (silhueta característica, "bojo" do Nordeste visível), com
  pontinhos isolados no oceano batendo com ilhas oceânicas (Fernando de
  Noronha, Trindade). Marajó, Ilhabela e Santa Catarina aparecem corretamente
  como **terra**. A Baía de Guanabara e o canal da Ilha Grande **NÃO**
  aparecem como água nessa resolução — colapsam pra terra junto com a costa ao
  redor: a 3,6 km/célula + 2 células de dilatação, baías com poucos km de boca
  (Guanabara ~1,7 km na entrada) somem inteiras, não só o canal estreito.
  Verificado com um probe direto no raster (BFS 8-conectado, mesma regra de
  "não corta quina" do A*) — o achado é honesto e esperado, não um bug: quem
  navega DENTRO dessas baías continua com origem E destino cobertos pela
  máscara fina, que resolve o detalhe corretamente (é exatamente o caso "sem
  regressão" coberto no teste do gate, `Abraão -> Angra`). A nacional só entra
  quando pelo menos um dos pontos cai fora da fina — na prática, travessias
  longas que partem de mar aberto, não de dentro de uma marina específica.

### 2. Recorte por trecho (o que torna a cobertura nacional viável)

`recortarGrade(grade, bbox)` em `web/lib/domain/rota.ts`: recorta a grade ao
retângulo (alinhado a célula) que contém origem e destino, ANTES de rodar o
A*. `bboxComFolga(de, para)` calcula esse retângulo com folga de 25% da
diagonal entre os pontos (piso de 0,2° pra trechos curtos/coincidentes, dá
espaço pro A* contornar uma reentrância típica sem esbarrar na borda do
recorte). Memória do A* (`gScore`+`pai`+`fechado`, 9 bytes/célula, ver seção
"Máscara de água" acima) passa a depender do **TRECHO da viagem**, não da
cobertura inteira da grade — a grade nacional inteira (~1,39 M células) já
caberia em memória (~12,5 MB), mas o recorte reduz isso a uma fração ainda
menor por rota (ver medições abaixo). A grade FINA nunca é recortada — já é
pequena o bastante pra rodar o A* nela inteira, e recortar mudaria a
precisão/distância de rotas que já funcionavam.

### 3. Escolha da grade

`escolherGrade(fina, nacional, de, para)` em `web/lib/domain/rota.ts`: se
origem E destino cabem na fina, usa a fina (melhor detalhe perto de casa).
Senão, se os dois cabem na nacional, usa a nacional (recortada pelo chamador
— quem decide qual grade não é responsável por recortar). `null` só quando
NENHUMA das duas cobre os dois pontos ao mesmo tempo — só nesse caso a tela
mostra "fora da área" (antes disparava sempre que saía do bbox da fina; agora
só dispara fora da costa brasileira mapeada inteira, ex.: outro continente).
`web/components/mapa/rota.worker.ts` só busca (fetch) a mascara nacional
quando a fina não cobre os dois pontos — poupa banda/memória no caso comum
(navegando perto de casa).

### 4. A tela

Quando a rota vem da grade nacional, o painel do destino
(`web/components/mapa/navegar-mapa.tsx`) mostra um aviso específico —
diferente do texto padrão de "rota pela água" — avisando que a precisão é
menor e a margem de segurança é maior, e que não serve pra aproximação de
porto.

### Gate: travessias longas (`web/lib/domain/rota-real.test.ts`)

Reproduz o fluxo exato do worker (`escolherGrade` → recorta se for nacional →
A*) sobre as máscaras reais em disco, e mede tempo + memória estimada da
grade efetivamente usada:

| Rota | Grade | Recorte | Células | Memória est. | Tempo | Pontos | Distância |
|---|---|---|---|---|---|---|---|
| Rio de Janeiro → Salvador | nacional | 309×469 | 144.921 | ~1,24 MB | ~35 ms | 336 | 745,8 MN |
| Florianópolis → Rio de Janeiro | nacional | 262×238 | 62.356 | ~0,54 MB | ~3 ms | 158 | 401,5 MN |
| Abraão → Angra (regressão) | **fina** (sem recorte) | 4088×1547 | 6.324.136 | ~54,3 MB | ~81 ms | 201 | 13,1 MN |

As duas travessias longas batem `tipo === "nacional"` (prova de que usam a
grade certa), ficam inteiras na água, e são mais longas que a reta (prova de
que contornaram a costa). Abraão→Angra bate `tipo === "fina"` e reproduz a
MESMA distância do teste original da onda 5 (13,1 MN, teto de 25 MN) — prova
de não-regressão. O ponto que mais salta aos olhos: a memória de uma rota
RJ→Salvador (~750 MN de travessia) é ~40× MENOR que a de uma rota local
Abraão→Angra na fina — exatamente o efeito pretendido do recorte por trecho:
custo depende de quanto a VIAGEM anda, não de quanta costa a máscara cobre.

- **Como regerar a nacional:** `node scripts/gerar-mascara-nacional.mjs` a
  partir da raiz (reusa `scripts/.cache/batimetria-ampla.asc` se existir —
  rodar `node scripts/gerar-batimetria.mjs` antes preenche esse cache sem
  precisar gerar a máscara nacional junto).

## Rota por calado (`onda-12-rota-por-calado`)

Equivalente ao **Auto Guidance+** do Navionics: a rota que contorna terra
(`web/lib/domain/rota.ts`) passa a respeitar o **calado da embarcação**
(`embarcacoes.calado_m`, cadastrado em `/barco/editar`) — evita água rasa
demais pro barco, com uma zona de penalidade (não bloqueio duro) perto do
limite pra preferir água mais funda quando o desvio é barato. Antes desta
onda a máscara só sabia água/terra — não sabia profundidade.

### 1. Grade de profundidade (`scripts/gerar-grade-profundidade.mjs`)

Novo script — não mexe no PNG visual de `gerar-batimetria.mjs` (esse é
gradiente contínuo pensado pro olho humano, com quantização/esmaecimento de
borda que **não é decodificável de volta pra profundidade exata**). Gera um
PNG **grayscale onde o byte do pixel é um valor numérico**, pras duas
coberturas (fina e nacional), reaproveitando **o mesmo cache ETOPO já
baixado** (`scripts/.cache/batimetria.asc` e `batimetria-ampla.asc`,
via `baixarGradeBatimetria`+`parseEsriAscii` exportados de
`gerar-batimetria.mjs`) — **zero download novo**.

**Codificação escolhida** (documentada no cabeçalho do script):

- byte `0` = terra ou sem dado (`z >= 0`, ou nodata do ERDDAP).
- byte `1..255` = **piso** (lower bound) do bucket de profundidade:
  `profundidadeM = (byte - 1) * passoM`.
- byte `255` satura: "pelo menos `254 * passoM` metros" — fundo o bastante
  pra qualquer calado de lancha, não precisa distinguir 300 m de 3000 m pra
  decidir se o barco passa.

Decodificação sempre **conservadora** (o piso do bucket, nunca o teto): um
bucket `[1,00 m, 1,25 m)` decodifica como 1,00 m, nunca 1,25 m — o pior caso
dentro do bucket. Mesma filosofia do resto do produto (nunca inventar dado
otimista).

`passoM` difere por cobertura (metros por bucket do byte):

| Cobertura | Fonte/resolução espacial | `passoM` | Codifica até (satura em) |
|---|---|---|---|
| fina | ETOPO 15 arc-sec, ~450 m/célula | 0,25 m | 63,5 m |
| nacional | ETOPO 60 arc-sec stride 2, ~3,6 km/célula | 4 m | 1016 m |

A fina usa passo fino (25 cm) porque é onde o calado de 1-3 m de uma lancha
realmente decide passagem; a nacional usa passo grosso (4 m) porque a célula
já é ~8000× maior em área — granularidade fina de profundidade não faz
sentido quando o erro de amostragem espacial já domina.

**Tamanho medido** (`node scripts/gerar-grade-profundidade.mjs`, a partir da
raiz):

| Cobertura | Dimensões | Tamanho do PNG | Água com dado |
|---|---|---|---|
| fina | 961×338 px | **18,9 KB** | 65,4% |
| nacional | 1141×1216 px | **42,7 KB** | 62,9% |

Ambos bem abaixo do orçamento de ~800 KB já usado como referência pras outras
máscaras. Inspeção visual (`Read` no PNG): silhueta da costa reconhecível —
preto (terra) na metade superior, gradiente cinza→branco (raso→fundo)
acompanhando a linha de costa, exatamente como esperado de um heightmap.

### 2. Custo do A* com calado (`web/lib/domain/rota.ts`)

- **`GradeProfundidade`**: profundidade em metros por célula, com bbox e
  resolução PRÓPRIOS — DIFERENTES da grade de água/terra (a fina de água vem
  de linha de costa OSM a 100 m/célula; a de profundidade vem de ETOPO a
  ~450 m/célula). Por isso a amostragem é por **coordenada**
  (`profundidadeEm`, nearest-neighbor), não por índice compartilhado com a
  grade de água. Fora do bbox da grade de profundidade (ou célula marcada
  terra/sem-dado nela) devolve `+Infinity` — **ausência de cobertura nunca
  bloqueia por profundidade**; só a grade de água decide bloqueio por terra.
- **`ConfigCalado`**: `{ caladoM, margemSegurancaM, zonaPenalidadeM?, profundidade }`.
  - **Bloqueio**: célula com `profundidadeEm(...) < caladoM + margemSegurancaM`
    é intransponível — mesmo tratamento que terra no A* (skip do vizinho).
  - **Penalidade**: célula na faixa `[limiar, limiar + zonaPenalidadeM)` passa,
    mas o custo do movimento é multiplicado por um fator interpolado (até 4×
    bem no limiar, 1× na borda da zona) — faz o A* preferir um desvio de até
    ~3× a distância direta na água rasa antes de aceitar atravessá-la, sem
    proibir quando não há alternativa mais funda por perto. `zonaPenalidadeM`
    default: a própria `margemSegurancaM` (não existe um número "certo"
    documentado separado disso).
  - **Origem/destino ISENTOS** do check de profundidade: o barco pode estar
    numa marina rasa (origem) ou ir pra uma (destino) — a restrição vale pro
    CAMINHO entre eles, não pros extremos que o snap já escolheu. Sem essa
    isenção, um destino em água rasa (marina típica) ficaria
    PERMANENTEMENTE inalcançável com calado configurado.
  - **`suavizar` (string-pulling) também respeita calado** quando `config` é
    passado — achado importante da implementação: sem isso, a simplificação
    do caminho podia "atalhar" em linha reta de volta por cima de uma célula
    rasa que o A* tinha desviado de propósito (ela é ÁGUA, só não é FUNDA o
    suficiente — o check antigo, só de água/terra, deixava passar).
- **Margem de segurança padrão** (`MARGEM_SEGURANCA_PADRAO_M = 1,0 m`):
  0,5 m de folga sob a quilha (praxe de navegação costeira) + 0,5 m pra
  cobrir o quanto a maré pode baixar abaixo do nível médio que a elevação
  ETOPO usa como referência (marés de sizígia na costa SE brasileira — região
  de operação do Commander — costumam ficar entre 1,0 e 1,5 m de amplitude;
  metade disso é uma estimativa razoável de quanto o nível cai abaixo da
  média). **Não é dado de maré real** (o Commander não consulta tábua de
  maré) — é uma folga fixa e conservadora, configurável por quem navega numa
  região de maré maior.

### 3. A tela (`web/components/mapa/navegar-mapa.tsx` + `rota.worker.ts`)

O worker recebe `caladoM` no pedido (vindo de `embarcacoes.calado_m` da
embarcação ativa, buscado em `/navegar/page.tsx` via `carregarPainel`) e
carrega a `GradeProfundidade` que casa com a grade de água escolhida (fina ou
nacional). A resposta traz `caladoM` **efetivamente aplicado** (pode ser
`null` mesmo com calado pedido, se a grade de profundidade não carregou —
degrada em silêncio pra rota sem restrição, igual ao resto do app faz com
máscara ausente; a tela distingue os dois casos comparando com o que ELA
pediu). Três avisos honestos, nunca um calado inventado em silêncio:

1. **Sem calado cadastrado**: "Calado não cadastrado — a rota não leva em
   conta a profundidade." + link **Cadastrar calado** pra `/barco/editar`.
2. **Rota respeita o calado**: "Rota respeita o calado de X m — evita águas
   rasas CONHECIDAS na resolução do mapa; não garante a profundidade real no
   local exato." — nunca "rota segura".
3. **Sem caminho com esse calado**: quando existe rota sem a restrição mas
   não com ela, o worker marca `semCaminhoPorCalado: true` e a tela troca o
   texto genérico por "Não achei caminho com o calado do seu barco (X m) —
   existe rota sem essa restrição."

O disclaimer de resolução grossa do ETOPO (~450 m fina / ~3,6 km nacional —
não vê pedra isolada nem banco de areia) já valia pro texto de "contorna a
costa"; agora vale igualmente pro calado — reforçado no texto acima
("águas rasas CONHECIDAS", nunca "profundidade garantida").

### Gate: trecho real onde o calado muda a rota (`rota-real.test.ts`)

Achado **varrendo os dados reais** (não um palpite): a **Baía de Sepetiba**
(entre Mangaratiba e Itacuruçá, atrás da Restinga da Marambaia — dentro do
bbox da grade fina) é rasa em boa parte da sua extensão na grade de
profundidade real. Com calado de teste de **2,5 m** + margem padrão
(1,0 m → limiar de bloqueio 3,5 m):

- `(-22.95,-44.05) → (-23.00,-43.95)`: **existe** rota sem restrição
  (8,66 MN) e **não existe nenhuma** com calado 2,5 m — prova direta que a
  profundidade bloqueia de verdade (não é decorativa).
- O mesmo par com calado de 0,8 m (veleiro raso) **passa** normalmente pela
  mesma travessia que o calado de 2,5 m bloqueia — prova que é o LIMIAR que
  muda o resultado, não a água em si.
- Um par mais curto na mesma baía onde a travessia com calado 2,5 m **ainda
  existe**, mas fica mensuravelmente mais longa que sem restrição — o
  comportamento de desvio (penalidade), não só bloqueio total.
- Achado honesto: como a baía inteira é rasa nessa resolução, sobra pouco
  corredor fundo pra desviar — a maioria dos pares testados vira "sem rota"
  em vez de "desvio", o que é o comportamento correto do produto (não
  inventar um corredor fundo que os dados não sustentam).

Regressão: Abraão→Angra (onda 5) e as travessias nacionais RJ→Salvador/
Floripa→RJ (onda 11) continuam idênticas quando nenhum calado é pedido —
`config` ausente é literalmente o mesmo código-caminho de antes desta onda.

## Camada de profundidade (batimetria)

`web/public/mapa/batimetria*.{png,json}` — gradiente contínuo de profundidade,
desenhado no mapa como source `image` (sobreposição de bbox fixa, sem tiles).

**DUAS camadas** desde a branch `onda-10-mapa-completo`. Antes só existia a "fina": ao
afastar o zoom, sobrava uma mancha retangular escura só sobre a região de operação, com
o resto do oceano e da costa brasileira sem cor nenhuma — o dono reportou vendo isso no
mapa. A camada "ampla" resolve cobrindo a costa inteira, numa resolução bem mais grossa
pra manter o PNG pequeno; `minzoom`/`maxzoom` fazem uma sumir exatamente onde a outra
cobre, sem dupla pintura nem serrilhado:

| | **fina** (região de operação) | **ampla** (costa brasileira inteira) |
|---|---|---|
| Arquivos | `batimetria.png` / `.json` | `batimetria-ampla.png` / `.json` |
| Bbox | Ilhabela/SP → Búzios/RJ (4° × 1,4°) | Oiapoque → Chuí + oceano adjacente, `lngMin -58, latMin -34.5, lngMax -20, latMax 6` (38° × 40,5°) |
| Dataset ERDDAP | `ETOPO_2022_v1_15s` | `ETOPO_2022_v1_60s` com stride 2 |
| Resolução | ~450 m (15 arc-sec) | ~3,7 km (2 arc-min efetivo) |
| Âncoras do gradiente | 0 / 5 / 10 / 20 / 50 / 120 m | 0 / 50 / 200 / 1000 / 3000 / 6000 m |
| Zoom no mapa | `minzoom` 8 (ativa perto) | `maxzoom` 8 (ativa longe) |
| Tamanho do PNG | 29,3 KB (era 18,5 KB nas 5 faixas sólidas) | 162,2 KB (era 58,6 KB) |

**Por que âncoras diferentes:** mar aberto é muito mais fundo que a Baía da Ilha Grande
(o Atlântico tem ~3.700 m de profundidade média) — as âncoras rasas da camada fina
(0, 5, 10... 120 m) "achatariam" o oceano inteiro numa cor só de longe. A camada ampla usa
a MESMA paleta de 6 cores (claro→escuro, a última = `--fundo` do produto), remapeada para
profundidades que fazem sentido vistas de longe. O aviso no painel do mapa
(`web/components/mapa/mapa-nautico.tsx`) documenta as duas resoluções pro navegante.

### Renderização: gradiente contínuo, não faixas sólidas (`onda-10-batimetria-bonita`)

O desenho original (5 faixas de cor sólida, alfa fixo em 210, sem esmaecimento de borda)
lia como **"PNG colado"** — foi exatamente essa a reação do dono comparando com o
Navionics (gradiente suave, integrado à carta). A fonte do dado (ETOPO 2022) e as bboxes
acima **não mudaram** — só como o grid vira pixel, tudo dentro de
`scripts/gerar-batimetria.mjs`:

1. **Gradiente contínuo** (`amostrarGradiente`): cor E alfa são interpolados linearmente
   entre "paradas" de profundidade, não mais um degrau duro por faixa. As âncoras de cor
   são as MESMAS 5 cores da paleta antiga (reaproveitadas como marcos do gradiente), mais
   uma 6ª âncora funda = `--fundo` (#0b1d2d) de `web/app/globals.css` — literalmente a cor
   de fundo do produto.
2. **Alfa variável**: raso é mais opaco (alfa 230/200 no anchor 0 m — é a informação que
   importa pra lancha), fundo é mais transparente (alfa 85/55 no anchor mais profundo —
   contexto, deixa o mapa-base/satélite aparecer por baixo). A camada **tinge** a água em
   vez de cobri-la com um bloco opaco uniforme. `raster-opacity` da layer continua no
   default (1) de propósito — a variação já está no alfa por pixel do PNG; um
   `raster-opacity` uniforme só achataria o contraste raso↔fundo que essa mudança criou.
3. **Esmaecimento de borda** (`fatorEsmaecimentoBorda`, smoothstep): o alfa cai pra 0
   suavemente nos últimos pixels de cada lado do bbox — ataca direto o sintoma "aresta
   reta onde a imagem acaba". 6% do menor lado da imagem, piso 6px/teto 48px (20px na fina,
   48px na ampla). Aplicado às duas camadas.
4. **`raster-resampling: "linear"`**, explícito em `web/components/mapa/mapa-nautico.tsx`
   nas duas layers — já é o default do Mapbox GL (confirmado na style spec), mas deixado
   explícito porque é exatamente a propriedade que evita reamostragem `"nearest"` (pixel
   quadrado) ao dar zoom além da resolução nativa do PNG.
5. **Peso do PNG**: gradiente contínuo por pixel é ótimo pro olho e péssimo pro
   compressor — cada pixel difere levemente do vizinho, o que destrói os blocos de cor
   repetida que a versão de faixas sólidas comprimia de graça (medido: sem quantização
   nenhuma, a fina foi de 18,5 KB pra 90 KB e a ampla de 58,6 KB pra 639 KB). Dois ajustes
   trouxeram de volta pra perto do original sem reintroduzir degrau visível:
   `deflateStrategy: 1` (Z_FILTERED do zlib, ~30% menor sozinho) e quantização leve dos
   canais de saída (`QUANT_PASSO_COR = 12`, `QUANT_PASSO_ALFA = 10` — arredonda pro
   múltiplo mais próximo, ~5%/4% do range 0-255, abaixo do que o olho distingue numa cor
   semitransparente sobre mapa-base). Testado visualmente em 3 níveis antes de escolher
   este: um passo maior (18/16) já mostrava leve terraceamento no oceano profundo por
   ~5 KB de economia a mais — não valeu a troca.
6. **Resolução da fina**: avaliado subir acima de 15 arc-sec (pedido explícito da task) e
   **descartado** — é a resolução nativa mais fina do ETOPO 2022 disponível sem licença
   restrita (ver seção "Por que NÃO usamos as cartas da Marinha" abaixo), e
   supersample-ar o PNG manualmente antes de escrever seria redundante: é exatamente o que
   `raster-resampling: "linear"` já faz em tempo de render (interpolação bilinear da GPU
   entre pixels ao dar zoom), só que sem inflar o arquivo.
7. **Isóbatas (contornos 5/10/20/50 m) — avaliadas e descartadas.** Protótipo com marching
   squares na grade fina (450 m), com encadeamento de segmentos em polilinhas + suavização
   Chaikin (2 iterações). Resultado **honesto e misto**: a isóbata de 50 m saiu limpa (seguiu
   a quebra da plataforma continental de forma suave); a de 20 m ficou aceitável na costa
   aberta mas embolada perto de arquipélagos complexos (a região de Ilhabela tem ilhotas
   menores que uma célula de 450 m); as de 5 m e 10 m — as que mais importam pra navegação
   rasa — ficaram visivelmente serrilhadas/embaraçadas perto de qualquer ilha pequena, com
   ou sem suavização (o grid de 450 m simplesmente não resolve essas formas). Mostrar uma
   linha de "5 m" torta bem ao lado de um recife seria pior que não mostrar nada — o tipo de
   falsa precisão mais perigoso justo na profundidade mais crítica. Como só 1 das 4
   profundidades pedidas (50 m, a menos útil pro dia a dia de uma lancha) ficou
   consistentemente elegante, a linha de corte foi **não enviar isóbatas nesta rodada** —
   prefere-se a camada de gradiente sozinha, limpa, a uma com esse extra malfeito.

Verificado nos 3 estilos do painel (Náutico, Satélite, Relevo 3D): `batimetria-ampla` <
`batimetria` < `openseamap` na pilha de camadas em todos, com `raster-resampling: "linear"`
presente e a troca de estilo (inclusive via `setStyle()`, que destrói/reconstrói layers
customizadas) preservando tudo.

**Por que não 15 arc-sec na costa inteira:** a bbox da camada ampla (38° × 40,5°) em 15
arc-sec geraria dezenas de milhões de pixels — pesado demais pra um PNG estático
versionado no repo. 2 arc-min (stride 2 sobre o dataset de 60 arc-sec do ERDDAP, em vez
de baixar 15 arc-sec inteiro) chega em ~1,4 M células, mantendo o arquivo pequeno e ainda
reconhecível de longe.

**Vazão do ERDDAP pra esse volume:** medida manualmente (~550 KB/min) bem mais lenta que
o necessário pros 6 min/2 tentativas que bastavam pra bbox pequena da camada fina — por
isso o script usa timeout/tentativas configuráveis por camada (`timeoutMs`/`tentativas`
em `CAMADAS`, dentro de `scripts/gerar-batimetria.mjs`): a ampla tem até 30 min e 1
tentativa só (a lentidão é vazão baixa e constante, não falha transitória — repetir não
ajuda). É só a geração do asset (uma vez, versionado depois); não afeta o app rodando.

- **Regerar (as duas):** `node scripts/gerar-batimetria.mjs` a partir da raiz. Cache do
  grid bruto em `scripts/.cache/batimetria.asc` e `batimetria-ampla.asc` (ignorados pelo
  git) — apagar força um novo download.
- **Origem do dado:** **ETOPO 2022 Global Relief Model (NOAA/NCEI)**, obtido via ERDDAP
  griddap. **Domínio público dos EUA** — sem restrição de uso comercial; citamos a fonte
  por transparência (aparece na atribuição do mapa).
- **Resolução aproximada, não sondagem.** A camada nasce DESLIGADA no app e, quando
  ligada, o painel avisa a resolução de cada faixa e que isso NÃO substitui a carta
  náutica oficial.

### Por que NÃO usamos as cartas da Marinha

As cartas raster do CHM/DHN são de download gratuito, mas o termo de uso proíbe
**reproduzir, compilar ou derivar para fins comerciais** — e o Commander é um produto
pago. Usá-las exigiria **acordo comercial com a EMGEPRON** (representante oficial da
DHN para venda de cartas). Enquanto esse acordo não existir, nenhum dado da
Marinha/DHN/CHM entra no produto. Se um dia entrar, a camada já está pronta para
receber: é trocar a fonte do tile/imagem e a atribuição.

## Modo navegando — câmera perseguidora e bateria (onda 26)

O "carro no Waze" do Commander: com destino definido (manual, parceiro, ou vindo de uma
viagem planejada via `?destino_la=&destino_lo=&destino_nome=` — ver `NavegarMapa`) **e**
a embarcação em movimento de verdade, a câmera do mapa passa a perseguir a posição do
GPS (proa pra cima, zoom que respira com a velocidade), e um painel de bordo mostra
próxima virada, distância restante e ETA. Matemática pura (limiares, zoom por
velocidade, amortecimento de rumo, projeção da posição na rota) em
`web/lib/domain/modo-navegando.ts`, com teste; a "cola" (quando entra/sai, como move o
`map.easeTo`) vive em `web/components/mapa/navegar-mapa.tsx`.

### Custo de bateria — as duas fontes

1. **GPS de alta precisão contínuo** (`enableHighAccuracy: true` no `watchPosition`) —
   já existia antes desta onda (SOG, alarme de âncora, gravação de trilha todos dependem
   dele) e continua sendo o maior custo isolado; o modo navegando não aumenta a taxa nem
   a precisão pedida, só passa a REAGIR mais visivelmente a cada leitura (câmera
   animando).
2. **Câmera animada** (`map.easeTo` a cada tick do GPS, com `duration` de ~1,2 s) —
   GPU/compositor trabalhando continuamente enquanto a tela está visível. É o custo NOVO
   desta onda.

### Mitigação implementada: parar de animar com a aba oculta

`document.visibilitychange` — quando o app vai pro segundo plano (troca de app, tela
apagada, aba minimizada), a animação da câmera **para** (o efeito de câmera checa
`document.visibilityState` antes de cada `easeTo`); o watcher de GPS continua rodando
(o próprio navegador já limita a frequência dele em segundo plano), só a parte cara de
GPU some. Ao voltar pro primeiro plano, a visão retoma no próximo tick do GPS
(tipicamente 1-2 segundos) — tradeoff aceito por simplicidade: não há lógica extra pra
"saltar" pra posição atual no instante exato em que a aba volta.

### Considerado e descartado

- **Manter a tela ligada (`navigator.wakeLock`) durante o modo navegando**: telas de
  navegação costumam manter a tela acesa, mas isso **aumenta** o consumo de bateria — o
  oposto do que esta seção pede. A gravação de trilha já usa wake lock (propósito
  diferente: garantir que o registro não pare com a tela bloqueada); o modo navegando
  não pede tela ligada por conta própria — quem navega decide se quer a tela acesa.
- **Reduzir a taxa de `easeTo` abaixo do tick do GPS** (throttle manual): a `duration`
  de ~1,2 s já cobre o intervalo típico entre leituras do `watchPosition` sem empilhar
  animação nova em cima de uma ainda em voo — um throttle adicional só adiaria
  atualizações sem reduzir de fato quantas animações rodam por minuto (a fonte real do
  custo é o `watchPosition` de alta precisão, não a cadência do `easeTo`).
- **Reduzir `enableHighAccuracy` durante o modo navegando**: pioraria SOG/rumo/alarme de
  âncora ao mesmo tempo — a precisão que a câmera perseguidora precisa é a MESMA que o
  resto da tela já depende; degradar uma degradaria as duas.

## Tempo no mar — vento, onda, água e maré estimada (onda 20)

`web/lib/mar.ts` (`boletimDoMar`) consulta duas APIs hospedadas da **Open-Meteo** — Marine
(`wave_height`, `wave_period`, `sea_surface_temperature`, `sea_level_height_msl`) e Forecast
(`wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`) — usadas no boletim da Início e no
painel "Tempo" de `/navegar` (`web/components/mapa/tempo-painel.tsx`).

**PENDÊNCIA OPERACIONAL — licença comercial antes do lançamento público.** A API hospedada da
Open-Meteo (`api.open-meteo.com` / `marine-api.open-meteo.com`) é **grátis apenas para uso
não-comercial**. O Commander é um produto pago — no lançamento comercial é preciso **assinar o
plano Standard** (US$ 29/mês, 1M chamadas/mês, inclui a Marine API) em open-meteo.com, ou
fazer **self-host** do serviço (código AGPL). Enquanto o Commander não tem faturamento em
produção, o uso da API hospedada segue como está; não adie essa assinatura além do lançamento
comercial de fato.

**Maré: estimativa por modelo, nunca a tábua oficial.** A curva de nível do mar
(`sea_level_height_msl`) é a saída de um MODELO meteorológico, não a tábua oficial de marés do
CHM (Centro de Hidrografia da Marinha) — a tábua do CHM tem uso liberado só para "fins
científicos", então o Commander **nunca embute** o dado dela. Toda tela que mostra maré (o
boletim da Início e o gráfico do painel de Tempo) rotula o dado como **estimativa** e linka
para a tábua oficial (`LINK_TABUA_MARE_CHM`, `web/lib/domain/mar.ts` — linkar é livre, mesmo
sem acordo comercial). Ver a ressalva completa de honestidade em `docs/CONTRIBUTING.md`.

**Correnteza — fora do escopo desta onda (v2).** O Copernicus Marine Service (CMEMS) é grátis
e de uso comercial permitido (com atribuição/DOI), mas exige um pipeline próprio de dados
NetCDF com validade — mesmo tipo de trabalho que a batimetria/máscara de água já fazem pra
ETOPO, só que pra um dataset diferente. Fica registrado para uma onda futura; nenhuma tela
promete correnteza hoje.

## Testes ponta a ponta (Playwright, onda 31)

Todos os bugs reais desta semana (mapa branco no emulador, rota cruzando terra, sessão
caindo, chunk 403) foram achados pelos OLHOS DO DONO, não pela suíte de vitest — ela testa
domínio/lógica isolada, nunca sobe um navegador de verdade. `web/e2e/*.spec.ts` cobre os
caminhos onde isso apareceu: landing pública, `/login` (renderiza + valida campo vazio),
redirect de rota protegida sem sessão, `/parceiros` público, e **o mapa monta de verdade**
em `/navegar`.

**Rodar local:** `cd web && npm run test:e2e` (builda/sobe o `next dev` sozinho na porta
3010, via `webServer` do `playwright.config.ts`).

### A sessão de teste do mapa
`/navegar` é rota protegida — testar que o mapa monta precisa de uma sessão real. Em vez de
pedir credencial ou cadastrar conta na mão, `e2e/global-setup.ts` cria um usuário de teste
**efêmero** pela Admin API do Supabase (precisa de `SUPABASE_SERVICE_ROLE_KEY` no ambiente),
loga de verdade pela tela `/login` (fluxo real, não cookie fabricado) e salva a sessão.
`e2e/global-teardown.ts` apaga esse usuário no final da rodada — o Commander não tem banco
de staging separado (mesmo projeto Supabase de produção), então não deixar rastro é o
mínimo.

Local, com `web/.env.local` preenchido (é o caso hoje), isso roda de ponta a ponta sozinho.
**Sem essas variáveis** (é o caso do CI hoje, que builda com credenciais fake — ver abaixo),
`global-setup` não tenta nada e `e2e/navegar-mapa.spec.ts` pula sozinho, com o motivo
explícito no relatório — nunca um "vermelho" confuso.

### No CI (`.github/workflows/ci.yml`)
Job `e2e` separado do `verificar`, com `continue-on-error: true` — roda e reporta (inclusive
sobe o relatório HTML do Playwright como artefato do run), mas não bloqueia merge se ficar
flaky no início. Hoje ele builda com as MESMAS credenciais fake do job `verificar`, então só
os 4 testes públicos rodam de verdade; o do mapa pula (mesma lógica acima). **Pra ligar o
teste do mapa também no CI**, cadastre em **Settings → Secrets and variables → Actions**:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (os mesmos valores já
usados na Vercel) e, opcional, `MAPBOX_TOKEN` — sem isso o job continua rodando os outros 4
testes normalmente, só sem ligar o quinto.

## Observabilidade de erro (Sentry, onda 31)

O dono só descobria bug quando via com os PRÓPRIOS olhos (mapa branco no emulador, sessão
caindo, chunk 403) — a suíte de teste não pega isso, e ninguém era avisado em produção.
`@sentry/nextjs` captura erro no cliente, no servidor e no edge (`middleware.ts`).

**Sem chave configurada, o app funciona idêntico a hoje e não loga nada** — mesmo padrão de
no-op que já existe pro PostHog (`components/analytics.tsx`): `Sentry.init` só é chamado se
`NEXT_PUBLIC_SENTRY_DSN` (ou `SENTRY_DSN` no servidor) estiver preenchida. Sem isso, zero
request de rede, zero overhead.

1. Crie o projeto em sentry.io (plataforma **Next.js**), free tier serve (5k erros/mês).
2. **Settings → Client Keys (DSN)** → copie o DSN e cole em `NEXT_PUBLIC_SENTRY_DSN` na
   Vercel (Production + Preview) — ver `web/.env.example` pro nome exato de cada variável.
3. Opcional — upload de source map no build (stack trace legível no Sentry em vez de
   código minificado): **Settings → Auth Tokens** (escopo `project:releases`), cole em
   `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`. Sem essas três, o build continua
   verde — o plugin só pula o upload com um aviso (`web/next.config.ts`).

**Privacidade — requisito do produto, não opção.** O Commander lida com GPS, trilha de
navegação e documento de embarcação. Configuração (`instrumentation-client.ts`,
`sentry.server.config.ts`, `sentry.edge.config.ts`):
- `sendDefaultPii: false` (default do SDK, mantido explícito) — nenhum IP, cookie, header
  ou corpo de request/response é anexado automaticamente a um evento.
- Nenhuma integração de **Session Replay** habilitada — replay grava tela/DOM, e o mapa +
  painel do barco mostram posição e dado sensível o tempo todo.
- `beforeSend` (`web/lib/observabilidade/sentry-scrub.ts`, com teste) faz uma segunda
  passada: tira `user` do evento e redige parâmetro de coordenada/credencial em query
  string (`?destino_la=&destino_lo=`, `?token=`, etc.) tanto na URL principal quanto em
  breadcrumbs de fetch/xhr.

**Alcance:** `app/error.tsx` (boundary de erro comum) e `app/global-error.tsx` (erro dentro
do próprio `app/layout.tsx`, caso raro) chamam `Sentry.captureException` — sem DSN, isso é
no-op, sem custo.

## Ambiente de teste — preview deployments (onda 31)

Hoje `git push` não deploya sozinho (não há integração Git↔Vercel configurada neste
projeto — cada deploy é manual pelo CLI). A regra da casa: **NUNCA `--prod` direto.**
Sempre preview → conferir → só depois promover.

### 1. Gerar um preview
Dentro de `web/`:
```
vercel deploy
```
(sem `--prod`) — builda e publica numa URL única de preview
(`commander-<hash>-smu-prods-projects.vercel.app`), sem tocar no domínio de produção. A
Vercel imprime a URL ao final do comando.

### 2. O que conferir no preview antes de promover
- Abrir a URL de preview e passar pelo fluxo crítico: `/login` → entrar → `/hoje` →
  `/navegar` (o mapa monta? nunca tela branca) → uma tela que grava dado (ex.: registrar
  manutenção no diário).
- Console do navegador sem erro vermelho novo (F12).
- Se a mudança mexeu em rota de API ou variável de ambiente nova, testar essa rota
  específica no preview.
- Preview usa o MESMO banco Supabase de produção (não existe banco de staging separado —
  ver "Verificação de backup" abaixo) — dado gravado num teste de preview é dado real.
  Prefira testar com uma conta de teste, não a conta pessoal do dono.

### 3. Só depois, promover
```
vercel deploy --prod
```
Ou, pra promover EXATAMENTE o build já testado no preview (sem rebuildar):
`vercel promote <url-do-preview>`.

### 4. Preview é privado por padrão (SSO da Vercel)
Testado nesta onda (`vercel deploy` de dentro de `web/`, 14/08): o deploy completa e devolve
uma URL tipo `commander-<hash>-smu-prods-projects.vercel.app`. Abrir essa URL sem estar
logado na conta/time da Vercel devolve **302 para `vercel.com/sso-api`** — é a proteção
padrão de preview deployment de projeto em time (não é bug; a URL não é indexada — header
`X-Robots-Tag: noindex`). Pra conferir o preview: abra a URL logado na mesma conta Vercel
do time, ou use `vercel inspect <url>` / os logs do próprio deploy pelo terminal.

### 5. Se aparecer bloqueio de deploy por metadata de git
O projeto Vercel (`smu-prods-projects/commander`) não está conectado a um repositório Git
(deploys são só por CLI) — nessas condições, em alguns cenários (ex.: `vercel deploy` sem
sessão de terminal interativa, ou metadata de commit que a Vercel não reconhece) o comando
pode recusar citando autoria/branch do commit local. **Não reproduzido no teste desta
onda** (o deploy funcionou direto, sem precisar disso) — mas caso apareça, o contorno
conhecido é:
```
git remote remove origin
vercel deploy            # ou --prod, conforme o caso
git remote add origin <url-do-repositorio>
```
Sempre restaure o `origin` logo depois — não deixar o repositório local sem remote
configurado por mais tempo que o necessário.

## Rate limiting (onda 31)

Mitigação simples contra abuso/custo em rotas que custam dinheiro (push, e-mail, chamada de
API de tempo) ou expõem dado: `web/lib/seguranca/limitador.ts` — janela fixa em memória,
sem dependência nova. Aplicado em:
- `POST /api/alertas/disparar` — por IP, 5 chamadas/5min, checado ANTES do Bearer (mitiga
  também força-bruta no segredo, não só custo).
- `GET /api/corredores` — por usuário autenticado, 60 chamadas/min.
- `gravarSondagens` (server action de escrita em lote da sondagem de profundidade) — por
  usuário, 20 chamadas/min.

**Limitação conhecida, documentada no código:** em ambiente serverless (Vercel), cada
instância da função tem sua PRÓPRIA memória — não é um contador compartilhado entre
instâncias/regiões. Isso é **mitigação, não muralha**: reduz abuso vindo de uma única
instância "quente", mas não impede um ataque distribuído que acerte instâncias diferentes.
Se o volume real de abuso justificar uma barreira de verdade, a recomendação é um rate
limiter compartilhado (Redis/Upstash) — não implementado nesta onda por não ser dependência
leve.

## Verificação de backup (onda 31)

Banco no plano **Free** da Supabase (projeto `khgjtxvmduizyooqaoox` — ver seção "Banco"
abaixo pra migrations e RLS).

**Política real no plano Free (hoje): nenhum backup automático.** O free tier NÃO inclui
snapshot diário nem Point-in-Time Recovery (PITR) — se o banco corromper ou alguém rodar um
`DELETE`/`UPDATE` sem `WHERE`, não existe "desfazer" pelo painel Supabase. A recomendação
oficial da Supabase pro Free tier é justamente o dump manual abaixo.

**No plano Pro (US$ 25/mês):** backup diário automático com 7 dias de retenção incluso;
PITR granular (restaurar pra qualquer segundo, não só o snapshot da noite) é um add-on
pago à parte, cobrado por dia de retenção do WAL — não incluso automaticamente no Pro.

**Procedimento manual de dump enquanto estivermos no Free** — recomendado antes de
qualquer migration arriscada, e pelo menos 1×/semana:
1. Pegue a connection string **direta** (não o pooler/Supavisor — `pg_dump` precisa do
   protocolo completo do Postgres): dashboard Supabase → **Settings → Database →
   Connection string → URI**, aba "Direct connection".
2. Rode local, sem deixar a senha no histórico do shell:
   ```
   PGPASSWORD='<senha-do-banco>' pg_dump \
     --host=db.khgjtxvmduizyooqaoox.supabase.co --port=5432 --username=postgres \
     --format=custom --file=commander-$(date +%Y%m%d).dump
   ```
   A senha do banco fica em dashboard Supabase → Settings → Database → Database
   Password — NUNCA cole ela direto num arquivo versionado; passe via variável de
   ambiente (como acima) ou um gerenciador de segredo local.
3. Guarde o `.dump` fora da máquina local (ex.: um bucket privado) — um backup que só
   existe no laptop de quem rodou o comando não é um backup confiável.
4. Pra restaurar: `pg_restore --host=... --username=postgres --dbname=postgres --clean
   commander-AAAAMMDD.dump` (`--clean` derruba objetos existentes antes de recriar —
   rodar isso contra o banco de PRODUÇÃO é destrutivo; só use pra restaurar um banco novo
   ou em caso de desastre confirmado).

## Banco
Migrations em `supabase/migrations/`, aplicadas via MCP no projeto `khgjtxvmduizyooqaoox`.
Antes de mexer em RLS, leia `docs/auditoria/auditoria-cto.md`.

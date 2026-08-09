# Commander — Auditoria CTO · Arquitetura, dívida técnica e risco de produção

09/08/2026 · Escopo: arquitetura, segurança (RLS + advisors no projeto remoto `khgjtxvmduizyooqaoox`), dívida técnica, testes, performance/custo e prontidão para produção. Código no branch `onda-7-fala-como-gente`, migrations 001–023, banco remoto consultado ao vivo via MCP read-only.

---

## Veredito em 5 linhas (se eu só pudesse ler isso)

O buraco de segurança crítico da auditoria de 07/08 (matriz de permissões não valendo no banco para equipamentos/itens/eventos) **está corrigido e eu verifiquei isso direto no banco** — RLS está ativo nas 17 tabelas, nenhuma policy usa `using(true)`, e as funções `SECURITY DEFINER` estão todas com `search_path` fixo e escopo correto. O achado novo mais sério desta rodada é **dinheiro, não dado**: `assinar()` tem uma corrida de duplo clique que pode criar duas assinaturas Asaas pagas pro mesmo usuário — não existe constraint no banco que impeça isso, e nunca foi testado contra a API real. A arquitetura (server actions vs API routes, domínio puro isolado, `carregarPainel` cacheado por request) está coerente e aguenta 100 assinantes sem esforço; o risco de escala está nos dois cron jobs seriais (relatório mensal pode estourar o próprio timeout de 60s) e no armazenamento de fotos sem redimensionamento. Zero teste fora do domínio puro é uma lacuna real, mas a mais perigosa não é "RLS não testada" (já verifiquei que funciona) — é a corrida de assinatura, que nenhum teste, nem manual nem automatizado, jamais exercitou.

---

## Segurança — achados com severidade

Verificação feita ao vivo no projeto Supabase remoto (`get_advisors`, `pg_policies`, `pg_proc`, `information_schema`, `pg_constraint`), não nos arquivos de migration isoladamente — o que está no banco é o que vale.

### Crítico

**Corrida de assinatura dupla — `web/lib/acoes/assinatura.ts:24-86` (`assinar`)**
A função faz: `SELECT` de assinatura viva → chamada de rede pro Asaas (`criarClienteAsaas` + `criarAssinaturaAsaas`, latência não controlada) → `INSERT`. Não existe nenhuma constraint no banco que impeça duas linhas ativas para o mesmo `usuario_id` — confirmei via `pg_constraint` em `public.assinaturas`: as únicas `UNIQUE` são em `asaas_subscription_id` e `fundador_numero`, nenhuma em `(usuario_id) WHERE status <> 'cancelada'`. Um duplo clique ou um retry de rede durante a janela do Asaas cria **duas assinaturas pagas de verdade** pro mesmo usuário. Não é teórico: é o padrão de uso mais comum em checkout de celular com conexão ruim — exatamente o cenário do produto (dono de lancha, sinal fraco na marina). Corrigir: `create unique index assinaturas_ativa_por_usuario on public.assinaturas(usuario_id) where status <> 'cancelada';` + tratar a violação no `catch` de `assinar()`. ~2h.

### Médio

**Cancelamento pode divergir do Asaas — `web/lib/acoes/assinatura.ts:100-111`**
Se `cancelarAssinaturaAsaas` funciona mas o `UPDATE` no Supabase falha (linha 106-108), a assinatura fica "ativa" no app enquanto já foi cancelada no Asaas de verdade. A mensagem de erro (`"Cancelada no pagamento, mas o app não atualizou"`) admite o problema mas não tem reconciliação automática — nada reprocessa isso depois.

**Upload confia no `Content-Type` declarado pelo cliente, não no conteúdo — `web/lib/acervo.ts` + sites de upload (`fotos.ts:33`, `perfil.ts:26`, `equipamentos.ts:68`, `parceiro.ts:137`)**
O tipo do arquivo não é verificado por assinatura binária (magic bytes), só pelo campo MIME que o próprio cliente manda. Risco abrandado porque o Storage serve o objeto com esse mesmo content-type (não veicula como `text/html`), mas ainda é superfície pra abuso de parser de imagem/PDF ou distribuição de conteúdo indevido.

**`removerCmdt` e `revogarConvite` não conferem se a escrita realmente aconteceu — `web/lib/acoes/vinculos.ts:43-50`, `web/lib/acoes/convites.ts:51-58`**
Todo o resto do código (`equipamentos.ts`, `itens.ts`, `embarcacao.ts`) segue o padrão `.select("id")` + checar `data?.length` depois de update/delete, porque no Supabase uma escrita barrada por RLS retorna `error: null, data: []` — falha silenciosa, não uma exceção. Essas duas funções pulam essa checagem: se a RLS barrar (ator errado, vínculo errado), a action segue em frente e redireciona como se tivesse dado certo. Hoje a RLS cobre corretamente (`vinculos: prop remove cmdt` exige `eh_prop(embarcacao_id) AND papel='CMDT'` — testei a policy direto no banco), então não é bypass de autorização — é a rede de segurança do próprio time, furada nesses dois pontos.

**Nenhum limite de rate limit em rota nenhuma** — grep por `ratelimit|throttle` em `lib/` e `app/` retorna zero. `assinar()` cria cliente Asaas de verdade a cada chamada; `aceitarConvite` e cadastro não têm cooldown além do que o Supabase Auth já dá de graça.

### Baixo

- Comparação do Bearer token nos dois cron routes (`app/api/alertas/disparar/route.ts:15`, `app/api/relatorio/mensal/route.ts:42`) é `!==` de string simples, não `crypto.timingSafeEqual`. Ambos falham fechado corretamente se `ALERTAS_SEGREDO` não estiver setado.
- `auth_leaked_password_protection` desligado (advisor `WARN`) — 1 clique no dashboard, zero custo de não fazer antes do lançamento.
- Nenhum `file_size_limit`/`allowed_mime_types` configurado nos buckets `acervo` e `parceiros` (confirmei via `storage.buckets`: ambos `null`). O app já limita a 10MB (`acervo.ts`), mas isso não é reforçado pelo Postgres/Storage — quem tiver um JWT válido e pular o app consegue subir arquivo maior.
- Vários `SECURITY DEFINER` aparecem no advisor de segurança como "executável por anon/authenticated" (`vagas_fundador_restantes`, `aceitar_convite`, `criar_embarcacao`, `definir_capa`, `eh_prop`, `info_convite`, `permissao`, `pode_ver_embarcacao`, `registrar_visualizacao`, `aba_alvo`). Li o corpo de todas: cada uma checa `auth.uid()` e opera só sobre as linhas do próprio chamador, todas com `SET search_path TO 'public'` (mitiga hijack de search_path). A única exposta a `anon` é `vagas_fundador_restantes()`, que devolve um inteiro (100 − contagem de assinaturas) sem PII — decisão de design pro contador da landing, correta e contida. **Não é achado real**, listo aqui só porque o advisor aponta e a auditoria pediu pra interpretar, não repetir cru.

### O que está fechado — verificado, não presumido

- **17 tabelas em `public`, todas com `rls_enabled = true`** (`list_tables`, verbose). Nenhuma exceção.
- **Nenhuma policy usa `using(true)`** — consultei `pg_policies` direto (não os arquivos de migration) e toda policy de escrita/leitura passa por `permissao(embarcacao_id, aba, modo)`, `pode_ver_embarcacao(emb)`, `eh_prop(emb)` ou comparação direta com `auth.uid()`. Isso inclui `equipamentos`, `itens_monitorados` e `eventos` — as três tabelas que a auditoria de 07/08 (`docs/auditoria/2026-08-07-sintese-360.md:32`) encontrou com a policy antiga `for all using (pode_ver_embarcacao)`, sem checar a matriz. **Migration 010 corrigiu isso e o banco confirma.**
- **`handle_new_user`** (trigger de criação de perfil) tem `EXECUTE` revogado de `public`/`anon`/`authenticated` — só o trigger do Auth chama. Confirma que o item "revoke handle_new_user" do plano de correção da auditoria anterior foi feito.
- **`atribuir_fundador_numero`** também tem `EXECUTE` revogado de todos os papéis client-side (migration 018) — só dispara via trigger.
- **`assinaturas`**: `authenticated` teve `UPDATE` da tabela inteira revogado e um `GRANT UPDATE (status)` concedido só na coluna `status` (migration 018) — mesmo que a policy de RLS liberasse mais, o cliente fisicamente não consegue escrever `valor_centavos`, `fundador_numero` ou `asaas_subscription_id`. É defesa em profundidade de verdade, não teórica.
- **`aceitar_convite`**: a corrida que a auditoria de 07/08 pedia `for update` pra corrigir já está resolvida — é um único `UPDATE ... WHERE codigo = $1 AND usado_em IS NULL AND expira_em > now() RETURNING ...`. Postgres serializa concorrência num UPDATE assim: o segundo aceite concorrente sempre vê `usado_em` já preenchido e cai no `raise exception`. Não precisa de lock explícito.
- **Storage (`acervo`)**: policies de SELECT/INSERT/DELETE isolam por `storage.foldername(name)[1]` (o `embarcacao_id` embutido no path) checado contra `permissao()`/`pode_ver_embarcacao()` — mesma matriz das tabelas, sem duplicar lógica.
- **Grants de tabela pra `anon`/`authenticated`** são amplos (`SELECT/INSERT/UPDATE/DELETE/TRUNCATE`) em todas as tabelas — confirmei que isso **não** veio de nenhum `grant all` explícito nas migrations (grep vazio); é o comportamento padrão do Supabase (privilégio default do schema `public`), e RLS é a única barreira real. `TRUNCATE` não é filtrado por RLS no Postgres, mas o PostgREST (a API que o app usa) não expõe TRUNCATE — só é um risco se algum dia existir acesso Postgres direto com o papel `anon`/`authenticated`, o que hoje não existe. Vale menos privilégio por padrão, mas não é um furo hoje.

---

## Arquitetura — o que aguenta e o que não

**`carregarPainel` (`web/lib/consultas.ts:9-57`) é acerto, não gargalo.** Chamada em 24 das 35 `page.tsx` do projeto (grep confirmado). Está envolta em `cache()` do React — memoização por request, não cache entre requests — que é exatamente o padrão certo pra dado escopado por RLS: não dá pra cachear entre requests sem correr risco de vazar o barco de um usuário pro outro. Custo por navegação: ~4 idas ao Postgres (vínculos → embarcação → [equipamentos, itens] em paralelo → lista de todas as embarcações do usuário pro seletor), todas em tabelas com dezenas de linhas por barco. Trivial em 100 assinantes. O ponto de atenção não é performance, é acoplamento: virou uma "god query" — qualquer tela nova que precise de mais um dado tende a ser resolvida "adicionando ao painel" em vez de buscar localmente, e hoje 24 páginas dependem do mesmo formato de retorno. Não é urgente corrigir; é o primeiro lugar que vai doer quando o produto crescer de módulo.

**Server actions vs API routes: divisão coerente e documentada.** `web/lib/acoes/*.ts` (20 arquivos) cobre toda mutação de sessão de usuário via cliente Supabase escopado por cookie (RLS aplica). `web/app/api/*/route.ts` (3 rotas: `alertas/disparar`, `relatorio/mensal`, `asaas/webhook`) usa o cliente `service_role` porque são jobs de sistema que cruzam todos os barcos/usuários — não tem sessão de um usuário específico pra escopar. `web/middleware.ts:36-40` documenta explicitamente por que `/api/*` fica fora da guarda de sessão e avisa o próximo dev pra nunca criar rota `/api` que dependa de sessão sem checar por conta própria — grep confirmou que os dois crons e o webhook checam token/segredo antes de qualquer coisa. Não achei nenhuma rota server action usando `service_role` (grep em `lib/acoes/*.ts` por `service_role`/admin client: zero ocorrências) — o uso do client administrativo está confinado exatamente onde deveria.

**`lib/domain/` é de fato puro.** 26 módulos, 164 testes, zero mock de banco, zero import de Supabase dentro do domínio (confirmado ao ler `consultas.ts` e os módulos de domínio consultados: dado entra, dado sai). É a parte do projeto que já teria sobrevivido a uma reescrita completa da camada de dados.

**RLS como única fronteira de autorização é uma faca de dois gumes.** É coerente (fonte única de verdade, sem duas lógicas de permissão pra manter sincronizadas) e funciona hoje — verificado linha por linha nesta auditoria. Mas é frágil por construção: tabela nova no Postgres nasce com RLS **desligado** por padrão, e não existe hoje nenhum gate de CI que rodaria `get_advisors(security)` num PR de migration e travaria o merge se uma tabela nova esquecer `ENABLE ROW LEVEL SECURITY`. O `.github/workflows/ci.yml` roda `tsc`, `eslint`, `vitest` (só domínio) e `next build` com env fake — nunca toca o Supabase real. A ferramenta que teria pego isso (`get_advisors`) já existe e está disponível via MCP; falta só rodar automaticamente.

---

## Dívida técnica priorizada

| Item | Arquivo:linha | Custo de pagar | Risco de não pagar |
|---|---|---|---|
| Corrida de assinatura dupla | `web/lib/acoes/assinatura.ts:24-86` + constraint ausente em `public.assinaturas` | ~2h — unique index parcial + tratar violação | **Alto e crescente com uso real** — double billing gera chargeback e reclamação pública, é o tipo de bug que vira post no Reclame Aqui |
| Crons enviam e-mail em série, um usuário por vez | `web/app/api/relatorio/mensal/route.ts:112-134`, `web/app/api/alertas/disparar/route.ts:92-140` | ~3-4h — paginar `admin.auth.admin.listUsers` numa passada só e paralelizar o envio Resend em lotes | Alto no dia 1 de cada mês em produção: ~100 barcos × 1,3 PROP × 2 chamadas seriais (`getUserById`+Resend) ≈ 78s, acima do próprio `maxDuration=60` já setado no código — risco real de corte no meio, sem retry |
| `removerCmdt`/`revogarConvite` não conferem `data?.length` | `web/lib/acoes/vinculos.ts:43-50`, `web/lib/acoes/convites.ts:51-58` | 15 min — replicar o padrão usado no resto do código | Baixo hoje (RLS barra certo), mas mascara falha futura sem log — suporte recebe "cliquei e não aconteceu nada" sem pista |
| Upload confia em `Content-Type` do cliente | `web/lib/acervo.ts` + `fotos.ts:33`, `perfil.ts:26`, `equipamentos.ts:68`, `parceiro.ts:137` | ~1h — checar magic bytes ou restringir via `allowed_mime_types` do bucket | Baixo-médio, sobe quando o Selo Ouro trouxer avaliação presencial (mais gente estranha enviando arquivo) |
| Buckets sem `file_size_limit`/`allowed_mime_types` no Postgres | `storage.buckets` (`acervo`, `parceiros`) | 5 min via migration | Baixo hoje (app já capa em 10MB), mas é a única barreira se alguém pular o app e falar direto com a Storage API |
| CI nunca toca o Supabase real / nenhum gate de RLS | `.github/workflows/ci.yml` | ~2-4h — rodar `get_advisors(security)` como step obrigatório em PR que toque `supabase/migrations/` | Alto — é hoje a única rede contra uma migration futura nascer com tabela sem RLS (default do Postgres é RLS desligado) |
| `lib/db/types.ts` mantido à mão, sem geração a partir do schema | `web/lib/db/types.ts` | ~30 min — script usando `generate_typescript_types` (já disponível via MCP) num hook ou CI | Médio — drift silencioso quando uma migration muda coluna e ninguém lembra de atualizar o arquivo |
| `carregarPainel` como god-query acoplando 24 páginas | `web/lib/consultas.ts:9-57` | Não pagar agora | N/A hoje; primeiro ponto a rever perto de ~500 assinantes ou quando o painel ganhar mais um módulo grande |
| `auth_leaked_password_protection` desligado | Config do Supabase Auth (dashboard) | 1 clique | Baixo, mas grátis de resolver — sem motivo pra deixar pro dia do lançamento |

---

## Testes — os 5 primeiros que eu escreveria

164 testes, **100% em `lib/domain/`** (confirmado por `vitest.config.mts:6` — `include: ["lib/**/*.test.ts"]` — e por rodar a suíte). Zero teste de server action, zero de API route, zero de componente, zero e2e, zero teste de RLS. O risco concreto disso **não** é "a matriz de permissões pode estar furada" — verifiquei ao vivo que não está — é que nada trava esse estado no lugar: a próxima migration, o próximo refactor de `permissao()`, o próximo "só um ajuste rápido" pode reabrir exatamente o furo que a auditoria de 07/08 fechou, e ninguém saberia até um cliente reclamar. Nessa ordem, por dinheiro e por dado sensível primeiro:

1. **Corrida de dupla assinatura em `assinar()`** — duas chamadas concorrentes (ou, mais simples de testar, a unique index parcial recomendada acima + um teste que espera a segunda `INSERT` falhar) não podem resultar em duas assinaturas ativas pro mesmo usuário. É dinheiro de verdade e o achado mais grave desta auditoria.
2. **RLS negativa da matriz de permissões** — um vínculo CMDT marcado como "só ver" em `equipamentos` tentando `INSERT`/`UPDATE`/`DELETE` direto (cliente autenticado, sem passar pela UI) deve ser barrado pela policy. Hoje está correto — testei manualmente via `pg_policies` — mas é exatamente o tipo de correção que merece um teste que trave pra sempre, porque nenhuma fase de código futura vai "lembrar" de reconferir isso sozinha.
3. **Agrupamento `propsPorBarco` em `relatorio/mensal/route.ts:76-79`** — um bug na função que liga vínculo → embarcação → e-mail pode vazar o resumo financeiro de um dono pro e-mail de outro dono. É dado sensível saindo por e-mail sem volta; merece teste determinístico com 2+ embarcações e 2+ PROPs garantindo que cada e-mail recebe só o resumo do próprio barco.
4. **Chave de dedupe de `alertas/disparar` (`item_monitorado_id ?? equipamento_id ?? embarcacao_id` + janela + `ciclo_ref`)** — um bug aqui manda alerta duplicado (spam que ensina o usuário a ignorar push) ou, pior, engole um alerta real porque a chave colidiu com um alerta antigo diferente.
5. **`aceitar_convite` sob concorrência** — o UPDATE atômico parece correto por leitura de código (verificado acima), mas um teste de integração rodando duas aceitações simultâneas do mesmo código trava esse comportamento como contrato, não como sorte de implementação.

---

## Performance e custo a 100 assinantes

**O que está bem resolvido:** Open-Meteo é cacheado (`next: { revalidate: 3600 }` em `web/lib/mar.ts`) — 1 chamada/hora por marina, não por page view. Mapbox GL é importado dinamicamente (`import()` dentro de `useEffect`) só nas páginas de mapa — não pesa o bundle global, e o free tier de 50k map loads/mês cobre 100 assinantes com folga. Asaas é chamado ao vivo sem cache em `menu/assinatura`, mas baixo volume (usuário olha fatura raramente) e degrada bem (try/catch retorna lista vazia se a API cair).

**O que vai custar caro ou quebrar:**

- **Fotos sem redimensionamento.** `lib/acervo.ts` e os pontos de upload não comprimem nem redimensionam antes de subir pro Storage; o único limite é 10MB por arquivo, aplicado no app. `next/image` não é usado em lugar nenhum — `<img>` cru serve o arquivo original em `barco/fotos`, `equipamento/[id]`, `parceiro`, `card-embarcacao`, `avatar`. Se cada barco acumular ~30-50 fotos de celular (2-4MB cada, sem compressão), isso é 100-200MB por barco × 100 barcos ≈ 10-20GB — muito acima do 1GB grátis do Supabase. Orçar Supabase Pro desde o lançamento (não é opcional em ~100 assinantes com fotos reais).
- **`relatorio/mensal` corre risco real de estourar o próprio timeout.** Loop externo por embarcação (até 100) com loop interno por PROP (~1,3 em média) fazendo duas chamadas seriais cada (`admin.auth.admin.getUserById` + `fetch` pro Resend) — `app/api/relatorio/mensal/route.ts:89-134`. Conta: 100 × 1,3 × 2 × ~300ms ≈ 78s, contra o `maxDuration = 60` já declarado na própria rota (linha 8). Sem paralelizar isso, é bem provável que barcos no fim da lista simplesmente nunca recebam relatório em algum mês.
- **`alertas/disparar` tem o mesmo padrão serial, com efeito colateral pior:** a chave de dedupe é gravada em `alertas_enviados` **antes** do envio de push/e-mail (linhas 79-88) — se a função for cortada no meio (timeout, erro de infra), os alertas não enviados naquele lote nunca são reenviados no dia seguinte, porque a dedupe já existe. Frequência baixa (1×/dia via GitHub Actions) então o custo de invocação é irrelevante (~30/mês); o risco é correção silenciosa, não gasto.
- **Hospedagem no plano free da Vercel** (`docs/OPERACAO.md:5`) é operar um produto pago comercialmente num plano cujos termos são pensados pra uso pessoal/não-comercial, e cujo limite de duração de função historicamente não honra os 60s que os dois crons já pedem no código. Confirmar isso no dashboard da Vercel antes do lançamento é barato; descobrir no dia 1 do primeiro mês em produção não é.

**Estimativa de custo mensal a 100 assinantes:** Vercel Pro ~US$20 (recomendado, ver acima) + Supabase Pro ~US$25 (recomendado pelo motivo de storage acima, inclui 100GB) + possível overage de storage se fotos continuarem sem redimensionar (+US$10-30 conforme crescimento) + Resend (tier grátis de 3.000 e-mails/mês e 100/dia provavelmente basta, mas o padrão atual de "e-mail sempre além do push, não só quando o push falha" pode aproximar do limite diário em dias de alerta correlacionado — ex.: mar ruim atingindo várias marinas no mesmo dia) + Mapbox grátis + domínio/Cloudflare ~US$0. **Total plausível: US$45-95/mês** — trivial frente à receita de 100 assinantes fundadores (~R$10-12 mil/mês). Custo de infra não é o risco do produto; a qualidade dos dois crons e o tamanho das fotos são.

---

## Prontidão para produção — bloqueadores reais

**É código:**
1. Corrigir a corrida de assinatura dupla (`assinar()`) antes de qualquer teste real de pagamento — é o único achado que mexe direto em dinheiro do cliente.
2. Paralelizar/paginar os dois crons antes do primeiro dia 1 de mês em produção — hoje há risco concreto de timeout com toda a base de barcos.
3. Redimensionar fotos antes do upload, ou assumir conscientemente o custo de storage crescendo sem controle.
4. Ligar `leaked password protection` no Supabase Auth — 1 clique, sem custo de não fazer.

**É operação (já mapeado em `docs/superpowers/specs/2026-08-07-roteiro-app-completo.md` e `docs/OPERACAO.md`, reforçando aqui pela lente de risco):**
- **Confirm email** ainda desligado no Supabase Auth "pra facilitar dev" (`OPERACAO.md:75-77`) — tem que ligar antes de abrir pro público, senão qualquer e-mail (inclusive inválido/alheio) entra sem confirmação.
- Decisão sobre plano Vercel (Hobby vs Pro) — ToS comercial + timeout de função, os dois relevantes aqui.
- Testar o fluxo de assinatura ponta a ponta no sandbox Asaas — nunca foi testado contra a API real. Combinado com a corrida de duplo clique encontrada nesta auditoria, é prioridade dupla: primeiro corrige a corrida, depois testa.
- Desabilitar Boleto na conta Asaas (pendência already documented, `OPERACAO.md:83-96`).
- **Ninguém vai perceber se o relatório mensal falhar.** Não existe dead-man switch nos workflows de cron — se `relatorio.yml` falhar silenciosamente ou estourar o timeout no meio, o GitHub manda e-mail de falha de workflow (isso já existe), mas não há alarme de "zero relatórios enviados esse mês" caso a rota retorne 200 com `enviadas: 0`. Vale um healthcheck simples (ex.: ping externo tipo healthchecks.io) — zero código novo, só configuração.

**O que quebra no dia do lançamento se ninguém olhar:** provavelmente nada explode na hora — o app funciona hoje pra 1 usuário/1 barco (é literalmente o estado atual do banco: 1 perfil, 1 embarcação). O que quebra é **silencioso e adiado**: a primeira dupla cobrança de um assinante impaciente no celular, e o primeiro relatório mensal que não chega pra metade dos barcos porque o cron estourou o tempo — nenhum dos dois derruba o site, os dois só fazem o produto parecer não confiável pros primeiros 100 clientes que o CMO está tentando recrutar.

---

## O que preservar

- **RLS é levada a sério e funciona.** Não é impressão — verifiquei direto no banco remoto: 17 tabelas com RLS ativo, zero `using(true)`, matriz de permissões (`permissao()`) como fonte única de verdade pras três tabelas que a auditoria anterior encontrou abertas (`equipamentos`, `itens_monitorados`, `eventos`). O time corrigiu o P0 crítico e a correção se sustenta sob inspeção adversarial.
- **Defesa em profundidade de verdade, não só RLS.** `018_assinaturas_travas.sql` revoga `UPDATE` da tabela inteira de `assinaturas` e concede só a coluna `status` — mesmo se a policy de RLS um dia liberar mais, o cliente fisicamente não escreve `valor_centavos` ou `fundador_numero`. É o tipo de decisão que só aparece quando alguém já foi mordido uma vez.
- **A separação server actions / API routes é limpa e documentada no próprio código** (`middleware.ts:36-40`), com o uso do cliente `service_role` confinado exatamente aos três jobs de sistema que legitimamente precisam dele.
- **`lib/domain/` é de fato puro** — 164 testes, 26 módulos, zero mock de banco. É a base mais madura tecnicamente do projeto e sobrevive a qualquer reescrita de camada de dados.
- **`carregarPainel` com `cache()` por request é a decisão certa** pro padrão de dado escopado por RLS — não é gargalo, é o jeito correto de evitar 5 consultas idênticas na mesma renderização sem correr o risco de cache cruzado entre usuários.
- **A corrida de `aceitar_convite`** que a auditoria de 07/08 pedia pra corrigir com `for update` já está resolvida com um UPDATE atômico bem desenhado — mais simples que a correção sugerida e igualmente correto.

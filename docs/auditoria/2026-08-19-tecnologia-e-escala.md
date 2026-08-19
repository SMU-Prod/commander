# Auditoria de tecnologia e escala — Commander

**Data:** 19/08/2026
**Alvo:** `C:\Users\erick\GEST-NAV\web` · produção `https://commander-tau.vercel.app` (Vercel `smu-prods-projects/commander`) · Supabase `khgjtxvmduizyooqaoox` (`sa-east-1`, Postgres 17.6)
**Modo:** só leitura. Nada foi alterado — nem código, nem banco, nem configuração da Vercel.
**Base:** `docs/OPERACAO.md`, `docs/APP-NATIVO.md`, `web/next.config.ts`, `web/package.json`, `.github/workflows/`, `docs/auditoria/2026-08-19-fechamento.md` e as auditorias de 18/08. O que já estava fechado lá não se repete aqui — o que reaparece, reaparece **confirmado com medição nova**.

---

## Resumo em uma página

O aplicativo está bem escrito. As regras moram em funções puras com 1.904 testes verdes, a RLS está correta (261 policies, **zero** com o defeito de initplan), o `mapbox-gl` é carregado sob demanda, as fotos e documentos validam tipo e tamanho, e as quatro rotas de API se defendem sozinhas. Nada disso é pouco.

O problema é que **o aplicativo roda no continente errado**.

A função da Vercel executa em Washington (`iad1`); o banco fica em São Paulo (`sa-east-1`). Cada consulta atravessa o Atlântico e volta. Medido: as consultas levam **0,52 a 1,28 ms dentro do Postgres** e a viagem até lá custa **~150 ms**. O banco faz o trabalho em um milissegundo e o pacote passa cento e cinquenta viajando.

Sobre esse chão está a irmã exata do defeito que derrubou o app hoje de manhã. A onda 96 consertou o middleware e o `carregarPainel`; **quem chama o `carregarPainel` não foi consertado**. A tela inicial encadeia catorze idas à rede em fila indiana, e nenhuma delas depende da anterior. Catorze × 150 ms ≈ 2,1 s — que é exatamente o que o cronômetro mostra: `/hoje` responde em **1,8 a 2,6 s com o banco praticamente vazio** (9 barcos, 9 eventos, 382 linhas no total).

E há uma terceira coisa, que ainda não dói porque não há dado, e que vai doer proporcionalmente ao sucesso: a tela inicial baixa **a trilha GPS inteira de todas as saídas do ano** para calcular uma distância em milhas. Uma trilha no teto tem 227 kB. Um barco que sai três vezes por semana chega a dezembro com 144 saídas — **32 MB baixados a cada abertura da tela inicial**, para exibir um número. Essa única escolha de coluna é a diferença entre **US$ 0 e US$ 1.417 por mês de banda** a 10.000 barcos.

As três correções são pequenas. Uma é uma caixa de seleção no painel da Vercel.

**O que está confirmado e continua verdadeiro:** o Hobby proíbe uso comercial — e a landing **já anuncia R$ 49,90/mês hoje**, o que a própria definição da Vercel classifica como uso comercial; o gatilho não é ligar o Asaas, já foi puxado. O Supabase está no **Free** (confirmado na API: organização `SMU-FREE`, plano `free`), sem backup automático e sem PITR. E há três coisas que ninguém tinha conseguido verificar até agora e que eu consegui: **Sentry, PostHog, Resend e Asaas não existem em produção** — as variáveis simplesmente não estão lá.

---

# Frente 1 — Desempenho, medido

## Como foi medido

| Medição | Método | Resultado |
|---|---|---|
| Região da função | `x-vercel-id` da resposta de produção | `gru1::iad1::…` — entra em São Paulo, **executa em Washington** |
| Região do banco | API do Supabase (`get_project`) | `sa-east-1` (São Paulo) |
| Perna rede→edge `gru1` | 10 amostras, conexão reusada, `/termos` (estático) | **51 ms** (mediana) |
| Perna rede→função `iad1` | 10 amostras, conexão reusada, `/login` (dinâmico, sem banco) | **208 ms** (mediana) ⇒ trecho `gru1↔iad1` ≈ **157 ms** |
| Perna rede→Supabase `sa-east-1` | 10 amostras, conexão reusada, `/auth/v1/user` | **90 ms** (mediana) |
| Custo real das consultas no Postgres | `extensions.pg_stat_statements` | **0,52–1,28 ms** de média |

## A-01 · [P0] A função roda em Washington e o banco fica em São Paulo

**Medição.** `curl` em produção devolve `x-vercel-id: gru1::iad1::65wjv-…`. O primeiro código é o ponto de entrada (São Paulo), o segundo é onde a função executa (Washington, D.C.). O banco está em `sa-east-1`. Não existe `vercel.json` no repositório e nenhum `regions` configurado — a documentação da Vercel diz textualmente que o padrão é `iad1` "for all new projects".

**Consequência, com número.** As consultas mais chamadas do app custam, dentro do Postgres:

| Consulta | Chamadas | Média |
|---|---|---|
| `embarcacoes (id, nome)` | 4.091 | **1,28 ms** |
| `itens_monitorados` por embarcação | 4.482 | **0,57 ms** |
| `equipamentos` por embarcação | 2.391 | **0,63 ms** |
| `embarcacoes` por id | 2.894 | **0,52 ms** |

O banco não é lento. **Ele é 100 a 300 vezes mais rápido que a viagem até ele.** Cada `await` que toca o Supabase paga ~150 ms de latitude, não de trabalho.

**Correção.** Painel da Vercel → projeto → Settings → Functions → Function Regions → **`gru1` (São Paulo)**. A documentação confirma que o Hobby permite **região única** (não múltiplas) — ou seja, trocar a região já é possível no plano de hoje, sem custo e sem código. É a maior devolução por menor esforço deste relatório inteiro.

> Ao migrar para o Pro (que é obrigatório por outro motivo, ver A-09), o `vercel.json` com `{"regions": ["gru1"]}` deixa a decisão versionada em vez de presa a um clique no painel.

## A-02 · [P0] `/hoje` encadeia catorze idas à rede em fila — e nenhuma precisa esperar a anterior

**Medição de tempo** (produção, sessão real, banco quase vazio, duas amostras por rota):

| Rota | TTFB | Completo | Payload |
|---|---|---|---|
| `/hoje` | 1.821 / 2.014 ms | 2.542 / 2.532 ms | 100 kB |
| `/barco` | 2.051 / 1.804 ms | 2.169 / 1.915 ms | 118 kB |
| `/diario` | 2.639 ms | 2.748 ms | 58 kB |
| `/financeiro` | 2.096 ms | 2.098 ms | 69 kB |
| `/menu` | 2.047 ms | 2.158 ms | 87 kB |
| `/notificacoes` | 1.923 ms | 2.033 ms | 52 kB |

Primeiro carregamento completo de `/hoje` medido pela Performance API do navegador: `responseEnd − responseStart` = **4.398 ms**, `load` em **6.389 ms**. Só 414 kB em 20 recursos — **não é problema de bundle**. É espera de servidor.

**Medição de causa.** `web/app/(app)/hoje/page.tsx`, cadeia sequencial de `await` que tocam a rede:

| Linha | O que espera |
|---|---|
| 165 | `carregarPainel()` — que por dentro já são 3 ondas (`getUser`+cookie → `vinculos` → 5 em paralelo) |
| 228–229 | `supabaseServer()` + **`auth.getUser()` de novo** |
| 230 | `profiles` — **consulta idêntica à que o `carregarPainel` já fez** |
| 234 | `createSignedUrl` do avatar |
| 236 | `carregarCapaDoHeroi()` |
| 237 | `perfis_comandante` |
| 251 | `eventos` do ano **com a coluna `trilha`** (ver A-03) |
| 274 | `carregarProximaViagem()` |
| 294 | `ocorrencias` ativas |
| 322 | `carregarNotificacoes()` |
| 333 | consulta condicional |
| 344 | `vinculos` da tripulação |
| 348 | `profiles` — **terceira consulta a `profiles` na mesma requisição** |
| 357–361 | `createSignedUrl` × N (limitado a 5) |

**Nenhuma das linhas 236 a 348 depende do resultado da anterior.** Todas precisam apenas de `user.id` e `embarcacao.id`, conhecidos desde a linha 228. Estão em série por onde a variável foi escrita, não por dependência de dado — que é a **descrição literal** do defeito que a onda 96 consertou em `lib/consultas.ts:80-84` ("esperavam por causa de onde a variável foi lida, não por dependência de dado").

14 esperas × ~150 ms ≈ **2,1 s** — bate com o medido.

**Correção.** Um `Promise.all` cobrindo as linhas 236–348, exatamente como a onda 96 fez dentro do `carregarPainel`. O mesmo padrão se aplica a `/barco`, `/diario`, `/financeiro` e `/menu`, todos entre 1,9 e 2,7 s.

## A-03 · [P0] A trilha GPS inteira é baixada para calcular uma distância

**Medição do tamanho.** `MAX_PONTOS_TRILHA = 4000` (`lib/domain/geo.ts:9`), formato `{t, la, lo}`. Construí uma trilha no teto no próprio banco e medi:

```
bytes_json_texto: 232.000   (227 kB)
bytes_por_ponto:  58,0
se_50_eventos:    11 MB
se_300_eventos:   66 MB
```

**Medição de uso.** Quatro consultas pedem a coluna `trilha`:

| Arquivo:linha | Escopo | Teto |
|---|---|---|
| `app/(app)/hoje/page.tsx:253` | **todas as saídas do ano corrente** | **nenhum** |
| `app/(app)/diario/page.tsx:52` | eventos do diário | 300 |
| `app/(app)/barco/resumos/page.tsx:104` | saídas do ano (aba "ano") | **nenhum** |
| `app/(app)/navegar/viagem/nova/page.tsx:21` | uma viagem | 1 (legítimo) |

Para que serve o dado baixado:

- `lib/domain/resumo-ano.ts:41-43` → `milhasNm += resumoTrilha(e.trilha).distanciaNm` — **um float por evento**.
- `app/(app)/diario/page.tsx:178-179` → o mesmo, para desenhar o chip "TRILHA 12,4 MN".

**A conta.** Barco que sai 3×/semana = 12 saídas/mês. Em dezembro: 144 saídas × 227 kB = **32,7 MB baixados a cada abertura de `/hoje`**, para exibir um número. `/diario` pode chegar a 66 MB. E `barco/resumos/page.tsx:98` ainda faz `select("*")` na mesma tabela, o que traz `trilha` **e** `checklist` junto.

**O conserto já está meio feito e ninguém ligou os fios.**

1. A tabela `eventos` **já tem a coluna `tem_trilha boolean`** (confirmado no `information_schema`). Ela não é usada em consulta nenhuma — só aparece em `lib/db/types.ts:249` e em dois arquivos de teste.
2. `lib/acoes/trilha.ts:55` **já chama `resumoTrilha(validos)` na hora de gravar** — e joga os números fora, guardando apenas uma frase de texto em `descricao`. O mesmo em `lib/acoes/importar-gpx.ts`.

**Correção.** Persistir `distancia_nm` (e `duracao_h`) no `insert` que já calcula os dois, trocar `trilha` por `tem_trilha, distancia_nm` nas três consultas de lista, e manter `trilha` só em `/diario/[id]` e `/navegar/viagem/[id]`, que de fato desenham o traçado. É a correção de melhor retorno financeiro do documento (ver Frente 2).

## A-04 · [P1] Três idas ao servidor de autenticação por navegação, e uma consulta duplicada que o comentário diz ter sido eliminada

**Medição.** `auth.getUser()` **não lê cookie — faz uma ida à rede** até o GoTrue. Medido daqui: **90 ms** de ida-e-volta (mediana, conexão reusada). Em `/hoje`, ele é chamado três vezes:

1. `web/middleware.ts:88`
2. `lib/consultas.ts:98` (dentro do `carregarPainel`)
3. `app/(app)/hoje/page.tsx:229`

`pg_stat_statements` mostra **27.098 chamadas** ao `SELECT users.…` do GoTrue neste banco.

`auth.getUser()` aparece em **62 arquivos** e nenhum deles está embrulhado em `cache()` do React — `carregarPainel` está, mas as chamadas cruas fora dele não se beneficiam disso.

**A duplicata.** `lib/consultas.ts:139` já busca `profiles(nome, avatar_path)` do usuário logado, e o comentário nas linhas 56-60 explica que trazer isso para dentro do `carregarPainel` serviria justamente para **"ELIMINAR a repetida"** em `/hoje` e `/menu/ajustes`. Só que `app/(app)/hoje/page.tsx:167` desestrutura o painel sem `perfil`:

```ts
const { embarcacao, equipamentos, itens, papel, permissoes } = painel   // :167 — sem `perfil`
…
const { data: perfil } = await supabase
  .from("profiles").select("nome, avatar_path").eq("id", user?.id ?? "").maybeSingle()   // :230
```

**A consulta continua sendo feita duas vezes, e o comentário afirma que não.** Escrita que mente sobre o código — exatamente o que a onda 98 foi caçar.

**Correção.** Usar `painel.perfil` em `/hoje` (apaga a linha 230 e a 229 junto). Para o resto: `getClaims()` verifica o JWT localmente com a chave assimétrica, sem ida à rede, e é a recomendação atual do Supabase para o caminho quente — o `getUser()` fica onde a validação no servidor for realmente necessária.

## A-05 · [P2] `createSignedUrl` uma a uma onde já existe a versão em lote

O app **tem** a chamada em lote e a usa em dois lugares — `app/(app)/barco/fotos/page.tsx:54` e `app/(app)/patio/page.tsx:143` usam `createSignedUrls` (plural). Nos outros, faz uma por arquivo:

| Arquivo:linha | Quantas |
|---|---|
| `app/(app)/diario/page.tsx:80` | até 300 |
| `app/(app)/hoje/page.tsx:361` | 5 (limitado) |
| `app/(app)/tripulacao/page.tsx:153` | tamanho da tripulação |
| `app/(app)/carteira/[id]/page.tsx:79` | movimentos com comprovante |
| `app/(app)/barco/equipamento/[id]/page.tsx:151` e `:168` | documentos + eventos |

**Atenuante honesto:** todas estão dentro de `Promise.all`, então o custo de relógio é uma ida-e-volta, não N. O que se paga são N conexões e N respostas — relevante no `/diario`, onde o teto é 300.

**Validade das URLs assinadas: 3600 s (1 h) em todas as 16 ocorrências.** Está certo. Não há nenhuma validade longa demais.

## A-06 · [P2] Praticamente não há streaming: a tela inteira espera a consulta mais lenta

**Medição.** `<Suspense>` aparece **2 vezes** em todo o app (`app/(app)/hoje/page.tsx:777` e `app/(app)/layout.tsx:79`), para **128 páginas**. Existem 11 `loading.tsx` — que dão o esqueleto durante a navegação, o que é bom — mas dentro da página não há fronteira nenhuma: o cartão do topo só aparece quando a consulta de ocorrências, a de notificações e a da tripulação já voltaram.

Com A-02 corrigido isso perde muito da urgência (a espera vira uma onda, não catorze). Fica registrado como o passo seguinte, não como emergência.

## A-07 · [P2] Imagens sem otimização nenhuma

**Medição.** `next/image` é usado **zero vezes**. Todas as imagens são `<img>` cru.

Atenuante real: todas as `<img>` que encontrei têm dimensão fixada por CSS (`aspect-square w-full`, `h-44 w-full`, `h-20 flex-1`), então **CLS não é o problema**. O problema é banda: a foto que o dono subiu do celular é servida no tamanho original, para todo mundo, em qualquer tela. A cota é de 500 MB por barco — o teto do que pode ser servido cru é alto.

## A-08 · [P3] 2,5 MB de prints de referência de design estão publicados na internet

**Medição.** `web/public/imagens/` tem seis PNG chamados `Captura de tela 2026-08-15 …`, de 316 a 497 kB, somando ~2,5 MB. No código eles aparecem **só em comentários** (`components/ui/abas.tsx:18`, `components/ui/faixa-kpi.tsx:6`) — nenhuma tela os serve.

Mas estão no deploy e são públicos:

```
HEAD https://commander-tau.vercel.app/imagens/Captura%20de%20tela%202026-08-15%20115818.png
→ HTTP 200 — content-length=509318 — content-type=image/png
```

Peso morto no deploy e material interno de design acessível por quem souber o nome. Mover para `docs/` resolve.

## O que está bom — e é bom de verdade

- **`mapbox-gl` é carregado sob demanda.** O maior chunk do build tem **1,78 MB** e contém o Mapbox; ele só desce nas telas de mapa, porque os quatro componentes usam `import("mapbox-gl")` dinâmico (`navegar-mapa.tsx:867`, `mapa-nautico.tsx:357`, `explorar-mapa.tsx:114`, `escolher-ponto.tsx:25`). Medido: `/hoje` carrega **414 kB em 20 recursos**. Isso está certo.
- **As fontes são auto-hospedadas.** Medido: todos os `.woff2` vêm de `commander-tau.vercel.app/_next/static/immutable/media/`. O `next/font` baixa no build — não há origem externa de fonte (relevante para a CSP, ver C-02).
- **A RLS não tem o defeito de initplan.** As 261 policies do schema `public` usam `(select auth.uid())`; **zero** usam `auth.uid()` cru. O advisor de performance concorda (não emitiu `auth_rls_initplan`). As funções auxiliares (`pode_ver_embarcacao`, `eh_prop`, `tem_papel_admin`) são `STABLE SECURITY DEFINER` com `search_path` fixo — está do jeito certo.
- **A batimetria não precisa mudar de formato.** `public/mapa/` inteiro soma ~196 kB (74+43+32+22+19+6). Trocar PNG por outra coisa aqui é otimizar 0,2 MB enquanto 32 MB de trilha passam ao lado. **Isto é ruído — está registrado como ruído na Frente 6.**
- **`carregarPainel` está correto** depois da onda 96: três ondas, com o raciocínio escrito. O defeito não está nele; está em quem o chama.
- **`/api/corredores`** valida sessão, aplica rate limit por usuário e limita a 5.000 linhas. É o handler mais bem-feito do conjunto.

---

# Frente 2 — Custo e teto de escala

## Premissas (todas medidas ou lidas no código)

| Premissa | Origem |
|---|---|
| Trilha no teto = **227 kB** (4.000 pontos × 58 B) | medido no banco |
| 12 saídas/mês por barco ativo | premissa de uso — sai 3×/semana |
| ~100 aberturas de tela/mês por barco | premissa de uso |
| Cota de fotos = **500 MB/barco** | `lib/domain/cota.ts:5` (`COTA_MB = 500`) |
| Uso realista de fotos = 50 MB/barco | premissa conservadora (10% da cota) |
| Payload por tela = **100–118 kB** | medido em produção |
| Preço do plano = **R$ 49,90** (Commander) / R$ 69,90 (Pro) | `lib/domain/planos.ts:138,155` |

## Onde cada fornecedor estoura

### Supabase — banco de dados

**Cotas verificadas hoje em `supabase.com/pricing`:** Free = 500 MB · Pro (US$ 25/mês) = 8 GB + **US$ 0,125/GB** · egress overage **US$ 0,09/GB** · storage overage **US$ 0,0213/GB**.

**Estado atual medido:** banco inteiro **19 MB**, tabelas do `public` somando **4,88 MB**, **382 linhas**, 87 tabelas, 261 policies.

Trilha por barco: 12 saídas/mês × 12 meses × ~100 kB (comprimido no TOAST) ≈ 14 MB/ano. Com o resto, **~15 MB por barco por ano**.

| Barcos | Banco/ano | Free (500 MB) | Pro (8 GB) | Custo do excedente |
|---|---|---|---|---|
| 100 | 1,5 GB | **estoura** | dentro | US$ 0 |
| 1.000 | 15 GB | estoura | estoura | 7 GB × 0,125 = **US$ 0,88/mês** |
| 10.000 | 150 GB | estoura | estoura | 142 GB × 0,125 = **US$ 17,75/mês** |

**O Free estoura em ~32 barcos-ano.** Depois disso, o tamanho do banco é irrelevante como custo.

### Supabase — storage de fotos

Free = 1 GB · Pro = 100 GB incluídos.

| Barcos | A 50 MB/barco | Free (1 GB) | Pro (100 GB) | Excedente |
|---|---|---|---|---|
| 100 | 5 GB | estoura | dentro | US$ 0 |
| 1.000 | 50 GB | estoura | dentro | US$ 0 |
| 10.000 | 500 GB | estoura | estoura | 400 GB × 0,0213 = **US$ 8,52/mês** |
| 10.000 na cota cheia | 5 TB | — | estoura | 4.900 GB × 0,0213 = **US$ 104/mês** |

O Free comporta **20 barcos** a 50 MB — ou **2 barcos** se encherem a cota de 500 MB. Storage é barato; não é o driver.

### Supabase — egress ← **este é o driver**

Free = 5 GB/mês · Pro = 250 GB/mês + US$ 0,09/GB.

**Como está hoje**, com `trilha` nas consultas de lista. Em dezembro, `/hoje` baixa 144 saídas × 227 kB = 32,7 MB. Na média do ano, ~16 MB por abertura × 100 aberturas = **1,6 GB por barco por mês** — e isso é **só o `/hoje`**; `/diario` e `/barco/resumos` somam por cima.

| Barcos | Egress/mês | Free (5 GB) | Pro (250 GB) | Custo do excedente |
|---|---|---|---|---|
| 100 | 160 GB | estoura 32× | dentro | US$ 0 |
| 1.000 | 1,6 TB | estoura | estoura | 1.350 GB × 0,09 = **US$ 121/mês** |
| 10.000 | 16 TB | estoura | estoura | 15.750 GB × 0,09 = **US$ 1.417/mês** |

**Depois da correção A-03** (`tem_trilha` + `distancia_nm` persistida), a mesma tela cai de ~16 MB para ~50 kB. Somando o app inteiro, ~20 MB por barco por mês:

| Barcos | Egress/mês corrigido | Custo |
|---|---|---|
| 100 | 2 GB | US$ 0 |
| 1.000 | 20 GB | US$ 0 |
| 10.000 | 200 GB | **US$ 0** — cabe nos 250 GB do Pro |

> **A escolha entre duas colunas vale US$ 1.417/mês a 10.000 barcos.** É a conta mais importante deste documento.

### Vercel

**Cotas verificadas hoje:** Hobby = 100 GB de transferência, 1M invocações, **360 GB-hrs** de memória provisionada, 4 CPU-hrs · Pro US$ 20/mês, transferência US$ 0,15/GB acima de 1 TB, invocações **US$ 0,60/1M**, memória **US$ 0,0106/GB-hr**.

Com os ~2 s de parede medidos hoje, cada requisição custa ≈ 0,00056 GB-hr.

| Barcos | Requisições/mês | GB-hrs | Transferência | Hobby | Custo no Pro |
|---|---|---|---|---|---|
| 100 | 10 mil | 5,6 | 1 GB | folgado | US$ 20 |
| 1.000 | 100 mil | 56 | 10 GB | folgado | US$ 20 |
| 10.000 | 1M | **560** | 100 GB | **estoura (360)** | 20 + 0,60 + 5,94 ≈ **US$ 27** |

**Com A-01 e A-02 corrigidos** (2 s → ~0,4 s), os 560 GB-hrs viram ~112 → US$ 1,19. **A Vercel não é cara. O problema do Hobby é jurídico, não econômico** (ver A-09).

### Mapbox

**Verificado hoje:** 50.000 map loads/mês grátis; depois **US$ 5,00/1k** (50–100k), **US$ 4,00/1k** (100–200k), **US$ 3,00/1k** (200k–1M). Definição confirmada na própria página: *"A map load is counted every time Mapbox GL JS initializes"* — **inicialização**, e a inicialização inclui tiles ilimitados.

O app tem **quatro pontos distintos que inicializam um mapa**: `navegar-mapa.tsx`, `mapa-nautico.tsx`, `explorar-mapa.tsx`, `escolher-ponto.tsx`. Navegar entre `/navegar` e `/explorar` desmonta e remonta — **conta de novo**. Premissa: 20 sessões de mapa/mês × 2 remontagens = 40 loads por barco.

| Barcos | Map loads/mês | Custo |
|---|---|---|
| 100 | 4.000 | US$ 0 |
| 1.000 | 40.000 | **US$ 0** — a 20% do teto grátis |
| 10.000 | 400.000 | 50k×5 + 100k×4 + 200k×3 = **US$ 1.250/mês** |

**O Mapbox é o segundo maior custo a 10.000 barcos**, e a mitigação é concreta: manter uma instância de mapa viva entre as navegações em vez de remontar. Cortar as remontagens pela metade corta ~US$ 400/mês. **A 1.000 barcos não custa nada** — não é problema de agora.

### Resend

**Verificado hoje:** Free = 3.000/mês **mas limitado a 100 por dia** · Pro US$ 20/mês (50.000) · US$ 35 (100.000) · Scale a partir de US$ 90.

O relatório mensal dispara **tudo no dia 1**, num pico. O teto diário de 100 do Free é o que quebra primeiro, não o mensal.

| Barcos | Relatório (pico dia 1) | + alertas (3/barco) | Plano |
|---|---|---|---|
| 100 | 100 | ~400/mês | Free **no limite exato do dia** |
| 1.000 | 1.000 | ~4.000/mês | **Free corta em 100** → Pro US$ 20 |
| 10.000 | 10.000 | ~40.000/mês | Pro US$ 20 (50k) |

### Asaas

**Não verificado** — o orçamento de busca da sessão acabou antes. O modelo é taxa fixa por cobrança (pix/boleto) mais percentual no cartão. Ordem de grandeza a 1.000 assinantes (R$ 49.900/mês de receita): **R$ 1.000 a 2.000/mês**. **Conferir a tabela vigente antes de fechar o preço** — a margem do plano de R$ 49,90 depende disso e nenhum documento do projeto registra a tabela.

### Sentry

Free cobre 5.000 erros/mês. Não custa nada nesta escala — e hoje não custa nada porque **não está ligado** (ver D-01).

## Custo total, por degrau

Câmbio de referência: US$ 1 ≈ R$ 5,40.

| | 100 barcos | 1.000 barcos | 10.000 barcos |
|---|---|---|---|
| Vercel Pro | US$ 20 | US$ 20 | US$ 27 |
| Supabase Pro | US$ 25 | US$ 25 | US$ 25 |
| — banco excedente | — | US$ 0,88 | US$ 17,75 |
| — storage excedente | — | — | US$ 8,52 |
| — **egress excedente (hoje)** | — | **US$ 121** | **US$ 1.417** |
| Mapbox | US$ 0 | US$ 0 | US$ 1.250 |
| Resend | US$ 0 | US$ 20 | US$ 20 |
| **Total/mês (hoje)** | **US$ 45** (R$ 243) | **US$ 187** (R$ 1.010) | **US$ 2.765** (R$ 14.930) |
| **Total/mês (com A-01+A-03)** | US$ 45 | **US$ 66** (R$ 356) | **US$ 1.348** (R$ 7.280) |
| Receita a R$ 49,90 | R$ 4.990 | R$ 49.900 | R$ 499.000 |
| **Infra como % da receita (hoje)** | 4,9% | 2,0% | 3,0% |
| **Infra como % (corrigido)** | 4,9% | **0,7%** | **1,5%** |

**Leitura:** a infraestrutura nunca ameaça a margem — nem no cenário ruim. O que a correção compra não é sobrevivência, é **US$ 1.400/mês** e a certeza de que a conta não escala mal com o sucesso. E a 100 barcos os planos pagos custam 4,9% da receita, o que é confortável.

## Onde cada um estoura, em uma linha

| Fornecedor | Primeiro teto | Quantos barcos aguenta |
|---|---|---|
| Supabase Free — storage | 1 GB | **2** (cota cheia) a **20** (uso realista) |
| Supabase Free — egress | 5 GB/mês | **~3** com a trilha na consulta |
| Supabase Free — banco | 500 MB | **~32 barcos-ano** |
| Supabase Pro — egress | 250 GB/mês | **~150** hoje · **~12.000** corrigido |
| Vercel Hobby — memória | 360 GB-hrs | ~6.400 hoje · ~32.000 corrigido |
| Vercel Hobby — uso comercial | **já violado** | **0** (ver A-09) |
| Mapbox | 50.000 loads/mês | **~1.250** |
| Resend Free | 100 e-mails/dia | **~100** |

---

# Frente 3 — Segurança de infraestrutura

## C-01 · [P1] Os três buckets aceitam qualquer arquivo, de qualquer tamanho

**Medição** (`storage.buckets`):

| Bucket | Público | `file_size_limit` | `allowed_mime_types` |
|---|---|---|---|
| `acervo` | não | **null** | **null** |
| `parceiros` | **sim** | **null** | **null** |
| `perfis` | **sim** | **null** | **null** |

**O aplicativo valida bem** — e isso merece registro:

| Caminho | Tipos | Tamanho |
|---|---|---|
| `lib/acervo.ts:3-9` | pdf, jpeg, png, webp | **10 MB**, recusa vazio |
| `lib/acoes/fotos.ts:41-49` | jpeg, png, webp | via `subirArquivo` + checagem de cota |
| `lib/acoes/perfil-comandante.ts:16-20,91-92` | jpeg, png, webp | **4 MB** |
| `lib/acoes/parceiro.ts:33,328-329` | jpeg, png, webp | + teto de contagem (3 / 12) |

**O buraco:** essas checagens moram nas Server Actions. A RLS de `storage.objects` (que está bem escrita — escopo por pasta, usa a matriz de permissão, `(select auth.uid())`) autoriza a **gravação**, mas não diz nada sobre **o quê**. Um usuário autenticado que chame a API REST do Storage direto, com a chave anon e o próprio cookie, grava o que quiser no caminho que já lhe pertence — inclusive um arquivo de 2 GB ou um executável. `file.type` também é metadado enviado pelo cliente: mesmo pela Server Action, ele é declarado, não verificado.

**Correção:** definir `file_size_limit` e `allowed_mime_types` em cada bucket. É a mesma regra, escrita onde ela não pode ser contornada. Uma linha por bucket.

## C-02 · [P1] A CSP dá para fechar hoje — duas das três objeções não valem mais

`web/next.config.ts:19-26` deixa a CSP de fora e explica por quê. Medi cada objeção:

| Objeção registrada | Medição | Veredito |
|---|---|---|
| "fontes do Google Fonts via `next/font`" | Todos os `.woff2` vêm de `commander-tau.vercel.app/_next/static/immutable/media/` | **não procede** — o `next/font` auto-hospeda no build |
| "o próprio Vercel Analytics" | `@vercel/analytics` **não está no `package.json`** | **não procede** |
| "websocket do Supabase Realtime" | Nenhum `.channel(` no código; `components/mensagens/atualizacao-viva.tsx:14` documenta a decisão de **não** usar Realtime | **não procede hoje** |
| "workers/blob do `mapbox-gl` + `rota.worker.ts`" | confirmado | **procede** — resolve-se com `worker-src 'self' blob:` |
| "tiles do Mapbox" | confirmado | **procede** — origens enumeráveis |

**Origens que o navegador realmente precisa** (levantadas do código, filtrando as que só o servidor chama):

```
default-src 'self';
connect-src 'self' https://khgjtxvmduizyooqaoox.supabase.co
            https://api.mapbox.com https://events.mapbox.com
            https://api.open-meteo.com https://marine-api.open-meteo.com;
img-src     'self' data: blob: https://khgjtxvmduizyooqaoox.supabase.co
            https://*.mapbox.com https://tiles.openseamap.org;
worker-src  'self' blob:;
font-src    'self';
style-src   'self' 'unsafe-inline';
frame-ancestors 'none';
```

`api.asaas.com` e `api.resend.com` **não entram** — são chamadas de servidor.

O único ponto que ainda pede cuidado é `script-src`: o Next.js injeta scripts inline e exige `'unsafe-inline'` ou nonce. **Caminho seguro e barato: publicar tudo isso como `Content-Security-Policy-Report-Only` primeiro**, olhar os relatórios por alguns dias com o mapa aberto, e só então promover. O que já está lá (`frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` com `geolocation=(self)`) está correto e bem justificado.

## C-03 · [P2] Segredos comparados com `!==` em vez de comparação de tempo constante

```
app/api/alertas/disparar/route.ts:41  → headers.get("authorization") !== `Bearer ${segredo}`
app/api/relatorio/mensal/route.ts:43  → idem
app/api/asaas/webhook/route.ts:148    → headers.get("asaas-access-token") !== segredo
```

`!==` retorna no primeiro byte diferente, o que em teoria vaza o segredo byte a byte por medição de tempo. Na prática, através da internet e com rate limit por IP em duas das três rotas, o ataque é impraticável. **É um item de higiene, não um risco vivo** — `crypto.timingSafeEqual` resolve em uma linha. Registrado para não voltar como novidade.

## C-04 · [P2] A chave `service_role` está também no ambiente de Preview

**Medido** (`vercel env ls production`):

```
SUPABASE_SERVICE_ROLE_KEY   Sensitive   Preview, Production
```

Todas as outras variáveis são só `Production`. A chave que **ignora a RLS inteira** é a única que também vale em Preview — e Preview é onde rodam os deploys de teste, contra o **mesmo banco de produção**. É o mecanismo por trás dos registros órfãos documentados em D-04.

## C-05 · Advisors do Supabase — o que dizem, e o que importa

**Segurança: 63 avisos, nenhum ERROR.**

| Aviso | Qtd. | Leitura |
|---|---|---|
| `authenticated_security_definer_function_executable` | 58 | Funções `SECURITY DEFINER` chamáveis por usuário logado via `/rest/v1/rpc/`. São as funções internas da RLS (`pode_ver_embarcacao`, `eh_prop`, `permissao`…). Elas **checam permissão por dentro** — expor não é o mesmo que vazar. Vale revogar o `EXECUTE` do `authenticated` nas que nenhuma tela chama diretamente. |
| `anon_security_definer_function_executable` | **4** | **Estas merecem olhar.** Chamáveis **sem login**: `conversa_minha`, `conversa_par_valido`, `conversa_tocar`, **`info_convite_cotista(p_codigo text)`**. A última recebe um código e devolve informação de convite — é a superfície mais exposta do banco, e um código curto seria enumerável por força bruta sem sessão. Confirmar o formato do código e se há limite de tentativa. |
| `auth_leaked_password_protection` | 1 | Checagem contra o HaveIBeenPwned está **desligada**. Ligar é uma chave no painel. |

**Desempenho: 139 avisos, nenhum ERROR.**

| Aviso | Qtd. | Leitura |
|---|---|---|
| `unindexed_foreign_keys` | **77** | Chaves estrangeiras sem índice em 47 tabelas (`demandas` ×5, `interesses_marketplace` ×4, `movimentos_patio` ×4…). Com 382 linhas não custa nada. **A 10.000 barcos, cada `DELETE` na tabela-pai varre a tabela-filha inteira.** Não é urgente; é inevitável. |
| `unused_index` | 47 | Índices nunca usados. Não dá para concluir nada com o banco vazio — **reavaliar com tráfego real**, não agora. |
| `multiple_permissive_policies` | 15 | `embarcacoes` tem **3 policies de SELECT** para `authenticated`, avaliadas e combinadas com OR a cada linha. Idem `profiles`, `vinculos`, `parceiros`, `assinaturas`, `carteira_movimentos`, `connect_interesses`. Consolidar em uma policy por tabela/ação corta trabalho por linha. |

## C-06 · Configuração do Postgres — os tetos que vêm do plano Free

| Parâmetro | Valor | Consequência |
|---|---|---|
| `max_connections` | **60** | Teto duro da instância Free. Como o acesso é via PostgREST (HTTP, pooled), não é o gargalo hoje — mas é o número a lembrar ao introduzir qualquer acesso direto ao Postgres. |
| `statement_timeout` (`authenticated`) | 8 s | Corta consulta longa. **Uma resposta de 66 MB do `/diario` provavelmente bate nisso** antes de chegar ao fim. |
| `statement_timeout` (`anon`) | 3 s | Correto. |
| `statement_timeout` (`service_role`) | **nenhum** (cai no global de 120 s) | As rotas de cron rodam sem limite de consulta. |
| `work_mem` | 2.184 kB | Pequeno. Ordenação grande vai a disco. |

## C-07 · [P2] Não existe teto de linhas em resposta nenhuma

**Medição decisiva.** Inspecionei o SQL que o PostgREST gera, capturado no `pg_stat_statements`. Ele termina em:

```
… FROM ( SELECT * FROM pgrst_source ) _postgrest_t
```

**Sem `LIMIT`.** Ou seja, `db.max_rows` não está definido neste projeto.

Dois lados:

- **Bom:** os dois crons, que leem tabelas inteiras, **não estão sendo truncados em silêncio**. Isso era o risco pior e não se confirmou.
- **Ruim:** não há teto nenhum. Qualquer usuário autenticado pode pedir à API REST todas as linhas que a RLS lhe permitir, de qualquer tabela, sem limite — a única barreira é o `statement_timeout` de 8 s.

**Correção, na ordem certa:** primeiro paginar os dois crons (D-05), **depois** definir `db.max_rows` (1.000 é o padrão de mercado). Fazer na ordem inversa quebra os crons.

## O que está bom

- **As quatro rotas de API se defendem sozinhas**, como o comentário do `middleware.ts:94-97` exige:

| Rota | Defesa |
|---|---|
| `/api/alertas/disparar` | rate limit por IP **antes** do Bearer (mitiga força-bruta no segredo, não só custo) + `Bearer ALERTAS_SEGREDO` |
| `/api/relatorio/mensal` | `Bearer ALERTAS_SEGREDO` |
| `/api/asaas/webhook` | header `asaas-access-token` |
| `/api/corredores` | sessão Supabase + rate limit por **usuário** + bbox validado + teto de 5.000 linhas |

- **`.env.local` não está versionado** (`web/.gitignore:34` → `.env*`; `git ls-files` confirma ausência).
- **A `service_role` nunca vaza para o cliente.** Só aparece em `app/api/**` e no `e2e/global-setup.ts`. Varri o bundle servido em produção: a URL do Supabase e o JWT anon estão lá (correto e esperado), **o DSN do Sentry e a chave do PostHog não estão** — e nenhum segredo de servidor está.
- **Nenhum handler com `Access-Control-Allow-Origin: *`.**
- **URLs assinadas com 1 hora** em todas as 16 ocorrências. Nenhuma validade excessiva.
- **A RLS do `storage.objects`** é por pasta e reaproveita a matriz de permissão — não é uma regra paralela que pode divergir da das telas.

---

# Frente 4 — Confiabilidade

## D-01 · [P0] O app está em produção sem observabilidade nenhuma — confirmado por dois caminhos

O fechamento de 19/08 registrou que as variáveis da Vercel não puderam ser verificadas ("sem acesso à Vercel nesta sessão"). **Eu consegui verificar.** O CLI estava autenticado no time `smu-prods-projects`.

**`vercel env ls production` — as oito variáveis que existem:**

```
SUPABASE_SERVICE_ROLE_KEY       Preview, Production
NEXT_PUBLIC_APP_URL             Production
NEXT_PUBLIC_MAPBOX_TOKEN        Production
ALERTAS_SEGREDO                 Production
VAPID_PRIVATE_KEY               Production
NEXT_PUBLIC_VAPID_PUBLIC_KEY    Production
NEXT_PUBLIC_SUPABASE_ANON_KEY   Production
NEXT_PUBLIC_SUPABASE_URL        Production
```

**O que NÃO está lá, e o que cada ausência causa:**

| Ausente | Consequência, com o arquivo que a produz |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | **Nenhum erro é reportado.** O SDK só inicializa com DSN. Confirmado independentemente: varri os 18 chunks servidos em produção — **nenhum DSN**, e `window.__SENTRY__` é `undefined`. |
| `NEXT_PUBLIC_POSTHOG_KEY` | **Nenhum evento de produto é coletado.** Confirmado do mesmo jeito: sem `phc_…` no bundle, `window.posthog` inativo. |
| `RESEND_API_KEY` | `app/api/relatorio/mensal/route.ts:51-55` **devolve 500 e não roda**. Em `alertas/disparar`, o `if (process.env.RESEND_API_KEY)` da linha 170 é falso — o push sai, o e-mail não. |
| `ASAAS_API_KEY`, `ASAAS_AMBIENTE`, `ASAAS_WEBHOOK_TOKEN` | **A cobrança não existe.** `app/api/asaas/webhook/route.ts:147-149` devolve **401 a toda chamada do Asaas**, porque `segredo` é `undefined`. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sem upload de source map — se o Sentry for ligado, as pilhas virão ilegíveis. |

Isto fecha o achado **A-01** do documento de fechamento, que estava marcado como "não verificado".

**A consequência prática:** o app roda cego. Se `/hoje` estourar em 504 amanhã, como estourou hoje de manhã, **não haverá registro nenhum** — a descoberta virá pelo dono abrindo o app, que foi exatamente como o defeito da onda 96 foi descoberto.

> Ao ligar a Resend, corrigir junto o remetente: `app/api/alertas/disparar/route.ts:184` e `app/api/relatorio/mensal/route.ts:144` mandavam de `Commander <onboarding@resend.dev>`, o remetente de sandbox, que **só entrega para o e-mail do dono da conta Resend**. Já registrado em `2026-08-19-auth-e-email.md:272`.
>
> **Ressalva de simultaneidade:** enquanto esta auditoria rodava, outra sessão estava corrigindo exatamente isto — `web/lib/email.ts` apareceu novo na árvore e `relatorio/mensal/route.ts` ganhou `remetenteDeEmail()` com recusa alta se `RESEND_FROM` não estiver configurado. **O item está sendo resolvido; confira o estado final antes de agir sobre ele.** O que não muda: a variável `RESEND_API_KEY` continua ausente do ambiente de produção, e agora `RESEND_FROM` também será necessária.

## D-02 · [P0] O Hobby já está sendo violado — o gatilho não é ligar o Asaas

O risco era conhecido. O que muda é **quando**.

**Texto literal das Fair Use Guidelines da Vercel** (verificado hoje):

> **Hobby teams** are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan.

> Commercial usage is defined as any Deployment that is used for the purpose of financial gain of **anyone** involved in **any part of the production** of the project […] Examples of this include, but are not limited to, the following:
> - Any method of requesting or processing payment from visitors of the site
> - **Advertising the sale of a product or service**

**Medição.** A landing pública, hoje:

```
GET https://commander-tau.vercel.app/  → HTTP 200
preços encontrados no HTML: R$ 49,90 · R$ 69,90
termos: "/mês", "assinar", "plano", "grátis"
```

**"Advertising the sale of a product or service" já está acontecendo.** A auditoria de 18/08 dizia "no momento em que o Asaas for ligado". Pela definição da própria Vercel, o segundo critério já foi atingido — sem que nenhum centavo tenha sido processado.

**Nota sobre o plano:** o time é `smu-prods-projects`, nome gerado pelo padrão de conta pessoal ("smu-prod's projects"), e as auditorias anteriores registram Hobby. Não consegui ler o plano cobrado pela API (o arquivo de token do CLI não estava no caminho esperado). **Confirmar em Settings → Billing leva dez segundos** — e se já for Pro, este item cai inteiro e vira ruído.

## D-03 · [P1] Backup: o procedimento existe, a execução não

`docs/OPERACAO.md:955-984` documenta a política e o procedimento, com todas as letras:

> **Política real no plano Free (hoje): nenhum backup automático.** O free tier NÃO inclui snapshot diário nem Point-in-Time Recovery (PITR) — se o banco corromper ou alguém rodar um `DELETE`/`UPDATE` sem `WHERE`, não existe "desfazer" pelo painel Supabase.

O passo a passo do `pg_dump --format=custom` está lá, com a instrução de guardar fora da máquina e o caminho de restore.

**Confirmado hoje:** a organização é **`SMU-FREE`, plano `free`** (API do Supabase). Não há automação nenhuma nos workflows do GitHub — os três (`ci.yml`, `alertas.yml`, `relatorio.yml`) não tocam em backup. **Não encontrei evidência de uma única execução.** A auditoria de 18/08 disse a frase certa e ela continua valendo: *um runbook que depende de alguém lembrar toda semana não é um backup; é uma intenção.*

**Preços verificados hoje:** Supabase Pro US$ 25/mês inclui backup diário; **PITR é add-on de US$ 100/mês por 7 dias de retenção**. Ou seja: o backup diário sai por US$ 25; o "desfazer para qualquer segundo" custa quatro vezes o plano. Para 100 barcos, o diário do Pro basta.

## D-04 · [P1] O e2e continua escrevendo no banco de produção, e o rastro cresce

**Medição de hoje:**

```
usuarios_total:            6
usuarios_e2e_restantes:    1
embarcacoes_total:         9
barcos_de_teste_orfaos:    6      ← nome = 'Barco de Teste'
embarcacoes_sem_vinculo:   6
```

**Dois terços da tabela `embarcacoes` de produção são resíduo de teste.** O `global-teardown` não está limpando as embarcações — só o usuário (a cascata em `vinculos` não alcança a embarcação semeada por `service_role` em `e2e/global-setup.ts`).

E o volume histórico, no `pg_stat_statements`:

| Operação | Chamadas |
|---|---|
| `INSERT INTO users` | **203** |
| `DELETE FROM users` | **191** |
| `DELETE FROM embarcacoes` | 123 |

A auditoria de 18/08 mediu 185/175. **Hoje são 203/191** — está ativo e crescendo. E o `global-setup.ts:41` documenta a razão com honestidade: *"o Commander não tem banco de staging separado (mesmo projeto Supabase de produção)"*.

Combinado com C-04 (a `service_role` também vale em Preview), este é o risco de dado mais concreto do documento: testes automatizados criando e apagando registros num banco **sem backup**, que em breve terá clientes pagantes.

## D-05 · [P1] Os dois crons carregam a plataforma inteira em memória, numa função de 60 s

**`app/api/relatorio/mensal/route.ts:66-73`** carrega **todas** as embarcações (`select("*")`), todos os eventos do mês, todos os `itens_monitorados`, todos os `equipamentos` e todos os vínculos PROP. Depois, nas linhas 96-123:

```ts
for (const emb of embarcacoes) {
  eventos.filter((e) => e.embarcacao_id === emb.id)        // varredura completa
  itens.filter((i) => i.embarcacao_id === emb.id)          // varredura completa
  equipamentos.filter((eq) => eq.embarcacao_id === emb.id) // varredura completa
}
```

Isso é **O(barcos × eventos)**. A 10.000 barcos com 50 eventos/mês cada (500.000 eventos), são **5 bilhões de comparações** — dentro de uma função com `maxDuration = 60`. Não termina.

**`app/api/alertas/disparar/route.ts:59-69`** faz o mesmo, e tem mais dois pontos:

- Linha 126: um `INSERT` em `alertas_enviados` **por alerta, em série**, dentro de um `for` (linha 198). N+1 de escrita.
- Linhas 224-226: `Promise.allSettled` sobre `boletimDoMar` para **todas** as embarcações com marina de uma vez. A 10.000 barcos são 10.000 chamadas simultâneas à API de tempo — que vai limitar ou recusar.

**Atenuante honesto:** os envios (push + e-mail) **já foram consertados** — `emLotes(…, TAMANHO_LOTE = 10)` com `Promise.allSettled`, e o comentário nas linhas 125-130 do relatório mostra que a conta foi feita. **O envio está certo; a leitura e a agregação não.**

**Correção:** paginar por embarcação (`.range()`) ou agrupar por chave em vez de `filter` em laço, e inserir os alertas em lote. A 100 barcos nada disso dói; a 1.000 já dói.

## D-06 · Rate limit em memória — vale trocar? Ainda não

`lib/seguranca/limitador.ts` é honesto sobre si mesmo, e o comentário no topo já diz tudo: *"em ambiente serverless cada invocação PODE cair numa instância de função diferente […] Isso é **mitigação, não muralha**"*.

Cobre duas rotas: `/api/alertas/disparar` (5 por 5 min, por IP) e `/api/corredores` (60 por min, por usuário).

**Minha leitura: não troque agora.** O que essas duas rotas protegem é (a) um segredo Bearer que só o GitHub Actions conhece e (b) uma consulta de leitura já limitada a 5.000 linhas. O dano de um ataque distribuído aqui é custo de função, e o custo de função medido é irrisório. **Trocar por um contador no banco introduz uma escrita no caminho quente de uma rota de leitura** — piora o que a Frente 1 está tentando consertar. Um `INSERT`/`UPDATE` no Postgres a cada chamada de `/api/corredores`, atravessando o mesmo Atlântico, é remédio pior que a doença.

**Reavaliar quando** existir um endpoint público, sem sessão, que custe dinheiro por chamada. Hoje não existe.

## D-07 · O que acontece quando cada fornecedor cai

| Fornecedor | Comportamento hoje | Avaliação |
|---|---|---|
| **Supabase** | O app inteiro para. Consultas lançam `throw new Error("Não foi possível carregar…")`, capturado por **um único `error.tsx`** em 128 páginas. | Não há degradação possível — é o banco. Mas com um `error.tsx` só, a mensagem será genérica em toda tela. |
| **Mapbox** | Degrada com aviso; a trilha continua funcionando (`.env.example` documenta isso, e `mapa-nautico.tsx:357` tem `.catch`). | **Correto.** |
| **Open-Meteo** | `alertas/disparar:229` — falha na API do tempo não derruba o resto do disparo; `lib/acoes/trilha.ts:70-71` grava `null` e segue. | **Correto e bem comentado.** |
| **Asaas** | Webhook devolve erro; o Asaas reenvia. O `trigger` de `problema_desde` e o `avaliarCiclo` decidem por data, **sem depender de job** — o acesso não trava por webhook perdido. | **Bem desenhado.** Hoje é acadêmico: a integração não está ligada. |
| **Resend** | Best-effort nos dois crons (`try/catch` que segue para o próximo). | **Correto.** |

O desenho de falha é bom. O que falta é **saber que a falha aconteceu** — ver D-01.

---

# Frente 5 — Testes e esteira

## Medição

```
Test Files  118 passed (118)
     Tests  1904 passed (1904)
  Duration  37,60s
```

Tudo verde. Distribuição: **91 arquivos em `lib/`, 27 em `components/`**.

## E-01 · [P1] O `app/` inteiro está fora do alcance da suíte

`web/vitest.config.mts`:

```ts
test: { include: ["lib/**/*.test.ts", "components/**/*.test.ts"] }
```

**Nada em `app/` é testado.** Isso inclui:

- as **128 páginas**;
- as **4 rotas de API** — entre elas o **webhook do Asaas**, que é o caminho do dinheiro, e o `alertas/disparar`, que é a razão de o produto existir.

O webhook tem lógica de verdade e não trivial: um mapa de 12 eventos do gateway para 3 estados internos, tratamento de estorno e chargeback (adicionado na onda 83 justamente porque o buraco anterior deixava quem pediu estorno com acesso pago), carimbo de evento e idempotência. **Zero teste.**

O `middleware.ts` também não é coberto — mas aqui a ausência é **deliberada e bem resolvida**: a regra foi extraída para `lib/seguranca/rotas-publicas.ts`, que é função pura, testada, e cujo comentário de topo explica exatamente por que ela mora ali. **Isso é o padrão certo** — e é o padrão que as rotas de API não seguem.

## E-02 · [P1] 44 das 47 Server Actions não têm teste

`lib/acoes/` tem 47 arquivos; **3** têm `.test.ts` ao lado. Sem teste, entre outras: `assinatura.ts`, `carteira.ts`, `financeiro.ts`, `cotistas.ts`, `gold.ts`, `marketplace.ts`, `transferencia.ts`, `documentos.ts`, `fotos.ts`, `trilha.ts`.

**A nuance que importa:** os 1.904 testes se concentram em `lib/domain/**` — as funções puras onde moram as regras (semáforo, ciclo de assinatura, permissões, rota, marketplace, cota). **Isso é a decisão certa** e é por isso que o app é confiável naquilo que calcula. O que não é coberto é o **caminho de escrita**: validação de entrada, ordem das operações, rollback quando o `insert` seguinte falha. `lib/acoes/documentos.ts:96-105` faz rollback de arquivo no Storage quando o `insert` é recusado — comportamento delicado, sem nenhum teste.

**O que é caro se quebrar, em ordem:** o webhook do Asaas (dinheiro), `lib/acoes/assinatura.ts` (acesso), `lib/acoes/carteira.ts` e `transferencia.ts` (dinheiro entre pessoas), `alertas/disparar` (a promessa do produto).

## E-03 · A CI pega o que interessa? Quase

`.github/workflows/ci.yml`, job `verificar`: `npm ci` → `tsc --noEmit` → `eslint` → `npm test` → `npm run build`. **Está bom** — tipo, lint, teste e build, com Node 22 e cache.

Job `e2e`: `continue-on-error: true`, deliberado e documentado ("no começo é normal ter flakiness […] isso não pode travar merge, mas PRECISA rodar e aparecer no Checks do PR"). São **7 specs** (não 5): `landing`, `login`, `navegar-mapa`, `parceiros`, `protected-redirect`, `sem-saida`, `varredura-mobile`.

Sem `SUPABASE_SERVICE_ROLE_KEY` nos secrets do repositório, o `global-setup.ts:60-64` não cria sessão e os specs autenticados pulam **com motivo explícito** — nunca um vermelho confuso. Isso é bem feito.

**A tensão que ninguém resolveu:** cadastrar o segredo faz o e2e rodar de verdade — e escrever no banco de produção (D-04). Hoje ele não roda na CI, e roda localmente contra produção. **A saída não é escolher entre os dois males: é um projeto Supabase separado para preview, mesmo no Free.** É a mesma recomendação de 18/08, e continua sendo a certa.

**O que a CI não pega:** nada mede desempenho. O defeito da onda 96 — uma volta de rede a mais em toda navegação — passaria por `tsc`, `eslint`, 1.904 testes e `build` sem levantar uma sobrancelha. Um teste que afirme "`/hoje` responde em menos de X ms" ou que conte idas ao banco por render é o que faltou.

---

# Frente 6 — Decisões de arquitetura que vale reabrir

## F-01 · PWA → Capacitor: o caminho se sustenta. Não mexa

`docs/APP-NATIVO.md` documenta a decisão e o shell existe (`web/android`, `web/ios`, `capacitor.config.ts`, `@capacitor/geolocation`). O app nunca foi à loja.

**Sustenta-se, e por um motivo medido:** o app é 100% Server Components com dado que vem do servidor a cada navegação. O gargalo (Frente 1) é servidor e rede, **não a camada de apresentação**. Trocar a casca não move um milissegundo. Reescrever em nativo moveria tudo e não resolveria nada.

**O que muda a conta a favor do Capacitor** é justamente o que já está lá: `@capacitor/geolocation` para GPS em segundo plano — que um PWA não entrega no iOS. Para um app náutico, é o argumento inteiro.

**Não proponho reescrita.** Proponho que a ida à loja espere as correções da Frente 1: um app que leva 2,5 s por tela recebe avaliação ruim na primeira semana, e avaliação ruim de lançamento não se apaga.

## F-02 · Vale um cache? Sim, mas o de graça primeiro

Antes de qualquer camada de cache: **A-01 (região) e A-02 (paralelismo) devolvem mais, custam menos e não introduzem invalidação.** Cache é a resposta certa para dado caro de calcular; aqui o dado custa 0,5 ms para calcular e 150 ms para viajar. **Mover o app para perto do banco é mais barato que memorizar a viagem.**

Depois disso, o candidato óbvio e sem risco: `taxonomia` (63 linhas, 557 varreduras sequenciais, **zero uso de índice**), `motor_modelos` (23 linhas), `motor_componentes` (144 linhas), `assinatura_parametros`, `gold_precos`, `publicidade_produtos`. São tabelas de referência que quase nunca mudam e são lidas em toda tela. Um `"use cache"` com `cacheLife` de horas resolve — e o Next 16 já traz isso.

## F-03 · Fila para push e e-mail? Ainda não

Os disparos já estão em lotes concorrentes (`emLotes`, `Promise.allSettled`) e o cálculo do tempo está escrito no código. Uma fila resolve **entrega garantida com retentativa**, que é problema diferente do que existe hoje.

O que dói primeiro não é o envio, é a **leitura e a agregação** (D-05). Corrija a agregação; a fila entra quando o disparo de 10.000 e-mails não couber em 60 s — e a essa altura o Vercel Workflow ou uma fila do Supabase entram sem drama.

## F-04 · Manter o mapa vivo entre navegações — o único item de escala que vale antecipar

Não por desempenho, por conta. **1 map load = 1 inicialização** (verificado na página de preços da Mapbox), e trocar de aba remonta. A 10.000 barcos são **US$ 1.250/mês** e a metade disso é remontagem evitável. A 1.000 barcos é **zero**. Não é para agora — é para estar escrito antes de alguém "simplificar" o ciclo de vida do mapa e dobrar a conta sem perceber.

## F-05 · O que NÃO vale mexer — está registrado como ruído

- **Batimetria em outro formato.** `public/mapa/` inteiro soma **196 kB**. Trocar de formato aqui economiza menos de 0,2 MB enquanto 32 MB de trilha passam ao lado na mesma tela. **Ruído.**
- **Trocar o rate limit por algo no banco.** Ver D-06 — piora o caminho quente para resolver um risco que hoje não existe. **Ruído até existir endpoint público pago.**
- **Os 47 `unused_index`.** Índice "sem uso" num banco de 382 linhas não significa nada. **Reavaliar com tráfego, não agora.**
- **Os 58 `SECURITY DEFINER` executáveis por `authenticated`.** São as funções internas da RLS, que checam permissão por dentro. Vale higienizar o `EXECUTE`, não vale tratar como vulnerabilidade. **Os 4 acessíveis por `anon` são outra conversa** (C-05).
- **`<img>` sem `width`/`height`.** As dimensões estão fixadas por CSS; CLS não é o problema. O que vale é otimização de imagem, e essa é uma decisão de custo (A-07), não de layout.

---

# O que fazer

## Esta semana

| # | Ação | Onde | Por quê |
|---|---|---|---|
| 1 | **Mudar a região da função para `gru1`** | Vercel → Settings → Functions | Corta ~150 ms de **toda** ida ao banco. Zero código, disponível no Hobby, reversível. |
| 2 | **Confirmar o plano da Vercel e assinar o Pro se for Hobby** | Settings → Billing | A landing **já anuncia R$ 49,90** — pela definição da Vercel, o uso comercial já começou. O desfecho é suspensão sem janela. |
| 3 | **Assinar o Supabase Pro (US$ 25) e rodar o `pg_dump` documentado hoje** | `docs/OPERACAO.md:971-984` | Free não tem backup nem PITR (confirmado: organização `SMU-FREE`). O procedimento existe e nunca foi executado. |
| 4 | **Cadastrar `NEXT_PUBLIC_SENTRY_DSN`** | Vercel → Environment Variables | O app roda cego. O defeito de hoje de manhã foi descoberto pelo dono, não por alarme. |
| 5 | **Paralelizar `/hoje`** (linhas 236–348 em um `Promise.all`) e **apagar a consulta duplicada** da linha 230 | `app/(app)/hoje/page.tsx` | 14 esperas em fila viram 2. É a irmã direta do defeito da onda 96. Repetir em `/barco`, `/diario`, `/financeiro`, `/menu`. |
| 6 | **Tirar `trilha` das três consultas de lista** e persistir `distancia_nm` no `insert` que já a calcula | `hoje:253`, `diario:52`, `resumos:104`, `lib/acoes/trilha.ts:55` | 32 MB por abertura de tela viram ~50 kB. Vale **US$ 1.417/mês** a 10.000 barcos. |
| 7 | **Definir `file_size_limit` e `allowed_mime_types` nos 3 buckets** | painel do Supabase | A validação existe só nas Server Actions; a API do Storage aceita direto. |
| 8 | **Consertar o `global-teardown` do e2e** | `e2e/global-teardown.ts` | 6 de 9 embarcações de produção são resíduo de teste, num banco sem backup. |

## Depois do primeiro cliente pagante

| Ação | Gatilho |
|---|---|
| **Projeto Supabase separado para preview/e2e** | Antes que o resíduo de teste conviva com dado de cliente. Resolve D-04 e C-04 de uma vez. |
| **CSP em `Report-Only`, depois promovida** | Duas das três objeções do `next.config.ts` já não valem (C-02). Comece a coletar relatórios; promova quando estiver limpo. |
| **Paginar os dois crons** | Antes de 1.000 barcos. O `filter` em laço é O(barcos × eventos) numa função de 60 s. |
| **Teste do webhook do Asaas e das Server Actions de dinheiro** | Assim que o Asaas for ligado. É o caminho do dinheiro com zero cobertura. |
| **`db.max_rows`** | **Depois** de paginar os crons, nunca antes. |
| **Índices nas 77 FKs** e **consolidar as 15 policies permissivas** | Quando `pg_stat_user_tables` mostrar as tabelas passando de ~100 mil linhas. |
| **`RESEND_API_KEY` + domínio verificado** (largando o `onboarding@resend.dev`) | Quando o relatório mensal for uma promessa ao cliente. |
| **Ligar a proteção de senha vazada** (HaveIBeenPwned) | Uma chave no painel. Faça junto com qualquer outra visita ao Auth. |
| **`"use cache"` nas tabelas de referência** | Depois da região e do paralelismo, não antes. |
| **Revisar os 4 `SECURITY DEFINER` abertos ao `anon`** — em especial `info_convite_cotista(p_codigo text)` | Antes de convidar cotistas de verdade. |
| **Otimização de imagem** (`next/image` ou transformação no Supabase) | Quando o egress de storage aparecer na fatura. |
| **Manter a instância do mapa viva entre navegações** | Rumo aos 1.000 barcos — a Mapbox só cobra a partir de ~1.250. |

## Ruído conhecido — fica escrito para não voltar

1. **A batimetria não precisa de outro formato.** 196 kB no total. Otimizar isso é ruído ao lado de 32 MB de trilha.
2. **O rate limit em memória está certo por enquanto.** Trocar por contador no banco adiciona escrita no caminho quente para mitigar um risco que não existe sem endpoint público pago.
3. **Os 47 `unused_index`** não significam nada com 382 linhas no banco. Reavaliar com tráfego.
4. **Os 58 `SECURITY DEFINER` executáveis por `authenticated`** são as funções internas da RLS, que checam permissão por dentro. Higiene, não vulnerabilidade. Os **4 abertos ao `anon`** são outra conversa e estão na lista acima.
5. **`<img>` sem `width`/`height`** não causa CLS aqui — as dimensões vêm do CSS. O tema real é otimização de imagem, e é custo, não layout.
6. **`mapbox-gl` não precisa de tratamento.** O chunk de 1,78 MB já é carregado sob demanda nos quatro pontos de uso. Está certo.
7. **A RLS não tem o defeito de initplan.** 261 policies, todas com `(select auth.uid())`. Se aparecer numa auditoria futura, é falso positivo de regex sensível a maiúsculas — foi o que aconteceu comigo antes de eu medir de novo.
8. **PostgREST não está truncando os crons.** Verificado no SQL gerado: não há `LIMIT`. O risco oposto (ausência de teto) está em C-07.
9. **O desenho de degradação de falha está bom** (Mapbox, Open-Meteo, Resend, Asaas). O que falta é observabilidade, não resiliência.
10. **Não reescrever nada.** Nem sair do Capacitor, nem trocar de framework, nem sair do Supabase. O aplicativo está bem construído; ele está rodando no lugar errado e esperando em fila quando podia esperar em paralelo.

---

## O que eu não consegui verificar

- **O plano cobrado da Vercel.** O CLI estava autenticado e li as variáveis, mas o token não estava no caminho esperado para consultar o plano pela API. `Settings → Billing` resolve em dez segundos.
- **A tabela de taxas vigente do Asaas.** O orçamento de busca da sessão acabou. É o único item da conta de custo que ficou sem número — e ele afeta a margem do plano de R$ 49,90 diretamente.
- **O comportamento sob carga real.** Todas as medições de banco foram feitas com 382 linhas. Os números de escala são projeções a partir de custos unitários medidos, não observação de carga.
- **Se o mapa monta em produção.** O navegador headless ficou em "Carregando…" em `/navegar` — o token está no bundle (verificado), então é provável que seja a permissão de geolocalização negada no ambiente de teste, não um defeito. **Vale um olhar humano no celular.**

## Nota sobre o estado da árvore durante a auditoria

Outras sessões estavam editando este repositório ao mesmo tempo. Ao final, `git status` mostrava 13 arquivos de código modificados e arquivos novos (`web/lib/email.ts`, `web/lib/url-publica.ts`, `supabase/migrations/091_…sql`) que **não são meus** — esta auditoria não alterou uma linha de código, de banco ou de configuração. O único arquivo que escrevi é este relatório.

As medições de desempenho foram feitas contra o **deploy de produção vigente**, não contra a árvore local, então elas não são afetadas. As citações de arquivo:linha foram conferidas ao final e continuam válidas, **com a exceção registrada acima sobre o remetente do Resend**.

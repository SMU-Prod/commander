# Auditoria técnica — Commander (`web/`)

**Data:** 18/08/2026 · **Branch:** `master` · **HEAD:** `80044ae` · **Perfil:** dev sênior fullstack que vai herdar o código

**Método:** grep + leitura. `npm run lint` executado (resultado em §6). Suíte e build **não** executados (a pedido). Nada foi corrigido — é auditoria.

**Escala medida:** 86 arquivos de teste unitário, 1373 casos `it()/test()`, 7 specs Playwright, 79 telas em `app/(app)`, 42 arquivos com `"use client"`.

**Ranqueamento:** por **dano × frequência**. Dano = o usuário vê número/cor errada, ou o negócio decide errado. Frequência = quantos arquivos/telas/entradas atingidos.

| Severidade | Qtd |
|---|---|
| P0 — mentira visível ao dono, muitas telas | 4 |
| P1 — divergência de regra com dano localizado | 9 |
| P2 — dívida real, dano contido ou latente | 13 |
| P3 — ruído, higiene, custo de manutenção | 8 |
| **Total** | **34** |

O §5 mapeia os 8 instrumentos órfãos para tela e dado real (não é achado de defeito; é trabalho pendente com destino definido).

---

# P0 — mentira visível ao dono, em muitas telas

## P0-1. `calcularSemaforo` devolve `"ok"` para item SEM DADO NENHUM — 15 chamadas não filtram, 6 filtram

**Onde a regra mora:** `web/lib/domain/semaforo.ts:96`

```ts
const status = candidatos.length === 0 ? "ok" : candidatos.sort(...)[0]
```

Sem intervalo, sem data e sem horas, a função responde **"ok"** — verde, "Em dia". O antídoto existe e está documentado logo abaixo, em `web/lib/domain/semaforo.ts:184` (`temInformacaoSuficiente`), cujo docblock (`:180-183`) diz textualmente que ela é "exposta à parte porque quem soma o anel precisa distinguir um 'ok' de verdade de um 'ok' só por ausência de dado".

O problema é que o antídoto é **opcional**, e a maioria dos chamadores não o toma.

**Entrada que produz respostas divergentes:**

```ts
const item = { intervaloHoras: null, intervaloMeses: null, dataFixa: null,
               ultimoCicloData: null, ultimoCicloHoras: null }   // schema permite: tudo nullable
calcularSemaforo(item, null, "2026-08-18").status   // → "ok"     (verde)
temInformacaoSuficiente(item, null)                 // → false    (neutro)
```

**Par mínimo de arquivo:linha:**
- `web/app/(app)/barco/eletrica/page.tsx:48` — `calcularSemaforo(...).status` cru, sem guarda → farol **VERDE**
- `web/app/(app)/hoje/page.tsx:124-125` — calcula `r` **e** `temInformacao`, e só usa o farol quando há dado → **neutro / "Sem dados"**

**Blast radius — 15 chamadas SEM guarda:**

| arquivo:linha | consequência |
|---|---|
| `web/app/(app)/barco/page.tsx:58` | farol verde no card do equipamento |
| `web/app/(app)/barco/page.tsx:73` | **farol geral da embarcação** verde |
| `web/app/(app)/barco/page.tsx:211` | idem, seção documentos |
| `web/app/(app)/barco/page.tsx:244` | idem |
| `web/app/(app)/barco/page.tsx:272` | idem |
| `web/app/(app)/barco/eletrica/page.tsx:48` | farol verde |
| `web/app/(app)/barco/equipamentos/page.tsx:37` | farol verde |
| `web/app/(app)/barco/hidraulica/page.tsx:76` | farol verde |
| `web/app/(app)/barco/seguranca/page.tsx:81` | farol verde |
| `web/app/(app)/barco/documentos/page.tsx:57` | farol verde |
| `web/app/(app)/agenda/page.tsx:139` | item entra na agenda como "ok" |
| `web/app/(app)/agenda/page.tsx:167` | idem |
| `web/lib/consultas.ts:447` | alimenta consumidores a jusante |
| `web/lib/domain/verified.ts:80` | **selo público Verified** (ver P0-2) |
| `web/app/api/alertas/disparar/route.ts:200` | alerta push não dispara |

**6 chamadas COM guarda:** `web/components/faixa-topo.tsx:147`, `web/app/(app)/barco/saude/page.tsx:56`, `web/app/(app)/barco/equipamento/[id]/page.tsx:53`, `web/app/(app)/hoje/page.tsx:125`, `web/lib/consultas-mapa.ts:93`, `web/lib/domain/resumo-periodo.ts:287`.

**Agravante:** `web/app/(app)/barco/page.tsx:60` e `:75` terminam em `?? "ok"` — equipamento com **zero** itens monitorados também pinta verde. Duas mentiras empilhadas na mesma linha.

**Cenário concreto:** dono cadastra o barco, cria 5 equipamentos, não configura nenhum intervalo de manutenção. `/barco` mostra tudo **verde, "Em dia"**. `/hoje` e `/barco/mapa` mostram **cinza, "Sem dados"**. As duas telas leem o mesmo banco no mesmo segundo.

**Conserto:** inverter o default — fazer `calcularSemaforo` devolver `status: StatusFarol | null` e `null` quando `candidatos.length === 0`, deixando o compilador apontar os 21 chamadores. ~1 linha em `semaforo.ts` + ~2 linhas por chamador. **≈ 40 linhas**, mas TypeScript acha todos. Alternativa barata e pior: manter a assinatura e auditar os 15 à mão.

---

## P0-2. Selo público **Verified** passa por omissão de dado

**`web/lib/domain/verified.ts:78-81`**

```ts
const vencido = (i: ItemMonitorado) =>
  calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status === "vencido"
```

O comentário em `:89-93` diz que o pilar "manutenções acompanhadas" exige "existir manutenção cadastrada E nenhuma vencida", e que sem nenhum item o critério **não** conta como cumprido — "evita um barco vazio passar por omissão".

Ele evita o caso zero-itens. Não evita o caso **zero-dados** (P0-1): item sem intervalo e sem data devolve `"ok"`, logo `vencido === false`, logo o pilar **passa**.

**Cenário concreto:** cadastrar 3 itens de manutenção com título preenchido e todos os campos de prazo vazios. O barco recebe o selo "Commander Verified" — um selo de confiança público — afirmando acompanhamento que não existe.

**Conserto:** trocar `=== "vencido"` por uma checagem que trate ausência de informação como não-acompanhado, reusando `temInformacaoSuficiente`. **≈ 6 linhas** + teste.

---

## P0-3. A mesma ocorrência tem DUAS cores, decididas por duas funções diferentes

Duas funções respondem "que cor tem esta ocorrência?":

- **`web/lib/domain/ocorrencias.ts:177`** — `farolDaGravidade(gravidade)`: decide pela **gravidade declarada**
- **`web/lib/domain/ocorrencias.ts:95`** — `faroDoEstado(estado)`: decide pelo **estado** (`aberta` → `"vencido"` vermelho)

**Entrada que diverge:** ocorrência `{ estado: "aberta", gravidade: "baixa" }`

- `web/app/(app)/barco/ocorrencias/page.tsx:187` → `farolDaGravidade("baixa")` = `"atencao"` → borda **ÂMBAR**
- `web/app/(app)/barco/mapa/page.tsx:212` → `faroDoEstado("aberta")` = `"vencido"` → ponto **VERMELHO**

`/barco/ocorrencias` (onda 62) é a tela que trocou de régua. As outras quatro continuam no estado: `web/app/(app)/barco/hidraulica/page.tsx:53`, `web/app/(app)/barco/seguranca/page.tsx:60`, `web/app/(app)/barco/historico/page.tsx:144`, `web/app/(app)/barco/ocorrencias/[id]/page.tsx:75`. **1 tela contra 5.**

Pior: `/barco/ocorrencias` usa as **duas** réguas em si mesma — gravidade nos cartões ativos (`:187`) e estado nas linhas finalizadas (`:235`).

**Conserto:** decidir qual pergunta a cor responde e converter as outras. **≈ 15 linhas** + atualizar os testes dos dois lados.

---

## P0-4. Ocorrência **sem gravidade** tem TRÊS respostas, cada uma com teste verde

| arquivo:linha | resposta para `gravidade: null` |
|---|---|
| `web/lib/domain/ocorrencias.ts:178` | `null` — sem cor, borda neutra |
| `web/lib/domain/mapa-embarcacao.ts:150` | `"atencao"` — pinta a zona de âmbar |
| `web/lib/domain/saude.ts:123` + `:336` | severidade de `"baixa"` (= 1) — entra na nota |

**Testes contraditórios, ambos verdes:**
- `web/lib/domain/ocorrencias.test.ts:152-154` — *"sem gravidade registrada não se inventa cor"* → `toBeNull()`
- `web/lib/domain/mapa-embarcacao.test.ts:115-118` — *"conta como atenção"* → `toBe("atencao")`

Os dois comentários citam **a mesma regra de honestidade** (`SEVERIDADE_GRAVIDADE_AUSENTE`) para justificar respostas opostas. Este é o par que a revisão de branch identificou; **continua vivo no HEAD**.

**Cenário concreto:** uma ocorrência aberta sem gravidade, pendurada num equipamento da praça de máquinas. `/barco/ocorrencias`: cartão sem borda colorida. `/barco/mapa`: pino âmbar, e o chip do topo conta "1 atenção". `/hoje`: entra na nota de saúde com peso 1.

**Conserto:** eleger uma resposta, aplicar nos três, apagar um dos dois testes. **≈ 10 linhas.**

---

# P1 — divergência de regra com dano localizado

## P1-1. "Em acompanhamento + gravidade alta": crítico numa tela, não-crítico na outra

- `web/lib/domain/saude.test.ts:181-182` — `{estado:"em_acompanhamento", gravidade:"alta"}` → `estado: "acao_necessaria"`, `critico: true`. Título: *"alguem olhando nao e 'resolvido'"*.
- `web/lib/domain/notificacoes.test.ts:73` — `nivelDaOcorrencia("em_acompanhamento", "alta")` → `"importante"`. Título: *"em acompanhamento NUNCA é crítica — alguém já está cuidando"*.

Mesma entrada, veredictos opostos, e os **títulos dos dois testes argumentam um contra o outro**. O anel de /hoje grita vermelho enquanto o sino se recusa a mandar push. **≈ 8 linhas.**

## P1-2. Quatro formatadores de dinheiro, três saídas para o mesmo valor

Para `150000` centavos (R$ 1.500,00):

| função | arquivo:linha | saída (hex do separador) |
|---|---|---|
| `formatarReais` | `web/lib/domain/gastos.ts:43` | `R$·1.500,00` — espaço **U+00A0** |
| `formatarPreco` | `web/lib/domain/planos.ts:465` | `R$ 1.500,00` — espaço U+0020 |
| `formatarPrecoGold` | `web/lib/domain/gold.ts:210` | `R$ 1.500,00` — o `.replace()` contém um U+00A0 **literal e invisível** no fonte |
| `formatarPrecoPublicidade` | `web/lib/domain/publicidade.ts:293` | `R$ 1500,00/mês` — **sem separador de milhar** |

O quarto é simplesmente errado: `` `R$ ${(c/100).toFixed(2).replace(".", ",")}` `` não agrupa milhar. Um plano de publicidade de R$ 15.000,00 aparece como **"R$ 15000,00/mês"**.

O suite já registra o problema sem resolvê-lo: `web/lib/domain/gastos.test.ts:36` precisa de `.replace(/ /g, " ")` para comparar, enquanto `web/lib/domain/planos.test.ts:170` compara direto.

**Conserto:** um formatador, quatro chamadores. **≈ 12 linhas.**

## P1-3. Dois `tempoRelativo` — e um terceiro vocabulário

| arquivo:linha | 90 min atrás | ~30 s atrás | 3 dias |
|---|---|---|---|
| `web/lib/domain/datas.ts:45` (`Math.round`) | `"há 2 h"` | `"agora mesmo"` | `"há 3 d"` |
| `web/lib/domain/marketplace.ts:110` (`Math.floor`) | `"há 1 h"` | `"agora"` | `"há 3 dias"` |
| `web/lib/domain/navegacao.ts` (3ª régua) | — | `"agora há pouco"` | `"há 3 dias"` |

Testes verdes travando as três: `web/lib/domain/datas.test.ts:49,61`, `web/lib/domain/marketplace.test.ts:532,538`, `web/lib/domain/navegacao.test.ts:32,33`.

Consumidores: `web/components/mapa/sondagem-painel.tsx:350` (datas) e `web/app/(app)/marketplace/page.tsx:123` (marketplace). **≈ 20 linhas** para unificar.

## P1-4. `.slice(0, 10)` sobrevivente no agrupamento da Agenda

`web/lib/domain/inicio.ts:150-154` documenta o bug já corrigido lá: *"A MESMA ocorrência aparecia como '6 d' aqui e '7 dias aberta' em /barco/ocorrencias — dois lotes da onda 62 responderam diferente à mesma pergunta"*.

O mesmo defeito continua em:

- `web/app/(app)/agenda/page.tsx:189` — `data: o.created_at.slice(0, 10)` (dia **UTC**), usado por `agruparPorDia`
- `web/lib/domain/ocorrencias.ts:194` (`linhaDaAtiva`) e `:206` (`chipsDaAtiva`) — `diaCivilSP` (dia **SP**)

**Entrada:** ocorrência criada em `2026-08-12T01:00:00+00:00` (= 22:00 de 11/08 na marina).
- `/agenda` agrupa sob **12/08**
- `/barco/ocorrencias` escreve **"aberta em 11/08"**

Também: `web/app/(app)/barco/historico/page.tsx:87` e `web/lib/domain/resumo-periodo.ts:272-274` (este com justificativa escrita em `:269-271`, mas ainda erra a virada de mês para registros após as 21h do último dia). **≈ 4 linhas.**

## P1-5. Quatro grafias de "sem dado" — três delas no mesmo arquivo

| grafia | arquivo:linha |
|---|---|
| `"Sem dados"` | `web/lib/domain/semaforo.ts:21`, `web/components/ui/selo.tsx:12`, `web/lib/domain/inicio.ts:72` |
| `"Sem dados ainda"` | `web/app/(app)/barco/mapa/page.tsx:56` |
| `"sem dados"` (minúscula, **texto visível**) | `web/app/(app)/barco/mapa/page.tsx:85` |
| `"Sem dados"` (maiúscula, **aria-label**) | `web/app/(app)/barco/mapa/page.tsx:42` |
| `"—"` | `web/app/(app)/barco/mapa/page.tsx:85` (mesmo ternário!) |

`web/app/(app)/barco/mapa/page.tsx:85`:
```tsx
valor={e.pior ? textoRestante(e.pior) || "—" : "sem dados"}
```
Na **mesma coluna**, linhas adjacentes: equipamento com `pior == null` mostra `"sem dados"`; equipamento com `pior` sem prazo mostra `"—"`. Os dois significam a mesma coisa. **≈ 5 linhas.**

## P1-6. `textoRestante` devolve `""`, `textoRestanteCompacto` devolve `"—"` — e o segundo está morto

Mesmo `ResultadoCalc` de entrada, `{status:"ok", horasRestantes:null, diasRestantes:null}`:

- `web/lib/domain/semaforo.ts:148` → `""` (string vazia — a UI não renderiza nada)
- `web/lib/domain/semaforo.ts:167` → `"—"`

`textoRestanteCompacto` tem **zero consumidores em produção** (só `semaforo.test.ts`; as menções em `inicio.ts:126` e `:170` são comentários). Seis asserções verdes — `web/lib/domain/semaforo.test.ts:134-149` — defendem código morto.

A função viva que faz o mesmo trabalho é `prazoCompacto` (`web/lib/domain/inicio.ts:132`), com palavras diferentes: `"37h restantes"` vs `"37 h"`, `"vencido há 19 dias"` vs `"-19 d"`.

`web/app/(app)/barco/mapa/page.tsx:85` remenda a divergência no call site com `|| "—"` — prova de que alguém percebeu e não subiu a correção. **≈ 20 linhas** (apagar a morta, ou adotá-la).

## P1-7. Zero é leitura ou é ausência? Quatro contra um

- `web/lib/domain/tripulacao.test.ts:45` — `horasNoMarCurto({saidas:2, horasNoMar:0})` → `"—"` (*"'0 h' afirmaria o que ninguém registrou"*)
- `web/lib/domain/inicio.test.ts:188` — `horasDoMotor({horas_atuais:0})` → `"0,0 h"` (*"o traço é de FALTA de dado, não de zero"*)
- Reforçando o segundo: `web/components/ui/medidor.test.ts:49`, `web/lib/domain/explorar.test.ts:19`

Nota correlata: `web/components/ui/instrumento.ts:110` (`tomPorUso`) trata `0` **e** `null` como `"neutro"` — uma quinta posição. **≈ 6 linhas.**

## P1-8. `percentual: null` em instrumentos irmãos: um mostra traço, o outro fabrica zero

- `web/components/ui/donut-nivel.test.ts:41` — `{valor:null, percentual:null}` → contém `"—"`
- `web/components/ui/progresso-rota.test.ts:56` — `{percentual:null}` → renderiza `">0%<"` e largura `"0%"`

Mesma prop, mesmo `null`, mesma pasta, respostas opostas. `web/components/ui/barra-capacidade.test.ts:53` fica com o traço. **≈ 8 linhas.**

## P1-9. Idade de algo aberto hoje: `"aberta hoje"` ou `"0 d"`

- `web/lib/domain/ocorrencias.test.ts:187` — `chipsDaAtiva(false, "2026-08-16…", "2026-08-16")` → `["aberta hoje"]`, título diz explicitamente *"não '0 dias'"*
- `web/lib/domain/inicio.test.ts:166` — `idadeCompacta("2026-08-16…", "2026-08-16")` → `"0 d"`

Exatamente a renderização que o outro arquivo proíbe, para a mesma ocorrência, na mesma tela (/hoje lista ocorrências). **≈ 4 linhas.**

---

# P2 — dívida real, dano contido ou latente

## P2-1. `alertas_enviados` varrido inteiro a cada tick do cron

`web/app/api/alertas/disparar/route.ts:60-68` — seis varreduras de tabela **sem filtro**, com service-role key. A pior é `:68`: um log append-only lido por completo só para montar um `Set` de deduplicação. Custo O(todos os alertas já enviados), para sempre. Um filtro por `ciclo_ref`/data limita. **≈ 3 linhas.**

## P2-2. Histórico de GPS inteiro serializado para o cliente

`web/app/(app)/navegar/viagem/[id]/page.tsx:24-28` — seleciona `eventos.trilha` (JSONB de tracks GPS) de **todos** os eventos de navegação do barco, sem filtro de data e sem `.limit()`, e passa inteiro para um client component. Linhas ilimitadas × payload ilimitado por linha.

A versão limitada da mesma consulta existe duas vezes: `web/app/(app)/hoje/page.tsx:206` e `web/app/(app)/barco/resumos/page.tsx:105`, ambas com `.gte("data", <ano>-01-01)`. **≈ 2 linhas.**

## P2-3. Até 300 round-trips ao Storage onde um bastaria

`web/app/(app)/diario/page.tsx:80` — `createSignedUrl` singular dentro de `Promise.all` sobre eventos com anexo, vindos de `.limit(300)`.

A API em lote já é usada no próprio repo: `web/app/(app)/barco/fotos/page.tsx:52` chama `createSignedUrls(paths, 3600)`. **16 chamadas singulares contra 1 em lote**, em 12 arquivos. Piores casos sem teto nenhum: `web/app/(app)/barco/documentos/page.tsx:44` (chamado em `:149` e `:209`, os dois sobre arrays ilimitados). **≈ 10 linhas por local.**

## P2-4. INSERTs de uma linha em laço sobre arrays ilimitados

`web/app/api/alertas/disparar/route.ts:198`, `:227`, `:238` → todos caem num INSERT unitário em `web/app/api/alertas/disparar/route.ts:126`. Um round-trip por item, com N ilimitado (P2-1). Um `.insert([...])` resolve — o índice único já cuida da dedupe.

Também: `web/app/api/alertas/disparar/route.ts:166` (DELETE por endpoint morto; `.delete().in(...)` colapsa) e `web/lib/acoes/importar-gpx.ts:126` (um INSERT por trilha de um **GPX enviado pelo usuário** — contagem controlada por quem faz upload). **≈ 15 linhas.**

## P2-5. Cliente Supabase novo a cada foto

`web/lib/consultas-partner.ts:32-35` (`urlFotoParceiro`) chama `await supabaseServer()` a cada invocação, e `web/lib/supabase/server.ts:4` **não** está embrulhado em `cache` do React. Chamado por foto em `web/app/(app)/explorar/[id]/page.tsx:100-101`, `web/app/(parceiro)/parceiro/perfil/page.tsx:81,84` e uma vez por card em `web/app/(app)/explorar/page.tsx:107,166` — N clientes SSR e N `await cookies()` por render.

A solução já existe no repo: `web/lib/consultas-captain.ts:124` (`resolvedorDeFotoDePerfil`) monta um cliente e devolve um resolvedor síncrono. **≈ 8 linhas.**

## P2-6. Total do mês somado sobre uma janela truncada

`web/app/(app)/financeiro/lancamentos/page.tsx:82-87` — `totaisDoMes` soma sobre `brutos`, limitado a `.limit(300)` em `:52-54` com `order("data", desc)`.

Como a ordem é decrescente, o mês corrente normalmente cabe. Mas `web/lib/domain/financeiro.ts:233` soma "a vencer" para **qualquer data futura**, e `web/app/(app)/financeiro/recorrentes/[id]/page.tsx:54` projeta vencimentos **366 dias à frente**. Um barco com muitos lançamentos futuros materializados empurra o mês corrente para fora da janela de 300 e o cartão "Pago em agosto" passa a mostrar menos do que foi pago, **sem nenhum sinal na tela**. **≈ 6 linhas** (consulta própria e agregada para o card).

## P2-7. Consultas de lista sem teto (amostra)

Todas crescem por ação do usuário e não têm `.limit()`/`.range()`:

| arquivo:linha | tabela | vizinho no mesmo `Promise.all` |
|---|---|---|
| `web/app/(app)/barco/historico/page.tsx:54` | `ocorrencias` | `eventos` em `:53` tem `.limit(300)` |
| `web/app/(app)/tripulacao/page.tsx:63` | `profiles` — **sem filtro e sem limite** | `eventos` em `:67-71` limitado a 300 |
| `web/app/(app)/barco/ocorrencias/page.tsx:65-68` | `ocorrencias` | — |
| `web/app/(app)/barco/resumos/page.tsx:100` | `ocorrencias` | `eventos` em `:98-99` é janelado |
| `web/app/(app)/hoje/page.tsx:245-247` | `ocorrencias` | — |
| `web/app/(app)/barco/documentos/page.tsx:34-35` | itens | — |
| `web/app/(app)/carteira/[id]/page.tsx:56` | `carteira_movimentos` | razão acumulativa lida inteira a cada view |
| `web/app/(app)/navegar/page.tsx:26`, `web/lib/consultas-partner.ts:131` | `parceiros` | passados inteiros a client components |
| `web/app/(app)/diario/page.tsx:55`, `web/app/(app)/diario/novo/page.tsx:71` | `contatos` — sem filtro | `web/app/(app)/barco/contatos/page.tsx:27` **filtra** por `embarcacao_id` |

Mapas de nome montados com `profiles` inteiro: `web/app/(app)/carteira/[id]/page.tsx:58`, `web/app/(app)/carteira/page.tsx:47`, `web/app/(app)/carteira/nova/page.tsx:33`, `web/lib/consultas-admin.ts:160`. **≈ 1-3 linhas cada.**

## P2-8. `select("*")` onde a versão correta existe ao lado

- `web/app/(app)/hoje/page.tsx:246` — consome só `id, titulo, aba, estado, gravidade, created_at` (`:253`, `:264-266`). **`web/lib/consultas.ts:439` roda a consulta idêntica na mesma tabela com exatamente essa lista de colunas**, no mesmo request path.
- `web/app/(app)/barco/historico/page.tsx:54` — usa `id, titulo, estado, aba, created_at`; traz `descricao`, `anexo_path`, `gravidade`, `resolvida_em`, `criado_por` sem uso
- `web/app/(app)/barco/resumos/page.tsx:98` — `eventos` inteiro, enquanto o irmão em `:100` nomeia três colunas
- `web/app/api/relatorio/mensal/route.ts:67,69,70,71` — quatro `select("*")` sobre tabelas inteiras
- `web/app/(app)/barco/fotos/page.tsx:35` — usa `id, album, bytes, arquivo_path`
- `web/app/(app)/barco/ocorrencias/page.tsx:65` — `select("*")` sem limite

**≈ 1 linha cada.**

## P2-9. Regra de autorização testada que **nenhuma tela chama**

`web/lib/domain/admin-papeis.ts:129` — `podeGerenciarAdministradores(papeis)`, documentada como a linha do PRD §21 ("o CEO é a conta-mãe que cria e gerencia os demais"), com teste em `web/lib/domain/admin-papeis.test.ts:77-78`. **Zero consumidores em produção.**

O gate real é `exigirCeo()` em `web/lib/acoes/admin-papeis.ts:56` e `:101`, mais a RLS da migration 049. Não há buraco de segurança **hoje** — há duas fontes de verdade para a mesma regra, e a que tem teste é a que ninguém usa. Mesmo padrão em `web/lib/domain/admin-papeis.ts:111` (`ehAdminQualquer`) e `:118` (`ehAdminNacional`).

Correlatos sem consumidor **e** sem teste: `web/lib/consultas-gold.ts:144` (`ehAdminGold`, um `cache()` de checagem admin), `web/lib/consultas-captain.ts:71` (`carregarMeuPerfilProfissional`), `web/lib/asaas.ts:212` (`detalhesAssinaturaAsaas`, código de billing). **≈ 4 linhas** cada (apagar ou adotar).

## P2-10. `TODO`s que descrevem trabalho já feito — e um que anuncia um gate inexistente

- `web/lib/acoes/marketplace.ts:326` — "integrar com Financeiro… quando existir". Existe: `web/lib/acoes/financeiro.ts:263-344`, ligado em `web/app/(app)/marketplace/[id]/page.tsx:594,626`.
- `web/app/(app)/marketplace/disponibilidades/page.tsx:19-21` — afirma que o gate de publicação do Captain Pro "não está implementado". **Está**: `web/lib/acoes/marketplace.ts:459-479`, mais RLS na migration 051. Um comentário anunciando ausência de autorização é o lado errado para se errar.
- `web/lib/acoes/avaliacoes-admin.ts:19` — **justificado**: refinamento adiado, com guardas reais no lugar.

**≈ 3 linhas** (apagar os dois obsoletos).

## P2-11. 34 pílulas escritas à mão, 3 raios e 4 paddings — a patologia da onda 56 voltou

`web/components/ui/chip.tsx:5-15` conta a história: a pílula estava "copiada à mão em doze telas", com "seis alturas diferentes pro mesmo gesto". O `Chip` resolveu — para pílula **de filtro** (é um `Link`). O `Selo` resolveu para pílula **de estado**.

Ninguém cobriu a terceira: a pílula **informativa somente-leitura**. Hoje são 34 cópias à mão em 26 arquivos, com três raios diferentes para o mesmo objeto:

- `rounded-full` (24×): `web/app/(app)/tripulacao/page.tsx:41,172`, `web/components/captain/cartao-profissional.tsx:61,71,79,83`, `web/components/avaliacoes/reputacao.tsx:58,74`, `web/components/captain/painel-carreira.tsx:92`, `web/app/(app)/diario/[id]/page.tsx:129`, `web/app/(app)/marketplace/page.tsx:119`, `web/app/(app)/notificacoes/page.tsx:103`, `web/app/(app)/barco/page.tsx:357`, `web/app/(app)/agenda/page.tsx:495`, `web/components/mapa/card-parceiro.tsx:103,108`, …
- `rounded-[var(--raio-pilula)]`: `web/app/(app)/diario/page.tsx:267` (o token que o `Selo` usa, `web/components/ui/selo.tsx:37`)
- `rounded-[var(--raio-controle)]`: `web/app/(app)/barco/ocorrencias/page.tsx:210`

Paddings: `px-2 py-0.5`, `px-2 py-1`, `px-2.5 py-1`, `px-2.5 py-1.5`, `px-2.5 py-0.5`.

**Agravante — a regra escrita foi violada no mesmo repo:** `web/components/ui/chip.tsx:24-29` diz que `font-mono-instr` + `tracking` é para **número**, e que aplicada a palavra corrida "vira soletração". `web/app/(app)/barco/ocorrencias/page.tsx:206-214` (onda 62) aplica exatamente isso a palavras: `"1 anexo"`, `"6 dias aberta"`.

**Conserto:** um componente `Pastilha` e uma varredura. **≈ 25 linhas** no componente + ~2 por call site.

## P2-12. Dois componentes de selo são client sem precisar

- `web/components/selos/selo-verified.tsx:1` — SVG estático, sem estado/efeito/handler. O único construtor que força client é `useId()` em `:46`. Os três consumidores são Server Components (`web/app/(app)/barco/page.tsx:329`, `web/app/(app)/barco/selos/page.tsx:70`, `web/app/(app)/barco/selos/verified/page.tsx:67`).
- `web/components/selos/selo-gold.tsx:1` — mesma forma, `useId()` em `:53`.

O bloqueio tem solução no próprio repo: `web/components/ui/instrumento.ts:163-181` documenta este problema exato — *"`useId()` não serve: é hook, e estes componentes são de servidor"* — e oferece `idDefs()` em `:178`.

**Atenção ao mexer:** `web/lib/ui/tokens.test.ts` fixa a contagem de cores literais dos dois arquivos (`selo-verified.tsx: 9`, `selo-gold.tsx: 4`). **≈ 6 linhas cada.**

## P2-13. 8 instrumentos com teste verde e zero consumidores

`web/components/ui/`: `medidor.tsx`, `donut-nivel.tsx`, `barra-capacidade.tsx`, `grafico-area.tsx`, `grafico-barras.tsx`, `progresso-rota.tsx`, `botao-circulo.tsx`, `instrumento.ts`.

Órfão confirmado: **7 dos 8 têm exatamente 0 importadores**. O oitavo, `instrumento.ts`, tem 6 — `barra-capacidade.tsx:2`, `grafico-barras.tsx:1`, `progresso-rota.tsx:2`, `grafico-area.tsx:1`, `medidor.tsx:9`, `donut-nivel.tsx:1` — todos os outros órfãos, logo alcança 0 telas transitivamente. `instrumento.ts` não tem arquivo de teste próprio.

Nasceram sem consumidor de propósito, mas o custo já está correndo: são ~1.000 linhas de UI com testes verdes que não protegem nenhum pixel em produção, e enquanto isso as telas seguem desenhando as mesmas anatomias à mão (P2-11). O destino de cada um está em §5.

Colisão de nome a conhecer: `ProgressoRota` também é uma **interface de domínio** em `web/lib/domain/modo-navegando.ts:116` (usada em `:185`, `:209`). Não é consumidora do componente.

---

# P3 — ruído, higiene, custo de manutenção

## P3-1. Testes que passariam com a função quebrada

| arquivo:linha | por que é vácuo |
|---|---|
| `web/lib/lotes.test.ts:22` | `toBeLessThanOrEqual(3)` é a única asserção sobre lotes — uma implementação **sequencial** (pico 1) passa. A razão de existir da função não é verificada. |
| `web/lib/domain/verified.test.ts:147` | `Object.keys(baseCompleta).sort()` afere o **fixture local do próprio teste** (declarado em `:55`), não a saída de função nenhuma. Só quebra se alguém editar o fixture — e é o teste que carrega o título de garantir "ocorrência não é insumo do selo". |
| `web/lib/domain/saude.test.ts:311` | `toBe(PESO_CATEGORIA.documentos * SEVERIDADE_STATUS_ITEM.vencido)` recalcula a fórmula da implementação com as constantes da implementação — um erro de peso se reproduz idêntico dos dois lados. |
| `web/lib/domain/saude.test.ts:317` | idem, para `MULTIPLICADOR_ESTADO_OCORRENCIA.em_acompanhamento`. |
| `web/lib/domain/saude.test.ts:106` | `toBe(peso >= PESO_AREA_CRITICA)` reescreve a definição de `ehAreaCritica` como sua própria expectativa. |
| `web/components/ui/selo.test.ts:39,45` | `not.toBe("")` + `not.toMatch(/\d|%/)`. Um `Selo` que renderizasse `"xxx"` nos quatro estados passa em tudo — nenhum estado é preso a uma palavra, apesar do cabeçalho de 25 linhas dizer que mede "o que a pessoa lê". |
| `web/lib/domain/modo-navegando.test.ts:122,136` | `toBeGreaterThan(5)` com comentário admitindo que o autor não calculou o valor (real ≈ 57 contra `toBeLessThan(120)`). |
| `web/components/ui/grafico-barras.test.ts:49-50` | `altura >= 0 && <= 100` — um componente que fixasse toda barra em 50% passa no teste chamado "nenhuma barra passa do topo". |
| `web/lib/domain/captain.test.ts:105-106` | `titulo.length > 10`, `descricao.length > 30` — mede comprimento onde a alegação é sobre conteúdo. |
| `web/e2e/landing.spec.ts:15-21` | as duas asserções estão dentro de `if ((await termos.count()) > 0)` — o teste "mostra os links principais" **não verifica nada** exatamente quando os links somem. |
| `web/e2e/navegar-mapa.spec.ts:31-32` | `body.textContent.trim().length > 0` é verdade em qualquer página Next renderizada, inclusive no bug de mapa em branco que o cabeçalho do arquivo diz caçar. |

## P3-2. Testes que decoram implementação

- `web/components/ui/cabecalho-detalhe.test.ts:30,47,50` — asseveram strings exatas de classe Tailwind (`'class="mt-3 flex items-start justify-between gap-3"'`). Reordenar duas utilities, sem mudança visual nenhuma, quebra a suíte.
- `web/lib/mapa/mascara.test.ts:109` — `toHaveBeenCalledTimes(8)` codifica "4 loaders × 2 arquivos"; unir o par JSON+PNG num request, uma otimização pura, quebra o teste.
- `web/lib/domain/saude.test.ts:57` (`Object.keys(r).sort()`) e `web/components/ui/botao-circulo.test.ts:36-40` (`size-11`/`size-[30px]`/`-m-[7px]` exatos) — mesma espécie, um degrau abaixo.

## P3-3. Rótulo de mês: com ano ou sem?

- `web/lib/domain/diario.test.ts:121` — `"Agosto de 2026"`
- `web/lib/domain/financeiro.test.ts:264` — `"Agosto"` (*"só o mês no ano corrente"*)
- `web/lib/domain/agenda.test.ts:392` — `"Agosto"`, mas `web/lib/domain/agenda.test.ts:332` (`rotuloMes`) → `"Agosto de 2026"` — a agenda diverge **de si mesma**.

Duas listas cronológicas, dois cabeçalhos. **≈ 5 linhas.**

## P3-4. Vencido renderizado como número não-negativo

- `web/lib/domain/inicio.test.ts:154` — `prazoCompacto({status:"vencido", horasRestantes:-0.4})` → `"0 h"`, indistinguível de um item em dia com 0,4 h de folga
- `web/lib/domain/inicio.test.ts:217-220` — `apoioDaRevisao` com a mesma entrada → `"Revisão vencida"`, e `not.toMatch(/Revisão em/)`, com comentário chamando a renderização "0 h" de *"o oposto do fato"*

Mesmo arquivo, mesma entrada, uma função presa a fazer o que a outra é presa a proibir. `prazoCompacto` mantém o sinal para dias (`"-19 d"`, `:144`) e o descarta para horas. **≈ 3 linhas.**

## P3-5. Dado ausente → âmbar: `mar.ts` é o único dissidente

`web/lib/domain/mar.test.ts:18` — `avaliarMar(null, null)` → `{nivel:"atencao"}`, que `web/lib/domain/inicio.test.ts:87` mapeia para o selo âmbar.

Contra: `web/lib/domain/semaforo.test.ts:204` (`seloDoFarol(null)` → `"neutro"`), `web/lib/domain/inicio.test.ts:71`, `web/lib/domain/saude.test.ts:207`, `web/lib/domain/mapa-embarcacao.test.ts:87`. **≈ 4 linhas.**

## P3-6. Duas grafias para o mesmo tom âmbar

`web/lib/domain/financeiro.test.ts:271-272` trava `tom: "aviso"`, mas o vocabulário do app é `ESTADOS_SELO = ["ok","atencao","critico","neutro"]` (`web/components/ui/selo.tsx:5`), reexportado como `TomInstrumento` em `web/components/ui/instrumento.ts:29`. `web/lib/domain/financeiro.ts:278` declara uma união privada que nenhum `Selo`/`Medidor` aceita. **≈ 6 linhas.**

## P3-7. Contagem zero: omitir ou dizer?

- `web/lib/domain/inicio.test.ts:113` — `contagemDaSaude` omite zeros (*"'0 vencidos' é ruído"*)
- `web/lib/domain/documentos.test.ts:12` — `resumoDosDocumentos(4,2,0,0)` → `"4 documentos · nenhum vencido."` — diz o zero em voz alta

**≈ 4 linhas.**

## P3-8. Percentual ausente: `null` ou `"—"`?

- `web/lib/domain/admin-metricas.test.ts:153` — `formatarPercentual(null)` → `null`
- `web/lib/domain/publicidade.test.ts:283` — `formatarTaxa(taxaDeClique(0,0))` → `"—"`

Ambas formatam "percentual ausente para exibição"; uma devolve string renderizável, a outra não devolve nada. **≈ 3 linhas.**

---

# §5 — Os 8 instrumentos órfãos: onde cada um entra

Regra desta seção: **só dado que já existe**. Onde o dado não existe, está dito.

## 5.1 `medidor.tsx` → `/diario/[id]` (velocidade)

**Host:** `web/app/(app)/diario/[id]/page.tsx:164` — substituindo os dois tiles de velocidade (`:158-169`).

| prop | dado real |
|---|---|
| `valor` | `rHonesto.velMediaKt` — campo em `web/lib/domain/geo.ts:25`, calculado em `geo.ts:48`; ligado na tela em `diario/[id]/page.tsx:57,65`, já renderizado cru em `:161` |
| `max` | `rHonesto.velMaxKt` — `geo.ts:26`, calculado em `geo.ts:44`; já renderizado cru em `:167` (arredondar com `escalaTopo`, `instrumento.ts:131`) |
| `unidade` | literal `"kt"`, já em `:161`/`:167` |
| `estado` | **NÃO EXISTE DADO** — não há limiar de velocidade em domínio nenhum. Omitir. |

O contrato `valor: null` já está satisfeito: `rHonesto` é `null` quando `e.trilha_sem_horario === true` (`:64-65`) — exatamente o caso em que a tela já imprime "—".

**Hoje:** média e máxima são dois `<p>` crus em `div`s à mão num grid de 2 colunas (`:143-170`); não dá pra ver o quanto o barco foi forçado em relação ao próprio pico.

## 5.2 `donut-nivel.tsx` → `/barco/fotos` (ramo plano pago)

**Host:** `web/app/(app)/barco/fotos/page.tsx:167` — cartão "Cota do plano" (`:167-179`), ramo **bytes**.

| prop | dado real |
|---|---|
| `percentual` | `usoDaCota(bytes).percentual` — `web/lib/domain/cota.ts:18` (declarado `:10`); chega à tela via `cotaDoPlano` (`cota.ts:67`) como `cota.percentual`, usado em `fotos/page.tsx:175` |
| `valor` | `usoDaCota(bytes).usadoBytes` — `cota.ts:20`; a soma já existe na tela: `todas.reduce((s, f) => s + f.bytes, 0)` em `fotos/page.tsx:49` |
| `apoio` | `formatarBytes(uso.limiteBytes)` — `cota.ts:72`, limite de `COTA_MB` em `cota.ts:5` |
| `unidade` | literal `"MB"` |

**O caso primário documentado dele (diesel / água doce) é NÃO EXISTE DADO.** Não há campo de tanque em `Embarcacao` nem `Equipamento` (`web/lib/db/types.ts:24-83`). O decodificador que forneceria isso existe e está desligado: `decodificarNivelFluido` → `NivelFluido.nivelPct`/`.capacidadeL`, `web/lib/nmea/n2k-motor.ts:175`, `:164-167` — zero consumidores de UI.

**Hoje:** barra de 1px à mão com `style={{ width: ... }}` inline (`:172-176`).

## 5.3 `barra-capacidade.tsx` → `/barco/fotos` (ramo plano Free)

**Host:** `web/app/(app)/barco/fotos/page.tsx:167` — mesmo cartão, ramo **contagem**. 5.2 e 5.3 são os dois braços do desvio que `cotaDoPlano` já faz (`cota.ts:52` vs `cota.ts:64`); o plano decide qual renderiza.

| prop | dado real |
|---|---|
| `usado` | `usoFotos` — `fotos/page.tsx:44` (`todas.length`) |
| `total` | `LIMITES_FREE.fotos` — `web/lib/domain/plano-acesso.ts:159`; a mesma constante que o gate de upload lê em `plano-acesso.ts:200` |
| `unidade` / `rotulo` | literais `"fotos"` / `"Cota do plano"` (já é o label em `:169`) |

**Duas diferenças de comportamento a decidir antes de trocar:** a tela põe piso na barra com `Math.max(2, cota.percentual)` (`:175`) para pintar um fio mesmo com cota vazia, enquanto `BarraCapacidade` renderiza 0 real em `neutro`; e `cotaDoPlano` usa `critico: percentual > 90` (`cota.ts:68`) contra `>= 90` de `tomPorUso` (`instrumento.ts:112`). É uma divergência de régua a mais, na mesma família do P1-7.

## 5.4 `grafico-area.tsx` → `/barco/resumos` (horas de motor por mês)

**Host:** `web/app/(app)/barco/resumos/page.tsx:331` — acima da tabela "Evolução no período" (`:329-357`).

| prop | dado real |
|---|---|
| `pontos` | `r.evolucaoMensal` — `web/lib/domain/resumo-periodo.ts:74`, produzido em `:228-235`, retornado em `:314`, ligado na tela em `barco/resumos/page.tsx:110`. Mapear `rotulo: m.rotulo`, `valor: m.horasMotor` |
| `sufixo` | literal `" h"` — a unidade já impressa em `:347` |

Os meses já vêm truncados em hoje (`resumo-periodo.ts:56`), então a série nunca tem cauda futura vazia.

**Hoje:** `evolucaoMensal.horasMotor` é uma série temporal mensal real que só aparece como **coluna de tabela HTML** (`:347`) — `GraficoMesesGastos` assume `totalCentavos` e não aceita isso.

## 5.5 `grafico-barras.tsx` → `/financeiro` (gastos por mês)

**Host:** `web/app/(app)/financeiro/page.tsx:159` — substituindo `<GraficoMesesGastos meses={seisMeses.meses} mesAtual={hoje.slice(0, 7)} />`. É a única instância em tamanho cheio; as outras duas (`hoje/page.tsx:576`, `barco/resumos/page.tsx:206`) rodam com `altura={72}`/`{110}` e `comMoldura={false}` — baixas demais para tooltip.

| prop | dado real |
|---|---|
| `pontos` | `seisMeses.meses` — `ResumoGastos.meses`, `web/lib/domain/gastos.ts:6`, montado em `:13-22`, preenchido `:29`, retornado `:38`; ligado em `financeiro/page.tsx:71-76`. Mapear `rotulo: m.rotulo`, `valor: m.totalCentavos` |
| `destaque` | `m.mes === mesAtual` — o mesmo teste já existe em `web/components/grafico-meses-gastos.tsx:27` |

**Hoje:** as barras carregam o número só como altura de `div` (`grafico-meses-gastos.tsx:28`), sem `aria-label` e sem tooltip.

*Alternativa de forma exata:* `barrasDaDistribuicao` (`web/lib/domain/avaliacoes.ts:406`) devolve `{estrela, quantidade, percentual, destaque}` — o `destaque` é semanticamente idêntico ao de `PontoBarra`. Renderiza hoje como barras à mão em `web/components/avaliacoes/reputacao.tsx:42-52`.

## 5.6 `progresso-rota.tsx` → `/navegar` (painel de bordo) — **adoção parcial**

**Host:** `web/components/mapa/navegar-mapa.tsx:1728` — dentro do cartão do painel (`:1707-1760`), encabeçando o grid 2×2 de `Mostrador` (`:1728-1753`).

| prop | dado real |
|---|---|
| `destino` | `destino.nome` — estado em `navegar-mapa.tsx:596`, já renderizado em `:1717` |
| `restante` | `progressoRotaAtual.distanciaRestanteNm` — `web/lib/domain/modo-navegando.ts:128`, calculado `:203-206`; ligado em `navegar-mapa.tsx:1073-1077`, já renderizado cru em `:1738` |
| `distanciaTotal` | `estadoRotaAtual.distanciaNm` — `navegar-mapa.tsx:46`, populado pelo worker em `:667` (`rota.worker.ts:278` via `distanciaDaRota`, `web/lib/domain/rota.ts:723`). **Só no ramo `tipo === "rota"`** — o fallback de marcação direta (`:1075`) não tem total, e a barra não pode renderizar ali |
| `percentual` | não existe como campo, mas é derivável sem fonte nova: `(1 − distanciaRestanteNm / distanciaNm) × 100` |
| `unidade` | `"MN"`, já em `:1739` |
| `origem` | **NÃO EXISTE DADO.** `NavegarMapa` nunca recebe o *nome* de uma origem. `origemRota` (`:1427`) é um `Coord` cru de `estadoRotaAtual.pernas[0]` (`:45`); `destinoInicial` (`:382`) só carrega o destino. Nomes de origem só existem no domínio de viagem (`Parada.nome`, `web/lib/domain/viagem.ts:18`) e nunca cruzam pra `/navegar` |
| `eta` | **o formatador prometido não existe.** O JSDoc da prop (`:34`) promete `"~1h 8m"`; o único produtor é `etaMinutos` (`web/lib/domain/navegacao.ts:21`), que devolve minutos inteiros, ligado em `navegar-mapa.tsx:1079-1082` e renderizado cru em `:1744`. O formatador mais próximo é `textoDuracao` (`web/lib/domain/bordo.ts:72` → `"1 h 08"`), que recebe horas. A string `"~1h 8m"` aparece uma única vez no repo: `progresso-rota.test.ts:15` |

**Hoje:** o painel tem quatro `Mostrador` desconectados e **nenhuma barra de progresso** (busca por `progressbar` e `style={{ width` no arquivo inteiro: zero) — "restante 4,2 MN" nunca diz restante *de quê*.

## 5.7 `botao-circulo.tsx` → `/agenda` (navegação de período)

**Host:** `web/app/(app)/agenda/page.tsx:304-307` e `:314-317`.

Sem props de dado. Tudo já está literalmente nos call sites: `icone` ← `"voltar"` (`:306`) / `"chevron"` (`:316`); `rotulo` ← `"Período anterior"` (`:304`) / `"Próximo período"` (`:314`), hoje o `aria-label`; `href` ← `link({ d: anterior })` / `link({ d: proximo })`.

**Hoje:** círculos `flex size-9 … rounded-full border border-line bg-panel text-dim` à mão — **36px**, abaixo do mínimo de 44px que o docblock inteiro deste componente existe para reconciliar com o desenho de 30px. É exatamente o defeito para o qual ele foi construído, no único lugar de `app/` que já tem controle redondo só-ícone.

## 5.8 `instrumento.ts` → adotado junto com 5.1-5.7, mais dois hosts próprios

**(a)** `web/components/grafico-meses-gastos.tsx:16` — `escalaTopo(bruto, divisoes)` (`instrumento.ts:131`). O gráfico hoje escala com `Math.max(1, ...meses.map((m) => m.totalCentavos))`: a barra mais alta é sempre exatamente 100% e não existe eixo Y. `escalaTopo` é o número redondo logo acima do máximo que permitiria o eixo nascer.

**(b)** `web/app/(app)/barco/fotos/page.tsx:174` — `tomPorUso(percentual)` (`instrumento.ts:110`), alimentado por `cota.percentual` (`cota.ts:60`/`:67`). A tela escreve à mão um binário `cota.critico ? "bg-crit" : "bg-dim"`; `tomPorUso` é o mesmo julgamento com o meio graduado (`>= 60` atenção) e a regra "zero não é verde".

## 5.9 Onde **não** colocar

- **Verified e Saúde não recebem barra nem donut.** Comentários em `web/app/(app)/barco/selos/page.tsx:78-79` e `web/app/(app)/barco/page.tsx:333-335` registram que o PRD §15 proíbe a porcentagem ali, e `web/lib/domain/verified.ts:42` documenta um campo `percentual` **removido de propósito**. `web/lib/domain/saude.ts:25-53` registra a mesma proibição (PRD §1.1/§27.2/§28). Contadores em `barco/selos/page.tsx:94`, `barco/page.tsx:337`, `barco/selos/verified/page.tsx:79` ficam como estão.
- **O gráfico de maré não é `GraficoArea`.** `web/components/mapa/tempo-painel.tsx:146-187` (sobre `web/lib/domain/mar.ts:101-135`) escala min→max e tolera negativo; `GraficoArea` prende em `0..escalaTopo` (`grafico-area.tsx:79`). Deixar quieto.

## 5.10 Achados laterais desta varredura

Campos calculados que nenhuma tela lê: `ProgressoRota.indiceSegmentoAtual` (`web/lib/domain/modo-navegando.ts:119`, retornado em `:209`), `usoDaCota().restanteBytes` (`web/lib/domain/cota.ts:23`), e `formatarBytes` como export público.

---

# §6 — `npm run lint`

Executado em `web/`. **Exit code 0.**

```
web/components/mapa/mapa-nautico.tsx
  341:9  warning  Unused eslint-disable directive (no problems were reported from 'prefer-const')
  589:5  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')

✖ 2 problems (0 errors, 2 warnings)
```

Os dois são `eslint-disable` que não desabilitam nada. Em `:341` o disable de `prefer-const` está na linha da **atribuição**, mas a regra reporta na **declaração** (`:339`) — é no-op. A indentação de `:342-343` não foi reajustada, sugerindo um `try/catch` embrulhado em código existente.

**Contexto favorável que vale registrar por ser incomum:** zero `@ts-ignore`, zero `@ts-expect-error`, zero `@ts-nocheck`, zero `eslint-disable` de arquivo inteiro em toda a árvore. `tsconfig.json:11` tem `"strict": true`; `next.config.ts` não define `ignoreBuildErrors` nem `ignoreDuringBuilds`. As 31 diretivas `eslint-disable` de linha **têm todas justificativa escrita** — a maioria é `@next/next/no-img-element` sobre URLs assinadas de Storage (correto: `next/image` não otimiza essas) e `react-hooks/set-state-in-effect` para sincronizar `localStorage`/DOM pós-hidratação. Não há dívida de type-safety a reportar.

---

# §7 — Nota transversal

Os achados **P0-1, P0-4, P1-5, P1-6, P1-7, P1-8, P1-9, P3-4, P3-5, P3-7, P3-8** são todos a mesma pergunta não arbitrada:

> **Como este app renderiza "eu não sei"?**

As respostas hoje travadas por teste verde são: `—`, `""`, `0`, `"0 h"`, `"0%"`, `"0 d"`, `null`, `"Sem dados"`, `"Sem dados ainda"`, `"sem dados"`, `"Sem registro"`, `"Sob consulta"`, `"aberta hoje"`, `"neutro"`, `"atencao"` e `"ok"`.

Escolher uma, escrever num lugar (`lib/domain/vazio.ts`) e varrer colapsa cerca de um terço deste relatório. É o único item cujo conserto tem retorno maior que a soma das partes.

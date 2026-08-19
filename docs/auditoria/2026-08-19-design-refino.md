# O que ainda separa o Commander do Waze, do Navionics e do Haulix

Auditoria de design · 19/08/2026 · branch `onda-7-fala-como-gente`

Critério: *"quero o design mais refinado e classudo, pensando nos grandes apps
como Waze, Navionics"*, somado à referência que o dono já escolheu e mediu — o
painel **Haulix**, cuja leitura está em
[`docs/superpowers/specs/2026-08-16-haulix-exato-design.md`](../superpowers/specs/2026-08-16-haulix-exato-design.md).

**Método:** leitura de código, não captura de tela. Nenhum servidor foi
levantado. Toda medida abaixo ou é um valor literal do código (com
arquivo:linha) ou é aritmética explícita sobre valores literais — quando é
aritmética, está escrito que é. Onde não houve medida, está escrito **não
medido**.

**O que este documento NÃO refaz:** as ondas 60–82 já entregaram paleta cinza
medida, casca de duas colunas, os cinco instrumentos, anatomia de KPI/migalha/
abas, Inter com escala nova, painéis do mapa consolidados e a pílula de ação da
onda 82. Nada disso aparece aqui como pendente. O que aparece é o que ficou
**depois** delas.

---

## Veredito

O Commander já tem o sistema do Haulix escrito — tokens, escala, instrumentos,
anatomia de ficha — e o problema mudou de natureza: **deixou de ser ausência e
virou alcance**. O sistema está no `globals.css` e não chega ao JSX. As três
medidas que provam isso: `.valor`, a voz de dado que a onda 80 criou para
consertar *"não tem hierarquia, tá bem amador"*, tem **zero usos** em 225
arquivos — quem ocupou o lugar dela são 222 `text-sm` sem peso, sem cor e sem
tabular; dos 946 raios do app, **86% são escritos à mão** e os 4 tokens viraram
**13 raios em uso**; e `CabecalhoCartao`, `MigalhaPao`, `FaixaKpi`,
`GradeRotuloValor`, `BotaoFicha`, `BotaoCirculo` e `FaixaAlerta` têm **um
importador cada, e os sete são o mesmo arquivo** — existe exatamente **uma
tela** no app inteiro construída na anatomia da referência, e ela não é nenhuma
das que o dono abre todo dia. O que mais denuncia o app, porém, não é nada
disso: é o **movimento**. Em 225 arquivos `.tsx` há **zero** ocorrências de
`active:`, **zero** de `useTransition`/`isPending`/`useFormStatus`, **um**
`@keyframes`, e **2 de 73** arquivos com formulário mostram qualquer sinal de
"enviando". Waze e Navionics respondem ao dedo antes de responderem ao servidor;
o Commander não responde ao dedo nunca. Um app que não pisca quando é tocado lê
como página, não como instrumento — e isso custa mais na percepção de R$
69,90/mês do que qualquer pixel de espaçamento.

---

## Eixo 1 — Densidade

A régua é o §3 item 6 do spec: *"linhas do Haulix têm 2 linhas de texto + 3
chips em ~64px"*.

### 1.1 O cartão de saída do Diário gasta 120px para entregar os 64px da referência

**Onde:** `web/app/(app)/diario/page.tsx:200-282` (a anatomia), `:283` (a casca
`p-3`).

**A conta**, somando os valores literais do código (Tailwind: `text-xs` = caixa
de 16px; `.titulo-card` = 15px × 1,35 = 20,25px; `.apoio` = 12px × 1,5 = 18px):

| parcela | linha | valor |
|---|---|---|
| `p-3` topo + base | :283 | 12 + 12 = **24px** |
| linha 1 — a pastilha `size-[30px]` manda na altura, não o título (20,25px) | :204 | **30px** |
| `mt-2.5` antes dos chips | :216 | **10px** |
| fileira de chips — `py-[5px]` + caixa de 16px + 2 de borda | :218 | **28px** |
| `mt-2.5` antes do apoio | :244 | **10px** |
| linha de apoio `.apoio` | :244 | **18px** |
| **total** | | **120px** |

Mais `gap-2` (:165) entre cartões: o passo da lista é **128px**. A referência
faz o mesmo trabalho — duas linhas de texto e três chips — em ~64px. **Somos
1,9× a referência.**

**Onde o pixel se perde:** os 30px da pastilha de ícone. Ela sozinha define a
altura da primeira linha, porque o título de uma linha mede 20,25px. São 10px
por cartão gastos numa pastilha decorativa que repete o que o título já diz
("Docagem" com o ícone de âncora). Some os `mt-2.5` dobrados (20px) e os
padrões de 24px, e **74 dos 120px são moldura**.

**Correção concreta:** ícone de 20px alinhado à linha do título (não pastilha de
30px), `mt-2` no lugar dos dois `mt-2.5`, `py-1` nos chips. A conta fecha em
12+20+8+24+8+18+12 = **102px**; tirando a linha de apoio para dentro dos chips
(o "mar 0,8 m / 12 kt" é leitura, não prosa — vira o quarto chip), fecha em
**76px**. Não chega aos 64px porque nosso cartão é um cartão com borda e a
referência é uma linha dentro de um painel; é o mais perto honesto.

### 1.2 `LinhaLista` já está nos 64px — e é aí que ela perde

**Onde:** `web/components/ui/linha-lista.tsx:80` (`variant="grupo"`, `py-3`).

Conta: 12 + 12 de padding + 20,25 do título = **44px** sem subtítulo; com
subtítulo (`mt-0.5` + `.apoio`) = **64px**. Ou seja, a nossa linha densa está
exatamente na altura da referência.

**O problema não é altura, é carga.** Nos 64px o Haulix põe duas linhas de texto
**e três chips**; nós pomos duas linhas de texto e, à direita, um número. O
componente não tem slot de chip: os props são `leading`, `titulo`, `subtitulo`,
`valor`, `valorSecundario`, `trailing`, `chevron` (`:25-53`). Quem quer chip
escreve à mão — foi o que o Diário fez (:218-240) e por isso ele virou cartão de
120px em vez de linha de 64.

**Correção:** um slot `chips?: ReactNode` em `LinhaLista`, renderizado na
segunda linha do bloco do meio, com a mesma pílula do Diário promovida a
componente. Isso é o que faz a lista do app inteiro passar a carregar a
informação que hoje só existe em cartão gordo.

### 1.3 `/barco` gasta 457px de tela só com cabeçalho de seção

**Onde:** `web/app/(app)/barco/page.tsx` — **8** usos de `SecaoPagina`
(:134, :157, :207, :244, :279, :307, :336, :380), 5 deles com ação.

`SecaoPagina` (`web/components/ui/secao-pagina.tsx:39`) tem `mt-6 mb-2` = 24 + 8
= **32px de moldura fixa** por seção. A linha em si mede 30px quando há ação
(`ALVO_ACAO` é `min-h-11` com `-my-[7px]`, ou seja 44 − 14) e ~17px quando não
há.

Conta: 5 × (24+30+8) + 3 × (24+17+8) = **457px**.

A 390×844, descontando a folga da bottom-nav (`FOLGA_BASE` = 4,75rem = 76px,
`lib/ui/superficies.ts:110`) e o `pt-5` do layout, sobram ~748px de tela útil.
**457px = 61% de uma tela cheia gasta em cabeçalho de seção**, antes de
qualquer conteúdo.

**Correção:** `mt-6` vira `mt-5` só quando a seção anterior terminou em cartão
(que já tem padding próprio) — ou, melhor, `SecaoPagina` ganha um `denso` que
usa `mt-4 mb-1` (16+4 = 20px) e `/barco` adota. Economia aritmética: 8 × 12 =
96px, ~13% de tela. O ganho maior é estrutural: `/barco` tem **8 seções numa
tela só**, o que é um índice fingindo de ficha. A referência resolve isso com
`Abas` — e `Abas` existe (`components/ui/abas.tsx`), com 4 consumidores, nenhum
deles `/barco`.

---

## Eixo 2 — Hierarquia dentro do cartão

A régua é o §3 item 3 do spec: *"lá é ícone + título + subtítulo explicativo +
ação à direita. O nosso não tem o subtítulo — é ele que faz o painel parecer
instrumento documentado em vez de caixa com rótulo."*

### 2.1 O subtítulo explicativo não existe em componente nenhum

**Onde:** `web/components/ui/cartao.tsx:12-22` (props: `icone`, `titulo`,
`selo`, `acao`, `plano`, `className`, `children`) e
`web/components/ui/cabecalho-cartao.tsx:20-33` (props: `icone`, `titulo`,
`selo`, `acao`, `className`).

Nenhum dos dois tem `subtitulo`. O item 3 do §3 do spec — a peça que o próprio
spec nomeia como a que separa "instrumento documentado" de "caixa com rótulo" —
**não foi construída**. Não é dívida de aplicação, é dívida de API.

**Correção:** `subtitulo?: string` nos dois, renderizado abaixo do título em
`.rotulo-dado` (a voz já existe, `globals.css:417`). Um cartão "Gastos do mês"
vira "Gastos do mês / Despesas pagas nos últimos 6 meses" e passa a explicar o
gráfico que já está embaixo dele.

### 2.2 A anatomia completa da referência existe em 1 tela de 92

**Medido** por importações de `@/components/ui/*`:

| componente | importadores | onde |
|---|---|---|
| `ProgressoRota` | **0** | — (spec §2 item 6, **P0**) |
| `GraficoArea` | **0** | — (spec §2 item 4) |
| `AlternadorVisao` | **0** | — |
| `ColunaQuadro` | **0** | — |
| `CabecalhoCartao` | 1 | `barco/equipamento/[id]` |
| `MigalhaPao` | 1 | idem |
| `FaixaKpi` / `PastilhaKpi` | 1 | idem |
| `GradeRotuloValor` | 1 | idem |
| `BotaoFicha` | 1 | idem |
| `BotaoCirculo` | 1 | idem |
| `FaixaAlerta` | 1 | idem |
| `Medidor` | 1 | `components/mapa/navegar-mapa.tsx` |
| `DonutNivel` | 1 | `combustivel` |
| `PainelDuplo` | 1 | `mecanica` |
| `BarraCapacidade` | 3 | `estoque`, `frota`, `barco/fotos` |
| `Abas` | 4 | `notificacoes`, `financeiro-nav`, `barco/resumos`, `barco/equipamento/[id]` |
| `GraficoBarras` | 4 | `hoje`, `frota`, `barco/resumos`, `financeiro` |

Sete dos componentes têm exatamente um importador, **e é o mesmo arquivo**. A
ficha de equipamento é a única tela do Commander construída na anatomia da
referência. `/hoje`, `/barco`, `/diario`, `/financeiro`, `/notificacoes` — as
cinco que o dono abre — não usam nenhum dos sete.

**Correção:** as fichas que já existem (saída do Diário, ocorrência, lançamento,
compromisso da Agenda) adotam o par `MigalhaPao` + `FaixaKpi` + `BotaoFicha`. É
replicação, não desenho novo: o spec §5 já declara o comportamento responsivo de
cada peça e a ficha de equipamento é a prova de que funciona.

### 2.3 O material do §3.1 e o raio do §3.2 foram criados e nunca ligados

**Onde:** `web/app/globals.css:52` (`--raio-painel: 16px`), `:297`
(`--lustro-painel`), `:313` (`.painel-lustro`), `:316` (`.raio-painel`).

**Consumidores fora de `globals.css`: zero.** Varredura por `raio-painel` e
`painel-lustro` em todo `web/` devolve só as três definições.

O spec §3.1 pede que o painel deixe de ser chapado e ganhe gradiente de 2–3%;
§3.2 pede que o painel de primeiro nível vá a 16px e o aninhado fique em 14,
para que **o raio passe a significar profundidade**. Os dois tokens foram
escritos com o comentário explicando o porquê, e nenhum cartão do app os usa.
Hoje `Cartao`, `LinhaLista variant="cartao"`, `EstadoVazio variant="cartao"` e
os cartões escritos à mão usam todos `rounded-[var(--raio-cartao)]` (14px) — a
hierarquia de raio é plana, exatamente o que o spec diz que achata.

**Correção:** `Cartao` ganha `nivel?: "painel" | "aninhado"` (padrão `painel`)
que escolhe entre `.raio-painel`+`.painel-lustro` e `--raio-cartao` seco. É uma
mudança em um arquivo que acerta os ~40 cartões de primeiro nível de uma vez.

### 2.4 Três paddings para o mesmo gesto "cartão"

| componente | linha | padding |
|---|---|---|
| `Cartao` | `components/ui/cartao.tsx:29` | `p-3` = **12px** |
| `LinhaLista variant="cartao"` | `components/ui/linha-lista.tsx:79` | `p-3.5` = **14px** |
| `EstadoVazio variant="cartao"` | `components/ui/estado-vazio.tsx:54` | `p-4` = **16px** |
| cartão do Diário (à mão) | `app/(app)/diario/page.tsx:283` | `p-3` = **12px** |

E `14px` não é degrau da escala base-8 que o `docs/DESIGN.md` §5 declara
(4, 8, 12, 16, 24, 32, 48). Pior: em `/barco/mapa` os três cartões da mesma
coluna usam `p-3` (:174), `px-4` (:185) e `p-4` (:217, :272) — lado a lado, três
respiros diferentes.

**Correção:** `p-3` (12px) em tudo, que é a decisão já tomada em `Cartao` com o
comentário "a referência é densa". Um valor, três arquivos.

---

## Eixo 3 — Movimento e estado

Este é o eixo onde a distância é maior, e é o que mais denuncia o app.

### 3.1 Feedback de toque: zero

**Medido:** `active:` aparece **0 vezes em 225 arquivos `.tsx`**. `hover:`
aparece 24 vezes, mas **20 delas em páginas públicas/desktop**
(`app/page.tsx`, `app/parceiros/page.tsx`, `components/legal/pagina-legal.tsx`,
`components/faixa-topo.tsx`, `components/trilho-lateral.tsx`) — ou seja, no
produto de celular há `hover:` em 2 lugares e `active:` em nenhum.

O caso que dói: a **bottom-nav**
(`web/components/bottom-nav.tsx:89-91`), tocada em toda tela, troca só a cor do
texto e **não tem `transition`, `active:` nem `duration-`**. Um toque não produz
nenhum retorno até a rota trocar. No Waze, o botão afunda antes de o mapa
mexer — é isso que faz o app parecer que ouviu.

**Correção:** uma classe única `active:scale-[.97] active:opacity-90
transition-transform duration-100` aplicada em `ALVO_ACAO`, `PILULA_ACAO*`,
`Chip`, `LinhaLista` (quando tem `href`), `BotaoFicha`, `BotaoCirculo` e a
bottom-nav. Sete arquivos, e o app inteiro passa a responder ao dedo. Já está
coberto por `prefers-reduced-motion` (a regra wildcard de `globals.css:513-515`
zera qualquer `transition-duration`).

### 3.2 Estado de carregamento: 1 desenho para 92 telas, e 0 para as outras 29

**Medido:**

| métrica | valor |
|---|---|
| `loading.tsx` no projeto | **1** (`app/(app)/loading.tsx`) |
| `page.tsx` em `app/(app)` | **92** |
| `page.tsx` em todo `app/` | **121** |
| rotas fora de `(app)` com estado de carregamento | **0 de 29** |
| `<Suspense>` | **2** (`app/(app)/layout.tsx:80` com `fallback={null}`; `app/(app)/hoje/page.tsx:727`) |
| esqueletos reais | **2** |
| componente de esqueleto reutilizável | **0** |

O único `loading.tsx` (`web/app/(app)/loading.tsx:3-12`) desenha: um bloco de
`h-44` (176px), uma barra de `h-5 w-2/5`, dois de `h-20` e dois de `h-16` em
grade de 2. **Isso é a silhueta da Início** — foto de capa, título, dois
cartões, dois KPIs. É o esqueleto de `/diario`, de `/financeiro`, de
`/barco/mapa`, de `/menu` e de mais 88 telas. Em qualquer uma delas o esqueleto
mente sobre o que vai chegar, e a chegada é um salto de layout.

Além disso o mesmo arquivo usa **quatro raios** — `rounded-[16px]`, `rounded`,
`rounded-[14px]`, `rounded-[10px]` — e dois deles não são token nenhum.

**Correção:** um componente `Esqueleto` com três formas declaradas (`lista`,
`ficha`, `painel`) e um `loading.tsx` por natureza de tela — a taxonomia já
existe no spec de arquitetura §2. Quatro arquivos cobrem as 92 rotas com a forma
certa.

### 3.3 Enviar formulário não muda nada na tela

**Medido:** `useTransition`, `startTransition`, `isPending`, `useFormStatus`,
`useActionState`, `useOptimistic` — **0 ocorrências cada**, com `react` em
19.2.8 no `package.json`. Dos **73 arquivos com formulário**, **2** mostram
estado de envio, e os dois usam `useState` manual em componente de mapa
(`components/mapa/planejar-viagem-mapa.tsx:380-383`,
`components/mapa/navegar-mapa.tsx:1760-1763`). **2 de 73 = 2,7%.**

Três casos concretos do que acontece hoje:

- **Login** (`app/(auth)/login/page.tsx:110,136` e o segundo formulário em
  `:181,195` — conferido depois do commit `1564e79`, que reescreveu a tela) —
  os **dois** botões saem sem `disabled`, sem `type`, sem `useFormStatus` e sem
  transição. Tocar em "Entrar" não muda um pixel; nada impede o duplo-toque, que
  dispara a server action duas vezes. De quebra, os dois têm alturas diferentes
  — `h-12` (48px) e `h-11` (44px) — na mesma tela: é o achado 5.10 nascendo em
  código novo, o que mostra que a régua de altura precisa virar token antes de
  virar revisão.
- **Editar barco** (`app/(app)/barco/editar/page.tsx:35,161`) — formulário de 15
  campos, zero retorno ao salvar.
- **Novo lançamento** (`app/(app)/financeiro/novo/page.tsx:87,166`) —
  `encType="multipart/form-data"`, ou seja **upload de comprovante**. É o
  caminho mais longo do app e o botão fica idêntico do primeiro ao último byte.

**Correção:** um `<BotaoEnviar>` client que usa `useFormStatus` — trocar o
rótulo por "Salvando…" e aplicar `disabled` enquanto pendente. É um componente
e um `find/replace`; resolve os 73 arquivos porque todos usam
`<form action={...}>`.

### 3.4 O ponteiro do medidor teleporta

**Onde:** `web/components/ui/medidor.tsx:236-250` — a `<line>` do ponteiro não
tem `transition` nenhuma.

O `Medidor` recebe SOG a cada tique do `watchPosition`. Sem transição, a agulha
salta de posição. Um velocímetro que salta lê como SVG re-renderizado; um que
varre lê como instrumento. É a diferença exata entre a nossa peça e a da
referência, e custa uma linha.

**Correção:** `style={{ transition: "transform .35s cubic-bezier(.2,.8,.2,1)" }}`
com o ponteiro desenhado por rotação em vez de recálculo de ponta. Coberto por
`prefers-reduced-motion` de graça.

### 3.5 Quem pediu menos movimento fica olhando um bloco cinza parado

**Onde:** `web/app/globals.css:513-515`.

A regra `@media (prefers-reduced-motion: reduce)` usa wildcard `*` e
`!important` para zerar **toda** `animation-duration` do documento. Isso alcança
os dois `animate-pulse` que são os únicos esqueletos do app
(`app/(app)/loading.tsx:3` e `app/(app)/hoje/page.tsx:729`): para quem tem
"reduzir movimento" ligado, os esqueletos ficam **estáticos**, sem nenhum outro
indicador de que algo está carregando.

**Correção:** o esqueleto novo (3.2) carrega `role="status"` + texto
`sr-only`, e uma variação de opacidade em vez de pulso — ou um
`motion-reduce:` explícito com `opacity` fixa mais alta. O `aria-busy` que já
existe em `loading.tsx:3` é o começo certo, mas não pinta nada.

---

## Eixo 4 — O mapa (`/navegar`)

Aqui o Navionics é a régua, e o mapa é a tela mais bem construída do app —
watcher único, honestidade de GPS, painel consolidado na onda 80, entrada
automática no modo navegando. Os achados abaixo são de acabamento sobre uma base
boa, não de reconstrução.

### 4.1 A tela tem duas cores de marca ao mesmo tempo

**Medido:**

- `web/app/globals.css:15` — tema claro: `--acao: #d4af37` (dourado).
- `web/app/globals.css:142` — tema escuro: `--acao: #d6f24a` (limão).
- `web/app/layout.tsx:92` — **o escuro é o padrão** do app.
- `web/components/mapa/navegar-mapa.tsx:99` — `const COR_DOURADO = "#D4AF37"`,
  usado na linha da rota (:884), no pino de destino (:247), na origem (:223), no
  halo tracejado (:242) e na linha de rumo (:859).

Consequência, na mesma tela e ao mesmo tempo: **a linha da rota é dourada e a
pílula de SOG ao lado dela é limão** (`:1598`, `text-accent`). O marcador do
próprio barco é dourado (`:166`, `bg-[#D4AF37]`) e o botão "Voltar ao barco" é
limão (`:1907`, `bg-accent`).

O mesmo hexadecimal literal está em `ver-viagem-mapa.tsx:18`,
`planejar-viagem-mapa.tsx:21`, `trilha-mapa.tsx:13` e nos estados de falha de
`mapa-nautico.tsx:619,639,647`.

**Agravante documental:** o comentário do `Mostrador`
(`navegar-mapa.tsx:296-298`) afirma que `text-accent` *"é o único dourado da
marca que NÃO troca entre os dois temas"*. Isso deixou de ser verdade na onda
79 e o comentário não acompanhou — é a classe de divergência que o próprio
`docs/DESIGN.md` §5 diz ser pior que documentação nenhuma.

**Correção:** as camadas do Mapbox pintam em canvas WebGL e realmente não leem
`var(--cor)` — mas dá para ler o token uma vez no cliente
(`getComputedStyle(document.documentElement).getPropertyValue("--acao")`) e
alimentar `line-color`/`circle-color` com ele, reagindo à troca de tema. Um
helper em `lib/mapa/` e os quatro arquivos param de cravar a cor. Isso também
derruba boa parte das 91 cores literais que `lib/ui/tokens.test.ts` cataloga —
**39 delas (43%) vivem em `components/mapa/`**.

### 4.2 Os três controles que se toca com o barco balançando têm 32px

**Onde:** `web/app/globals.css:473-478` — o comentário declara a decisão:
*"Tamanho NÃO mexido de propósito (fica nos 32px default do mapbox-gl.css)"*,
porque os sprites do Mapbox são dimensionados contra esse tamanho.

São zoom, bússola e localizar. O `docs/DESIGN.md` §5 escreve **44px, sem
exceção**, e a varredura mede isso em toda tela — menos aqui, porque o markup é
do Mapbox. **32 contra 44 é 27% abaixo da régua**, na tela de mar aberto.

Some a isso o botão de fechar do painel de camadas: `size-7` = **28px**
(`components/mapa/mapa-nautico.tsx:667`).

**Correção:** o sprite é `background-image` posicionado; dá para manter o
sprite em 32px e crescer só a caixa do `button` para 44px com
`background-position: center`. Se algum ícone desalinhar, o caminho B é
substituir os três por controles próprios — já temos `BotaoCirculo`, que é
exatamente essa peça e tem 1 consumidor.

### 4.3 A escala do velocímetro renderiza a 9,5px

**Onde:** `web/components/ui/medidor.tsx:224` (`fontSize="9.5"` nos números da
escala) e `web/components/mapa/navegar-mapa.tsx:1652`
(`className="max-w-[200px]"`).

Aritmética: o `viewBox` é `0 0 200 160`; com a caixa travada em 200px CSS o
fator de escala é 1,0, então **9,5 no viewBox = 9,5px na tela**. O
`globals.css:333` declara o piso: *"nada abaixo de 11px"*. Em outros usos o
componente escala (a caixa interna é `max-w-[260px]` → 12,35px) — mas o único
uso real hoje é o de 200px.

**Correção:** `fontSize="11"` e o raio das marcas ajustado, ou soltar o teto em
`/navegar` para 240px. A segunda é melhor: o cartão flutuante tem
`sm:max-w-[380px]` (`:1561`), sobra largura.

### 4.4 A barra de progresso da rota — P0 do spec — tem dado, tem componente, e não tem ligação

**Onde:** o dado é calculado em `web/components/mapa/navegar-mapa.tsx:1089-1093`
(`progressoNaRota`, de `lib/domain/modo-navegando.ts:185`); o componente é
`web/components/ui/progresso-rota.tsx`, cujo próprio cabeçalho diz *"o dado já
existe em `progressoNaRota`. Spec §2, item 6"*. **Importadores: 0.**

O que o painel mostra hoje (`:1869-1894`) são quatro `Mostrador` numa grade 2×2
dentro de um cartão `w-64` (256px): "Próxima virada", "Restante", "ETA",
"Velocidade". A referência mostra `Dallas → Memphis` com trilho, `282.1 mi` e
`72%` — origem, destino e proporção numa peça só. É a diferença entre saber a
distância e **ver** onde se está no caminho.

**Risco aritmético a verificar em runtime (não medido):** cada célula da grade
2×2 mede ~112px; o valor sai em `text-2xl` (24px) mono, cuja largura de avanço
é ~0,6em = 14,4px/caractere. "282,1" + " MN" ≈ 97px contra ~86px de caixa útil
(112 − `px-3` − borda). Se o número passar de 4 dígitos significativos, quebra.
Trocar dois dos quatro mostradores pelo `ProgressoRota` resolve a densidade e o
risco no mesmo movimento.

### 4.5 Sair da marina sem destino não limpa a tela

**Onde:** `web/components/mapa/navegar-mapa.tsx:1131-1136` — a entrada
automática no modo navegando exige `destino != null` **e**
`emMovimento(sogKt)` (limiar de 2 kt, `lib/domain/modo-navegando.ts:22`).

Sem destino, o barco pode estar a 18 nós e a tela continua exatamente como
estava parado: painel de instrumentos aberto, fileira de botões embaixo,
`right-14` reservado para os controles. Waze e Navionics reagem a **movimento**,
não a rota — o barco em marcha é a condição hostil (sol, balanço, mão molhada),
com ou sem destino marcado.

**Correção:** separar as duas coisas. `modoSoNavegacao` (que é só recolher a
moldura) passa a entrar sozinho com `emMovimento(sogKt)`, sem exigir destino;
`modoNavegando` (câmera perseguidora + painel de rota) continua exigindo. O
`saidaManualRef` já existe e continua vencendo o automático — nenhuma lógica
nova, só uma condição a menos numa das duas.

### 4.6 Números avulsos na moldura do mapa

- `web/components/mapa/mapa-nautico.tsx:660` — o painel de camadas mora em
  `absolute right-3 top-44`. **176px cravados** que existem para não bater no
  painel de instrumentos, que é desenhado por **outro componente**
  (`navegar-mapa.tsx:1525`). Se o cartão de cima mudar de altura, os dois se
  encavalam sem nada avisar. Correção: o painel de camadas entra na mesma coluna
  `flex-col gap-2` do topo, como os outros flutuantes já entram.
- `web/lib/ui/superficies.ts:279` — a única ação flutuante do app usa
  `shadow-lg shadow-accent/30`, sombra do Tailwind tingida de acento, em vez de
  `sombra-2`. O `docs/DESIGN.md` §5 declara três elevações e essa não é
  nenhuma delas.

---

## Eixo 5 — Consistência

O `docs/DESIGN.md` §5 registra o caso fundador: *"a mesma pílula de filtro
escrita à mão em doze telas com seis alturas diferentes"*. O padrão voltou, em
outros gestos.

### 5.1 A onda 82 deu forma à ação — e parou antes da Início

**Onde:** `web/app/(app)/hoje/page.tsx:106`

```
const ACAO_CARTAO = "apoio inline-flex min-h-11 items-center text-dim"
```

Usado **8 vezes** na mesma tela (:437, :469, :517, :556, :582, :583, :619,
:663). É texto cinza de 12px — literalmente o vestido que a onda 82 identificou
como o problema (*"texto cinza é exatamente o que o app usa para rótulo e apoio,
ou seja, para o que NÃO se toca"*, `lib/ui/acoes.ts:8-11`). A onda 82 consertou
`SecaoPagina`, `EstadoVazio` e três telas; **a Início — a primeira tela do app —
ficou de fora**, com oito ocorrências.

O contraste fica dentro do mesmo cartão: em "Gastos do mês"
(`hoje/page.tsx:463-509`), a ação do estado vazio é uma pílula de contorno de
**36px** (`PILULA_ACAO_BLOCO`) e a ação do cabeçalho, dois centímetros acima, é
texto cinza sem forma nenhuma. Mesmo cartão, mesmo gesto, dois vestidos.

**Correção:** `ACAO_CARTAO` é apagado e os 8 usos viram `ALVO_ACAO` +
`PILULA_ACAO`, que é o que `SecaoPagina` já faz. Uma tela, oito linhas.

### 5.2 Sete vestidos para "ação secundária"

| vestido | onde | desenho |
|---|---|---|
| pílula de contorno 30px | `lib/ui/acoes.ts:51` | `PILULA_ACAO` |
| pílula de contorno 36px | `lib/ui/acoes.ts:66` | `PILULA_ACAO_BLOCO` |
| pílula cheia 36px | `lib/ui/acoes.ts:77` | `PILULA_ACAO_PRINCIPAL` |
| texto cinza 12px | `app/(app)/hoje/page.tsx:106` | `ACAO_CARTAO`, 8 usos |
| mono dourado rastreado | `app/(app)/diario/page.tsx:109` | `rotulo ... text-accent-forte` |
| texto dourado 14px | `app/(app)/barco/eletrica/page.tsx:112` | `corpo text-accent-forte` |
| texto dourado 12px, alvo de 24px | `app/(app)/diario/page.tsx:275` | `apoio ... min-h-6 text-accent-forte` |
| botão de contorno largura inteira | `app/(app)/agenda/[id]/page.tsx:185`, `app/(app)/diario/[id]/compartilhar-botao.tsx:50` | `rounded-xl border border-accent/40` |
| texto cinza largura inteira 44px | `app/(app)/diario/[id]/horas/page.tsx:109` | `h-11 text-sm text-dim` |

Nove entradas, três legítimas (as de `acoes.ts`, que são declaradas e
justificadas), seis à mão. O `min-h-6` (24px) de `diario/page.tsx:275` é alvo de
toque abaixo da régua.

**Correção:** `PILULA_ACAO_LARGA` entra em `acoes.ts` para o caso "ação que
ocupa a linha" e as seis à mão passam a apontar para uma das quatro constantes.

### 5.3 `.valor` — a voz que a onda 80 criou para o dado — tem ZERO usos

Este é o achado mais caro do eixo, e ele desmente o que a onda 80 acredita ter
entregue.

`globals.css:372-378` declara `.valor`: 14px, peso 500, `color: var(--texto)`,
`tabular-nums`. O comentário acima dela (`:369-371`) explica o porquê — *"A VOZ
QUE NÃO EXISTIA: o dado em si. Branco, médio, tabular — é o que o olho procura
primeiro num painel, e o que estava cinza igual ao rótulo."*

**Medido: `.valor` aparece 0 vezes em `className` nos 225 arquivos `.tsx`.**

O que ocupou o lugar dela é `text-sm` — **222 usos** — que dá o mesmo 14px e
**não** traz peso, **não** traz cor e **não** traz `tabular-nums`. Ou seja: o
par rótulo-cinza / valor-branco que a onda 80 identificou como a origem da
hierarquia foi escrito no CSS e nunca chegou ao JSX. O diagnóstico do dono que
abriu aquela onda — *"não tem hierarquia, tá bem amador"* — continua descrevendo
o app renderizado, porque a correção parou no arquivo de tokens.

A escala como um todo é usada, e bem: **1.271 usos das classes do repositório
contra 451 tamanhos avulsos do Tailwind — razão de 2,82 : 1** (73,8% / 26,2%).
O problema é onde a razão quebra:

| tamanho | classe da escala (usos) | concorrente avulso (usos) |
|---|---|---|
| **14px** | `.corpo` 303 + **`.valor` 0** | **`text-sm` 222** |
| 11px | `.rotulo` 198 + `.rotulo-dado` 9 | `text-[11px]` 77 + `text-[11.5px]` 1 |
| 12px | `.apoio` 593 | `text-xs` 54 + `text-[12px]` 3 |
| 15px | `.titulo-card` 102 | `text-[15px]` 5 |
| 24px | `.titulo-pagina` 66 | `text-2xl` 4 |

Os 77 `text-[11px]` são o segundo caso: 28% do gesto "micro-rótulo" não passa
por `.rotulo`, e por isso não herda `letter-spacing: .16em`, `uppercase` nem a
família mono.

E o número de instrumento — a voz mais importante de um app que se comporta
como instrumento — tem **sete tamanhos**, dos quais nenhum é `.valor`:

| tamanho | onde |
|---|---|
| 12px | `PastilhaKpi` (`faixa-kpi.tsx:51`), chips do Diário (`diario/page.tsx:220`), pílula de SOG (`navegar-mapa.tsx:1598`) |
| 14px | `LinhaLista` (`linha-lista.tsx:72`, via `text-sm`) |
| 18px | `Mostrador tamanho="lg"` (`navegar-mapa.tsx:330`) |
| 20px | `Kpi` (`kpi.tsx:33`, `text-[20px]`) |
| 22px | nome do barco no herói (`card-embarcacao.tsx:133`, `text-[22px]`) |
| 24px | `Mostrador variante="cartao"` (`navegar-mapa.tsx:321`, `text-2xl`) |
| clamp 18–34px | número central do `Medidor` (`medidor.tsx:258`) |

**Correção, em duas partes.** Primeiro: os `text-sm` que são **dado** (valor de
`LinhaLista`, número de contagem, coluna de dinheiro) viram `.valor` — é o que
faz a hierarquia aparecer, e é uma troca de classe. Segundo: três degraus
declarados para o número — `.valor` (14, o de lista), `.valor-forte` (20, o de
KPI) e `.valor-instrumento` (28, o de mostrador) — e os `text-[Npx]` apontam
para um dos três. `text-[22px]` do herói vira `.titulo-pagina`.

### 5.4 A altura do gráfico tem cinco valores, e um deles contraria o próprio spec

| altura | onde |
|---|---|
| 72px | `hoje/page.tsx:494` |
| 110px | `barco/resumos/page.tsx:219` |
| 140px (celular) | padrão de `grafico-barras.tsx:33` e `grafico-area.tsx:58` |
| **180px (desktop)** | padrão de `grafico-barras.tsx:33` |
| **200px (desktop)** | padrão de `grafico-area.tsx:58` |

O spec §5 escreve: *"altura fixa por breakpoint (140px celular / 200px
desktop)"*. `GraficoArea` obedece e documenta (`grafico-area.tsx:66`);
`GraficoBarras` usa 180 sem justificativa. Dois gráficos irmãos, dois desktops.

### 5.5 O gráfico nasce com a cor errada, e todo mundo corrige na mão

**Onde:** `web/components/ui/grafico-barras.tsx:30` — `cor = "var(--acao)"`.

`--acao` é a cor de ação/marca; `docs/DESIGN.md` §5 reserva a cor de dado para
`--dado`/`--dado-2`. **Os 4 consumidores passam `var(--dado)` explicitamente**, e
**dois deles escreveram comentário explicando que precisam sobrescrever**
(`financeiro/page.tsx:160-163`, `frota/page.tsx:104-107`), citando que a onda 63
já tinha corrigido o mesmo defeito no componente antigo.

Quando 4 de 4 consumidores contornam o padrão e 2 documentam o contorno, o
padrão está errado. `GraficoArea:57` tem o mesmo padrão e zero consumidores —
o próximo a usar herda o defeito.

**Correção:** `cor = "var(--dado)"` nos dois. Uma linha em cada.

### 5.6 O rótulo do eixo X fica abaixo do piso tipográfico

**Onde:** `web/components/ui/grafico-barras.tsx:107` —
`text-[10px] ... sm:text-[11px]`. No celular, os rótulos de mês do gráfico da
Início saem a **10px**, contra o piso de 11 declarado em `globals.css:333`.

### 5.7 A contagem continua escrita de três jeitos

| forma | onde |
|---|---|
| dentro da pílula | `Chip contagem` (`chip.tsx:70-72`), `Abas` |
| `rótulo: valor` na pastilha | `PastilhaKpi` (`faixa-kpi.tsx:50-51`) |
| número mono solto ao lado do título | `barco/mapa/page.tsx:276`, `notificacoes/page.tsx:129` |

A referência tem **um** jeito: número colado no rótulo, dentro do chip. O
achado 12 da auditoria de 18/08 foi corrigido nos chips e nas abas e sobreviveu
nos dois lugares acima.

### 5.8 Divergências de documentação que já custaram trabalho

- `web/app/globals.css:3` — *"Light é o padrão (uso sob sol na marina); dark é
  preferência do usuário"*. `app/layout.tsx:92` faz o contrário: o escuro é o
  padrão desde a fundação visual. O comentário está no topo do arquivo de
  tokens, que é o primeiro lugar onde alguém olha.
- `web/lib/ui/largura.ts:15` — a conta dos 640px cita *"à 16px da IBM Plex
  Sans"*. A fonte é **Inter** desde a onda 80, e a Inter tem largura de avanço
  diferente: a mesma conta de 45–75 caracteres não dá 640px. O número pode até
  continuar certo, mas a justificativa escrita não sustenta mais.
- `web/components/mapa/navegar-mapa.tsx:296-298` — ver 4.1.

### 5.9 O raio: 4 tokens declarados, 13 raios em uso, 86% escritos à mão

**Medido** sobre 946 usos de `rounded-*` em `.tsx`:

| forma | px | usos | passa por token? |
|---|---|---|---|
| `rounded-[14px]` | 14 | **267** | não — é o valor de `--raio-cartao`, à mão |
| `rounded-lg` | 8 | **202** | não — é o valor de `--raio-controle`, à mão |
| `rounded-full` | ∞ | **151** | não |
| **`rounded-xl`** | **12** | **129** | **não — 12px não é token nenhum** |
| `rounded-[var(--raio-cartao)]` | 14 | 66 | sim |
| `rounded-[var(--raio-controle)]` | 8 | 46 | sim |
| `rounded-[10px]` | 10 | 32 | não |
| `rounded-[var(--raio-pilula)]` | ∞ | 19 | sim |
| `rounded-[12px]` | 12 | 15 | não |
| `rounded-[16px]` | 16 | 5 | não — é o valor de `--raio-painel` |
| outros (`rounded`, `rounded-md`, `rounded-t-[20px]`, `[18px]`, `[3px]`, `[26px]`, `[34px]`, `rounded-t-2xl`) | 3–34 | 13 | não |

**131 de 946 usos (13,8%) passam por token. 815 (86,2%) são escritos à mão.**
Os 4 tokens declarados viraram **13 raios distintos em uso real** — 3, 4, 6, 8,
10, 12, 14, 16, 18, 20, 26, 34 e `full`.

Dois fatos que doem mais que o percentual:

- **`rounded-xl` (12px) tem 129 usos e não é token nenhum.** É o quinto raio de
  facto do app, e sozinho quase empata com todos os 131 usos tokenizados
  somados. O `docs/DESIGN.md` §5 diz *"quatro raios diferentes na mesma tela é
  sintoma, não estilo"* — temos treze no app.
- **`--raio-painel` tem 0 usos via token e 5 via `rounded-[16px]`.** Ou seja: o
  valor até circula, mas não pelo caminho que faz o raio significar
  profundidade (ver 2.3).

**Correção:** `rounded-lg` → `rounded-[var(--raio-controle)]`, `rounded-[14px]`
→ `rounded-[var(--raio-cartao)]`, `rounded-full` →
`rounded-[var(--raio-pilula)]` são substituições mecânicas e seguras (mesmo
valor). `rounded-xl` e `rounded-[10px]` (161 usos somados) exigem decisão: cada
um é ou um controle (8) ou um cartão (14). Não há terceiro caso.

### 5.10 O alvo de toque tem 9 alturas

O `docs/DESIGN.md` §5 escreve **44px, sem exceção**. **Medido** em 869 elementos
interativos (`button`, `a`, `Link`, `input`, `select`, `textarea`, `label`):

- **152 (17,5%)** declaram altura; **717 (82,5%)** não declaram nenhuma — a
  altura sai indiretamente de `py-*` mais `line-height`.
- Entre os que declaram: `h-11`/`min-h-11` (44px) somam **129** — a régua está
  ganhando. As exceções são **24, 32, 36, 40, 46, 48 e 88px**, em 20 pontos.

| altura | onde (exemplos) |
|---|---|
| **24px** | `app/(app)/diario/page.tsx:275` (`<a min-h-6>`, "Abrir anexo"), `components/mapa/mapa-nautico.tsx:187` |
| 32px | `components/ui/alternador-visao.tsx:37` |
| 36px | `components/mapa/navegar-mapa.tsx:1672` (as abas do painel de instrumentos) |
| 40px | `app/(app)/financeiro/relatorios/page.tsx:165`, `app/(app)/marketplace/[id]/page.tsx:330,338` |
| 46px | `app/(app)/agenda/page.tsx:388` |
| 48px | login `:103`, onboarding `:247,255`, `carteira/page.tsx:121`, `explorar/[id]` ×3, e mais 5 |
| 88px | `components/campos-navegacao-evento.tsx:165` |

**A nona altura é a que ninguém declarou:** `web/lib/ui/form.ts:7` define todo
campo de formulário como `px-3 py-3 text-base`, **sem altura mínima**. Conta:
16 × 1,5 + 12 + 12 + 2 de borda = **~50px**. São ~103 usos em 36 arquivos e 349
instâncias de `Campo`/`CampoSelect`/`CampoTextarea`. O campo de formulário — o
controle mais repetido do app — tem uma altura que não é 44 nem 48 e que nenhum
arquivo escreve.

**E não existe token de altura.** Não há `--altura-controle` em `globals.css`;
os quatro tokens de forma cobrem raio, e a elevação cobre sombra. A altura, que
é a medida que a régua de 44px protege, nunca virou token.

**Correção:** `--altura-controle: 44px` e `--altura-campo: 48px` em
`globals.css`, `form.ts` passa a declarar `h-[var(--altura-campo)]`, e os 20
pontos fora do padrão viram um dos dois. `h-12` (48px) é defensável para a ação
principal e pode virar o segundo degrau declarado — o que não é defensável é ter
nove por acidente.

### 5.11 O espaçamento tem 20 degraus onde a escala declara 7

O `docs/DESIGN.md` §5 é literal: *"Só estes valores: 4, 8, 12, 16, 24, 32, 48.
Nada de 13px, 18px, 27px. Se um espaçamento não está nessa lista, ele foi
escolhido no olho."*

**Medido** em 3.455 classes de espaçamento (`p*`, `m*`, `gap*`, `space-*`):

| categoria | usos | % |
|---|---|---|
| na escala | 2.727 | 78,9% |
| **fora — inteiros** (`-5`, `-7`, `-10`, `-14`, `-16`, `-20`, `-24`, `-36`) | **143** | 4,1% |
| **fora — fracionários** (`.5` → 2, 6, 10, 14px) | **572** | 16,6% |
| **total fora** | **715** | **20,7%** |

Valores em uso: 0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64,
80, 96, 144 — **20 degraus**.

Os maiores infratores, e o que cada um é:

- **`mt-5` (20px) × 61** — quase todos o mesmo gesto: a margem entre o cabeçalho
  da tela e o primeiro bloco, em 61 telas. É um degrau inteiro que não existe na
  escala, repetido o suficiente para virar convenção de facto.
- **`gap-1.5` (6px) × 95** e **`mt-0.5` (2px) × 96** — a folga interna de chip e
  a distância título/subtítulo. Defensáveis como micro-ajuste ótico, mas não
  declarados em lugar nenhum.
- **`py-3.5` (14px) × 53, `py-2.5` (10px) × 43, `py-1.5` (6px) × 30** — três
  paddings verticais para o mesmo gesto (a caixa de um controle), todos fora da
  escala. É a versão 2026 do "seis alturas para a mesma pílula".

**Correção:** `mt-5` → `mt-6` (24px, na escala) é uma troca mecânica de 61
pontos e fecha 8,5% da deriva sozinha. Os fracionários pedem decisão: ou a
escala ganha 2 e 6 declarados como micro-degraus (defensável — eles fazem
trabalho ótico real), ou eles somem. O que não pode continuar é os três
`py-*.5` de controle: esses viram um.

### 5.12 O `tracking` tem 11 valores para um gesto só

**Medido:** 47 usos de `tracking-[...]` com **11 valores distintos** — `.1em`
(11), `.12em` (9), `.14em` (9), `.06em` (5), `.08em` (3), `.16em` (2), `-0.02em`
(2), `.09em` (2), `.2em` (2), `.05em`, `.28em`.

Todos fazem a mesma coisa: rótulo em caixa alta, rastreado. O `.rotulo` de
`globals.css:388` já declara `letter-spacing: .16em` — e `.16em` é o **sexto
mais usado** da lista, com 2 ocorrências.

Cada um desses 47 pontos é uma cópia à mão de `.rotulo` que derivou. É
exatamente o mecanismo que o `docs/DESIGN.md` §5 descreve na história da pílula
de filtro, um nível abaixo.

**Correção:** os 47 viram `.rotulo` (ou `.rotulo-dado`, quando é legenda de
valor em caixa de frase). Nenhum caso justifica `.28em`.

### 5.13 O teto de cor literal está em 91 — e o número real é 106

**Onde:** `web/lib/ui/tokens.test.ts:37-62`.

A catraca funciona bem: teto **por arquivo** (não soma), 24 entradas, soma 91,
contagem real 91, **folga zero**. Nenhum arquivo tem crédito sobrando.

Três leituras:

1. **O mapa é 43% do total.** `navegar-mapa` 11 + `mapa-nautico` 10 +
   `trilha-mapa` 7 + `planejar-viagem` 4 + `ver-viagem` 4 + `card-parceiro` 2 +
   `escolher-pino-parceiro` 1 = **39 de 91**. Resolver a leitura de token no
   canvas (4.1) derruba o teto quase pela metade de uma vez.

2. **Duas cores são 55 das 91.** `#0B1D2D`/`#0b1d2d` aparece **28** vezes e
   `#D4AF37`/`#d4af37` **27**. E as duas estão escritas em **duas grafias cada**
   (maiúscula e minúscula) — o mesmo vale para `#E9F1F8`/`#e9f1f8` e
   `#ff5c5c`/`#FF5C5C`. Quatro cores, oito grafias.

3. **O teto tem um buraco: `rgb()`.** O regex do teste (`:108`) conta só `#`.
   Existem **15 ocorrências** de `rgb(`/`rgba(` em `.tsx`, e pelo menos **10
   são as mesmas duas cores já tokenizadas** — `rgb(11 29 45)` é `#0b1d2d`
   (`card-embarcacao.tsx:111,120,134`, `mock-telas.tsx:38`) e
   `rgb(212_175_55/.10)` é `#d4af37` (`app/(auth)/login/page.tsx:51`). Mais três
   em `components/farol.tsx:5-7` (`rgba(47,208,122)` = `#2fd07a`,
   `rgba(255,176,32)` = `#ffb020`, `rgba(255,92,92)` = `#ff5c5c`).

   **A contagem real de cor literal é 106, não 91.** E qualquer `#0b1d2d`
   reescrito como `rgb(11 29 45)` passa nos três testes com o teto intacto — é a
   porta que a catraca foi escrita para fechar, aberta por notação.

**Correção do buraco (barata):** somar `rgba?\(` ao regex de `tokens.test.ts` e
subir os 24 tetos para o número real medido. O teto sobe de 91 para 106 e a
catraca volta a cobrir o que promete. Subir um teto para dizer a verdade não é
afrouxar a régua — afrouxar seria continuar medindo metade.

---

## Eixo 6 — Acabamento que vende

### 6.1 Oito rótulos para o mesmo gesto "abrir a seção"

**Medido:** `Ver tudo`, `Ver todas`, `Ver todos`, `Ver detalhes`, `Ver ficha`,
`Ver financeiro`, `Gerenciar`, `Completar`. **Sete deles convivem na Início**
(`hoje/page.tsx:437, 469, 517, 556, 582, 583, 619, 663`); os demais estão em
`barco/page.tsx:157,336`, `barco/hidraulica:45`, `barco/seguranca:52`,
`financeiro/page.tsx:202`, `parceiro/page.tsx:128`.

O `docs/DESIGN.md` §6 regra 6 é explícito — *"duas telas que fazem a mesma coisa
têm que parecer a mesma coisa"* — e o vocabulário é metade dessa aparência. O
achado 25 da auditoria de 18/08 continua vivo e cresceu de cinco para oito.

**Correção:** **um** rótulo, "Ver tudo", e ele passa a ser o padrão do slot
`acao` de `SecaoPagina`/`Cartao` quando quem chama não passa nada. Exceções só
quando o verbo muda de verdade o que acontece ("Gerenciar" leva a uma tela de
edição, não a uma lista — esse fica).

### 6.2 "Completar" é um `<span>` que não se toca

**Onde:** `web/app/(app)/barco/documentos/page.tsx:164` e
`web/app/(app)/barco/equipamento/[id]/page.tsx:448`:

```
trailing={editavel ? <span className="apoio shrink-0 font-medium text-accent-forte">Completar</span> : undefined}
```

Um verbo imperativo, na cor de ação, sem `href` e sem `button`. A linha inteira
é clicável (`LinhaLista` com `href`), então o toque funciona — mas a palavra
promete uma ação específica e entrega "abrir a ficha". É o inverso do que o
`frontend-design` chama de rótulo honesto: *o controle diz exatamente o que
acontece quando é usado*.

**Correção:** ou vira a ação de verdade (`href` para o campo que falta), ou vira
o que é: um `Selo estado="atencao"` com a palavra "Incompleto". Estado é
substantivo; ação é verbo.

### 6.3 O estado vazio é o acerto do app — registre-se

**Medido:** `EstadoVazio` é usado **81 vezes em 57 arquivos**. Ele tem ícone,
título, descrição, ação com forma (pílula desde a onda 82) e duas ênfases
declaradas. O achado 11 da auditoria de 18/08 ("estado vazio desenhado de três
jeitos diferentes") está **resolvido**, e resolvido bem.

O que falta é menor e é de texto: a régua do `docs/DESIGN.md` §6 regra 4 é *"o
estado vazio explica o valor da área e oferece a ação"*. Vale uma varredura de
copy nos 81 — não medida aqui — para conferir se todos oferecem ação e nenhum
virou lápide. O componente já garante o espaço; quem escreve precisa preencher.

### 6.4 Os primeiros 5 segundos

Na Início, com dado real, a ordem que o dono vê é: saudação → foto do barco →
Saúde → pendências → Diário. Está certo, é a decisão assumida do
`docs/DESIGN.md` §4 e não deve mudar.

**O que estraga são os 5 segundos ANTES**, e isso é o eixo 3: em qualquer tela
que não seja a Início, o esqueleto genérico desenha uma foto de 176px que não
vai existir, e quando o conteúdo chega tudo salta. A percepção de "app caro" se
forma na primeira meia-tela e na primeira transição — e a nossa primeira
transição é um salto.

---

## Plano de ondas

Ordenado por **percepção ganha por unidade de esforço**. As duas primeiras são
de longe as de melhor razão.

*A numeração começa em 84 porque `master` já tem a 83 (`1564e79`, cadastro e
autenticação) — commit que, aliás, aconteceu enquanto esta auditoria estava
sendo escrita e reescreveu `app/(auth)/login/page.tsx`. Se outra onda entrar
antes, é a ordem que vale, não o número.*

### Onda 84 — O app responde ao dedo
**Entra:** `active:scale-[.97] active:opacity-90 transition-transform
duration-100` como constante única aplicada em `ALVO_ACAO`, `PILULA_ACAO`,
`PILULA_ACAO_BLOCO`, `PILULA_ACAO_PRINCIPAL`, `Chip`, `LinhaLista` com `href`,
`BotaoFicha`, `BotaoCirculo` e `bottom-nav`. Mais `ACAO_CARTAO` apagado e os 8
usos da Início migrados para `PILULA_ACAO` (achado 5.1).
**Arquivos:** 8. **Efeito visível:** todo toque no app inteiro passa a ter
retorno imediato, e a Início deixa de ter oito links invisíveis. É a correção
que muda a sensação do produto inteiro no menor número de linhas.

### Onda 85 — Enviar mostra que está enviando
**Entra:** componente `BotaoEnviar` com `useFormStatus` (rótulo + `disabled`
enquanto pendente); aplicado nos formulários de maior atrito primeiro —
login, `/barco/editar`, `/financeiro/novo` (upload), `/diario/novo`,
`/barco/ocorrencias/nova`.
**Efeito visível:** o app para de parecer que ignorou o toque no caminho mais
longo que ele tem, e o duplo-envio deixa de ser possível.

### Onda 86 — O esqueleto certo por natureza de tela
**Entra:** componente `Esqueleto` com três formas (`lista`, `ficha`, `painel`)
+ `loading.tsx` por natureza usando a taxonomia do spec de arquitetura §2;
raio via token; `role="status"` para quem pediu menos movimento (achado 3.5).
**Efeito visível:** a espera passa a prometer o que vai chegar, e a chegada para
de saltar. É o que separa "site" de "app".

### Onda 87 — `.valor` sai do papel
**Entra:** os `text-sm` que são **dado** viram `.valor` — começando por
`LinhaLista:72`, `Kpi`, as contagens e as colunas de dinheiro (5.3). Mais os
três degraus de número declarados (`.valor` 14 / `.valor-forte` 20 /
`.valor-instrumento` 28) e os `text-[Npx]` apontando para um deles; e os 77
`text-[11px]` virando `.rotulo`/`.rotulo-dado`.
**Efeito visível:** a hierarquia rótulo-cinza / valor-branco que a onda 80
descreveu passa a existir na tela. É a onda de melhor razão do eixo 5, porque é
troca de classe — nenhum layout muda, e o app inteiro ganha a leitura de relance
que hoje só o `Medidor` tem.

### Onda 88 — Um vestido, um raio, uma altura
**Entra:** `PILULA_ACAO_LARGA` em `acoes.ts` e as seis ações à mão migradas
(5.2); substituição mecânica de raio — `rounded-lg`, `rounded-[14px]` e
`rounded-full` para os tokens equivalentes, 620 pontos de mesmo valor (5.9);
`rounded-xl` e `rounded-[10px]` decididos como controle (8) ou cartão (14);
`--altura-controle`/`--altura-campo` em `globals.css` e os 20 alvos fora do
padrão migrados, incluindo `form.ts:7` (5.10); `mt-5` → `mt-6` nos 61 pontos
(5.11); os 47 `tracking-[...]` virando `.rotulo` (5.12); rótulo único "Ver tudo"
(6.1); `GraficoBarras` com `cor = "var(--dado)"` e `sm:h-[200px]` (5.4, 5.5);
rótulo de eixo a 11px (5.6); contagem sempre dentro do chip (5.7); `p-3` nos
três cartões (2.4).
**Efeito visível:** telas irmãs param de parecer produtos diferentes. É a onda
que o `docs/DESIGN.md` §6 regra 6 cobra desde que foi escrita. A maior parte é
substituição de valor idêntico — risco baixo, volume alto.

### Onda 89 — O mapa fala a cor da marca
**Entra:** helper que lê `--acao` do documento e alimenta as camadas do Mapbox
(4.1), aplicado nos 4 arquivos; caixa de 44px nos controles nativos (4.2);
escala do medidor a 11px (4.3); painel de camadas na coluna de flutuantes em vez
de `top-44` (4.6); `rgba?\(` somado ao regex de `tokens.test.ts` e os tetos
subidos para o número real (5.13); comentários divergentes corrigidos (5.8).
**Efeito visível:** `/navegar` deixa de ter duas marcas na mesma tela, o teto de
cor literal cai de ~106 para ~60, e os três controles mais tocados do app entram
na régua.

### Onda 90 — O painel de rota vira instrumento
**Entra:** `ProgressoRota` ligado ao `progressoNaRota` que já existe (4.4);
`modoSoNavegacao` entrando por movimento sem exigir destino (4.5).
**Efeito visível:** o painel de navegação passa a mostrar *onde estou no
caminho* em vez de quatro números soltos, e sair da marina limpa a tela sozinho
— que é o comportamento que Waze e Navionics têm.

### Onda 91 — O cartão vira instrumento documentado
**Entra:** `subtitulo` em `Cartao` e `CabecalhoCartao` (2.1); `nivel` em
`Cartao` ligando `--raio-painel` e `.painel-lustro` (2.3); slot `chips` em
`LinhaLista` (1.2); densidade do cartão do Diário (1.1).
**Efeito visível:** os cartões param de ser caixa com rótulo, o raio passa a
significar profundidade, e o Diário cabe 1,6× mais informação na mesma tela.

### Onda 92 — A anatomia da referência sai da tela única
**Entra:** `MigalhaPao` + `FaixaKpi` + `BotaoFicha` nas fichas de saída,
ocorrência, lançamento e compromisso (2.2); `Abas` em `/barco` para quebrar as 8
seções (1.3).
**Efeito visível:** a ficha de equipamento deixa de ser a única tela bonita do
app.

---

## Não fazer

**Não subir o padding dos cartões para "respirar".** A densidade é a régua
(`docs/DESIGN.md` §6 regra 5) e a referência é densa. O que falta ao Diário não
é ar, é informação por pixel — ver 1.1. Cartão mais alto com o mesmo conteúdo
piora exatamente o defeito medido.

**Não instalar biblioteca de animação.** O `package.json` não tem `framer-motion`,
`motion` nem `react-spring`, e não deve ter. O que falta é `active:` e
`transition` — Tailwind puro cobre 100% dos achados do eixo 3, e uma lib de
animação num app náutico convida a movimento decorativo, que é a assinatura de
design gerado que o `docs/DESIGN.md` §1 lista.

**Não trocar o `--acao` do tema claro para limão "para unificar".** A divergência
de 5.8/4.1 se resolve fazendo o mapa ler o token, não escolhendo uma cor à
revelia do dono. O limão foi decisão de identidade dele e o dourado do claro
pode ser deliberado (limão sobre branco tem contraste ruim). Perguntar antes; a
correção técnica não depende da resposta.

**Não animar o mapa nem os gráficos na entrada.** Barra que cresce e linha que
se desenha são o tipo de efeito que impressiona uma vez e atrasa a leitura todas
as outras. O movimento que falta é o de **resposta ao toque** e o de
**transição de estado** — não o de apresentação. O único movimento contínuo que
o app deve ter continua sendo o pulso do halo do barco, que já existe.

**Não reescrever `SecaoPagina` para virar cabeçalho de cartão.** As duas peças
são diferentes de propósito e o `CabecalhoCartao` documenta isso
(`cabecalho-cartao.tsx:9-18`). O problema de `/barco` não é o componente de
seção, é ter 8 seções numa tela — resolve-se com `Abas`, não mexendo em 124 usos.

**Não caçar o `hover:` que falta no celular.** As 24 ocorrências concentradas em
páginas públicas e desktop estão certas assim: celular não tem hover, e
adicionar `hover:` em componente de app gastaria trabalho num estado que
ninguém vê. O que falta é `active:` — outra coisa.

**Não fazer a migração de raio e de espaçamento num commit só com o resto.** Os
620 pontos de raio de valor idêntico (5.9) e os 61 `mt-5` (5.11) são
substituição mecânica e devem entrar **sozinhos**, num commit que não muda um
pixel de render. Misturados com `rounded-xl` (que muda de 12 para 8 ou 14) e com
as trocas de altura, qualquer regressão visual vira caça ao commit. Separar o
que é idêntico do que é decisão é o que torna essa onda barata.

**Não baixar o teto de `tokens.test.ts` para 91 depois de somar `rgb()`.** O
número real é 106; escrever 106 é o conserto. A catraca do arquivo diz que o
teto *só desce* — a exceção é quando ele estava medindo errado, e nesse caso
subir é dizer a verdade. Vale escrever isso no commit, senão a próxima pessoa lê
a subida como afrouxamento.

**Não mexer no "Voltar" dourado de `CabecalhoDetalhe`.** O `docs/DESIGN.md` §5
já registra, letra por letra, que ele é a referência e fica. Ele vai aparecer em
qualquer varredura de acento como violação e não é.

---

*Auditoria conduzida em 19/08/2026 por leitura de código sobre a árvore de
trabalho de `onda-7-fala-como-gente`. Nenhum arquivo de aplicação foi alterado;
nenhum servidor foi levantado. As medidas de altura são aritmética sobre valores
literais do código — a verificação em navegador (as duas larguras, os dois
temas) é o passo seguinte de cada onda, com a varredura de
`web/e2e/varredura-mobile.spec.ts`.*

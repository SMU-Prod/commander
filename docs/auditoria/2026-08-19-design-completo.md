# Auditoria de design do Commander — 19/08/2026

App rodando em `localhost:3050` (Next 16.3, Turbopack), sessão autenticada, barco
"TESTE". Percorrido em **390×844** e **1440×900**, nos dois temas.

Esta auditoria responde a duas frases do dono — *"tudo zoneado parecendo informação
solta"* e *"cara de IA"* — e mede o quanto o app está longe de Waze/Navionics em
**decisão de layout**, não em enfeite.

---

## 0. Método, e por que ele vem antes de tudo

As auditorias anteriores deste projeto **contaram comentário como se fosse código**.
O caso didático é o achado 5.11: reportou-se "61 `mt-5`", depois "46", e a remedição
de 19/08 achou 10 — dos quais **zero** eram `mt-5` aplicado.

Este projeto comenta muito, e o comentário fala das classes que ele documenta. Por
isso toda contagem aqui passou por um **removedor de comentários** que respeita
strings (`scratchpad/contar.mjs`): tira `/* … */`, `{/* … */}` de JSX e `// …` fora
de string, preservando quebras de linha. Cada número abaixo vem com o par
**BRUTO → LIMPO**, para que o ruído fique visível.

O ruído não é pequeno. Amostra desta sessão:

| padrão | bruto | **limpo** | ruído de comentário |
|---|---:|---:|---:|
| `tracking-[…]` | 16 | **5** | 11 (69%) |
| `mt-5` | 10 | **4** | 6 (60%) |
| `ChipDado` | 37 | **24** | 13 (35%) |
| `sombra-2` | 56 | **43** | 13 (23%) |
| `LinhaLista` | 170 | **153** | 17 (10%) |
| `shadow-lg` | 2 | **0** | 2 (100%) |

**Regra que eu seguiria daqui pra frente: nenhum número entra em relatório sem o par
bruto/limpo.** Um "31 usos" que na verdade é 5 não é um erro de digitação — é a
diferença entre "temos um problema sistêmico" e "temos cinco linhas".

**O que é prova aqui.** Valor computado via `getComputedStyle` no navegador, medida
de `getBoundingClientRect`, contagem filtrada de comentário, ou arquivo:linha. Onde
eu não pude medir, está escrito que não pude.

**Dois limites honestos desta sessão:**
1. A captura de tela do painel parou de compor quadros no meio do trabalho. As duas
   primeiras capturas da Início e a de `/barco` são visuais; **o resto é valor
   computado**, que é mais preciso, mas não substitui olhar.
2. **Não consegui abrir Waze, Navionics nem Nubank** (orçamento de busca da sessão
   esgotado; `commander-tau.vercel.app` foi negado). A §6 está marcada como
   conhecimento e leitura de `docs/DESIGN.md §2–4`, **não** como captura desta
   sessão. Não inventei número de referência.

---

## 1. Veredito

**O sistema está muito melhor do que a documentação sobre ele.** Vários achados que
`2026-08-19-fechamento.md` lista como ABERTOS já caíram na árvore de agora — a §7
detalha um a um. O raio, que o fechamento diz estar em 52,8% via token, está em
**98,8%**.

E, ainda assim, a queixa do dono continua correta — porque ela **não é sobre o
sistema, é sobre a hierarquia**, e hierarquia é a única coisa que nenhum dos testes
do projeto mede (`docs/DESIGN.md §7` diz isso com todas as letras).

O diagnóstico cabe em uma medida:

> Na Início, os **oito** `<h2>` — "SAÚDE", "PRECISA DA SUA ATENÇÃO", "MOTORES",
> "MAR AGORA", "ACESSO RÁPIDO", "TRIPULAÇÃO", "GASTOS DO MÊS", "DIÁRIO DE BORDO" —
> são renderizados com **exatamente** `font-size: 11px`, `font-weight: 400`,
> `color: rgb(138,138,138)`. Os oito. Sem uma exceção.

O assunto mais crítico do produto e o atalho mais descartável da tela recebem o
mesmo vestido tipográfico. **Não existe "o assunto" da tela porque o sistema não
tem como um cartão ser mais importante que outro.** Isso não é deriva, é a API do
componente: `components/ui/cartao.tsx:76` escreve `<h2 className="rotulo truncate
text-dim">` e não aceita grau.

"Informação solta" é o nome exato disso.

---

## 2. Tela por tela

### 2.1 Início (`/hoje`) — a tela que gerou a queixa

**390×844.** Altura da página **1781px** (2,1 telas). **9 cartões**.

Oito dos nove são o mesmo objeto: `background rgb(26,26,26)`, borda
`rgb(44,44,44)`, raio `16px`. O que muda entre eles é só a altura — e a altura
segue **quanto conteúdo coube**, não a importância:

| cartão | altura | é o assunto? |
|---|---:|---|
| Tripulação (estado vazio) | 226px | não |
| Gastos do mês | 218px | não |
| Mar agora | 207px | não |
| Precisa da sua atenção | 184px | **sim** |
| Motores | 163px | em parte |
| Diário de bordo | 145px | não |
| Acesso rápido | 111px | não |
| **Saúde** | **86px** | **sim — e é o menor** |

O maior bloco da tela é um **estado vazio** ("Só você tem acesso a este barco").
O menor é a **saúde do barco**. Waze nunca deixaria o congestionamento à frente
menor que o botão de perfil.

**Escala tipográfica em uso** (contada nos elementos com nó de texto):
11px × 33, 12px × 26, 14px × 10, 13px × 6, 15px × 4, 20px × 3, 22px × 1.

Ou seja: **59 dos 83 elementos de texto da tela principal do app estão a 11 ou
12px**, e **nada passa de 22px**. A classe `.titulo-pagina` (24px/600), que 57
telas do app usam, **não aparece uma vez em `hoje/page.tsx`**. O maior tipo da
tela é o nome do barco, escrito com `text-[22px] font-semibold uppercase
tracking-[.16em]` — tamanho fora da escala declarada e tratado como *rótulo*
(caixa alta + rastreio), não como título.

**Famílias:** IBM Plex Mono em **46** elementos contra Inter em **37**. A fonte
reservada a "número de instrumento e rótulo" (`docs/DESIGN.md §5`) virou a
textura dominante da tela. Quando tudo é etiqueta de instrumento, nada é.

**Cor:** `rgb(138,138,138)` (o cinza dim) em **43** elementos contra branco em
33. A tela é majoritariamente cinza médio sobre cinza escuro.

**Ícones:** 21 SVGs. **Dez** cabeçalhos de seção carregam ícone, e **oito deles
têm o tamanho idêntico (16px) e a cor idêntica (`rgb(138,138,138)`) do texto ao
lado**. Um ícone da mesma cor, do mesmo peso e na mesma posição em oito seções
seguidas não distingue seção nenhuma — vira padrão de fundo. Isto é o sintoma
"ícone decorativo em toda linha", medido.

**Redundância medida.** O cartão "Acesso rápido" (`hoje/page.tsx`, grade de 5)
oferece `/barco`, `/agenda`, `/barco/documentos`, `/diario`, `/barco/contatos`.
A `bottom-nav` (`components/bottom-nav.tsx:15,31`), fixa a poucos pixels abaixo,
já oferece `/barco` e `/diario`. **Dois dos cinco atalhos duplicam a barra que
está na mesma dobra.** 111px de tela para entregar três destinos novos.

**Bug visual medido.** O tooltip do gráfico de gastos fica com `opacity: 1`
permanente no último mês e **vaza 5px para fora do cartão** (`tip.right = 379`,
`cartao.right = 374`). Aparece cortado na borda.

**1440×900.** Duas colunas: 859px à esquerda, 421px à direita. O problema se
repete traduzido para desktop — a coluna larga leva **Atenção, Gastos e o estado
vazio de Tripulação (859×226px)**; a **Saúde** vai para a coluna estreita, com
**421×86px**. O olho vai para a coluna larga, e lá não está o assunto.

**O que está bom aqui:** as 6 sombras fundas da tela são todas tooltips do
gráfico (`pointer-events-none absolute bottom-full`) — uso correto de `sombra-2`,
o único elemento que de fato flutua. Zero estouro horizontal. Um único alvo
abaixo de 44px, e é link em meio de parágrafo ("tábua oficial do CHM"), que a
régua permite explicitamente.

---

### 2.2 `/barco` — o menu que virou uma pilha de caixas

**390×844.** Altura **2779px** — **3,3 telas de rolagem**. **23 cartões**.

Aqui a hierarquia *interna* acerta: os horímetros dos motores ("10,0 h") saem em
mono a 20px sobre `rgb(2,2,2)`, e é a primeira coisa que o olho pega. Bom.

O problema é o resto da tela: depois dos motores vêm **treze cartões
praticamente idênticos** — nove com exatamente **88px** de altura e quatro com
**84px** (Documentos, Financeiro, Carteira, Diário de Bordo, Ocorrências,
Histórico, Relatórios, Fotos, Contatos, Elétrica, Equipamentos, Hidráulica,
Segurança). Cada um: ícone cinza + título 15px + subtítulo cinza + chevron.

**Isso é um menu de navegação desenhado como treze cartões separados.** Uma
lista com divisórias faria o mesmo trabalho em um terço da altura e sem sugerir
que cada item é um objeto independente. É a definição de "tudo zoneado".

**Nenhum `<h2>` ou `<h3>` na tela inteira** — 23 blocos e um único `<h1>`. Para
leitor de tela, `/barco` é uma parede sem estrutura.

**Abas cortadas:** a fila de abas tem `scrollWidth 805px` contra `clientWidth
358px` — **55% do conteúdo fora da tela**. "Ferramentas", "Selos" e "Dados
gerais" são invisíveis para quem não souber arrastar. A affordance existe (a
classe `.rolagem-lateral`, `globals.css:378`, aplica máscara de fade à direita),
mas fade de 20px não anuncia que **mais da metade** da navegação está escondida.

**Erro de console reprodutível** (ver §4.1).

**30 SVGs** numa tela.

---

### 2.3 `/diario` — **a tela mais bem resolvida do app**

Vale dizer com todas as letras, porque é o contraexemplo interno e é o modelo a
copiar:

- `<h1>` "Diário de Bordo" a **24px/600** — `.titulo-pagina` usada como deve.
- Altura **844px**: cabe em uma tela, sem rolagem.
- **5 tamanhos** de fonte (12, 14, 15, 11, 24), **2 pesos**, **4 cores**.
- **7 SVGs** — contra 21 na Início e 30 em `/barco`.
- 5 cartões de lista com alturas coerentes (46/68/68/68/68).
- **Zero** alvos abaixo de 44px.

`/diario` prova que o app **sabe** fazer certo. A Início e `/barco` não são um
limite do sistema de design — são duas telas que não receberam o mesmo cuidado.

---

### 2.4 `/notificacoes` (Avisos) — hierarquia real

O único lugar onde o app agrupa por **severidade** em vez de por origem:
"CRÍTICAS — 1", depois "IMPORTANTES — 1". Isso é hierarquia de conteúdo, e é
exatamente o que Waze faz. `<h1>` a 24px. 5 tamanhos, 3 pesos. Cabe em uma tela.
Todos os chips de filtro medem 44px de altura.

**Um defeito, e ele viola a régua da própria casa.** `docs/DESIGN.md §5` diz
*"Zero desenha. `Vencido 0` é uma resposta; pílula sem número não diz 'zero', diz
'não sei contar isto'."* Medido nos chips desta tela:

| chip | largura | mostra número? |
|---|---:|---|
| Todas **2** | 96px | sim |
| Embarcação **2** | 137px | sim |
| Agenda | 85px | **não** |
| Marketplace | 116px | **não** |
| Financeiro | 103px | **não** |

Três chips omitem o zero. Um conserto pequeno numa tela que já está boa.

---

### 2.5 `/parceiros` (pública) — a única tela com voz de topo

`<h1>` a **36px/600** ("Seu ponto no mapa que os donos…"). É a única tela do
produto onde existe um elemento com porte de manchete — e é uma tela de
marketing, não do produto. O produto que o dono paga R$ 49,90–69,90 para usar
tem teto de 24px.

36px não está na escala declarada (11/12/14/15/20/24/28). Numa landing isso é
defensável; vale declarar o degrau em vez de deixá-lo avulso.

Oito `<h2>` a 15px/600 — todos iguais, mas aqui faz sentido: é uma lista de
benefícios paralelos.

Sóbria: 0 gradientes, 8 SVGs, 0 estouro. Os dois verdes que aparecem
(`#d6f24a` e `#e2f96f`) são `--acao` e `--acao-forte`, tokens declarados — não é
deriva.

**Dois alvos pequenos:** "Sou dono de barco" (108×18px) e o e-mail de contato
(168×18px), ambos no rodapé com `apoio text-dim`. "Sou dono de barco" é
navegação entre públicos, não link em parágrafo — merece os 44px.

---

### 2.6 Estado vazio — o acerto do app

`components/ui/estado-vazio.tsx` está bem desenhado e é o componente mais usado
do projeto: **166 usos** (bruto 182). Ícone + título + descrição + ação em
pílula, com alvo de 44px vindo de `--altura-controle` (`:94`), e duas ênfases
com a regra escrita: a ação de uma tela inteiramente vazia é dourada; a de um
cartão vazio aninhado é contorno, porque *"quatro dourados de uma vez e o dourado
para de significar 'aqui se age'"* (`:16-28`).

O hero sem foto (`components/card-embarcacao.tsx:100-136`) é o melhor estado
vazio do app: bloco inteiro clicável, pílula de 44px, e a frase *"É ela que abre
o seu Commander"* — que explica o valor em vez de pedir uma tarefa. E a decisão
de **não** usar dourado ali está justificada por escrito no lugar certo.

**A tensão que sobra é de composição, não de componente.** O próprio código
admite (`estado-vazio.tsx:19-21`): *"a Início de um barco recém-cadastrado tem
quatro cartões vazios ao mesmo tempo"*. No dia 1 — o momento em que o cliente
decide se pagou bem — a Início vira quatro a cinco caixas iguais, cada uma com
ícone cinza, uma frase e uma pílula. Cada estado vazio isolado é bom; **cinco
empilhados são o retrato de "informação solta"**. Nenhum componente resolve isso;
resolve-se decidindo que a Início do dia 1 mostra *menos* cartões, não os mesmos
cartões vazios.

Nota menor: `estado-vazio.tsx:79` centraliza um `Icone size-6 text-dim` no topo.
`docs/DESIGN.md §6` regra 4 diz "não ganha ilustração pra não ficar vazio". Um
ícone de 24px em cinza é discreto o bastante para eu não chamar de violação, mas
é o mesmo ícone repetido cinco vezes numa tela do dia 1.

---

### 2.7 Estado de carregando — e um travamento grave

Ver §4.1. O esqueleto em si (`components/ui/esqueleto.tsx`) é bom: três formas
(`lista`/`ficha`/`painel`), `motion-safe:animate-pulse`, `role="status"` +
`aria-busy`, e texto "Carregando…" para quem pediu menos movimento. Onze
`loading.tsx`, sendo um deles em `app/(app)/` cobrindo o grupo inteiro.

---

## 3. Os padrões que se repetem — onde mora o conserto barato

### 3.1 O cartão não tem grau — **a causa raiz**

`components/ui/cartao.tsx:76`:

```
{titulo && <h2 className="rotulo truncate text-dim">{titulo}</h2>}
```

`.rotulo` (`globals.css:483`) crava mono, 11px, `letter-spacing .16em`,
uppercase; `text-dim` crava `#8a8a8a`. **Todo cartão do app, em toda tela,
recebe o mesmo título de 11px cinza.** Não há prop para dizer "este cartão é o
assunto".

Enquanto isso, a escala declarada tem degraus ociosos: `.titulo-pagina` (24px)
tem 57 usos mas nenhum na Início, e **`.valor-instrumento` (28px) — a classe
descrita no CSS como "o número que É o assunto da tela" — tem 3 usos em todo o
app** (bruto 6, ruído 3), todos em Financeiro/Carteira. O `Medidor` e `/navegar`,
que o próprio comentário de `globals.css:449-454` nomeia como seus destinatários,
continuam fora. O CSS avisa: *"se essa onda não vier, o certo é APAGAR esta
classe, não deixá-la de enfeite"*.

Ou seja: **a voz de "assunto" existe no sistema e quase não é usada.** O app
está calibrado inteiro na faixa 11–15px.

### 3.2 Ícone como textura

**264 usos da prop `icone`** (bruto 264, ruído 0), em 36 valores. Concentração
por tela: `hoje` 14, `barco/equipamento/[id]` 13, `barco` 11, `barco/resumos` 9,
`patio` 9. Renderizados sempre em `size-4 text-dim` (`cartao.tsx:65`) — mesma
cor do título ao lado.

Ícone que não muda de cor, de tamanho nem de posição não hierarquiza: preenche.
Navionics usa ícone para **simbologia normatizada** (perigo, profundidade), não
para enfeitar cabeçalho.

### 3.3 A marca troca de cor quando o tema troca

| token | tema escuro | tema claro |
|---|---|---|
| `--acao` | `#d6f24a` verde-limão | **`#d4af37` dourado** |
| `--dado` | `#19b3d3` ciano | `#0f6d7a` teal |

`globals.css:30` × `globals.css:189`. A onda 79 aposentou o dourado por decisão
de identidade do dono e trocou o tema escuro; **o tema claro nunca recebeu a
troca**. `docs/DESIGN.md §5` descreve só o verde-limão.

Não é cosmético — ver §5.

### 3.4 Componente existe e a tela reescreve na mão

O link "Voltar" tem versão certa em `components/ui/cabecalho-detalhe.tsx:79`,
com `min-h-[var(--altura-controle)]` (44px). **Oito arquivos reescreveram o link
à mão sem o `min-h`**, com a classe `rotulo text-accent-forte` (contagem limpa:
9 ocorrências, sendo 1 o próprio componente):

`barco/editar`, `barco/eletrica`, `barco/equipamentos`, `barco/hidraulica`,
`barco/local`, `barco/resumos`, `barco/seguranca`, `(parceiro)/layout.tsx`.

Medido ao vivo em `/barco/eletrica`: o link "Barco" mede **62×17px** —
`min-height: 0px`. A régua é 44.

Duas medições independentes convergem: a varredura oficial do projeto
(`.varredura/relatorio-celular-390.json`, rodada hoje 06h) acusa `a:"Barco"` em
**8 rotas**. Mesmo número que a contagem de código.

Isto é `docs/DESIGN.md §6` regra 6 ao pé da letra: *"Se você está escrevendo um
estilo à mão, pare: ou o componente existe, ou você acabou de encontrar um que
precisa existir."* O componente existia.

### 3.5 Tamanhos fora da escala

Escala declarada: 11, 12, 14, 15, 20, 24, 28. Fora dela, no código (limpo):
`text-[13px]` × 4, `text-[26px]` × 2, `text-[10px]` × 1, `text-[17px]` × 1,
`text-[22px]` × 1 — **9 ocorrências, 5 valores**. Pequeno, mas o `text-[22px]` é
justamente o nome do barco na Início, o maior tipo do produto.

Há ainda **32 `text-[11px]`** escritos à mão onde `.rotulo`/`.apoio` já cravam
11px.

---

## 4. Dois defeitos que não são de estética, mas estragam a tela

### 4.1 Telas presas no esqueleto na carga direta

**Reproduzido em `/hoje`, `/menu`, `/financeiro`, `/barco/saude`,
`/barco/documentos`.** Abrindo a rota **pela URL** (não por clique), a tela fica
no esqueleto de carregamento indefinidamente.

Medido: `<main>` com `width 0, height 0`, pai com `display: none` e
`id="S:0"`/`"S:1"`/`"S:3"` — os buffers de streaming do React, que nunca foram
promovidos. O conteúdo real **existe** no DOM (o texto todo está lá), mas nunca
é movido para a página. O que está pintado, verificado com `elementFromPoint`
em 18 pontos da viewport, são só as barras do esqueleto
(`h-7 w-1/2 rounded-[var(--raio-controle)]`, `mt-0.5 h-[18px] w-3/5 …`).

Navegação **client-side** (clique num `<a>`) renderiza normalmente. Foi assim que
consegui medir a Início em 1440px.

Isso atinge quem abre o app pela URL, recarrega a página, chega por link externo
ou abre o PWA — ou seja, **a primeira impressão**. E é uma regressão da própria
correção de design que criou os 11 `loading.tsx` (achado 3.2 do relatório
anterior).

**Limite honesto:** reproduzido em `next dev` com Turbopack. **Não pude verificar
em produção** — o acesso a `commander-tau.vercel.app` foi negado nesta sessão.
Antes de qualquer conserto, isto precisa ser reproduzido com `next build && next
start`. É a primeira coisa que eu faria amanhã.

### 4.2 Erro de hidratação em 17 das 73 rotas

Causa medida: `components/selos/selo-verified.tsx:6-23` e
`components/selos/selo-gold.tsx:6-8` calculam coordenadas SVG com
`Math.cos`/`Math.sin` e **serializam o float cru**:

```
const rad = ((deg - 90) * Math.PI) / 180
return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
```

O servidor emite `translate(63.674192626285084,…)`, o cliente calcula
`63.67419262628509`. `Math.cos`/`Math.sin` **não são exigidos pelo ECMAScript a
ser bit-idênticos entre implementações** — Node e o V8 do navegador podem divergir
no último dígito. React reporta e **não corrige** ("This won't be patched up").

A varredura oficial do projeto, rodada hoje de manhã, registra o erro em **17 de
73 rotas** (`/barco`, `/barco/selos*` e todo o `/admin`), nas duas larguras.

Conserto: arredondar as coordenadas na origem (`.toFixed(3)`). Uma linha em cada
um dos dois arquivos.

---

## 5. Acessibilidade que muda uso real

### 5.1 O acento do tema claro é ilegível — e o tema claro existe por causa do sol

Medido **no navegador**, criando um elemento com a classe real do app e lendo
`getComputedStyle`:

| tema | cor de `text-accent` | sobre cartão | sobre a página |
|---|---|---:|---:|
| escuro | `rgb(214,242,74)` | **13,81:1** | **15,09:1** |
| **claro** | `rgb(212,175,55)` | **2,10:1** | **1,96:1** |

O mínimo AA para texto é 4,5:1. O tema claro entrega **menos da metade**.

Alcance: **139 usos de `text-accent`** no código (bruto 143, ruído 4), em ~60
arquivos — `app/page.tsx` 7, `parceiros` 7, `navegar-mapa` 5, `tempo-painel` 5,
`login` 4, `menu/assinatura` 4, `assinar` 4, `pagina-legal` 4…

`docs/DESIGN.md §2` diz que o contexto é hostil: *"mão molhada, sol no flybridge,
barco balançando"*. O tema claro foi criado para isso. Hoje, quem liga o tema
claro na marina perde **todos os links e ações secundárias do app**.

O botão preenchido está OK (texto `#0b1d2d` sobre dourado = 8,13:1). A falha é
só quando o acento é **cor de texto** — que é a maioria dos 139 usos.

### 5.2 O que o teste de contraste não cobre

`lib/ui/contraste.test.ts` passa (8 testes, 2 arquivos, verde). Mas ele mede
**4 pares, e só no tema escuro** (`:82` `describe("contraste do tema escuro")`).
Não cobre o tema claro, nem as cores de estado, nem o acento — que é justamente
onde está a falha da §5.1.

Recalculando à mão o que ele não mede, tudo o mais passa: no claro, `ok` 5,02,
`warn` 5,02, `crit` 4,83, `dado` 6,02, `texto-dim` 5,04 sobre cartão. A paleta
está bem calibrada; **o buraco é o acento e o escopo do teste.**

### 5.3 Separação cartão/fundo — funciona, nos dois temas

`#1a1a1a` sobre `#101010` dá 1,105:1 (abaixo de 1,2), e no claro `#ffffff` sobre
`#f5f7fa` dá 1,07:1. **Nos dois casos quem separa é a borda:** 1,25:1 no escuro,
1,24:1 no claro. É exatamente a decisão registrada em `docs/DESIGN.md §5`, e ela
está implementada nos dois temas. Acerto.

### 5.4 Alvos de toque

Varredura oficial, 73 rotas, as duas larguras: **21 rotas (29%) com alvo abaixo
de 40px**. Os repetentes:

| ocorrências | alvo |
|---:|---|
| 8 | `a:"Barco"` — o link "Voltar" escrito à mão (§3.4) |
| 5 | `button` sem rótulo |
| 5 | `a` sem rótulo |
| 4 | `input#visivel` |
| 3 | `input#categoria`, `input#tambem_vende_produtos`, `input#atividade` |
| 2 | `a:"Equipamento"`, `input#arquivo` |

Os `input#…` são caixas de seleção e campos de arquivo — o padrão do navegador,
que precisa de rótulo tocável em volta.

**O que está bom:** `0` rotas com estouro horizontal e `0` rotas sem saída, nas
duas larguras. A casca responsiva está sólida — isso é resultado das ondas de
fundação e merece ser dito.

**Sobreposição:** 3 rotas em 390px (`/agenda`, `/marketplace`,
`/navegar/viagem/nova`) e 1 em 1440px (`/navegar/viagem/nova`).

---

## 6. O que Waze, Navionics e um app financeiro brasileiro fazem que a gente não faz

**Aviso de honestidade:** não consegui abrir os três apps nesta sessão (busca
esgotada, produção negada). O que segue é conhecimento do meu treinamento cruzado
com o estudo que o próprio projeto já fez em `docs/DESIGN.md §2–4`. **Não há
número de referência inventado aqui** — só mecanismos de layout, que é o que a
tarefa pediu.

**1. Eles têm uma linha só de "o que importa agora", e ela é grande.**
Waze abre com um destino sugerido e o tempo em tipo grande; Navionics abre com a
carta e a profundidade sob o casco. Nossa Início abre com oito rótulos de 11px
cinza. *Mecanismo que falta:* uma linha de estado no topo, em
`.valor-instrumento` (28px, a classe que já existe e quase não é usada), dizendo
a única coisa que muda a decisão do dia — "1 vencido, 1 na margem" ou "Tudo em
dia". Hoje essa informação existe, mas em 12px dentro do cartão de 86px.

**2. Eles agrupam por urgência, não por origem.**
Waze não tem um cartão "Trânsito", outro "Polícia", outro "Buraco" — tem uma
lista de eventos ordenada por quanto te afeta. Nossa Início tem um cartão por
**assunto do banco de dados** (Saúde, Motores, Gastos, Tripulação, Mar). Nossa
própria `/notificacoes` já faz o certo, agrupando por CRÍTICAS/IMPORTANTES.
*Mecanismo que falta:* a Início adotar o agrupamento que Avisos já usa.

**3. Eles não desenham caixa para navegar.**
Nem Waze nem Navionics nem app de banco desenham treze cartões com borda para
levar a treze telas. Usam **lista com divisória** (linha fina, sem borda, sem
raio, sem sombra) e reservam o cartão para conteúdo com dado dentro. `/barco`
gasta 2779px desenhando trezes caixas para o que é um menu.

**4. A fila de atalhos deles não repete a barra de baixo.**
Nubank e Inter têm fila de ícones no topo, e ela existe justamente para o que
**não** cabe na navegação principal — Pix, boleto, recarga. Nosso "Acesso
rápido" repete Barco e Diário, que já estão na bottom-nav visível na mesma
dobra.

**5. Estado vazio deles some, não empilha.**
App de banco não mostra cinco caixas dizendo "você não tem investimento", "você
não tem seguro", "você não tem cartão adicional". Mostra uma. Nossa Início do
dia 1 mostra quatro a cinco, e o próprio código registra isso
(`estado-vazio.tsx:19-21`).

**6. Um acento, um lugar.**
Waze usa a cor forte só para o que exige ação. Nosso escuro está disciplinado
nisso. Nosso claro perdeu o acento inteiro (§5.1).

---

## 7. O que o fechamento diz que está aberto e **já caiu**

Remedido na árvore de agora, com filtro de comentário. Isto importa porque
`2026-08-19-fechamento.md` é o documento que vai guiar a próxima onda, e ele
mandaria refazer trabalho já feito.

| item do fechamento | o que ele diz | **medido agora** |
|---|---|---|
| **14 · raio (5.9)** | 878 usos, 52,8% via token; faltam `rounded-[14px]` 115, `rounded-full` 116, `rounded-lg` 86, `rounded-xl` 56, `rounded-[10px]` 20; 12 raios distintos | **FECHADO.** 882 usos limpos, **871 via token = 98,8%**, **11 valores**. `rounded-[14px]`, `rounded-full`, `rounded-lg`, `rounded-xl`, `rounded-[10px]`: **0 cada**. Sobram 5 avulsos reais (`rounded-[20px]`, `rounded-t-[20px]`, `rounded-[26px]`, `rounded-[34px]`, `rounded-md`) + a exceção declarada `rounded-t-[3px]` |
| **15 · `mt-5` (5.11)** | "46 `mt-5`" | **FECHADO, e o número contradiz a própria tabela do mesmo documento** (que já dizia 10). Limpo: **4**, e os 4 são `-mt-5` **negativo** legítimo (`explorar-mapa:136`, `navegar-mapa:1690`, `planejar-viagem-mapa:185`, `ver-viagem-mapa:149`) — contra-margem de sangramento do mapa |
| **16 · tracking (5.12)** | 31 usos, 11 valores distintos | **FECHADO.** Limpo: **5 usos, 2 valores** — `tracking-[.16em]` × 3 (a exceção declarada do wordmark) e `tracking-[-0.02em]` × 2. Os 11 "valores" eram os comentários que documentavam a correção |
| **17 · doc divergente (5.8)** | `lib/ui/largura.ts:15` cita IBM Plex Sans | **FECHADO.** O arquivo já corrige a si mesmo por escrito |
| **18 · contagem (5.7)** | dois números mono soltos | **FECHADO.** `notificacoes/page.tsx:136` e `barco/mapa/page.tsx:285` são `ChipDado` |
| **19 · medidor + sombra** | ponteiro sem `transition`; `superficies.ts:279` com `shadow-lg shadow-accent/30` | **FECHADO.** `medidor.tsx:286` tem `transition-transform duration-500 ease-out motion-reduce:transition-none`. `shadow-lg` e `shadow-accent`: **0 no código** (2 e 1 em comentário) |

**Sete dos sete itens de design listados como abertos estão fechados.** O grupo 4
do fechamento pode ser riscado inteiro.

Continua aberto de lá, e confirmado por mim: `diario/page.tsx:292` com `min-h-6`
(alvo de 24px), e `text-[22px]` em `card-embarcacao.tsx:133`.

---

## 8. Uma linha de CSS × redesenho de tela

### Uma linha (ou pouco mais)

| # | conserto | onde |
|---|---|---|
| A | `--acao` do tema claro: `#d4af37` → `#d6f24a` (ou um verde escurecido que passe 4,5:1 no branco) | `globals.css:30` |
| B | arredondar coordenadas SVG dos selos | `selo-verified.tsx:8`, `selo-gold.tsx:8` |
| C | `min-h-[var(--altura-controle)]` nos 8 links "Voltar" à mão — ou trocá-los por `CabecalhoDetalhe` | 8 arquivos (§3.4) |
| D | tooltip do gráfico: prender dentro do cartão | `grafico-barras.tsx` |
| E | chips de Avisos mostrarem `0` | `notificacoes/page.tsx` |
| F | `min-h-6` → `min-h-[var(--altura-controle)]` | `diario/page.tsx:292` |
| G | `text-[22px]` → degrau da escala | `card-embarcacao.tsx:133` |
| H | estender `contraste.test.ts` ao tema claro e ao acento | `lib/ui/contraste.test.ts` |

### Redesenho de tela

| # | mudança | por quê |
|---|---|---|
| I | **`Cartao` ganha `peso`** (`assunto` \| `normal`): `assunto` troca o `<h2>` de `.rotulo`/`text-dim` para `.titulo-card`/`texto`, e permite um valor em `.valor-instrumento`. Uma tela pode ter **um** cartão `assunto` | é a causa raiz de "informação solta" (§3.1) |
| J | **Início reordenada por urgência**, com Saúde promovida a cartão `assunto` e o número em 28px; Tripulação/Mar/Acesso rápido rebaixados ou condicionais | §2.1 |
| K | **`/barco` vira lista com divisória**, não 13 cartões | corta ~1200px de rolagem (§2.2) |
| L | **Acesso rápido perde Barco e Diário** (ou o cartão inteiro) | duplica a bottom-nav (§2.1) |
| M | **Ícone de cabeçalho vira opcional e sai por padrão**; fica só onde distingue | 264 usos viraram textura (§3.2) |
| N | **Início do dia 1 mostra menos cartões**, não os mesmos vazios | §2.6 |
| O | **investigar o travamento do esqueleto em produção** antes de mexer nele | §4.1 |

---

## 9. As cinco mudanças que mais aproximam de "vendável", em ordem de retorno

**1. Confirmar e corrigir o travamento no esqueleto (§4.1 → O, B).**
Nada nesta lista importa se a primeira tela que o cliente abre pela URL fica em
barras cinzas piscando. Reproduzido em 5 rotas em dev; **primeiro passo é
`next build && next start` e repetir** — pode ser só de desenvolvimento, e nesse
caso este item cai para o fim da lista. Se for real, é o item mais caro do
produto e o mais barato de consertar (§4.2 é uma linha em dois arquivos, e é a
causa provável).

**2. Dar grau ao cartão e promover o assunto da Início (I + J).**
É *a* queixa do dono, e a correção é um `peso` no componente mais um reordenamento
de uma tela. Os degraus tipográficos já existem — `.titulo-card`, `.valor-forte`,
`.valor-instrumento` estão declarados e ociosos. Não é sistema novo; é usar o que
está pago. Depois desta, a Início deixa de ter oito `<h2>` idênticos e passa a ter
um assunto.

**3. Consertar o acento do tema claro (A + H).**
Uma linha de CSS resolve **139 pontos** do app e devolve utilidade ao único tema
feito para o sol na marina. Hoje o tema claro é uma promessa quebrada: o cliente
liga na marina e perde todos os links. Junto vai o teste, para não voltar.

**4. `/barco`: lista no lugar de treze cartões (K + L + M).**
Corta cerca de 1200px de rolagem, tira 13 objetos falsos da tela e resolve o
sintoma mais visível de "tudo zoneado". Como M (ícone opcional) e L (atalhos
duplicados) andam junto, é uma onda só — e é a onda que mais muda a fotografia
do app.

**5. Alvos de toque e o resto da lista curta (C, D, E, F, G).**
29% das rotas têm alvo abaixo da régua, e o campeão é um componente que já existe
sendo reescrito à mão em 8 telas. É trabalho mecânico, de baixo risco, e é a
diferença entre um app que funciona no sofá e um que funciona com a mão molhada —
que é exatamente o argumento de venda do produto.

---

## 10. O que está bom, e vale não estragar

- **`/diario` e `/notificacoes`** são telas de produto pago. Copiem-se.
- **A casca responsiva**: 0 estouro horizontal e 0 telas sem saída em 73 rotas,
  nas duas larguras.
- **O raio**: 98,8% via token, 11 valores para 882 usos. Isso é sistema.
- **A separação por borda** funciona nos dois temas, exatamente como projetado.
- **`EstadoVazio`** (166 usos) e o **hero sem foto** são melhores que a média do
  mercado brasileiro de app de nicho.
- **A elevação é honesta**: `--sombra-1: none` no escuro, e as únicas 6 sombras
  fundas da Início são tooltips — coisas que de fato flutuam.
- **A disciplina do acento no tema escuro**: 13,81:1, e a Início não tem um único
  `text-accent`.
- **O hábito de registrar a decisão junto do código.** É verboso, e é o motivo de
  as contagens por substring falharem — mas é também o motivo de esta auditoria
  ter conseguido separar decisão de deriva em vez de adivinhar.

---

## Anexo — instrumentos

- Contador com remoção de comentários:
  `…/scratchpad/contar.mjs` — uso: `node contar.mjs <raiz> <regex>`; imprime
  BRUTO, LIMPO e o ruído.
- Contraste dos dois temas: `…/scratchpad/contraste.mjs`.
- Medições ao vivo: `getComputedStyle` / `getBoundingClientRect` via console do
  navegador em `localhost:3050`.
- Varreduras oficiais do projeto lidas (rodadas 19/08 06h):
  `web/.varredura/relatorio-celular-390.json` e
  `web/.varredura/relatorio-desktop-1440.json` — 73 rotas cada.
- Testes rodados: `lib/ui/contraste.test.ts`, `lib/ui/tokens.test.ts` — 8 testes,
  verdes.

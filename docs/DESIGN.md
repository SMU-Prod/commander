# Como o Commander se comporta visualmente

Estudo de Waze e Navionics, diagnóstico do que estava errado, e as regras que
passam a valer. Escrito em 15/08/2026 depois do dono dizer que a proposta
anterior tinha *"cara de IA"* e que ele queria *"padrão, cara de empresa
grande, plataforma consistente"*.

---

## 1. Por que a proposta anterior parecia feita por IA

Vale nomear, porque o padrão se repete se ninguém nomear. A tela que eu propus
tinha:

- gradiente decorativo no topo, sem função;
- anel dourado em volta de um estado que já era uma palavra;
- cartão de vidro com `backdrop-filter` porque "fica bonito";
- sombra funda em elemento que não flutua sobre nada;
- dourado em sete lugares diferentes na mesma tela;
- raio de borda diferente por bloco (11, 16, 20, 30px), sem regra.

O denominador comum: **a moldura estava fazendo o trabalho que o conteúdo
deveria fazer.** Quando não há informação forte na tela, a tentação é decorar
a caixa. Decoração distribuída por toda parte é a assinatura visual do design
gerado — muitos efeitos pequenos, nenhuma decisão grande.

Empresa grande não parece grande por ter mais efeito. Parece por ter **menos
decisões, repetidas com disciplina.**

---

## 2. O que o Navionics ensina

A frase que resume, de uma análise da interface deles: *"a roupa profissional
vem de funcionalidades substanciais, não de ornamentação. A interface transmite
competência através da precisão, não de efeitos visuais."*

Concretamente:

**A carta é sagrada; a interface se afasta.** A carta náutica usa simbologia
padronizada — o azul de profundidade, o amarelo de terra, os símbolos de
perigo têm significado normatizado. Se a interface tivesse identidade visual
forte, competiria com o dado que salva o barco. Por isso o chrome do Navionics
é cinza neutro, fino, quase invisível.

**Hierarquia progressiva.** Perigos aparecem primeiro como *contagem*, depois
como ícone no mapa, depois como detalhe ao tocar. Nunca tudo de uma vez.

**Painel só quando necessário.** Resumo de rota e aviso surgem quando têm o que
dizer e somem depois. Nada ocupa espaço permanente "porque a tela ficaria vazia".

**O que isso vale pro Commander:** nosso mapa segue a mesma regra — e já segue.
O erro foi levar decoração pra dentro do *dossiê*, que é onde nossa informação
mora. O dossiê é o nosso "carta": é ele que tem que brilhar.

## 3. O que o Waze ensina

**O mapa ocupa 100% da tela; a interface é uma camada fina por cima.** Botões
flutuam em pastilhas, não em painéis. Nada de moldura permanente comendo área.

**Uma ação principal por momento.** Dirigindo, você não escolhe entre seis
botões. Tem um. Os outros ficam a um toque de distância.

**Alvo grande, contraste alto, decisão em meio segundo.** O contexto é hostil —
mão no volante, sol, movimento. O nosso é igual: mão molhada, sol no flybridge,
barco balançando.

**Cor é significado, nunca enfeite.** Vermelho no Waze quer dizer trânsito
parado. Não existe vermelho "de destaque".

---

## 4. O que os dois têm em comum, e é a lição

Nos dois, **o conteúdo é o design e a moldura é quieta.** A personalidade vem
de uma ou duas decisões assumidas — no Waze, a cor chapada e o boneco; no
Navionics, a fidelidade da carta — e tudo em volta se cala para elas
funcionarem.

Foi o inverso do que eu fiz: distribuí sete decisões médias por uma tela só.

**Para o Commander, a decisão assumida é uma:** a **foto do barco do dono**
ocupando o topo da Início. É dela que vem a emoção; todo o resto é instrumento
e deve se comportar como instrumento. Isso também é o oposto de banco de
imagem — é o barco *dele*, e o app já guarda essa foto (`foto_capa_path`).

---

## 5. O sistema — poucas decisões, repetidas

> O Commander **já tem** um sistema de tokens em `app/globals.css`. O problema
> nunca foi ausência de sistema: foi **deriva**. Na varredura de 15/08 achamos
> a mesma pílula de filtro escrita à mão em doze telas com **seis alturas
> diferentes**. Não precisamos inventar um sistema novo — precisamos parar de
> fugir do que existe.

### Espaçamento — base 8
Só estes valores: **4, 8, 12, 16, 24, 32, 48**. Nada de 13px, 18px, 27px.
Se um espaçamento não está nessa lista, ele foi escolhido no olho.

### Raio de borda — quatro degraus, e o critério é a FUNÇÃO
- **8px** (`--raio-controle`) — **quem se toca**: chip, aba, botão pequeno, campo,
  grupo de controle do mapa.
- **12px** (`--raio-cartao`) — **quem contém**: cartão ANINHADO, dentro de outro
  painel; bloco de conteúdo.

  > **Era 14px até a onda 98.** O HAULIX §13 declara duas faixas para "quem
  > contém", não uma — `Cards 10–12` e `Containers grandes 14–16` — e o §61
  > põe "raio 12 em card" na lista de fidelidade obrigatória. A escada de
  > quatro raios desta casa já era essa ideia; o que ela tinha era o número do
  > meio na faixa ERRADA: 14 é container grande, então o cartão aninhado
  > desenhava o raio do painel de primeiro nível e os dois degraus ficavam a
  > 2px um do outro — perto demais para o olho ler como profundidade. Com 12 e
  > 16 a distância dobra. Nenhuma tela mudou à mão: os ~60 consumidores pedem
  > `var(--raio-cartao)`.
- **16px** (`--raio-painel`) — **quem contém e está no primeiro nível**, direto
  sobre o fundo. É o `Cartao nivel="painel"`, o padrão do componente.
- **999px** (`--raio-pilula`) — pílula, avatar, selo, badge.

> **Eram três até a onda 79** — esta seção dizia isso, e a onda 91 ligou o
> quarto sem voltar aqui para corrigir. O degrau de 16px existe porque raio
> único **achata a hierarquia**: painel e sub-painel desenhavam os mesmos
> 14px e liam como o mesmo nível. Com dois degraus de "quem contém", o raio
> passa a significar profundidade — quanto maior, mais externo.

O pecado nunca foi a quantidade de degraus: é **inventar um**. `rounded-xl`
(12px), `rounded-lg` (8px por acaso), `rounded-[10px]`, `rounded-[20px]` — cada
um desses é um raio de facto que ninguém declarou e que ninguém consegue mudar
em um lugar só. Se a peça se toca, é 8; se contém, é 14 ou 16; se é pílula, 999.
Não há uma quinta pergunta.

**Exceção só vale escrita, no próprio lugar, com o motivo.** Existe uma hoje:
`components/ui/grafico-barras.tsx` desenha a barra com `rounded-t-[3px]` — a
barra tem no máximo 34px de largura e o arredondamento é o *chanfro* do topo da
coluna, não a forma de um bloco. Os 8px de controle comeriam um terço da largura
e a coluna viraria um comprimido. Não é deriva; é a única medida em que 8 não
cabe.

### Profundidade — SUPERFÍCIE, não sombra (a regra que faltava)

O HAULIX §14 declara três sombras e no mesmo parágrafo diz: *"a profundidade
principal vem da diferença de superfície, não de sombra"*. Esta casa tinha três
elevações e resolvia profundidade com a do meio. As duas ideias não brigam —
elas respondem a **perguntas diferentes**, e é a pergunta que decide:

| pergunta | resposta | ferramenta |
|---|---|---|
| **este bloco está DENTRO daquele?** | profundidade | **superfície** (os 4 níveis abaixo). Nunca sombra. |
| **este bloco está POR CIMA, fora do fluxo?** | flutuação | **sombra** — e só `sombra-2`. |

**Os quatro níveis de superfície** (HAULIX §22, escritos em `app/globals.css`
nos dois temas):

| nível | token | utilitária | o que é |
|---|---|---|---|
| 0 | `--fundo` | `bg-ink` | canvas — o chão da página |
| 1 | `--superficie` | `bg-panel` | cartão de primeiro nível |
| 2 | `--superficie-2` | `bg-panel2` | cartão ANINHADO, chip, pastilha |
| 3 | `--superficie-3` | `bg-panel3` | interativo: hover, item apontado |

**No escuro a escada SOBE (clareia); no claro ela DESCE (escurece).** Não são
duas regras: é a mesma, lida do lado certo do chão — no claro o topo da escala
já está ocupado pelo branco, então "mais perto do observador" só cabe indo para
o escuro. É o que o tema claro já praticava sem escrever (`--superficie-2`
sempre foi mais escuro que o card).

**Hover sobe exatamente um nível** (§49). Quem está em `bg-panel2` vai para
`bg-panel3` — nunca para `bg-panel`, que é DESCER. Dois componentes faziam
exatamente isso até a onda 98 (`BotaoCirculo` e `PILULA_ACAO`): a peça afundava
um degrau ao ser apontada, enquanto a borda acendia.

### Elevação — o que sobra dela
- **plano** — o padrão. A maioria das superfícies não tem sombra.
- **flutuante** (`sombra-2`) — só para o que de fato paira sobre o conteúdo:
  bottom sheet, menu, pastilha sobre o mapa, ação flutuante.
- **`sombra-1`** — "separa do fundo". É o degrau que a regra acima torna
  redundante: separar do fundo é trabalho da superfície e da borda, não de um
  borrão. Já é `none` no tema escuro desde 16/08; continua existindo só porque
  o tema claro a usa e ~40 telas a escrevem à mão. Apagá-la de vez é passe de
  tela, não de token — **não escreva `sombra-1` em código novo.**

Sombra não é decoração. Se o elemento não flutua, não tem sombra.

### Cor — significado, nunca enfeite

> **A PALETA É NAVY E OURO. Fechado pelo dono em 19/08/2026** (spec
> `docs/superpowers/specs/2026-08-19-arquitetura-quatro-apps.md` §4), depois de
> ele navegar pelo app rodando. Na palavra dele: *"O aplicativo hoje parece um
> painel técnico/industrial, não o Commander premium que definimos. Verde-limão
> em todo botão, fundo preto absoluto, cards cinza quase idênticos… O
> verde-limão precisa sair."*
>
> **O HISTÓRICO, porque ele já custou uma onda inteira de trabalho refeito.**
> A marca nasceu navy + dourado. A onda 79 amostrou pixel a pixel a referência
> HAULIX escolhida na época e trocou tudo por cinza puro + verde-limão; a
> medição estava certa e a conclusão durou até o resultado rodar na frente do
> dono. O que a amostragem não podia medir é que a referência é de **outro
> produto** — logística industrial —, e o Commander é náutico e premium.
> Em 19/08 chegaram a circular duas instruções intermediárias opostas ("tire
> todo o dourado" e depois "congele"); **as duas foram canceladas pelo dono no
> mesmo dia.** Nenhuma delas chegou a código. Se você está lendo isto pensando
> em tirar o ouro de novo: a decisão é dele, está datada, e o motivo está
> escrito.
>
> **O que do HAULIX continua valendo:** densidade, escala tipográfica,
> hierarquia de superfície, status compacto, números tabulares, motion contida
> e a contenção do §62. **Só a paleta não se aplica.**

- **Navy** — o chão e as superfícies, nos quatro níveis da escada acima.
  **Não é preto**: "fundo preto absoluto" foi nomeado como defeito. O chão
  escuro parte de `#07182a` e sobe até `#26445f` na linha; o claro é a mesma
  escada lida do outro lado.
- **Dourado** — **a marca E a ação principal**, e a disciplina que vem junto é
  a do HAULIX §07 transposta do limão para o ouro: **1–3% da tela**. Em
  revisão isso se cobra pelo orçamento de **dois usos de conteúdo por tela**
  (a régua da moldura, mais abaixo, continua valendo). "Dourado em todo botão"
  é o mesmo defeito que "limão em todo botão".
- **Branco quente / cinza claro** — leitura. `--texto` no escuro é `#f4f0e8`, e
  **nunca `#FFFFFF`** em papel nenhum: o HAULIX §04 proíbe o branco puro, e os
  dois `#ffffff` que o tema claro tinha (`--superficie` e `--campo`) eram a
  violação mais visível do documento no app inteiro.
- **Verde / âmbar / vermelho** — estado do barco, e **são os três únicos**
  ("alertas apenas em vermelho, âmbar e verde"). Nunca decoração, nunca
  "destaque". Vermelho é reservado a crítico (PRD §1.1 e §4.6).
- **Azul-aço** (`--dado`) — dado, e só dado: barra de gráfico, área, série.
  Era ciano até a onda 98; ciano era a única cor do app que não pertencia nem
  à marca nem ao semáforo. O `--dado-2` roxo foi **apagado** — nasceu na onda
  79 e ficou com zero consumidores até morrer. Duas séries no mesmo gráfico
  voltam a pedir um segundo token no dia em que existirem, com o consumidor no
  mesmo commit.
- **Cinza-navy médio** — texto secundário e linha.

**No tema claro o acento é ESCURO, e isso não é outra decisão — é a mesma,
lida do outro lado (onda 96).** A auditoria de 19/08 (achado 5.1) mediu o
acento do tema claro em **2,10:1** sobre cartão, **1,96:1** sobre a página e
**1,86:1** sobre a superfície de chip. O mínimo de leitura é 4,5:1 — e o tema
claro é justamente o que existe para o sol na marina, ou seja, ele quebrava a
única promessa que tinha.

Não dava para "escurecer um pouco", porque **os dois sentidos do acento
brigam num chão claro**: para o acento ler como TEXTO ele precisa de
luminância relativa ≤ 0,156; para ele servir de FUNDO com texto escuro em cima
precisa de ≥ 0,226. Os intervalos não se tocam — nenhuma cor satisfaz os dois.
A regra que sai daí, e que vale para qualquer tema novo:

> **O acento é sempre o oposto do chão, e `--acao-texto` é sempre da cor do
> chão.** No escuro, acento claro e texto quase preto em cima. No claro,
> acento escuro e texto branco em cima.

O tom é **dourado** nos dois temas; o que muda é a escada. No claro `--acao` é
o ouro escuro que LÊ sobre branco quente (6,79 / 6,17 / 5,63 nos três chões) e
`--acao-forte` desce mais um (8,98 / 8,16 / 7,44), porque num chão claro
"forte" quer dizer *mais* contraste. No escuro é o contrário: `--acao` é o
`#d4af37` da marca (7,52 sobre o cartão) e `--acao-forte` é mais CLARO (9,58).
`--acao-texto` acompanha o chão dos dois lados — navy no escuro, branco quente
no claro (e não `#ffffff`, §04).

**A exceção, e ela tem casa própria: o instrumento.** O cartucho do horímetro
e os cartões flutuantes de `/navegar` são navy fixo **nos dois temas** — um
acento escuro ali daria 3,02:1. Eles já tinham um bloco no CSS
(`.bg-meter, .bg-mapa-instrumento`) que reimporta as luzes vivas do escuro
para `ok`/`warn`/`crit` exatamente por esse motivo; o acento entrou na mesma
lista. É o que finalmente cumpre o que a onda 24 escreveu e nunca valeu para o
acento: **sobre o mapa é sempre a MESMA cor**, não a do tema do app.

**A separação de cartão e fundo passou a ser feita por BORDA, não por
preenchimento.** Na referência o cartão (`#1a1a1a`) sobre o fundo (`#101010`)
dá 1,105:1 — abaixo do 1,2 que `lib/ui/contraste.test.ts` exige. A borda
(`#2c2c2c`) dá 1,225:1. O teste passou a aceitar os dois caminhos e a
**exigir** a borda quando o preenchimento não separa sozinho: ficou mais
rígido, porque antes uma paleta passava com preenchimento no limite e borda
invisível.

**A regra dos dois, refinada (onda 60): moldura não paga o orçamento do
conteúdo.** O dourado de **NAVEGAÇÃO** — o indicador de onde-a-pessoa-está
(trilho lateral, bottom-nav, aba ativa do `Abas`) — é da **MOLDURA**: existe
em toda tela, não compete por atenção com o assunto dela, e por isso fica
**fora** do orçamento de dois. O orçamento de dois vale para o dourado do
**CONTEÚDO** — tipicamente a ação principal preenchida e um chip ativo. Isto
não é regra nova: é o que as ondas 57–59 já praticavam sem escrever — o
trilho e a bottom-nav sempre tiveram o item ativo em dourado sem contar como
um dos dois usos de nenhuma tela. O caso que forçou escrever a régua foi o
Financeiro (onda 60): `Lançamentos` reúne `Abas` (navegação), o chip de
filtro ativo (conteúdo) e a ação "Despesa" da barra (conteúdo) — dourados
com donos e funções diferentes, e só os dois de conteúdo disputando o mesmo
orçamento.

A moldura já teve um segundo dourado: o **FAB global** "+ Registrar"
(`RegistroRapido`), que flutuava em quase toda tela. O dono o aposentou na
onda 60 — o gesto que ele atendia ganhou casa no conteúdo das telas (cartão
do Diário na Início, "Registrar" na barra do Diário, ações das próprias
listas) e o FAB tinha virado duplicata por cima de conteúdo. Hoje a única
ação flutuante do app é o "Exportar PDF" de `/barco/resumos` — dourado de
**conteúdo** da própria tela, não de moldura (a regra de quem pode flutuar
vive em `web/lib/ui/superficies.ts`).

**Ação que se repete não é ação principal (onda 63).** A auditoria visual de
18/08 contou **oito** dourados em `/barco` — quatro vezes o orçamento. A
fonte não era descuido de uma tela: era a **ação do cabeçalho de seção**
(`SecaoPagina acao`), dourada por padrão num componente usado em ~35
arquivos. Só em `/barco` ela aparece cinco vezes ("Motor", "Ver tudo", "Ver
tudo", "Manutenção", "Editar"); somava-se a isso o "Adicionar" do Casco, que
num barco novo repete quatro vezes, uma por categoria vazia.

A régua que saiu daí, e que vale pra qualquer componente novo: **se a mesma
ação aparece mais de uma vez na tela, ela não pode ser dourada** — por
definição, a ação principal é uma só. Varrendo os ~35 usos de `SecaoPagina`,
nenhum era a ação principal da sua tela: é sempre "Ver tudo" ou "+ Alguma
coisa" secundário. A ação principal mora no `acao` de `CabecalhoDetalhe` e
`BarraFerramentas` — as pílulas douradas — e essas ficaram como estavam.

O que a ação de seção veste hoje é `text-dim`, e não é escolha nossa: o
cinza-azulado que o canvas do proprietário usa no "Ver tudo" das seções é,
dígito por dígito, o valor de `--texto-dim` no tema escuro. Para ação
secundária dentro de um cartão, o vestido é o sublinhado neutro que
`EstadoVazio enfase="discreta"` já usava desde a onda 60.

**O "Voltar" dourado NÃO é confete — não mexa nele.** A mesma varredura que
achou os oito de `/barco` acusa o link de volta de `CabecalhoDetalhe` em
cada tela de detalhe. Fomos ao canvas antes de consertar: o breadcrumb de
volta está lá em dourado, na cor exata do `--acao`, com a seta e o rótulo em
mono uppercase. É a referência, então fica. A régua da repetição não se
aplica a ele por um motivo simples: aparece **uma vez** por tela, e é
moldura — o mesmo caso do item ativo do trilho.

### Tipografia — a escala, e ela tem SEIS degraus

> **Onda 98.** A auditoria de 19/08 mediu a Início: dos **onze** títulos de
> cartão da tela, **nove** saíam idênticos — 11px, peso 400, mono, caixa alta,
> rastreados — e exatamente **um** em 15px. O dono descreveu o resultado três
> vezes com palavras diferentes: *"informação solta"*, *"fontes pequenas e
> espaçadas demais"*, *"tudo com o mesmo peso visual"*. Não era deriva de tela:
> era `components/ui/cartao.tsx` vestindo todo título de cartão com a etiqueta
> de instrumento. A escala do HAULIX §08–11 entrou inteira, **nos nomes que já
> existiam** — nenhuma classe nova além do degrau que faltava de verdade.

| HAULIX | classe da casa | antes | depois |
|---|---|---|---|
| Display L 28/700 | `.valor-instrumento` | 28 / 500 | **28 / 600** (§11, número) |
| H1 24/30/650 | `.titulo-pagina` | 24 / 600 / 1.15 | **24 / 650 / 1.25** |
| H2 20/26/650 | `.titulo-secao` *(nova)* | — | **20 / 650 / 1.3** |
| H2 (número) | `.valor-forte` | 20 / 500 | **20 / 600** |
| H3 16/22/600 | `.titulo-card` | 15 / 600 / 1.35 | **16 / 600 / 1.375** |
| Body 14/20/400 | `.corpo` | 14 / — / 1.5 | **14 / 400 / 1.43** |
| Body (número) | `.valor` | 14 / 500 | **14 / 600** |
| Label 12/16/500 | `.apoio` | 12 / — / 1.5 | **12 / 500 / 1.33** |
| Caption 11/15/500 | `.rotulo` | 11 / — / .16em | **11 / 500 / .06em** |
| Caption (metadata) | `.rotulo-dado` | 11 / — / 1.4 | **11 / 450 / 1.36** |

**Os dois degraus do documento que NÃO entram: `Body L 15` e `Body Small 13`.**
Pela régua que esta casa já tinha escrito ao recusar o 13 — *"um pixel não é
degrau de hierarquia, é ruído"*. 15 ao lado de 14 e de 16 é a mesma coisa, e
era exatamente o defeito: `.titulo-card` a 15 e `.corpo` a 14 eram a mesma voz
para o olho, então o app tinha, de fato, **uma** voz de título. Seis degraus
separados por no mínimo 2px — **11 · 12 · 14 · 16 · 20 · 24** (+ o 28 do número
que É o assunto) — é uma escada; dez degraus com vizinhos de 1px é um borrão
com dez nomes.

**Pesos: 400 corpo · 450 metadata · 500 rótulo · 600 botão/cartão/NÚMERO ·
650 título · 700 título maior. 800/900 não entram** (§11). A Inter é variável,
então 450 e 650 são pesos de verdade e não arredondam; a Plex Mono é estática
(400/500/600/700), por isso nenhum degrau mono pede 450 nem 650.

**Número operacional: peso 600, `tabular-nums` E `font-feature-settings:
"tnum"`.** As duas propriedades, não uma: a de alto nível é a que o navegador
moderno usa, e a feature OpenType direta é a que sobrevive quando a fonte chega
por fallback local — que é exatamente o instante em que uma coluna de dinheiro
desalinha na frente do dono.

**Os dois graus do `Cartao`, depois da onda 98:** `secao` (padrão) veste
`.titulo-card`; `assunto` veste `.titulo-secao`. A escada de um cartão é
**16 → 20 → 28** (o terceiro é a prop `valor`). Etiqueta de instrumento
continua existindo e continua sendo `.rotulo` — é o overline de `SecaoPagina`,
que não mudou.

### Tipografia — três papéis

São **duas famílias, com papéis separados**: **Inter** para tudo que é texto e
**IBM Plex Mono** para tudo que é número de instrumento e rótulo. As duas vêm do
`next/font` em `web/app/layout.tsx`, nas variáveis `--font-sans-app` e
`--font-plex-mono`.

> **Correção da onda 95 (achado 5.8).** Este parágrafo dizia "a família é IBM
> Plex (onda 62)" e nomeava uma variável — `--font-plex-sans` — que não existe
> em lugar nenhum do código. A Plex Sans saiu na **onda 80**, e o motivo está
> escrito em `app/layout.tsx`: a Plex tem personalidade de engenharia e chama
> atenção para si; num app cujo assunto é o número, a grotesca deixa o número
> falar. A Plex **Mono** ficou, e ficou de propósito — já está afinada com
> `.rotulo` e com `--font-mono-instr`. Ou seja: a doc descreveu por quinze ondas
> uma decisão que o código tinha revertido, e quem calibrasse tipografia por
> esta página estaria calibrando contra uma fonte que o app não carrega.
> (A Urbanist, que a onda 62 aposentou, continua fora — isso não mudou.)

- **Título e estado** — Inter 600. A voz editorial; é onde mora a personalidade.
  Título grande pede tracking negativo (`.titulo-pagina` = −.022em,
  `.titulo-card` = −.011em): a grotesca tem aberturas menores que a Plex e, no
  espaçamento padrão, título grande fica frouxo.
- **Corpo** — Inter (400/500), o texto que se lê.
- **Número de instrumento e rótulo de cartão** — IBM Plex Mono
  (`--font-mono-instr`, fallback ui-monospace). Números sempre tabulares:
  hora de motor, profundidade, coordenada, valor, distância. **Sempre**, sem
  exceção: coluna de dinheiro em fonte proporcional desalinha a vírgula e vira
  comparação de texto em vez de comparação de valor. O `.rotulo` (título de
  cartão/seção, 11px, tracking .16em, uppercase) também é Mono — no canvas o
  rótulo é etiqueta de instrumento, não frase.

  **Onda 79 — um segundo rótulo, `.rotulo-dado`.** A varredura pixel a pixel
  da referência (anatomia de ficha de veículo) achou um rótulo que NÃO é
  etiqueta de instrumento: a legenda de um valor dentro de um cartão
  ("Client", "Weight capacity", "Risk score") — caixa de frase, sem tracking,
  fonte de texto. `.rotulo` não mudou (o link "Voltar", o overline de
  `SecaoPagina` e o logotipo "Commander" dependem do desenho antigo, e o
  raio de ~140 usos era grande demais pra mudar sem revisar tela por tela);
  `.rotulo-dado` é a forma nova, aditiva, em `app/globals.css`.

**Onda 96 — o cartão passa a ter GRAU, e é ele que faltava para existir "o
assunto da tela".** A auditoria de 19/08 mediu os **oito** `<h2>` da Início —
de "PRECISA DA SUA ATENÇÃO" a "ACESSO RÁPIDO" — saindo com exatamente 11px,
peso 400 e o mesmo cinza. Os oito. A causa não era deriva de tela: era a API
de `components/ui/cartao.tsx`, que escrevia o título com classe fixa e não
aceitava grau. Quando o assunto mais crítico e o atalho mais descartável
vestem a mesma roupa, **não existe o assunto** — e "informação solta", que é
como o dono descreve a Início, é o nome exato disso.

`Cartao` ganhou a prop `peso`, com dois graus e **nenhum tamanho novo**:

| `peso` | título | quando |
|---|---|---|
| `secao` (padrão) | `.rotulo` + `text-dim` — 11px mono, caixa alta, cinza | o cartão é **uma área** da tela; o título é etiqueta. É o que todos os cartões já eram, byte a byte |
| `assunto` | `.titulo-card` — 15px/600 na cor do texto | o cartão **é o assunto** da tela |

Junto veio a prop `valor`, que rende em **`.valor-instrumento` (28px)** — a
classe que o próprio CSS descreve como "o número que É o assunto da tela" e
que tinha **três** usos em todo o app, todos em Financeiro, com um aviso
escrito ao lado: classe declarada sem consumidor deve ser apagada, não deixada
de enfeite. Este é o consumidor que faltava.

Dois graus, e não três: o degrau do meio seria `.corpo` (14px), e o
`globals.css` já registra que um pixel de diferença para `.titulo-card` "não é
degrau de hierarquia, é ruído". A escada de verdade é **11 → 15 → 28**.

**A regra que o componente não consegue cobrar: um `assunto` por tela.** Não
há contexto de tela para checar, e é da mesma natureza da regra dos dois
dourados — vive em revisão humana. Dois assuntos na mesma tela é zero assunto,
e aí a Início volta a ter oito iguais, só que em 15px.

### Rastreio — um degrau só: **.06em**

> **Era `.16em` até a onda 98, e esse número era a metade objetiva de "fontes
> pequenas e espaçadas demais".** O HAULIX §43 especifica o rótulo em caixa
> alta com `letter-spacing: .04em`; a casa escrevia `.16em` — **quatro vezes**.
> Em 11px isso abre ~1,8px entre letras: a palavra deixa de ser palavra e vira
> uma fila de letras. `.06em` e não os `.04em` do documento porque o §43 mede
> uma grotesca e o `.rotulo` da casa é MONO, que já tem avanço fixo — em caixa
> alta, `.04em` fecha as hastes contra as vizinhas. **Continua sendo UM
> degrau**; só o valor mudou.
>
> **Correção de método, e ela importa mais que o número.** O parágrafo abaixo
> dizia que a auditoria mediu "onze valores de tracking escritos à mão". A
> remedição de 19/08, descartando linha de comentário — inclusive `{/* … */}`,
> que é a forma dominante neste repo — encontrou **dois**:
> `tracking-[.16em]` (3 usos) e `tracking-[-0.02em]` (2 usos). Os outros nove
> estavam **dentro dos comentários que descrevem a limpeza já feita**. A conta
> antiga leu a própria prosa como código.

"Palavra em caixa alta, rastreada" é **um** gesto, e a auditoria de 19/08
(achado 5.12) mediu **onze** valores diferentes escritos à mão para ele —
`.05em`, `.06em`, `.08em`, `.09em`, `.1em`, `.12em`, `.14em`, `.16em`, `.28em`…
Nenhum deles saiu de uma régua; cada um saiu do olho de quem escreveu a tela
naquele dia. Onze valores para um gesto é o retrato do que esta página chama de
deriva: não há decisão errada em nenhum deles isoladamente, e mesmo assim o
conjunto lê como sistema nenhum.

O degrau é o do `.rotulo`: **.16em**. Um só.

- **Regra:** use a classe `.rotulo`. Ela carrega tracking, caixa alta, a Mono e
  o piso de 11px de uma vez, e é o que impede o valor de voltar a divergir.
- **Exceção, e é uma só:** quando o corpo do texto é dimensionado por quem
  chama, `.rotulo` não serve — ela **crava** `font-size: 11px`. É o caso do
  wordmark em `components/logo.tsx`, que aparece em `text-lg`, `text-base`,
  `text-sm` e `text-[11px]` conforme a tela, com o símbolo ao lado medindo
  `1.6em` do mesmo corpo: com a classe, a palavra congelaria em 11px enquanto o
  símbolo continuaria escalando, e a marca sairia desalinhada em cinco telas.
  Aí se escreve `tracking-[.16em]` na mão — **o mesmo valor**, nunca um novo.
- **Não confunda com o aperto de título.** `tracking-[-0.02em]` em título
  grande não é este gesto: é o negativo da Inter, e ele já tem casa própria
  (`.titulo-pagina` / `.titulo-card`). Título que escreve o negativo à mão
  está reescrevendo a classe, não abrindo exceção.

### Contagem — uma forma: **rótulo colado no número, dentro da pílula**

"Quantos" é um gesto só, e o app o escrevia de três jeitos (achado 5.7):
dentro de uma pílula, como `rótulo: valor`, e como número mono solto ao lado de
um título. Três formas para a mesma pergunta é o que faz duas telas vizinhas
parecerem produtos diferentes.

A régua é a primeira, e ela tem dois portadores conforme o número seja leitura
ou filtro:

- **`ChipDado`** (`components/ui/chip.tsx`) — a contagem que se **lê**. Rótulo e
  número na mesma pílula, rótulo em `.rotulo`, número em `.valor` mono tabular.
  Não se toca, então não paga o alvo de 44px.
- **`Chip contagem`** e **`Abas contagem`** — a contagem que **acompanha um
  filtro ou uma aba**: é o tamanho do recorte, dito junto do recorte. Esses se
  tocam e pagam os 44px.

Duas regras que vêm junto e não são negociáveis:

1. **Sem dois-pontos.** `Sistemas: 3` transforma a pastilha numa *frase* no meio
   de uma fila que o olho lê como painel. A referência não usa nenhum. Foi o
   dois-pontos de `FaixaKpi` a segunda das três formas, e ele caiu na onda 95.
2. **Zero desenha.** `Vencido 0` é uma resposta; pílula sem número não diz
   "zero", diz "não sei contar isto" (§6, regra 7).

**As exceções legítimas, e por que cada uma é uma:**

- **`ContadorAvisos`** — o badge vermelho sobre o ícone de Avisos. Não tem
  rótulo dentro da pílula porque o rótulo é o **link vizinho** ("Avisos"), e
  repeti-lo dentro de um círculo de 16px é impossível antes de ser feio. É
  sinal de "tem coisa te esperando", não relatório — por isso também vira "9+"
  acima de nove.
- **`Kpi`** (`components/ui/kpi.tsx`) — rótulo **acima** do número, sem pílula.
  Não é contagem: é o valor de uma grandeza dentro de um cartão, e o cartão já
  é a moldura que a pílula seria.
- **`GradeRotuloValor`** — é `<dl>` de **dado** ("Cliente", "Capacidade"), não
  de contagem. Mesmo desenho de par, pergunta diferente.
- **O número que É o assunto da tela** (`Medidor`, `.valor-instrumento`) — não
  entra em pílula nenhuma. Ali o instrumento inteiro é a moldura.

Fora dessas quatro, número solto ao lado de um título é deriva, não exceção.

### Alvo de toque — 44px, e o DESENHO pode ser menor

Mínimo, sem exceção, para qualquer coisa que se toca. Link no meio de
parágrafo não conta como alvo isolado. A varredura de tela mede isso.

**O conflito com o HAULIX, e como ele se resolve.** O §21 do documento admite
controle de 28px (small) e põe o médio em 34–36; a régua desta casa é 44px e
não negocia — o app é usado com a mão molhada, no barco balançando. Os dois
convivem pelo padrão que `lib/ui/acoes.ts` já praticava:

> **O ALVO tem 44px. O DESENHO pode ser menor, e mora DENTRO dele.**
> Quem carrega a régua é o `<Link>`/`<button>` de fora; a pílula, o círculo ou
> a cápsula é um `<span>` por dentro. `ALVO_ACAO` + `PILULA_ACAO` (44/30),
> `BotaoCirculo` (44/30) e, desde a onda 98, `Chip` (44/34) são os portadores.

Duas armadilhas, as duas já pagas uma vez:

1. **Margem negativa só quando o container permite.** `ALVO_ACAO` usa
   `-my-[7px]` para o cabeçalho de seção não engordar 14px em ~35 telas. No
   `Chip` isso seria defeito: `ChipLinha` é `overflow-x: auto`, e `overflow-x`
   promove o eixo Y a `auto` também — os pixels que sobrassem seriam
   recortados **junto com a área clicável**, e o alvo voltaria ao tamanho do
   desenho sem ninguém perceber.
2. **A régua se lê em quem embrulha, não em quem desenha.** Um `h-9` no
   `<span>` não é violação; um `h-9` no elemento clicável é. Se você usar
   `PILULA_ACAO_BLOCO` ou `PILULA_ACAO_PRINCIPAL` num lugar novo, o `<span>`
   NÃO pode ser o clicável.

**A exceção declarada é o campo de formulário: 48px** (`--altura-campo`), acima
da faixa de 36–40 do §38. O texto dentro dele é 16px porque abaixo disso o
Safari do iPhone dá zoom ao focar, e o botão que fecha o formulário herda a
altura do campo — é o alinhamento dos dois que faz a coluna parecer uma coluna.

### Status — um vocabulário só, e é o do semáforo

O HAULIX §54 declara `CRITICAL → HIGH → WARNING → NORMAL → LOW`. O app já fala
outro idioma, com teste e domínio por trás (`lib/domain/semaforo.ts`,
`components/ui/selo.tsx`). **Não existem dois vocabulários — existe este
de-para**, e quem escrever tela nova usa a coluna da direita:

| HAULIX §54 | cor | vocabulário da casa | onde mora |
|---|---|---|---|
| CRITICAL | vermelho | `vencido` (semáforo) · `critico` (selo) | `StatusFarol` / `EstadoSelo` |
| HIGH / WARNING | âmbar | `atencao` | os dois |
| ACTIVE | verde | `ok` | os dois |
| NORMAL / LOW | cinza | `neutro` | `EstadoSelo` |

Duas notas que o de-para não pode apagar:

- **`vencido` e `critico` são a mesma linha, com palavras diferentes de
  propósito.** `rotuloDoFarol` diz "Vencido" porque é o que o semáforo fala em
  `textoRestante` e na Saúde; o `Selo` genérico diz "Crítico". A tradução vive
  em `seloDoFarol`, no domínio, com teste — não se reescreve na tela.
- **`neutro` não existe no §54 e não é `LOW`.** É "sem dados", e a régua de
  honestidade (§6, regra 7) proíbe que ele vire verde por omissão.

**O desenho do badge é o §25:** pill, altura **22**, padding **0 7**, fonte
**11**, peso **600**, e nunca só cor — palavra ou símbolo junto (§6, regra 3).
Isso é `components/ui/selo.tsx`; não escreva pílula de estado à mão.

---

### Identidade por hub — PROPOSTA, ainda não implementada

O dono pediu, no §3 do spec de 19/08, que os oito cards da central técnica
(Motores · Casco · Elétrica · Hidráulica · Segurança · Equipamentos ·
Documentos · Manutenções) tenham **identidade visual por hub** — e a mesma
frase avisa o risco: não pode virar arco-íris. A proposta, para decisão:

**A identidade tem dois canais, e só um deles é cor.**

1. **O ícone é o canal principal e já existe** — `components/icone.tsx` tem um
   desenho próprio por hub, e a distinção entre eles já foi trabalhada uma vez
   (o comentário de `hidraulica` explica por que ela não é `oleo`; o de
   `seguranca`, por que não é `escudo`). É de graça e é o canal que funciona
   para daltônico.
2. **A cor do hub vive SÓ no ícone e no cartucho dele** — nunca no fundo do
   card, nunca na borda, nunca no texto. É a regra que impede o arco-íris:
   **o corpo do card continua neutro, e a única cor que aparece nele é a de
   ESTADO** (verde/âmbar/vermelho). Um card cujo hub é azul e cujo estado é
   vermelho tem que ler "vermelho" de longe; se o hub pintasse a borda, os
   dois competiriam.
3. **Os oito tons são dessaturados de propósito** (saturação ~25–35%, uma
   luminância só). Ouro e os três semânticos são saturados; um tom de hub
   saturado passaria a parecer estado. Dessaturados, eles lêem como "família
   de instrumento" — que é a linguagem do produto — e nenhum deles pode ser
   confundido com uma cor que significa alguma coisa.

**Custo de errar isto:** oito matizes vivos no mesmo grid é a definição de
"dashboard colorido", que o HAULIX §58 lista entre o que não fazer e que o
dono acabou de nomear em outras palavras.

**Por que não está implementado:** a aplicação é em `app/(app)/barco/`, que
está sendo refeita em paralelo, e os oito tokens só devem nascer com o
consumidor no mesmo commit — a regra que esta casa passou as ondas 87–98
cobrando. A camada de tokens fica pronta para receber; a decisão dos oito tons
é do dono.

## 6. Como nos comportamos — as regras

**1. O conteúdo brilha; a moldura se cala.** Antes de acrescentar efeito,
pergunte qual informação ele ajuda a ler. Se a resposta for "nenhuma, ficou
bonito", ele não entra.

**2. Uma ação principal por tela.** A segunda mais importante é um link
discreto. A terceira está em outro lugar.

**3. Estado é forma, não só cor.** Daltônico não enxerga o farol verde. Todo
estado precisa de palavra ou símbolo além da cor.

**4. Nunca decorar o vazio.** Estado vazio explica o valor da área e oferece a
ação — não ganha ilustração pra "não ficar vazio" (PRD §24).

**5. Densidade é respeito.** O dono confere o barco em pé no píer. Informação
espalhada em cartões arejados obriga a rolar; informação densa e bem hierarquizada
responde na primeira tela. Waze e Navionics são densos — o que eles não são é
poluídos.

**6. Repetir é o objetivo.** Duas telas que fazem a mesma coisa têm que parecer
a mesma coisa. Se você está escrevendo um estilo à mão, pare: ou o componente
existe, ou você acabou de encontrar um que precisa existir.

**7. Honestidade é parte da estética.** Sem porcentagem na Saúde; maré é
estimativa; o app não é auxílio à navegação. Um número inventado bonito é pior
que um "sem dados" honesto.

---

## 7. Como isso é cobrado

Não vale como intenção. A varredura `web/e2e/varredura-mobile.spec.ts` abre
todas as telas em **390×844 e em 1440×900** e mede sobreposição, estouro
horizontal, falta de saída e alvo abaixo de 40px. É o instrumento que provou
que o problema existia, e é ele que prova que sumiu. Grava um relatório por
largura em `web/.varredura/` e **não** quebra a suíte quando acha defeito: o
objetivo é medir e priorizar a próxima onda, não empilhar cento e tantos
vermelhos sem ordem.

A regra "nenhuma cor literal nova" tem cobrança própria e barata:
`web/lib/ui/tokens.test.ts` conta os hexadecimais escritos à mão em `.tsx` e
reprova se o número subir — e reprova também se ele **descer** sem que o teto
desça junto, senão a folga vira crédito pra próxima cor. É Vitest, roda no
`npm test`, então essa deriva morre antes do commit.

O contraste tem cobrança própria em `web/lib/ui/contraste.test.ts`, e vale
registrar como ela falhou, porque é a lição mais cara desta página: até a onda
96 o teste media **quatro pares, e só no tema escuro** — e por isso ficou
**verde** enquanto o acento do tema claro entregava 2,10:1. Um teste que
escolhe os pares que mede não mede contraste; mede os pares que alguém lembrou
de escrever. Hoje a mesma tabela roda nos **dois** temas e cobre o que a tela
usa: texto, texto fraco, texto de chip, os quatro semânticos, o dado, o
cartucho de instrumento e o acento **nos dois sentidos** (como texto sobre os
três chões, e o texto do botão cheio sobre ele). **Token de cor novo sem linha
nova aqui reabre o buraco.**

O que eles **não** medem — hierarquia, densidade, se o dourado virou confete —
é revisão humana, com esta página na mão.

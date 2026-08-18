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

### Raio de borda — três
- **8px** — controle pequeno (chip, botão pequeno, campo)
- **14px** — cartão, painel, bloco de conteúdo
- **999px** — pílula e avatar

Quatro raios diferentes na mesma tela é sintoma, não estilo.

### Elevação — três, e cada uma significa algo
- **plano** — o padrão. A maioria das superfícies não tem sombra.
- **cartão** (`sombra-1`) — separa do fundo.
- **flutuante** (`sombra-2`) — só para o que de fato paira sobre o conteúdo:
  bottom sheet, menu, pastilha sobre o mapa.

Sombra não é decoração. Se o elemento não flutua, não tem sombra.

### Cor — significado, nunca enfeite
- **Navy** — a marca e o fundo escuro.
- **Dourado** — **a ação principal e o pertencimento à marca.** No máximo
  **dois** usos de dourado por tela. Se tem sete, o dourado parou de significar.
- **Verde / âmbar / vermelho** — estado do barco. **Nunca** decoração, nunca
  "destaque". Vermelho é reservado a crítico (PRD §1.1 e §4.6).
- **Cinza-azulado** — texto secundário e linha.

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

### Tipografia — três papéis

A família é **IBM Plex** (onda 62). A Urbanist saiu: quando o dono desenhou o
app inteiro no Claude Design (`docs/design-mobile/`, 32 telas), a seção 2 do
canvas testou três direções tipográficas e a terceira consolidou IBM Plex — a
seção 3 se chama literalmente "As telas que faltavam — já em IBM Plex". A
Urbanist é geométrica e arredondada, voz de app de consumo; a Plex é neutra de
engenharia, e o Commander se comporta como instrumento. As duas variáveis vêm
do `next/font` em `web/app/layout.tsx` (`--font-plex-sans` /
`--font-plex-mono`).

- **Título e estado** — IBM Plex Sans 600. A voz editorial; é onde mora a
  personalidade.
- **Corpo** — IBM Plex Sans (400/500), o texto que se lê.
- **Número de instrumento e rótulo de cartão** — IBM Plex Mono
  (`--font-mono-instr`, fallback ui-monospace). Números sempre tabulares:
  hora de motor, profundidade, coordenada, valor, distância. **Sempre**, sem
  exceção: coluna de dinheiro em fonte proporcional desalinha a vírgula e vira
  comparação de texto em vez de comparação de valor. O `.rotulo` (título de
  cartão/seção, 11px, tracking .16em, uppercase) também é Mono — no canvas o
  rótulo é etiqueta de instrumento, não frase.

### Alvo de toque — 44px
Mínimo, sem exceção, para qualquer coisa que se toca. Link no meio de
parágrafo não conta como alvo isolado. A varredura de tela mede isso.

---

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

O que eles **não** medem — hierarquia, densidade, se o dourado virou confete —
é revisão humana, com esta página na mão.

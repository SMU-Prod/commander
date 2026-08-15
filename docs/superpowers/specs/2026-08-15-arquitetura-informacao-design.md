# Arquitetura de informação do Commander — onde cada coisa mora

Spec de arquitetura · 15/08/2026

**Objetivo:** dar a cada uma das 80 telas uma natureza declarada, com anatomia
fixa, e consertar os dois lugares onde a falta disso já dói: **Avisos** e
**Menu**.

**Referência:** [`docs/DESIGN.md`](../../DESIGN.md) diz *como* o Commander se
comporta visualmente. Este documento diz *onde as coisas ficam*. Ele é a
continuação direta de
[`2026-08-15-fundacao-visual-design.md`](2026-08-15-fundacao-visual-design.md),
que entregou tokens, três componentes e a casca responsiva — e deixou dois
componentes (`Abas` e `BarraFerramentas`) sem construir de propósito, porque
componente sem consumidor nasce torto. **Este spec nomeia os consumidores.**

**Origem:** o dono, olhando a onda 57 em execução, disse:
*"página de avisos tá uma zona"* e *"o menu mais parece configurações do que
menu"*. As duas frases descrevem o mesmo defeito, e não é de estilo.

---

## 1. O problema, medido

| Fato | Número |
|---|---|
| Telas em `app/(app)` | **80** |
| Naturezas de tela declaradas em algum lugar | **0** |
| Trabalhos diferentes que `/notificacoes` faz numa tela só | **4** |
| Itens no Menu, todos com o mesmo peso visual | **17**, em 10 seções |
| Busca global | **não existe** |

**O diagnóstico:** o app tem 80 telas e nenhuma taxonomia. Cada tela foi
desenhada por si, então "uma lista" e "uma ficha" e "um painel" se parecem por
acaso quando se parecem. `docs/DESIGN.md` §6 regra 6 exige o contrário —
*"duas telas que fazem a mesma coisa têm que parecer a mesma coisa"* — mas
exigir não basta: sem as naturezas escritas, não há o que repetir.

Avisos e Menu são só onde o buraco ficou grande o bastante para o dono ver.

---

## 2. As quatro naturezas de tela

Toda tela do app é uma destas quatro. Se uma tela nova não couber, ou ela está
fazendo duas coisas, ou achamos a quinta — e aí este documento muda.

### 2.1 Painel — "como está?"
Uma só: a **Início**. Estado atual, o que precisa de ação, atalho para o
registro que se faz todo dia.
**Anatomia:** assunto (a foto do barco) → estado → pendências → ação principal
→ instrumentos.
**Não tem:** filtro, aba, lista longa. Painel que precisa de filtro virou lista.

### 2.2 Lista — "quais existem?"
Diário, Financeiro, Equipamentos, Ocorrências, Agenda, Prestadores,
Marketplace, Explorar, Fotos, Tripulação, Avisos.
**Anatomia:** título → **`BarraFerramentas`** (filtros e alternâncias, altura
única) → `LinhaLista` repetida → `EstadoVazio` quando não há nada.
**A ação de criar mora na barra**, não flutuando, e não em três lugares.

### 2.3 Ficha — "conta tudo sobre este"
Equipamento, saída do diário, embarcação, parceiro, ocorrência, lançamento.
**Anatomia:** cabeçalho com identidade e estado → **`Abas`** quando há mais de
um assunto (Visão geral · Manutenção · Histórico · Ocorrências) → `Cartao` por
bloco → ações no fim.
**Toda ficha tem saída visível.** Foi a falha que a varredura mediu em cinco
telas na onda 56.

### 2.4 Formulário — "registre isto"
Criar e editar, qualquer coisa.
**Anatomia:** título → campos → salvar e cancelar, ambos visíveis sem rolar
até o fim.
**Sem ação flutuante** — já é regra em `lib/ui/superficies.ts`, e a razão é
que o botão flutuante cobria campo.

**O que isto compra:** `Abas` e `BarraFerramentas` deixam de ser componentes
abstratos. `BarraFerramentas` nasce na primeira lista refeita, `Abas` na
primeira ficha. E a varredura passa a poder cobrar anatomia, não só
sobreposição.

---

## 3. Avisos — de caixa de tudo a caixa de entrada

### 3.1 O que a tela faz hoje
`app/(app)/notificacoes/page.tsx`, 207 linhas, quatro trabalhos empilhados:

1. **ativar o push no aparelho** (`AtivarAlertas`, linha 132);
2. **filtrar** por categoria;
3. **ler** os avisos, em três blocos — Críticas, Importantes, Informativas;
4. **auditar** o que o sistema já disparou ("Histórico de avisos").

Os quatro têm o mesmo peso na página. E o Menu manda para cá com o rótulo
**"Configurar avisos"**, que descreve o trabalho 1 — o menos importante dos
quatro.

### 3.2 O que ela passa a ser
**Uma caixa de entrada cujo objetivo é ficar vazia.**

- **Só o que pede ação.** Cada item diz o que aconteceu, em qual barco ou
  equipamento, e traz **a ação** — não um link genérico para a área. Aviso que
  não se resolve pelo aviso é aviso que se lê duas vezes.
- **Crítico primeiro, com peso inteiro.** Importantes e informativas ficam
  recolhidas atrás da contagem, e abrem se a pessoa quiser. É a hierarquia
  progressiva do Navionics (`DESIGN.md` §2): contagem → item → detalhe. Três
  cabeçalhos numa tela que quase sempre tem dois itens é moldura fazendo o
  trabalho do conteúdo.
- **Zero é uma resposta boa.** `EstadoVazio` diz "nenhuma pendência" e mostra
  quando foi a última verificação — sem ilustração e sem decorar o vazio
  (`DESIGN.md` §6 regra 4).
- **O histórico sai da caixa de entrada.** Ele é registro de auditoria — útil
  para saber "o app me avisou?" e inútil no dia a dia. Vira **aba** dentro de
  Avisos (`Abas`: Pendentes · Histórico), não bloco embaixo.
- **Ativar o push vai para Ajustes**, com o rótulo dizendo o que faz. O que
  fica em Avisos é, no máximo, uma tarja quando o push está desligado — porque
  aí é informação sobre a própria caixa.

### 3.3 O que isso corrige no resto do app
A barra inferior e o trilho têm um indicador de contagem em Avisos. Hoje ele
soma coisas de três gravidades, então um número no ícone pode ser três
informativos. **A contagem passa a ser de pendências que pedem ação** — que é
o que um número vermelho sobre um ícone promete.

---

## 4. Menu — de gaveta a índice

### 4.1 Por que parece configurações
Porque metade dele é. As 10 seções misturam três naturezas diferentes,
renderizadas todas com o mesmo `LinhaLista variant="cartao"`:

| Natureza | Itens hoje |
|---|---|
| **Destino** — uma área do produto | Financeiro, Carteira, Agenda, Tripulação, Prestadores, Marketplace, Explorar, Admin |
| **Ajuste** — muda como o app se comporta | Assinatura, Aparência, Configurar avisos, Cadastrar embarcação, perfil da conta |
| **Institucional** | Termos de Uso, Política de Privacidade |

Quando "Financeiro" — uma área inteira do produto, com quatro sub-telas — tem
exatamente o mesmo peso visual que "Política de Privacidade", o menu deixa de
ter hierarquia. E como o topo dele é **Conta** e **Assinatura**, a primeira
impressão é a de uma tela de configurações. O dono leu certo.

A confusão já vazou para a URL: **Tripulação mora em `/menu/tripulacao`**.
Convidar comandante e ajustar permissão é uma área do produto, não um ajuste
do menu — e o endereço diz o contrário. Endereço é arquitetura escrita; quando
ele mente, alguém depois trata a tela como ajuste porque foi ali que a
encontrou.

### 4.2 O que ele passa a ser
**O índice do produto.** O PRD §9 já chama o Menu de *gate de descoberta*: o
lugar onde se aprende que o app faz mais do que a barra de baixo mostra.

- **Só destinos**, agrupados pela vida do barco, não por tecnologia:
  **O barco** (Equipamentos, Fotos, Documentos, Ocorrências) ·
  **Dinheiro** (Financeiro, Carteira) ·
  **Gente** (Tripulação, Comandantes) ·
  **Rede** (Prestadores, Marketplace, Explorar).
- Cada destino diz **o que tem lá dentro** — número, estado ou a pendência.
  "Financeiro" sozinho é um rótulo; "Financeiro · R$ 4.820 este mês" é um
  destino. Índice sem informação é sumário.
- **Ajustes vira tela própria**, alcançada por uma linha no fim do Menu.
  Assinatura, Aparência, Avisos do aparelho, Perfil, Cadastrar embarcação,
  Termos e Privacidade moram lá — na ordem de quem procura, com o
  institucional no rodapé.
- **Admin continua condicionado ao papel**, e continua no Menu: é destino, não
  ajuste.

### 4.3 A regra que evita o Menu inchar de novo
Um destino ganha vaga fixa na navegação (barra de baixo ou trilho) quando é
**usado toda semana pela mesma pessoa**. Os outros vivem no Menu. Quando um
destino do Menu passar a ser semanal, ele sobe — e alguém desce, porque as
cinco vagas do celular são físicas, não negociáveis (a barra cabe cinco
colunas de 71px, e foi por isso que "Comandantes" precisou de fonte menor até
sair, na onda 57).

---

## 5. Fora deste spec, e por quê

- **Busca global.** Com 80 telas ela é tentadora e provavelmente vem a seguir.
  Não entra agora porque ela não conserta o Menu — um menu confuso com busca
  em cima continua confuso, e a busca vira o remendo que adia o conserto.
- **Mapa da Embarcação** (o diagrama de zonas, a referência do caminhão 3D do
  Haulix). Continua sendo subsistema próprio, com spec próprio. Ele é uma
  **ficha** pela taxonomia acima, e vai consumir `Abas`.
- **Refazer as 80 telas.** Este spec declara as naturezas; aplicá-las é onda a
  onda, começando pelas listas mais usadas — Diário e Financeiro.
- **Layout de desktop das telas herdadas.** A varredura de 1440px já mediu:
  delta zero de defeito medível, mas as telas herdadas são uma coluna de
  1400px, com o chevron a 1300px do rótulo em `/barco`. É trabalho de layout
  por natureza de tela, e é o que a §2 destrava.

---

## 6. Como isso é verificado

- **A varredura** (`web/e2e/varredura-mobile.spec.ts`, já rodando em 390 e
  1440px) ganha uma asserção por natureza: lista tem barra de ferramentas;
  ficha tem saída; formulário não tem ação flutuante. Hoje ela mede
  sobreposição, estouro, saída e alvo — passa a medir **anatomia**.
- **Avisos:** teste de que a contagem do ícone conta pendências que pedem
  ação, e não informativos. É a diferença entre um número que se confia e um
  que se ignora.
- **Menu:** teste de que todo destino do Menu leva a uma rota que existe, e de
  que nenhum ajuste sobrou entre os destinos. O Menu é o gate de descoberta —
  link morto ali é área do produto que ninguém acha.
- **Revisão humana** com `docs/DESIGN.md` na mão para o que máquina não mede:
  se o Menu agora parece índice, e se a caixa de entrada vazia parece boa
  notícia em vez de tela quebrada.

---

## 7. Riscos assumidos

**Tirar o histórico da caixa de entrada vai parecer perda de função.** Não é:
ele continua em Avisos, atrás de uma aba. O que muda é que ele para de
competir com o que pede ação hoje.

**Separar Ajustes acrescenta um toque** para quem ia direto na Aparência. É o
preço de o Menu voltar a ser índice — e quem mexe em Aparência mexe uma vez,
enquanto quem procura uma área do produto procura sempre.

**A taxonomia vai ser violada antes de estar aplicada.** As 80 telas não
mudam de uma vez, então por um tempo vão conviver telas com anatomia e telas
sem. A varredura é o que impede a convivência de virar permanente: ela cobra,
e o número só desce.

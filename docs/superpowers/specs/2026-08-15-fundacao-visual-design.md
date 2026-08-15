# Fundação visual do Commander — casca responsiva, componentes e Início

Spec de design · 15/08/2026

**Objetivo:** dar ao Commander a aparência e o comportamento de plataforma —
consistente, densa, responsiva de celular a desktop — sem reescrever 109 telas.

**Referências:** o painel Haulix (fundo quase preto, trilho de ícones, faixa de
KPI, cartões de anatomia única, um acento só), Waze (moldura fina sobre
conteúdo, uma ação por vez) e Navionics (o dado é sagrado, o chrome se afasta).
Os princípios estão em [`docs/DESIGN.md`](../../DESIGN.md); este spec é a
aplicação deles.

**Fora deste spec, e proposital:** o **Mapa da Embarcação** (diagrama de zonas
com equipamentos, manutenções e ocorrências fixados no lugar físico) é
subsistema próprio — dado novo, telas novas, onda própria. Ele ganha spec
separado depois que esta fundação estiver de pé, porque ele *consome* os
componentes definidos aqui.

---

## 1. O problema, medido

| Fato | Número |
|---|---|
| Telas | 109 |
| Usos de breakpoint no app inteiro | **42** |
| Largura máxima do conteúdo | **430px** (`app/(app)/layout.tsx`), 560px no admin |
| Mesma pílula de filtro escrita à mão | **12 telas, 6 alturas** (achado em 15/08) |
| **Cores literais (#rrggbb) fora dos tokens, em .tsx** | **95** |

Traduzindo: **não existe layout de desktop.** Num notebook de 1440px, o app é
uma coluna de 430px com mil pixels vazios em volta. E o que existe deriva,
porque o sistema de tokens é seguido por convenção, não por construção.

**A tese deste spec:** não se conserta isso tela a tela. Conserta-se na **casca**
e em **oito componentes**, que já são usados por quase tudo — `LinhaLista`
aparece em **27** arquivos, `EstadoVazio` em **50**. Mudar a origem propaga.

---

## 2. Tokens

Ficam em `app/globals.css`, no bloco de tokens que já existe. Nenhum valor
literal de cor, raio ou sombra fora deste arquivo.

### 2.1 Espaçamento — base 8, sete degraus
`4 · 8 · 12 · 16 · 24 · 32 · 48`

Qualquer outro valor é escolha de olho. A régua já é a do Tailwind
(`1 2 3 4 6 8 12`), então isto é disciplina, não configuração.

### 2.2 Raio — três
| Token | Valor | Uso |
|---|---|---|
| `--raio-controle` | 8px | chip, campo, botão pequeno |
| `--raio-cartao` | 14px | cartão, painel, bloco |
| `--raio-pilula` | 999px | pílula, avatar, selo |

O raio de 26–30px do mockup anterior sai: com fundo escuro e cartões vizinhos,
raio grande come a densidade que a referência tem.

### 2.3 Elevação — três, e sombra só para o que flutua
| Token | Uso |
|---|---|
| `--elev-plano` | sem sombra — **o padrão da maioria das superfícies** |
| `--elev-cartao` | separa cartão do fundo |
| `--elev-flutuante` | só bottom sheet, menu e pastilha sobre mapa |

### 2.4 Cor

**Tema escuro** (o da referência; vira o padrão da vitrine e do uso noturno):

| Token | Hex | Papel |
|---|---|---|
| `--fundo` | `#0a0e12` | ground |
| `--superficie` | `#121820` | cartão |
| `--superficie-2` | `#1a222c` | campo, cartão sobre cartão |
| `--linha` | `#232d38` | borda e divisória |
| `--texto` | `#e8eef4` | texto |
| `--texto-fraco` | `#8fa2b3` | secundário |
| `--acento` | `#c9a961` | **ação principal e marca** |

**Tema claro** mantém a paleta atual — ele existe por um motivo funcional
(leitura sob sol na marina) e não muda de propósito. Ganha só a mesma
**estrutura** de tokens, para que componente nenhum precise saber em qual tema
está.

**Semânticos, iguais nos dois temas:**
`--ok` verde · `--atencao` âmbar · `--critico` vermelho.
Nunca decorativos. Vermelho é reservado a crítico (PRD §1.1, §4.6).

**A regra do acento:** no máximo **dois** usos de dourado por tela. Com sete, ele
deixa de significar "aqui se age" e vira confete — foi o erro da proposta
anterior.

### 2.5 Tipografia — três papéis
| Papel | Fonte | Uso |
|---|---|---|
| Título / estado | Urbanist, peso 600 | nome do barco, estado, título de tela e cartão |
| Corpo | Urbanist, 400/500 | texto |
| Instrumento | mono, `tabular-nums` | **todo número**: hora, profundidade, coordenada, valor, distância, contagem |

Escala: `11 · 12 · 14 · 16 · 20 · 26 · 34`.

**Georgia sai.** Era o traço mais forte da proposta anterior e é o que mais
"data" o visual. A referência que o dono escolheu não tem serifada em lugar
nenhum — a personalidade dela vem de densidade e contenção, não de tipo
decorativo.

---

## 3. A casca responsiva

Um componente, `MolduraApp`, que já existe e passa a saber ser três coisas.
É a única peça que conhece breakpoint de layout.

### 3.1 Celular — abaixo de 768px
Exatamente o que existe hoje: coluna única, `max-width: 430px` centralizada,
navegação inferior com 5 destinos, folga inferior que respeita
`env(safe-area-inset-bottom)` (a correção da onda 54 — **não regredir**).

**Os 5 destinos:** Início · Barco · **Diário** · Agenda · Menu.
Diário entra; "Comandantes" sai para o Menu. Fecha a pergunta que estava aberta
desde a onda 46: o Diário é o coração do app e não tinha vaga fixa.

### 3.2 Tablet — 768px a 1023px
Coluna única de até 680px, navegação inferior mantida. Cartões que hoje empilham
podem ir a duas colunas via `sm:grid-cols-2` — mas isso é decisão de cada tela,
não da casca.

### 3.3 Desktop — 1024px ou mais
- **Trilho de ícones à esquerda, 72px**, fixo, com rótulo no hover/foco.
  Mesmos destinos do celular mais os do Menu. Sem sidebar larga: o trilho é o que
  mantém a densidade da referência.
- **Faixa de topo**: nome da embarcação, seletor quando houver mais de uma,
  busca, sino, avatar.
- **Conteúdo em grade** de até 1400px, `gap: 24px`.
- **Navegação inferior some.** Duas navegações simultâneas é o erro clássico de
  "app esticado".

### 3.4 Faixa de KPI
Da referência: uma linha de números-chave no topo do painel.
No Commander: **Motor BB · Motor BE · Próxima revisão · Documentos · Saúde**.
Some abaixo de 768px (vira o card hero do celular).

---

## 4. Os oito componentes

Cada um com anatomia fixa. Escrever um estilo à mão fora deles é o defeito que
gerou as 6 alturas de pílula.

| # | Componente | Anatomia |
|---|---|---|
| 1 | **Cartao** | cabeçalho (ícone + título + selo opcional + ação à direita) · corpo · rodapé opcional. Todo bloco da tela é isto. |
| 2 | **Kpi** | rótulo curto em caixa alta · valor em instrumento · variação/apoio opcional · estado opcional |
| 3 | **LinhaLista** *(existe)* | farol/ícone · título · subtítulo em até 2 linhas · valor à direita · chevron. Já em 27 arquivos |
| 4 | **Chip** *(existe, unificado na onda 56)* | altura 44px, dois níveis: sólido = ativo, contorno = disponível |
| 5 | **Selo** | pílula pequena de estado: OK / Atenção / Crítico / Neutro. Cor **e** palavra |
| 6 | **EstadoVazio** *(existe)* | ícone · o que é a área · a ação principal. Já em 50 arquivos |
| 7 | **Abas** | navegação dentro de um detalhe (Visão geral · Manutenção · Histórico · Ocorrências) |
| 8 | **BarraFerramentas** | filtros + alternâncias de uma tela de lista, altura única |

Regra de ouro: **duas telas que fazem a mesma coisa parecem a mesma coisa.**

---

## 5. A Início como prova

Uma tela só, montada com o que está acima. É ela que o dono julga antes de
qualquer outra ser tocada.

**Celular, de cima para baixo:**
1. **Foto do barco do dono** (`foto_capa_path`, que o app já guarda), com nome,
   modelo e base sobrepostos. É a decisão assumida — a única emoção da tela.
   Sem foto: bloco navy sólido convidando a subir uma.
2. **Estado** — SAUDÁVEL / ATENÇÃO / AÇÃO NECESSÁRIA, palavra e cor, **sem
   porcentagem e sem anel** (PRD §1.1, §27.2, §28).
3. **Precisa da sua atenção** — lista ordenada por criticidade, farol + palavra.
4. **Diário** — cartão de chamada com a ação principal (um dos dois dourados).
5. **Motores** — KPIs de hora e próxima revisão, em instrumento.
6. **Gastos do mês** — valor e barras das últimas semanas.

**Desktop:** os mesmos blocos numa grade de 3 colunas, foto ocupando a coluna
dupla superior, KPIs migrando para a faixa de topo.

**O que sai da Início:** o botão flutuante "+ Registrar" some das telas de
criação (já feito na onda 54) e, aqui, é substituído pela ação do cartão do
Diário — que é o registro que o dono realmente faz.

---

## 6. Como isso é verificado

- **`web/e2e/varredura-mobile.spec.ts`** já mede sobreposição, estouro
  horizontal, falta de saída e alvo abaixo de 40px em 390px. Passa a rodar
  também em **1440px**, com as mesmas asserções.
- **Teste de token:** um spec falha se aparecer `#rrggbb` literal em `.tsx` fora
  de `globals.css` e dos componentes de amostra. **Hoje são 95 ocorrências** — o
  teste nasce com um teto que só desce, para não travar a fundação enquanto
  impede a deriva de crescer.
- **`web/e2e/sem-saida.spec.ts`** já protege a folga da safe-area — não regredir.
- Revisão humana com `docs/DESIGN.md` na mão, para o que máquina não mede:
  hierarquia, densidade e se o dourado virou confete.

---

## 7. Riscos assumidos

**O tema escuro vira o padrão da vitrine, o claro continua existindo.** A
referência é escura; a marina é ensolarada. Não se resolve escolhendo — o app já
tem os dois temas e ambos recebem o mesmo cuidado. O que muda é qual aparece nas
imagens de venda.

**A casca de desktop é mudança estrutural.** Se sair errada, sai errada em todas
as telas de uma vez. Por isso ela vem primeiro e sozinha, com a Início como
prova, antes de qualquer outra tela ser tocada.

**Georgia sair vai parecer perda.** Era o traço mais "premium" da proposta
anterior. É justamente por ser traço, e não sistema, que ela sai.

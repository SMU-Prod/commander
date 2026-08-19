# HAULIX — Design System v1.0

**Entregue pelo dono em 19/08/2026.** É a régua visual de referência do
Commander a partir desta data. Reproduzido aqui **na íntegra e sem edição** —
quando este documento e qualquer outro divergirem, prevalece este, exceto nos
dois pontos de conflito registrados no fim, que dependem de decisão do dono.

> Onde já existia relação: a onda 79 amostrou a paleta escura desta mesma
> referência pixel a pixel (`web/.varredura/paleta-haulix.mjs`), e é de lá que
> vêm os valores do tema escuro hoje. Este documento é a versão completa e
> escrita daquilo que antes era leitura a olho.

---

# 01. DESIGN DIRECTION

## 1.1 Conceito

O produto utiliza uma linguagem visual: Industrial · Operacional · Tecnológica ·
Premium · Dark-first · Data-dense · Minimalista · Funcional · High-contrast ·
Enterprise SaaS.

A interface deve transmitir a sensação de:

> **"Centro de operações de uma empresa de logística moderna."**

Não é um dashboard financeiro genérico.

**Não utilizar estética de:** SaaS colorido · gradientes excessivos · cards
brancos · glassmorphism · neon exagerado · ilustrações decorativas · sombras
pesadas · interfaces excessivamente arredondadas.

A interface deve parecer um **software operacional utilizado durante o
trabalho**, e não uma landing page.

---

# 02. PRINCÍPIOS VISUAIS

## 2.1 Dark by default

Toda a interface é construída sobre uma escala quase monocromática. A hierarquia
é criada através de: **1.** luminosidade · **2.** contraste · **3.** bordas ·
**4.** espaçamento · **5.** tipografia · **6.** cor semântica.

**Não utilizar cor para decorar.**

## 2.2 Lime é a cor proprietária

Reservado para: primary CTA · elementos selecionados · estado ativo ·
indicadores positivos · elementos de interação principal · destaques
importantes.

Nunca transformar o lime em cor de preenchimento generalizado.

## 2.3 Informação antes de decoração

Cada elemento visual precisa possuir função operacional.
Prioridade: **Dados → Estado → Ação → Contexto**.

## 2.4 Densidade controlada

Alta densidade de informação, mas com agrupamento, espaçamento consistente,
cards, tabs, badges e hierarquia tipográfica para impedir congestionamento.

---

# 03. COLOR SYSTEM — Backgrounds

| Token | HEX | Uso |
|---|---|---|
| `background.base` | `#0F0F0F` | Fundo principal |
| `background.canvas` | `#151515` | Área de aplicação |
| `background.surface` | `#1B1B1B` | Cards |
| `background.surface-2` | `#222222` | Cards elevados |
| `background.surface-3` | `#292929` | Hover / elementos elevados |
| `background.input` | `#202020` | Inputs |
| `background.overlay` | `#080808` | Overlays |

Base visual entre `#0B0B0B → #292929`.

---

# 04. NEUTRAL SYSTEM

## 4.1 Text

| Token | HEX | Uso |
|---|---|---|
| `text.primary` | `#F4F4F2` | Títulos / informação principal |
| `text.secondary` | `#C4C4C2` | Informação secundária |
| `text.tertiary` | `#8C8C8A` | Metadata |
| `text.muted` | `#686866` | Labels auxiliares |
| `text.disabled` | `#4C4C4C` | Disabled |

**O branco nunca deve ser `#FFFFFF`.** O produto trabalha com branco levemente
quebrado.

## 4.2 Borders

| Token | HEX |
|---|---|
| `border.subtle` | `#252525` |
| `border.default` | `#303030` |
| `border.strong` | `#3C3C3C` |
| `border.focus` | `#DFF07F` |

Bordas discretas. Nunca bordas brilhantes como padrão.

---

# 05. BRAND / PRIMARY — Lime

| Token | HEX |
|---|---|
| `brand.primary` | `#E9F58A` |
| `brand.primary-hover` | `#F1F9A2` |
| `brand.primary-active` | `#D6E66F` |
| `brand.primary-soft` | `rgba(233,245,138,.12)` |
| `brand.primary-muted` | `rgba(233,245,138,.06)` |

---

# 06. SEMANTIC COLORS

```text
success        #8FD66B    success-soft   rgba(143,214,107,.12)
warning        #F0B24D    warning-soft   rgba(240,178,77,.12)
critical       #EF6B6B    critical-soft  rgba(239,107,107,.12)
info           #42B4D3    info-soft      rgba(66,180,211,.12)
analytics      #7568C7    analytics-soft rgba(117,104,199,.14)
```

---

# 07. COLOR USAGE RULE

```text
80–90%  Neutral / dark
 5–10%  Secondary status colors
 1–3%   Brand lime
```

**O lime precisa continuar raro.** Se tudo estiver lime, nada mais parecerá
importante.

---

# 08–11. TYPOGRAPHY

**Inter.** Fallback: `ui-sans-serif, system-ui, -apple-system,
BlinkMacSystemFont, "Segoe UI", sans-serif`.

**Pesos:** 400 body · 450 metadata · 500 labels · 600 buttons/cards ·
650 titles · 700 major headings. **Evitar 800/900.**

**Escala:**

```text
Display XL   32 / 38 / 700      H1   24 / 30 / 650
Display L    28 / 34 / 700      H2   20 / 26 / 650
                                H3   16 / 22 / 600
Body L       15 / 22 / 400      H4   14 / 20 / 600
Body         14 / 20 / 400
Body Small   13 / 18 / 400      Label    12 / 16 / 500
                                Caption  11 / 15 / 500
```

**Numérica:** dados operacionais com `font-weight: 600`,
`font-variant-numeric: tabular-nums`, `font-feature-settings: "tnum"`.

---

# 12–14. SPACING · RADIUS · SHADOWS

**Espaçamento base 4px:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96

**Raio:** `xs 4` · `sm 6` · `md 8` · `lg 12` · `xl 16` · `pill 999`.
Inputs 8 · Cards 10–12 · Containers grandes 14–16 · Badges 999 · Botões 8.

**Sombras discretas:**

```css
shadow-sm: 0 1px 2px rgba(0,0,0,.25);
shadow-md: 0 8px 24px rgba(0,0,0,.25);
shadow-lg: 0 16px 48px rgba(0,0,0,.35);
```

**A profundidade principal vem da diferença de superfície, não de sombra.**

---

# 15–18. SHELL · SIDEBAR · TOPBAR · BUSCA

Sidebar vertical, compacta, iconográfica, **64–72px**, fundo `#151515`.
Item 40×40, raio 10. Default transparente/`#777`; hover `#222`/`#C4C4C4`;
**ativo `#F4F4F2` de fundo com `#111` de ícone** — tratamento muito mais forte
que os demais.

Topbar: breadcrumb e contexto à esquerda · busca global ao centro ·
notificações, avatar, usuário e papel à direita.

Busca global: altura 36, raio 999, fundo `#202020`, borda `#2C2C2C`,
placeholder `#777`, atalho `⌘K`.

---

# 19–21. KPI PILLS · BOTÕES

**KPI pill:** altura 24–28, padding 0 9, raio 999, fonte 11–12. São indicadores
contextuais, **não cards**.

**Botões:**

```text
Primary       bg #E9F58A            color #101010
Secondary     bg #252525            color #D8D8D8   border #343434
Tertiary      transparente          color #A0A0A0
Destructive   rgba(239,107,107,.12) color #EF6B6B   border rgba(239,107,107,.25)
```

**Dimensões:** small 28 / 0 10 / 12px · medium 34–36 / 0 14 / 13px ·
large 40–44 / 0 18 / 14px.

---

# 22–23. CARDS E HIERARQUIA DE SUPERFÍCIE

Card: fundo `#1B1B1B`, borda `1px #292929`, raio 12, padding 16.
Estrutura: Header (ícone · título · ações) → Content → Footer.

```text
Level 0  canvas          #151515
Level 1  card            #1B1B1B
Level 2  card aninhado   #222222
Level 3  interativo      #292929
```

**A hierarquia de superfícies é fundamental para reproduzir o visual.**

---

# 24–29. TABS · BADGES · ALERTAS · LISTAS · AVATAR

**Tabs:** altura 36, default `#777`, ativo `#F2F2F2`, indicador de 2px em
`#E9F58A`.

**Status badge:** pill, altura 20–22, padding 0 7, fonte 10–11, peso 600.
Active `#8FD66B` · Critical `#EF6B6B` · High/Warning `#F0B24D` ·
Normal `#42B4D3` · Low `#9A9A9A`, todos sobre o respectivo `-soft`.

**Alerta:** ícone · título · descrição · status · ações. Compacto — nunca
alertas enormes.

**Lista:** linha 52–64, borda inferior `#292929`, hover `#202020`.

**Avatar:** 32 padrão, 40 large, círculo, iniciais quando não houver foto.

---

# 30–35. DADOS · MAPA · CARGA · PROGRESSO · GAUGE

Gráficos: fundo escuro, poucos elementos, grid discretíssimo, labels pequenas,
uma cor principal. Barra `#168AA5` sobre base `#252525`; área analytics
`#7568C7` com preenchimento `rgba(117,104,199,.25)`.

**Mapa:** vias quase pretas, prédios discretos, labels reduzidos, rota lime
(`#E9F58A`, 3px), marcador com anel lime e miolo `#F4F4F2`, controles
circulares escuros.

**Progresso:** altura 4–6, raio 999, trilho `#303030`.

**Gauge:** semicircular, trilho escuro, arco ativo colorido, valor numérico
central, unidade pequena. **Nunca gauge 3D.**

---

# 36–37. ICONOGRAFIA

**Lucide.** Traço 1.5–1.75px, arredondado, minimalista. Tamanhos 12/14/16/18/20/24.
Default `#8C8C8A` · ativo `#111111` · primary `#E9F58A`.

**Nunca:** emoji · ícone 3D · multicolorido · Font Awesome misturado com Lucide ·
ícones muito preenchidos. **Uma única linguagem iconográfica.**

---

# 38–42. INPUTS · DROPDOWN · TOOLTIP · MODAL · DIVIDER

Input: altura 36–40, fundo `#202020`, borda `#303030`, raio 8, placeholder
`#6E6E6E`, texto `#E5E5E5`. Foco: borda `#E9F58A` e
`box-shadow: 0 0 0 2px rgba(233,245,138,.10)`.

Dropdown: mesmo sistema; opção 36 de altura; hover `#292929`; selecionado
`rgba(233,245,138,.10)` com texto `#E9F58A`.

Tooltip: `#292929` / `#F4F4F2` / borda `#3A3A3A` / raio 6 / padding 6 8 /
fonte 11.

Modal: `#1B1B1B`, borda `#343434`, raio 14, overlay `rgba(0,0,0,.65)`.

Divider: `#292929`, 1px. Nunca divisores contrastantes.

---

# 43–48. TABELA · MICROCOPY · HEADER · GRID · BREAKPOINTS

**Tabela:** header 11px/600/`#777`/maiúsculas/`letter-spacing .04em`;
linhas 52; hover `#202020`.

**Microcopy:** curta, operacional, objetiva, orientada à ação.
Preferir *Activate Route*, *Assign Driver*, *Take Offline*.
Evitar *Click here to…*, *Would you like to…*.

**Page header:** breadcrumb → título (24 / 650) + ações → descrição (13 /
`#858585`).

**Grid:** 12 colunas, gap 16. Breakpoints 480 / 640 / 768 / 1024 / 1280 / 1536;
desktop principal 1280+. Conteúdo `max-width: 1600px`, padding 24–32, e 40 em
telas muito grandes.

---

# 49–53. MOTION · HOVER · FOCUS · DISABLED · LOADING

Motion 120–180ms (complexo 200–280), `cubic-bezier(.2,.8,.2,1)`.
**Sem animação decorativa.**

Hover: sobe **um nível de superfície** (`#1B1B1B → #222222`). Não saturar.

Focus: `outline: 2px solid rgba(233,245,138,.45)` com `outline-offset: 2px`.

Disabled: `opacity .45`, `cursor: not-allowed`. **Sem cor nova.**

Loading: skeleton `#222` com realce `#292929`. **Nunca skeleton branco.**

---

# 54. HIERARQUIA DE ESTADO

```text
CRITICAL → HIGH → WARNING → NORMAL → LOW
Critical = Red · High/Warning = Amber · Normal = Cyan/Neutral
Low = Gray · Active = Green · Primary = Lime
```

---

# 56. TOKENS

```css
:root {
  --bg-base:#0F0F0F; --bg-canvas:#151515; --bg-surface:#1B1B1B;
  --bg-surface-2:#222222; --bg-surface-3:#292929; --bg-input:#202020;
  --text-primary:#F4F4F2; --text-secondary:#C4C4C2; --text-tertiary:#8C8C8A;
  --text-muted:#686866; --text-disabled:#4C4C4C;
  --border-subtle:#252525; --border-default:#303030; --border-strong:#3C3C3C;
  --brand-primary:#E9F58A; --brand-primary-hover:#F1F9A2;
  --brand-primary-active:#D6E66F;
  --success:#8FD66B; --warning:#F0B24D; --critical:#EF6B6B;
  --info:#42B4D3; --analytics:#7568C7;
  --radius-xs:4px; --radius-sm:6px; --radius-md:8px;
  --radius-lg:12px; --radius-xl:16px; --radius-pill:999px;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
  --space-5:20px; --space-6:24px; --space-8:32px; --space-10:40px;
  --space-12:48px; --space-16:64px;
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --duration-fast:120ms; --duration-normal:180ms; --duration-slow:280ms;
}
```

---

# 57. FÓRMULA VISUAL

```text
DARK SURFACE + COMPACT TYPOGRAPHY + SUBTLE BORDER + SMALL STATUS BADGE
+ LIME PRIMARY ACTION + SEMANTIC STATUS COLORS + HIGH INFORMATION DENSITY
= HAULIX UI
```

---

# 58. O QUE NÃO FAZER

Gradient backgrounds · estética SaaS roxa · glassmorphism excessivo · cards
enormes arredondados · cards brancos · sombras excessivas · lime em tudo ·
tipografia superdimensionada · animação excessiva · emoji · bibliotecas de
ícone misturadas · dashboards coloridos · espaço em branco excessivo.

---

# 59. REGRA MAIS IMPORTANTE

O sistema **não** é "uma interface preta com verde". A identidade é a
combinação: superfícies neutras escuras + elevação em camadas + tipografia
enterprise compacta + densidade operacional + cor semântica contida +
linguagem de interação lime + espaçamento preciso + iconografia mínima.

---

# 60. ORDEM DE IMPLEMENTAÇÃO

```text
01 Tokens · 02 Typography · 03 App Shell · 04 Sidebar · 05 Topbar
06 Buttons · 07 Inputs · 08 Cards · 09 Status system · 10 Tables/Lists
11 Charts · 12 Maps · 13 Vehicle · 14 Cargo · 15 Driver · 16 Alerts
17 Responsive · 18 Motion
```

**App Shell + Tokens + Cards + Status System primeiro.** Todas as demais telas
consomem esses componentes, em vez de receber estilos próprios.

---

# 61. FIDELIDADE VISUAL

**P0 obrigatório:** dark-first · lime `#E9F58A` · superfícies neutras · Inter ·
densidade compacta · raio 12 em card · 8 em controle · bordas discretas ·
pills · ícones Lucide · cores semânticas.

**P1 muito importante:** grid de 12 · gap 16 · sidebar 64–72 · topbar compacta ·
camadas de superfície · números tabulares · sombras mínimas.

**P2 refinamento:** motion · micro-interações · foco · skeletons · tooltips ·
comportamento avançado de gráfico.

---

# 62. CARÁTER

**Industrial + Financial-grade + Fleet Operations + Modern SaaS** —
e não Consumer App, Gaming UI ou Marketing Dashboard.

> A referência **parece cara porque usa contenção.** A cor é contida. O
> contraste é contido. As sombras são contidas. Os componentes são pequenos. A
> informação é densa. A interface deixa o **estado operacional** ser o
> protagonista.

---

---

# CONFLITOS COM O COMMANDER DE HOJE — decisão do dono

Registrados aqui porque aplicar o documento ao pé da letra muda coisas que
foram decididas antes, e nenhum agente deve resolvê-los sozinho.

## C1 · RESOLVIDO em 19/08/2026 — O DOURADO SAI DO PRODUTO

**Decisão do dono, palavra dele: *"não quero nada de DOURADO"*.**

Não é "o dourado fica na marca". Ele sai — do tema claro, do tema escuro, do
burgee, do herói, da venda. O **lime `#E9F58A` passa a ser a única cor
proprietária**, com a disciplina do §2.2 e do §07: **1–3% da tela**, reservado a
CTA primário, item selecionado, estado ativo e indicador positivo.

E a disciplina vale para ele igual: *"se tudo estiver lime, nada mais parecerá
importante"*. Trocar dourado por lime em todo lugar onde havia dourado seria
repetir o defeito com outra cor.

**O navy CONTINUA.** É o chão do cartucho de instrumento e do herói, e o
documento é dark-first — navy escuro não conflita com ele.

O texto abaixo é a leitura ANTIGA, mantida para histórico de por que a pergunta
existiu.

### (histórico) A marca era navy e dourado; o sistema é quase-preto e lime

O Commander tem identidade declarada em **navy `#0B1D2D` + dourado `#D4AF37`**
desde a fundação: é o logo, é o herói da embarcação, é o cartucho dos
instrumentos, é a landing. O HAULIX é **`#0F0F0F` + lime `#E9F58A`**.

Onde já convergiu: o tema **escuro** do app já usa a paleta amostrada desta
referência (onda 79), e nele `--acao` já é lime.
Onde ainda diverge: o **dourado** segue como cor de marca no logo, no herói e
na venda; e o navy é o cartucho fixo dos instrumentos nos dois temas.

**A pergunta que só o dono responde:** o dourado continua sendo a marca (e o
lime é a linguagem de *interação*, como o próprio §2.2 sugere), ou o dourado
sai do produto e fica só na marca impressa?

## C2 · Dark-first contra o tema claro do sol na marina

O §2.1 é **dark by default**, e o documento não descreve tema claro nenhum.
O Commander tem tema claro, e ele existe por um motivo operacional escrito:
**leitura sob sol na marina** — o público usa o app no convés, ao meio-dia.

Hoje mesmo o tema claro foi corrigido: o acento reprovava contraste a 2,10:1 e
passou a 5,66:1.

**A pergunta:** o tema claro continua sendo requisito de produto (e então o
HAULIX vale integralmente só no escuro, com o claro derivado por regra), ou o
app passa a ser só escuro?

Até haver decisão, **a regra vigente é: HAULIX manda no tema escuro; o tema
claro continua existindo e continua obrigado a passar no teste de contraste**
(`web/lib/ui/contraste.test.ts`, 74 casos).

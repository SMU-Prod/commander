# Haulix exato — o inventário de componentes que falta

Spec de design · 16/08/2026 · Ondas 63+

**Origem:** o dono, mandando as seis imagens de novo: *"essa referência quero
EXATAMENTE IGUAL para web e celular responsivo total, tem que revisar e
refinar todos componentes"*, e antes: *"preciso de um app fino e rebuscado
para a classe social que estamos entrando"*.

**O que este documento é:** o inventário honesto do que separa o Commander de
hoje do painel Haulix — **componente por componente**, medido nas imagens.
Não é análise de princípios (isso é `docs/DESIGN.md`) nem catálogo de
adaptação (`docs/DESIGN-SYSTEM.md`). É a **lista de peças que ainda não
existem** e o estado das que existem.

---

## 1. O diagnóstico em uma frase

A fundação (escuro, denso, tokens, casca responsiva, IBM Plex) **já é** a do
Haulix. O que falta são os **instrumentos**: o Haulix impressiona porque cada
cartão contém um objeto de precisão — velocímetro com arco, donut de
combustível, área de gráfico, barra de capacidade, o baú 3D. O Commander
tem os cartões e não tem os objetos. É por isso que ele lê como *software de
gestão* e o Haulix lê como *cockpit*.

**Isso não é opinião: são 11 componentes que o Haulix usa e nós não temos.**

---

## 2. Os componentes que faltam (medidos nas imagens)

| # | Componente | Onde aparece na referência | Onde vive no Commander | Prioridade |
|---|---|---|---|---|
| 1 | **Medidor de arco** — arco com zonas de cor, ponteiro, número mono gigante, chip de estado | Speed `100 mph` + chip "High" vermelho (img 1, 4) | SOG no modo navegando; RPM/temperatura quando o Connect chegar | **P0** |
| 2 | **Donut de nível** — anel com preenchimento líquido, valor central, chip de % e badge de temperatura | Fuel `3.61 gal` 31% ⌀72°F (img 1, 4) | tanque de combustível/água; cota de fotos | **P0** |
| 3 | **Barra de capacidade** — `usado / total un` + barra fina colorida + chip de % | Weight `28 700/44 000 lbs` 65% âmbar; Volume 100% vermelho (img 2, 5) | cota de fotos, capacidade elétrica, tanques | **P0** |
| 4 | **Gráfico de área** — preenchimento em gradiente, eixo Y 0–100, eixo X datado | On-Time Delivery Performance (img 4, 6) | gastos ao longo do ano; horas de motor; saídas por mês | **P1** |
| 5 | **Gráfico de barras com tooltip** — barras finas + tooltip de duas métricas | Fleet Utilization Trend (img 6) | refino do `GraficoMesesGastos` que já existe | **P1** |
| 6 | **Barra de progresso de rota** — origem → destino, trilho dourado, `282.1 mi 72%` + restante | Dallas → Memphis (img 1, 4) | modo navegando: progresso até o destino (o dado JÁ existe em `progressoNaRota`) | **P0** |
| 7 | **Fila de prioridade** — linha com **borda lateral** por severidade, chip de nível, descrição de uma linha e **ações inline** (✓ resolver, 👁 ver) | Alert Priority Queue (img 6) | Avisos — a borda já entrou na onda 59; **faltam as ações inline** | **P1** |
| 8 | **Ações rápidas** — fileira de cartões-botão com ícone | Add New Trip · Assign Driver · Live Map (img 6) | Acesso rápido da Início — existe como ladrilho, falta a anatomia | **P2** |
| 9 | **Cartão de pessoa completo** — foto real com ponto de estado, credencial em chip mono, e-mail com copiar, micro-KPIs (🕐/⛽/★) e botões de contato | Driver cards (img 3, 4) | Tripulação, Comandantes, Prestadores — temos avatar+nome, faltam KPIs e ações | **P1** |
| 10 | **Painel lateral de itens** — cartão com miniatura, código copiável, chips de prioridade, bloco expandido com risco e ações | Packages (img 2, 5) | painel do Mapa da Embarcação; lista de equipamentos da zona | **P1** |
| 11 | **Visual 3D com slots clicáveis** — o objeto com pontos fixados, seleção com contorno dourado sincronizada ao painel | Cargo Layout (img 2, 4, 5) | Mapa da Embarcação — SVG hoje, **3D quando o modelo do dono chegar** | **P1** |

### Peças de moldura que também faltam

| Peça | Referência | Estado |
|---|---|---|
| **Busca ⌘K** na faixa de topo | img 1, 2 | ❌ adiada duas vezes — com 80 telas, agora se justifica |
| **Breadcrumb** na ficha | img 2 | ❌ `Dashboard › Fleet Vehicles › TX-4821-HX` |
| **Seletor de período** | img 1, 6 | ❌ "Last 7 days" — vale para Financeiro e Relatórios |
| **Alternador de vista** | img 3 | ❌ ☰ Lista / ⫼ Quadro / ⧉ Carga |
| **Chip de identidade copiável** | img 2, 3, 6 | ❌ código com ícone de copiar (nosso: nome do barco, código de convite) |
| **Toggles na barra** | img 1 | ⚠️ existem no `/navegar` como botão separado |

---

## 3. O refino do que já existe

Não basta acrescentar: as peças atuais precisam de um passe. Medido nas
imagens contra o nosso:

1. **Profundidade do cartão.** No Haulix o cartão tem gradiente sutil e o
   fundo tem textura de ruído — o painel não é chapado, é *material*. O nosso
   ficou chapado na onda 60 (decisão certa contra a sombra borrada, mas
   parou no meio do caminho). **Ganha um gradiente de 2–3% e o ground ganha
   textura quase imperceptível.**
2. **Raio.** O Haulix usa ~16–20px nos painéis grandes e 8–10 nos internos.
   Nosso `--raio-cartao` é 14. **Vira 16 no painel de primeiro nível**,
   mantendo 14 nos aninhados — a hierarquia de raio passa a significar
   profundidade.
3. **Cabeçalho de cartão.** Lá é `ícone + título + subtítulo explicativo +
   ação à direita`. O nosso não tem o **subtítulo** ("Weekly on-time vs
   delayed delivery percentage") — é ele que faz o painel parecer
   instrumento documentado em vez de caixa com rótulo.
4. **Chips.** O Haulix tem quatro naturezas com anatomias distintas: estado
   (cor+palavra), contagem, credencial (mono), prioridade (sólido). Nosso
   `Chip`/`Selo` cobrem duas.
5. **Ícones de ação em botão-círculo** (refresh, expandir, ···) — presentes
   em todo cartão do Haulix, ausentes nos nossos.
6. **Densidade da lista.** Linhas do Haulix têm 2 linhas de texto + 3 chips
   em ~64px. As nossas gastam mais altura para menos informação.

---

## 4. Uma nota curta, e só

O dono foi direto: *"pedi para você seguir a referência VISUAL e não o padrão
de estrutura"*. Ele está certo, e esta seção existe pequena de propósito —
a versão longa dela foi o erro.

**Tudo da referência se copia.** Onde nossos dados são outros, os mesmos
componentes recebem os nossos números (o velocímetro mostra SOG em nós, a
faixa de KPI mostra Motor BB/BE em vez de On-time %). O desenho, o material,
o espaçamento e o acabamento são os de lá, literalmente.

---

## 5. Responsivo total — a regra por componente

Cada peça nova nasce com os três comportamentos declarados, testados nas
duas pontas (390 e 1440) antes de entrar:

- **Medidor / donut**: escala por container (`viewBox` + `width:100%`),
  número central em `clamp()`; no celular ocupa meia largura, dois lado a
  lado; no desktop, cartão próprio.
- **Gráficos**: altura fixa por breakpoint (140px celular / 200px desktop),
  eixo X reduz densidade de rótulo no celular (a cada 2 pontos).
- **Painel lateral de itens**: coluna à direita no `lg`, empilhado abaixo no
  celular — o padrão que o Mapa da Embarcação já usa.
- **Fila de prioridade**: ações inline viram ícones de 44px no celular,
  ícone+rótulo no desktop.
- **Cartão de pessoa**: foto 40px no celular / 48px no desktop; micro-KPIs
  quebram para segunda linha antes de truncar.

---

## 6. Como isso é verificado

- Cada componente novo entra com **teste de render** e **prova visual nas
  duas larguras**, comparada com a imagem de origem — o método firmado
  depois da bronca de 16/08 ("cadê o design igual mandei").
- A varredura cobre as telas que os consomem; alvo ≥44px vale para os
  botões-círculo novos.
- O teto de cor literal (catraca) **não sobe**: gráfico e medidor usam
  tokens semânticos, e as escalas de cor de dado entram como tokens novos,
  não hex solto.
- Revisão humana com as seis imagens lado a lado — o que máquina não mede é
  se ficou *fino*.

---

## 7. Risco assumido

**Instrumento em tela de dono não é instrumento em tela de gerente.** O
velocímetro do Haulix existe porque um gerente monitora excesso de
velocidade de terceiro. O nosso existe porque o dono quer *ver* o barco dele
em números bonitos — é legítimo, é o que vende, e é por isso que ele entra;
mas cada medidor precisa de um dado real por trás, senão vira painel de
mentira. **Onde o dado não existe, o medidor não entra** — entra o convite
para conectar (Connect/NMEA) ou preencher. É a mesma régua de honestidade
que rege o app inteiro.

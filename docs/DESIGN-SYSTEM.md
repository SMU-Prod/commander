# Sistema de Design Commander — análise profunda da referência

Análise imagem por imagem do painel **Haulix** (by Phenomenon), a referência
que o dono escolheu, com o mapa de adaptação: **qual padrão de qual tela vira
o quê no Commander**, o que já está construído e o que entra em qual onda.

Complementa `docs/DESIGN.md` (princípios) e os specs de fundação e
arquitetura. Este documento é o **catálogo**: quando uma onda refizer uma
tela, é aqui que se olha primeiro.

---

## 1. As seis imagens, uma a uma

### Imagem 1 — Operations Dashboard sobre mapa (tablet)

O que a tela é: o mapa da frota em tempo real com a interface flutuando por
cima — o padrão Waze aplicado a gestão.

| Padrão na imagem | O que é | No Commander | Estado |
|---|---|---|---|
| **Faixa de KPI no topo** — `Active 6/10 · Drivers 6/8 · Trips 5 · Avg Fuel 56.2% · On-time 94.2%` | pílulas de contorno, rótulo + número mono, SEMPRE visíveis | **Motor BB · Motor BE · Próxima revisão · Documentos · Saúde** (spec fundação §3.4), no desktop | 🔜 Onda 60 |
| **Busca global** `Search vehicles, trips, or more… ⌘K` | uma busca só, com atalho | busca do Commander — adiada DE PROPÓSITO (spec arquitetura §5: busca não conserta menu confuso) | ❌ pós-60 |
| **Sino com contagem + avatar com nome/papel** | canto direito fixo | faixa de topo do desktop; hoje o sino só existe na Início | 🔜 Onda 60 |
| **Chips de filtro com contagem** — `All 10 · Active 6 · Idle 2 · Maintenance 1 · Offline 1` | estado + número no chip, um ativo sólido | `BarraFerramentas` das listas (Diário, Financeiro, Ocorrências, Avisos) | 🔜 Onda 59 |
| **Toggles à direita da barra** — `Show routes · Show alerts` | alternâncias de camada na MESMA barra dos filtros | painel de camadas do `/navegar` (hoje é botão separado) — candidato a migrar pra barra | 🔜 Onda 59/61 |
| **Cartão flutuante do veículo sobre o mapa** — identidade, rota `Dallas → Memphis` com barra de progresso DOURADA, ETA, `72.9 mi` restantes | um cartão só, denso, com X pra fechar | o card do barco no `/navegar` (bottom-sheet hoje) — a barra de progresso dourada da rota é o detalhe a copiar: progresso é o ÚNICO dourado do cartão | ⚠️ parcial (temos o cartão; falta a barra de progresso e a densidade) |
| **Velocímetro + galão como instrumentos** — `100 mph` com arco vermelho no excesso, `3.61 gal` donut | número gigante mono, arco semântico | instrumentos do modo navegando (SOG, combustível quando o Connect chegar) — arco de cor SÓ semântico (excesso = vermelho) | ⚠️ parcial (SOG existe; sem arco) |
| **Tarja âmbar "Required Break: 30 min"** | aviso contextual DENTRO do cartão, não toast | tarjas de aviso do Commander (mar ruim, calado) — já é o padrão | ✅ |
| **Bússola NW no canto** | instrumento redondo flutuante | rosa dos ventos do modo navegando | ✅ (proa no marcador) |

### Imagem 2 — Ficha do veículo com carga (notebook)

O que a tela é: **a anatomia de FICHA** (spec arquitetura §2.3) executada por
completo. É a imagem mais importante para as ondas 59–60.

| Padrão | O que é | No Commander | Estado |
|---|---|---|---|
| **Breadcrumb** `Dashboard › Fleet Vehicles › TX-4821-HX` | rastro de onde se está | fichas de equipamento/saída/ocorrência no desktop | 🔜 Onda 60 |
| **Cabeçalho de ficha**: título GRANDE + chip de estado `Idle` colado + subtítulo (modelo) | identidade e estado na mesma linha | `CabecalhoDetalhe` ganha o chip de estado (hoje o estado fica no corpo) | 🔜 Onda 60 |
| **Barra de ações da ficha**: `Maintenance · Take Offline · [Activate Route]` — duas de contorno, UMA preenchida | a ação principal é a única sólida | fichas: "Registrar manutenção · Editar · [ação principal da tela]" — hoje as ações ficam no fim da página | 🔜 Onda 60 |
| **Abas com contagem**: `Overview · Cargo · Trips 2 · Maintenance 3 · Alerts 0` | número junto do rótulo | `Abas` (criado na onda 58, já com `contagem?`) — a API já prevê isto | ✅ componente / 🔜 uso nas fichas |
| **Painel lateral de itens** (Packages) com chips de prioridade `Critical/High/Low` | lista densa ao lado do visual | painel de equipamentos/ocorrências ao lado do Mapa da Embarcação | 🔜 Onda 61 |
| **Barras de capacidade** `28 700/44 000 lbs · 65%` | valor/limite + barra fina colorida | cota de fotos, capacidade elétrica (painel de bordo), tanque | 🔜 pontual |

### Imagem 3 — Driver Management em kanban

O que a tela é: pessoas agrupadas por **estado operacional** (`Driving 6 ·
Resting 3 · Off Duty 1`), cartão com avatar real, credencial
(`CDL-A TX-88421`), micro-KPIs (`6.5h · 267 · 4.8★`) e ações de contato.

**No Commander:** não copiar o kanban como layout de Tripulação — nossa
tripulação tem 2–5 pessoas, kanban de 3 colunas ficaria vazio (decorar o
vazio, DESIGN §6.4). O que se absorve é o **cartão de pessoa**:
avatar + nome + credencial em chip mono + micro-KPIs + ação de contato.
Aplica em: **Tripulação** (`/tripulacao`), **Comandantes** (vitrine — saídas
registradas, avaliação, "Documentação declarada" como chip), **Prestadores**.
O agrupamento por estado serve ao **Admin** (barcos por estado de saúde,
demandas do marketplace por status). 🔜 Onda 60 (cartão de pessoa) / backlog
(admin).

### Imagem 4 — Dashboard de cartões com o caminhão 3D

O que a tela é: a grade de cartões de anatomia única — gráfico de área,
cartão do veículo com instrumentos, **o caminhão 3D com slots de carga
clicáveis**, cartão do motorista.

- **O caminhão 3D é o pedido explícito do dono para Manutenção**: no
  Commander vira o **Mapa da Embarcação** — o barco em corte por ZONAS
  (casco, motores, elétrica, hidráulica, convés, cabine), cada zona com
  equipamentos/manutenções/ocorrências fixados no lugar físico, chip de
  estado por item (`Critical/Normal/High` → nosso vencido/atenção/em dia).
  Selecionar zona no desenho abre o painel lateral (imagem 2). **Não precisa
  ser 3D para vender**: um corte lateral SVG bem desenhado com pinos
  posicionados entrega a mesma leitura — 3D real é evolução, não requisito.
  🔜 Onda 61 (spec próprio, dado novo: posição física por equipamento).
- **Gráfico de área com preenchimento translúcido** (On-Time Performance):
  o padrão para "Gastos do mês" e "Seu ano no mar" — área, não pizza. ✅
  (GraficoMesesGastos é barras; área entra quando houver série contínua).
- **Cartão de pessoa com KPIs embaixo** (Marcus Johnson): mesma anatomia da
  imagem 3. 🔜 Onda 60.

### Imagem 5 — Carga 3D explodida (tablet)

Variação da imagem 2 com o baú aberto. O que acrescenta:

- **Item selecionado no 3D ganha contorno DOURADO** e o painel lateral abre
  o detalhe correspondente — seleção sincronizada desenho↔lista. É a
  interação-chave do Mapa da Embarcação. 🔜 Onda 61.
- **Callout âmbar "Fragile — handle with care"** dentro do detalhe: aviso
  contextual por item — no Commander, "peça em backorder", "recall do
  fabricante", "vence em 12 dias". ✅ padrão de tarja já existe.
- **Front (Cab) ← → Rear (Doors)**: orientação escrita no desenho — no
  barco: **Proa ← → Popa**. 🔜 Onda 61.

### Imagem 6 — Operations Dashboard analítico

O que a tela é: a Início de quem gerencia — e a validação de tudo que a
onda 58 fez em Avisos.

| Padrão | No Commander | Estado |
|---|---|---|
| **Quick Actions** — `Add New Trip · Assign Driver · Live Map` como cartões-botão no topo | Acesso rápido da Início (já existe como ladrilhos) | ✅ |
| **Alert Priority Queue** — fila com BORDA LATERAL por severidade (âmbar/vermelho), título + chip de nível + descrição de UMA linha + **ações inline (✓ resolver, 👁 ver)** | a caixa de entrada de Avisos. A borda lateral por severidade e a **ação inline no próprio aviso** são o que falta no nosso `CartaoNotificacao` — hoje ele é link genérico pro hub (achado Menor 4 da revisão da onda 58) | 🔜 Onda 59 |
| **Recent Activity** — feed com id mono + verbo + carimbo | o Diário como feed (já é) + histórico central | ✅ |
| **Charts com UMA série destacada** | padrão dos relatórios do Financeiro | 🔜 Onda 59 |

---

## 2. O sistema que as imagens ensinam (consolidado)

O que a referência tem de disciplina, verificado nas seis imagens:

1. **Fundo quase-preto, superfícies em degraus, borda 1px** — nunca sombra
   para separar cartão de fundo. ✅ nossos tokens (onda 57).
2. **UM acento (lima ácido no Haulix, dourado no Commander)** e ele aparece
   em: a ação principal preenchida, o item selecionado, a barra de progresso
   da rota, a marca. **Nunca em decoração.** ✅ regra dos 2 usos.
3. **Semântico separado do acento**: verde=ok, âmbar=atenção,
   vermelho=crítico, sempre com PALAVRA no chip. ✅.
4. **Todo número em mono** — até dentro de chip (`CDL-A TX-88421`). ✅.
5. **Chip é a moeda da interface**: estado, contagem, credencial, filtro —
   tudo é pílula pequena de anatomia única. ⚠️ nosso `Chip` (filtro) e
   `Selo` (estado) cobrem 2 dos 4 usos; credencial mono em chip entra com o
   cartão de pessoa.
6. **Trilho fino de ícones + faixa de topo** no desktop. ✅ trilho / 🔜 faixa.
7. **Densidade**: cartões de ~12–16px de padding interno, listas de linhas
   finas, nada de ar morto. ⚠️ nossas telas herdadas ainda são arejadas
   demais no desktop — é o trabalho das ondas 59–60.
8. **O visual central da tela é o DADO** (mapa, caminhão, gráfico) e ocupa
   a maior célula da grade; os cartões orbitam. ✅ na Início (foto);
   🔜 nas fichas (Mapa da Embarcação).

## 3. Fila de adaptação (o plano de ondas, atualizado por esta análise)

| Onda | O que entra, vindo das imagens |
|---|---|
| **59 — listas** | `BarraFerramentas` (chips com contagem + toggles, imagem 1) em Diário/Financeiro/Ocorrências/Avisos; **ação inline no aviso** + borda lateral por severidade (imagem 6); charts de relatório (imagem 6) |
| **60 — fichas + topo** | faixa de KPI + sino/avatar/busca-placeholder (imagem 1); cabeçalho de ficha com chip de estado + barra de ações + `Abas` com contagem + breadcrumb (imagem 2); cartão de pessoa (imagens 3/4) em Tripulação/Comandantes/Prestadores |
| **61 — Mapa da Embarcação** | o "caminhão 3D" náutico (imagens 4/5): corte por zonas, pinos com estado, seleção sincronizada com painel lateral, Proa↔Popa — spec próprio, precisa de dado novo (zona física por equipamento) |
| pós-61 | busca global ⌘K; kanban de estado no Admin; barras de capacidade onde houver valor/limite |

---

*Escrito em 15/08/2026 a partir das seis capturas do Haulix enviadas pelo
dono. Quando uma tela for refeita, a onda cita a imagem e a linha da tabela
que ela está executando — é assim que se cobra aderência à referência.*

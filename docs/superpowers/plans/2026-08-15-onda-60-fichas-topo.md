# Onda 60 — Fichas e o topo do desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans para executar tarefa a tarefa.

**Goal:** executar as linhas da **imagem 2** (anatomia de ficha), **imagem 1**
(faixa de topo) e **imagens 3/4** (cartão de pessoa) do catálogo
`docs/DESIGN-SYSTEM.md`, e fechar os follow-ups nomeados da onda 59.

**Architecture:** RSC; a faixa de topo vive na `MolduraApp` (só `lg`) e
deriva TUDO de dados que o layout já carrega — zero consulta nova por
página. `FinanceiroNav` vira consumidor de `Abas`. O cabeçalho de ficha
cresce por props opcionais (nenhum consumidor existente quebra).

## Global Constraints

- As de sempre (escala 11+, base 8, raio por token, catraca de cor, mono+
  tabular, ≥44px, cor E palavra, safe-area, português, tsc+test+lint por
  tarefa, build na última).
- **Regra do dourado, refinada nesta onda (Tarefa 2 grava em DESIGN.md §5):**
  o dourado de NAVEGAÇÃO — indicador de onde-estou (trilho, bottom-nav,
  aba ativa) e o FAB global — é da MOLDURA e fica fora do orçamento; o
  orçamento de **2** vale para o CONTEÚDO da tela (ação principal + chip
  ativo, tipicamente). É o que as ondas 57–59 já praticavam sem escrever.

## Fatos do código

- `MolduraApp` (`components/moldura-app.tsx`) recebe `permissoes` e `avisos`
  do layout; `carregarPainel` (cache por request) traz `embarcacao`,
  `equipamentos`, `papel`. `SinoNotificacoes` tem UM consumidor
  (`hoje/page.tsx:350`); `ContadorAvisos` é o badge compartilhado.
- `horasDoMotor`/`apoioDaRevisao` já existem em `lib/domain/inicio.ts`.
- `CabecalhoDetalhe` (`components/ui/cabecalho-detalhe.tsx`): `voltarHref`,
  `voltarRotulo`, `titulo?`, `descricao?`, `acao?: ReactNode` — usado em
  ~46 telas; qualquer mudança é por prop NOVA opcional.
- `Abas` (`components/ui/abas.tsx`): `{ valor, rotulo, href, contagem? }[]`
  + `ativa`. `FinanceiroNav` (`components/ui/financeiro-nav.tsx`) é a
  sub-navegação de 4 telas do Financeiro, escrita à mão.
- `CartaoProfissional` (`components/captain/cartao-profissional.tsx`) já é
  o cartão de pessoa dos Comandantes. Tripulação usa `LinhaLista` simples.
- Construtor de avisos de item (`lib/consultas.ts:~431`):
  `href: /barco/itens/${id}/editar` — a tela EXPULSA quem é só-leitura
  (achado Importante da revisão da onda 59).
- Régua da varredura: par casca×conteúdo é pulado inteiro; o vão conhecido
  é conteúdo `position:fixed` sob a bottom-nav (Menor 2 da mesma revisão).

---

## Tarefa 1 — Faixa de topo do desktop

**Files:** Create `web/components/faixa-topo.tsx` · Modify
`components/moldura-app.tsx`, `app/(app)/layout.tsx` · Test
`components/faixa-topo.test.ts` (renderToStaticMarkup)

- [ ] A faixa: `hidden lg:flex`, altura fixa (~56px), entre o topo e o
  conteúdo, alinhada à grade (respeita `OFFSET_TRILHO`). Da esquerda pra
  direita: **nome da embarcação** (link `/barco`) · KPIs em pílulas de
  contorno (`Kpi` compacto ou pílula própria — anatomia da imagem 1:
  rótulo curto + número mono): **Motor BB/BE** (`horasDoMotor`) e
  **Próxima revisão** (`apoioDaRevisao`, o mais apertado dos motores) ·
  à direita: **sino** com `ContadorAvisos` (link `/notificacoes`) e
  **avatar** (iniciais, link `/menu/ajustes`).
- [ ] **Derivar só do que o layout já tem** (`painel`, `avisos`). Saúde e
  Documentos NÃO entram (exigiriam consulta nova por página) — anote o
  ⚠️ parcial na linha da imagem 1 do catálogo, com o porquê.
- [ ] Sem barco (`painel` null) a faixa não renderiza. No celular nada
  muda (ela é `lg`-only). Dourado: zero (é moldura, mas nem precisa).
- [ ] Teste: com painel, nome+sino+avatar presentes; contador some em 0;
  sem motores, KPIs de motor ausentes (sem "—" decorativo).
- [ ] Commit: `feat(casca): faixa de topo no desktop — a tela ganha contexto e sino em toda parte`.

## Tarefa 2 — FinanceiroNav vira Abas + a regra do dourado escrita

**Files:** Modify `components/ui/financeiro-nav.tsx` (a nav interna),
`docs/DESIGN.md` §5 · nenhum consumidor muda de API

- [ ] `FinanceiroNav` passa a renderizar `Abas` por dentro (mesmos 4
  destinos, `ativa` = prop `atual` existente) — a API externa não muda,
  as 4 telas continuam chamando `<FinanceiroNav atual="..."/>`. O visual
  de pílulas à mão morre; o sublinhado do `Abas` assume.
- [ ] `AcoesUniversais` fica intocada.
- [ ] **DESIGN.md §5** ganha o parágrafo da regra refinada do dourado
  (moldura vs conteúdo — texto da Global Constraint acima), citando que
  as ondas 57–59 já a praticavam. `DESIGN-SYSTEM.md` §2 item 2 ganha uma
  linha de referência cruzada.
- [ ] Commit: `feat(financeiro): a sub-navegacao vira Abas — e a regra do dourado fica escrita`.

## Tarefa 3 — Cabeçalho de ficha (imagem 2)

**Files:** Modify `components/ui/cabecalho-detalhe.tsx` (props novas
opcionais: `selo?: ReactNode`, `acoes?: ReactNode`) ·
`app/(app)/barco/equipamento/[id]/page.tsx` (adota) · teste do componente

- [ ] `CabecalhoDetalhe` ganha: `selo` (o chip de estado colado ao título,
  imagem 2: `TX-9913-HX [Idle]`) e `acoes` (a barra à direita no desktop,
  abaixo do título no celular: contornos + **uma** preenchida no máximo —
  quem passa decide, o componente só posiciona). Nenhum dos ~46
  consumidores atuais muda.
- [ ] A ficha de equipamento adota: `titulo` = nome do equipamento,
  `selo` = `<Selo>` do estado do semáforo (palavra e cor), `acoes` =
  "Editar" (contorno) + a ação principal da ficha se houver (julgue na
  tela; se a ação principal já mora no corpo, não duplique — uma ação
  principal por tela).
- [ ] Commit: `feat(ficha): cabecalho com estado e acoes — a anatomia da imagem 2`.

## Tarefa 4 — O aviso de item aponta pra onde não expulsa ninguém

**Files:** Modify `lib/consultas.ts` (construtor de itens) · teste em
`lib/domain/notificacoes.test.ts` se aplicável

- [ ] O aviso de item passa a apontar pro destino de LEITURA: se o item
  tem `equipamento_id`, a ficha `/barco/equipamento/[id]` (que a Tarefa 3
  acabou de armar com ações); senão, o hub da aba (`/barco/documentos`,
  `/barco/saude`... — confira o mapa real hub→rota no código). Verbo
  acompanha: "Ver manutenção" / "Ver documento". Quem pode editar edita
  DA ficha — o botão está lá.
- [ ] Confira que nenhum papel com `podeVer` cai em redirect de expulsão
  navegando pelo aviso (o cenário da revisão da onda 59: comandante
  só-leitura + documento vencido).
- [ ] Commit: `fix(avisos): o aviso leva pra ficha, nao pro formulario que expulsa`.

## Tarefa 5 — Cartão de pessoa (imagens 3/4)

**Files:** Modify `app/(app)/tripulacao/page.tsx` · ler
`components/captain/cartao-profissional.tsx` antes

- [ ] A lista da Tripulação troca `LinhaLista` cru por linhas com
  **Avatar** (componente existente) + nome + papel + o preset de
  permissões como texto de apoio — a anatomia da imagem 3 na densidade
  certa pra 2–5 pessoas (NÃO kanban: colunas vazias = decorar o vazio).
  Convites pendentes idem, com o estado "aguardando" em palavra.
- [ ] `CartaoProfissional` (Comandantes): só alinhamento de tokens se
  houver literal de raio/cor fora do sistema — sem redesenho.
- [ ] Commit: `feat(tripulacao): cartao de pessoa — avatar, papel e permissao legiveis`.

## Tarefa 6 — Verificação + follow-ups miúdos da onda 59

**Files:** Modify `web/e2e/varredura-mobile.spec.ts` ·
`app/(app)/financeiro/lancamentos/page.tsx` (sotaque) · catálogo

- [ ] **Régua:** par casca×conteúdo só é pulado se o lado de conteúdo NÃO
  for `position: fixed` (o vão do CTA fixo futuro, Menor 2 da revisão da
  59). Comentário com o cenário.
- [ ] **Sotaques:** link discreto de Lançamentos ("+ Entrada") sobe pra
  posição do "Importar do plotter" do Diário (acima da barra); margens da
  barra unificadas em `mt-4` nas três listas.
- [ ] Varredura 390+1440 + `sem-saida` + `npm run build`. Diagnóstico das
  telas da onda (faixa de topo em 3 telas, ficha de equipamento,
  Financeiro×4, Tripulação). Números antes/depois se a régua mudar algo.
- [ ] Catálogo: linhas entregues desta onda mudam para ✅ (faixa de KPI
  parcial com nota; cabeçalho de ficha; Abas nas sub-navegações; cartão
  de pessoa parcial — Prestadores fica pra replicação).
- [ ] Commit: `test(onda-60): regua fecha o vao do fixed e o catalogo diz a verdade`.

## O que este plano NÃO faz
- Breadcrumb (imagem 2) — junto com a replicação das fichas restantes.
- Busca ⌘K, kanban de admin, barras de capacidade — pós-61.
- Saúde/Documentos na faixa de topo — exigem consulta por página; decisão
  consciente, anotada no catálogo.
- FAB nas listas — DECIDIDO nesta onda pela regra escrita (Tarefa 2): o
  FAB é moldura, fica. A duplicação aparente no Diário não é (modal de
  volta-ao-mar ≠ formulário completo); documentado na regra.

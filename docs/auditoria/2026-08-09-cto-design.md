# Auditoria de layout, sistema visual e experiência — Commander (GEST-NAV/web)

Diretor de design · 09/08/2026 · Base: `C:\Users\erick\GEST-NAV\web` (código-fonte lido linha a linha + app rodando em `http://localhost:3050`, logado, DOM/CSS inspecionados via `getComputedStyle`). Auditorias anteriores usadas como baseline: `docs/auditoria/auditoria-uiux.md` (07/08, visual) e `docs/auditoria/2026-08-08-sintese-ux.md` (08/08, usabilidade).

---

### Veredito em 5 linhas

As duas ondas anteriores entregaram de verdade: ícones da marca em todo lugar, card-hero com foto/fallback, farol/horímetro preservados, toques destrutivos agora em 44px com confirmação, toast de sucesso e Suspense existem. O app saiu de wireframe para produto. O que resta agora não é ausência, é **inconsistência fina**: a própria escala tipográfica que o CSS declara ("nada abaixo de 11px") é violada em 10 lugares, incluindo a navegação inferior e o rótulo do horímetro — a melhor peça do app. Dois grids de atalho idênticos em função têm raios diferentes (12px vs 14px). O h1 do nome do barco não usa nenhuma das 4 vozes que o próprio sistema define. Em dark mode, três badges de texto secundário caem para 4.16:1, abaixo do AA. E a cobertura de feedback de sucesso tem buraco no fluxo mais usado do app: registrar um evento no Diário não confirma nada — some redireciona.

---

### Quebras do sistema visual (tabela: onde · valor medido · valor esperado · arquivo:linha)

| Onde | Valor medido | Valor esperado | Arquivo:linha |
|---|---|---|---|
| Piso tipográfico do próprio sistema — `globals.css:94` comenta *"Escala tipográfica — 4 vozes, nada abaixo de 11px"* e `.rotulo` fixa 11px como piso | **9.5px** na navegação inferior (toda tela) | ≥ 11px (usar `.rotulo`) | `components/bottom-nav.tsx:46` |
| Idem — badge "Commander" sobre o hero (`/hoje`, `/barco`) | **10.5px**, tracking `.2em` | 11px, tracking `.16em` (`.rotulo`) | `components/card-embarcacao.tsx:65` |
| Idem — rótulo do horímetro, a peça mais elogiada do app | **10px**, tracking `.14em` | 11px, tracking `.16em` | `components/horimetro.tsx:23` |
| Idem — HUD de navegação (Distância/Rumo/ETA) em `/navegar`, tela de instrumento de verdade | **10px** ×3 | 11px | `components/mapa/navegar-mapa.tsx:1025,1031,1035` |
| Raio de dois grids de atalho com função idêntica (ícone/título + card, `grid` + `sombra-1` + `border-line`) | **12px** em "Acesso rápido" (`/hoje`) vs **14px** em "Ferramentas do dia a dia" (`/barco`) | Mesmo raio — são o mesmo componente em duas telas | `app/(app)/hoje/page.tsx:238` vs `app/(app)/barco/page.tsx:216` |
| Voz de h1 de página fragmentada em 4 tamanhos/tracking distintos, apesar de `.titulo-pagina` existir e ser usada 19×: `text-xl font-semibold` (**20px**, sem tracking) em 9 telas; `text-2xl font-semibold` (**24px**, sem o `-0.015em`/`text-balance` de `.titulo-pagina`) no onboarding; `text-lg font-semibold` (**18px**) em `/diario/[id]/horas` | 24px, tracking `-.015em`, `text-wrap:balance` (`.titulo-pagina`) | Ex.: `app/(app)/diario/novo/page.tsx:39`, `app/(app)/menu/tripulacao/page.tsx:36`, `app/(app)/barco/local/page.tsx:27`, `app/(app)/convite/[codigo]/page.tsx:34`, `app/(app)/diario/trilha/[id]/page.tsx:31`, `app/(app)/marketplace/perfil/page.tsx:29`, `app/(app)/menu/tripulacao/[id]/page.tsx:42`, `app/error.tsx:12`, `app/onboarding/page.tsx:33`, `app/(app)/diario/[id]/horas/page.tsx:52` — contra a referência em `app/(app)/diario/page.tsx:75` |
| h1 do nome do barco (o texto mais importante do app) não usa nenhuma das 4 vozes do sistema | **22px**, uppercase, tracking **+.06em** | Family própria ou coerente com `.titulo-pagina` (24px, tracking **-.015em** — direção oposta) | `components/card-embarcacao.tsx:70-71` |
| Botões "Confirmar"/"Cancelar" que aparecem *depois* de tocar "Excluir" (`components/confirmar.tsx`) regridem do alvo de 44px do botão que os originou | `px-2.5 py-1.5` / `px-2 py-1.5`, texto `text-xs` → **≈ 28-30px** de altura | 44px, mesma régua do botão "Excluir" que abriu o passo | `components/confirmar.tsx:27,30` |

**O que não entra na tabela por ser consistente (mesmo sendo uma 3ª escala não-documentada):** os banners inline de erro/sucesso (`{erro && <p>...}`) usam `rounded-lg` (8px) de forma uniforme em ~20 páginas — é uma escala à parte da que `.titulo-pagina`/cards documentam, mas aplicada sem exceção. Não é quebra, é um degrau que falta nomear.

**Contagem de raios em uso** (`grep -c rounded`): `rounded-[14px]` 87× (cards, dominante) · `rounded-lg` 51× (alertas inline, 8px) · `rounded-full` 48× (pills/avatar/FAB) · `rounded-xl` 35× (botão primário, 12px, aplicado com disciplina real em ~30 CTAs) · `rounded-[10px]` 21× (campo/medidor) · `rounded-[12px]` 10× (thumbnails de foto, popovers) · `rounded-[16px]` 5× (hero) · `rounded-t-[20px]` 2× (sheet). Ao contrário do que a auditoria de 07/08 registrou, isso **não é caos** — é um sistema de 5 níveis por papel (alerta 8 / campo 10 / botão 12 / card 14 / hero 16), só não documentado em lugar nenhum, e com o único furo real listado acima (12 vs 14 no par de grids gêmeos).

---

### Hierarquia — tela a tela, o que os olhos pegam primeiro

- **`/hoje`**: o hero (`CardEmbarcacao`) domina — é o único bloco colorido/grande da tela. **Sem foto** (o estado que o dono realmente vê hoje), o hero vira um retângulo navy com ícone de câmera centralizado e 3 elementos pequenos disputando os cantos (pill "Commander" top-left, pill de status top-right, nome+marina embaixo) — o olho não tem um ponto de ancoragem, escaneia o perímetro. Depois do hero, o olho pula certo para o card de alerta vermelho/âmbar (cor + ícone). Os horímetros (cartucho escuro) quebram o campo branco corretamente.
- **`/barco`**: mesmo hero, e a dupla de horímetros logo abaixo é o segundo ponto de maior contraste (fundo escuro entre cards claros) — hierarquia correta e intencional.
- **`/barco/equipamento/[id]`**: sem foto do motor (comum), o horímetro `grande` (dígitos `text-4xl`, ~36px mono) é o maior número da tela — foco correto.
- **`/barco/gastos`**: "Total do mês" em `text-3xl` mono (~30px) é o segundo maior número do app depois do horímetro — hierarquia certa para uma tela financeira.
- **`/barco/selo`**: a barra de completude tem **6px de altura** (`h-1.5`) e cor `bg-accent-forte` — para uma feature de status/prestígio ("o que vale na hora de vender"), é o elemento com menos peso visual da tela. O olho pousa primeiro no texto explicativo, não no progresso.
- **`/barco/fotos`**: quando populada, é a tela mais fotográfica do app inteiro (grid real de imagens) — e está a 2 toques de `/hoje`, sem nenhum link dela para o hero puxar a foto de capa automaticamente além do link manual.
- **`/diario`**: badges de data (dia em mono bold + mês abreviado) dão uma âncora visual por linha — pequeno acerto que já funciona bem.
- **`/navegar`**: mapa full-bleed — registro visual totalmente diferente do resto do app (correto, é uma ferramenta, não um dossiê), mas o único `loading.tsx` do app (ver seção de estados) não tem nada a ver com essa forma.
- **`/menu`, `/menu/perfil`, `/menu/assinatura`, `/menu/tripulacao`, `/notificacoes`, `/marketplace`, `/parceiro`**: hierarquia plana por design (telas utilitárias de lista/formulário) — aceitável, não precisam de "uau".
- **`/` (landing) e `/login`**: forçam `data-theme="dark"` sempre — hero tipográfico grande (`text-4xl`→`text-6xl`) na landing, monograma dourado sobre navy no login. Registro visual mais forte do app, corretamente reservado para venda/primeira impressão.

---

### Dark mode — pares que falham contraste (com ratio medido)

Cálculo WCAG 2.1 sobre os hex reais de `globals.css`. **O dark mode em geral está sólido** — os pares principais passam com folga (texto principal 14.99:1 e 13.24:1, texto dim 5.39:1 e 4.76:1, dourado sobre navy 8.13:1, farol ok/warn/crit 7.5-8.26:1, horímetro 6.15-17.09:1). O furo real:

| Par | Ratio | Veredito | Onde aparece de verdade |
|---|---|---|---|
| `--texto-dim` `#7c93ab` sobre `--superficie-2` `#16324a` | **4.16:1** | REPROVA (texto normal exige 4.5:1) | Badge "Fundador #N" (`apoio`, 13px) — `app/(app)/menu/assinatura/page.tsx:104` |
| idem | 4.16:1 | REPROVA | Chip de tipo de evento não-selecionado (`text-sm`, 14px) — `components/campos-navegacao-evento.tsx:112` |
| idem | 4.16:1 | REPROVA | Opção inativa do seletor de tema (`text-sm`, 14px) — `components/theme-toggle.tsx:36` |

Fix de uma linha: trocar `bg-panel2` por `bg-panel` nesses três lugares (texto-dim sobre `--superficie` já dá 4.76:1, passa) — ou subir a cor pra `--texto` quando o token de fundo for `panel2`.

Nota à parte (não é falha de texto, é referência): `--linha` `#1e3550` sobre `--superficie` `#12283a` mede **1.21:1** — hairlines quase invisíveis no dark. Se for proposital (dark mode mais "fechado"), tudo bem; se não for, vale considerar clarear `--linha` no tema escuro.

Confirmado ao vivo: `document.documentElement.dataset.theme = "dark"` recalcula `body` para `rgb(11,29,45)` e `.text-dim` para `rgb(124,147,171)` — a cascata de tokens funciona exatamente como `globals.css` descreve, sem surpresa de especificidade do Tailwind v4.

---

### Estados que faltam

- **Loading**: existe **um único** `app/(app)/loading.tsx`, compartilhado por todas as rotas do grupo `(app)`. O esqueleto (hero 44px + título + 2 cards de 80px + grid 2×64px) é o formato de `/hoje` e de mais nenhuma outra tela — `/diario`, `/notificacoes`, `/menu`, `/marketplace`, `/gastos` não têm hero de foto e mostram um bloco fantasma antes do layout real assumir a forma certa. Pior caso: **`/navegar`** é um mapa em tela cheia (`components/mapa/navegar-mapa.tsx`) e mostra o mesmo esqueleto de cartões antes de virar mapa — o salto de layout é o maior do app.
- **Observação de runtime a verificar em produção**: durante esta auditoria, navegações para `/hoje` e `/barco` neste ambiente de preview ficaram presas no esqueleto de loading indefinidamente (testado por 11s+, `<main>` com o conteúdo real existia no DOM mas com um ancestral `display:none`, nunca revelado). O console mostrou reconexões repetidas de HMR (`[HMR] connected` ×11) e a rede não tinha nenhuma requisição pendente — o padrão aponta para um artefato do dev-server/proxy deste preview, não necessariamente um bug em produção. **Recomendo verificar isso com `next build && next start` (ou o deploy real) antes de descartar** — se o mesmo acontecer fora do dev mode, é P0 crítico: a tela que vende ficaria travada em "Carregando" para sempre.
- **Erro**: só existe **um** `error.tsx`, na raiz do app (`app/error.tsx`), fora do layout `(app)`. Qualquer erro de render dentro de `/hoje`, `/barco` etc. joga o usuário para fora do chrome — sem bottom-nav, sem cabeçalho, só "Algo deu errado" + "Tentar de novo", sem link de volta pra `/hoje` ou saída. O banner inline de erro (`?erro=` na URL) está uniforme em ~20 páginas — bom padrão, mas ainda viaja pela URL como a síntese de 08/08 já apontou (não corrigido nesta onda).
- **Sucesso**: `components/toast.tsx` existe, está no layout (`app/(app)/layout.tsx:41`) e funciona via `?ok=`. Mas a cobertura tem buraco: dos 20 módulos em `lib/acoes/`, só 7 usam `?ok=` (assinatura, embarcacao, equipamentos, itens, onboarding, parceiro, perfil). **`lib/acoes/eventos.ts:140`** — registrar um evento no Diário, a ação mais frequente do app — redireciona pra `/diario` sem nenhum parâmetro de sucesso: nenhum toast, nenhuma confirmação. Mesmo buraco em `lib/acoes/contatos.ts:8`, `documentos.ts:9` e `fotos.ts:18` (salvar contato/documento/foto redireciona mudo).
- **Vazio**: bem coberto e com voz boa — `/hoje`, `/barco`, `/diario`, `/notificacoes`, `/marketplace`, `/barco/contatos`, `/barco/documentos`, `/barco/gastos`, `/barco/eletrica` têm texto de estado vazio escrito em tom náutico. Preservar esse padrão nos poucos que não foram auditados a fundo.

---

### As telas que vendem — o que faria impressionar

**`/hoje` e a ficha do motor já têm o esqueleto certo** (hero navy, farol, horímetro em cartucho escuro com mono tabular) — o problema não é redesenhar, é terminar o que já está desenhado:

1. **O estado sem-foto do hero é o estado padrão de todo barco novo** — e hoje é um retângulo vazio com ícone de câmera. Trocar o fallback por uma textura mais "instrumento" (ex.: o próprio monograma em marca d'água grande, como a versão anterior da auditoria já sugeria) faz a primeira tela impressionar mesmo no dia 1, sem depender do dono subir foto. Custo: CSS no `background-image` de `card-embarcacao.tsx:39`.
2. **Farol ainda é um `size-2` (8px)** — `components/farol.tsx:10`, item já apontado em 07/08 e não tocado. Hoje ele quase sempre aparece ao lado de texto/ícone maior (menos grave que antes), mas no badge de status do hero (`card-embarcacao.tsx:80-85`) e nas contagens do rodapé do hero (`hoje/page.tsx:120-124`) ele é o único elemento colorido pequeno — subir para `size-2.5`/`size-3` custaria uma linha e reforçaria o "semáforo do barco" que é a promessa central do produto.
3. **Selo Ouro** (feature de status/revenda, a mais alinhada com "quem compra barco de R$3-8mi compra status") tem a barra de progresso mais fina do app (6px) e nenhuma cor de destaque além do dourado padrão. Subir pra `h-2.5`/`h-3` e considerar um selo/emblema visual (a `Icone nome="selo"` já existe, size-4 hoje) no hero de `/barco` quando `selo.percentual` estiver alto — reforça exatamente o gatilho de vaidade que vende.
4. **Horímetro `grande` na ficha do motor já impressiona** — dígitos 4xl mono, cartucho escuro, farol. Não mexer no que funciona; só considerar um respiro extra (`p-3` → `p-4`) para dar ao número mais peso ainda quando `grande`.

---

### Melhorias propostas, ordenadas por resultado/esforço

| # | O que muda | Por quê | Custo |
|---|---|---|---|
| 1 | Trocar `bg-panel2` por `bg-panel` nos 3 pontos de `text-dim`/`superficie-2` no dark (assinatura, chip de evento, theme-toggle) | Sai de 4.16:1 (reprova AA) pra 4.76:1 (passa) | 3 linhas de className |
| 2 | Unificar `rounded-[12px]` → `rounded-[14px]` em "Acesso rápido" (`hoje/page.tsx:238`) para bater com "Ferramentas do dia a dia" (`barco/page.tsx:216`) | Mesmo componente, duas telas, dois raios — o usuário nota mesmo sem saber nomear | 1 linha |
| 3 | Subir `bottom-nav.tsx:46`, `card-embarcacao.tsx:65` e `horimetro.tsx:23` de 9.5/10/10.5px para 11px e trocar tracking por `.16em` (usar `.rotulo` como base) | O próprio CSS declara "nada abaixo de 11px" — hoje é violado na navegação que aparece em toda tela e no rótulo do melhor componente do app | 3 linhas |
| 4 | Adicionar `?ok=` nos redirects de sucesso de `lib/acoes/eventos.ts:140`, `contatos.ts:8`, `documentos.ts:9`, `fotos.ts:18` | Registrar um evento no Diário — a ação mais repetida do app — hoje não confirma nada | ~8 linhas, 4 arquivos |
| 5 | Padronizar os 11 h1 de página que bypassam `.titulo-pagina` (`text-xl`/`text-lg`/`text-2xl` solto) para usar a utilitária | Título de página muda de tamanho conforme a rota sem motivo — quebra a sensação de "um produto só" | Find-replace em 11 arquivos |
| 6 | Verificar em build de produção se o loading não trava (achado de runtime desta auditoria) | Se reproduzir fora do dev server, é a pior coisa que pode acontecer na tela que vende: "Carregando" pra sempre | 1 teste, sem código se for artefato do preview |
| 7 | `components/confirmar.tsx:27,30`: dar 44px (`h-11`) aos botões "Confirmar"/"Cancelar" do passo de exclusão | O primeiro toque ("Excluir") já é 44px; o toque que efetivamente apaga dado é menor — inversão de prioridade de segurança | 2 linhas |
| 8 | `loading.tsx` por sub-rota (ou ao menos uma variante "lista simples" vs "hero") em vez do único esqueleto global | Elimina o salto de layout em `/diario`, `/notificacoes`, `/menu`, `/marketplace` e principalmente `/navegar` (mapa cheio ganhando esqueleto de cartões) | 2-3 arquivos novos pequenos |
| 9 | Barra de completude do Selo Ouro de `h-1.5` para `h-2.5`/`h-3` | Reforça a feature mais alinhada ao gatilho de status do público-alvo | 1 linha ×2 (`barco/page.tsx:240`, `selo/page.tsx:41`) |
| 10 | `error.tsx` da raiz ganhar um link "Voltar ao Início" além de "Tentar de novo" | Hoje um erro tira o usuário de todo o chrome sem saída alternativa | ~3 linhas |

---

### O que preservar

- **Sistema de ícones da marca** (`components/icone.tsx`, 28 ícones) — construído e aplicado de ponta a ponta; zero emoji, zero `‹`/`›`/`★` tipográfico restante. A recomendação de 07/08 foi implementada por completo.
- **Card-hero da embarcação** (`components/card-embarcacao.tsx`) — foto full-bleed com véus de gradiente calculados para legibilidade sobre casco branco no sol, fallback funcional sem foto, badge de status. É a peça mais bem resolvida do app.
- **Horímetro/cartucho de instrumento** (`components/horimetro.tsx`) — mono tabular, fundo escuro nos dois temas, distinção real entre "0,0 h" e "sem leitura". Ainda a melhor peça do app; só o rótulo interno (10px) precisa subir 1px.
- **Ritmo de seção `mt-6 mb-2`** (24px/8px) aplicado com disciplina real em `/hoje`, `/barco`, `/diario`, `/notificacoes`, `/gastos`, `/selo` — não está numa utilitária nomeada, mas é consistente por repetição em toda a base.
- **Dark mode como sistema de cor** — passa AA com folga em praticamente todos os pares principais (a maioria 5:1 a 17:1); o furo é pontual (3 sites com `superficie-2`), não estrutural.
- **Toques destrutivos com confirmação inline + 44px** (`components/confirmar.tsx`, aplicado em contatos/documentos/tripulação/equipamento/itens/parceiro) — os P0/P1 de 07/08 sobre isso foram entregues.
- **Login e Landing sempre em `data-theme="dark"` forçado** — elimina de vez o dourado-sobre-claro que reprovava contraste (1.96:1) na primeira impressão do produto.
- **Distinção "tudo em dia" vs "falta informação"** (`hoje/page.tsx:82-90`, comentário explica o raciocínio) e reabertura de anexo via URL assinada em diário/gastos/equipamento — os dois achados mais graves da síntese de usabilidade de 08/08 foram corrigidos.

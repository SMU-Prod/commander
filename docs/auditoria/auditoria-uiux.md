# Auditoria UI/UX — Commander (GEST-NAV/web)

Diretor de design · 07/08/2026 · Base auditada: `C:\Users\erick\GEST-NAV\web` (todas as páginas de `app/`, todos os `components/`, `globals.css`, `layout.tsx`, manifest, spec `docs/superpowers/specs/2026-08-06-commander-v2-design.md`)

**Veredito em uma frase:** o app tem uma fundação de tokens correta e uma arquitetura de informação decente, mas entrega ~30% da identidade aprovada — é um wireframe de alta fidelidade usando as cores da marca, não o produto das pranchas. O "grotesco" não é um bug, é ausência: ausência de imagem, de ícone, de escala tipográfica, de elevação e de dourado onde ele importa.

---

## 1. Gap identidade × execução (item por item)

| # | A identidade/mockup promete | O app entrega | Evidência |
|---|---|---|---|
| 1 | Set de 20 ícones outline da marca (âncora, motor, documento, escudo, óleo, ferramenta, calendário, alerta, câmera, gráfico, chat, selo, cifrão, bateria, raio, chave, pessoas, imagem, estrela, medalha) | **Zero ícones no conteúdo.** Existem só 5 paths SVG inline em `components/bottom-nav.tsx` (linhas 5–31). Nenhum componente de ícone existe no projeto. No lugar deles: 1 emoji `⛵` (`app/(app)/hoje/page.tsx:118`), caracteres tipográficos `‹` como seta de voltar (6 páginas) e `›` como chevron (`menu/tripulacao/page.tsx:63`), `★` como estrela (`barco/contatos/page.tsx:64`) e `+` textual nos botões | grep: nenhum outro `<svg>` em `app/` |
| 2 | **Card hero com FOTO da embarcação** ("AZIMUT 60 FLY / Marina da Glória") dominando o topo do Início | Header de texto puro: `<h1>{embarcacao.nome}</h1>` + linha dim com a marina. Nenhuma foto, nenhum card | `app/(app)/hoje/page.tsx:56-66` |
| 3 | Foto do motor na tela de Motores, tabs "Motor BB \| Motor BE", card de status | Cartucho de horímetro (bom, aliás) + duas listas planas. Sem foto, sem tabs — motores viram links soltos num grid | `app/(app)/barco/equipamento/[id]/page.tsx` |
| 4 | Saudação "Olá, Roberto" + avatar de foto | Não existe. O nome do usuário nem é buscado na Home; avatar não existe em lugar nenhum (o único "avatar" é o círculo de iniciais do marketplace, `marketplace/page.tsx:28-30`) | `hoje/page.tsx` |
| 5 | Seletor de embarcação com chevron ("Lancha Azimut 60 Fly ⌄") | Não existe; app assume 1 embarcação e a espec §4 diz que o banco já suporta N | `hoje/page.tsx:58` |
| 6 | Alertas com bolinha + título + subtítulo + **valor à direita em destaque** ("1.503h", "Vencido" em vermelho) | Card com barrinha lateral de 3px e dois textos à esquerda; a coluna direita de valor não existe — o dado forte ("vencido há 12 d") está em `text-xs text-dim` | `hoje/page.tsx:81-89` |
| 7 | "Acesso rápido": 4 quadrados com **ÍCONE + label** | 4 retângulos com só texto 12px | `hoje/page.tsx:138-153` |
| 8 | Logo: monograma MM dourado **com profundidade/3D sobre navy** | Path chapado `fill="#d4af37"` (o próprio arquivo admite: "Marca provisória"), renderizado a ~13px de altura sobre **off-white** — exatamente o fundo em que o dourado desaparece (contraste 1.96:1, ver §4) | `components/logo.tsx` |
| 9 | Display "Commander" caixa alta tracking largo como voz de marca | Aparece apenas dentro do logo e no `error.tsx`; nenhuma tela usa a voz display em títulos | `components/logo.tsx:13` |
| 10 | Módulo **Fotos** (espec §5: álbuns Exterior/Interior/Convés/Documentação + cota) | Nunca implementado. O bucket `acervo` já existe e funciona (`lib/acervo.ts` faz upload para ele); nenhuma rota `/barco/fotos` | espec linhas 69, 81 |
| 11 | Urbanist Light/Regular/Medium/SemiBold/Bold | Carrega 400/500/600/700 mas **700 nunca é usado** (grep font-bold = 0) e 300 não é carregado. Escala real usada: 9.5, 10, 10.5, 11, 11.5, 12, 14, 16, 20px — só 3 pesos | `app/layout.tsx:5-9` |
| 12 | Light + dark mode | **Entregue** — é o item da prancha que existe de verdade | `globals.css`, `theme-toggle.tsx` |

---

## 2. Diagnóstico: por que parece "grotesco"

1. **É um app 100% texto.** Zero `<img>`/`next/image` no projeto inteiro. Um produto para dono de Azimut de 60 pés que nunca mostra um barco. A retina lê "protótipo".
2. **Hierarquia tipográfica achatada.** O maior texto de qualquer tela interna é `text-xl` (20px) semibold — apenas 6px maior que o título de um item de lista (14px semibold, mesmo peso). Entre 9.5px e 14px vivem 7 tamanhos diferentes; acima de 14px, quase nada. Não há um único momento "display". Resultado: tudo tem a mesma voz, nada lidera a página.
3. **Zero elevação.** As únicas sombras do app são o glow do farol e o FAB (`registro-rapido.tsx:31`). Todos os cards são `border border-line bg-panel` — caixas de wireframe. Sem profundidade, o off-white sobre off-white vira "planilha".
4. **O dourado está escondido.** A cor da marca aparece em: links de 12px, chips, 2 botões e 1 barra de gráfico. Nas telas, o que domina é cinza sobre branco com hairlines. E onde o dourado aparece sobre fundo claro ele falha contraste (1.96:1) — a marca literalmente some.
5. **Densidade monótona.** Toda tela é a mesma receita: label mono 10.5px uppercase → card de lista `px-4 py-3` → repete 4-6x. Sem card hero, sem bloco de respiro, sem variação de ritmo. As páginas são indistinguíveis entre si.
6. **Sinal de status subdimensionado.** O produto vende "semáforo do barco" e o semáforo é uma bolinha de **8px** (`farol.tsx`, `size-2`) e uma barrinha de 3px. O mockup põe o valor vencido em vermelho, grande, à direita; o app põe em cinza 11px.
7. **Remendos que denunciam:** emoji ⛵ num CTA principal, `‹` e `›` como ícones, `★` como componente de rating, logo "provisória" comentada no código.

---

## 3. Fluxos e microinterações

| Achado | Evidência | Gravidade |
|---|---|---|
| **Nenhum `loading.tsx` no projeto** — e a Home aguarda uma API externa de mar (`boletimDoMar`) no servidor antes de renderizar. Navegar entre abas = tela congelada sem feedback | glob `**/loading.tsx` = 0; `hoje/page.tsx:41-44` | P0 |
| **Ações destrutivas sem confirmação**: "Excluir" contato, "Excluir" documento, "Revogar" convite são um tap direto num `<button>` de `text-xs` | `barco/contatos/page.tsx:54-57`, `barco/documentos/page.tsx:90-93`, `menu/tripulacao/page.tsx:81-84` | P0 |
| **Sem safe-area do iPhone**: manifest é `display: standalone`, mas não há `viewport-fit=cover` nem `env(safe-area-inset-*)` em lugar nenhum. A bottom-nav (`pb-2.5` = 10px) fica embaixo do home indicator; o FAB idem | grep `safe-area` = 0; `manifest.ts:9`; `bottom-nav.tsx:45` | P0 |
| **Sem feedback de sucesso**: salvar evento/contato/documento só redireciona; erro viaja por `?erro=` na URL (fica na URL ao compartilhar, some no back). Nenhum toast/confirmação | padrão em todas as actions | P1 |
| **Sheet do Registro Rápido fecha antes de salvar** — `setAberto(false)` antes do `await`; se a action falhar, o usuário nunca sabe | `registro-rapido.tsx:19-24` | P1 |
| Alvos de toque abaixo de 44px: "Excluir"/"Revogar" (~24px), "Enviar" xs, estrelas de avaliação, links "Ver"/"Abrir"/"Monitorar" 12px | contatos/documentos/barco | P1 |
| Navegação "voltar" inconsistente: `<a href>` (full reload) em documentos/contatos/gastos/tripulação/diario-novo vs `<Link>` em equipamento; rótulo muda (‹ Barco / ‹ Embarcação) | compare `documentos:39` com `equipamento:31` | P1 |
| Validação inline: inexistente. Campos de horas aceitam qualquer texto (`inputMode` sem `pattern`), custo idem; erro só depois do round-trip | `diario/novo/page.tsx:86-90`, `registro-rapido.tsx` | P1 |
| Modal sem focus-trap, sem Escape, sem `role="dialog"`/`aria-modal` | `registro-rapido.tsx:36-74` | P2 |
| Estados vazios: **bem escritos** (tom náutico, orientam a ação) — manter. Mas são só texto; um ícone da marca os elevaria | ex.: `diario/page.tsx:70-74` | P2 |

---

## 4. Acessibilidade (ratios calculados, WCAG 2.1)

| Par | Ratio | Veredito | Onde |
|---|---|---|---|
| Dourado `#D4AF37` sobre off-white `#F5F7FA` | **1.96:1** | REPROVA (texto exige 4.5, gráfico 3.0) | Logo no login (`login/page.tsx:13`), barra do mês atual no gráfico de gastos (`gastos/page.tsx:66`) |
| Dourado `#D4AF37` sobre branco `#FFFFFF` | **2.10:1** | REPROVA | idem sobre `bg-panel` |
| Dourado `#D4AF37` sobre navy `#0B1D2D` | **8.13:1** | AAA — o dourado foi desenhado para o navy; usar sobre superfícies navy/meter | botões `bg-accent` + `text-acao-texto` (ok) |
| `--texto-dim #60717F` sobre `#F5F7FA` | **4.70:1** | Passa AA por 0.2 — mas é usado a 10–11px, sem margem | todas as telas |
| `--acao-forte #8A6D1C` sobre off-white | **4.57:1** | Passa raspando; usado a 9.5px uppercase na nav e links 12px | `bottom-nav.tsx:46` |
| `--meter-dim #7C93AB` sobre `--meter #0B1D2D` | 5.39:1 | OK | horímetros |
| `--ok #15803D` sobre branco | 5.02:1 | OK, mas o farol tem só 8px | `farol.tsx` |

Demais achados:
- **Nenhum estilo de foco** no projeto (grep `focus` = 0). Teclado/switch-control navega às cegas. Adicionar `focus-visible:ring-2 ring-accent` global.
- **Headings quebrados**: os títulos de seção ("Motores", "Casco", "Mar agora") são `<p>`; leitores de tela veem páginas com um único h1 e 4 `<h2>` no app inteiro (onboarding). Trocar labels de seção por `<h2>`.
- Fontes abaixo de 12px em papéis funcionais: nav 9.5px, selo do marketplace 9.5px, labels 10.5px — abaixo do mínimo confortável mobile (12px).
- `aria-current` na nav: presente (bom). `aria-label` no farol: presente (bom). `aria-hidden` faltando nos SVGs da nav.

---

## 5. Plano de correção — "design pass" priorizado (percepção de qualidade ÷ esforço)

### P0 — o que faz parecer amador (1ª onda, ~2-3 dias)

**P0.1 · Sistema de ícones da marca** — novo `components/icone.tsx`
Um componente único com os 20 paths outline da prancha (traço 1.7, cantos arredondados — o estilo já usado na bottom-nav serve de matriz):
```tsx
const PATHS: Record<NomeIcone, ReactNode> = { ancora: <path d="..."/>, motor: ..., oleo: ..., /* 20 nomes da prancha */ }
export function Icone({ nome, className }: ...) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>{PATHS[nome]}</svg>
}
```
Componente com paths inline > sprite SVG aqui: tree-shaking automático, cor via `currentColor`, zero fetch. Migrar bottom-nav para ele. Aplicar em: Acesso rápido (ícone+label, cumpre o mockup), títulos de seção, cards do Acervo, estados vazios, listas de casco/documentos. **Apagar o emoji ⛵** (`hoje/page.tsx:118` → `<Icone nome="ancora"/>` ou raio), trocar `‹`/`›` por chevron SVG e `★` por estrela do set.

**P0.2 · Card hero da embarcação** — `app/(app)/hoje/page.tsx` + nova coluna `foto_path` em `embarcacoes` (upload via bucket `acervo`, já existente)
Substituir o header de texto pelo card do mockup: foto full-bleed com gradiente navy por cima, nome da embarcação em display (caixa alta, tracking largo, 24-28px), marina + cidade em off-white dim, farol geral no canto. Fallback sem foto: gradiente navy→navy-2 com monograma MM em marca-d'água + CTA "Adicionar foto da embarcação" — o fallback já entrega a identidade no dia 1. Reaproveitar o mesmo card na tela `/barco`.

**P0.3 · Loading states** — criar `app/(app)/loading.tsx` (skeleton: hero + 3 cards em `animate-pulse`) e mover `boletimDoMar` para `<Suspense>` com fallback próprio dentro da Home (a API externa não pode segurar a página inteira).

**P0.4 · Contraste do dourado** — regra: dourado NUNCA como texto/gráfico sobre fundo claro.
- `login/page.tsx`: pintar o topo (ou a página) de navy e pousar o logo nele — como nas pranchas; ganha a primeira impressão inteira.
- `gastos/page.tsx:66`: barra do mês atual → `bg-accent-forte` (`#8A6D1C`) no light (via token) ou barra navy com topo dourado.
- Conferir `text-accent` remanescentes sobre claro; links continuam em `--acao-forte`.

**P0.5 · Safe-area + confirmação destrutiva**
- `app/layout.tsx`: `viewport: { themeColor..., viewportFit: "cover" }`; `bottom-nav.tsx`: `pb-[max(0.625rem,env(safe-area-inset-bottom))]`; FAB: `bottom-[calc(5rem+env(safe-area-inset-bottom))]`.
- Novo `components/confirmar.tsx` (client, wrapper de form que intercepta submit e mostra sheet "Excluir contato? Essa ação não tem volta." + botão crit). Usar em excluirContato, excluirDocumento, revogarConvite.

### P1 — a camada de polimento (2ª onda)

**P1.1 · Escala tipográfica** — definir e aplicar 4 vozes (em `globals.css` como utilities):
- `display`: 24-28px, semibold, caixa alta, tracking .04em — títulos de página (h1 sobe de 20 para 24+)
- `titulo-card`: 15-16px semibold; `corpo`: 14px; `apoio`: 13px (subir os 12px atuais)
- `label-mono`: manter o mono uppercase (é a melhor ideia visual do app), mas mínimo 11px
- valores de instrumento continuam no mono tabular (já bom)

**P1.2 · Elevação** — tokens `--sombra-1: 0 1px 2px rgb(11 29 45 / .06)` e `--sombra-2: 0 4px 16px rgb(11 29 45 / .08)` (dark: sombras pretas mais fortes). Cards de conteúdo ganham sombra-1, hero/sheet/FAB sombra-2; hairline `--linha` fica mais sutil. Padronizar raio: 14px card / 10px campo (hoje há 6 raios diferentes — 23 `rounded-lg`, 21 `rounded-xl`, 17 `[10px]`, etc.).

**P1.3 · Linha de alerta do mockup** — `hoje/page.tsx`: farol 10px + título 15px + subtítulo dim, e a coluna direita com o VALOR em destaque (`text-crit font-semibold` "Vencido" / mono "1.503 h"), como aprovado.

**P1.4 · Feedback**: `useFormStatus` nos botões (spinner + disabled), toast de sucesso (componente próprio, 2s), corrigir o fluxo do sheet (`registro-rapido.tsx`: fechar só após sucesso; erro renderiza no próprio sheet).

**P1.5 · Toque e navegação**: mínimo 44px em toda ação (Excluir vira ícone-botão 44px, estrelas 40px), `<a>` internos → `<Link>`, rótulo de voltar padronizado, foco visível global (`:focus-visible { outline: 2px solid var(--acao); outline-offset: 2px }`), headings semânticos (`<p>` de seção → `<h2>`).

### P2 — completar a promessa

**P2.1 · Módulo Fotos** (espec §5) — rota `app/(app)/barco/fotos/page.tsx`, álbuns fixos (Exterior, Interior, Convés, Documentação visual), upload via `subirArquivo` (bucket `acervo`, pasta nova `fotos/`), grid 3 colunas, barra de cota. Alimenta o hero (P0.2) e o dossiê de revenda — é feature E identidade.
**P2.2 · Tela de motor do mockup** — tabs BB/BE, foto do motor (bucket), card de status, sub-seções com ícone + chevron.
**P2.3 · Saudação + avatar + seletor de embarcação** no topo do Início ("Olá, {nome}" — o nome já existe em `profiles`).
**P2.4 · Logo final** — substituir o path provisório pelo asset da prancha (com profundidade), versão para fundo claro (monograma navy ou contorno) e versão navy.
**P2.5 · Modal acessível** — focus-trap, Escape, `role="dialog"`, drag-handle no sheet.

### Ordem de execução sugerida
P0.4-login (meio dia, muda a primeira impressão) → P0.1 ícones → P0.2 hero → P0.3 loading → P0.5 → P1.2 elevação → P1.1 tipografia → P1.3 → P1.4/P1.5 → P2.

O que **não** mexer: tokens de cor dos dois temas (bons), horímetro/cartucho meter (melhor peça do app), voz de texto pt-BR náutica (excelente), estrutura de dados das telas.

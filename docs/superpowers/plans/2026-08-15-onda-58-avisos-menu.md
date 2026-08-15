# Onda 58 — Avisos e Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aplicar o spec de arquitetura de informação nas duas telas que o dono
apontou — Avisos vira caixa de entrada, Menu vira índice — e estrear `Abas`.

**Architecture:** RSC do Next 16; estado de aba e de expansão via URL e
`<details>` (nada de client state novo). `Abas` nasce em `web/components/ui/`
com o Avisos como primeiro consumidor. Ajustes é rota nova `/menu/ajustes`.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (tokens de
`app/globals.css`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-15-arquitetura-informacao-design.md`
(§3 Avisos, §4 Menu, §6 verificação).

## Global Constraints

- Escala tipográfica `11 · 12 · 14 · 16 · 20 · 26 · 34`; espaçamento base 8;
  raio SÓ por token (`--raio-controle` 8, `--raio-cartao` 14, `--raio-pilula`
  999). Nenhuma cor literal nova em `.tsx` (teto por arquivo em
  `lib/ui/tokens.test.ts` — se um arquivo zerar, baixe o teto junto).
- Máximo **dois** usos de dourado por tela. Todo número em `font-mono-instr` +
  `tabular-nums`. Alvo de toque ≥ 44px. Estado é cor **e** palavra.
- **Não regredir a folga da safe-area** (`web/e2e/sem-saida.spec.ts` protege;
  se ele quebrar, a correção está errada).
- Vermelho só para crítico. Dourado do Gold não se mistura com o de ação.
- Verificação por tarefa: `npx tsc --noEmit && npm test && npm run lint`.
  Build completo na última. Commits em português no estilo de
  `git log --oneline -15`.

## Fatos do código que as tarefas usam

- `contadorSino` (`lib/domain/notificacoes.ts:272`) já conta só
  crítica+importante via `PUSH_POR_NIVEL` — **o badge já é "o que pede
  ação"**; a Tarefa 5 só trava isso em teste.
- `carregarNotificacoes` (`lib/consultas.ts`) alimenta badge E tela — nunca
  divergem. Não criar segundo caminho.
- `app/(app)/layout.tsx:52` calcula `avisos` e passa a `MolduraApp`/`BottomNav`.
- `Chip` (`components/ui/chip.tsx`) tem `href`/`ativo` — os filtros de
  categoria de Avisos já o usam; ficam como estão (BarraFerramentas é onda 59).
- `AtivarAlertas` (`components/ativar-alertas.tsx`) é client, estados
  `carregando|sem-suporte|inativo|ativo`.
- Menu hoje: 17 `LinhaLista` em 10 seções (`app/(app)/menu/page.tsx`).
  Avisos hoje: 4 trabalhos em 207 linhas (`app/(app)/notificacoes/page.tsx`).

---

## Tarefa 1 — `Abas`

**Files:**
- Create: `web/components/ui/abas.tsx`
- Test: `web/components/ui/abas.test.ts`

**Interfaces:**
- Produces: `Abas({ abas, ativa, className })` com
  `abas: { valor: string; rotulo: string; href: string; contagem?: number }[]`,
  `ativa: string`. Navegação por `<Link>` (RSC-friendly, estado na URL).

- [ ] **Passo 1: teste primeiro** (`renderToStaticMarkup`, mesmo padrão de
  `selo.test.ts`): a aba ativa tem `aria-current="page"`; toda aba é um link
  com o `href` dado; contagem sai em `font-mono-instr`; sem contagem, nenhum
  span de número. Rode e veja falhar.

- [ ] **Passo 2: implementar**

```tsx
import Link from "next/link"

/**
 * ONDA 58 — navegação dentro de uma tela (spec de arquitetura §2.3).
 * Estado mora na URL, não em useState: RSC continua server, voltar do
 * navegador funciona, e link é compartilhável. Anatomia única — a régua
 * "duas telas que fazem a mesma coisa parecem a mesma coisa" só vale se
 * ninguém escrever abas à mão.
 */
export function Abas({ abas, ativa, className = "" }: {
  abas: { valor: string; rotulo: string; href: string; contagem?: number }[]
  ativa: string
  className?: string
}) {
  return (
    <nav aria-label="Seções desta tela" className={`flex gap-1 border-b border-line ${className}`}>
      {abas.map((a) => {
        const ehAtiva = a.valor === ativa
        return (
          <Link
            key={a.valor}
            href={a.href}
            aria-current={ehAtiva ? "page" : undefined}
            className={`flex min-h-11 items-center gap-1 border-b-2 px-3 text-sm font-medium ${
              ehAtiva ? "border-accent-forte text-texto" : "border-transparent text-dim"
            }`}
          >
            {a.rotulo}
            {a.contagem != null && a.contagem > 0 && (
              <span className="font-mono-instr text-[11px] tabular-nums text-dim">{a.contagem}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
```

  Atenção: o sublinhado dourado da aba ativa **conta no orçamento de dourado
  da tela** — em Avisos os dois usos passam a ser a aba ativa e nada mais
  (nenhum botão dourado existe lá).

- [ ] **Passo 3: verificar e commitar** — teste passa; commit
  `feat(ui): Abas — navegacao dentro de uma tela, estado na URL`.

---

## Tarefa 2 — Avisos vira caixa de entrada

**Files:**
- Modify: `web/app/(app)/notificacoes/page.tsx`
- Create: `web/components/tarja-push-desligado.tsx`

**Interfaces:**
- Consumes: `Abas` (Tarefa 1), `carregarNotificacoes`, domínios existentes.
- Produces: rota aceita `?aba=historico` e `?categoria=...` combinados.

- [ ] **Passo 1: duas abas.** `Abas` logo abaixo do título: **Pendentes**
  (default, contagem = `visiveis.length`) e **Histórico**. `?aba=historico`
  renderiza SÓ o bloco de `alertas_enviados` (o de hoje, linhas 186-204,
  movido para dentro do ramo); qualquer outro valor cai em Pendentes. Os
  filtros de categoria (`ChipLinha`) só aparecem em Pendentes, e o link das
  categorias preserva a aba.

- [ ] **Passo 2: hierarquia progressiva em Pendentes.** Críticas continuam
  com peso inteiro (cartões como hoje). Importantes e informativas ficam
  **recolhidas** atrás da contagem, num `<details>` nativo cada (RSC, zero
  JS):

```tsx
<details className="mt-4 group">
  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-dim [&::-webkit-details-marker]:hidden">
    <Icone nome="chevron" className="size-4 transition-transform group-open:rotate-90" />
    Importantes
    <span className="font-mono-instr text-[11px] tabular-nums">{importantes.length}</span>
  </summary>
  <div className="mt-2 space-y-2">{importantes.map((n) => <CartaoNotificacao key={n.id} n={n} />)}</div>
</details>
```

  Mesmo padrão para informativas. **Se não houver crítica nenhuma e houver
  importantes, o `<details>` de importantes nasce `open`** — caixa de entrada
  sem nada em destaque e com trabalho escondido é pior que a tela antiga.
  Bloco só existe se a contagem > 0.

- [ ] **Passo 3: `AtivarAlertas` sai do topo.** No lugar, uma tarja fina
  **client** que só aparece quando o push está desligado
  (`tarja-push-desligado.tsx`: mesmo sniff de suporte do `AtivarAlertas`,
  mas renderiza `null` em `carregando`, `sem-suporte` e `ativo`; em
  `inativo`, uma linha discreta com link para `/menu/ajustes`):
  *"Avisos no aparelho estão desligados — ativar em Ajustes"*. Nada de
  botão de teste aqui; isso mora em Ajustes (Tarefa 3).

- [ ] **Passo 4: estado vazio é boa notícia.** Sem pendência nenhuma (e sem
  filtro ativo), o `EstadoVazio` diz *"Nenhuma pendência"* e a descrição diz
  que críticas e importantes aparecem aqui e no aparelho. Não decorar.

- [ ] **Passo 5: verificar e commitar** — tsc/test/lint; abrir a tela nos
  dois estados (com e sem pendência) e nas duas abas; commit
  `feat(avisos): a caixa de entrada quer ficar vazia`.

---

## Tarefa 3 — Ajustes

**Files:**
- Create: `web/app/(app)/menu/ajustes/page.tsx`

**Interfaces:**
- Consumes: `AtivarAlertas`, `ThemeToggle`, `LinhaLista`, `SecaoPagina`, `sair`.

- [ ] **Passo 1: a tela.** Título "Ajustes". Ordem de quem procura, do que
  muda mais para o institucional:
  1. **Conta** — `LinhaLista` para `/menu/perfil` (e-mail como título) e
     `/menu/assinatura`;
  2. **Aparência** — o bloco do `ThemeToggle` de hoje, movido como está;
  3. **Avisos no aparelho** — `AtivarAlertas` movido para cá, com o
     subtítulo explicando que é por aparelho;
  4. **Embarcações** — "Cadastrar outra embarcação" (`/onboarding`);
  5. **Legal** — Termos e Privacidade;
  6. o `<form action={sair}>` de hoje, no fim.
  Tudo componente existente — esta tarefa não cria estilo novo.

- [ ] **Passo 2: verificar e commitar** — tsc/test/lint; commit
  `feat(menu): Ajustes ganha tela propria`.

---

## Tarefa 4 — Menu vira índice

**Files:**
- Modify: `web/app/(app)/menu/page.tsx`
- Create: `web/app/(app)/tripulacao/page.tsx` (nova casa)
- Modify: `web/app/(app)/menu/tripulacao/page.tsx` (vira `redirect`)

**Interfaces:**
- Consumes: `carregarPainel`, `podeVerAgenda`, `meusPapeisAdmin`,
  `LinhaLista`, `SecaoPagina`.

- [ ] **Passo 1: só destinos, agrupados pela vida do barco.**

  | Seção | Linhas |
  |---|---|
  | **O barco** | Equipamentos (`/barco/equipamentos`) · Fotos (`/barco/fotos`) · Documentos (`/barco/documentos`) · Ocorrências (`/barco/ocorrencias`) |
  | **Dinheiro** | Financeiro (`/financeiro`) · Carteira (`/carteira`) |
  | **Gente** | Tripulação (`/tripulacao`, gate `papel === "PROP"` como hoje) · Comandantes (`/comandantes`) |
  | **Rede** | Prestadores · Marketplace · Explorar (como hoje) · Agenda (gate `podeVerAgenda` como hoje) |
  | **Para estabelecimentos** | como hoje |
  | **Commander (interno)** | Admin, gate `papeisAdmin` como hoje |
  | *(fim, sem seção)* | uma `LinhaLista` **Ajustes** → `/menu/ajustes`, subtítulo "Conta, assinatura, aparência e avisos do aparelho" |

  Saem do Menu (foram para Ajustes): Conta, Assinatura, Aparência,
  "Configurar avisos", "Cadastrar outra embarcação", Legal, Sair.
  Sai também "Commander Connect" **da seção de embarcações** — vira linha em
  "O barco" (é área do barco, não ajuste).

- [ ] **Passo 2: destino diz o que tem dentro.** Subtítulos com número real,
  buscados na própria página (consultas `count`/`head:true`, baratas, uma por
  seção — não N por linha):
  - Equipamentos: `X equipamentos` (count em `equipamentos` da embarcação);
  - Ocorrências: `X abertas` quando > 0, senão o subtítulo descritivo;
  - Financeiro: total do mês (`lancamentos_financeiros` do mês, mesmo
    cálculo da Início — extraia a soma para função pura se ainda não houver);
  - Fotos/Documentos/demais: manter subtítulo descritivo (número aqui não
    orienta decisão).
  Números em `font-mono-instr tabular-nums`. Barco sem dado mostra o
  subtítulo descritivo, nunca "0" seco.

- [ ] **Passo 3: Tripulação muda de endereço.**
  `app/(app)/tripulacao/page.tsx` passa a ser a tela (mover o arquivo);
  `app/(app)/menu/tripulacao/page.tsx` vira
  `redirect("/tripulacao")` de uma linha com comentário do porquê (spec §4.1:
  endereço é arquitetura escrita). Atualizar TODOS os `href` internos
  (`grep -rn "menu/tripulacao"` — inclui `trilho? não`, Menu, e possíveis
  links em telas de convite).

- [ ] **Passo 4: verificar e commitar** — tsc/test/lint; conferir que
  `/menu/tripulacao` redireciona; commit
  `feat(menu): de gaveta a indice do produto`.

---

## Tarefa 5 — Verificação da onda

**Files:**
- Create: `web/lib/domain/notificacoes-contador.test.ts` (ou estender o
  teste existente do domínio, se houver — conferir antes)
- Modify: `web/e2e/varredura-mobile.spec.ts` (só se a asserção nova couber
  nela; senão, spec novo `web/e2e/anatomia.spec.ts`)

- [ ] **Passo 1: a contagem do ícone é o que pede ação.** Teste de domínio:
  `contadorSino` com 1 crítica + 1 importante + 3 informativas = **2**.
  Comentário citando o spec §3.3 — é a diferença entre número que se confia
  e número que se ignora.

- [ ] **Passo 2: todo destino do Menu leva a rota que existe.** Teste
  (vitest, leitura de arquivo — mesmo espírito do `tokens.test.ts`): extrai
  os `href` estáticos de `menu/page.tsx` e `menu/ajustes/page.tsx` e confere
  que `web/app/(app)/<rota>/page.tsx` existe (normalizando grupos). Link
  morto no gate de descoberta é área do produto que ninguém acha.

- [ ] **Passo 3: rodar a varredura** (390 e 1440) e o `sem-saida`; diagnosticar
  Avisos e Menu especificamente nos PNGs. `npm run build`.

- [ ] **Passo 4: commit** `test(onda-58): contagem honesta e menu sem porta falsa`.

---

## O que este plano NÃO faz

- **Não cria `BarraFerramentas`** — onda 59, com Diário e Financeiro.
- **Não toca o sino da Início** nem a faixa de topo do desktop (onda 60).
- **Não muda `carregarNotificacoes`** — a fonte única do badge fica intacta.
- **Não some com os filtros de categoria** de Avisos — viram BarraFerramentas
  na onda 59; aqui só mudam de contexto (apenas na aba Pendentes).
- **Não refaz as listas nem as fichas** — ondas 59 e 60.

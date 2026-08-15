# Fundação visual do Commander — plano de implementação

> **Para quem for executar:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> `- [ ]` para marcação.

**Objetivo:** dar ao Commander casca responsiva (celular → desktop), componentes
de anatomia única e uma Início refeita, sem tocar nas outras 108 telas.

**Arquitetura:** a mudança acontece em dois lugares que já são consumidos por
quase tudo — os tokens em `app/globals.css` e um punhado de componentes em
`components/ui/`. `MolduraApp` passa a ser a única peça que conhece breakpoint
de layout. Nenhuma tela além de `/hoje` é reescrita neste plano.

**Stack:** Next.js 16 (App Router, RSC), Tailwind v4 (tokens via `@theme`),
Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-08-15-fundacao-visual-design.md`](../specs/2026-08-15-fundacao-visual-design.md)
**Princípios:** [`docs/DESIGN.md`](../../DESIGN.md)

## Restrições globais

Valem para toda tarefa; não se repetem em cada uma.

- **Comentários em português**, explicando o PORQUÊ. Referência de tom:
  `lib/domain/saude.ts`, `components/moldura-app.tsx`.
- **Não regredir a folga da safe-area** (onda 54). `web/e2e/sem-saida.spec.ts`
  protege; se ele quebrar, a correção está errada.
- **Não regredir**: Saúde sem porcentagem; vermelho só para crítico; horímetro
  só manual.
- **Máximo dois usos do acento dourado por tela.**
- **Todo número em fonte de instrumento** (`font-mono-instr` + `tabular-nums`).
- **Nenhuma cor literal nova** em `.tsx`. Hoje há 95; o número só desce.
- Verificação de cada tarefa: `npx tsc --noEmit && npm test && npm run lint`.
  Build completo (`npm run build`) na última.
- Commits em português, no estilo de `git log --oneline -15`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `web/app/globals.css` | *(modificar)* tokens: raio, elevação, paleta escura |
| `web/lib/ui/superficies.ts` | *(modificar)* larguras e folgas por breakpoint |
| `web/components/ui/cartao.tsx` | *(criar)* cartão de anatomia única |
| `web/components/ui/kpi.tsx` | *(criar)* rótulo + valor de instrumento |
| `web/components/ui/selo.tsx` | *(criar)* pílula de estado (cor **e** palavra) |
| `web/components/ui/selo.test.ts` | *(criar)* estado nunca só por cor |
| `web/components/moldura-app.tsx` | *(modificar)* casca de 3 tamanhos |
| `web/components/trilho-lateral.tsx` | *(criar)* navegação de desktop |
| `web/components/bottom-nav.tsx` | *(modificar)* Comandantes → Diário |
| `web/app/(app)/hoje/page.tsx` | *(modificar)* recomposição |
| `web/e2e/varredura-mobile.spec.ts` | *(modificar)* rodar também em 1440px |
| `web/lib/ui/tokens.test.ts` | *(criar)* teto de cor literal |

---

## Tarefa 1 — Tokens

**Arquivos:** modificar `web/app/globals.css`

- [ ] **Passo 1: acrescentar os tokens de forma, depois de `--texto-dim-chip`**

```css
  /* Onda 57 — forma. Três raios e três elevações, e nada fora disto.
     Quatro raios diferentes na mesma tela foi o que fez a proposta de
     redesign parecer gerada: decoração distribuída em vez de sistema.
     Ver docs/DESIGN.md §5. */
  --raio-controle: 8px;   /* chip, campo, botão pequeno */
  --raio-cartao: 14px;    /* cartão, painel, bloco */
  --raio-pilula: 999px;   /* pílula, avatar, selo */

  /* Sombra existe para dizer "isto flutua", nunca para embelezar. A
     maioria das superfícies é plana. */
  --elev-cartao: 0 1px 2px rgba(11, 29, 45, .06);
  --elev-flutuante: 0 12px 32px rgba(4, 14, 24, .28);
```

- [ ] **Passo 2: aprofundar a paleta escura** — substituir os quatro primeiros
  valores do bloco `[data-theme="dark"]`

```css
[data-theme="dark"] {
  /* Onda 57 — o escuro fica mais fundo e mais neutro. O navy #0b1d2d como
     GROUND deixava tudo azulado e cartão nenhum se separava do fundo; a
     referência escolhida pelo dono (painel Haulix) usa quase-preto e
     reserva a cor para o dado. O navy continua sendo a marca — só não é
     mais o chão. */
  --fundo: #0a0e12;
  --superficie: #121820;
  --superficie-2: #1a222c;
  --linha: #232d38;
```

- [ ] **Passo 3: conferir que o dark ainda passa contraste**

Rode e leia a saída; nenhum par abaixo de 4.5:1:

```bash
cd web && npx vitest run lib/ui
```

- [ ] **Passo 4: commit**

```bash
git add web/app/globals.css
git commit -m "feat(tokens): tres raios, duas elevacoes e um escuro mais fundo"
```

---

## Tarefa 2 — Selo, Kpi e Cartao

**Interfaces produzidas** (as tarefas 5 e 6 dependem destas assinaturas):
- `Selo({ estado, children }: { estado: EstadoSelo; children: React.ReactNode })`
- `Kpi({ rotulo, valor, apoio?, estado? })`
- `Cartao({ icone?, titulo?, selo?, acao?, children })`

**Arquivos:** criar `web/components/ui/selo.tsx`, `selo.test.ts`, `kpi.tsx`,
`cartao.tsx`

- [ ] **Passo 1: teste do Selo, antes do componente** — `web/components/ui/selo.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { ESTADOS_SELO, rotuloDoSelo } from "./selo"

describe("Selo", () => {
  it("todo estado tem palavra — cor sozinha exclui quem não distingue verde de vermelho", () => {
    for (const e of ESTADOS_SELO) {
      expect(rotuloDoSelo(e).trim().length).toBeGreaterThan(0)
    }
  })

  it("os rotulos nao usam porcentagem nem numero (PRD 1.1)", () => {
    for (const e of ESTADOS_SELO) {
      expect(rotuloDoSelo(e)).not.toMatch(/\d|%/)
    }
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd web && npx vitest run components/ui/selo.test.ts
```
Esperado: falha com "Failed to resolve import ./selo".

- [ ] **Passo 3: criar `web/components/ui/selo.tsx`**

```tsx
/**
 * Pílula de estado. Cor E palavra, sempre: daltônico não enxerga o farol
 * verde, e "estado é forma, não só cor" (docs/DESIGN.md §6, regra 3).
 */
export const ESTADOS_SELO = ["ok", "atencao", "critico", "neutro"] as const
export type EstadoSelo = (typeof ESTADOS_SELO)[number]

const ROTULO: Record<EstadoSelo, string> = {
  ok: "Em dia",
  atencao: "Atenção",
  critico: "Crítico",
  neutro: "Sem dados",
}

const COR: Record<EstadoSelo, string> = {
  ok: "border-ok/40 text-ok",
  atencao: "border-warn/40 text-warn",
  critico: "border-crit/40 text-crit",
  neutro: "border-line text-dim",
}

export function rotuloDoSelo(estado: EstadoSelo): string {
  return ROTULO[estado]
}

export function Selo({ estado, children }: { estado: EstadoSelo; children?: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[var(--raio-pilula)] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.09em] ${COR[estado]}`}
    >
      {children ?? ROTULO[estado]}
    </span>
  )
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
cd web && npx vitest run components/ui/selo.test.ts
```

- [ ] **Passo 5: criar `web/components/ui/kpi.tsx`**

```tsx
import type { EstadoSelo } from "./selo"

/**
 * Número-chave. O valor SEMPRE em fonte de instrumento com `tabular-nums`:
 * numa faixa de KPIs os valores ficam lado a lado, e fonte proporcional faz
 * a coluna balançar (docs/DESIGN.md §5).
 */
const COR_VALOR: Record<EstadoSelo, string> = {
  ok: "text-texto", atencao: "text-warn", critico: "text-crit", neutro: "text-dim",
}

export function Kpi({
  rotulo, valor, apoio, estado = "ok",
}: {
  rotulo: string
  valor: string
  apoio?: string
  estado?: EstadoSelo
}) {
  return (
    <div className="min-w-0">
      <p className="rotulo truncate text-dim">{rotulo}</p>
      <p className={`font-mono-instr text-[20px] font-semibold tabular-nums ${COR_VALOR[estado]}`}>{valor}</p>
      {apoio && <p className="apoio truncate text-dim">{apoio}</p>}
    </div>
  )
}
```

- [ ] **Passo 6: criar `web/components/ui/cartao.tsx`**

```tsx
import { Icone, type NomeIcone } from "@/components/icone"

/**
 * O bloco padrão da tela. Existe para que duas telas que fazem a mesma coisa
 * pareçam a mesma coisa — a varredura de 15/08 achou a mesma pílula escrita
 * à mão em 12 telas com 6 alturas, e a origem disso é não ter tido um
 * cartão único desde o começo.
 *
 * `plano` para o cartão que já está dentro de outro: sombra sobre sombra
 * empilha profundidade que não existe.
 */
export function Cartao({
  icone, titulo, selo, acao, plano = false, className = "", children,
}: {
  icone?: NomeIcone
  titulo?: string
  selo?: React.ReactNode
  acao?: React.ReactNode
  plano?: boolean
  className?: string
  children: React.ReactNode
}) {
  const temCabecalho = Boolean(titulo || selo || acao)
  return (
    <section
      className={`rounded-[var(--raio-cartao)] border border-line bg-panel p-4 ${plano ? "" : "sombra-1"} ${className}`}
    >
      {temCabecalho && (
        <header className="mb-3 flex items-center gap-2">
          {icone && <Icone nome={icone} className="size-4 shrink-0 text-dim" />}
          {titulo && <h2 className="rotulo min-w-0 flex-1 truncate text-dim">{titulo}</h2>}
          {selo}
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
```

- [ ] **Passo 7: verificar e commitar**

```bash
cd web && npx tsc --noEmit && npm test && npm run lint
git add web/components/ui/selo.tsx web/components/ui/selo.test.ts web/components/ui/kpi.tsx web/components/ui/cartao.tsx
git commit -m "feat(ui): Selo, Kpi e Cartao — anatomia unica para o bloco de tela"
```

---

## Tarefa 3 — Casca responsiva

**Consome:** nada. **Produz:** `MolduraApp` com três tamanhos e `TrilhoLateral`.

**Arquivos:** modificar `web/components/moldura-app.tsx` e
`web/lib/ui/superficies.ts`; criar `web/components/trilho-lateral.tsx`

- [ ] **Passo 1: larguras em `web/lib/ui/superficies.ts`**

```ts
/**
 * Onda 57 — larguras por tamanho de tela.
 *
 * Até aqui o conteúdo vivia numa coluna de 430px em QUALQUER tela: num
 * notebook de 1440px isso é um app de celular encalhado com mil pixels
 * vazios em volta. O app tinha 42 usos de breakpoint em 109 telas — ou
 * seja, layout de desktop não existia.
 *
 * 430px continua sendo o teto no celular (linha de leitura confortável);
 * a partir de lg o conteúdo respira até 1400px ao lado do trilho.
 */
export const LARGURA_CONTEUDO = "max-w-[430px] md:max-w-[680px] lg:max-w-[1400px]"

/** Espaço que o trilho de 72px ocupa a partir de lg. */
export const OFFSET_TRILHO = "lg:pl-[72px]"
```

- [ ] **Passo 2: criar `web/components/trilho-lateral.tsx`**

```tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icone, type NomeIcone } from "./icone"

/**
 * Navegação de desktop (lg+). Trilho de 72px, não sidebar larga: sidebar de
 * 272px come a densidade que a referência tem, e o Commander mostra UM
 * barco — não precisa de menu com doze rótulos escritos.
 *
 * No celular ele não existe: quem navega lá é a bottom-nav. Duas navegações
 * ao mesmo tempo é o erro clássico do "app esticado".
 */
const DESTINOS: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: "/hoje", rotulo: "Início", icone: "inicio" },
  { href: "/barco", rotulo: "Barco", icone: "embarcacao" },
  { href: "/diario", rotulo: "Diário", icone: "relatorio" },
  { href: "/agenda", rotulo: "Agenda", icone: "calendario" },
  { href: "/financeiro", rotulo: "Financeiro", icone: "cifrao" },
  { href: "/notificacoes", rotulo: "Avisos", icone: "alerta" },
  { href: "/menu", rotulo: "Menu", icone: "menu" },
]

export function TrilhoLateral() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navegação principal"
      className="no-imprimir fixed inset-y-0 left-0 z-20 hidden w-[72px] flex-col items-center gap-1 border-r border-line bg-panel py-4 lg:flex"
    >
      {DESTINOS.map((d) => {
        const ativo = pathname === d.href || pathname.startsWith(`${d.href}/`)
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={ativo ? "page" : undefined}
            title={d.rotulo}
            className={`flex size-12 flex-col items-center justify-center gap-0.5 rounded-[var(--raio-controle)] text-[9px] uppercase tracking-[.06em] ${
              ativo ? "bg-accent/12 text-accent-forte" : "text-dim hover:bg-panel2"
            }`}
          >
            <Icone nome={d.icone} className="size-5" />
            {d.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Passo 3: ligar na `MolduraApp`** — trocar o `<div>` de retorno

```tsx
  return (
    <>
      <TrilhoLateral />
      <div
        className={`mx-auto min-h-dvh ${LARGURA_CONTEUDO} ${OFFSET_TRILHO} px-4 pt-5 print:max-w-full print:px-0 print:pb-0 print:pt-0 ${
          fabVisivel ? FOLGA_COM_FAB : FOLGA_SEM_FAB
        }`}
      >
        {children}
      </div>
    </>
  )
```
Acrescentar aos imports: `import { TrilhoLateral } from "./trilho-lateral"` e
`LARGURA_CONTEUDO, OFFSET_TRILHO` no import de `superficies`.

- [ ] **Passo 4: esconder a bottom-nav no desktop** — em
  `web/components/bottom-nav.tsx`, acrescentar `lg:hidden` ao `<nav>`:

```tsx
    <nav className="no-imprimir fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/95 backdrop-blur lg:hidden">
```

- [ ] **Passo 5: verificar e commitar**

```bash
cd web && npx tsc --noEmit && npm test && npm run lint
git add web/components/moldura-app.tsx web/components/trilho-lateral.tsx web/components/bottom-nav.tsx web/lib/ui/superficies.ts
git commit -m "feat(casca): o app deixa de ser uma coluna de 430px em qualquer tela"
```

---

## Tarefa 4 — Diário no menu de baixo

**Arquivos:** modificar `web/components/bottom-nav.tsx`

- [ ] **Passo 1: trocar a aba** — substituir o objeto de `/comandantes`

```tsx
  {
    // Onda 57 — Comandantes sai, Diário entra. A troca é UMA só, de
    // propósito: "Avisos" fica, porque é o único indicador de alerta
    // crítico presente em toda tela (o app não tem barra superior, ver
    // onda 44) e tirá-lo apagaria o aviso de seguro vencido de todo lugar.
    //
    // O PRD chama o Diário de coração do app e ele era um ícone num grid
    // de cinco atalhos. De brinde, conserta o defeito tipográfico
    // documentado abaixo: "Comandantes" não cabia em 11px e precisou da
    // exceção de 9.5px — "Diário" cabe.
    //
    // Comandantes continua alcançável pelo Menu e pela RedeNav.
    href: "/diario",
    rotulo: "Diário",
    icone: "relatorio",
  },
```

- [ ] **Passo 2: remover a exceção de 9.5px**, se ela existir no arquivo, e
  atualizar o comentário grande que a justificava — ele agora está errado.

- [ ] **Passo 3: verificar e commitar**

```bash
cd web && npx tsc --noEmit && npm test
git add web/components/bottom-nav.tsx
git commit -m "feat(nav): Diario entra no menu de baixo no lugar de Comandantes"
```

---

## Tarefa 5 — Início recomposta

**Consome:** `Cartao`, `Kpi`, `Selo` (Tarefa 2); a casca (Tarefa 3).
**Arquivos:** modificar `web/app/(app)/hoje/page.tsx`

- [ ] **Passo 1: montar o esqueleto da tela com os componentes novos.**
  Ordem no celular: foto → estado → atenção → Diário → motores → gastos. No
  desktop, os mesmos blocos numa grade de 3 colunas.

```tsx
<main className="lg:grid lg:grid-cols-3 lg:gap-6">
  {/* A foto do dono é o assunto da tela — a única emoção, e a decisão
      assumida do redesign. Linha inteira no celular, duas colunas no desktop. */}
  <CardEmbarcacao className="lg:col-span-2" embarcacao={embarcacao} urlCapa={urlCapa} />

  <Cartao className="mt-3 lg:mt-0" titulo="Saúde da embarcação">
    <div className="flex items-center gap-3">
      <Selo estado={seloDaSaude(saude.estado)} />
      <p className="corpo font-medium">{ROTULO_ESTADO_SAUDE[saude.estado]}</p>
    </div>
    <p className="apoio mt-1 text-dim">{resumoDosFatores(saude.fatores)}</p>
  </Cartao>

  <Cartao icone="alerta" titulo="Precisa da sua atenção" className="lg:col-span-2"
          acao={<Link href="/barco/saude" className="apoio text-dim">Ver tudo</Link>}>
    {/* LinhaLista ja existe e ja esta em 27 arquivos — nao reescrever aqui */}
    {alertas.slice(0, 3).map((a) => (
      <LinhaLista key={a.item.id} leading={<Farol status={a.r.status} />}
                  titulo={a.onde} subtitulo={textoRestante(a.r)} />
    ))}
  </Cartao>

  {/* O Diario e o coracao do app (PRD §6) e era um icone num grid de cinco.
      Vira cartao com a acao principal — um dos DOIS usos de dourado da tela. */}
  <Cartao icone="relatorio" titulo="Diário de Bordo">
    <p className="corpo">{ultimaSaida ? textoUltimaSaida(ultimaSaida) : "Nenhuma saída registrada ainda."}</p>
    <Link href="/diario/novo"
          className="mt-3 flex min-h-11 items-center justify-center rounded-[var(--raio-controle)] bg-accent font-semibold text-acao-texto">
      Registrar saída
    </Link>
  </Cartao>

  <Cartao icone="motor" titulo="Motores">
    <div className="grid grid-cols-2 gap-3">
      {motores.map((m) => (
        <Kpi key={m.id} rotulo={`Motor ${m.posicao ?? ""}`.trim()}
             valor={horasDoMotor(m)} apoio={apoioDaRevisao(m)} />
      ))}
    </div>
  </Cartao>

  <Cartao icone="cifrao" titulo="Gastos do mês" className="lg:col-span-2">
    <Kpi rotulo="Total" valor={formatarReais(totalMes)} apoio={variacaoTexto} />
    <GraficoMesesGastos meses={mesesGastos} />
  </Cartao>
</main>
```

Os auxiliares (`seloDaSaude`, `resumoDosFatores`, `horasDoMotor`,
`apoioDaRevisao`, `textoUltimaSaida`) são funções puras de apresentação: crie em
`web/lib/domain/inicio.ts` com teste, em vez de expressão solta no JSX.

- [ ] **Passo 2: o cartão do Diário recebe a ação principal** — é um dos dois
  usos permitidos do dourado na tela. O outro é o botão de subir foto quando
  não há foto de capa.

- [ ] **Passo 3: conferir a regra do acento**

```bash
cd web && grep -o "bg-accent\|text-acao\|accent-forte" "app/(app)/hoje/page.tsx" | wc -l
```
Esperado: **2**. Mais que isso, o dourado virou confete — ver `docs/DESIGN.md §2.4`.

- [ ] **Passo 4: verificar e commitar**

```bash
cd web && npx tsc --noEmit && npm test && npm run lint
git add "web/app/(app)/hoje/page.tsx"
git commit -m "feat(inicio): a foto do barco do dono vira o assunto da tela"
```

---

## Tarefa 6 — Verificação

**Arquivos:** modificar `web/e2e/varredura-mobile.spec.ts`; criar
`web/lib/ui/tokens.test.ts`

- [ ] **Passo 1: varrer também em desktop.** Em `varredura-mobile.spec.ts`,
  transformar o teste único em um `for` sobre dois tamanhos, com o nome do
  arquivo de saída incluindo a largura:

```ts
const TAMANHOS = [
  { nome: "celular", largura: 390, altura: 844 },
  { nome: "desktop", largura: 1440, altura: 900 },
]
```

- [ ] **Passo 2: criar `web/lib/ui/tokens.test.ts`**

Vitest, não Playwright: é leitura de arquivo, não precisa de navegador — e assim
roda no pre-commit junto com o resto, que é onde a deriva precisa ser barrada.

```ts
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { globSync } from "node:fs"

/**
 * Teto de cor literal. Hoje são 95 ocorrências de `#rrggbb` em `.tsx` — a
 * medida exata da deriva que fez o app parecer inconsistente. O teto SÓ
 * DESCE: não trava a fundação enquanto impede a deriva de crescer.
 *
 * Quando chegar a zero, troque o teto por 0 e apague este comentário.
 */
const TETO = 95

describe("tokens", () => {
  it("cor literal em .tsx nao aumenta", () => {
    const arquivos = globSync("{app,components}/**/*.tsx")
    const total = arquivos.reduce((soma, arquivo) => {
      const achados = readFileSync(arquivo, "utf-8").match(/#[0-9a-fA-F]{6}\b/g)
      return soma + (achados?.length ?? 0)
    }, 0)
    expect(total).toBeLessThanOrEqual(TETO)
  })
})
```

- [ ] **Passo 3: rodar a varredura e comparar com o relatório de 15/08**

```bash
cd web && E2E_PORT=3000 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/varredura-mobile.spec.ts --reporter=line
```
Esperado: nenhuma tela SEM SAÍDA; sobreposição em `/hoje` igual a **0**;
desktop sem estouro horizontal.

- [ ] **Passo 4: build e commit final**

```bash
cd web && npm run build
git add web/e2e/varredura-mobile.spec.ts web/lib/ui/tokens.test.ts
git commit -m "test: varredura em desktop e teto de cor literal"
```

---

## O que este plano NÃO faz

- **Não toca nas outras 108 telas.** Elas herdam tokens e componentes; o que
  ficar torto vira onda própria, com a varredura apontando.
- **Não constrói o Mapa da Embarcação.** Spec próprio, depois desta fundação.
- **Não mexe em regra de negócio, RLS ou migration.**
- **Não troca a fonte.** Urbanist fica; Georgia foi descartada no spec.
- **Não constrói `Abas` nem `BarraFerramentas`**, dois dos oito componentes do
  spec. A Início não usa nenhum dos dois, e componente sem consumidor nasce
  torto — acerta por acaso a primeira tela que o adotar. Eles vêm junto com a
  primeira tela de detalhe e a primeira tela de lista a serem refeitas.

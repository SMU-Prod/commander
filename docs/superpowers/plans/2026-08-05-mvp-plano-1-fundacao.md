# GestNav MVP — Plano 1: Fundação e núcleo de gestão

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Next.js funcionando com login, onboarding da embarcação, ficha por sistemas com semáforo calculado, Registro Rápido de horas e tela Hoje com alertas — o núcleo de gestão da espec (§4–§6).

**Architecture:** Next.js App Router (server components + server actions, sem API REST própria) sobre Supabase (Postgres + Auth + RLS). Toda a lógica de vencimento vive em funções puras em `lib/domain/` (testadas com Vitest); o banco guarda fatos, nunca status. UI mobile-first com Tailwind v4 usando os tokens do protótipo aprovado ("cockpit noturno").

**Tech Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), Vitest. Deploy alvo é Cloudflare via OpenNext (Plano 6); neste plano roda-se local com `npm run dev`.

## Sequência de planos do MVP

Este é o **Plano 1 de 6**. Os seguintes serão escritos ao fim de cada etapa, com o código real como contexto:

1. **Fundação e núcleo de gestão** (este plano)
2. Diário de Bordo completo + Documentos (upload/validade) + Contatos
3. Alertas (agendamento + Web Push + e-mail Resend) + PWA instalável
4. GPS Tier 0 (trilha pelo celular, boletim do mar Open-Meteo, mapa)
5. Rede (vitrine de comandantes) + convite CMDT com níveis de acesso
6. Assinatura Stripe + deploy Cloudflare + produção

## Global Constraints

- Todo texto de UI em PT-BR; controles dizem o que fazem ("Salvar no diário", não "Enviar").
- Semáforo é **sempre calculado**, nunca gravado: "🟡 Atenção — dentro da margem (documentos: 30 dias; horas: 15% do intervalo)" (espec §4.1, copiar exatamente estas margens).
- Custo zero: apenas free tiers (Supabase Free), nenhuma dependência paga.
- Mobile-first: conteúdo em coluna única `max-w-[430px] mx-auto`; desktop é bônus.
- RLS habilitada em TODA tabela desde a migration inicial — nunca `USING (true)`.
- Paleta e tipografia: tokens do protótipo aprovado (definidos na Task 1), dígitos de horímetro sempre `font-mono-instr` com `tabular-nums`.
- Server components por padrão; `"use client"` só onde há interação (formulários, sheet).

---

## Estrutura de arquivos (mapa do plano)

```
C:\Users\erick\GEST-NAV\
├─ docs\...                          (specs e planos — já existe)
└─ web\                              (app Next.js — criado na Task 1)
   ├─ app\
   │  ├─ layout.tsx                  raiz: fundo ink, lang pt-BR
   │  ├─ globals.css                 tokens do cockpit
   │  ├─ (auth)\login\page.tsx       login/cadastro
   │  ├─ (app)\layout.tsx            shell autenticado + BottomNav
   │  ├─ (app)\hoje\page.tsx         tela Hoje (Task 8)
   │  ├─ (app)\barco\page.tsx        hub de sistemas (Task 6)
   │  ├─ (app)\barco\equipamento\[id]\page.tsx  detalhe motor (Task 6)
   │  ├─ (app)\diario\page.tsx       stub (Plano 2)
   │  ├─ (app)\rede\page.tsx         stub (Plano 5)
   │  └─ onboarding\page.tsx         wizard 3 passos (Task 5)
   ├─ components\
   │  ├─ bottom-nav.tsx              navegação inferior
   │  ├─ farol.tsx                   bolinha de status
   │  ├─ horimetro.tsx               mostrador de horas
   │  └─ registro-rapido.tsx         sheet do Registro Rápido (Task 7)
   ├─ lib\
   │  ├─ domain\semaforo.ts          cálculo de vencimento (puro)
   │  ├─ domain\semaforo.test.ts
   │  ├─ domain\leituras.ts          validação de leitura de horas (puro)
   │  ├─ domain\leituras.test.ts
   │  ├─ db\types.ts                 interfaces das linhas do banco
   │  ├─ supabase\client.ts          browser client
   │  ├─ supabase\server.ts          server client (cookies)
   │  └─ acoes\                      server actions
   │     ├─ onboarding.ts
   │     └─ registro.ts
   ├─ middleware.ts                  refresh de sessão
   └─ vitest.config.ts
```

---

### Task 1: Scaffold do projeto + tokens do cockpit

**Files:**
- Create: `web/` (via create-next-app), `web/vitest.config.ts`, `web/app/globals.css` (substituir), `web/app/layout.tsx` (substituir), `web/components/bottom-nav.tsx`, `web/app/(app)/layout.tsx`, `web/app/(app)/hoje/page.tsx`, `web/app/(app)/barco/page.tsx`, `web/app/(app)/diario/page.tsx`, `web/app/(app)/rede/page.tsx`

**Interfaces:**
- Produces: tokens CSS (`--color-ink`, `--color-panel`, `--color-panel2`, `--color-line`, `--color-texto`, `--color-dim`, `--color-ok`, `--color-warn`, `--color-crit`, `--color-accent`, `--font-mono-instr`) usados como classes Tailwind (`bg-ink`, `text-dim`, `font-mono-instr`, etc.) por todas as tasks seguintes; `<BottomNav />` fixo no shell autenticado.

- [ ] **Step 1: Criar o app Next.js**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
npx create-next-app@latest web --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

Aceitar defaults se perguntar algo a mais (Turbopack: sim).

- [ ] **Step 2: Instalar e configurar Vitest**

```powershell
Set-Location "C:\Users\erick\GEST-NAV\web"
npm install -D vitest
```

Criar `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { include: ["lib/**/*.test.ts"] },
})
```

Em `web/package.json`, adicionar em `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 3: Tokens do cockpit em `globals.css`**

Substituir o conteúdo de `web/app/globals.css` por:

```css
@import "tailwindcss";

@theme {
  --color-ink: #0a1420;
  --color-panel: #101d2c;
  --color-panel2: #152638;
  --color-line: #1e3550;
  --color-texto: #e9f1f8;
  --color-dim: #7c93ab;
  --color-ok: #2fd07a;
  --color-warn: #ffb020;
  --color-crit: #ff5c5c;
  --color-accent: #56b8e8;
  --font-mono-instr: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, Menlo, monospace;
}

body {
  background: var(--color-ink);
  color: var(--color-texto);
}
```

- [ ] **Step 4: Layout raiz**

Substituir `web/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "GestNav",
  description: "Gestão da sua embarcação",
}

export const viewport: Viewport = { themeColor: "#0a1420" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: BottomNav e shell autenticado**

Criar `web/components/bottom-nav.tsx`:

```tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const abas = [
  { href: "/hoje", rotulo: "Hoje" },
  { href: "/barco", rotulo: "Barco" },
  { href: "/diario", rotulo: "Diário" },
  { href: "/rede", rotulo: "Rede" },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[430px]">
        {abas.map((a) => {
          const ativa = pathname.startsWith(a.href)
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`flex-1 py-3 text-center font-mono-instr text-[11px] uppercase tracking-widest ${
                ativa ? "text-accent" : "text-dim"
              }`}
            >
              {a.rotulo}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

Criar `web/app/(app)/layout.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] px-4 pb-24 pt-5">
      {children}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 6: Páginas stub das 4 abas**

Criar `web/app/(app)/hoje/page.tsx` (será substituída na Task 8):

```tsx
export default function HojePage() {
  return <p className="text-dim">Carregando o estado do barco…</p>
}
```

Criar `web/app/(app)/barco/page.tsx` (será substituída na Task 6):

```tsx
export default function BarcoPage() {
  return <p className="text-dim">Ficha da embarcação…</p>
}
```

Criar `web/app/(app)/diario/page.tsx`:

```tsx
export default function DiarioPage() {
  return (
    <div className="pt-10 text-center">
      <h1 className="text-lg font-semibold">Diário de Bordo</h1>
      <p className="mt-2 text-sm text-dim">
        A linha do tempo completa da embarcação chega na próxima etapa.
      </p>
    </div>
  )
}
```

Criar `web/app/(app)/rede/page.tsx`:

```tsx
export default function RedePage() {
  return (
    <div className="pt-10 text-center">
      <h1 className="text-lg font-semibold">Rede</h1>
      <p className="mt-2 text-sm text-dim">
        Contatos do barco e comandantes disponíveis chegam em etapa futura.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Verificar build e dev**

```powershell
npm run build
```

Expected: build verde, rotas `/hoje`, `/barco`, `/diario`, `/rede` listadas.

- [ ] **Step 8: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: scaffold Next.js com tokens do cockpit e navegacao inferior"
```

---

### Task 2: Domínio — cálculo do semáforo (TDD) + componentes Farol e Horímetro

**Files:**
- Create: `web/lib/domain/semaforo.ts`, `web/lib/domain/semaforo.test.ts`, `web/components/farol.tsx`, `web/components/horimetro.tsx`

**Interfaces:**
- Produces:
  - `type StatusFarol = "ok" | "atencao" | "vencido"`
  - `interface ItemCalc { intervaloHoras: number | null; intervaloMeses: number | null; dataFixa: string | null; ultimoCicloData: string | null; ultimoCicloHoras: number | null }`
  - `interface ResultadoCalc { status: StatusFarol; horasRestantes: number | null; diasRestantes: number | null }`
  - `calcularSemaforo(item: ItemCalc, horasAtuais: number | null, hoje: string): ResultadoCalc` — `hoje` e datas em ISO `yyyy-mm-dd`.
  - `<Farol status={StatusFarol} />` e `<Horimetro rotulo={string} horas={number} status={StatusFarol} grande?={boolean} />`

- [ ] **Step 1: Escrever os testes que falham**

Criar `web/lib/domain/semaforo.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { calcularSemaforo } from "./semaforo"

const HOJE = "2026-08-05"

describe("por horas", () => {
  // Exemplo da espec: motor BB a 1.503 h, revisão a cada 500 h, última a 1.000 h
  it("vencido quando passou do limite", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 500, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1000 },
      1503.4,
      HOJE,
    )
    expect(r.status).toBe("vencido")
    expect(r.horasRestantes).toBeCloseTo(-3.4)
  })

  // Exemplo da espec: óleo BE, 250 h de intervalo, faltam 37 h (margem = 15% de 250 = 37,5)
  it("atenção dentro da margem de 15% do intervalo", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 250, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1276 },
      1489,
      HOJE,
    )
    expect(r.status).toBe("atencao")
    expect(r.horasRestantes).toBe(37)
  })

  it("ok quando a folga é maior que a margem", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 500, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1000 },
      1100,
      HOJE,
    )
    expect(r.status).toBe("ok")
    expect(r.horasRestantes).toBe(400)
  })

  it("sem leitura de horas atuais, não avalia por horas", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 500, intervaloMeses: null, dataFixa: null, ultimoCicloData: null, ultimoCicloHoras: 1000 },
      null,
      HOJE,
    )
    expect(r.status).toBe("ok")
    expect(r.horasRestantes).toBeNull()
  })
})

describe("por data", () => {
  it("atenção a 30 dias ou menos do vencimento (data fixa)", () => {
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: null, dataFixa: "2026-08-17", ultimoCicloData: null, ultimoCicloHoras: null },
      null,
      HOJE,
    )
    expect(r.status).toBe("atencao")
    expect(r.diasRestantes).toBe(12)
  })

  it("vencido no dia seguinte ao vencimento", () => {
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: null, dataFixa: "2026-08-04", ultimoCicloData: null, ultimoCicloHoras: null },
      null,
      HOJE,
    )
    expect(r.status).toBe("vencido")
    expect(r.diasRestantes).toBe(-1)
  })

  it("intervalo em meses conta a partir do último ciclo", () => {
    // antifouling: aplicado 2025-06-10, a cada 18 meses → vence 2026-12-10
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: 18, dataFixa: null, ultimoCicloData: "2025-06-10", ultimoCicloHoras: null },
      null,
      HOJE,
    )
    expect(r.status).toBe("ok")
    expect(r.diasRestantes).toBe(127)
  })

  it("soma de meses respeita fim de mês", () => {
    // 31/jan + 1 mês → 28/fev (não 2-3/mar)
    const r = calcularSemaforo(
      { intervaloHoras: null, intervaloMeses: 1, dataFixa: null, ultimoCicloData: "2026-01-31", ultimoCicloHoras: null },
      null,
      "2026-02-28",
    )
    expect(r.diasRestantes).toBe(0)
    expect(r.status).toBe("atencao")
  })
})

describe("combinado — o que vencer primeiro manda", () => {
  it("pior status vence: horas ok + data vencida = vencido", () => {
    const r = calcularSemaforo(
      { intervaloHoras: 250, intervaloMeses: 12, dataFixa: null, ultimoCicloData: "2025-06-01", ultimoCicloHoras: 1400 },
      1450,
      HOJE,
    )
    expect(r.status).toBe("vencido") // 12 meses de 2025-06-01 = 2026-06-01, já passou
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

```powershell
Set-Location "C:\Users\erick\GEST-NAV\web"
npm test
```

Expected: FAIL — `Cannot find module './semaforo'` (ou equivalente).

- [ ] **Step 3: Implementar `semaforo.ts`**

Criar `web/lib/domain/semaforo.ts`:

```ts
export type StatusFarol = "ok" | "atencao" | "vencido"

export interface ItemCalc {
  intervaloHoras: number | null
  intervaloMeses: number | null
  dataFixa: string | null
  ultimoCicloData: string | null
  ultimoCicloHoras: number | null
}

export interface ResultadoCalc {
  status: StatusFarol
  horasRestantes: number | null
  diasRestantes: number | null
}

const MARGEM_DIAS = 30 // documentos/datas: atenção a 30 dias (espec §4.1)
const MARGEM_HORAS_PCT = 0.15 // horas: atenção nos últimos 15% do intervalo (espec §4.1)

function paraUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const total = y * 12 + (m - 1) + meses
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const ultimoDia = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, ultimoDia)
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`
}

function diffDias(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000)
}

const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

export function calcularSemaforo(item: ItemCalc, horasAtuais: number | null, hoje: string): ResultadoCalc {
  let statusHoras: StatusFarol | null = null
  let horasRestantes: number | null = null
  if (item.intervaloHoras != null && item.ultimoCicloHoras != null && horasAtuais != null) {
    horasRestantes = item.ultimoCicloHoras + item.intervaloHoras - horasAtuais
    if (horasRestantes < 0) statusHoras = "vencido"
    else if (horasRestantes <= item.intervaloHoras * MARGEM_HORAS_PCT) statusHoras = "atencao"
    else statusHoras = "ok"
  }

  let statusData: StatusFarol | null = null
  let diasRestantes: number | null = null
  const vencimento =
    item.dataFixa ??
    (item.intervaloMeses != null && item.ultimoCicloData != null
      ? somarMeses(item.ultimoCicloData, item.intervaloMeses)
      : null)
  if (vencimento != null) {
    diasRestantes = diffDias(hoje, vencimento)
    if (diasRestantes < 0) statusData = "vencido"
    else if (diasRestantes <= MARGEM_DIAS) statusData = "atencao"
    else statusData = "ok"
  }

  const candidatos = [statusHoras, statusData].filter((s): s is StatusFarol => s != null)
  const status = candidatos.length === 0 ? "ok" : candidatos.sort((a, b) => PESO[b] - PESO[a])[0]
  return { status, horasRestantes, diasRestantes }
}
```

- [ ] **Step 4: Rodar e ver passar**

```powershell
npm test
```

Expected: PASS (9 testes).

- [ ] **Step 5: Componentes Farol e Horímetro**

Criar `web/components/farol.tsx`:

```tsx
import type { StatusFarol } from "@/lib/domain/semaforo"

const COR: Record<StatusFarol, string> = {
  ok: "bg-ok shadow-[0_0_6px_rgba(47,208,122,.7)]",
  atencao: "bg-warn shadow-[0_0_6px_rgba(255,176,32,.7)]",
  vencido: "bg-crit shadow-[0_0_6px_rgba(255,92,92,.7)]",
}

export function Farol({ status }: { status: StatusFarol }) {
  return <span aria-label={status} className={`inline-block size-2 shrink-0 rounded-full ${COR[status]}`} />
}
```

Criar `web/components/horimetro.tsx`:

```tsx
import { Farol } from "@/components/farol"
import type { StatusFarol } from "@/lib/domain/semaforo"

export function Horimetro({
  rotulo,
  horas,
  status,
  grande = false,
}: {
  rotulo: string
  horas: number
  status: StatusFarol
  grande?: boolean
}) {
  const texto = horas.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (
    <div className="rounded-[10px] border border-line bg-[#060d16] px-3 py-2 font-mono-instr tabular-nums">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[.14em] text-dim">
        {rotulo} <Farol status={status} />
      </div>
      <div className={grande ? "text-4xl" : "text-2xl"}>
        {texto} <small className="text-sm text-dim">h</small>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: calculo do semaforo (TDD) + componentes Farol e Horimetro"
```

---

### Task 3: Supabase — projeto, schema, RLS e clientes

**Files:**
- Create: `web/lib/db/types.ts`, `web/lib/supabase/client.ts`, `web/lib/supabase/server.ts`, `web/middleware.ts`, `web/.env.local`
- Migration aplicada no Supabase: `001_nucleo`

**Interfaces:**
- Consumes: —
- Produces:
  - Tabelas `profiles`, `embarcacoes`, `vinculos`, `equipamentos`, `itens_monitorados`, `eventos` com RLS.
  - RPC `criar_embarcacao(p_nome, p_estaleiro, p_modelo, p_ano, p_marina) returns uuid`.
  - `supabaseServer(): Promise<SupabaseClient>` (server) e `supabaseBrowser(): SupabaseClient` (client).
  - Interfaces TS: `Embarcacao`, `Equipamento`, `ItemMonitorado`, `Evento` (campos = colunas, em snake_case).

- [ ] **Step 1: Criar/identificar o projeto Supabase**

Via MCP do Supabase: `list_organizations` → `list_projects`. Se houver vaga no free tier, `create_project` com nome `gestnav` (confirmar custo $0 via `confirm_cost`). **Se as 2 vagas free estiverem ocupadas, PARAR e perguntar ao Erick** qual projeto pausar ou se cria org nova. Anotar `project_id`, URL e anon key (`get_project_url`, `get_publishable_keys`).

- [ ] **Step 2: Aplicar a migration `001_nucleo`**

Via MCP `apply_migration` (name: `001_nucleo`) com o SQL abaixo, completo:

```sql
-- perfis espelham auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  telefone text,
  created_at timestamptz not null default now()
);

create table public.embarcacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  estaleiro text, modelo text, ano int,
  comprimento_m numeric, boca_m numeric, calado_m numeric,
  casco_material text, casco_numero text,
  tie text, capitania text, propulsao text, marina text,
  created_at timestamptz not null default now()
);

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  papel text not null check (papel in ('PROP','CMDT')),
  nivel text not null default 'completo' check (nivel in ('completo','operacional')),
  created_at timestamptz not null default now(),
  unique (usuario_id, embarcacao_id)
);

create table public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  tipo text not null check (tipo in ('motor','gerador','bateria','outro')),
  posicao text check (posicao in ('BB','BE','central')),
  marca text, modelo text, numero_serie text, ano int,
  potencia_hp int, combustivel text,
  horas_atuais numeric,
  ultima_leitura timestamptz,
  created_at timestamptz not null default now()
);

create table public.itens_monitorados (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  equipamento_id uuid references public.equipamentos(id) on delete cascade,
  nome text not null,
  intervalo_horas numeric,
  intervalo_meses int,
  data_fixa date,
  ultimo_ciclo_data date,
  ultimo_ciclo_horas numeric,
  created_at timestamptz not null default now(),
  check (intervalo_horas is not null or intervalo_meses is not null or data_fixa is not null)
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  equipamento_id uuid references public.equipamentos(id) on delete set null,
  item_monitorado_id uuid references public.itens_monitorados(id) on delete set null,
  tipo text not null check (tipo in ('manutencao','abastecimento','navegacao','avaria','docagem','leitura_horas')),
  data date not null default current_date,
  horas_no_momento numeric,
  descricao text,
  custo_centavos bigint,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- perfil criado automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- acesso: quem tem vínculo enxerga a embarcação
create or replace function public.pode_ver_embarcacao(emb uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = auth.uid()
  );
$$;

-- criação atômica embarcação + vínculo PROP (evita brecha de insert)
create or replace function public.criar_embarcacao(
  p_nome text, p_estaleiro text, p_modelo text, p_ano int, p_marina text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.embarcacoes (nome, estaleiro, modelo, ano, marina)
  values (p_nome, p_estaleiro, p_modelo, p_ano, p_marina)
  returning id into v_id;
  insert into public.vinculos (usuario_id, embarcacao_id, papel)
  values (auth.uid(), v_id, 'PROP');
  return v_id;
end $$;

revoke all on function public.criar_embarcacao from public, anon;
grant execute on function public.criar_embarcacao to authenticated;

-- RLS em tudo, sempre
alter table public.profiles enable row level security;
alter table public.embarcacoes enable row level security;
alter table public.vinculos enable row level security;
alter table public.equipamentos enable row level security;
alter table public.itens_monitorados enable row level security;
alter table public.eventos enable row level security;

create policy "proprio perfil: ver" on public.profiles for select using (id = auth.uid());
create policy "proprio perfil: editar" on public.profiles for update using (id = auth.uid());

create policy "embarcacao: ver" on public.embarcacoes for select using (public.pode_ver_embarcacao(id));
create policy "embarcacao: editar" on public.embarcacoes for update using (public.pode_ver_embarcacao(id));

create policy "vinculos: ver os da embarcacao" on public.vinculos for select
  using (usuario_id = auth.uid() or public.pode_ver_embarcacao(embarcacao_id));

create policy "equipamentos: tudo com vinculo" on public.equipamentos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

create policy "itens: tudo com vinculo" on public.itens_monitorados for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

create policy "eventos: tudo com vinculo" on public.eventos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));
```

- [ ] **Step 3: Conferir advisors de segurança**

Via MCP `get_advisors` (type: security). Expected: nenhum aviso de tabela sem RLS.

- [ ] **Step 4: Env, tipos e clientes**

Criar `web/.env.local` (valores do Step 1; conferir que `.gitignore` do create-next-app já cobre `.env*`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

```powershell
npm install @supabase/supabase-js @supabase/ssr
```

Criar `web/lib/db/types.ts`:

```ts
export interface Embarcacao {
  id: string
  nome: string
  estaleiro: string | null
  modelo: string | null
  ano: number | null
  marina: string | null
}

export interface Equipamento {
  id: string
  embarcacao_id: string
  tipo: "motor" | "gerador" | "bateria" | "outro"
  posicao: "BB" | "BE" | "central" | null
  marca: string | null
  modelo: string | null
  horas_atuais: number | null
  ultima_leitura: string | null
}

export interface ItemMonitorado {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  nome: string
  intervalo_horas: number | null
  intervalo_meses: number | null
  data_fixa: string | null
  ultimo_ciclo_data: string | null
  ultimo_ciclo_horas: number | null
}

export interface Evento {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  item_monitorado_id: string | null
  tipo: "manutencao" | "abastecimento" | "navegacao" | "avaria" | "docagem" | "leitura_horas"
  data: string
  horas_no_momento: number | null
  descricao: string | null
  custo_centavos: number | null
}
```

Criar `web/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr"

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

Criar `web/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (todos) => {
          try {
            todos.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {
            // chamado de um server component: o middleware cuida do refresh
          }
        },
      },
    },
  )
}
```

Criar `web/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (todos) => {
          todos.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          todos.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()

  const rotaPublica = request.nextUrl.pathname.startsWith("/login")
  if (!user && !rotaPublica) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webmanifest)$).*)"],
}
```

- [ ] **Step 5: Build de verificação e commit**

```powershell
npm run build
```

Expected: build verde (middleware compila; páginas ainda não usam o banco).

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: schema Supabase com RLS, RPC criar_embarcacao e clientes ssr"
```

---

### Task 4: Autenticação — cadastro, login e sessão

**Files:**
- Create: `web/app/(auth)/login/page.tsx`, `web/lib/acoes/auth.ts`

**Interfaces:**
- Consumes: `supabaseServer()` (Task 3).
- Produces: server actions `entrar(formData: FormData)` e `cadastrar(formData: FormData)` — campos `email`, `senha`, `nome` (só cadastro); redirecionam para `/hoje` em sucesso e para `/login?erro=<msg>` em falha. Action `sair()` para logout.

- [ ] **Step 1: Server actions de auth**

Criar `web/lib/acoes/auth.ts`:

```ts
"use server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

export async function entrar(formData: FormData) {
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
  })
  if (error) redirect(`/login?erro=${encodeURIComponent("E-mail ou senha incorretos")}`)
  redirect("/hoje")
}

export async function cadastrar(formData: FormData) {
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("senha") ?? ""),
    options: { data: { nome: String(formData.get("nome") ?? "") } },
  })
  if (error) redirect(`/login?erro=${encodeURIComponent(error.message)}`)
  redirect("/onboarding")
}

export async function sair() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/login")
}
```

Nota: no dashboard do Supabase (Auth → Providers → Email), desligar "Confirm email" durante o desenvolvimento para o fluxo cadastro→onboarding funcionar sem SMTP. Religar no Plano 6.

- [ ] **Step 2: Página de login/cadastro**

Criar `web/app/(auth)/login/page.tsx`:

```tsx
import { cadastrar, entrar } from "@/lib/acoes/auth"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; modo?: string }>
}) {
  const { erro, modo } = await searchParams
  const cadastro = modo === "cadastro"
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center px-6 pb-16">
      <p className="font-mono-instr text-[11px] uppercase tracking-[.2em] text-accent">GestNav</p>
      <h1 className="mt-2 text-2xl font-semibold">
        {cadastro ? "Crie sua conta" : "Entre na sua conta"}
      </h1>
      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}
      <form action={cadastro ? cadastrar : entrar} className="mt-6 space-y-4">
        {cadastro && (
          <input name="nome" required placeholder="Seu nome" className="w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base" />
        )}
        <input name="email" type="email" required placeholder="E-mail" className="w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base" />
        <input name="senha" type="password" required minLength={8} placeholder="Senha (mín. 8 caracteres)" className="w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base" />
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#04121d]">
          {cadastro ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <a href={cadastro ? "/login" : "/login?modo=cadastro"} className="mt-5 text-center text-sm text-dim">
        {cadastro ? "Já tenho conta — entrar" : "Não tem conta? Criar agora"}
      </a>
    </main>
  )
}
```

- [ ] **Step 3: Verificar o fluxo manualmente**

```powershell
npm run dev
```

No navegador: `/barco` sem sessão redireciona a `/login`; criar conta → cai em `/onboarding` (404 por enquanto — vira página na Task 5); entrar com senha errada mostra o erro.

- [ ] **Step 4: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: cadastro, login e guarda de sessao"
```

---

### Task 5: Onboarding em 3 passos + seeds de itens monitorados

**Files:**
- Create: `web/app/onboarding/page.tsx`, `web/lib/acoes/onboarding.ts`

**Interfaces:**
- Consumes: RPC `criar_embarcacao` (Task 3), tabelas `equipamentos` e `itens_monitorados`.
- Produces: action `concluirOnboarding(formData: FormData)`. Campos do form: `nome`, `estaleiro`, `modelo`, `ano`, `marina`, `qtd_motores` ("1" | "2"), `motor_marca`, `motor_modelo`, `horas_bb`, `horas_be` (se 2), `seguro_validade` (date, opcional), `tie_validade` (date, opcional). Cria embarcação + motores + itens padrão e redireciona para `/hoje`.

- [ ] **Step 1: Server action com os seeds**

Criar `web/lib/acoes/onboarding.ts`:

```ts
"use server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

// Itens padrão por motor (espec §6.1): revisão 500 h, óleo 250 h ou 12 meses
const ITENS_MOTOR = [
  { nome: "Revisão geral", intervalo_horas: 500, intervalo_meses: null },
  { nome: "Troca de óleo e filtros", intervalo_horas: 250, intervalo_meses: 12 },
]

export async function concluirOnboarding(formData: FormData) {
  const supabase = await supabaseServer()
  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const numero = (k: string) => {
    const v = texto(k)
    return v === null ? null : Number(v.replace(",", "."))
  }

  const { data: embarcacaoId, error } = await supabase.rpc("criar_embarcacao", {
    p_nome: texto("nome") ?? "Minha embarcação",
    p_estaleiro: texto("estaleiro"),
    p_modelo: texto("modelo"),
    p_ano: numero("ano"),
    p_marina: texto("marina"),
  })
  if (error || !embarcacaoId) redirect(`/onboarding?erro=${encodeURIComponent("Não foi possível criar a embarcação")}`)

  const doisMotores = texto("qtd_motores") === "2"
  const motores = doisMotores
    ? [
        { posicao: "BB", horas: numero("horas_bb") },
        { posicao: "BE", horas: numero("horas_be") },
      ]
    : [{ posicao: "central", horas: numero("horas_bb") }]

  for (const m of motores) {
    const { data: eq } = await supabase
      .from("equipamentos")
      .insert({
        embarcacao_id: embarcacaoId,
        tipo: "motor",
        posicao: m.posicao,
        marca: texto("motor_marca"),
        modelo: texto("motor_modelo"),
        horas_atuais: m.horas,
        ultima_leitura: m.horas != null ? new Date().toISOString() : null,
      })
      .select("id")
      .single()
    if (eq) {
      await supabase.from("itens_monitorados").insert(
        ITENS_MOTOR.map((i) => ({
          embarcacao_id: embarcacaoId,
          equipamento_id: eq.id,
          nome: i.nome,
          intervalo_horas: i.intervalo_horas,
          intervalo_meses: i.intervalo_meses,
          ultimo_ciclo_horas: m.horas ?? 0,
          ultimo_ciclo_data: new Date().toISOString().slice(0, 10),
        })),
      )
    }
  }

  const documentos = [
    { nome: "Seguro da embarcação", validade: texto("seguro_validade") },
    { nome: "TIE", validade: texto("tie_validade") },
  ].filter((d) => d.validade != null)
  if (documentos.length > 0) {
    await supabase.from("itens_monitorados").insert(
      documentos.map((d) => ({ embarcacao_id: embarcacaoId, nome: d.nome, data_fixa: d.validade })),
    )
  }

  redirect("/hoje")
}
```

- [ ] **Step 2: Página do wizard (3 passos em um form, seções nativas)**

Criar `web/app/onboarding/page.tsx`:

```tsx
import { concluirOnboarding } from "@/lib/acoes/onboarding"

const campo = "w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  return (
    <main className="mx-auto max-w-[430px] px-5 py-8">
      <h1 className="text-2xl font-semibold">Vamos cadastrar seu barco</h1>
      <p className="mt-1 text-sm text-dim">3 passos rápidos. O resto você completa depois, aos poucos.</p>
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={concluirOnboarding} className="mt-6 space-y-8">
        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent">1 · O barco</h2>
          <div className="mt-3 space-y-3">
            <div><label className={rotulo} htmlFor="nome">Nome</label><input id="nome" name="nome" required className={campo} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="estaleiro">Estaleiro</label><input id="estaleiro" name="estaleiro" className={campo} /></div>
              <div><label className={rotulo} htmlFor="modelo">Modelo</label><input id="modelo" name="modelo" className={campo} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="ano">Ano</label><input id="ano" name="ano" inputMode="numeric" className={campo} /></div>
              <div><label className={rotulo} htmlFor="marina">Marina</label><input id="marina" name="marina" className={campo} /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent">2 · Motores</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className={rotulo} htmlFor="qtd_motores">Quantos motores?</label>
              <select id="qtd_motores" name="qtd_motores" defaultValue="2" className={campo}>
                <option value="1">1 motor</option>
                <option value="2">2 motores (BB e BE)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="motor_marca">Marca</label><input id="motor_marca" name="motor_marca" className={campo} /></div>
              <div><label className={rotulo} htmlFor="motor_modelo">Modelo</label><input id="motor_modelo" name="motor_modelo" className={campo} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={rotulo} htmlFor="horas_bb">Horas BB (ou único)</label><input id="horas_bb" name="horas_bb" inputMode="decimal" className={campo} /></div>
              <div><label className={rotulo} htmlFor="horas_be">Horas BE</label><input id="horas_be" name="horas_be" inputMode="decimal" className={campo} /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-mono-instr text-[11px] uppercase tracking-[.18em] text-accent">3 · Vencimentos críticos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><label className={rotulo} htmlFor="seguro_validade">Seguro vence em</label><input id="seguro_validade" name="seguro_validade" type="date" className={campo} /></div>
            <div><label className={rotulo} htmlFor="tie_validade">TIE vence em</label><input id="tie_validade" name="tie_validade" type="date" className={campo} /></div>
          </div>
        </section>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#04121d]">
          Criar meu painel de bordo
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Testar o fluxo completo no dev**

`npm run dev` → criar conta nova → preencher onboarding com 2 motores (BB 1503,4 / BE 1489,1) e seguro para daqui a 12 dias → submeter. Conferir via MCP `execute_sql`:

```sql
select e.nome, count(q.id) as motores, count(i.id) as itens
from embarcacoes e
left join equipamentos q on q.embarcacao_id = e.id
left join itens_monitorados i on i.embarcacao_id = e.id
group by e.nome;
```

Expected: 1 embarcação, 2 motores, 5 itens (2×2 de motor + 1 de seguro).

- [ ] **Step 4: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: onboarding em 3 passos com seeds de itens monitorados"
```

---

### Task 6: Tela Barco (hub de sistemas) + detalhe de equipamento

**Files:**
- Create: `web/lib/consultas.ts`, `web/app/(app)/barco/equipamento/[id]/page.tsx`
- Modify: `web/app/(app)/barco/page.tsx` (substituir o stub da Task 1)

**Interfaces:**
- Consumes: `calcularSemaforo`, `Farol`, `Horimetro` (Task 2); `supabaseServer` (Task 3); tipos de `lib/db/types.ts`.
- Produces: `carregarPainel(): Promise<{ embarcacao: Embarcacao; equipamentos: Equipamento[]; itens: ItemMonitorado[] } | null>` em `lib/consultas.ts` — retorna `null` se o usuário não tem embarcação (páginas redirecionam a `/onboarding`). Usada também pela Task 8.

- [ ] **Step 1: Consulta compartilhada**

Criar `web/lib/consultas.ts`:

```ts
import { supabaseServer } from "@/lib/supabase/server"
import type { Embarcacao, Equipamento, ItemMonitorado } from "@/lib/db/types"

export async function carregarPainel(): Promise<{
  embarcacao: Embarcacao
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
} | null> {
  const supabase = await supabaseServer()
  const { data: embarcacao } = await supabase
    .from("embarcacoes")
    .select("id, nome, estaleiro, modelo, ano, marina")
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!embarcacao) return null

  const [{ data: equipamentos }, { data: itens }] = await Promise.all([
    supabase.from("equipamentos").select("*").eq("embarcacao_id", embarcacao.id).order("posicao"),
    supabase.from("itens_monitorados").select("*").eq("embarcacao_id", embarcacao.id),
  ])
  return { embarcacao, equipamentos: equipamentos ?? [], itens: itens ?? [] }
}

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Página Barco**

Substituir `web/app/(app)/barco/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO } from "@/lib/consultas"

const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

export default async function BarcoPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const statusDoEquipamento = (eqId: string): StatusFarol =>
    itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(i, eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const motores = equipamentos.filter((e) => e.tipo === "motor")
  const documentos = itens.filter((i) => i.equipamento_id === null)

  return (
    <main>
      <h1 className="text-xl font-semibold">{embarcacao.nome}</h1>
      <p className="text-sm text-dim">
        {[embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")}
      </p>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Motores</p>
      <div className="grid grid-cols-2 gap-2">
        {motores.map((m) => (
          <Link key={m.id} href={`/barco/equipamento/${m.id}`}>
            <Horimetro
              rotulo={m.posicao ?? "Motor"}
              horas={m.horas_atuais ?? 0}
              status={statusDoEquipamento(m.id)}
            />
          </Link>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Documentos e embarcação</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {documentos.length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum vencimento cadastrado ainda.</p>
        )}
        {documentos.map((i) => {
          const r = calcularSemaforo(i, null, hoje)
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <span className="flex-1 text-sm">{i.nome}</span>
              <span className="font-mono-instr text-xs tabular-nums text-dim">
                {r.diasRestantes != null
                  ? r.diasRestantes < 0
                    ? `vencido há ${-r.diasRestantes} d`
                    : `${r.diasRestantes} dias`
                  : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Detalhe do equipamento**

Criar `web/app/(app)/barco/equipamento/[id]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO } from "@/lib/consultas"

const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

export default async function EquipamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  const equipamento = painel?.equipamentos.find((e) => e.id === id)
  if (!painel || !equipamento) notFound()

  const hoje = hojeISO()
  const itens = painel.itens
    .filter((i) => i.equipamento_id === id)
    .map((i) => ({ item: i, r: calcularSemaforo(i, equipamento.horas_atuais ?? null, hoje) }))
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])
  const statusGeral = itens[0]?.r.status ?? "ok"

  return (
    <main>
      <Link href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent">
        ‹ Barco
      </Link>
      <div className="mt-3">
        <Horimetro
          rotulo={`Motor ${equipamento.posicao ?? ""} — ${[equipamento.marca, equipamento.modelo].filter(Boolean).join(" ")}`}
          horas={equipamento.horas_atuais ?? 0}
          status={statusGeral}
          grande
        />
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Itens monitorados</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {itens.map(({ item, r }) => (
          <div key={item.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <Farol status={r.status} />
            <div className="flex-1">
              <p className="text-sm">{item.nome}</p>
              <p className="text-xs text-dim">
                {item.intervalo_horas != null && `a cada ${item.intervalo_horas} h`}
                {item.intervalo_horas != null && item.intervalo_meses != null && " ou "}
                {item.intervalo_meses != null && `${item.intervalo_meses} meses`}
              </p>
            </div>
            <span className="font-mono-instr text-xs tabular-nums text-dim">
              {r.status === "vencido"
                ? "vencido"
                : r.horasRestantes != null
                  ? `${Math.round(r.horasRestantes)} h`
                  : r.diasRestantes != null
                    ? `${r.diasRestantes} d`
                    : "—"}
            </span>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Verificar no dev com os dados do onboarding**

`npm run dev` → `/barco`: dois horímetros (BB vermelho — revisão vencida se horas > último ciclo + 500; BE conforme dados), seguro listado com dias restantes. Tocar no BB abre o detalhe com itens ordenados por gravidade.

- [ ] **Step 5: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: telas Barco e detalhe de equipamento com semaforo real"
```

---

### Task 7: Registro Rápido (TDD na validação) + eventos

**Files:**
- Create: `web/lib/domain/leituras.ts`, `web/lib/domain/leituras.test.ts`, `web/lib/acoes/registro.ts`, `web/components/registro-rapido.tsx`
- Modify: `web/app/(app)/layout.tsx` (incluir o botão flutuante)

**Interfaces:**
- Consumes: `supabaseServer` (Task 3), `Equipamento` (Task 3).
- Produces:
  - `validarLeitura(nova: number, atual: number | null): { ok: true } | { ok: false; erro: string }`
  - action `registrarVoltaAoMar(formData: FormData)` — campos: `equipamento_<id>` (um por motor, decimal com vírgula ou ponto), `litros` (opcional), `obs` (opcional). Atualiza `horas_atuais`, grava eventos e `revalidatePath("/hoje")` + `/barco`.
  - `<RegistroRapido motores={{ id: string; rotulo: string; horas: number | null }[]} />` — botão flutuante + sheet.

- [ ] **Step 1: Testes da validação**

Criar `web/lib/domain/leituras.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { validarLeitura } from "./leituras"

describe("validarLeitura", () => {
  it("aceita leitura maior que a atual", () => {
    expect(validarLeitura(1510, 1503.4)).toEqual({ ok: true })
  })
  it("aceita igual à atual (saída sem uso de motor)", () => {
    expect(validarLeitura(1503.4, 1503.4)).toEqual({ ok: true })
  })
  it("recusa leitura menor que a atual", () => {
    const r = validarLeitura(1400, 1503.4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toContain("menor")
  })
  it("recusa salto absurdo (mais de 500 h de uma vez)", () => {
    expect(validarLeitura(2100, 1503.4).ok).toBe(false)
  })
  it("aceita primeira leitura quando não há horas atuais", () => {
    expect(validarLeitura(120, null)).toEqual({ ok: true })
  })
  it("recusa valores não positivos ou não numéricos", () => {
    expect(validarLeitura(-5, null).ok).toBe(false)
    expect(validarLeitura(Number.NaN, null).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

`npm test` — Expected: FAIL (`Cannot find module './leituras'`).

- [ ] **Step 3: Implementar**

Criar `web/lib/domain/leituras.ts`:

```ts
const SALTO_MAXIMO_H = 500

export function validarLeitura(
  nova: number,
  atual: number | null,
): { ok: true } | { ok: false; erro: string } {
  if (!Number.isFinite(nova) || nova <= 0) {
    return { ok: false, erro: "Informe um número de horas válido." }
  }
  if (atual != null && nova < atual) {
    return { ok: false, erro: `A leitura (${nova} h) é menor que a atual (${atual} h). Horímetro não anda para trás.` }
  }
  if (atual != null && nova - atual > SALTO_MAXIMO_H) {
    return { ok: false, erro: `Salto de ${Math.round(nova - atual)} h de uma vez — confira a leitura.` }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

`npm test` — Expected: PASS (15 testes no total do projeto).

- [ ] **Step 5: Server action**

Criar `web/lib/acoes/registro.ts`:

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { validarLeitura } from "@/lib/domain/leituras"
import { supabaseServer } from "@/lib/supabase/server"

export async function registrarVoltaAoMar(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, embarcacao_id, horas_atuais")
    .eq("tipo", "motor")
  if (!equipamentos || equipamentos.length === 0) redirect("/onboarding")
  const embarcacaoId = equipamentos[0].embarcacao_id

  for (const eq of equipamentos) {
    const bruto = String(formData.get(`equipamento_${eq.id}`) ?? "").trim()
    if (bruto === "") continue
    const nova = Number(bruto.replace(",", "."))
    const v = validarLeitura(nova, eq.horas_atuais)
    if (!v.ok) redirect(`/hoje?erro=${encodeURIComponent(v.erro)}`)

    await supabase
      .from("equipamentos")
      .update({ horas_atuais: nova, ultima_leitura: new Date().toISOString() })
      .eq("id", eq.id)
    await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      equipamento_id: eq.id,
      tipo: "leitura_horas",
      horas_no_momento: nova,
      criado_por: user.id,
    })
  }

  const litros = String(formData.get("litros") ?? "").trim()
  const obs = String(formData.get("obs") ?? "").trim()
  if (litros !== "" || obs !== "") {
    await supabase.from("eventos").insert({
      embarcacao_id: embarcacaoId,
      tipo: litros !== "" ? "abastecimento" : "navegacao",
      descricao: [obs || null, litros !== "" ? `${litros} L abastecidos` : null].filter(Boolean).join(" · "),
      criado_por: user.id,
    })
  }

  revalidatePath("/hoje")
  revalidatePath("/barco")
  redirect("/hoje")
}
```

- [ ] **Step 6: Sheet do Registro Rápido**

Criar `web/components/registro-rapido.tsx`:

```tsx
"use client"
import { useState } from "react"
import { registrarVoltaAoMar } from "@/lib/acoes/registro"

const campo = "w-full rounded-[10px] border border-line bg-[#0a1521] px-3 py-3 font-mono-instr text-base tabular-nums"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export function RegistroRapido({
  motores,
}: {
  motores: { id: string; rotulo: string; horas: number | null }[]
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-20 right-4 z-20 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-[#04121d] shadow-lg shadow-accent/30"
      >
        + Registrar
      </button>
      {aberto && (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setAberto(false)}
        >
          <div className="w-full rounded-t-[20px] border-t border-line bg-panel px-5 pb-8 pt-5">
            <h2 className="text-lg font-semibold">Registrar volta ao mar</h2>
            <p className="mb-4 text-sm text-dim">30 segundos — é isso que mantém os alertas vivos.</p>
            <form action={registrarVoltaAoMar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {motores.map((m) => (
                  <div key={m.id}>
                    <label className={rotulo} htmlFor={`equipamento_${m.id}`}>Horas {m.rotulo}</label>
                    <input
                      id={`equipamento_${m.id}`}
                      name={`equipamento_${m.id}`}
                      inputMode="decimal"
                      defaultValue={m.horas ?? undefined}
                      className={campo}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className={rotulo} htmlFor="litros">Combustível abastecido (L) — opcional</label>
                <input id="litros" name="litros" inputMode="numeric" className={campo} />
              </div>
              <div>
                <label className={rotulo} htmlFor="obs">Observação — opcional</label>
                <input id="obs" name="obs" placeholder="Ex.: saída às Cagarras" className={campo} />
              </div>
              <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-[#04121d]">
                Salvar no diário
              </button>
              <button type="button" onClick={() => setAberto(false)} className="w-full py-2 text-sm text-dim">
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 7: Montar o botão no shell autenticado**

Substituir `web/app/(app)/layout.tsx`:

```tsx
import { BottomNav } from "@/components/bottom-nav"
import { RegistroRapido } from "@/components/registro-rapido"
import { carregarPainel } from "@/lib/consultas"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const painel = await carregarPainel()
  const motores = (painel?.equipamentos ?? [])
    .filter((e) => e.tipo === "motor")
    .map((e) => ({ id: e.id, rotulo: e.posicao ?? "Motor", horas: e.horas_atuais }))
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] px-4 pb-24 pt-5">
      {children}
      {motores.length > 0 && <RegistroRapido motores={motores} />}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 8: Verificar no dev**

Registrar BB 1504,0 / BE 1490,0 → volta a `/hoje`; `/barco` mostra as horas novas. Tentar registrar 1400 → mensagem de erro de leitura menor. Conferir eventos via MCP `execute_sql`: `select tipo, horas_no_momento from eventos order by created_at desc limit 5;` — Expected: 2 `leitura_horas`.

- [ ] **Step 9: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: registro rapido com validacao de leitura (TDD) e eventos"
```

---

### Task 8: Tela Hoje — alertas e vencimentos

**Files:**
- Modify: `web/app/(app)/hoje/page.tsx` (substituir o stub da Task 1)

**Interfaces:**
- Consumes: `carregarPainel`, `hojeISO` (Task 6); `calcularSemaforo` (Task 2); `Farol`, `Horimetro` (Task 2).
- Produces: — (folha final da UI deste plano).

- [ ] **Step 1: Implementar a página**

Substituir `web/app/(app)/hoje/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { calcularSemaforo, type StatusFarol } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO } from "@/lib/consultas"

const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao, equipamentos, itens } = painel
  const hoje = hojeISO()

  const avaliados = itens
    .map((i) => {
      const eq = equipamentos.find((e) => e.id === i.equipamento_id)
      const r = calcularSemaforo(i, eq?.horas_atuais ?? null, hoje)
      const onde = eq ? `${i.nome} — Motor ${eq.posicao ?? ""}`.trim() : i.nome
      return { item: i, r, onde }
    })
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  const alertas = avaliados.filter((a) => a.r.status !== "ok")
  const contagem = {
    vencido: avaliados.filter((a) => a.r.status === "vencido").length,
    atencao: avaliados.filter((a) => a.r.status === "atencao").length,
    ok: avaliados.filter((a) => a.r.status === "ok").length,
  }
  const motores = equipamentos.filter((e) => e.tipo === "motor")

  const restante = (r: { horasRestantes: number | null; diasRestantes: number | null }) =>
    r.horasRestantes != null && (r.diasRestantes == null || r.horasRestantes >= 0)
      ? r.horasRestantes < 0
        ? `vencido há ${Math.round(-r.horasRestantes)} h`
        : `em ${Math.round(r.horasRestantes)} h`
      : r.diasRestantes != null
        ? r.diasRestantes < 0
          ? `vencido há ${-r.diasRestantes} dias`
          : `em ${r.diasRestantes} dias`
        : ""

  return (
    <main>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">{embarcacao.nome}</h1>
          <p className="text-sm text-dim">{embarcacao.marina ?? "Marina não informada"}</p>
        </div>
        <div className="flex gap-2.5 font-mono-instr text-xs tabular-nums text-dim">
          <span className="flex items-center gap-1"><Farol status="vencido" />{contagem.vencido}</span>
          <span className="flex items-center gap-1"><Farol status="atencao" />{contagem.atencao}</span>
          <span className="flex items-center gap-1"><Farol status="ok" />{contagem.ok}</span>
        </div>
      </header>

      {erro && (
        <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        {alertas.length > 0 ? "Precisa de atenção" : "Tudo em dia"}
      </p>
      {alertas.length === 0 && (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Nenhum vencimento na margem. Bom vento e mar calmo.
        </div>
      )}
      <div className="space-y-2">
        {alertas.map(({ item, r, onde }) => (
          <div key={item.id} className="flex gap-3 rounded-[14px] border border-line bg-panel p-3.5">
            <span className={`w-[3px] shrink-0 self-stretch rounded ${r.status === "vencido" ? "bg-crit" : "bg-warn"}`} />
            <div>
              <p className="text-sm font-semibold">{onde}</p>
              <p className="mt-0.5 text-xs text-dim">{restante(r)}</p>
            </div>
          </div>
        ))}
      </div>

      {motores.length > 0 && (
        <>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Horas de motor</p>
          <div className="grid grid-cols-2 gap-2">
            {motores.map((m) => {
              const status =
                avaliados
                  .filter((a) => a.item.equipamento_id === m.id)
                  .map((a) => a.r.status)
                  .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"
              return <Horimetro key={m.id} rotulo={m.posicao ?? "Motor"} horas={m.horas_atuais ?? 0} status={status} />
            })}
          </div>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verificação final do plano inteiro**

```powershell
npm test
npm run build
```

Expected: 15 testes PASS, build verde. No dev: login → Hoje mostra alerta vermelho da revisão BB, amarelos de óleo BE/seguro, horímetros com as horas do último registro; Registro Rápido atualiza tudo.

- [ ] **Step 3: Commit**

```powershell
Set-Location "C:\Users\erick\GEST-NAV"
git add web
git commit -m "feat: tela Hoje com alertas ordenados por gravidade"
```

---

## Self-review (executado na escrita)

- **Cobertura da espec:** §4.1 Item Monitorado (Tasks 2/3/5), §4.3 Registro Rápido (Task 7), §4.5/§6.1 onboarding curto (Task 5), §5 navegação 4 abas + FAB (Tasks 1/7), §6.2 Hoje (Task 8), §6.3 Barco/detalhe (Task 6). Diário §4.2 grava eventos (Task 7) mas a timeline visual é o Plano 2 — decisão de escopo declarada.
- **Placeholders:** nenhum; stubs de Diário/Rede têm código real de estado vazio.
- **Consistência de tipos:** `calcularSemaforo(item, horasAtuais, hoje)` idêntico nas Tasks 2/6/8; `carregarPainel` definido na Task 6 e consumido na 7 (layout) e 8; nomes de tabela/colunas em snake_case idênticos entre SQL (Task 3) e código.

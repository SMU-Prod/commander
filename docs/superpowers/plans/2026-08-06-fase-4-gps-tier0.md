# Commander Fase 4 — GPS Tier 0: Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GPS de custo zero: posição da marina na ficha, boletim do mar (Open-Meteo) com selo "dá pra sair" na Home, gravação de trilha de navegação pelo celular com painel ao vivo, resumo calculado em domínio puro e carta SVG da trilha no Diário.

**Architecture:** Nada de libs de mapa — a trilha é desenhada em SVG estilo carta náutica (projeção equiretangular no bbox), na assinatura visual do produto. A gravação roda num client component com `watchPosition` + wake lock best-effort e decimação de pontos (≥15 m ou ≥30 s); o salvamento vira um evento `navegacao` com a trilha em jsonb e o resumo (distância/tempos/velocidades) recalculado no servidor pelo MESMO domínio puro. O boletim usa as duas APIs gratuitas do Open-Meteo com cache de 1 h via `fetch { next: { revalidate } }` e degrada com mensagem quando indisponível.

**Tech Stack:** o existente. Nenhuma dependência nova (haversine e projeção implementadas no domínio, testadas).

## Global Constraints

- PT-BR; tokens do tema; dígitos `font-mono-instr tabular-nums`; PWA já existente (a gravação exige HTTPS ou localhost — ok no dev e no deploy).
- Domínio puro em `lib/domain/` com TDD; nenhuma regra duplicada fora dele; unidades: milhas náuticas (nm), nós (kt), horas decimais.
- Open-Meteo: gratuito sem chave (licença comercial fica para a fase 6 — anotar, não bloquear); toda falha de fetch degrada para card "Boletim indisponível" — nunca quebra a Home.
- Coordenadas validadas server-side (lat -90..90, lon -180..180); parse aceita vírgula ou ponto via `parseDecimalPtBr`.
- Trilha: decimação ≥15 m OU ≥30 s; máximo 4000 pontos gravados (estatísticas continuam ao vivo depois do teto); mínimo 2 pontos para salvar.
- Toda escrita captura `error`; helpers de redirect tipados `function ...(): never`; convenção cache() (nunca `carregarPainel` após escrita).

---

## Estrutura de arquivos

```
web/
├─ lib/domain/geo.ts (+ .test.ts)        PontoTrilha, haversineNm, resumoTrilha
├─ lib/domain/mar.ts (+ .test.ts)        avaliarMar (selo ok/atencao/crit)
├─ lib/mar.ts                            boletimDoMar (fetch Open-Meteo, cache 1h)
├─ lib/acoes/local.ts                    salvarLocalMarina
├─ lib/acoes/trilha.ts                   salvarTrilha
├─ components/usar-posicao.tsx           botão de geolocation (client)
├─ components/trilha-svg.tsx             carta SVG da trilha
├─ app/(app)/barco/local/page.tsx        definir posição da marina
├─ app/(app)/navegar/page.tsx            gravação de trilha (client)
├─ app/(app)/diario/trilha/[id]/page.tsx carta + resumo do evento
├─ app/(app)/diario/page.tsx             link "ver trilha" nos eventos com trilha
├─ app/(app)/hoje/page.tsx               card Posição e mar + botão Navegar
└─ lib/db/types.ts                       marina_lat/lon + trilha
```

---

### Task 1: Migration 006 + tipos

**Files:**
- Migration `006_gps_tier0` via MCP (conector `mcp__6dcbebfb-...`, projeto `khgjtxvmduizyooqaoox`)
- Create: `supabase/migrations/006_gps_tier0.sql` (mesmo SQL, versionado)
- Modify: `web/lib/db/types.ts`

**Interfaces:**
- Produces: colunas `embarcacoes.marina_lat/marina_lon` (double precision) e `eventos.trilha` (jsonb); tipos atualizados `Embarcacao { ...; marina_lat: number | null; marina_lon: number | null }` e `Evento { ...; trilha: PontoTrilhaDb[] | null }` com `interface PontoTrilhaDb { t: number; la: number; lo: number }` exportada de `types.ts`.

- [ ] **Step 1: aplicar migration `006_gps_tier0`** (e gravar o MESMO SQL em `supabase/migrations/006_gps_tier0.sql`):

```sql
alter table public.embarcacoes add column marina_lat double precision;
alter table public.embarcacoes add column marina_lon double precision;
alter table public.eventos add column trilha jsonb;
```

- [ ] **Step 2: tipos** — em `web/lib/db/types.ts`: adicionar a `Embarcacao` os campos `marina_lat: number | null` e `marina_lon: number | null` (depois de `marina`); adicionar antes de `Evento`:

```ts
export interface PontoTrilhaDb {
  t: number
  la: number
  lo: number
}
```

e a `Evento` o campo `trilha: PontoTrilhaDb[] | null` (depois de `anexo_path`).

- [ ] **Step 3:** `npm test` 53/53, `npm run build` verde. Commit: `git add web supabase; git commit -m "feat: migration gps tier0 - posicao da marina e trilha"`

---

### Task 2: Domínio — geo e mar (TDD)

**Files:**
- Create: `web/lib/domain/geo.ts`, `web/lib/domain/geo.test.ts`, `web/lib/domain/mar.ts`, `web/lib/domain/mar.test.ts`

**Interfaces:**
- Produces:
  - `interface PontoTrilha { t: number; la: number; lo: number }` (t em segundos epoch)
  - `haversineNm(a: { la: number; lo: number }, b: { la: number; lo: number }): number`
  - `interface ResumoTrilha { distanciaNm: number; duracaoH: number; tempoMovimentoH: number; velMediaKt: number; velMaxKt: number }`
  - `resumoTrilha(pontos: PontoTrilha[]): ResumoTrilha` (movimento = segmentos acima de 2 kt; velMedia = distância total / tempo em movimento; lista vazia/1 ponto → tudo zero)
  - `interface SeloMar { nivel: "ok" | "atencao" | "crit"; rotulo: string }`
  - `avaliarMar(ondaM: number | null, ventoKt: number | null): SeloMar`

- [ ] **Step 1: testes primeiro** — `web/lib/domain/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { haversineNm, resumoTrilha } from "./geo"

describe("haversineNm", () => {
  it("1 minuto de latitude ≈ 1 milha náutica", () => {
    expect(haversineNm({ la: 0, lo: 0 }, { la: 1 / 60, lo: 0 })).toBeCloseTo(1, 2)
  })
  it("mesmo ponto = 0", () => {
    expect(haversineNm({ la: -22.9, lo: -43.1 }, { la: -22.9, lo: -43.1 })).toBe(0)
  })
})

describe("resumoTrilha", () => {
  it("trilha vazia ou de 1 ponto zera tudo", () => {
    expect(resumoTrilha([])).toEqual({ distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 })
    expect(resumoTrilha([{ t: 0, la: 0, lo: 0 }]).duracaoH).toBe(0)
  })
  it("1h navegando a 6 kt + 1h parado", () => {
    const r = resumoTrilha([
      { t: 0, la: 0, lo: 0 },
      { t: 3600, la: 0.1, lo: 0 },   // 6 nm em 1 h → 6 kt
      { t: 7200, la: 0.1, lo: 0 },   // parado 1 h
    ])
    expect(r.distanciaNm).toBeCloseTo(6, 1)
    expect(r.duracaoH).toBeCloseTo(2, 5)
    expect(r.tempoMovimentoH).toBeCloseTo(1, 5)
    expect(r.velMediaKt).toBeCloseTo(6, 1)
    expect(r.velMaxKt).toBeCloseTo(6, 1)
  })
  it("velMaxKt pega o segmento mais rápido", () => {
    const r = resumoTrilha([
      { t: 0, la: 0, lo: 0 },
      { t: 1800, la: 0.05, lo: 0 },  // 3 nm em 0,5 h → 6 kt
      { t: 3600, la: 0.15, lo: 0 },  // 6 nm em 0,5 h → 12 kt
    ])
    expect(r.velMaxKt).toBeCloseTo(12, 1)
    expect(r.velMediaKt).toBeCloseTo(9, 1)
  })
})
```

`web/lib/domain/mar.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { avaliarMar } from "./mar"

describe("avaliarMar", () => {
  it("mar calmo e vento fraco liberam", () => {
    expect(avaliarMar(0.8, 12)).toEqual({ nivel: "ok", rotulo: "Bom pra sair" })
  })
  it("onda ou vento medianos pedem atenção", () => {
    expect(avaliarMar(1.5, 12).nivel).toBe("atencao")
    expect(avaliarMar(0.8, 20).nivel).toBe("atencao")
    expect(avaliarMar(1.5, 20).rotulo).toBe("Atenção no mar")
  })
  it("mar pesado bloqueia", () => {
    expect(avaliarMar(2.2, 12)).toEqual({ nivel: "crit", rotulo: "Mar pesado" })
    expect(avaliarMar(1.0, 28).nivel).toBe("crit")
  })
  it("sem nenhum dado, informa", () => {
    expect(avaliarMar(null, null)).toEqual({ nivel: "atencao", rotulo: "Sem dados do mar" })
  })
  it("dado parcial avalia com o que tem", () => {
    expect(avaliarMar(0.5, null).nivel).toBe("ok")
    expect(avaliarMar(null, 30).nivel).toBe("crit")
  })
})
```

- [ ] **Step 2:** `npm test` → FAIL (módulos inexistentes).

- [ ] **Step 3: implementar** — `web/lib/domain/geo.ts`:

```ts
export interface PontoTrilha {
  t: number
  la: number
  lo: number
}

const RAIO_TERRA_NM = 3440.065
const LIMIAR_MOVIMENTO_KT = 2

export function haversineNm(a: { la: number; lo: number }, b: { la: number; lo: number }): number {
  const rad = Math.PI / 180
  const dLa = (b.la - a.la) * rad
  const dLo = (b.lo - a.lo) * rad
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(a.la * rad) * Math.cos(b.la * rad) * Math.sin(dLo / 2) ** 2
  return 2 * RAIO_TERRA_NM * Math.asin(Math.sqrt(h))
}

export interface ResumoTrilha {
  distanciaNm: number
  duracaoH: number
  tempoMovimentoH: number
  velMediaKt: number
  velMaxKt: number
}

export function resumoTrilha(pontos: PontoTrilha[]): ResumoTrilha {
  if (pontos.length < 2) {
    return { distanciaNm: 0, duracaoH: 0, tempoMovimentoH: 0, velMediaKt: 0, velMaxKt: 0 }
  }
  let distanciaNm = 0
  let tempoMovimentoH = 0
  let velMaxKt = 0
  for (let i = 1; i < pontos.length; i++) {
    const dNm = haversineNm(pontos[i - 1], pontos[i])
    const dtH = (pontos[i].t - pontos[i - 1].t) / 3600
    if (dtH <= 0) continue
    const vKt = dNm / dtH
    distanciaNm += dNm
    if (vKt > LIMIAR_MOVIMENTO_KT) {
      tempoMovimentoH += dtH
      if (vKt > velMaxKt) velMaxKt = vKt
    }
  }
  const duracaoH = (pontos[pontos.length - 1].t - pontos[0].t) / 3600
  const velMediaKt = tempoMovimentoH > 0 ? distanciaNm / tempoMovimentoH : 0
  return { distanciaNm, duracaoH, tempoMovimentoH, velMediaKt, velMaxKt }
}
```

`web/lib/domain/mar.ts`:

```ts
export interface SeloMar {
  nivel: "ok" | "atencao" | "crit"
  rotulo: string
}

const ONDA_OK_M = 1.0
const ONDA_ATENCAO_M = 1.8
const VENTO_OK_KT = 15
const VENTO_ATENCAO_KT = 22

export function avaliarMar(ondaM: number | null, ventoKt: number | null): SeloMar {
  if (ondaM === null && ventoKt === null) return { nivel: "atencao", rotulo: "Sem dados do mar" }
  const ondaCrit = ondaM !== null && ondaM > ONDA_ATENCAO_M
  const ventoCrit = ventoKt !== null && ventoKt > VENTO_ATENCAO_KT
  if (ondaCrit || ventoCrit) return { nivel: "crit", rotulo: "Mar pesado" }
  const ondaAtencao = ondaM !== null && ondaM > ONDA_OK_M
  const ventoAtencao = ventoKt !== null && ventoKt > VENTO_OK_KT
  if (ondaAtencao || ventoAtencao) return { nivel: "atencao", rotulo: "Atenção no mar" }
  return { nivel: "ok", rotulo: "Bom pra sair" }
}
```

- [ ] **Step 4:** `npm test` → 63/63 PASS (53 + 10).
- [ ] **Step 5: Commit:** `git add web; git commit -m "feat: dominio de trilha (haversine, resumo) e avaliacao do mar (TDD)"`

---

### Task 3: Posição da marina — página + action + geolocation

**Files:**
- Create: `web/lib/acoes/local.ts`, `web/components/usar-posicao.tsx`, `web/app/(app)/barco/local/page.tsx`
- Modify: `web/app/(app)/barco/page.tsx` (linha de acesso na seção "Dados gerais"… ver Step 3)

**Interfaces:**
- Consumes: `carregarPainel`, `parseDecimalPtBr`, `supabaseServer`.
- Produces: action `salvarLocalMarina(formData)` — campos `lat`, `lon` (aceita vírgula/ponto); valida ranges; sucesso → `/hoje`. Componente `<UsarPosicao />` que preenche os inputs `#lat`/`#lon` com a posição do navegador.

- [ ] **Step 1: `web/lib/acoes/local.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

function erroLocal(msg: string): never {
  redirect(`/barco/local?erro=${encodeURIComponent(msg)}`)
}

export async function salvarLocalMarina(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const lat = parseDecimalPtBr(String(formData.get("lat") ?? ""))
  const lon = parseDecimalPtBr(String(formData.get("lon") ?? ""))
  if (lat === null || lon === null) erroLocal("Informe latitude e longitude válidas.")
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    erroLocal("Coordenadas fora do intervalo (lat -90..90, lon -180..180).")
  }

  const { error } = await supabase
    .from("embarcacoes")
    .update({ marina_lat: lat, marina_lon: lon })
    .eq("id", painel.embarcacao.id)
  if (error) erroLocal("Não foi possível salvar a posição. Tente de novo.")

  revalidatePath("/hoje")
  revalidatePath("/barco")
  redirect("/hoje")
}
```

- [ ] **Step 2: `web/components/usar-posicao.tsx`:**

```tsx
"use client"
import { useState } from "react"

export function UsarPosicao() {
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function usar() {
    if (ocupado) return
    if (!("geolocation" in navigator)) {
      setMsg("Este navegador não fornece localização.")
      return
    }
    setOcupado(true)
    setMsg("Obtendo posição…")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = document.getElementById("lat") as HTMLInputElement | null
        const lon = document.getElementById("lon") as HTMLInputElement | null
        if (lat) lat.value = p.coords.latitude.toFixed(6)
        if (lon) lon.value = p.coords.longitude.toFixed(6)
        setMsg("Posição preenchida — confira e salve.")
        setOcupado(false)
      },
      () => {
        setMsg("Não foi possível obter a posição. Preencha manualmente ou tente de novo.")
        setOcupado(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <div>
      <button type="button" onClick={usar} disabled={ocupado}
        className="w-full rounded-xl border border-line py-3 text-sm font-medium disabled:opacity-60">
        Usar minha posição atual
      </button>
      {msg && <p className="mt-2 text-xs text-dim">{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 3: página `web/app/(app)/barco/local/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import { UsarPosicao } from "@/components/usar-posicao"
import { salvarLocalMarina } from "@/lib/acoes/local"
import { carregarPainel } from "@/lib/consultas"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 font-mono-instr text-base tabular-nums"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function LocalPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const { embarcacao } = painel

  return (
    <main>
      <a href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Embarcação</a>
      <h1 className="mt-3 text-xl font-semibold">Posição da marina</h1>
      <p className="mt-1 text-sm text-dim">
        É daqui que saem o boletim do mar da tela Início e, no futuro, o modo marina.
        Vá até o barco e toque em "Usar minha posição atual" — ou preencha as coordenadas.
      </p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={salvarLocalMarina} className="mt-5 space-y-4">
        <UsarPosicao />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="lat">Latitude</label>
            <input id="lat" name="lat" inputMode="text" placeholder="-22.9188"
              defaultValue={embarcacao.marina_lat ?? undefined} className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="lon">Longitude</label>
            <input id="lon" name="lon" inputMode="text" placeholder="-43.1706"
              defaultValue={embarcacao.marina_lon ?? undefined} className={campo} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Salvar posição
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: acesso pela ficha** — em `web/app/(app)/barco/page.tsx`, dentro da seção "Dados gerais" (o card `<div className="rounded-[14px] border border-line bg-panel px-4">`… se a seção não existir no hub atual, adicionar logo APÓS o card "Acervo do barco"):

```tsx
      <Link href="/barco/local" className="mt-2 block rounded-[14px] border border-line bg-panel p-3.5">
        <p className="text-sm font-semibold">Posição da marina</p>
        <p className="mt-0.5 text-xs text-dim">
          {painel && painel.embarcacao.marina_lat != null
            ? `${painel.embarcacao.marina_lat.toFixed(4)}, ${painel.embarcacao.marina_lon?.toFixed(4)}`
            : "Defina para ligar o boletim do mar"}
        </p>
      </Link>
```

(ajustar a referência: o hub já tem `embarcacao` desestruturada — usar `embarcacao.marina_lat` direto.)

- [ ] **Step 5:** `npm test` 63/63; `npm run build` verde (rota `/barco/local`). Commit: `git add web; git commit -m "feat: posicao da marina com geolocation e validacao"`

---

### Task 4: Boletim do mar na Home

**Files:**
- Create: `web/lib/mar.ts`
- Modify: `web/app/(app)/hoje/page.tsx` (card "Posição e mar" + botão Navegar)

**Interfaces:**
- Consumes: `avaliarMar`/`SeloMar` do domínio; `marina_lat/lon` da embarcação.
- Produces: `boletimDoMar(lat: number, lon: number): Promise<BoletimMar | null>` com `interface BoletimMar { ondaM: number | null; periodoS: number | null; ventoKt: number | null; aguaC: number | null; selo: SeloMar }`.

- [ ] **Step 1: `web/lib/mar.ts`:**

```ts
import { avaliarMar, type SeloMar } from "@/lib/domain/mar"

export interface BoletimMar {
  ondaM: number | null
  periodoS: number | null
  ventoKt: number | null
  aguaC: number | null
  selo: SeloMar
}

function horaSp(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })
      .format(new Date()),
  )
}

function valorHora(dados: unknown, campo: string, hora: number): number | null {
  const hourly = (dados as { hourly?: Record<string, unknown> } | null)?.hourly
  const serie = hourly?.[campo]
  if (!Array.isArray(serie) || hora >= serie.length) return null
  const v = serie[hora]
  return typeof v === "number" ? v : null
}

export async function boletimDoMar(lat: number, lon: number): Promise<BoletimMar | null> {
  try {
    const [marinho, tempo] = await Promise.all([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,sea_surface_temperature&timezone=America%2FSao_Paulo&forecast_days=1`,
        { next: { revalidate: 3600 } },
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=1`,
        { next: { revalidate: 3600 } },
      ).then((r) => (r.ok ? r.json() : null)),
    ])
    if (!marinho && !tempo) return null

    const h = horaSp()
    const ondaM = valorHora(marinho, "wave_height", h)
    const periodoS = valorHora(marinho, "wave_period", h)
    const aguaC = valorHora(marinho, "sea_surface_temperature", h)
    const ventoKt = valorHora(tempo, "wind_speed_10m", h)
    return { ondaM, periodoS, ventoKt, aguaC, selo: avaliarMar(ondaM, ventoKt) }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: card na Hoje** — em `web/app/(app)/hoje/page.tsx`:
  (a) imports novos: `import { boletimDoMar } from "@/lib/mar"`;
  (b) no corpo, após obter `painel`: 

```tsx
  const boletim =
    embarcacao.marina_lat != null && embarcacao.marina_lon != null
      ? await boletimDoMar(embarcacao.marina_lat, embarcacao.marina_lon)
      : null
```

  (nota: `embarcacao` já é desestruturada do painel na página);
  (c) inserir a seção logo APÓS o bloco de alertas ("Precisa de atenção"/"Tudo em dia") e ANTES de "Horas de motor":

```tsx
      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Mar agora</p>
      {embarcacao.marina_lat == null || embarcacao.marina_lon == null ? (
        <Link href="/barco/local" className="block rounded-[14px] border border-line bg-panel p-4">
          <p className="text-sm font-semibold">Ligue o boletim do mar</p>
          <p className="mt-0.5 text-xs text-dim">Defina a posição da marina para ver onda, vento e água aqui.</p>
        </Link>
      ) : boletim == null ? (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Boletim indisponível agora. Tente mais tarde.
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
            <span><span className="mr-1.5 text-[10px] uppercase tracking-[.12em] text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
            <span><span className="mr-1.5 text-[10px] uppercase tracking-[.12em] text-dim">Vento</span>{boletim.ventoKt != null ? `${Math.round(boletim.ventoKt)} kt` : "—"}</span>
            <span><span className="mr-1.5 text-[10px] uppercase tracking-[.12em] text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
            <span className={`ml-auto rounded px-2 py-0.5 font-mono-instr text-[10px] uppercase tracking-[.1em] ${
              boletim.selo.nivel === "ok" ? "border border-ok/40 text-ok"
              : boletim.selo.nivel === "atencao" ? "border border-warn/40 text-warn"
              : "border border-crit/40 text-crit"
            }`}>{boletim.selo.rotulo}</span>
          </div>
        </div>
      )}

      <Link href="/navegar" className="mt-3 block rounded-[14px] border border-accent/40 bg-panel p-3.5 text-center text-sm font-semibold text-accent-forte">
        ⛵ Iniciar navegação — gravar trilha
      </Link>
```

- [ ] **Step 3:** `npm test` 63/63; `npm run build` verde. Commit: `git add web; git commit -m "feat: boletim do mar na home com selo de saida"`

---

### Task 5: Navegar — gravação de trilha

**Files:**
- Create: `web/lib/acoes/trilha.ts`, `web/app/(app)/navegar/page.tsx`

**Interfaces:**
- Consumes: `PontoTrilha`, `resumoTrilha` do domínio; `carregarPainel`, `hojeISO`, `supabaseServer`.
- Produces: action `salvarTrilha(pontos: PontoTrilha[], observacao: string): Promise<{ ok: true } | { ok: false; erro: string }>` — grava evento `navegacao` com `trilha` e descrição-resumo; revalida `/diario` e `/hoje`.

- [ ] **Step 1: `web/lib/acoes/trilha.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { resumoTrilha, type PontoTrilha } from "@/lib/domain/geo"
import { supabaseServer } from "@/lib/supabase/server"

const MAX_PONTOS = 4000

export async function salvarTrilha(
  pontos: PontoTrilha[],
  observacao: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const painel = await carregarPainel()
  if (!painel) return { ok: false, erro: "Cadastre a embarcação primeiro." }

  const validos = (Array.isArray(pontos) ? pontos : [])
    .filter(
      (p) =>
        typeof p?.t === "number" && typeof p?.la === "number" && typeof p?.lo === "number" &&
        p.la >= -90 && p.la <= 90 && p.lo >= -180 && p.lo <= 180,
    )
    .slice(0, MAX_PONTOS)
  if (validos.length < 2) return { ok: false, erro: "Trilha curta demais para salvar." }

  const r = resumoTrilha(validos)
  const descricao = [
    `${r.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} nm em ${r.duracaoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`,
    `máx ${r.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`,
    observacao.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ")

  const { error } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    tipo: "navegacao",
    data: hojeISO(),
    descricao,
    trilha: validos,
    criado_por: user.id,
  })
  if (error) return { ok: false, erro: "Não foi possível salvar a trilha. Ela continua na tela — tente de novo." }

  revalidatePath("/diario")
  revalidatePath("/hoje")
  return { ok: true }
}
```

- [ ] **Step 2: `web/app/(app)/navegar/page.tsx`** (client component inteiro):

```tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { salvarTrilha } from "@/lib/acoes/trilha"
import { resumoTrilha, haversineNm, type PontoTrilha } from "@/lib/domain/geo"

const MAX_PONTOS = 4000

export default function NavegarPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<"pronto" | "gravando" | "salvando">("pronto")
  const [msg, setMsg] = useState<string | null>(null)
  const [obs, setObs] = useState("")
  const [tick, setTick] = useState(0)
  const pontosRef = useRef<PontoTrilha[]>([])
  const watchRef = useRef<number | null>(null)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      wakeRef.current?.release().catch(() => {})
    }
  }, [])

  async function iniciar() {
    if (!("geolocation" in navigator)) {
      setMsg("Este navegador não fornece localização.")
      return
    }
    setMsg(null)
    pontosRef.current = []
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const ponto = { t: Math.round(p.timestamp / 1000), la: p.coords.latitude, lo: p.coords.longitude }
        const lista = pontosRef.current
        const ultimo = lista[lista.length - 1]
        if (lista.length >= MAX_PONTOS) return
        if (
          !ultimo ||
          haversineNm(ultimo, ponto) * 1852 >= 15 ||
          ponto.t - ultimo.t >= 30
        ) {
          lista.push(ponto)
          setTick((x) => x + 1)
        }
      },
      () => setMsg("Sem sinal de GPS — confira a permissão de localização."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    try {
      // mantém a tela acesa durante a navegação (best-effort)
      const wl = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")
      if (wl) wakeRef.current = wl
    } catch {}
    setEstado("gravando")
  }

  async function encerrar() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    await wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
    setEstado("salvando")
    const r = await salvarTrilha(pontosRef.current, obs)
    if (r.ok) {
      router.push("/diario")
    } else {
      setMsg(r.erro)
      setEstado(pontosRef.current.length > 0 ? "gravando" : "pronto")
      if (pontosRef.current.length >= 2) return
    }
  }

  void tick
  const resumo = resumoTrilha(pontosRef.current)
  const ultimo = pontosRef.current[pontosRef.current.length - 1]
  const penultimo = pontosRef.current[pontosRef.current.length - 2]
  const velAgoraKt =
    ultimo && penultimo && ultimo.t > penultimo.t
      ? haversineNm(penultimo, ultimo) / ((ultimo.t - penultimo.t) / 3600)
      : 0

  const mostrador = "rounded-[10px] border border-line bg-meter px-3 py-2 font-mono-instr tabular-nums text-meter-texto"
  const etiqueta = "text-[10px] uppercase tracking-[.14em] text-meter-dim"

  return (
    <main>
      <h1 className="text-xl font-semibold">Navegação</h1>
      <p className="mt-1 text-sm text-dim">
        Mantenha o app aberto durante o passeio — a trilha vira um evento no Diário de Bordo.
      </p>
      {msg && <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{msg}</p>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className={mostrador}>
          <p className={etiqueta}>Velocidade</p>
          <p className="text-3xl">{velAgoraKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">kt</span></p>
        </div>
        <div className={mostrador}>
          <p className={etiqueta}>Distância</p>
          <p className="text-3xl">{resumo.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">nm</span></p>
        </div>
        <div className={mostrador}>
          <p className={etiqueta}>Tempo</p>
          <p className="text-3xl">{(resumo.duracaoH * 60).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-sm text-meter-dim">min</span></p>
        </div>
        <div className={mostrador}>
          <p className={etiqueta}>Máxima</p>
          <p className="text-3xl">{resumo.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} <span className="text-sm text-meter-dim">kt</span></p>
        </div>
      </div>

      {estado === "pronto" && (
        <button onClick={iniciar} className="mt-5 w-full rounded-xl bg-accent py-4 text-base font-semibold text-acao-texto">
          Iniciar gravação
        </button>
      )}
      {estado !== "pronto" && (
        <>
          <div className="mt-5">
            <label htmlFor="obs" className="mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim">
              Observação — opcional
            </label>
            <input id="obs" value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: volta às Cagarras"
              className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base" />
          </div>
          <button onClick={encerrar} disabled={estado === "salvando"}
            className="mt-3 w-full rounded-xl bg-crit py-4 text-base font-semibold text-white disabled:opacity-60">
            {estado === "salvando" ? "Salvando…" : "Encerrar e salvar no diário"}
          </button>
          <p className="mt-2 text-center font-mono-instr text-[11px] tabular-nums text-dim">
            {pontosRef.current.length} pontos gravados
          </p>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3:** `npm test` 63/63; `npm run build` verde (rota `/navegar`). Commit: `git add web; git commit -m "feat: gravacao de trilha com painel ao vivo e wake lock"`

---

### Task 6: Carta da trilha no Diário + verificação final

**Files:**
- Create: `web/components/trilha-svg.tsx`, `web/app/(app)/diario/trilha/[id]/page.tsx`
- Modify: `web/app/(app)/diario/page.tsx` (link "ver trilha" quando `e.trilha` existir; adicionar "trilha" ao meta)

**Interfaces:**
- Consumes: `PontoTrilha`/`resumoTrilha`, tipo `Evento` (com `trilha`), `supabaseServer`.
- Produces: `<TrilhaSvg pontos={PontoTrilha[]} />`.

- [ ] **Step 1: `web/components/trilha-svg.tsx`:**

```tsx
import type { PontoTrilha } from "@/lib/domain/geo"

const LARGURA = 360
const ALTURA = 220
const MARGEM = 18

export function TrilhaSvg({ pontos }: { pontos: PontoTrilha[] }) {
  if (pontos.length < 2) return null
  const rad = Math.PI / 180
  const laMedia = pontos.reduce((s, p) => s + p.la, 0) / pontos.length
  const fatorLon = Math.cos(laMedia * rad)

  const xs = pontos.map((p) => p.lo * fatorLon)
  const ys = pontos.map((p) => p.la)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const escala = Math.min((LARGURA - 2 * MARGEM) / spanX, (ALTURA - 2 * MARGEM) / spanY)
  const dx = (LARGURA - spanX * escala) / 2
  const dy = (ALTURA - spanY * escala) / 2

  const px = (i: number) => dx + (xs[i] - minX) * escala
  const py = (i: number) => ALTURA - (dy + (ys[i] - minY) * escala)
  const caminho = pontos.map((_, i) => `${px(i).toFixed(1)},${py(i).toFixed(1)}`).join(" ")

  const grade = [0.25, 0.5, 0.75]
  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full rounded-[10px] border border-line bg-meter" role="img" aria-label="Carta da trilha">
      {grade.map((g) => (
        <g key={g} stroke="#12283f" strokeWidth="1">
          <line x1={LARGURA * g} y1="0" x2={LARGURA * g} y2={ALTURA} />
          <line x1="0" y1={ALTURA * g} x2={LARGURA} y2={ALTURA * g} />
        </g>
      ))}
      <polyline points={caminho} fill="none" stroke="#d4af37" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(0)} cy={py(0)} r="4" fill="#2fd07a" />
      <circle cx={px(pontos.length - 1)} cy={py(pontos.length - 1)} r="4" fill="#ff5c5c" />
    </svg>
  )
}
```

- [ ] **Step 2: página `web/app/(app)/diario/trilha/[id]/page.tsx`:**

```tsx
import { notFound } from "next/navigation"
import { TrilhaSvg } from "@/components/trilha-svg"
import { resumoTrilha } from "@/lib/domain/geo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

export default async function TrilhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await supabaseServer()
  const { data: evento } = await supabase
    .from("eventos").select("*").eq("id", id).maybeSingle()
  const e = evento as Evento | null
  if (!e || !e.trilha || e.trilha.length < 2) notFound()

  const r = resumoTrilha(e.trilha)
  const stats: [string, string][] = [
    ["Distância", `${r.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} nm`],
    ["Duração", `${r.duracaoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`],
    ["Em movimento", `${r.tempoMovimentoH.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`],
    ["Vel. média", `${r.velMediaKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`],
    ["Vel. máxima", `${r.velMaxKt.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kt`],
  ]

  return (
    <main>
      <a href="/diario" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Diário</a>
      <h1 className="mt-3 text-xl font-semibold">Trilha — {e.data.split("-").reverse().join("/")}</h1>
      {e.descricao && <p className="mt-1 text-sm text-dim">{e.descricao}</p>}

      <div className="mt-4">
        <TrilhaSvg pontos={e.trilha} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map(([nome, valor]) => (
          <div key={nome} className="rounded-[12px] border border-line bg-panel p-3">
            <p className="font-mono-instr text-[10px] uppercase tracking-[.14em] text-dim">{nome}</p>
            <p className="mt-0.5 font-mono-instr text-lg tabular-nums">{valor}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: link no diário** — em `web/app/(app)/diario/page.tsx`, no array `meta` do evento, trocar a linha `e.anexo_path ? "anexo" : null,` por:

```tsx
                e.anexo_path ? "anexo" : null,
                e.trilha ? "trilha" : null,
```

e, logo após o `<p>` do `meta`, adicionar:

```tsx
                    {e.trilha && (
                      <Link href={`/diario/trilha/${e.id}`} className="mt-1 inline-block text-xs text-accent-forte">
                        Ver trilha na carta
                      </Link>
                    )}
```

- [ ] **Step 4: verificação final da fase** — `npm test` 63/63; `npm run build` verde com rotas `/barco/local`, `/navegar`, `/diario/trilha/[id]`. Commit: `git add web; git commit -m "feat: carta svg da trilha no diario"`

---

## Self-review (executado na escrita)

- **Cobertura (espec v1.1 §12 Tier 0):** trilha pelo celular com app aberto (T5), horas/velocidades derivadas (T2 — resumo com tempo em movimento >2 kt), boletim do mar na Home com "dá pra sair" (T2/T4), trilha vira evento no Diário com mapa (T5/T6). AIS ao redor ficou de fora desta fase (aisstream é WebSocket em tempo real — melhor com o app deployado; anotado como débito da fase, não perdido).
- **Placeholders:** nenhum.
- **Tipos:** `PontoTrilha { t, la, lo }` idêntico no domínio (T2), types.ts/`PontoTrilhaDb` (T1 — mesma forma), action (T5) e SVG (T6); `salvarTrilha(pontos, observacao)` consumida em T5 com a mesma assinatura; `boletimDoMar` produzido em T4 e consumido na própria Hoje; `avaliarMar` do domínio é a única fonte do selo.

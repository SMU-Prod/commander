# Commander Fase 3 — Alertas e PWA: Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O app passa a chamar o dono: Web Push com VAPID (ativação por aparelho + teste), rota de disparo com dedupe por janela/ciclo, e-mail best-effort via Resend, PWA instalável (manifest + service worker + ícones gerados), central de Notificações real e `error.tsx` amigável.

**Architecture:** Assinaturas de push em tabela própria (RLS por usuário). O disparo é uma rota `POST /api/alertas/disparar` protegida por segredo, usando o service role do Supabase para varrer todos os barcos, o MESMO motor `calcularSemaforo` do domínio e uma tabela `alertas_enviados` com unique (item, janela, ciclo_ref) como dedupe — o agendamento externo (cron) chega na fase de deploy; até lá o disparo é manual/testável. Lógica de janela e textos em domínio puro com TDD.

**Tech Stack:** o existente + `web-push` (OSS, envio VAPID) e `@types/web-push` (dev). E-mail via HTTP direto na API do Resend (sem SDK), só quando `RESEND_API_KEY` existir.

## Global Constraints

- PT-BR em toda UI e em todos os textos de alerta; tokens do tema; dígitos `font-mono-instr tabular-nums`.
- Semáforo/janelas derivam SEMPRE de `calcularSemaforo` — nenhuma regra de vencimento duplicada fora do domínio.
- RLS em toda tabela nova; a rota de disparo usa service role e é protegida por `Authorization: Bearer ${ALERTAS_SEGREDO}` — sem segredo configurado, responde 401/500 claro, nunca roda aberta.
- Server actions de push retornam `{ ok: true } | { ok: false; erro: string }` (sem redirect — consumidas por client component); `redirect()` continua proibido dentro de try/catch onde usado.
- Envs novos documentados em `web/.env.local`; código degrada com mensagem clara quando faltar env (nunca crash).
- Nenhuma dependência paga; e-mail é best-effort (pulado sem `RESEND_API_KEY`).
- Ícones: navy `#0B1D2D` + monograma dourado `#D4AF37` (mesma marca de `components/logo.tsx`).

---

## Estrutura de arquivos

```
web/
├─ scripts/gerar-icones.ps1          gera PNGs do ícone (System.Drawing)
├─ public/sw.js                      service worker (push + clique)
├─ public/icone-192.png / icone-512.png / icone-maskable-512.png / apple-touch-icon.png
├─ app/manifest.ts                   manifest PWA
├─ app/error.tsx                     erro amigável
├─ app/api/alertas/disparar/route.ts rota de disparo (service role)
├─ lib/domain/alertas.ts (+ .test)   janelaDoAlerta, cicloRef, textoDoAlerta
├─ lib/acoes/push.ts                 salvar/remover assinatura + teste
├─ components/registrar-sw.tsx       registra o SW
├─ components/ativar-alertas.tsx     UI de ativação/desativação/teste
├─ app/(app)/notificacoes/page.tsx   central real (substitui stub)
├─ app/(app)/menu/page.tsx           "Configurar alertas" vira link real
├─ app/(app)/layout.tsx              monta <RegistrarSw />
├─ app/layout.tsx                    apple-touch-icon na metadata
└─ middleware.ts                     matcher libera /sw.js
```

---

### Task 1: Migration 004 + dependências + envs

**Files:**
- Migration `004_alertas` via MCP Supabase (conector `mcp__6dcbebfb-...`, projeto `khgjtxvmduizyooqaoox`)
- Modify: `web/package.json` (deps), `web/.env.local` (chaves novas), `web/lib/db/types.ts` (2 interfaces novas)

**Interfaces:**
- Produces: tabelas `push_assinaturas` e `alertas_enviados`; tipos `PushAssinatura { id, usuario_id, endpoint, p256dh, auth, created_at }` e `AlertaEnviado { id, embarcacao_id, item_monitorado_id, janela, ciclo_ref, titulo, enviado_em }`; envs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `ALERTAS_SEGREDO` (gerados), `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` (documentados como manuais/opcionais).

- [ ] **Step 1: Migration `004_alertas`** via `apply_migration`, SQL exato:

```sql
create table public.push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_assinaturas enable row level security;
create policy "push: proprias" on public.push_assinaturas for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create table public.alertas_enviados (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  item_monitorado_id uuid not null references public.itens_monitorados(id) on delete cascade,
  janela text not null check (janela in ('d30','d15','d5','vencido','h_margem','h_vencido')),
  ciclo_ref text not null default '',
  titulo text not null default '',
  enviado_em timestamptz not null default now(),
  unique (item_monitorado_id, janela, ciclo_ref)
);
alter table public.alertas_enviados enable row level security;
create policy "alertas: ver com vinculo" on public.alertas_enviados for select
  using (public.pode_ver_embarcacao(embarcacao_id));
```

(Sem policy de insert — só o service role escreve, e ele ignora RLS.)

- [ ] **Step 2: advisors** (`get_advisors` security): nenhuma tabela sem RLS.

- [ ] **Step 3: dependências**

```powershell
Set-Location "C:\Users\erick\GEST-NAV\web"
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 4: gerar e gravar envs** — rodar e anexar ao FINAL de `web/.env.local` (NÃO sobrescrever o que existe):

```powershell
npx web-push generate-vapid-keys
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Acrescentar ao `.env.local` (substituindo os valores gerados):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey do web-push>
VAPID_PRIVATE_KEY=<privateKey do web-push>
ALERTAS_SEGREDO=<hex gerado>
# manual (dashboard Supabase > Settings > API): necessario para a rota de disparo
# SUPABASE_SERVICE_ROLE_KEY=
# opcional (conta Resend): e-mail de alerta
# RESEND_API_KEY=
```

- [ ] **Step 5: tipos** — acrescentar ao final de `web/lib/db/types.ts`:

```ts
export interface PushAssinatura {
  id: string
  usuario_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export type JanelaAlertaDb = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido"

export interface AlertaEnviado {
  id: string
  embarcacao_id: string
  item_monitorado_id: string
  janela: JanelaAlertaDb
  ciclo_ref: string
  titulo: string
  enviado_em: string
}
```

- [ ] **Step 6:** `npm test` 43/43, `npm run build` verde. Commit:
`git add web; git commit -m "feat: migration alertas/push, deps web-push e envs"` (conferir antes que `.env.local` segue untracked).

---

### Task 2: PWA — ícones, manifest, service worker

**Files:**
- Create: `web/scripts/gerar-icones.ps1`, `web/public/sw.js`, `web/app/manifest.ts`, `web/components/registrar-sw.tsx` (+ os 4 PNGs gerados)
- Modify: `web/middleware.ts` (matcher), `web/app/layout.tsx` (apple icon), `web/app/(app)/layout.tsx` (montar RegistrarSw)

**Interfaces:**
- Produces: `/sw.js` com handlers de `push` (payload JSON `{ titulo, corpo, url }`) e `notificationclick`; `<RegistrarSw />`.

- [ ] **Step 1: `web/scripts/gerar-icones.ps1`:**

```powershell
Add-Type -AssemblyName System.Drawing

function Novo-Icone([int]$tam, [string]$saida, [double]$escalaForma) {
  $bmp = New-Object System.Drawing.Bitmap($tam, $tam)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#0B1D2D"))
  $base = @(@(4,32),@(4,10),@(15,22),@(24,5),@(33,22),@(44,10),@(44,32),@(36,32),@(36,24),@(28,32),@(20,32),@(12,24),@(12,32))
  $escala = $tam / 48.0 * $escalaForma
  $dx = ($tam - 48.0 * $escala) / 2.0
  $dy = ($tam - 37.0 * $escala) / 2.0
  $pts = [System.Drawing.PointF[]]($base | ForEach-Object {
    New-Object System.Drawing.PointF([float]($_[0] * $escala + $dx), [float]($_[1] * $escala + $dy))
  })
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#D4AF37"))
  $g.FillPolygon($brush, $pts)
  $brush.Dispose(); $g.Dispose()
  $bmp.Save($saida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "gerado: $saida"
}

Novo-Icone 192 "$PSScriptRoot\..\public\icone-192.png" 0.84
Novo-Icone 512 "$PSScriptRoot\..\public\icone-512.png" 0.84
Novo-Icone 512 "$PSScriptRoot\..\public\icone-maskable-512.png" 0.60
Novo-Icone 180 "$PSScriptRoot\..\public\apple-touch-icon.png" 0.84
```

Rodar: `powershell -File web/scripts/gerar-icones.ps1` — Expected: 4 PNGs em `web/public/`.

- [ ] **Step 2: `web/public/sw.js`:**

```js
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", (e) => {
  let dados = {}
  try { dados = e.data ? e.data.json() : {} } catch { dados = {} }
  e.waitUntil(
    self.registration.showNotification(dados.titulo || "Commander", {
      body: dados.corpo || "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { url: dados.url || "/hoje" },
    }),
  )
})

self.addEventListener("notificationclick", (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || "/hoje"
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      const aberta = abas.find((a) => "focus" in a)
      return aberta ? aberta.focus().then(() => aberta.navigate(url)) : self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 3: `web/app/manifest.ts`:**

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Commander — Gestão completa da sua embarcação",
    short_name: "Commander",
    description: "Documentação, manutenção e histórico do seu barco num lugar só.",
    start_url: "/hoje",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#0b1d2d",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

- [ ] **Step 4: `web/components/registrar-sw.tsx`:**

```tsx
"use client"
import { useEffect } from "react"

export function RegistrarSw() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])
  return null
}
```

Montar em `web/app/(app)/layout.tsx`: importar e renderizar `<RegistrarSw />` como primeiro filho do `<div>` raiz do layout.

- [ ] **Step 5: middleware + metadata**
  - `web/middleware.ts`: matcher passa a `"/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|webmanifest)$).*)"` (libera `/sw.js`).
  - `web/app/layout.tsx`: no objeto `metadata`, adicionar `icons: { apple: "/apple-touch-icon.png" }`.

- [ ] **Step 6:** `npm run build` verde; no dev, `GET /sw.js` responde 200 (sem redirect) e `GET /manifest.webmanifest` responde JSON. Commit: `git add web; git commit -m "feat: pwa instalavel - icones, manifest e service worker"`

---

### Task 3: Domínio — janelas e textos de alerta (TDD)

**Files:**
- Create: `web/lib/domain/alertas.ts`, `web/lib/domain/alertas.test.ts`

**Interfaces:**
- Consumes: `ResultadoCalc` de `@/lib/domain/semaforo`; `ItemMonitorado` de `@/lib/db/types`.
- Produces:
  - `type JanelaAlerta = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido"`
  - `janelaDoAlerta(r: ResultadoCalc): JanelaAlerta | null`
  - `cicloRef(i: Pick<ItemMonitorado, "data_fixa" | "ultimo_ciclo_data" | "ultimo_ciclo_horas">): string`
  - `textoDoAlerta(nomeItem: string, nomeAlvo: string | null, janela: JanelaAlerta, r: ResultadoCalc): { titulo: string; corpo: string }`

- [ ] **Step 1: testes primeiro** — `web/lib/domain/alertas.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { cicloRef, janelaDoAlerta, textoDoAlerta } from "./alertas"

const r = (p: Partial<{ status: "ok" | "atencao" | "vencido"; horasRestantes: number | null; diasRestantes: number | null }>) => ({
  status: "ok" as const, horasRestantes: null, diasRestantes: null, ...p,
})

describe("janelaDoAlerta", () => {
  it("horas vencidas mandam", () => {
    expect(janelaDoAlerta(r({ status: "vencido", horasRestantes: -3.4, diasRestantes: 200 }))).toBe("h_vencido")
  })
  it("data vencida", () => {
    expect(janelaDoAlerta(r({ status: "vencido", diasRestantes: -2 }))).toBe("vencido")
  })
  it("janelas de dias: 5, 15, 30", () => {
    expect(janelaDoAlerta(r({ status: "atencao", diasRestantes: 4 }))).toBe("d5")
    expect(janelaDoAlerta(r({ status: "atencao", diasRestantes: 12 }))).toBe("d15")
    expect(janelaDoAlerta(r({ status: "atencao", diasRestantes: 30 }))).toBe("d30")
  })
  it("margem de horas quando não há janela de dias", () => {
    expect(janelaDoAlerta(r({ status: "atencao", horasRestantes: 37, diasRestantes: null }))).toBe("h_margem")
    expect(janelaDoAlerta(r({ status: "atencao", horasRestantes: 37, diasRestantes: 200 }))).toBe("h_margem")
  })
  it("ok não alerta", () => {
    expect(janelaDoAlerta(r({ status: "ok", horasRestantes: 400, diasRestantes: 200 }))).toBeNull()
  })
})

describe("cicloRef", () => {
  it("combina os marcos do ciclo", () => {
    expect(cicloRef({ data_fixa: "2026-08-17", ultimo_ciclo_data: null, ultimo_ciclo_horas: null })).toBe("2026-08-17||")
    expect(cicloRef({ data_fixa: null, ultimo_ciclo_data: "2026-07-19", ultimo_ciclo_horas: 1490 })).toBe("|2026-07-19|1490")
  })
})

describe("textoDoAlerta", () => {
  it("vencido por horas", () => {
    const t = textoDoAlerta("Revisão geral", "Motor BB", "h_vencido", r({ horasRestantes: -3.4 }))
    expect(t.titulo).toBe("🔴 Revisão geral — Motor BB")
    expect(t.corpo).toBe("Vencido há 3 h de uso.")
  })
  it("janela de dias", () => {
    const t = textoDoAlerta("Seguro da embarcação", null, "d15", r({ diasRestantes: 12 }))
    expect(t.titulo).toBe("🟡 Seguro da embarcação")
    expect(t.corpo).toBe("Vence em 12 dias.")
  })
  it("margem de horas", () => {
    const t = textoDoAlerta("Troca de óleo e filtros", "Motor BE", "h_margem", r({ horasRestantes: 37 }))
    expect(t.corpo).toBe("Faltam 37 h de uso.")
  })
  it("vencido por data", () => {
    const t = textoDoAlerta("TIE", null, "vencido", r({ diasRestantes: -8 }))
    expect(t.corpo).toBe("Vencido há 8 dias.")
  })
})
```

- [ ] **Step 2:** `npm test` → FAIL (módulo inexistente).

- [ ] **Step 3: `web/lib/domain/alertas.ts`:**

```ts
import type { ItemMonitorado } from "@/lib/db/types"
import type { ResultadoCalc } from "@/lib/domain/semaforo"

export type JanelaAlerta = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido"

export function janelaDoAlerta(r: ResultadoCalc): JanelaAlerta | null {
  if (r.horasRestantes != null && r.horasRestantes < 0) return "h_vencido"
  if (r.diasRestantes != null && r.diasRestantes < 0) return "vencido"
  if (r.diasRestantes != null && r.diasRestantes <= 30) {
    if (r.diasRestantes <= 5) return "d5"
    if (r.diasRestantes <= 15) return "d15"
    return "d30"
  }
  if (r.status === "atencao" && r.horasRestantes != null) return "h_margem"
  return null
}

export function cicloRef(
  i: Pick<ItemMonitorado, "data_fixa" | "ultimo_ciclo_data" | "ultimo_ciclo_horas">,
): string {
  return `${i.data_fixa ?? ""}|${i.ultimo_ciclo_data ?? ""}|${i.ultimo_ciclo_horas ?? ""}`
}

export function textoDoAlerta(
  nomeItem: string,
  nomeAlvo: string | null,
  janela: JanelaAlerta,
  r: ResultadoCalc,
): { titulo: string; corpo: string } {
  const onde = nomeAlvo ? `${nomeItem} — ${nomeAlvo}` : nomeItem
  switch (janela) {
    case "h_vencido":
      return { titulo: `🔴 ${onde}`, corpo: `Vencido há ${Math.round(-(r.horasRestantes ?? 0))} h de uso.` }
    case "vencido":
      return { titulo: `🔴 ${onde}`, corpo: `Vencido há ${-(r.diasRestantes ?? 0)} dias.` }
    case "h_margem":
      return { titulo: `🟡 ${onde}`, corpo: `Faltam ${Math.round(r.horasRestantes ?? 0)} h de uso.` }
    default:
      return { titulo: `🟡 ${onde}`, corpo: `Vence em ${r.diasRestantes} dias.` }
  }
}
```

- [ ] **Step 4:** `npm test` → 54/54 PASS (43 + 11).
- [ ] **Step 5: Commit:** `git add web; git commit -m "feat: dominio de janelas e textos de alerta (TDD)"`

---

### Task 4: Push — assinaturas, ativação e teste

**Files:**
- Create: `web/lib/acoes/push.ts`, `web/components/ativar-alertas.tsx`

**Interfaces:**
- Consumes: `supabaseServer`; env VAPID; tabela `push_assinaturas`.
- Produces: actions `salvarAssinaturaPush(assinatura: { endpoint: string; keys: { p256dh: string; auth: string } })`, `removerAssinaturaPush(endpoint: string)`, `enviarPushTeste()` — todas retornam `{ ok: true } | { ok: false; erro: string }`. Componente `<AtivarAlertas />` (client) para a página de Notificações.

- [ ] **Step 1: `web/lib/acoes/push.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import webpush from "web-push"
import { supabaseServer } from "@/lib/supabase/server"

type Resultado = { ok: true } | { ok: false; erro: string }

export async function salvarAssinaturaPush(assinatura: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}): Promise<Resultado> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const { error } = await supabase.from("push_assinaturas").upsert(
    {
      usuario_id: user.id,
      endpoint: assinatura.endpoint,
      p256dh: assinatura.keys.p256dh,
      auth: assinatura.keys.auth,
    },
    { onConflict: "endpoint" },
  )
  if (error) return { ok: false, erro: "Não foi possível salvar a ativação. Tente de novo." }
  revalidatePath("/notificacoes")
  return { ok: true }
}

export async function removerAssinaturaPush(endpoint: string): Promise<Resultado> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from("push_assinaturas").delete().eq("endpoint", endpoint)
  if (error) return { ok: false, erro: "Não foi possível desativar." }
  revalidatePath("/notificacoes")
  return { ok: true }
}

export async function enviarPushTeste(): Promise<Resultado> {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return { ok: false, erro: "Push não configurado no servidor." }
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const { data: assinaturas } = await supabase
    .from("push_assinaturas").select("endpoint, p256dh, auth").eq("usuario_id", user.id)
  if (!assinaturas || assinaturas.length === 0) return { ok: false, erro: "Ative os alertas neste aparelho primeiro." }

  webpush.setVapidDetails("mailto:atendimento.smu@gmail.com", publica, privada)
  let enviados = 0
  for (const a of assinaturas) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify({ titulo: "Commander", corpo: "Alertas ativados. Bom vento e mar calmo!", url: "/notificacoes" }),
      )
      enviados++
    } catch {
      await supabase.from("push_assinaturas").delete().eq("endpoint", a.endpoint)
    }
  }
  return enviados > 0
    ? { ok: true }
    : { ok: false, erro: "Nenhum aparelho recebeu — desative e ative os alertas de novo." }
}
```

- [ ] **Step 2: `web/components/ativar-alertas.tsx`:**

```tsx
"use client"
import { useEffect, useState } from "react"
import { enviarPushTeste, removerAssinaturaPush, salvarAssinaturaPush } from "@/lib/acoes/push"

function base64ParaUint8(base64: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export function AtivarAlertas() {
  const [estado, setEstado] = useState<"carregando" | "sem-suporte" | "inativo" | "ativo">("carregando")
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("sem-suporte")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const ass = await reg.pushManager.getSubscription()
      setEstado(ass ? "ativo" : "inativo")
    })().catch(() => setEstado("sem-suporte"))
  }, [])

  async function ativar() {
    if (ocupado) return
    setOcupado(true)
    setMsg(null)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== "granted") {
        setMsg("Permissão negada — libere as notificações do site nas configurações do navegador.")
        return
      }
      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!chave) {
        setMsg("Push não configurado no servidor.")
        return
      }
      const reg = await navigator.serviceWorker.ready
      const ass = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaUint8(chave),
      })
      const r = await salvarAssinaturaPush(
        ass.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } },
      )
      if (!r.ok) {
        setMsg(r.erro)
        return
      }
      setEstado("ativo")
      setMsg("Alertas ativados neste aparelho.")
    } catch {
      setMsg("Não deu para ativar. No iPhone, primeiro instale o app: Compartilhar → Adicionar à Tela de Início.")
    } finally {
      setOcupado(false)
    }
  }

  async function desativar() {
    if (ocupado) return
    setOcupado(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const ass = await reg.pushManager.getSubscription()
      if (ass) {
        await removerAssinaturaPush(ass.endpoint)
        await ass.unsubscribe()
      }
      setEstado("inativo")
      setMsg(null)
    } finally {
      setOcupado(false)
    }
  }

  async function teste() {
    if (ocupado) return
    setOcupado(true)
    setMsg(null)
    const r = await enviarPushTeste()
    setMsg(r.ok ? "Enviado — a notificação deve chegar em segundos." : r.erro)
    setOcupado(false)
  }

  return (
    <div className="rounded-[14px] border border-line bg-panel p-4">
      <p className="text-sm font-semibold">Alertas neste aparelho</p>
      {estado === "sem-suporte" && (
        <p className="mt-1.5 text-xs text-dim">
          Este navegador não suporta notificações. No iPhone, instale o app primeiro:
          Compartilhar → Adicionar à Tela de Início.
        </p>
      )}
      {estado === "inativo" && (
        <button onClick={ativar} disabled={ocupado}
          className="mt-3 w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto disabled:opacity-60">
          Ativar alertas neste aparelho
        </button>
      )}
      {estado === "ativo" && (
        <div className="mt-3 flex gap-2">
          <button onClick={teste} disabled={ocupado}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-medium disabled:opacity-60">
            Enviar teste
          </button>
          <button onClick={desativar} disabled={ocupado}
            className="flex-1 rounded-xl border border-crit/40 py-2.5 text-sm font-medium text-crit disabled:opacity-60">
            Desativar
          </button>
        </div>
      )}
      {msg && <p className="mt-2.5 text-xs text-dim">{msg}</p>}
    </div>
  )
}
```

- [ ] **Step 3:** `npm test` 54/54; `npm run build` verde. Commit: `git add web; git commit -m "feat: assinatura de push com ativacao e teste por aparelho"`

---

### Task 5: Rota de disparo de alertas

**Files:**
- Create: `web/app/api/alertas/disparar/route.ts`

**Interfaces:**
- Consumes: `calcularSemaforo`, `itemMonitoradoToItemCalc` (de `@/lib/domain/conversores`), `janelaDoAlerta`/`cicloRef`/`textoDoAlerta`, `hojeISO` (de `@/lib/domain/datas`), tipos.
- Produces: `POST /api/alertas/disparar` com `Authorization: Bearer ${ALERTAS_SEGREDO}` → JSON `{ alertas, pushes, emails, removidas }`.

- [ ] **Step 1: `web/app/api/alertas/disparar/route.ts`:**

```ts
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import type { Equipamento, ItemMonitorado, PushAssinatura } from "@/lib/db/types"
import { cicloRef, janelaDoAlerta, textoDoAlerta } from "@/lib/domain/alertas"
import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { hojeISO } from "@/lib/domain/datas"
import { calcularSemaforo } from "@/lib/domain/semaforo"

export async function POST(req: NextRequest) {
  const segredo = process.env.ALERTAS_SEGREDO
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 })
  }
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivada = process.env.VAPID_PRIVATE_KEY
  if (!chaveServico || !vapidPublica || !vapidPrivada) {
    return NextResponse.json(
      { erro: "configure SUPABASE_SERVICE_ROLE_KEY e as chaves VAPID no ambiente" },
      { status: 500 },
    )
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })
  webpush.setVapidDetails("mailto:atendimento.smu@gmail.com", vapidPublica, vapidPrivada)

  const [itensR, equipamentosR, vinculosR, assinaturasR, enviadosR] = await Promise.all([
    admin.from("itens_monitorados").select("*"),
    admin.from("equipamentos").select("*"),
    admin.from("vinculos").select("usuario_id, embarcacao_id"),
    admin.from("push_assinaturas").select("*"),
    admin.from("alertas_enviados").select("item_monitorado_id, janela, ciclo_ref"),
  ])
  const falha = [itensR, equipamentosR, vinculosR, assinaturasR, enviadosR].find((r) => r.error)
  if (falha) return NextResponse.json({ erro: "falha ao carregar dados" }, { status: 500 })

  const hoje = hojeISO()
  const eqPorId = new Map(((equipamentosR.data ?? []) as Equipamento[]).map((e) => [e.id, e]))
  const jaEnviado = new Set(
    (enviadosR.data ?? []).map((e) => `${e.item_monitorado_id}|${e.janela}|${e.ciclo_ref}`),
  )
  const usuariosPorBarco = new Map<string, string[]>()
  for (const v of vinculosR.data ?? []) {
    usuariosPorBarco.set(v.embarcacao_id, [...(usuariosPorBarco.get(v.embarcacao_id) ?? []), v.usuario_id])
  }
  const assinaturas = (assinaturasR.data ?? []) as PushAssinatura[]

  let alertas = 0
  let pushes = 0
  let emails = 0
  let removidas = 0

  for (const item of (itensR.data ?? []) as ItemMonitorado[]) {
    const eq = item.equipamento_id ? eqPorId.get(item.equipamento_id) : undefined
    const r = calcularSemaforo(itemMonitoradoToItemCalc(item), eq?.horas_atuais ?? null, hoje)
    const janela = janelaDoAlerta(r)
    if (!janela) continue
    const ref = cicloRef(item)
    if (jaEnviado.has(`${item.id}|${janela}|${ref}`)) continue

    const nomeAlvo = eq
      ? `${eq.tipo === "motor" ? "Motor" : eq.tipo === "gerador" ? "Gerador" : eq.tipo === "bateria" ? "Bateria" : "Equipamento"} ${eq.posicao ?? ""}`.trim()
      : null
    const { titulo, corpo } = textoDoAlerta(item.nome, nomeAlvo, janela, r)

    const { error: erroRegistro } = await admin.from("alertas_enviados").insert({
      embarcacao_id: item.embarcacao_id,
      item_monitorado_id: item.id,
      janela,
      ciclo_ref: ref,
      titulo,
    })
    if (erroRegistro) continue // duplicata (unique) — outro disparo chegou primeiro
    alertas++

    const usuarios = usuariosPorBarco.get(item.embarcacao_id) ?? []
    for (const u of usuarios) {
      for (const a of assinaturas.filter((s) => s.usuario_id === u)) {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            JSON.stringify({ titulo, corpo, url: "/notificacoes" }),
          )
          pushes++
        } catch {
          await admin.from("push_assinaturas").delete().eq("endpoint", a.endpoint)
          removidas++
        }
      }
      if (process.env.RESEND_API_KEY) {
        const { data: dadosUsuario } = await admin.auth.admin.getUserById(u)
        const email = dadosUsuario?.user?.email
        if (email) {
          const resposta = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Commander <onboarding@resend.dev>",
              to: email,
              subject: titulo,
              text: `${titulo}\n\n${corpo}\n\nAbra o Commander para ver os detalhes.`,
            }),
          })
          if (resposta.ok) emails++
        }
      }
    }
  }

  return NextResponse.json({ alertas, pushes, emails, removidas })
}
```

- [ ] **Step 2: teste manual da rota** (dev server rodando):

```powershell
# sem segredo -> 401
curl.exe -s -o NUL -w "%{http_code}" -X POST http://localhost:3010/api/alertas/disparar
```

Expected: `401`. (O caminho 200 depende do SUPABASE_SERVICE_ROLE_KEY manual; sem ele, com o Bearer correto, Expected: `500` com a mensagem de configuração.)

- [ ] **Step 3:** `npm test` 54/54; `npm run build` verde (rota `/api/alertas/disparar`). Commit: `git add web; git commit -m "feat: rota de disparo de alertas com dedupe e limpeza de assinaturas"`

---

### Task 6: Central de Notificações + Menu + error.tsx

**Files:**
- Modify: `web/app/(app)/notificacoes/page.tsx` (substituir stub), `web/app/(app)/menu/page.tsx`
- Create: `web/app/error.tsx`

**Interfaces:**
- Consumes: `carregarPainel`, `hojeISO`, `itemMonitoradoToItemCalc`, `calcularSemaforo`, `textoRestante`, `PESO`, `Farol`, `<AtivarAlertas />`, tipo `AlertaEnviado`.

- [ ] **Step 1: substituir `web/app/(app)/notificacoes/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { AtivarAlertas } from "@/components/ativar-alertas"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo, textoRestante, PESO } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlertaEnviado } from "@/lib/db/types"

export default async function NotificacoesPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const hoje = hojeISO()
  const supabase = await supabaseServer()
  const { data: enviados } = await supabase
    .from("alertas_enviados")
    .select("id, titulo, janela, enviado_em")
    .eq("embarcacao_id", painel.embarcacao.id)
    .order("enviado_em", { ascending: false })
    .limit(20)

  const ativos = painel.itens
    .map((i) => {
      const eq = painel.equipamentos.find((e) => e.id === i.equipamento_id)
      const r = calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje)
      const onde = eq ? `${i.nome} — Motor ${eq.posicao ?? ""}`.trim() : i.nome
      return { i, r, onde }
    })
    .filter((a) => a.r.status !== "ok")
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])

  return (
    <main>
      <h1 className="text-xl font-semibold">Notificações</h1>

      <div className="mt-4">
        <AtivarAlertas />
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        Alertas ativos
      </p>
      {ativos.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-panel p-4 text-sm text-dim">
          Nada vencido nem na margem. Bom vento e mar calmo.
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-panel px-4">
          {ativos.map(({ i, r, onde }) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <p className="min-w-0 flex-1 text-sm font-medium">{onde}</p>
              <span className="font-mono-instr text-xs tabular-nums text-dim">{textoRestante(r)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">
        Avisos enviados
      </p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {(enviados ?? []).length === 0 && (
          <p className="py-4 text-sm text-dim">
            Nenhum aviso enviado ainda. Quando um item entrar na margem, você recebe aqui e no aparelho.
          </p>
        )}
        {((enviados ?? []) as Pick<AlertaEnviado, "id" | "titulo" | "janela" | "enviado_em">[]).map((a) => (
          <div key={a.id} className="border-b border-line py-3 last:border-0">
            <p className="text-sm font-medium">{a.titulo}</p>
            <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
              {new Date(a.enviado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Menu** — em `web/app/(app)/menu/page.tsx`, na lista "Em breve", remover `"Configurar alertas"` do array e adicionar ANTES do bloco "Em breve":

```tsx
      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Alertas</p>
      <Link href="/notificacoes" className="block rounded-[14px] border border-line bg-panel px-4 py-3.5">
        <p className="text-sm font-medium">Configurar alertas</p>
        <p className="mt-0.5 text-xs text-dim">Ative os avisos por aparelho e veja o histórico</p>
      </Link>
```

(adicionar `import Link from "next/link"`.)

- [ ] **Step 3: `web/app/error.tsx`:**

```tsx
"use client"

export default function Erro({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono-instr text-[11px] uppercase tracking-[.2em] text-dim">Commander</p>
      <h1 className="mt-3 text-xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-sm text-dim">
        Não foi possível carregar seus dados. Verifique a conexão e tente de novo.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-accent px-6 py-3 font-semibold text-acao-texto"
      >
        Tentar de novo
      </button>
    </main>
  )
}
```

- [ ] **Step 4: verificação final da fase** — `npm test` 54/54; `npm run build` verde. Commit: `git add web; git commit -m "feat: central de notificacoes, atalho no menu e tela de erro amigavel"`

---

## Self-review (executado na escrita)

- **Cobertura:** push por aparelho + teste (T4), disparo com dedupe por (item, janela, ciclo_ref) e limpeza de endpoints mortos (T5), e-mail best-effort (T5), PWA instalável com ícones da marca (T2), central com alertas ativos + histórico (T6), error.tsx (T6 — mata débito da F1), regra 30/15/5 + margem de horas em domínio puro testado (T3). Agendamento (cron) documentado como fase 6 — decisão declarada.
- **Placeholders:** nenhum.
- **Tipos:** `JanelaAlerta` do domínio ⊂ `JanelaAlertaDb` (iguais); `textoDoAlerta` consumido em T5 com a mesma assinatura; payload do push `{ titulo, corpo, url }` idêntico em T2 (sw.js), T4 (teste) e T5 (rota); `AtivarAlertas` consumido em T6.

# Commander Fase 5 — Tripulação e Marketplace vitrine: Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PROP convida comandante por link com preset de permissões, gerencia a tripulação numa matriz completa aba × ver/editar (com enforcement RLS nas áreas sensíveis), e o Marketplace vira vitrine real de perfis de comandante — sem selo "Verificado" até o aval jurídico (badge "documentação declarada").

**Architecture:** `vinculos.permissoes` (jsonb) guarda a matriz; PROP tem `permissoes = null` (tudo liberado). Helpers SQL `eh_prop(emb)` e `permissao(emb, aba, modo)` (SECURITY DEFINER) alimentam as policies novas: `documentos`, `contatos` e o prefixo `documentos/` do bucket passam a respeitar a matriz; edição dos dados da embarcação vira PROP-only. Convite = tabela `convites` (código curto, validade 7 dias) gerenciada pelo PROP via RLS + RPCs `info_convite`/`aceitar_convite` (SECURITY DEFINER) para o convidado. O domínio puro `permissoes.ts` (TDD) é a fonte única de abas, presets e leitura da matriz no app; `carregarPainel` passa a expor `papel` e `permissoes` e as páginas sensíveis fazem guard server-side. Enforcement RLS por aba nas DEMAIS tabelas (eventos/itens/equipamentos) fica declarado para a fase 7 junto do jurídico — nesta fase o Operacional continua podendo registrar operação, que é o desenho da espec.

**Tech Stack:** o existente. Nenhuma dependência nova.

## Global Constraints

- PT-BR; tokens; dígitos `font-mono-instr tabular-nums`; helpers de redirect `function ...(): never`; toda escrita captura `error`; convenção cache() (nada de `carregarPainel` após escrita na mesma action).
- RLS: nunca `USING (true)`; RPCs SECURITY DEFINER com `set search_path = public` e `revoke ... from public, anon`.
- Selo "Verificado" NUNCA é atribuído nesta fase (`verificado boolean default false`, sem caminho de escrita); perfis exibem badge "documentação declarada".
- Abas da matriz (exatas): `embarcacao`, `motores`, `eletrica`, `casco`, `documentos`, `contatos`, `gastos`, `diario`. Editar implica ver. PROP = matriz null = tudo.
- Presets exatos: **Completo** (tudo ver+editar) e **Operacional** (embarcacao: ver; motores: ver+editar; eletrica: ver+editar; casco: ver; diario: ver+editar; documentos/contatos/gastos: nada) — espelho da espec v1.1 §2.
- Convite: código de 10 chars, expira em 7 dias, uso único; link compartilhado por WhatsApp.
- Login preserva destino: `/login?volta=<path>` (só paths começando com "/" são honrados).

---

## Estrutura de arquivos

```
web/
├─ lib/domain/permissoes.ts (+ .test.ts)   ABAS, ROTULO_ABA, Permissoes, PRESETS, normalizar, podeVer/podeEditar
├─ lib/acoes/convites.ts                   criarConvite, revogarConvite, aceitarConvite
├─ lib/acoes/vinculos.ts                   salvarMatriz, aplicarPreset, removerCmdt
├─ lib/acoes/perfil-comandante.ts          salvarPerfilComandante
├─ lib/consultas.ts                        carregarPainel ganha papel + permissoes
├─ app/(app)/menu/tripulacao/page.tsx      lista tripulação + convites + novo convite
├─ app/(app)/menu/tripulacao/[id]/page.tsx matriz aba × ver/editar + presets + remover
├─ app/(app)/convite/[codigo]/page.tsx     aceite do convite (autenticado; volta pós-login)
├─ app/(app)/marketplace/page.tsx          vitrine real (substitui stub)
├─ app/(app)/marketplace/perfil/page.tsx   meu perfil de comandante
├─ app/(app)/menu/page.tsx                 "Convidar comandante" vira link (PROP)
├─ app/(app)/barco/documentos|contatos|gastos/page.tsx  guards pela matriz
├─ app/(app)/barco/page.tsx + hoje/page.tsx  links condicionais
├─ app/(auth)/login/page.tsx + lib/acoes/auth.ts  suporte a ?volta=
├─ middleware.ts                            redireciona preservando o destino
└─ supabase/migrations/008_tripulacao_marketplace.sql
```

---

### Task 1: Migration 008 + tipos

**Files:**
- Migration `008_tripulacao_marketplace` via MCP (conector `mcp__6dcbebfb-...`, projeto `khgjtxvmduizyooqaoox`) + `supabase/migrations/008_tripulacao_marketplace.sql` (mesmo SQL)
- Modify: `web/lib/db/types.ts`

**Interfaces:**
- Produces: `vinculos.permissoes jsonb`; tabelas `convites` e `perfis_comandante`; helpers `eh_prop`/`permissao`; RPCs `info_convite(p_codigo)` → `{ nome_embarcacao text, valido boolean }` e `aceitar_convite(p_codigo)` → uuid; policies novas de documentos/contatos/embarcacoes/vinculos/profiles/storage. Tipos TS: `Convite`, `PerfilComandante`, `Vinculo` (com permissoes), campo em `Vinculo`.

- [ ] **Step 1: aplicar a migration** (e gravar idêntica em `supabase/migrations/008_tripulacao_marketplace.sql`):

```sql
alter table public.vinculos add column permissoes jsonb;
alter table public.vinculos drop constraint vinculos_nivel_check;

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  codigo text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  permissoes jsonb not null,
  nivel text not null default 'operacional',
  criado_por uuid references public.profiles(id) on delete set null,
  expira_em timestamptz not null default now() + interval '7 days',
  usado_por uuid references public.profiles(id),
  usado_em timestamptz,
  created_at timestamptz not null default now()
);

create table public.perfis_comandante (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  nome_publico text not null,
  categoria text,
  cidade text,
  bio text,
  telefone text,
  disponibilidade text,
  visivel boolean not null default true,
  verificado boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.eh_prop(emb uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb and v.usuario_id = auth.uid() and v.papel = 'PROP'
  );
$$;
revoke all on function public.eh_prop(uuid) from public, anon;
grant execute on function public.eh_prop(uuid) to authenticated;

create or replace function public.permissao(emb uuid, aba text, modo text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.vinculos v
    where v.embarcacao_id = emb
      and v.usuario_id = auth.uid()
      and (
        v.papel = 'PROP'
        or coalesce((v.permissoes -> aba ->> modo)::boolean, false)
      )
  );
$$;
revoke all on function public.permissao(uuid, text, text) from public, anon;
grant execute on function public.permissao(uuid, text, text) to authenticated;

alter table public.convites enable row level security;
create policy "convites: prop gerencia" on public.convites for all
  using (public.eh_prop(embarcacao_id)) with check (public.eh_prop(embarcacao_id));

alter table public.perfis_comandante enable row level security;
create policy "perfis: vitrine" on public.perfis_comandante for select
  using (visivel = true or usuario_id = auth.uid());
create policy "perfis: proprio insert" on public.perfis_comandante for insert
  with check (usuario_id = auth.uid());
create policy "perfis: proprio update" on public.perfis_comandante for update
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "vinculos: prop atualiza cmdt" on public.vinculos for update
  using (public.eh_prop(embarcacao_id) and papel = 'CMDT')
  with check (public.eh_prop(embarcacao_id) and papel = 'CMDT');
create policy "vinculos: prop remove cmdt" on public.vinculos for delete
  using (public.eh_prop(embarcacao_id) and papel = 'CMDT');

drop policy "proprio perfil: ver" on public.profiles;
create policy "perfil: proprio ou tripulacao" on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.vinculos v1
      join public.vinculos v2 on v1.embarcacao_id = v2.embarcacao_id
      where v1.usuario_id = auth.uid() and v2.usuario_id = profiles.id
    )
  );

drop policy "documentos: ver pela matriz" on public.documentos;
drop policy if exists "documentos: tudo com vinculo" on public.documentos;
create policy "documentos: ver pela matriz" on public.documentos for select
  using (public.permissao(embarcacao_id, 'documentos', 'ver'));
create policy "documentos: criar pela matriz" on public.documentos for insert
  with check (public.permissao(embarcacao_id, 'documentos', 'editar'));
create policy "documentos: atualizar pela matriz" on public.documentos for update
  using (public.permissao(embarcacao_id, 'documentos', 'editar'))
  with check (public.permissao(embarcacao_id, 'documentos', 'editar'));
create policy "documentos: excluir pela matriz" on public.documentos for delete
  using (public.permissao(embarcacao_id, 'documentos', 'editar'));

drop policy "contatos: tudo com vinculo" on public.contatos;
create policy "contatos: ver pela matriz" on public.contatos for select
  using (public.permissao(embarcacao_id, 'contatos', 'ver'));
create policy "contatos: criar pela matriz" on public.contatos for insert
  with check (public.permissao(embarcacao_id, 'contatos', 'editar'));
create policy "contatos: atualizar pela matriz" on public.contatos for update
  using (public.permissao(embarcacao_id, 'contatos', 'editar'))
  with check (public.permissao(embarcacao_id, 'contatos', 'editar'));
create policy "contatos: excluir pela matriz" on public.contatos for delete
  using (public.permissao(embarcacao_id, 'contatos', 'editar'));

drop policy "embarcacao: editar" on public.embarcacoes;
create policy "embarcacao: prop edita" on public.embarcacoes for update
  using (public.eh_prop(id)) with check (public.eh_prop(id));

drop policy "acervo: ler com vinculo" on storage.objects;
create policy "acervo: ler pela matriz" on storage.objects for select to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'ver'))
      or ((storage.foldername(name))[2] <> 'documentos'
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );

create or replace function public.info_convite(p_codigo text)
returns table (nome_embarcacao text, valido boolean)
language sql security definer stable set search_path = public as $$
  select e.nome, (c.usado_em is null and c.expira_em > now())
  from public.convites c
  join public.embarcacoes e on e.id = c.embarcacao_id
  where c.codigo = p_codigo;
$$;
revoke all on function public.info_convite(text) from public, anon;
grant execute on function public.info_convite(text) to authenticated;

create or replace function public.aceitar_convite(p_codigo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into c from public.convites
    where codigo = p_codigo and usado_em is null and expira_em > now();
  if not found then
    raise exception 'convite inválido ou expirado';
  end if;
  if exists (
    select 1 from public.vinculos
    where embarcacao_id = c.embarcacao_id and usuario_id = auth.uid()
  ) then
    raise exception 'você já faz parte desta tripulação';
  end if;
  insert into public.vinculos (usuario_id, embarcacao_id, papel, nivel, permissoes)
    values (auth.uid(), c.embarcacao_id, 'CMDT', c.nivel, c.permissoes);
  update public.convites set usado_por = auth.uid(), usado_em = now() where id = c.id;
  return c.embarcacao_id;
end $$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;
```

Nota: se o primeiro `drop policy "documentos: ver pela matriz"` falhar por não existir, remova essa linha (ela só existe como salvaguarda de reexecução) e mantenha o `drop ... "documentos: tudo com vinculo"`.

- [ ] **Step 2: advisors** security: nenhuma tabela sem RLS.

- [ ] **Step 3: tipos** — acrescentar/ajustar em `web/lib/db/types.ts`:

```ts
export interface Vinculo {
  id: string
  usuario_id: string
  embarcacao_id: string
  papel: "PROP" | "CMDT"
  nivel: string
  permissoes: Record<string, { ver?: boolean; editar?: boolean }> | null
  created_at: string
}

export interface Convite {
  id: string
  embarcacao_id: string
  codigo: string
  permissoes: Record<string, { ver?: boolean; editar?: boolean }>
  nivel: string
  criado_por: string | null
  expira_em: string
  usado_por: string | null
  usado_em: string | null
  created_at: string
}

export interface PerfilComandante {
  usuario_id: string
  nome_publico: string
  categoria: string | null
  cidade: string | null
  bio: string | null
  telefone: string | null
  disponibilidade: string | null
  visivel: boolean
  verificado: boolean
  created_at: string
}
```

- [ ] **Step 4:** `npm test` 63/63, `npm run build` verde. Commit: `git add web supabase; git commit -m "feat: migration tripulacao/marketplace - permissoes, convites e perfis"`

---

### Task 2: Domínio — permissões (TDD)

**Files:**
- Create: `web/lib/domain/permissoes.ts`, `web/lib/domain/permissoes.test.ts`

**Interfaces:**
- Produces:
  - `const ABAS = ["embarcacao","motores","eletrica","casco","documentos","contatos","gastos","diario"] as const` · `type Aba = (typeof ABAS)[number]`
  - `const ROTULO_ABA: Record<Aba, string>` (Embarcação, Motores, Elétrica, Casco, Documentos, Contatos, Gastos, Diário)
  - `interface PermissaoAba { ver: boolean; editar: boolean }` · `type Permissoes = Record<Aba, PermissaoAba>`
  - `const PRESETS: Record<"completo" | "operacional", Permissoes>`
  - `normalizarPermissoes(bruto: unknown): Permissoes` (desconhecido/faltante → false/false; `editar: true` força `ver: true`)
  - `podeVer(p: Permissoes | null, aba: Aba): boolean` e `podeEditar(p: Permissoes | null, aba: Aba): boolean` — `null` (PROP) → sempre true.

- [ ] **Step 1: testes primeiro** — `web/lib/domain/permissoes.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { ABAS, PRESETS, normalizarPermissoes, podeEditar, podeVer } from "./permissoes"

describe("presets", () => {
  it("completo libera tudo", () => {
    for (const aba of ABAS) {
      expect(PRESETS.completo[aba]).toEqual({ ver: true, editar: true })
    }
  })
  it("operacional espelha a espec", () => {
    expect(PRESETS.operacional.motores).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.eletrica).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.diario).toEqual({ ver: true, editar: true })
    expect(PRESETS.operacional.embarcacao).toEqual({ ver: true, editar: false })
    expect(PRESETS.operacional.casco).toEqual({ ver: true, editar: false })
    expect(PRESETS.operacional.documentos).toEqual({ ver: false, editar: false })
    expect(PRESETS.operacional.contatos).toEqual({ ver: false, editar: false })
    expect(PRESETS.operacional.gastos).toEqual({ ver: false, editar: false })
  })
})

describe("normalizarPermissoes", () => {
  it("preenche abas faltantes com nada", () => {
    const p = normalizarPermissoes({ motores: { ver: true } })
    expect(p.motores).toEqual({ ver: true, editar: false })
    expect(p.documentos).toEqual({ ver: false, editar: false })
  })
  it("editar implica ver", () => {
    const p = normalizarPermissoes({ casco: { editar: true } })
    expect(p.casco).toEqual({ ver: true, editar: true })
  })
  it("lixo vira tudo falso", () => {
    const p = normalizarPermissoes("qualquer coisa")
    for (const aba of ABAS) {
      expect(p[aba]).toEqual({ ver: false, editar: false })
    }
  })
})

describe("podeVer/podeEditar", () => {
  it("null (PROP) libera tudo", () => {
    expect(podeVer(null, "gastos")).toBe(true)
    expect(podeEditar(null, "documentos")).toBe(true)
  })
  it("matriz manda para CMDT", () => {
    expect(podeVer(PRESETS.operacional, "documentos")).toBe(false)
    expect(podeEditar(PRESETS.operacional, "motores")).toBe(true)
    expect(podeEditar(PRESETS.operacional, "casco")).toBe(false)
  })
})
```

- [ ] **Step 2:** `npm test` → FAIL (módulo inexistente).

- [ ] **Step 3: `web/lib/domain/permissoes.ts`:**

```ts
export const ABAS = [
  "embarcacao", "motores", "eletrica", "casco",
  "documentos", "contatos", "gastos", "diario",
] as const

export type Aba = (typeof ABAS)[number]

export const ROTULO_ABA: Record<Aba, string> = {
  embarcacao: "Embarcação", motores: "Motores", eletrica: "Elétrica", casco: "Casco",
  documentos: "Documentos", contatos: "Contatos", gastos: "Gastos", diario: "Diário",
}

export interface PermissaoAba {
  ver: boolean
  editar: boolean
}

export type Permissoes = Record<Aba, PermissaoAba>

function montar(entradas: Partial<Record<Aba, PermissaoAba>>): Permissoes {
  const base = {} as Permissoes
  for (const aba of ABAS) {
    base[aba] = entradas[aba] ?? { ver: false, editar: false }
  }
  return base
}

export const PRESETS: Record<"completo" | "operacional", Permissoes> = {
  completo: montar(
    Object.fromEntries(ABAS.map((a) => [a, { ver: true, editar: true }])),
  ),
  operacional: montar({
    embarcacao: { ver: true, editar: false },
    motores: { ver: true, editar: true },
    eletrica: { ver: true, editar: true },
    casco: { ver: true, editar: false },
    diario: { ver: true, editar: true },
  }),
}

export function normalizarPermissoes(bruto: unknown): Permissoes {
  const objeto = typeof bruto === "object" && bruto !== null ? (bruto as Record<string, unknown>) : {}
  const resultado = {} as Permissoes
  for (const aba of ABAS) {
    const entrada = typeof objeto[aba] === "object" && objeto[aba] !== null
      ? (objeto[aba] as Record<string, unknown>)
      : {}
    const editar = entrada.editar === true
    const ver = editar || entrada.ver === true
    resultado[aba] = { ver, editar }
  }
  return resultado
}

export function podeVer(p: Permissoes | null, aba: Aba): boolean {
  return p === null || p[aba].ver
}

export function podeEditar(p: Permissoes | null, aba: Aba): boolean {
  return p === null || p[aba].editar
}
```

- [ ] **Step 4:** `npm test` → 71/71 PASS (63 + 8).
- [ ] **Step 5: Commit:** `git add web; git commit -m "feat: dominio da matriz de permissoes com presets (TDD)"`

---

### Task 3: Painel com papel/permissões + guards nas páginas sensíveis

**Files:**
- Modify: `web/lib/consultas.ts`, `web/app/(app)/barco/documentos/page.tsx`, `web/app/(app)/barco/contatos/page.tsx`, `web/app/(app)/barco/gastos/page.tsx`, `web/app/(app)/barco/local/page.tsx`, `web/app/(app)/barco/page.tsx`, `web/app/(app)/hoje/page.tsx`

**Interfaces:**
- Produces: `carregarPainel()` passa a retornar também `papel: "PROP" | "CMDT"` e `permissoes: Permissoes | null` (normalizada; null quando PROP). Consumida pelas Tasks 4-7.

- [ ] **Step 1: `carregarPainel`** — em `web/lib/consultas.ts`: importar `normalizarPermissoes, type Permissoes` de `@/lib/domain/permissoes`. Ampliar o tipo de retorno com `papel: "PROP" | "CMDT"` e `permissoes: Permissoes | null`. Após carregar a embarcação, buscar o vínculo do usuário:

```ts
  const { data: { user } } = await supabase.auth.getUser()
  const { data: vinculo, error: erroVinculo } = await supabase
    .from("vinculos")
    .select("papel, permissoes")
    .eq("embarcacao_id", embarcacao.id)
    .eq("usuario_id", user?.id ?? "")
    .maybeSingle()
  if (erroVinculo) throw new Error("Não foi possível carregar seu acesso. Recarregue a página.")
  const papel = (vinculo?.papel ?? "CMDT") as "PROP" | "CMDT"
  const permissoes = papel === "PROP" ? null : normalizarPermissoes(vinculo?.permissoes)
```

e incluir `papel, permissoes` no objeto retornado (mantendo os campos atuais).

- [ ] **Step 2: guards** — nas três páginas sensíveis, logo após `if (!painel) redirect("/onboarding")`:
  - `barco/documentos/page.tsx`: `if (!podeVer(painel.permissoes, "documentos")) redirect("/hoje?erro=" + encodeURIComponent("Seu acesso não inclui os documentos."))`
  - `barco/contatos/page.tsx`: idem com aba `"contatos"` e mensagem "Seu acesso não inclui os contatos."
  - `barco/gastos/page.tsx`: idem com aba `"gastos"` e mensagem "Seu acesso não inclui os gastos."
  (importar `podeVer` de `@/lib/domain/permissoes` nas três).
  - `barco/local/page.tsx`: `if (painel.papel !== "PROP") redirect("/hoje?erro=" + encodeURIComponent("Só o proprietário altera a posição da marina."))`

- [ ] **Step 3: links condicionais** —
  - `barco/page.tsx`: o grid "Acervo do barco" filtra os cards por permissão: Documentos exige `podeVer(permissoes,"documentos")`, Contatos `"contatos"`, Gastos `"gastos"` (Diário sempre). Implementação: array com campo `aba` opcional + `.filter((c) => !c.aba || podeVer(painel-permissoes, c.aba))` — a página já tem `itens`/`embarcacao` desestruturados; desestruturar também `permissoes`. O card "Posição da marina" só renderiza para `papel === "PROP"`.
  - `hoje/page.tsx`: no "Acesso rápido", filtrar "Docs" por `podeVer(permissoes,"documentos")` e "Contatos" por `"contatos"` (mesma técnica de campo `aba`); desestruturar `permissoes` do painel.

- [ ] **Step 4:** `npm test` 71/71; `npm run build` verde. Commit: `git add web; git commit -m "feat: painel expoe papel e permissoes com guards nas areas sensiveis"`

---

### Task 4: Login com volta + convite (página + aceite)

**Files:**
- Modify: `web/middleware.ts`, `web/app/(auth)/login/page.tsx`, `web/lib/acoes/auth.ts`
- Create: `web/lib/acoes/convites.ts` (só `aceitarConvite` nesta task; Task 5 adiciona criar/revogar no MESMO arquivo), `web/app/(app)/convite/[codigo]/page.tsx`

**Interfaces:**
- Produces: middleware redireciona `/x` → `/login?volta=%2Fx`; `entrar`/`cadastrar` honram `volta` (só paths iniciando com "/"); action `aceitarConvite(formData)` (campo `codigo`) → sucesso `/hoje`, falha `/convite/<codigo>?erro=...`.

- [ ] **Step 1: middleware** — em `web/middleware.ts`, trocar o redirect:

```ts
  if (!user && !rotaPublica) {
    const destino = new URL("/login", request.url)
    destino.searchParams.set("volta", request.nextUrl.pathname)
    return NextResponse.redirect(destino)
  }
```

- [ ] **Step 2: auth com volta** — `web/lib/acoes/auth.ts`:

```ts
function destinoSeguro(bruto: FormDataEntryValue | null, padrao: string): string {
  const v = String(bruto ?? "")
  return v.startsWith("/") && !v.startsWith("//") ? v : padrao
}
```

Em `entrar`: sucesso → `redirect(destinoSeguro(formData.get("volta"), "/hoje"))`; no erro, preservar: `redirect(\`/login?erro=...&volta=${encodeURIComponent(String(formData.get("volta") ?? ""))}\`)` (montar com encodeURIComponent no valor). Em `cadastrar`: sucesso → `redirect(destinoSeguro(formData.get("volta"), "/onboarding"))`; erro idem preservando `modo=cadastro`.
Em `web/app/(auth)/login/page.tsx`: searchParams ganha `volta?: string`; dentro do `<form>`, adicionar `<input type="hidden" name="volta" value={volta ?? ""} />`; os links de alternância entrar/cadastrar preservam `volta` quando presente (montar href com `new URLSearchParams`... — usar template simples: `href={cadastro ? \`/login${volta ? `?volta=${encodeURIComponent(volta)}` : ""}\` : \`/login?modo=cadastro${volta ? `&volta=${encodeURIComponent(volta)}` : ""}\`}`).

- [ ] **Step 3: action `aceitarConvite`** — criar `web/lib/acoes/convites.ts`:

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

export async function aceitarConvite(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim()
  function erroAceite(msg: string): never {
    redirect(`/convite/${encodeURIComponent(codigo)}?erro=${encodeURIComponent(msg)}`)
  }
  if (codigo === "") erroAceite("Convite inválido.")
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc("aceitar_convite", { p_codigo: codigo })
  if (error) {
    erroAceite(
      error.message.includes("expirado") || error.message.includes("inválido")
        ? "Este convite não é mais válido — peça um novo ao proprietário."
        : error.message.includes("tripulação")
          ? "Você já faz parte desta tripulação."
          : "Não foi possível aceitar o convite. Tente de novo.",
    )
  }
  revalidatePath("/hoje")
  redirect("/hoje")
}
```

- [ ] **Step 4: página do convite** — `web/app/(app)/convite/[codigo]/page.tsx`:

```tsx
import { aceitarConvite } from "@/lib/acoes/convites"
import { Logo } from "@/components/logo"
import { supabaseServer } from "@/lib/supabase/server"

export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { codigo } = await params
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data } = await supabase.rpc("info_convite", { p_codigo: codigo }).maybeSingle()
  const info = data as { nome_embarcacao: string; valido: boolean } | null

  return (
    <main className="pt-8 text-center">
      <div className="text-base"><Logo /></div>
      {erro && (
        <p className="mx-auto mt-5 max-w-[320px] rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>
      )}
      {!info ? (
        <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
          Convite não encontrado. Confira o link com o proprietário.
        </p>
      ) : !info.valido ? (
        <p className="mx-auto mt-6 max-w-[300px] text-sm text-dim">
          Este convite expirou ou já foi usado. Peça um novo ao proprietário.
        </p>
      ) : (
        <>
          <h1 className="mt-6 text-xl font-semibold">Você foi convidado para a tripulação</h1>
          <p className="mt-2 text-sm text-dim">
            Embarcação <span className="font-semibold text-texto">{info.nome_embarcacao}</span>
          </p>
          <form action={aceitarConvite} className="mx-auto mt-6 max-w-[320px]">
            <input type="hidden" name="codigo" value={codigo} />
            <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
              Entrar na tripulação
            </button>
          </form>
        </>
      )}
    </main>
  )
}
```

Nota: a rota vive no grupo `(app)` — o middleware manda quem não está logado para `/login?volta=/convite/<codigo>`, e o cadastro/login devolve para cá. O convidado sem embarcação própria NÃO deve ser mandado ao onboarding: `cadastrar` já honra `volta` (Step 2), e o guard de `/hoje` continua funcionando depois do aceite porque o vínculo passa a existir.

- [ ] **Step 5:** `npm test` 71/71; `npm run build` verde (rota `/convite/[codigo]`). Commit: `git add web; git commit -m "feat: convite aceito por link com login preservando destino"`

---

### Task 5: Tripulação — lista, novo convite, revogar

**Files:**
- Modify: `web/lib/acoes/convites.ts` (adicionar `criarConvite` e `revogarConvite`), `web/app/(app)/menu/page.tsx`
- Create: `web/app/(app)/menu/tripulacao/page.tsx`

**Interfaces:**
- Consumes: `PRESETS` do domínio; `carregarPainel` com `papel`.
- Produces: `criarConvite(formData)` (campo `nivel`: "completo" | "operacional") → `/menu/tripulacao?criado=<codigo>`; `revogarConvite(formData)` (campo `convite_id`).

- [ ] **Step 1: actions** — acrescentar em `web/lib/acoes/convites.ts`:

```ts
import { carregarPainel } from "@/lib/consultas"
import { PRESETS } from "@/lib/domain/permissoes"

function erroTripulacao(msg: string): never {
  redirect(`/menu/tripulacao?erro=${encodeURIComponent(msg)}`)
}

export async function criarConvite(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroTripulacao("Só o proprietário convida tripulação.")

  const nivel = String(formData.get("nivel") ?? "operacional") === "completo" ? "completo" : "operacional"
  const { data, error } = await supabase
    .from("convites")
    .insert({ embarcacao_id: painel.embarcacao.id, permissoes: PRESETS[nivel], nivel })
    .select("codigo")
    .single()
  if (error || !data) erroTripulacao("Não foi possível criar o convite. Tente de novo.")

  revalidatePath("/menu/tripulacao")
  redirect(`/menu/tripulacao?criado=${encodeURIComponent(data.codigo)}`)
}

export async function revogarConvite(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("convite_id") ?? "")
  const { error } = await supabase.from("convites").delete().eq("id", id).is("usado_em", null)
  if (error) erroTripulacao("Não foi possível revogar.")
  revalidatePath("/menu/tripulacao")
  redirect("/menu/tripulacao")
}
```

(os imports novos entram no topo do arquivo, junto dos existentes.)

- [ ] **Step 2: página** — `web/app/(app)/menu/tripulacao/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { criarConvite, revogarConvite } from "@/lib/acoes/convites"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import type { Convite, Vinculo } from "@/lib/db/types"

export default async function TripulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criado?: string }>
}) {
  const { erro, criado } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculos }, { data: convites }, { data: perfis }] = await Promise.all([
    supabase.from("vinculos").select("*").eq("embarcacao_id", painel.embarcacao.id).eq("papel", "CMDT"),
    supabase.from("convites").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .is("usado_em", null).gt("expira_em", new Date().toISOString()).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, nome"),
  ])
  const nomePorId = new Map((perfis ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]))

  const linkConvite = (codigo: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010"}/convite/${codigo}`

  return (
    <main>
      <a href="/menu" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Menu</a>
      <h1 className="mt-3 text-xl font-semibold">Tripulação</h1>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      {criado && (
        <div className="mt-4 rounded-[14px] border border-ok/40 bg-panel p-4">
          <p className="text-sm font-semibold">Convite criado</p>
          <p className="mt-1 break-all font-mono-instr text-xs text-dim">{linkConvite(criado)}</p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Entre na tripulação da ${painel.embarcacao.nome} no Commander: ${linkConvite(criado)}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg border border-ok/40 px-3 py-2 text-sm text-ok"
          >
            Compartilhar no WhatsApp
          </a>
        </div>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Comandantes com acesso</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((vinculos ?? []) as Vinculo[]).length === 0 && (
          <p className="py-4 text-sm text-dim">Ninguém além de você ainda. Crie um convite abaixo.</p>
        )}
        {((vinculos ?? []) as Vinculo[]).map((v) => (
          <Link key={v.id} href={`/menu/tripulacao/${v.id}`}
            className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{nomePorId.get(v.usuario_id) || "Comandante"}</p>
              <p className="mt-0.5 text-xs text-dim">
                {v.nivel === "completo" ? "Acesso completo" : v.nivel === "operacional" ? "Acesso operacional" : "Acesso personalizado"}
              </p>
            </div>
            <span className="text-dim">›</span>
          </Link>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Convites pendentes</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {((convites ?? []) as Convite[]).length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum convite aguardando.</p>
        )}
        {((convites ?? []) as Convite[]).map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-mono-instr text-sm tabular-nums">{c.codigo}</p>
              <p className="mt-0.5 text-xs text-dim">
                {c.nivel === "completo" ? "Completo" : "Operacional"} · expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <form action={revogarConvite}>
              <input type="hidden" name="convite_id" value={c.id} />
              <button className="text-xs text-crit">Revogar</button>
            </form>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Novo convite</p>
      <form action={criarConvite} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className="mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim" htmlFor="nivel">
            Acesso inicial
          </label>
          <select id="nivel" name="nivel" defaultValue="operacional"
            className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base">
            <option value="operacional">Operacional — registra horas e serviços, sem custos e documentos</option>
            <option value="completo">Completo — vê e edita tudo</option>
          </select>
        </div>
        <p className="text-xs text-dim">Você ajusta o acesso em detalhe depois, na matriz de permissões.</p>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Criar convite</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Menu** — em `web/app/(app)/menu/page.tsx`: obter o painel (`carregarPainel`) e, se `papel === "PROP"`, renderizar antes de "Em breve" um card-link "Tripulação" (mesmo padrão do card Alertas) href `/menu/tripulacao`, descrição "Convide comandantes e ajuste as permissões". Remover `"Convidar comandante"` da lista "Em breve" (fica só "Assinatura e faturas").

- [ ] **Step 4:** `npm test` 71/71; `npm run build` verde. Adicionar `NEXT_PUBLIC_APP_URL=http://localhost:3010` ao `web/.env.local` (documentar: em produção vira a URL real). Commit: `git add web; git commit -m "feat: tripulacao com convites por link e whatsapp"`

---

### Task 6: Matriz de permissões — editor por comandante

**Files:**
- Create: `web/lib/acoes/vinculos.ts`, `web/app/(app)/menu/tripulacao/[id]/page.tsx`

**Interfaces:**
- Consumes: `ABAS`, `ROTULO_ABA`, `PRESETS`, `normalizarPermissoes`; tipos `Vinculo`.
- Produces: `salvarMatriz(formData)` (campos `vinculo_id` + `<aba>_ver`/`<aba>_editar` checkboxes), `aplicarPreset(formData)` (`vinculo_id`, `preset`), `removerCmdt(formData)` (`vinculo_id`).

- [ ] **Step 1: `web/lib/acoes/vinculos.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ABAS, PRESETS, normalizarPermissoes, type Permissoes } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

function erroMatriz(vinculoId: string, msg: string): never {
  redirect(`/menu/tripulacao/${vinculoId}?erro=${encodeURIComponent(msg)}`)
}

async function atualizarVinculo(vinculoId: string, permissoes: Permissoes, nivel: string) {
  const supabase = await supabaseServer()
  const { error, count } = await supabase
    .from("vinculos")
    .update({ permissoes, nivel }, { count: "exact" })
    .eq("id", vinculoId)
  if (error || count === 0) erroMatriz(vinculoId, "Não foi possível salvar — confira seu acesso.")
  revalidatePath(`/menu/tripulacao/${vinculoId}`)
  revalidatePath("/menu/tripulacao")
}

export async function salvarMatriz(formData: FormData) {
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const bruto: Record<string, { ver: boolean; editar: boolean }> = {}
  for (const aba of ABAS) {
    bruto[aba] = {
      ver: formData.get(`${aba}_ver`) === "on",
      editar: formData.get(`${aba}_editar`) === "on",
    }
  }
  await atualizarVinculo(vinculoId, normalizarPermissoes(bruto), "custom")
  redirect(`/menu/tripulacao/${vinculoId}?salvo=1`)
}

export async function aplicarPreset(formData: FormData) {
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const preset = String(formData.get("preset") ?? "") === "completo" ? "completo" : "operacional"
  await atualizarVinculo(vinculoId, PRESETS[preset], preset)
  redirect(`/menu/tripulacao/${vinculoId}?salvo=1`)
}

export async function removerCmdt(formData: FormData) {
  const supabase = await supabaseServer()
  const vinculoId = String(formData.get("vinculo_id") ?? "")
  const { error } = await supabase.from("vinculos").delete().eq("id", vinculoId)
  if (error) erroMatriz(vinculoId, "Não foi possível remover.")
  revalidatePath("/menu/tripulacao")
  redirect("/menu/tripulacao")
}
```

Nota: RLS (`vinculos: prop atualiza/remove cmdt`) garante que só o PROP da embarcação — e nunca sobre o próprio PROP — consegue efetivar essas escritas; `count: "exact"` transforma o "0 linhas" da RLS em erro visível.

- [ ] **Step 2: página** — `web/app/(app)/menu/tripulacao/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation"
import { aplicarPreset, removerCmdt, salvarMatriz } from "@/lib/acoes/vinculos"
import { carregarPainel } from "@/lib/consultas"
import { ABAS, ROTULO_ABA, normalizarPermissoes } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Vinculo } from "@/lib/db/types"

export default async function MatrizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; salvo?: string }>
}) {
  const { id } = await params
  const { erro, salvo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") redirect("/menu")

  const supabase = await supabaseServer()
  const [{ data: vinculo }, { data: perfil }] = await Promise.all([
    supabase.from("vinculos").select("*").eq("id", id).eq("papel", "CMDT").maybeSingle(),
    supabase.from("vinculos").select("usuario_id").eq("id", id).maybeSingle()
      .then(async (r) => {
        if (!r.data) return { data: null }
        return supabase.from("profiles").select("nome").eq("id", r.data.usuario_id).maybeSingle()
      }),
  ])
  const v = vinculo as Vinculo | null
  if (!v || v.embarcacao_id !== painel.embarcacao.id) notFound()
  const permissoes = normalizarPermissoes(v.permissoes)
  const nome = (perfil as { nome: string } | null)?.nome || "Comandante"

  return (
    <main>
      <a href="/menu/tripulacao" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Tripulação</a>
      <h1 className="mt-3 text-xl font-semibold">{nome}</h1>
      <p className="mt-1 text-sm text-dim">Defina, aba por aba, o que este comandante vê e edita.</p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}
      {salvo && <p className="mt-3 rounded-lg border border-ok/40 bg-panel px-3 py-2 text-sm">Permissões salvas.</p>}

      <div className="mt-4 flex gap-2">
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="operacional" />
          <button className="w-full rounded-lg border border-line py-2 text-sm">Aplicar Operacional</button>
        </form>
        <form action={aplicarPreset} className="flex-1">
          <input type="hidden" name="vinculo_id" value={v.id} />
          <input type="hidden" name="preset" value="completo" />
          <button className="w-full rounded-lg border border-line py-2 text-sm">Aplicar Completo</button>
        </form>
      </div>

      <form action={salvarMatriz} className="mt-4">
        <input type="hidden" name="vinculo_id" value={v.id} />
        <div className="rounded-[14px] border border-line bg-panel px-4">
          <div className="flex items-center gap-3 border-b border-line py-2.5">
            <span className="flex-1 font-mono-instr text-[10px] uppercase tracking-[.14em] text-dim">Aba</span>
            <span className="w-12 text-center font-mono-instr text-[10px] uppercase tracking-[.14em] text-dim">Ver</span>
            <span className="w-12 text-center font-mono-instr text-[10px] uppercase tracking-[.14em] text-dim">Editar</span>
          </div>
          {ABAS.map((aba) => (
            <div key={aba} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <span className="flex-1 text-sm">{ROTULO_ABA[aba]}</span>
              <span className="flex w-12 justify-center">
                <input type="checkbox" name={`${aba}_ver`} defaultChecked={permissoes[aba].ver}
                  aria-label={`Ver ${ROTULO_ABA[aba]}`} className="size-5 accent-[#d4af37]" />
              </span>
              <span className="flex w-12 justify-center">
                <input type="checkbox" name={`${aba}_editar`} defaultChecked={permissoes[aba].editar}
                  aria-label={`Editar ${ROTULO_ABA[aba]}`} className="size-5 accent-[#d4af37]" />
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Marcar "Editar" libera "Ver" automaticamente ao salvar.</p>
        <button className="mt-3 w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Salvar permissões
        </button>
      </form>

      <form action={removerCmdt} className="mt-6">
        <input type="hidden" name="vinculo_id" value={v.id} />
        <button className="w-full rounded-xl border border-crit/40 py-3 text-sm font-semibold text-crit">
          Remover da tripulação
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3:** `npm test` 71/71; `npm run build` verde (rota `/menu/tripulacao/[id]`). Commit: `git add web; git commit -m "feat: matriz de permissoes por comandante com presets"`

---

### Task 7: Marketplace vitrine + meu perfil + integração final

**Files:**
- Modify: `web/app/(app)/marketplace/page.tsx` (substituir stub), `web/app/(app)/hoje/page.tsx` (seção comandantes)
- Create: `web/lib/acoes/perfil-comandante.ts`, `web/app/(app)/marketplace/perfil/page.tsx`

**Interfaces:**
- Consumes: tipos `PerfilComandante`.
- Produces: `salvarPerfilComandante(formData)` (upsert do próprio perfil; campos `nome_publico`, `categoria`, `cidade`, `bio`, `telefone`, `disponibilidade`, `visivel`).

- [ ] **Step 1: action** — `web/lib/acoes/perfil-comandante.ts`:

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"

function erroPerfil(msg: string): never {
  redirect(`/marketplace/perfil?erro=${encodeURIComponent(msg)}`)
}

export async function salvarPerfilComandante(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome_publico")
  if (!nome) erroPerfil("Informe seu nome profissional.")

  const { error } = await supabase.from("perfis_comandante").upsert({
    usuario_id: user.id,
    nome_publico: nome,
    categoria: texto("categoria"),
    cidade: texto("cidade"),
    bio: texto("bio"),
    telefone: texto("telefone"),
    disponibilidade: texto("disponibilidade"),
    visivel: formData.get("visivel") === "on",
  })
  if (error) erroPerfil("Não foi possível salvar o perfil. Tente de novo.")
  revalidatePath("/marketplace")
  redirect("/marketplace")
}
```

- [ ] **Step 2: vitrine** — substituir `web/app/(app)/marketplace/page.tsx`:

```tsx
import Link from "next/link"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

export default async function MarketplacePage() {
  const supabase = await supabaseServer()
  const { data: perfis, error } = await supabase
    .from("perfis_comandante").select("*").eq("visivel", true).order("created_at")
  if (error) throw new Error("Não foi possível carregar o marketplace. Recarregue a página.")

  return (
    <main>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Marketplace</h1>
        <Link href="/marketplace/perfil" className="text-sm text-accent-forte">Sou comandante</Link>
      </div>
      <p className="mt-1 text-sm text-dim">Comandantes disponíveis para contratar direto pelo WhatsApp.</p>

      <div className="mt-5 rounded-[14px] border border-line bg-panel px-4">
        {((perfis ?? []) as PerfilComandante[]).length === 0 && (
          <p className="py-5 text-sm text-dim">
            Nenhum comandante na vitrine ainda. É comandante? Toque em "Sou comandante" e crie seu perfil.
          </p>
        )}
        {((perfis ?? []) as PerfilComandante[]).map((p) => (
          <div key={p.usuario_id} className="border-b border-line py-3.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel2 font-mono-instr text-sm text-accent-forte">
                {p.nome_publico.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.nome_publico}</p>
                <p className="mt-0.5 text-xs text-dim">
                  {[p.categoria, p.cidade, p.disponibilidade].filter(Boolean).join(" · ")}
                </p>
              </div>
              {p.telefone && (
                <a href={`https://wa.me/55${p.telefone.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok">
                  WhatsApp
                </a>
              )}
            </div>
            {p.bio && <p className="mt-2 text-xs text-dim">{p.bio}</p>}
            <span className="mt-2 inline-block rounded border border-line px-1.5 py-0.5 font-mono-instr text-[9.5px] uppercase tracking-[.1em] text-dim">
              {p.verificado ? "Verificado" : "Documentação declarada"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-dim">
        O selo "Verificado" será emitido quando a validação documental entrar em operação.
        Até lá, os dados são declarados pelo próprio profissional e a contratação é combinada
        diretamente entre as partes.
      </p>
    </main>
  )
}
```

- [ ] **Step 3: meu perfil** — `web/app/(app)/marketplace/perfil/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { salvarPerfilComandante } from "@/lib/acoes/perfil-comandante"
import { supabaseServer } from "@/lib/supabase/server"
import type { PerfilComandante } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function PerfilComandantePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data } = await supabase
    .from("perfis_comandante").select("*").eq("usuario_id", user.id).maybeSingle()
  const p = data as PerfilComandante | null

  return (
    <main>
      <a href="/marketplace" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Marketplace</a>
      <h1 className="mt-3 text-xl font-semibold">Meu perfil de comandante</h1>
      <p className="mt-1 text-sm text-dim">Sua vitrine para os proprietários da plataforma.</p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={salvarPerfilComandante} className="mt-5 space-y-4">
        <div>
          <label className={rotulo} htmlFor="nome_publico">Nome profissional</label>
          <input id="nome_publico" name="nome_publico" required defaultValue={p?.nome_publico ?? ""} className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="categoria">Habilitação</label>
            <input id="categoria" name="categoria" list="categorias" defaultValue={p?.categoria ?? ""} placeholder="Capitão Amador" className={campo} />
            <datalist id="categorias">
              <option value="Arrais Amador" /><option value="Mestre Amador" />
              <option value="Capitão Amador" /><option value="Marinheiro Profissional" />
            </datalist>
          </div>
          <div>
            <label className={rotulo} htmlFor="cidade">Cidade</label>
            <input id="cidade" name="cidade" defaultValue={p?.cidade ?? ""} placeholder="Rio de Janeiro" className={campo} />
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="disponibilidade">Disponibilidade</label>
          <input id="disponibilidade" name="disponibilidade" defaultValue={p?.disponibilidade ?? ""} placeholder="Fins de semana e feriados" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="telefone">WhatsApp (com DDD)</label>
          <input id="telefone" name="telefone" inputMode="tel" defaultValue={p?.telefone ?? ""} placeholder="21 99999-0000" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="bio">Apresentação</label>
          <textarea id="bio" name="bio" rows={3} defaultValue={p?.bio ?? ""} placeholder="Experiência, embarcações que já comandou…" className={campo} />
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="visivel" defaultChecked={p?.visivel ?? true} className="size-5 accent-[#d4af37]" />
          Aparecer na vitrine do marketplace
        </label>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar perfil</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Hoje — comandantes disponíveis** — em `web/app/(app)/hoje/page.tsx`, buscar após o painel:

```tsx
  const { data: comandantes } = await supabase
    .from("perfis_comandante").select("usuario_id, nome_publico, categoria, disponibilidade")
    .eq("visivel", true).limit(2)
```

(a página ainda não tem `supabase` — criar via `supabaseServer()` importado de `@/lib/supabase/server`.) E renderizar ao FINAL do `<main>` (após "Acesso rápido"), só quando houver perfis:

```tsx
      {(comandantes ?? []).length > 0 && (
        <>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Comandantes disponíveis</p>
          <div className="rounded-[14px] border border-line bg-panel px-4">
            {(comandantes ?? []).map((c) => (
              <div key={c.usuario_id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.nome_publico}</p>
                  <p className="mt-0.5 text-xs text-dim">{[c.categoria, c.disponibilidade].filter(Boolean).join(" · ")}</p>
                </div>
                <Link href="/marketplace" className="text-xs text-accent-forte">Ver</Link>
              </div>
            ))}
          </div>
        </>
      )}
```

- [ ] **Step 5: verificação final da fase** — `npm test` 71/71; `npm run build` verde com rotas `/menu/tripulacao`, `/menu/tripulacao/[id]`, `/convite/[codigo]`, `/marketplace/perfil`; `npx eslint` limpo nos arquivos tocados. Commit: `git add web; git commit -m "feat: marketplace vitrine com perfis de comandante"`

---

## Self-review (executado na escrita)

- **Cobertura (espec v2.0 §2/§6 + decisão do Erick):** matriz completa aba × ver/editar (T2/T6) com enforcement RLS em documentos/contatos/storage/embarcação (T1) e guards de UI (T3); convite por link com preset (T4/T5); vitrine sem verificação com badge honesto e nota jurídica implícita no texto (T7); avaliações e contratação intermediada ficam para a fase 7 (transacional) — declarado. Enforcement RLS por aba em eventos/itens/equipamentos: fase 7, declarado na arquitetura.
- **Placeholders:** nenhum.
- **Tipos:** `Permissoes`/`ABAS` consumidos em T3/T5/T6 com os mesmos nomes; `carregarPainel().papel/permissoes` (T3) consumido em T5/T6/T7; nomes de campos de form batem com as actions (T5/T6/T7); RPCs `info_convite`/`aceitar_convite` (T1) batem com as chamadas em T4.

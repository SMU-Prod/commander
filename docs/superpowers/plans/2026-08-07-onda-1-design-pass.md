# Commander — Onda 1: Design pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o app da cara de planilha: foto da embarcação dominando o topo, os ícones da marca em todo o conteúdo, escala tipográfica e elevação de verdade, estados de carregamento, safe-area do iPhone e confirmação em ações destrutivas.

**Architecture:** Nada de biblioteca de UI nova. Um componente `<Icone>` com os paths da prancha (cor por `currentColor`), um `<CardEmbarcacao>` que serve Início e ficha, o módulo Fotos usando o bucket `acervo` que já existe, e três camadas de token novas em `globals.css` (sombra, raio, tipografia) aplicadas por classe utilitária. Tudo continua server component; só o que tem interação vira client.

**Tech Stack:** o existente (Next 16 App Router, Tailwind v4 com `@theme`, Supabase Storage). Zero dependência nova.

**Fonte:** `docs/auditoria/auditoria-uiux.md` §5 (plano priorizado) e `docs/auditoria/2026-08-07-sintese-360.md`.

## Global Constraints

- PT-BR em toda UI; controles dizem o que fazem; sem emoji como ícone.
- **Dourado `#D4AF37` nunca como texto ou elemento fino sobre fundo claro** (contraste 1.96:1). Sobre claro use `--acao-forte` `#8A6D1C`; o dourado puro só sobre navy ou como preenchimento de botão com texto navy.
- Mínimo de fonte em uso: **11px**; corpo 14px; apoio 13px; título de página 24px.
- Todo alvo de toque com ação destrutiva ou navegação: mínimo 44×44px.
- Foco visível global (`:focus-visible`) — hoje não existe nenhum.
- Tokens dos dois temas continuam a fonte única de cor; nenhum hex novo fora de `globals.css` (exceto os já aprovados: `#060d16` do horímetro e as sombras rgba).
- Upload de foto: mesmas regras do acervo (máx 10 MB, `image/jpeg|png|webp`), path `{embarcacao_id}/fotos/...`.
- Toda escrita captura `error`; helpers de redirect `function ...(): never`; `carregarPainel` nunca é chamado após escrita na mesma action.

---

## Estrutura de arquivos

```
web/
├─ components/icone.tsx                 <Icone nome=... /> — os paths da marca
├─ components/card-embarcacao.tsx       hero com foto + fallback navy + farol geral
├─ components/confirmar.tsx             client: intercepta submit destrutivo
├─ app/(app)/loading.tsx                skeleton do shell
├─ app/(app)/barco/fotos/page.tsx       álbuns + grid + cota
├─ app/(app)/barco/fotos/albuns.ts      ALBUNS + rótulos (domínio local)
├─ lib/acoes/fotos.ts                   subirFoto, excluirFoto, definirCapa
├─ lib/domain/cota.ts (+ .test.ts)      cotaUsada/limite/percentual (TDD)
├─ app/globals.css                      + tokens de sombra, raio e tipografia
├─ app/(auth)/login/page.tsx            fundo navy (marca legível)
├─ app/(app)/hoje/page.tsx              hero + linha de alerta + ícones
├─ app/(app)/barco/page.tsx             hero + ícones nas listas e cards
├─ app/(app)/barco/{documentos,contatos,gastos}/page.tsx  ícones + confirmação
├─ app/(app)/menu/tripulacao/page.tsx   confirmação em revogar
├─ components/bottom-nav.tsx            usa <Icone> + safe-area
└─ app/layout.tsx                       viewportFit: "cover"
```

Migration `013_fotos`: tabela `fotos` + coluna `embarcacoes.foto_capa_path`.

---

### Task 1: Fundação visual — tokens, foco, safe-area e login navy

**Files:**
- Modify: `web/app/globals.css`, `web/app/layout.tsx`, `web/components/bottom-nav.tsx`, `web/components/registro-rapido.tsx`, `web/app/(auth)/login/page.tsx`

**Interfaces:**
- Produces: classes utilitárias `.sombra-1`, `.sombra-2`, `.titulo-pagina`, `.titulo-card`, `.corpo`, `.apoio`, `.rotulo` usadas por todas as tasks seguintes; `:focus-visible` global; safe-area na nav e no FAB.

- [ ] **Step 1: tokens e utilitárias** — acrescentar ao FINAL de `web/app/globals.css` (antes de nada remover o que já existe):

```css
/* Elevação — sombra tingida de navy, não preto puro */
:root {
  --sombra-1: 0 1px 2px rgb(11 29 45 / .06), 0 1px 3px rgb(11 29 45 / .04);
  --sombra-2: 0 4px 16px rgb(11 29 45 / .10), 0 2px 4px rgb(11 29 45 / .06);
}
[data-theme="dark"] {
  --sombra-1: 0 1px 2px rgb(0 0 0 / .3);
  --sombra-2: 0 6px 20px rgb(0 0 0 / .45);
}

.sombra-1 { box-shadow: var(--sombra-1); }
.sombra-2 { box-shadow: var(--sombra-2); }

/* Escala tipográfica — 4 vozes, nada abaixo de 11px */
.titulo-pagina {
  font-size: 1.5rem;      /* 24px */
  font-weight: 600;
  letter-spacing: -.015em;
  line-height: 1.2;
  text-wrap: balance;
}
.titulo-card { font-size: .9375rem; font-weight: 600; line-height: 1.35; }  /* 15px */
.corpo { font-size: .875rem; line-height: 1.5; }                            /* 14px */
.apoio { font-size: .8125rem; line-height: 1.45; color: var(--texto-dim); } /* 13px */
.rotulo {
  font-family: var(--font-mono-instr);
  font-size: .6875rem;    /* 11px — piso */
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--texto-dim);
}

/* Foco visível — não existia nenhum */
:focus-visible {
  outline: 2px solid var(--acao-forte);
  outline-offset: 2px;
  border-radius: 4px;
}
[data-theme="dark"] :focus-visible { outline-color: var(--acao); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

- [ ] **Step 2: safe-area** — em `web/app/layout.tsx`, trocar a linha do viewport por:

```ts
export const viewport: Viewport = { themeColor: "#f5f7fa", viewportFit: "cover" }
```

Em `web/components/bottom-nav.tsx`, na `<nav>`, trocar `pb-2.5` (ou o padding inferior atual) por `pb-[max(0.625rem,env(safe-area-inset-bottom))]`.
Em `web/components/registro-rapido.tsx`, no botão flutuante, trocar `bottom-20` por `bottom-[calc(5rem+env(safe-area-inset-bottom))]`, e no `<div>` interno do sheet trocar `pb-8` por `pb-[calc(2rem+env(safe-area-inset-bottom))]`.

- [ ] **Step 3: login sobre navy** — substituir `web/app/(auth)/login/page.tsx` INTEIRO:

```tsx
import { Logo } from "@/components/logo"
import { cadastrar, entrar } from "@/lib/acoes/auth"

const campo =
  "w-full rounded-[10px] border border-white/15 bg-white/5 px-3 py-3.5 text-base text-[#e9f1f8] placeholder:text-[#7c93ab] focus-visible:outline-[#d4af37]"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; modo?: string; volta?: string }>
}) {
  const { erro, modo, volta } = await searchParams
  const cadastro = modo === "cadastro"
  return (
    <main
      data-theme="dark"
      className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center bg-[#0b1d2d] px-6 pb-16 text-[#e9f1f8]"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 45% at 50% 0%, #16324a 0%, transparent 60%)" }}
    >
      <div className="text-xl"><Logo /></div>
      <p className="mt-2 text-xs uppercase tracking-[.18em] text-[#7c93ab]">
        Gestão completa da sua embarcação
      </p>
      <h1 className="titulo-pagina mt-7">{cadastro ? "Crie sua conta" : "Entre na sua conta"}</h1>
      {erro && (
        <p className="mt-4 rounded-lg border border-[#ff5c5c]/40 bg-[#ff5c5c]/10 px-3 py-2 corpo">{erro}</p>
      )}
      <form action={cadastro ? cadastrar : entrar} className="mt-6 space-y-3.5">
        <input type="hidden" name="volta" value={volta ?? ""} />
        {cadastro && (
          <div>
            <label htmlFor="nome" className="sr-only">Nome</label>
            <input id="nome" name="nome" required placeholder="Seu nome" autoComplete="name" className={campo} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="sr-only">E-mail</label>
          <input id="email" name="email" type="email" required placeholder="E-mail" autoComplete="email" className={campo} />
        </div>
        <div>
          <label htmlFor="senha" className="sr-only">Senha</label>
          <input id="senha" name="senha" type="password" required minLength={8}
            placeholder="Senha (mín. 8 caracteres)"
            autoComplete={cadastro ? "new-password" : "current-password"} className={campo} />
        </div>
        <button className="sombra-2 w-full rounded-xl bg-[#d4af37] py-3.5 text-base font-semibold text-[#0b1d2d]">
          {cadastro ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <a
        href={cadastro ? `/login${volta ? `?volta=${encodeURIComponent(volta)}` : ""}` : `/login?modo=cadastro${volta ? `&volta=${encodeURIComponent(volta)}` : ""}`}
        className="mt-6 text-center corpo text-[#7c93ab]"
      >
        {cadastro ? "Já tenho conta — entrar" : "Não tem conta? Criar agora"}
      </a>
    </main>
  )
}
```

(O `data-theme="dark"` local garante que os tokens internos usados por `.titulo-pagina`/`.corpo` resolvam para a versão escura mesmo com o app em claro.)

- [ ] **Step 4:** `npm run build` verde; `npx eslint` limpo nos arquivos tocados; `npm test` 75/75. Commit:
`git add web; git commit -m "feat(design): tokens de elevacao e tipografia, foco visivel, safe-area e login sobre navy"`

---

### Task 2: Sistema de ícones da marca

**Files:**
- Create: `web/components/icone.tsx`
- Modify: `web/components/bottom-nav.tsx` (passa a consumir `<Icone>`)

**Interfaces:**
- Produces: `type NomeIcone` e `<Icone nome={NomeIcone} className?: string />` — SVG 24×24, `stroke="currentColor"`, `strokeWidth={1.7}`, `aria-hidden`. Nomes: `inicio, embarcacao, marketplace, alerta, menu, ancora, motor, documento, escudo, oleo, ferramenta, calendario, camera, grafico, chat, selo, cifrao, bateria, raio, pessoas, imagem, estrela, medalha, chevron, voltar, mais, relogio, mapa`.

- [ ] **Step 1: `web/components/icone.tsx`:**

```tsx
import type { ReactNode } from "react"

const PATHS = {
  inicio: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />,
  embarcacao: <path d="M3 15h18l-3 5H6l-3-5zM6 15V9h12v6M12 9V4" />,
  marketplace: <path d="M4 9l1.5-5h13L20 9M4 9h16M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 13h6" />,
  alerta: <path d="M6 16V10a6 6 0 0 1 12 0v6l2 3H4l2-3zM10 19a2 2 0 0 0 4 0" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  ancora: <><circle cx="12" cy="5" r="2" /><path d="M12 7v13M5 13a7 7 0 0 0 14 0M8 10H5m14 0h-3" /></>,
  motor: <path d="M4 10h2V8h4l2-2h4v4h2l2 2v4h-2v2H8l-2-2H4z" />,
  documento: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  escudo: <path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z" />,
  oleo: <path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z" />,
  ferramenta: <path d="M15 3a5 5 0 0 0-4.6 7L3 17.4 6.6 21l7.4-7.4A5 5 0 1 0 15 3z" />,
  calendario: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  grafico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  chat: <path d="M20 12a8 8 0 1 1-3.4-6.5M20 4v5h-5" />,
  selo: <><circle cx="12" cy="9" r="6" /><path d="M9 14.5 8 22l4-2 4 2-1-7.5" /></>,
  cifrao: <path d="M12 3v18M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5s1.8 3 4 3.5 4 1.6 4 3.5-1.8 3-4 3-4-1.1-4-3" />,
  bateria: <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3M7 12.5h4M9 10.5v4" /></>,
  raio: <path d="M13 3 5 14h6l-2 7 8-11h-6z" />,
  pessoas: <><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.4" /><path d="M15.6 15c2.5.3 4.4 2.2 4.4 4.6" /></>,
  imagem: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 16-5-5-9 8" /></>,
  estrela: <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.6 9z" />,
  medalha: <><circle cx="12" cy="15" r="5" /><path d="M8.5 10.5 6 3h12l-2.5 7.5M12 13v4l2 1" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  voltar: <path d="m15 5-7 7 7 7" />,
  mais: <path d="M12 5v14M5 12h14" />,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  mapa: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />,
} satisfies Record<string, ReactNode>

export type NomeIcone = keyof typeof PATHS

export function Icone({ nome, className = "size-5" }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[nome]}
    </svg>
  )
}
```

- [ ] **Step 2: nav consome o componente** — em `web/components/bottom-nav.tsx`: importar `Icone` e `type NomeIcone`; trocar o campo `icone: <path .../>` de cada aba por `icone: "inicio" | "embarcacao" | "marketplace" | "alerta" | "menu"` (tipado `NomeIcone`) e o `<svg>...{a.icone}...</svg>` por `<Icone nome={a.icone} className="size-[21px]" />`. Manter `aria-current` e o `pb-[max(...)]` da Task 1.

- [ ] **Step 3:** `npm run build` verde; eslint limpo. Commit: `git add web; git commit -m "feat(design): sistema de icones da marca"`

---

### Task 3: Migration 013 + domínio da cota (TDD)

**Files:**
- Migration `013_fotos` via MCP (conector `mcp__6dcbebfb-...`, projeto `khgjtxvmduizyooqaoox`) + `supabase/migrations/013_fotos.sql`
- Create: `web/lib/domain/cota.ts`, `web/lib/domain/cota.test.ts`
- Modify: `web/lib/db/types.ts`

**Interfaces:**
- Produces: tabela `fotos`; coluna `embarcacoes.foto_capa_path`; tipo `Foto`; e do domínio:
  - `const COTA_MB = 500`
  - `interface UsoCota { usadoBytes: number; limiteBytes: number; percentual: number; restanteBytes: number; cheio: boolean }`
  - `usoDaCota(bytesUsados: number): UsoCota`
  - `formatarBytes(bytes: number): string` (ex.: `"1,4 GB"`, `"320 MB"`, `"48 KB"`)

- [ ] **Step 1: migration `013_fotos`** (aplicar via MCP e gravar idêntica em `supabase/migrations/013_fotos.sql`):

```sql
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  album text not null check (album in ('exterior','interior','conves','documentacao')),
  arquivo_path text not null,
  bytes bigint not null default 0,
  legenda text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_fotos_embarcacao on public.fotos (embarcacao_id, created_at desc);

alter table public.embarcacoes add column foto_capa_path text;

alter table public.fotos enable row level security;
create policy "fotos: ver pela matriz" on public.fotos for select
  using (public.permissao(embarcacao_id, 'fotos', 'ver'));
create policy "fotos: criar pela matriz" on public.fotos for insert
  with check (public.permissao(embarcacao_id, 'fotos', 'editar'));
create policy "fotos: atualizar pela matriz" on public.fotos for update
  using (public.permissao(embarcacao_id, 'fotos', 'editar'))
  with check (public.permissao(embarcacao_id, 'fotos', 'editar'));
create policy "fotos: excluir pela matriz" on public.fotos for delete
  using (public.permissao(embarcacao_id, 'fotos', 'editar'));

-- storage: prefixo fotos/ segue a mesma matriz
drop policy "acervo: ler pela matriz" on storage.objects;
create policy "acervo: ler pela matriz" on storage.objects for select to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'ver'))
      or ((storage.foldername(name))[2] = 'fotos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'fotos', 'ver'))
      or ((storage.foldername(name))[2] not in ('documentos','fotos')
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );
drop policy "acervo: gravar pela matriz" on storage.objects;
create policy "acervo: gravar pela matriz" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'editar'))
      or ((storage.foldername(name))[2] = 'fotos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'fotos', 'editar'))
      or ((storage.foldername(name))[2] not in ('documentos','fotos')
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );
drop policy "acervo: apagar pela matriz" on storage.objects;
create policy "acervo: apagar pela matriz" on storage.objects for delete to authenticated
  using (
    bucket_id = 'acervo' and (
      ((storage.foldername(name))[2] = 'documentos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'documentos', 'editar'))
      or ((storage.foldername(name))[2] = 'fotos'
        and public.permissao(((storage.foldername(name))[1])::uuid, 'fotos', 'editar'))
      or ((storage.foldername(name))[2] not in ('documentos','fotos')
        and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid))
    )
  );
```

Depois, `get_advisors` (security): nenhuma tabela sem RLS.

- [ ] **Step 2: aba `fotos` na matriz** — em `web/lib/domain/permissoes.ts`: acrescentar `"fotos"` ao array `ABAS` (depois de `"documentos"`), `fotos: "Fotos"` em `ROTULO_ABA`, e no preset `operacional` incluir `fotos: { ver: true, editar: true }` (o comandante fotografa o barco; documentos e gastos seguem fechados). O preset `completo` cobre automaticamente.
  Em `web/lib/domain/permissoes.test.ts`, no teste "operacional espelha a espec", acrescentar:
```ts
    expect(PRESETS.operacional.fotos).toEqual({ ver: true, editar: true })
```

- [ ] **Step 3: testes da cota (TDD)** — criar `web/lib/domain/cota.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { COTA_MB, formatarBytes, usoDaCota } from "./cota"

const MB = 1024 * 1024

describe("usoDaCota", () => {
  it("vazio", () => {
    const u = usoDaCota(0)
    expect(u.percentual).toBe(0)
    expect(u.cheio).toBe(false)
    expect(u.limiteBytes).toBe(COTA_MB * MB)
  })
  it("metade", () => {
    const u = usoDaCota((COTA_MB / 2) * MB)
    expect(u.percentual).toBe(50)
    expect(u.restanteBytes).toBe((COTA_MB / 2) * MB)
  })
  it("cheio no limite e acima", () => {
    expect(usoDaCota(COTA_MB * MB).cheio).toBe(true)
    expect(usoDaCota(COTA_MB * MB * 2).percentual).toBe(100)
    expect(usoDaCota(COTA_MB * MB * 2).restanteBytes).toBe(0)
  })
})

describe("formatarBytes", () => {
  it("escala pt-BR", () => {
    expect(formatarBytes(0)).toBe("0 KB")
    expect(formatarBytes(48 * 1024)).toBe("48 KB")
    expect(formatarBytes(320 * MB)).toBe("320 MB")
    expect(formatarBytes(1.4 * 1024 * MB)).toBe("1,4 GB")
  })
})
```

- [ ] **Step 4:** `npm test` → FAIL (`./cota` não existe).

- [ ] **Step 5: implementar** — `web/lib/domain/cota.ts`:

```ts
const MB = 1024 * 1024

export const COTA_MB = 500

export interface UsoCota {
  usadoBytes: number
  limiteBytes: number
  percentual: number
  restanteBytes: number
  cheio: boolean
}

export function usoDaCota(bytesUsados: number): UsoCota {
  const limiteBytes = COTA_MB * MB
  const usadoBytes = Math.max(0, bytesUsados)
  const percentual = Math.min(100, Math.round((usadoBytes / limiteBytes) * 100))
  return {
    usadoBytes,
    limiteBytes,
    percentual,
    restanteBytes: Math.max(0, limiteBytes - usadoBytes),
    cheio: usadoBytes >= limiteBytes,
  }
}

export function formatarBytes(bytes: number): string {
  if (bytes >= 1024 * MB) {
    return `${(bytes / (1024 * MB)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`
  }
  if (bytes >= MB) {
    return `${Math.round(bytes / MB).toLocaleString("pt-BR")} MB`
  }
  return `${Math.round(bytes / 1024).toLocaleString("pt-BR")} KB`
}
```

- [ ] **Step 6: tipos** — em `web/lib/db/types.ts`: adicionar `foto_capa_path: string | null` a `Embarcacao` (após `marina_lon`) e ao final:

```ts
export type AlbumFoto = "exterior" | "interior" | "conves" | "documentacao"

export interface Foto {
  id: string
  embarcacao_id: string
  album: AlbumFoto
  arquivo_path: string
  bytes: number
  legenda: string | null
  criado_por: string | null
  created_at: string
}
```

- [ ] **Step 7:** `npm test` → 81/81 (75 + 5 de cota + 1 asserção nova em permissões); `npm run build` verde. Commit:
`git add web supabase; git commit -m "feat(fotos): migration, aba fotos na matriz e dominio da cota (TDD)"`

---

### Task 4: Módulo Fotos — actions e tela

**Files:**
- Create: `web/lib/acoes/fotos.ts`, `web/app/(app)/barco/fotos/albuns.ts`, `web/app/(app)/barco/fotos/page.tsx`
- Modify: `web/app/(app)/barco/page.tsx` (card "Fotos" no Acervo)

**Interfaces:**
- Consumes: `subirArquivo`/`validarArquivo` de `@/lib/acervo`; `usoDaCota`/`formatarBytes`; `podeVer`/`podeEditar`; tipos `Foto`/`AlbumFoto`.
- Produces: actions `subirFoto(formData)` (campos `album`, `arquivo`, `legenda?`), `excluirFoto(formData)` (`foto_id`), `definirCapa(formData)` (`foto_id`); `ALBUNS` e `ROTULO_ALBUM`.

- [ ] **Step 1: `web/app/(app)/barco/fotos/albuns.ts`:**

```ts
import type { AlbumFoto } from "@/lib/db/types"

export const ALBUNS: AlbumFoto[] = ["exterior", "interior", "conves", "documentacao"]

export const ROTULO_ALBUM: Record<AlbumFoto, string> = {
  exterior: "Exterior",
  interior: "Interior",
  conves: "Convés",
  documentacao: "Documentação visual",
}
```

- [ ] **Step 2: `web/lib/acoes/fotos.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { usoDaCota } from "@/lib/domain/cota"
import { supabaseServer } from "@/lib/supabase/server"
import type { AlbumFoto } from "@/lib/db/types"

const ALBUNS_VALIDOS = ["exterior", "interior", "conves", "documentacao"]

function voltar(msg?: string): never {
  redirect(msg ? `/barco/fotos?erro=${encodeURIComponent(msg)}` : "/barco/fotos")
}

export async function subirFoto(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const album = String(formData.get("album") ?? "")
  if (!ALBUNS_VALIDOS.includes(album)) voltar("Escolha um álbum válido.")

  const arquivo = formData.get("arquivo")
  if (!(arquivo instanceof File) || arquivo.size === 0) voltar("Escolha uma foto.")
  if (!["image/jpeg", "image/png", "image/webp"].includes((arquivo as File).type)) {
    voltar("Use JPG, PNG ou WebP.")
  }

  const { data: usadas } = await supabase
    .from("fotos").select("bytes").eq("embarcacao_id", painel.embarcacao.id)
  const usado = (usadas ?? []).reduce((s, f: { bytes: number }) => s + f.bytes, 0)
  if (usoDaCota(usado + (arquivo as File).size).cheio) {
    voltar("Cota de nuvem cheia. Apague fotos antigas para liberar espaço.")
  }

  const r = await subirArquivo(supabase, painel.embarcacao.id, "fotos", arquivo as File)
  if ("erro" in r) voltar(r.erro)

  const { error } = await supabase.from("fotos").insert({
    embarcacao_id: painel.embarcacao.id,
    album: album as AlbumFoto,
    arquivo_path: r.path,
    bytes: (arquivo as File).size,
    legenda: String(formData.get("legenda") ?? "").trim() || null,
    criado_por: user.id,
  })
  if (error) {
    await supabase.storage.from("acervo").remove([r.path])
    voltar("Não foi possível salvar a foto. Tente de novo.")
  }

  revalidatePath("/barco/fotos")
  revalidatePath("/barco")
  voltar()
}

export async function excluirFoto(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("foto_id") ?? "")

  const { data: foto } = await supabase
    .from("fotos").select("id, arquivo_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!foto) voltar("Foto não encontrada.")

  if (painel.embarcacao.foto_capa_path === foto.arquivo_path) {
    await supabase.from("embarcacoes").update({ foto_capa_path: null }).eq("id", painel.embarcacao.id)
  }
  const { error } = await supabase.from("fotos").delete().eq("id", id)
  if (error) voltar("Não foi possível excluir a foto.")
  await supabase.storage.from("acervo").remove([foto.arquivo_path])

  revalidatePath("/barco/fotos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  voltar()
}

export async function definirCapa(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("foto_id") ?? "")

  const { data: foto } = await supabase
    .from("fotos").select("arquivo_path")
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).maybeSingle()
  if (!foto) voltar("Foto não encontrada.")

  const { error } = await supabase
    .from("embarcacoes").update({ foto_capa_path: foto.arquivo_path }).eq("id", painel.embarcacao.id)
  if (error) voltar("Não foi possível definir a capa — confira seu acesso.")

  revalidatePath("/hoje")
  revalidatePath("/barco")
  revalidatePath("/barco/fotos")
  voltar()
}
```

- [ ] **Step 3: `web/app/(app)/barco/fotos/page.tsx`:**

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { definirCapa, excluirFoto, subirFoto } from "@/lib/acoes/fotos"
import { carregarPainel } from "@/lib/consultas"
import { formatarBytes, usoDaCota } from "@/lib/domain/cota"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"
import type { Foto } from "@/lib/db/types"
import { ALBUNS, ROTULO_ALBUM } from "./albuns"

export default async function FotosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; album?: string }>
}) {
  const { erro, album: albumBruto } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "fotos")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui as fotos.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "fotos")
  const albumAtivo = ALBUNS.find((a) => a === albumBruto) ?? "exterior"

  const supabase = await supabaseServer()
  const { data: fotos, error } = await supabase
    .from("fotos").select("*").eq("embarcacao_id", painel.embarcacao.id)
    .order("created_at", { ascending: false })
  if (error) throw new Error("Não foi possível carregar as fotos. Recarregue a página.")

  const todas = (fotos ?? []) as Foto[]
  const uso = usoDaCota(todas.reduce((s, f) => s + f.bytes, 0))
  const doAlbum = todas.filter((f) => f.album === albumAtivo)
  const urls = doAlbum.length
    ? (await supabase.storage.from("acervo").createSignedUrls(doAlbum.map((f) => f.arquivo_path), 3600)).data ?? []
    : []
  const urlPorPath = new Map(urls.map((u) => [u.path, u.signedUrl]))

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <h1 className="titulo-pagina mt-3">Fotos</h1>
      <p className="apoio mt-1">O álbum do barco — e o dossiê que vale na hora de vender.</p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

      <div className="mt-4 rounded-[14px] border border-line bg-panel p-4 sombra-1">
        <div className="flex items-baseline justify-between">
          <p className="rotulo">Cota de nuvem</p>
          <p className="font-mono-instr text-xs tabular-nums text-dim">
            {formatarBytes(uso.usadoBytes)} de {formatarBytes(uso.limiteBytes)}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className={`h-full rounded-full ${uso.percentual > 90 ? "bg-crit" : "bg-accent"}`}
            style={{ width: `${Math.max(2, uso.percentual)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {ALBUNS.map((a) => (
          <Link
            key={a}
            href={a === "exterior" ? "/barco/fotos" : `/barco/fotos?album=${a}`}
            className={`whitespace-nowrap rounded-full border px-3.5 py-2 font-mono-instr text-[11px] ${
              a === albumAtivo
                ? "border-accent bg-accent font-semibold text-acao-texto"
                : "border-line bg-panel text-dim"
            }`}
          >
            {ROTULO_ALBUM[a]}
          </Link>
        ))}
      </div>

      {doAlbum.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-line bg-panel p-6 text-center sombra-1">
          <Icone nome="camera" className="mx-auto size-7 text-dim" />
          <p className="corpo mt-2 font-medium">Nenhuma foto em {ROTULO_ALBUM[albumAtivo]}</p>
          <p className="apoio mt-1">Fotos boas valorizam o barco e contam a história dele.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {doAlbum.map((f) => {
            const url = urlPorPath.get(f.arquivo_path)
            const ehCapa = painel.embarcacao.foto_capa_path === f.arquivo_path
            return (
              <div key={f.id} className="overflow-hidden rounded-[12px] border border-line bg-panel sombra-1">
                {url && (
                  /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
                  <img src={url} alt={f.legenda ?? "Foto da embarcação"} className="aspect-square w-full object-cover" />
                )}
                {editavel && (
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <form action={definirCapa}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <button
                        className={`flex size-9 items-center justify-center ${ehCapa ? "text-accent-forte" : "text-dim"}`}
                        aria-label={ehCapa ? "Foto de capa" : "Usar como capa"}
                      >
                        <Icone nome="estrela" className="size-4" />
                      </button>
                    </form>
                    <form action={excluirFoto}>
                      <input type="hidden" name="foto_id" value={f.id} />
                      <button className="flex size-9 items-center justify-center text-crit" aria-label="Excluir foto">
                        <Icone nome="mais" className="size-4 rotate-45" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editavel && (
        <>
          <p className="rotulo mt-6 mb-2">Adicionar foto</p>
          <form action={subirFoto} className="space-y-3 rounded-[14px] border border-line bg-panel p-4 sombra-1">
            <input type="hidden" name="album" value={albumAtivo} />
            <div>
              <label htmlFor="arquivo" className="rotulo mb-1.5 block">
                Foto para {ROTULO_ALBUM[albumAtivo]} — JPG, PNG ou WebP, até 10 MB
              </label>
              <input id="arquivo" name="arquivo" type="file" accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-[10px] border border-line bg-campo px-3 py-2.5 corpo" />
            </div>
            <div>
              <label htmlFor="legenda" className="rotulo mb-1.5 block">Legenda — opcional</label>
              <input id="legenda" name="legenda" placeholder="Ex.: convés após a última lavagem"
                className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 corpo" />
            </div>
            <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Enviar foto</button>
          </form>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: card no Acervo** — em `web/app/(app)/barco/page.tsx`, no array do grid "Acervo do barco", inserir como PRIMEIRO item:
```tsx
            { href: "/barco/fotos", rotulo: "Fotos", desc: "álbuns do barco", aba: "fotos" },
```
(o `.filter` por `podeVer` já existente cobre a nova aba).

- [ ] **Step 5:** `npm test` 81/81; `npm run build` verde (rota `/barco/fotos`); eslint limpo. Commit:
`git add web; git commit -m "feat(fotos): albuns, upload com cota, capa e exclusao"`

---

### Task 5: Card hero da embarcação

**Files:**
- Create: `web/components/card-embarcacao.tsx`
- Modify: `web/app/(app)/hoje/page.tsx`, `web/app/(app)/barco/page.tsx`

**Interfaces:**
- Consumes: `Icone`, `Farol`, `StatusFarol`, `Embarcacao`, `supabaseServer` (para a URL assinada da capa).
- Produces: `<CardEmbarcacao embarcacao={Embarcacao} statusGeral={StatusFarol} urlCapa={string | null} podeEditarFotos={boolean} />`.

- [ ] **Step 1: `web/components/card-embarcacao.tsx`:**

```tsx
import Link from "next/link"
import { Icone } from "@/components/icone"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { Embarcacao } from "@/lib/db/types"

const ROTULO: Record<StatusFarol, string> = {
  ok: "Tudo em dia",
  atencao: "Precisa de atenção",
  vencido: "Item vencido",
}

const COR: Record<StatusFarol, string> = {
  ok: "text-[#2fd07a]",
  atencao: "text-[#ffb020]",
  vencido: "text-[#ff5c5c]",
}

export function CardEmbarcacao({
  embarcacao,
  statusGeral,
  urlCapa,
  podeEditarFotos,
}: {
  embarcacao: Embarcacao
  statusGeral: StatusFarol
  urlCapa: string | null
  podeEditarFotos: boolean
}) {
  const legenda = [embarcacao.estaleiro, embarcacao.modelo, embarcacao.ano].filter(Boolean).join(" · ")
  return (
    <div className="sombra-2 relative overflow-hidden rounded-[16px] bg-[#0b1d2d]">
      {urlCapa ? (
        /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
        <img src={urlCapa} alt={`Foto de ${embarcacao.nome}`} className="h-44 w-full object-cover" />
      ) : (
        <Link
          href={podeEditarFotos ? "/barco/fotos" : "/barco"}
          className="flex h-44 w-full flex-col items-center justify-center gap-2"
          style={{ backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 15%, #16324a 0%, #0b1d2d 70%)" }}
        >
          <Icone nome="camera" className="size-7 text-[#7c93ab]" />
          {podeEditarFotos && (
            <span className="corpo text-[#7c93ab]">Adicionar foto da embarcação</span>
          )}
        </Link>
      )}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
        style={{ backgroundImage: "linear-gradient(to top, rgb(11 29 45 / .94), rgb(11 29 45 / 0))" }}
      />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h1 className="text-[22px] font-semibold uppercase tracking-[.06em] text-[#e9f1f8]">
          {embarcacao.nome}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="apoio text-[#7c93ab]">{[embarcacao.marina, legenda].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#0b1d2d]/80 px-2.5 py-1.5 backdrop-blur">
        <Icone nome="escudo" className={`size-3.5 ${COR[statusGeral]}`} />
        <span className={`font-mono-instr text-[10.5px] uppercase tracking-[.1em] ${COR[statusGeral]}`}>
          {ROTULO[statusGeral]}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: usar na Home** — em `web/app/(app)/hoje/page.tsx`:
  (a) importar `CardEmbarcacao`, `Icone`, `podeEditar` e `supabaseServer`;
  (b) após calcular `avaliados`/`contagem`, obter capa e status geral:
```tsx
  const statusGeral = avaliados[0]?.r.status ?? "ok"
  const supabase = await supabaseServer()
  const urlCapa = embarcacao.foto_capa_path
    ? (await supabase.storage.from("acervo").createSignedUrl(embarcacao.foto_capa_path, 3600)).data?.signedUrl ?? null
    : null
```
  (c) substituir o bloco `<header>` atual (logo + h1 + luzes) por:
```tsx
      <CardEmbarcacao
        embarcacao={embarcacao}
        statusGeral={statusGeral}
        urlCapa={urlCapa}
        podeEditarFotos={podeEditar(permissoes, "fotos")}
      />
      <div className="mt-3 flex justify-end gap-2.5 font-mono-instr text-xs tabular-nums text-dim">
        <span className="flex items-center gap-1"><Farol status="vencido" />{contagem.vencido}</span>
        <span className="flex items-center gap-1"><Farol status="atencao" />{contagem.atencao}</span>
        <span className="flex items-center gap-1"><Farol status="ok" />{contagem.ok}</span>
      </div>
```
  (o `<Logo />` do topo sai — a marca agora vive no card e na nav).

- [ ] **Step 3: usar na ficha** — em `web/app/(app)/barco/page.tsx`: importar `CardEmbarcacao`, `podeEditar` e `supabaseServer`; calcular `statusGeral` como o pior status entre todos os itens (mesma técnica do PESO já usada no arquivo) e `urlCapa` igual ao Step 2; substituir o `<h1>` + `<p>` do topo pelo `<CardEmbarcacao ... />`.

- [ ] **Step 4:** `npm test` 81/81; `npm run build` verde; eslint limpo. Commit:
`git add web; git commit -m "feat(design): card hero da embarcacao com foto de capa"`

---

### Task 6: Loading, confirmação destrutiva e a linha de alerta

**Files:**
- Create: `web/app/(app)/loading.tsx`, `web/components/confirmar.tsx`
- Modify: `web/app/(app)/hoje/page.tsx` (boletim em Suspense + linha de alerta), `web/app/(app)/barco/contatos/page.tsx`, `web/app/(app)/barco/documentos/page.tsx`, `web/app/(app)/menu/tripulacao/page.tsx`

**Interfaces:**
- Produces: `<Confirmar mensagem={string} rotulo={string} className?: string>` — client component que embrulha o botão de submit e pede confirmação antes de enviar o form.

- [ ] **Step 1: `web/app/(app)/loading.tsx`:**

```tsx
export default function Carregando() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Carregando">
      <div className="h-44 rounded-[16px] bg-panel2" />
      <div className="h-5 w-2/5 rounded bg-panel2" />
      <div className="h-20 rounded-[14px] bg-panel2" />
      <div className="h-20 rounded-[14px] bg-panel2" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 rounded-[10px] bg-panel2" />
        <div className="h-16 rounded-[10px] bg-panel2" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `web/components/confirmar.tsx`:**

```tsx
"use client"
import { useState } from "react"

export function Confirmar({
  mensagem,
  rotulo,
  className = "text-xs text-crit",
  children,
}: {
  mensagem: string
  rotulo: string
  className?: string
  children?: React.ReactNode
}) {
  const [pedindo, setPedindo] = useState(false)

  if (!pedindo) {
    return (
      <button type="button" onClick={() => setPedindo(true)} className={className} aria-label={rotulo}>
        {children ?? rotulo}
      </button>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <span className="apoio">{mensagem}</span>
      <button type="submit" className="rounded-lg bg-crit px-2.5 py-1.5 text-xs font-semibold text-white">
        Confirmar
      </button>
      <button type="button" onClick={() => setPedindo(false)} className="px-2 py-1.5 text-xs text-dim">
        Cancelar
      </button>
    </span>
  )
}
```

- [ ] **Step 3: aplicar a confirmação** — trocar os três botões destrutivos pelo componente, mantendo cada `<form>` e seu `<input type="hidden">`:
  - `web/app/(app)/barco/contatos/page.tsx`: `<button className="text-xs text-crit">Excluir</button>` → `<Confirmar mensagem="Excluir contato?" rotulo="Excluir" />`
  - `web/app/(app)/barco/documentos/page.tsx`: `<button className="text-xs text-crit">Excluir</button>` → `<Confirmar mensagem="Excluir documento?" rotulo="Excluir" />`
  - `web/app/(app)/menu/tripulacao/page.tsx`: `<button className="text-xs text-crit">Revogar</button>` → `<Confirmar mensagem="Revogar convite?" rotulo="Revogar" />`
  (importar `Confirmar` de `@/components/confirmar` nos três.)

- [ ] **Step 4: boletim do mar fora do caminho crítico** — em `web/app/(app)/hoje/page.tsx`:
  (a) extrair o bloco do boletim para um componente async no MESMO arquivo:
```tsx
async function BoletimDoMar({ lat, lon }: { lat: number; lon: number }) {
  const boletim = await boletimDoMar(lat, lon)
  if (!boletim) {
    return (
      <div className="rounded-[14px] border border-line bg-panel p-4 corpo text-dim sombra-1">
        Boletim indisponível agora. Tente mais tarde.
      </div>
    )
  }
  return (
    <div className="rounded-[14px] border border-line bg-panel p-4 sombra-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono-instr text-sm tabular-nums">
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Onda</span>{boletim.ondaM != null ? `${boletim.ondaM.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Vento</span>{boletim.ventoKt != null ? `${Math.round(boletim.ventoKt)} kt` : "—"}</span>
        <span><span className="mr-1.5 text-[11px] uppercase tracking-[.12em] text-dim">Água</span>{boletim.aguaC != null ? `${Math.round(boletim.aguaC)} °C` : "—"}</span>
        <span className={`ml-auto rounded px-2 py-0.5 font-mono-instr text-[10.5px] uppercase tracking-[.1em] ${
          boletim.selo.nivel === "ok" ? "border border-ok/40 text-ok"
          : boletim.selo.nivel === "atencao" ? "border border-warn/40 text-warn"
          : "border border-crit/40 text-crit"
        }`}>{boletim.selo.rotulo}</span>
      </div>
    </div>
  )
}
```
  (b) no lugar onde o boletim era renderizado, usar Suspense (importar `Suspense` de `react`):
```tsx
        <Suspense fallback={<div className="h-[74px] animate-pulse rounded-[14px] bg-panel2" />}>
          <BoletimDoMar lat={embarcacao.marina_lat} lon={embarcacao.marina_lon} />
        </Suspense>
```
  (c) remover o `await boletimDoMar(...)` do corpo da página (a variável `boletim` deixa de existir lá).

- [ ] **Step 5: linha de alerta com valor em destaque** — em `web/app/(app)/hoje/page.tsx`, trocar o `map` dos alertas por:

```tsx
        {alertas.map(({ item, r, onde }) => (
          <div key={item.id} className="sombra-1 flex items-center gap-3 rounded-[14px] border border-line bg-panel p-3.5">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              r.status === "vencido" ? "bg-crit/12 text-crit" : "bg-warn/12 text-warn"
            }`}>
              <Icone nome={item.equipamento_id ? "motor" : "documento"} className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="titulo-card truncate">{onde}</p>
              <p className="apoio mt-0.5">{item.nome}</p>
            </div>
            <span className={`shrink-0 text-right font-mono-instr text-sm font-semibold tabular-nums ${
              r.status === "vencido" ? "text-crit" : "text-warn"
            }`}>
              {textoRestante(r)}
            </span>
          </div>
        ))}
```

- [ ] **Step 6:** `npm test` 81/81; `npm run build` verde; eslint limpo. Commit:
`git add web; git commit -m "feat(design): loading, confirmacao destrutiva e linha de alerta com valor em destaque"`

---

### Task 7: Ícones e tipografia nas telas restantes

**Files:**
- Modify: `web/app/(app)/barco/page.tsx`, `web/app/(app)/diario/page.tsx`, `web/app/(app)/barco/{documentos,contatos,gastos}/page.tsx`, `web/app/(app)/notificacoes/page.tsx`, `web/app/(app)/menu/page.tsx`, `web/app/(app)/hoje/page.tsx`

**Interfaces:**
- Consumes: `<Icone>` (Task 2), utilitárias `.titulo-pagina/.titulo-card/.corpo/.apoio/.rotulo/.sombra-1` (Task 1).

- [ ] **Step 1: varredura de tipografia** — nas 7 páginas acima, aplicar mecanicamente:
  - `text-xl font-semibold` de título de página → `titulo-pagina`
  - `text-sm font-semibold`/`font-medium` de título de item → `titulo-card`
  - `text-sm` de corpo → `corpo`
  - `text-xs text-dim` → `apoio`
  - `font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim` (rótulo de seção) → `rotulo`
  - todo card `rounded-[14px] border border-line bg-panel` ganha `sombra-1`

- [ ] **Step 2: ícones no lugar dos caracteres** — trocar em todas as páginas:
  - link de voltar `‹ X` → `<Link className="inline-flex items-center gap-1 rotulo text-accent-forte"><Icone nome="voltar" className="size-4" /> X</Link>`
  - chevron `›` → `<Icone nome="chevron" className="size-4 text-dim" />`
  - `⛵ Iniciar navegação — gravar trilha` (hoje) → `<span className="inline-flex items-center justify-center gap-2"><Icone nome="mapa" className="size-4" /> Iniciar navegação — gravar trilha</span>`
  - `+ Evento` / `+ Lançamento` → `<span className="inline-flex items-center gap-1"><Icone nome="mais" className="size-4" /> Evento</span>`
  - estrelas de avaliação em contatos: `★` → `<Icone nome="estrela" className="size-5" />` (botão com `size-11` para o alvo de toque)

- [ ] **Step 3: ícone por seção** — pôr o ícone antes do rótulo nas seções, com `inline-flex items-center gap-1.5`:
  - Barco: Motores→`motor`, Casco→`escudo`, Documentos e embarcação→`documento`, Acervo→`imagem`
  - Hoje: Precisa de atenção→`alerta`, Mar agora→`mapa`, Horas de motor→`relogio`, Acesso rápido→`raio`, Comandantes→`pessoas`
  - Gastos: Total do mês→`cifrao`, Últimos 6 meses→`grafico`
  - Menu: Conta→`pessoas`, Aparência→`imagem`, Alertas→`alerta`, Tripulação→`pessoas`
  - Notificações: Alertas ativos→`alerta`, Avisos enviados→`calendario`

- [ ] **Step 4: acesso rápido com ícone** (Hoje) — trocar os 4 atalhos por:
```tsx
          .map((a) => (
            <Link key={a.href} href={a.href}
              className="sombra-1 flex flex-col items-center gap-1.5 rounded-[12px] border border-line bg-panel px-1 py-3">
              <Icone nome={a.icone} className="size-5 text-accent-forte" />
              <span className="text-[11px] font-medium">{a.rotulo}</span>
            </Link>
          ))
```
  com o array ganhando `icone`: Motores→`motor`, Docs→`documento`, Diário→`calendario`, Contatos→`pessoas`.

- [ ] **Step 5: verificação final da onda** — `npm test` 81/81; `npm run build` verde; `npx eslint app components lib` limpo; conferir com grep que não sobrou `⛵`, `‹`, `›` nem `★` em `app/`. Commit:
`git add web; git commit -m "feat(design): icones e escala tipografica em todas as telas"`

---

## Self-review (executado na escrita)

- **Cobertura do §5 da auditoria:** P0.1 ícones (T2, T7) · P0.2 hero com foto (T5, dependente de T3/T4) · P0.3 loading + Suspense (T6) · P0.4 contraste do dourado (T1: login navy; a barra do gráfico de gastos já usa `bg-accent` sobre card — trocada para `accent-forte` no Step 1 da T7 quando a página for varrida) · P0.5 safe-area e confirmação (T1, T6) · P1.1 tipografia (T1, T7) · P1.2 elevação (T1, T7) · P1.3 linha de alerta (T6) · P2.1 Fotos (T3, T4). Ficam para a Onda 2 (declarado): tela de motor com tabs e foto, saudação/avatar/seletor de embarcação, logo final, modal com focus-trap, `useFormStatus`/toast.
- **Placeholders:** nenhum.
- **Tipos:** `NomeIcone` (T2) consumido em T4/T5/T6/T7; `usoDaCota`/`formatarBytes` (T3) em T4; `Foto`/`AlbumFoto` (T3) em T4; `CardEmbarcacao` (T5) em Hoje e Barco; `Confirmar` (T6) nas 3 páginas; aba `"fotos"` adicionada em T3 e usada em T4/T5.
- **Contagem de testes:** 75 hoje → 81 após T3 (5 de cota + 1 asserção nova em permissões). Nenhuma outra task adiciona teste.

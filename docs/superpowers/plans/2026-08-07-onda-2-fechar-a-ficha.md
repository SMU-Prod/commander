# Commander — Onda 2: Fechar a ficha

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar do app as promessas vazias que a auditoria encontrou: a ficha passa a ser editável, Elétrica deixa de ser aba morta, a tela do motor ganha a cara do mockup, o dono é chamado pelo nome — e nada disso volta a quebrar sem alguém perceber, porque a partir daqui existe CI.

**Architecture:** Sem dependência nova. Um formulário de embarcação e um de equipamento (ambos server actions + RLS pela matriz que a Onda 0 instalou), a tela do motor virando abas por posição com foto do bucket `acervo`, um `<Toast>` client alimentado por `?ok=` na URL, e a média de uso saindo de um cálculo puro sobre os eventos de leitura já gravados.

**Tech Stack:** o existente (Next 16, Supabase, Tailwind v4, Vitest) + GitHub Actions.

**Fonte:** `docs/auditoria/2026-08-07-sintese-360.md` (Onda 2) e os débitos da revisão final da Onda 1 no ledger.

## Global Constraints

- PT-BR; sem emoji como ícone; ícones sempre via `<Icone>`.
- Tipografia pelas utilitárias (`.titulo-pagina/.titulo-card/.corpo/.apoio/.rotulo`) — **elas não definem cor**: sempre acompanhe de `text-dim` (ou outro token) onde a cor importa. Piso de 11px (exceções já existentes: nav 10.5, horímetro 10, selos 10.5).
- Dourado `#D4AF37` nunca como texto/elemento fino sobre fundo claro — use `--acao-forte`.
- Cards de conteúdo levam `sombra-1`; alvo de toque de ação ≥44px.
- Toda escrita captura `error`; helpers de redirect `function ...(): never`; `carregarPainel` nunca depois de escrita na mesma action.
- Escrita em `equipamentos`/`itens_monitorados` já é governada pela matriz (migration 010) — o app **também** checa `podeEditar` antes de mostrar formulário.
- Upload de foto de equipamento: mesmas regras do acervo (10 MB, jpeg/png/webp), pasta `fotos/`.

---

## Estrutura de arquivos

```
web/
├─ .github/workflows/ci.yml            (na raiz do repo, não em web/) lint + tsc + test + build
├─ .githooks/pre-commit                 tsc + test antes do commit
├─ components/toast.tsx                 aviso de sucesso lido de ?ok=
├─ components/seletor-embarcacao.tsx    troca de barco (client, cookie)
├─ components/avatar.tsx                foto do usuário ou iniciais
├─ app/(app)/barco/editar/page.tsx      dados gerais completos
├─ app/(app)/barco/equipamento/novo/page.tsx        criar gerador/bateria/motor
├─ app/(app)/barco/equipamento/[id]/editar/page.tsx editar equipamento
├─ app/(app)/barco/eletrica/page.tsx    a aba que não existia
├─ app/(app)/menu/perfil/page.tsx       nome, telefone e avatar
├─ lib/acoes/embarcacao.ts              salvarDadosGerais
├─ lib/acoes/equipamentos.ts            criarEquipamento, salvarEquipamento, excluirEquipamento
├─ lib/acoes/perfil.ts                  salvarPerfil (nome, telefone, avatar)
├─ lib/domain/uso.ts (+ .test.ts)       mediaHorasSemana, projecaoVencimento (TDD)
└─ lib/embarcacao-ativa.ts              cookie do barco selecionado
```

Migrations: `016_ficha_completa` (campos de equipamento e item, avatar).

---

### Task 1: CI e hook de pré-commit

**Files:**
- Create: `.github/workflows/ci.yml`, `.githooks/pre-commit`, `docs/CONTRIBUTING.md`

**Interfaces:**
- Produces: pipeline que roda lint + typecheck + testes + build a cada push/PR; hook local que barra commit com tipo ou teste quebrado.

- [ ] **Step 1: `.github/workflows/ci.yml`** (na RAIZ do repositório):

```yaml
name: CI
on:
  push:
    branches: ["**"]
  pull_request:
jobs:
  verificar:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint app components lib
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://exemplo.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: chave-de-build
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: chave-vapid-de-build
```

- [ ] **Step 2: `.githooks/pre-commit`:**

```sh
#!/bin/sh
# Barra commit com tipo ou teste quebrado. Ative uma vez com:
#   git config core.hooksPath .githooks
set -e
cd "$(git rev-parse --show-toplevel)/web"
echo "→ typecheck"
npx tsc --noEmit
echo "→ testes"
npm test --silent
echo "✓ pronto para commitar"
```

- [ ] **Step 3: ativar e documentar** — rodar `git config core.hooksPath .githooks` e criar `docs/CONTRIBUTING.md`:

```markdown
# Como trabalhar neste repositório

## Verificação local
O hook de pré-commit roda `tsc --noEmit` e a suíte de testes. Ative uma vez por clone:

    git config core.hooksPath .githooks

Para um commit emergencial sem o hook (evite): `git commit --no-verify`.

## CI
`.github/workflows/ci.yml` roda lint, typecheck, testes e build em todo push. O build usa
variáveis de ambiente falsas — o app não fala com o Supabase durante a compilação.

## Banco
Toda migration é aplicada via MCP no projeto remoto **e** versionada em `supabase/migrations/`
com o mesmo SQL. Nunca altere o banco sem gravar o arquivo.

## Antes de fechar uma fase
1. `npm test` e `npm run build` verdes
2. Passe visual contra as pranchas da marca (navy/dourado, ícones, tipografia)
3. Conferir cobertura da espec: `docs/superpowers/specs/2026-08-06-commander-v2-design.md`
```

- [ ] **Step 4:** verificar que o hook dispara (`git commit` com erro de tipo proposital deve falhar — teste e desfaça). Commit:
`git add .github .githooks docs; git commit -m "chore: CI com lint/tipos/testes/build e hook de pre-commit"`

---

### Task 2: Migration 016 + tipos

**Files:**
- Migration `016_ficha_completa` via MCP (projeto `khgjtxvmduizyooqaoox`) + `supabase/migrations/016_ficha_completa.sql`
- Modify: `web/lib/db/types.ts`

**Interfaces:**
- Produces: colunas `equipamentos.identificacao_interna`, `equipamentos.quantidade`, `equipamentos.foto_path`, `equipamentos.observacoes`; `itens_monitorados.especificacao`, `itens_monitorados.quantidade`; `profiles.avatar_path`. Tipos atualizados.

- [ ] **Step 1: aplicar e versionar:**

```sql
alter table public.equipamentos add column identificacao_interna text;
alter table public.equipamentos add column quantidade integer;
alter table public.equipamentos add column foto_path text;
alter table public.equipamentos add column observacoes text;

alter table public.itens_monitorados add column especificacao text;
alter table public.itens_monitorados add column quantidade text;

alter table public.profiles add column avatar_path text;
```

- [ ] **Step 2: advisors** (security): nenhuma tabela sem RLS (as colunas herdam as policies existentes).

- [ ] **Step 3: tipos** — em `web/lib/db/types.ts`:
  - `Equipamento` ganha, após `combustivel`: `identificacao_interna: string | null`, `quantidade: number | null`, `foto_path: string | null`, `observacoes: string | null`
  - `ItemMonitorado` ganha, após `nome`: `especificacao: string | null`, `quantidade: string | null`
  - Criar ao final:

```ts
export interface Perfil {
  id: string
  nome: string
  telefone: string | null
  avatar_path: string | null
  created_at: string
}
```

- [ ] **Step 4:** `npm test` 79/79; `npm run build` verde. Commit:
`git add web supabase; git commit -m "feat: migration da ficha completa (equipamento, item e avatar)"`

---

### Task 3: Editar os dados gerais da embarcação

**Files:**
- Create: `web/lib/acoes/embarcacao.ts`, `web/app/(app)/barco/editar/page.tsx`
- Modify: `web/app/(app)/barco/page.tsx` (bloco "Dados gerais" + link de editar)

**Interfaces:**
- Consumes: `carregarPainel`, `parseDecimalPtBr`, `podeEditar`.
- Produces: action `salvarDadosGerais(formData)` — campos `nome`, `estaleiro`, `modelo`, `ano`, `marina`, `comprimento_m`, `boca_m`, `calado_m`, `casco_material`, `casco_numero`, `tie`, `capitania`, `propulsao`. Sucesso → `/barco?ok=Dados salvos`.

- [ ] **Step 1: `web/lib/acoes/embarcacao.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

function erroEditar(msg: string): never {
  redirect(`/barco/editar?erro=${encodeURIComponent(msg)}`)
}

export async function salvarDadosGerais(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroEditar("Só o proprietário edita os dados da embarcação.")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome")
  if (!nome) erroEditar("O barco precisa de um nome.")

  const medida = (k: string, rotulo: string) => {
    const bruto = texto(k)
    if (bruto === null) return null
    const n = parseDecimalPtBr(bruto)
    if (n === null || n <= 0) erroEditar(`Informe ${rotulo} em metros (ex.: 14,60).`)
    return n
  }
  const anoBruto = texto("ano")
  const ano = anoBruto === null ? null : parseDecimalPtBr(anoBruto)
  if (anoBruto !== null && (ano === null || ano < 1900 || ano > 2100)) {
    erroEditar("Informe um ano válido (ex.: 2016).")
  }

  const { error } = await supabase
    .from("embarcacoes")
    .update({
      nome,
      estaleiro: texto("estaleiro"),
      modelo: texto("modelo"),
      ano,
      marina: texto("marina"),
      comprimento_m: medida("comprimento_m", "o comprimento"),
      boca_m: medida("boca_m", "a boca"),
      calado_m: medida("calado_m", "o calado"),
      casco_material: texto("casco_material"),
      casco_numero: texto("casco_numero"),
      tie: texto("tie"),
      capitania: texto("capitania"),
      propulsao: texto("propulsao"),
    })
    .eq("id", painel.embarcacao.id)
  if (error) erroEditar("Não foi possível salvar. Confira seu acesso e tente de novo.")

  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect(`/barco?ok=${encodeURIComponent("Dados da embarcação salvos")}`)
}
```

- [ ] **Step 2: `web/app/(app)/barco/editar/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import Link from "next/link"
import { Icone } from "@/components/icone"
import { salvarDadosGerais } from "@/lib/acoes/embarcacao"
import { carregarPainel } from "@/lib/consultas"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function EditarEmbarcacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") {
    redirect(`/barco?erro=${encodeURIComponent("Só o proprietário edita os dados da embarcação.")}`)
  }
  const e = painel.embarcacao
  const num = (v: number | null) => (v == null ? "" : String(v).replace(".", ","))

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <h1 className="titulo-pagina mt-3">Dados da embarcação</h1>
      <p className="apoio mt-1 text-dim">O que estiver aqui aparece no dossiê e no Selo Ouro.</p>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarDadosGerais} className="mt-5 space-y-5">
        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="embarcacao" className="size-3.5" /> Identificação</p>
          <div>
            <label className={rot} htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required defaultValue={e.nome} className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="estaleiro">Estaleiro</label>
              <input id="estaleiro" name="estaleiro" defaultValue={e.estaleiro ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" defaultValue={e.modelo ?? ""} className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" defaultValue={e.ano ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="marina">Marina</label>
              <input id="marina" name="marina" defaultValue={e.marina ?? ""} className={campo} />
            </div>
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="ancora" className="size-3.5" /> Medidas e casco</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rot} htmlFor="comprimento_m">Compr. (m)</label>
              <input id="comprimento_m" name="comprimento_m" inputMode="decimal" placeholder="14,60"
                defaultValue={num(e.comprimento_m)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="boca_m">Boca (m)</label>
              <input id="boca_m" name="boca_m" inputMode="decimal" placeholder="4,35"
                defaultValue={num(e.boca_m)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="calado_m">Calado (m)</label>
              <input id="calado_m" name="calado_m" inputMode="decimal" placeholder="1,20"
                defaultValue={num(e.calado_m)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="casco_material">Material do casco</label>
              <input id="casco_material" name="casco_material" list="materiais" placeholder="PRFV"
                defaultValue={e.casco_material ?? ""} className={campo} />
              <datalist id="materiais">
                <option value="PRFV" /><option value="Fibra de vidro" /><option value="Alumínio" />
                <option value="Aço" /><option value="Madeira" />
              </datalist>
            </div>
            <div>
              <label className={rot} htmlFor="casco_numero">Nº do casco</label>
              <input id="casco_numero" name="casco_numero" defaultValue={e.casco_numero ?? ""} className={campo} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="propulsao">Propulsão</label>
            <input id="propulsao" name="propulsao" list="propulsoes" placeholder="2× diesel · pés IPS"
              defaultValue={e.propulsao ?? ""} className={campo} />
            <datalist id="propulsoes">
              <option value="Centro-rabeta" /><option value="Pés IPS" /><option value="Linha de eixo" />
              <option value="Popa" /><option value="Jato" />
            </datalist>
          </div>
        </section>

        <section className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="rotulo flex items-center gap-1.5 text-dim"><Icone nome="documento" className="size-3.5" /> Registro</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="tie">TIE</label>
              <input id="tie" name="tie" defaultValue={e.tie ?? ""} className={`${campo} font-mono-instr`} />
            </div>
            <div>
              <label className={rot} htmlFor="capitania">Capitania</label>
              <input id="capitania" name="capitania" placeholder="CP do Rio de Janeiro"
                defaultValue={e.capitania ?? ""} className={campo} />
            </div>
          </div>
        </section>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar dados</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: mostrar e linkar na ficha** — em `web/app/(app)/barco/page.tsx`, ANTES do bloco "Acervo do barco", inserir:

```tsx
      <div className="mt-6 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="embarcacao" className="size-3.5" /> Dados gerais
        </p>
        {papel === "PROP" && (
          <Link href="/barco/editar" className="corpo text-accent-forte">Editar</Link>
        )}
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ["Comprimento", embarcacao.comprimento_m != null ? `${embarcacao.comprimento_m.toLocaleString("pt-BR")} m` : null],
            ["Boca", embarcacao.boca_m != null ? `${embarcacao.boca_m.toLocaleString("pt-BR")} m` : null],
            ["Calado", embarcacao.calado_m != null ? `${embarcacao.calado_m.toLocaleString("pt-BR")} m` : null],
            ["Casco", [embarcacao.casco_material, embarcacao.casco_numero].filter(Boolean).join(" · ") || null],
            ["Propulsão", embarcacao.propulsao],
            ["TIE", embarcacao.tie],
            ["Capitania", embarcacao.capitania],
          ] as [string, string | null][]).map(([nome, valor]) => (
            <div key={nome}>
              <dt className="rotulo text-dim">{nome}</dt>
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
      </div>
```

- [ ] **Step 4:** `npm test` 79/79; `npm run build` verde (rota `/barco/editar`); eslint limpo. Commit:
`git add web; git commit -m "feat: editar os dados gerais da embarcacao"`

---

### Task 4: Equipamentos — criar, editar e a aba Elétrica

**Files:**
- Create: `web/lib/acoes/equipamentos.ts`, `web/app/(app)/barco/equipamento/novo/page.tsx`, `web/app/(app)/barco/equipamento/[id]/editar/page.tsx`, `web/app/(app)/barco/eletrica/page.tsx`
- Modify: `web/app/(app)/barco/page.tsx` (seção Elétrica com link)

**Interfaces:**
- Consumes: `carregarPainel`, `podeEditar`, `parseDecimalPtBr`, `Icone`, `Farol`, `Horimetro`.
- Produces: actions `criarEquipamento(formData)`, `salvarEquipamento(formData)`, `excluirEquipamento(formData)`. Campos: `tipo` (motor|gerador|bateria|outro), `posicao`, `marca`, `modelo`, `numero_serie`, `identificacao_interna`, `ano`, `potencia_hp`, `combustivel`, `quantidade`, `horas_atuais`, `observacoes`.

- [ ] **Step 1: `web/lib/acoes/equipamentos.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

const TIPOS = ["motor", "gerador", "bateria", "outro"]
const POSICOES = ["BB", "BE", "central"]

function erroNovo(msg: string): never {
  redirect(`/barco/equipamento/novo?erro=${encodeURIComponent(msg)}`)
}
function erroEditar(id: string, msg: string): never {
  redirect(`/barco/equipamento/${id}/editar?erro=${encodeURIComponent(msg)}`)
}

function camposDoForm(formData: FormData, falhar: (msg: string) => never) {
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const tipo = String(formData.get("tipo") ?? "")
  if (!TIPOS.includes(tipo)) falhar("Escolha o tipo do equipamento.")
  const posicaoBruta = texto("posicao")
  const posicao = posicaoBruta && POSICOES.includes(posicaoBruta) ? posicaoBruta : null

  const inteiro = (k: string, rotulo: string) => {
    const bruto = texto(k)
    if (bruto === null) return null
    const n = parseDecimalPtBr(bruto)
    if (n === null || n < 0) falhar(`Informe ${rotulo} com números.`)
    return Math.round(n)
  }
  const horasBruto = texto("horas_atuais")
  const horas = horasBruto === null ? null : parseDecimalPtBr(horasBruto)
  if (horasBruto !== null && (horas === null || horas < 0)) falhar("Informe as horas com números.")

  return {
    tipo,
    posicao,
    marca: texto("marca"),
    modelo: texto("modelo"),
    numero_serie: texto("numero_serie"),
    identificacao_interna: texto("identificacao_interna"),
    ano: inteiro("ano", "o ano"),
    potencia_hp: inteiro("potencia_hp", "a potência"),
    combustivel: texto("combustivel"),
    quantidade: inteiro("quantidade", "a quantidade"),
    horas_atuais: horas,
    observacoes: texto("observacoes"),
  }
}

export async function criarEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const dados = camposDoForm(formData, erroNovo)

  const { data, error } = await supabase
    .from("equipamentos")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      ...dados,
      ultima_leitura: dados.horas_atuais != null ? new Date().toISOString() : null,
    })
    .select("id, tipo")
    .single()
  if (error || !data) erroNovo("Não foi possível criar — confira seu acesso a esta aba.")

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/hoje")
  redirect(
    data.tipo === "motor"
      ? `/barco/equipamento/${data.id}?ok=${encodeURIComponent("Equipamento criado")}`
      : `/barco/eletrica?ok=${encodeURIComponent("Equipamento criado")}`,
  )
}

export async function salvarEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  if (!painel.equipamentos.some((e) => e.id === id)) erroEditar(id, "Equipamento não encontrado.")
  const dados = camposDoForm(formData, (msg) => erroEditar(id, msg))

  const { data, error } = await supabase
    .from("equipamentos").update(dados).eq("id", id).select("id").maybeSingle()
  if (error || !data) erroEditar(id, "Não foi possível salvar — confira seu acesso a esta aba.")

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath(`/barco/equipamento/${id}`)
  redirect(`/barco/equipamento/${id}?ok=${encodeURIComponent("Equipamento salvo")}`)
}

export async function excluirEquipamento(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const id = String(formData.get("equipamento_id") ?? "")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) erroEditar(id, "Equipamento não encontrado.")

  const { error } = await supabase.from("equipamentos").delete().eq("id", id)
  if (error) erroEditar(id, "Não foi possível excluir — confira seu acesso.")

  revalidatePath("/barco")
  revalidatePath("/barco/eletrica")
  revalidatePath("/hoje")
  redirect(
    equipamento.tipo === "motor"
      ? `/barco?ok=${encodeURIComponent("Equipamento excluído")}`
      : `/barco/eletrica?ok=${encodeURIComponent("Equipamento excluído")}`,
  )
}
```

- [ ] **Step 2: formulário reutilizável** — criar `web/app/(app)/barco/equipamento/novo/page.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { Icone } from "@/components/icone"
import { criarEquipamento } from "@/lib/acoes/equipamentos"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function NovoEquipamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; tipo?: string }>
}) {
  const { erro, tipo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const tipoInicial = ["motor", "gerador", "bateria", "outro"].includes(tipo ?? "") ? tipo! : "gerador"
  const aba = tipoInicial === "motor" ? "motores" : "eletrica"
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não permite cadastrar este equipamento.")}`)
  }

  return (
    <main>
      <Link href={tipoInicial === "motor" ? "/barco" : "/barco/eletrica"}
        className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> {tipoInicial === "motor" ? "Embarcação" : "Elétrica"}
      </Link>
      <h1 className="titulo-pagina mt-3">Novo equipamento</h1>
      <p className="apoio mt-1 text-dim">Gerador, baterias, motor — tudo que tem manutenção própria.</p>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={criarEquipamento} className="mt-5 space-y-4">
        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={tipoInicial} className={campo}>
                <option value="gerador">Gerador</option>
                <option value="bateria">Baterias</option>
                <option value="motor">Motor</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={rot} htmlFor="posicao">Posição</label>
              <select id="posicao" name="posicao" defaultValue="" className={campo}>
                <option value="">Sem posição</option>
                <option value="BB">Bombordo (BB)</option>
                <option value="BE">Boreste (BE)</option>
                <option value="central">Central</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="marca">Marca</label>
              <input id="marca" name="marca" placeholder="Kohler" className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" placeholder="9EFKOZD" className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="numero_serie">Nº de série</label>
              <input id="numero_serie" name="numero_serie" className={`${campo} font-mono-instr`} />
            </div>
            <div>
              <label className={rot} htmlFor="identificacao_interna">Identificação interna</label>
              <input id="identificacao_interna" name="identificacao_interna" placeholder="Motor 1" className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="potencia_hp">Potência (hp)</label>
              <input id="potencia_hp" name="potencia_hp" inputMode="numeric" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="quantidade">Quantidade</label>
              <input id="quantidade" name="quantidade" inputMode="numeric" placeholder="4" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="combustivel">Combustível</label>
              <input id="combustivel" name="combustivel" list="combustiveis" placeholder="Diesel S10" className={campo} />
              <datalist id="combustiveis">
                <option value="Diesel S10" /><option value="Diesel S500" /><option value="Gasolina" />
              </datalist>
            </div>
            <div>
              <label className={rot} htmlFor="horas_atuais">Horas atuais</label>
              <input id="horas_atuais" name="horas_atuais" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="observacoes">Observações</label>
            <input id="observacoes" name="observacoes" placeholder="Ex.: revenda autorizada em Niterói" className={campo} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Criar equipamento</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: `web/app/(app)/barco/equipamento/[id]/editar/page.tsx`** — mesmo formulário com `defaultValue` do equipamento, `action={salvarEquipamento}`, hidden `equipamento_id`, e um bloco de exclusão ao final:

```tsx
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Confirmar } from "@/components/confirmar"
import { Icone } from "@/components/icone"
import { excluirEquipamento, salvarEquipamento } from "@/lib/acoes/equipamentos"
import { carregarPainel } from "@/lib/consultas"
import { podeEditar } from "@/lib/domain/permissoes"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function EditarEquipamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { id } = await params
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const eq = painel.equipamentos.find((e) => e.id === id)
  if (!eq) notFound()
  const aba = eq.tipo === "motor" ? "motores" : "eletrica"
  if (!podeEditar(painel.permissoes, aba)) {
    redirect(`/barco?erro=${encodeURIComponent("Seu acesso não permite editar este equipamento.")}`)
  }
  const n = (v: number | null) => (v == null ? "" : String(v).replace(".", ","))

  return (
    <main>
      <Link href={`/barco/equipamento/${id}`} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Voltar
      </Link>
      <h1 className="titulo-pagina mt-3">Editar equipamento</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <form action={salvarEquipamento} className="mt-5 space-y-4">
        <input type="hidden" name="equipamento_id" value={id} />
        <div className="sombra-1 space-y-3 rounded-[14px] border border-line bg-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={eq.tipo} className={campo}>
                <option value="gerador">Gerador</option>
                <option value="bateria">Baterias</option>
                <option value="motor">Motor</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={rot} htmlFor="posicao">Posição</label>
              <select id="posicao" name="posicao" defaultValue={eq.posicao ?? ""} className={campo}>
                <option value="">Sem posição</option>
                <option value="BB">Bombordo (BB)</option>
                <option value="BE">Boreste (BE)</option>
                <option value="central">Central</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="marca">Marca</label>
              <input id="marca" name="marca" defaultValue={eq.marca ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="modelo">Modelo</label>
              <input id="modelo" name="modelo" defaultValue={eq.modelo ?? ""} className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="numero_serie">Nº de série</label>
              <input id="numero_serie" name="numero_serie" defaultValue={eq.numero_serie ?? ""} className={`${campo} font-mono-instr`} />
            </div>
            <div>
              <label className={rot} htmlFor="identificacao_interna">Identificação interna</label>
              <input id="identificacao_interna" name="identificacao_interna" defaultValue={eq.identificacao_interna ?? ""} className={campo} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={rot} htmlFor="ano">Ano</label>
              <input id="ano" name="ano" inputMode="numeric" defaultValue={eq.ano ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="potencia_hp">Potência (hp)</label>
              <input id="potencia_hp" name="potencia_hp" inputMode="numeric" defaultValue={eq.potencia_hp ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
            <div>
              <label className={rot} htmlFor="quantidade">Quantidade</label>
              <input id="quantidade" name="quantidade" inputMode="numeric" defaultValue={eq.quantidade ?? ""} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={rot} htmlFor="combustivel">Combustível</label>
              <input id="combustivel" name="combustivel" defaultValue={eq.combustivel ?? ""} className={campo} />
            </div>
            <div>
              <label className={rot} htmlFor="horas_atuais">Horas atuais</label>
              <input id="horas_atuais" name="horas_atuais" inputMode="decimal" defaultValue={n(eq.horas_atuais)} className={`${campo} font-mono-instr tabular-nums`} />
            </div>
          </div>
          <div>
            <label className={rot} htmlFor="observacoes">Observações</label>
            <input id="observacoes" name="observacoes" defaultValue={eq.observacoes ?? ""} className={campo} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Salvar equipamento</button>
      </form>

      <form action={excluirEquipamento} className="mt-8 flex justify-center">
        <input type="hidden" name="equipamento_id" value={id} />
        <Confirmar
          mensagem="Excluir equipamento e todo o seu histórico de itens?"
          rotulo="Excluir equipamento"
          className="flex h-11 items-center corpo text-crit"
        />
      </form>
    </main>
  )
}
```

- [ ] **Step 4: `web/app/(app)/barco/eletrica/page.tsx`:**

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Icone } from "@/components/icone"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo, PESO, type StatusFarol } from "@/lib/domain/semaforo"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"

export default async function EletricaPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (!podeVer(painel.permissoes, "eletrica")) {
    redirect(`/hoje?erro=${encodeURIComponent("Seu acesso não inclui a elétrica.")}`)
  }
  const editavel = podeEditar(painel.permissoes, "eletrica")
  const hoje = hojeISO()
  const equipamentos = painel.equipamentos.filter((e) => e.tipo !== "motor")

  const statusDe = (eqId: string): StatusFarol =>
    painel.itens
      .filter((i) => i.equipamento_id === eqId)
      .map((i) => {
        const eq = painel.equipamentos.find((e) => e.id === eqId)
        return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status
      })
      .sort((a, b) => PESO[b] - PESO[a])[0] ?? "ok"

  const rotuloTipo: Record<string, string> = {
    gerador: "Gerador", bateria: "Baterias", outro: "Equipamento", motor: "Motor",
  }

  return (
    <main>
      <Link href="/barco" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Embarcação
      </Link>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="titulo-pagina">Elétrica</h1>
        {editavel && (
          <Link href="/barco/equipamento/novo?tipo=gerador"
            className="inline-flex items-center gap-1 rounded-full bg-accent px-4 py-2 corpo font-semibold text-acao-texto">
            <Icone nome="mais" className="size-4" /> Equipamento
          </Link>
        )}
      </div>
      <p className="apoio mt-1 text-dim">Gerador, baterias e o que mais tiver manutenção própria a bordo.</p>

      <div className="sombra-1 mt-5 rounded-[14px] border border-line bg-panel px-4">
        {equipamentos.length === 0 && (
          <div className="py-6 text-center">
            <Icone nome="raio" className="mx-auto size-7 text-dim" />
            <p className="corpo mt-2 font-medium">Nada cadastrado ainda</p>
            <p className="apoio mt-1 text-dim">
              Cadastre o gerador e as baterias para o app avisar das manutenções deles também.
            </p>
          </div>
        )}
        {equipamentos.map((e) => {
          const itens = painel.itens.filter((i) => i.equipamento_id === e.id)
          return (
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className="flex items-center gap-3 border-b border-line py-3.5 last:border-0">
              <Farol status={statusDe(e.id)} />
              <div className="min-w-0 flex-1">
                <p className="titulo-card">
                  {rotuloTipo[e.tipo] ?? "Equipamento"}
                  {e.posicao ? ` ${e.posicao}` : ""}
                  {e.quantidade != null ? ` · ${e.quantidade}×` : ""}
                </p>
                <p className="apoio mt-0.5 text-dim">
                  {[e.marca, e.modelo].filter(Boolean).join(" ") || "Sem marca informada"}
                  {e.horas_atuais != null ? ` · ${e.horas_atuais.toLocaleString("pt-BR")} h` : ""}
                  {` · ${itens.length} ${itens.length === 1 ? "item" : "itens"}`}
                </p>
              </div>
              <Icone nome="chevron" className="size-4 text-dim" />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: seção Elétrica na ficha** — em `web/app/(app)/barco/page.tsx`, logo APÓS a seção "Motores", inserir:

```tsx
      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="raio" className="size-3.5" /> Elétrica
        </p>
        <Link href="/barco/eletrica" className="corpo text-accent-forte">Ver tudo</Link>
      </div>
      <Link href="/barco/eletrica" className="sombra-1 block rounded-[14px] border border-line bg-panel p-3.5">
        <p className="titulo-card">
          {equipamentos.filter((e) => e.tipo !== "motor").length === 0
            ? "Cadastre gerador e baterias"
            : `${equipamentos.filter((e) => e.tipo !== "motor").length} equipamentos`}
        </p>
        <p className="apoio mt-0.5 text-dim">Manutenção do gerador, troca das baterias e painel de bordo</p>
      </Link>
```

- [ ] **Step 6:** `npm test` 79/79; `npm run build` verde (rotas `/barco/eletrica`, `/barco/equipamento/novo`, `/barco/equipamento/[id]/editar`); eslint limpo. Commit:
`git add web; git commit -m "feat: cadastro de equipamentos e a aba eletrica"`

---

### Task 5: Domínio de uso (TDD) + tela do motor repaginada

**Files:**
- Create: `web/lib/domain/uso.ts`, `web/lib/domain/uso.test.ts`
- Modify: `web/app/(app)/barco/equipamento/[id]/page.tsx`

**Interfaces:**
- Produces: `interface LeituraHoras { data: string; horas: number }`, `mediaHorasPorSemana(leituras: LeituraHoras[]): number | null`, `previsaoDias(horasRestantes: number, mediaSemana: number): number | null`.

- [ ] **Step 1: testes primeiro** — `web/lib/domain/uso.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { mediaHorasPorSemana, previsaoDias } from "./uso"

describe("mediaHorasPorSemana", () => {
  it("menos de duas leituras não tem média", () => {
    expect(mediaHorasPorSemana([])).toBeNull()
    expect(mediaHorasPorSemana([{ data: "2026-08-01", horas: 100 }])).toBeNull()
  })
  it("28 dias e 36 horas dão 9 h por semana", () => {
    expect(
      mediaHorasPorSemana([
        { data: "2026-07-05", horas: 1000 },
        { data: "2026-08-02", horas: 1036 },
      ]),
    ).toBeCloseTo(9, 2)
  })
  it("usa a leitura mais antiga e a mais nova, fora de ordem", () => {
    expect(
      mediaHorasPorSemana([
        { data: "2026-08-02", horas: 1036 },
        { data: "2026-07-19", horas: 1020 },
        { data: "2026-07-05", horas: 1000 },
      ]),
    ).toBeCloseTo(9, 2)
  })
  it("mesmo dia não divide por zero", () => {
    expect(
      mediaHorasPorSemana([
        { data: "2026-08-02", horas: 1000 },
        { data: "2026-08-02", horas: 1010 },
      ]),
    ).toBeNull()
  })
})

describe("previsaoDias", () => {
  it("37 horas a 9 h por semana dão ~29 dias", () => {
    expect(previsaoDias(37, 9)).toBe(29)
  })
  it("sem uso não há previsão", () => {
    expect(previsaoDias(37, 0)).toBeNull()
  })
  it("já vencido não projeta", () => {
    expect(previsaoDias(-5, 9)).toBe(0)
  })
})
```

- [ ] **Step 2:** `npm test` → FAIL (módulo inexistente).

- [ ] **Step 3: `web/lib/domain/uso.ts`:**

```ts
export interface LeituraHoras {
  data: string
  horas: number
}

/** Horas de motor por semana entre a primeira e a última leitura. */
export function mediaHorasPorSemana(leituras: LeituraHoras[]): number | null {
  if (leituras.length < 2) return null
  const ordenadas = [...leituras].sort((a, b) => a.data.localeCompare(b.data))
  const primeira = ordenadas[0]
  const ultima = ordenadas[ordenadas.length - 1]
  const dias =
    (Date.parse(`${ultima.data}T00:00:00Z`) - Date.parse(`${primeira.data}T00:00:00Z`)) / 86_400_000
  if (dias <= 0) return null
  const horas = ultima.horas - primeira.horas
  if (horas <= 0) return 0
  return (horas / dias) * 7
}

/** Em quantos dias as horas restantes acabam, no ritmo atual. */
export function previsaoDias(horasRestantes: number, mediaSemana: number): number | null {
  if (mediaSemana <= 0) return null
  if (horasRestantes <= 0) return 0
  return Math.round((horasRestantes / mediaSemana) * 7)
}
```

- [ ] **Step 4:** `npm test` → 86/86 (79 + 7).

- [ ] **Step 5: tela do motor** — substituir `web/app/(app)/barco/equipamento/[id]/page.tsx` INTEIRO:

```tsx
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { Horimetro } from "@/components/horimetro"
import { Icone, type NomeIcone } from "@/components/icone"
import { calcularSemaforo, PESO, textoRestante } from "@/lib/domain/semaforo"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { formatarReais } from "@/lib/domain/gastos"
import { mediaHorasPorSemana, previsaoDias } from "@/lib/domain/uso"
import { podeEditar } from "@/lib/domain/permissoes"
import { supabaseServer } from "@/lib/supabase/server"

export default async function EquipamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const equipamento = painel.equipamentos.find((e) => e.id === id)
  if (!equipamento) notFound()

  const ehMotor = equipamento.tipo === "motor"
  const aba = ehMotor ? "motores" : "eletrica"
  const editavel = podeEditar(painel.permissoes, aba)
  const hoje = hojeISO()

  const itens = painel.itens
    .filter((i) => i.equipamento_id === id)
    .map((i) => ({ item: i, r: calcularSemaforo(itemMonitoradoToItemCalc(i), equipamento.horas_atuais ?? null, hoje) }))
    .sort((a, b) => PESO[b.r.status] - PESO[a.r.status])
  const statusGeral = itens[0]?.r.status ?? "ok"

  const supabase = await supabaseServer()
  const [{ data: eventos }, { data: leituras }] = await Promise.all([
    supabase.from("eventos")
      .select("id, data, tipo, descricao, horas_no_momento, custo_centavos")
      .eq("equipamento_id", id).order("data", { ascending: false }).limit(10),
    supabase.from("eventos")
      .select("data, horas_no_momento")
      .eq("equipamento_id", id).eq("tipo", "leitura_horas")
      .not("horas_no_momento", "is", null).order("data", { ascending: false }).limit(30),
  ])

  const media = mediaHorasPorSemana(
    (leituras ?? []).map((l: { data: string; horas_no_momento: number }) => ({ data: l.data, horas: l.horas_no_momento })),
  )
  const irmaos = painel.equipamentos.filter((e) => e.tipo === equipamento.tipo)
  const rotuloTipo = ehMotor ? "Motor" : equipamento.tipo === "gerador" ? "Gerador" : equipamento.tipo === "bateria" ? "Baterias" : "Equipamento"
  const nomeCurto = (e: typeof equipamento) => `${rotuloTipo}${e.posicao ? ` ${e.posicao}` : ""}`

  const especificacoes: [string, string | null][] = [
    ["Nº de série", equipamento.numero_serie],
    ["Identificação", equipamento.identificacao_interna],
    ["Ano", equipamento.ano != null ? String(equipamento.ano) : null],
    ["Potência", equipamento.potencia_hp != null ? `${equipamento.potencia_hp} hp` : null],
    ["Combustível", equipamento.combustivel],
    ["Quantidade", equipamento.quantidade != null ? `${equipamento.quantidade}×` : null],
  ]

  return (
    <main>
      <Link href={ehMotor ? "/barco" : "/barco/eletrica"} className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> {ehMotor ? "Embarcação" : "Elétrica"}
      </Link>

      {irmaos.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {irmaos.map((e) => (
            <Link key={e.id} href={`/barco/equipamento/${e.id}`}
              className={`whitespace-nowrap rounded-full border px-4 py-2 font-mono-instr text-[11px] ${
                e.id === id ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
              }`}>
              {nomeCurto(e)}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Horimetro
          rotulo={`${nomeCurto(equipamento)} — ${[equipamento.marca, equipamento.modelo].filter(Boolean).join(" ") || "sem marca"}`}
          horas={equipamento.horas_atuais ?? 0}
          status={statusGeral}
          grande
        />
      </div>
      {media != null && (
        <p className="apoio mt-2 text-center font-mono-instr tabular-nums text-dim">
          {media > 0
            ? `média de ${media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h por semana`
            : "sem uso registrado no período"}
        </p>
      )}

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="ferramenta" className="size-3.5" /> Itens monitorados
        </p>
        {editavel && (
          <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`eq:${id}`)}`} className="corpo text-accent-forte">
            Novo item
          </Link>
        )}
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {itens.length === 0 && (
          <p className="corpo py-4 text-dim">Nenhum item monitorado aqui ainda.</p>
        )}
        {itens.map(({ item, r }) => {
          const dias = r.horasRestantes != null && media != null ? previsaoDias(r.horasRestantes, media) : null
          return (
            <div key={item.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <div className="min-w-0 flex-1">
                <p className="titulo-card">{item.nome}</p>
                <p className="apoio mt-0.5 text-dim">
                  {[
                    item.intervalo_horas != null ? `a cada ${item.intervalo_horas} h` : null,
                    item.intervalo_meses != null ? `${item.intervalo_meses} meses` : null,
                    item.especificacao,
                    item.quantidade,
                  ].filter(Boolean).join(" · ") || "sem regra definida"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-mono-instr text-sm font-semibold tabular-nums ${
                  r.status === "vencido" ? "text-crit" : r.status === "atencao" ? "text-warn" : "text-dim"
                }`}>
                  {textoRestante(r)}
                </p>
                {dias != null && dias > 0 && r.status !== "vencido" && (
                  <p className="apoio font-mono-instr tabular-nums text-dim">~{dias} dias</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="rotulo mt-6 mb-2 flex items-center gap-1.5 text-dim">
        <Icone nome="documento" className="size-3.5" /> Especificação
      </p>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {especificacoes.map(([nome, valor]) => (
            <div key={nome}>
              <dt className="rotulo text-dim">{nome}</dt>
              <dd className="corpo mt-0.5">{valor ?? <span className="text-dim">—</span>}</dd>
            </div>
          ))}
        </dl>
        {equipamento.observacoes && <p className="apoio mt-3 text-dim">{equipamento.observacoes}</p>}
        {editavel && (
          <Link href={`/barco/equipamento/${id}/editar`} className="corpo mt-3 inline-block text-accent-forte">
            Editar equipamento
          </Link>
        )}
      </div>

      <div className="mt-6 mb-2 flex items-baseline justify-between">
        <p className="rotulo flex items-center gap-1.5 text-dim">
          <Icone nome="calendario" className="size-3.5" /> Histórico
        </p>
        <Link href={`/diario/novo?alvo=${encodeURIComponent(`eq:${id}`)}`} className="corpo text-accent-forte">
          Registrar serviço
        </Link>
      </div>
      <div className="sombra-1 rounded-[14px] border border-line bg-panel px-4">
        {(eventos ?? []).length === 0 && (
          <p className="corpo py-4 text-dim">Nenhum serviço registrado neste equipamento ainda.</p>
        )}
        {(eventos ?? []).map((e) => (
          <div key={e.id} className="border-b border-line py-3 last:border-0">
            <p className="titulo-card">{e.descricao ?? e.tipo}</p>
            <p className="apoio mt-0.5 font-mono-instr tabular-nums text-dim">
              {e.data.split("-").reverse().join("/")}
              {e.horas_no_momento != null ? ` · ${e.horas_no_momento.toLocaleString("pt-BR")} h` : ""}
              {e.custo_centavos != null ? ` · ${formatarReais(e.custo_centavos)}` : ""}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

Nota: o import de `NomeIcone` não é usado neste arquivo — remova-o se o lint acusar.

- [ ] **Step 6:** `npm test` 86/86; `npm run build` verde; eslint limpo. Commit:
`git add web; git commit -m "feat: tela do equipamento com abas, especificacao e media de uso (TDD)"`

---

### Task 6: Perfil, saudação e seletor de embarcação

**Files:**
- Create: `web/lib/embarcacao-ativa.ts`, `web/components/avatar.tsx`, `web/components/seletor-embarcacao.tsx`, `web/lib/acoes/perfil.ts`, `web/app/(app)/menu/perfil/page.tsx`
- Modify: `web/lib/consultas.ts` (respeitar a embarcação ativa), `web/app/(app)/hoje/page.tsx` (saudação + seletor), `web/app/(app)/menu/page.tsx` (link do perfil)

**Interfaces:**
- Produces: `lerEmbarcacaoAtiva(): Promise<string | null>` e `definirEmbarcacaoAtiva(id: string)` (server action, cookie `barco`); `<Avatar url nome tamanho />`; `<SeletorEmbarcacao atual={{id,nome}} opcoes={{id,nome}[]} />`; action `salvarPerfil(formData)` (campos `nome`, `telefone`, `avatar`).
- `carregarPainel` passa a retornar também `embarcacoes: { id: string; nome: string }[]` (todas as visíveis) e escolhe a ativa pelo cookie quando ele aponta para uma embarcação com vínculo.

- [ ] **Step 1: `web/lib/embarcacao-ativa.ts`:**

```ts
"use server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

const COOKIE = "barco"

export async function lerEmbarcacaoAtiva(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null
}

export async function definirEmbarcacaoAtiva(formData: FormData) {
  const id = String(formData.get("embarcacao_id") ?? "")
  if (id) {
    ;(await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 })
  }
  revalidatePath("/", "layout")
}
```

- [ ] **Step 2: `carregarPainel` respeita o cookie** — em `web/lib/consultas.ts`: importar `lerEmbarcacaoAtiva`; após carregar `meusVinculos`, escolher o vínculo assim:

```ts
  const ativa = await lerEmbarcacaoAtiva()
  const vinculo =
    (ativa ? (meusVinculos ?? []).find((v) => v.embarcacao_id === ativa) : undefined) ??
    (meusVinculos ?? []).find((v) => v.papel === "PROP") ??
    (meusVinculos ?? [])[0]
```

e acrescentar ao retorno `embarcacoes` (lista de todas as visíveis, para o seletor):

```ts
  const { data: todas } = await supabase.from("embarcacoes").select("id, nome").order("nome")
```
com o tipo de retorno ganhando `embarcacoes: { id: string; nome: string }[]` e o objeto final incluindo `embarcacoes: todas ?? []`.

- [ ] **Step 3: `web/components/avatar.tsx`:**

```tsx
export function Avatar({
  url,
  nome,
  tamanho = "size-10",
}: {
  url: string | null
  nome: string
  tamanho?: string
}) {
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do storage */
      <img src={url} alt={`Foto de ${nome}`} className={`${tamanho} shrink-0 rounded-full border border-line object-cover`} />
    )
  }
  return (
    <span className={`${tamanho} flex shrink-0 items-center justify-center rounded-full border border-line bg-panel2 font-mono-instr text-sm text-accent-forte`}>
      {iniciais}
    </span>
  )
}
```

- [ ] **Step 4: `web/components/seletor-embarcacao.tsx`:**

```tsx
"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"
import { definirEmbarcacaoAtiva } from "@/lib/embarcacao-ativa"

export function SeletorEmbarcacao({
  atual,
  opcoes,
}: {
  atual: { id: string; nome: string }
  opcoes: { id: string; nome: string }[]
}) {
  const [aberto, setAberto] = useState(false)
  if (opcoes.length < 2) {
    return <span className="corpo font-medium">{atual.nome}</span>
  }
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex h-11 items-center gap-1 corpo font-medium">
        {atual.nome}
        <Icone nome="chevron" className="size-3.5 rotate-90 text-dim" />
      </button>
      {aberto && (
        <span className="sombra-2 absolute left-0 top-11 z-20 min-w-[200px] rounded-[12px] border border-line bg-panel p-1">
          {opcoes.map((o) => (
            <form key={o.id} action={definirEmbarcacaoAtiva}>
              <input type="hidden" name="embarcacao_id" value={o.id} />
              <button className={`flex h-11 w-full items-center rounded-lg px-3 corpo ${
                o.id === atual.id ? "bg-panel2 font-semibold" : ""
              }`}>
                {o.nome}
              </button>
            </form>
          ))}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 5: `web/lib/acoes/perfil.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

function voltar(msg?: string): never {
  redirect(msg ? `/menu/perfil?erro=${encodeURIComponent(msg)}` : `/menu?ok=${encodeURIComponent("Perfil salvo")}`)
}

export async function salvarPerfil(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()

  const nome = String(formData.get("nome") ?? "").trim()
  if (!nome) voltar("Informe seu nome.")
  const telefone = String(formData.get("telefone") ?? "").trim() || null

  let avatarPath: string | null = null
  const avatar = formData.get("avatar")
  if (avatar instanceof File && avatar.size > 0) {
    if (!painel) voltar("Cadastre a embarcação antes de enviar uma foto.")
    if (!["image/jpeg", "image/png", "image/webp"].includes(avatar.type)) voltar("Use JPG, PNG ou WebP.")
    const r = await subirArquivo(supabase, painel.embarcacao.id, "fotos", avatar)
    if ("erro" in r) voltar(r.erro)
    avatarPath = r.path
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nome, telefone, ...(avatarPath ? { avatar_path: avatarPath } : {}) })
    .eq("id", user.id)
  if (error) voltar("Não foi possível salvar o perfil. Tente de novo.")

  revalidatePath("/menu")
  revalidatePath("/hoje")
  voltar()
}
```

- [ ] **Step 6: `web/app/(app)/menu/perfil/page.tsx`:**

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { Avatar } from "@/components/avatar"
import { Icone } from "@/components/icone"
import { salvarPerfil } from "@/lib/acoes/perfil"
import { supabaseServer } from "@/lib/supabase/server"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rot = "rotulo mb-1.5 block text-dim"

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: perfil } = await supabase
    .from("profiles").select("nome, telefone, avatar_path").eq("id", user.id).maybeSingle()
  const url = perfil?.avatar_path
    ? (await supabase.storage.from("acervo").createSignedUrl(perfil.avatar_path, 3600)).data?.signedUrl ?? null
    : null

  return (
    <main>
      <Link href="/menu" className="inline-flex items-center gap-1 rotulo text-accent-forte">
        <Icone nome="voltar" className="size-4" /> Menu
      </Link>
      <h1 className="titulo-pagina mt-3">Meu perfil</h1>
      {erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Avatar url={url} nome={perfil?.nome ?? "?"} tamanho="size-16" />
        <div>
          <p className="titulo-card">{perfil?.nome ?? "Sem nome"}</p>
          <p className="apoio text-dim">{user.email}</p>
        </div>
      </div>

      <form action={salvarPerfil} className="mt-5 space-y-3 sombra-1 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className={rot} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required defaultValue={perfil?.nome ?? ""} className={campo} />
        </div>
        <div>
          <label className={rot} htmlFor="telefone">Telefone</label>
          <input id="telefone" name="telefone" inputMode="tel" defaultValue={perfil?.telefone ?? ""}
            placeholder="21 99999-0000" className={campo} />
        </div>
        <div>
          <label className={rot} htmlFor="avatar">Foto — opcional</label>
          <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp"
            className={`${campo} py-2.5 corpo`} />
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar perfil</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: saudação na Home** — em `web/app/(app)/hoje/page.tsx`, ANTES do `<CardEmbarcacao>`:

```tsx
      <div className="mb-4 flex items-center gap-3">
        <Avatar url={urlAvatar} nome={nomeUsuario} />
        <div className="min-w-0">
          <p className="apoio text-dim">Olá, {nomeUsuario.split(" ")[0]}</p>
          <SeletorEmbarcacao
            atual={{ id: embarcacao.id, nome: embarcacao.nome }}
            opcoes={painel.embarcacoes}
          />
        </div>
      </div>
```

com os dados vindo de (após o `supabase` já criado no arquivo):

```tsx
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = await supabase
    .from("profiles").select("nome, avatar_path").eq("id", user?.id ?? "").maybeSingle()
  const nomeUsuario = perfil?.nome?.trim() || "comandante"
  const urlAvatar = perfil?.avatar_path
    ? (await supabase.storage.from("acervo").createSignedUrl(perfil.avatar_path, 3600)).data?.signedUrl ?? null
    : null
```

- [ ] **Step 8: link no Menu** — em `web/app/(app)/menu/page.tsx`, transformar o card "Conta" em `<Link href="/menu/perfil">` mantendo o conteúdo e acrescentando `<Icone nome="chevron" className="size-4 text-dim" />` à direita.

- [ ] **Step 9:** `npm test` 86/86; `npm run build` verde (rota `/menu/perfil`); eslint limpo. Commit:
`git add web; git commit -m "feat: perfil com avatar, saudacao e seletor de embarcacao"`

---

### Task 7: Aviso de sucesso e acabamento de navegação

**Files:**
- Create: `web/components/toast.tsx`
- Modify: `web/app/(app)/layout.tsx` (montar o Toast), e as páginas que redirecionam com `?ok=` (`barco`, `barco/eletrica`, `barco/equipamento/[id]`, `menu`) para aceitar o parâmetro; trocar `<a href>` interno por `<Link>` nas páginas que ainda usam.

**Interfaces:**
- Produces: `<Toast />` — client component que lê `?ok=` e mostra um aviso por 3 s, limpando a URL.

- [ ] **Step 1: `web/components/toast.tsx`:**

```tsx
"use client"
import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Icone } from "@/components/icone"

export function Toast() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const mensagem = params.get("ok")
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!mensagem) return
    setVisivel(true)
    const t = setTimeout(() => {
      setVisivel(false)
      const restantes = new URLSearchParams(params.toString())
      restantes.delete("ok")
      const query = restantes.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, 3000)
    return () => clearTimeout(t)
  }, [mensagem, params, pathname, router])

  if (!mensagem || !visivel) return null
  return (
    <div role="status" aria-live="polite"
      className="sombra-2 fixed inset-x-4 top-4 z-40 mx-auto flex max-w-[400px] items-center gap-2 rounded-[12px] border border-ok/40 bg-panel px-3.5 py-3">
      <Icone nome="escudo" className="size-4 text-ok" />
      <p className="corpo">{mensagem}</p>
    </div>
  )
}
```

- [ ] **Step 2: montar no layout** — em `web/app/(app)/layout.tsx`, envolver com Suspense (o `useSearchParams` exige):

```tsx
      <Suspense fallback={null}>
        <Toast />
      </Suspense>
```
(importar `Suspense` de `react` e `Toast` de `@/components/toast`; colocar logo após `<RegistrarSw />`.)

- [ ] **Step 3: páginas aceitam `?ok=`** — em `web/app/(app)/barco/page.tsx` e `web/app/(app)/menu/page.tsx`, adicionar a prop `searchParams: Promise<{ ok?: string; erro?: string }>` (se ainda não existir) e renderizar o erro no padrão dos demais (`{erro && <p className="corpo mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2">{erro}</p>}`). O `ok` é consumido pelo Toast — a página só precisa não quebrar com o parâmetro.

- [ ] **Step 4: `<a>` interno → `<Link>`** — trocar em `web/app/(app)/barco/{documentos,contatos,gastos,local}/page.tsx`, `diario/novo`, `diario/trilha/[id]`, `marketplace/perfil`, `menu/tripulacao/{page,[id]/page}` o `<a href="/...">` de voltar por `<Link href="/...">` (importando `Link from "next/link"`), preservando classes e o `<Icone nome="voltar">`.

- [ ] **Step 5: verificação final da onda** — `npm test` 86/86; `npm run build` verde; `npx eslint app components lib` limpo; grep confirmando que não sobrou `<a href="/` em `app/`. Commit:
`git add web; git commit -m "feat: aviso de sucesso e navegacao com Link"`

---

### Task 8: Preparar o agendamento dos alertas

**Files:**
- Create: `.github/workflows/alertas.yml`, `docs/OPERACAO.md`
- Modify: `web/app/api/alertas/disparar/route.ts` (maxDuration + envio em lotes + log de removidas)

**Interfaces:**
- Consumes: a rota existente.
- Produces: workflow agendado (desativado até existir URL pública) e o runbook de operação.

- [ ] **Step 1: robustez da rota** — em `web/app/api/alertas/disparar/route.ts`:
  (a) no topo, após os imports: `export const maxDuration = 60`;
  (b) trocar o envio sequencial de push por lotes paralelos: onde hoje há o `for (const a of assinaturas.filter(...))`, usar

```ts
      const doUsuario = assinaturas.filter((s) => s.usuario_id === u)
      const resultados = await Promise.allSettled(
        doUsuario.map((a) =>
          webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            JSON.stringify({ titulo, corpo, url: "/notificacoes" }),
          ),
        ),
      )
      for (let i = 0; i < resultados.length; i++) {
        const r = resultados[i]
        if (r.status === "fulfilled") {
          pushes++
          continue
        }
        const codigo = r.reason instanceof webpush.WebPushError ? r.reason.statusCode : null
        if (codigo === 404 || codigo === 410) {
          await admin.from("push_assinaturas").delete().eq("endpoint", doUsuario[i].endpoint)
          removidas++
        }
      }
```

  (c) antes do `NextResponse.json` final, registrar o resultado para quem estiver olhando os logs:
```ts
  console.log(`[alertas] ${alertas} alertas · ${pushes} pushes · ${emails} e-mails · ${removidas} assinaturas removidas`)
```

- [ ] **Step 2: `.github/workflows/alertas.yml`** (desativado até o deploy existir):

```yaml
name: Alertas do Commander
on:
  schedule:
    - cron: "0 11 * * *"   # 08:00 em Brasília
  workflow_dispatch:
jobs:
  disparar:
    runs-on: ubuntu-latest
    # Ative depois do deploy: cadastre os secrets COMMANDER_URL e ALERTAS_SEGREDO
    if: ${{ vars.ALERTAS_ATIVOS == 'true' }}
    steps:
      - name: Chamar a rota de disparo
        run: |
          resposta=$(curl -sS -o corpo.json -w "%{http_code}" -X POST \
            -H "Authorization: Bearer ${{ secrets.ALERTAS_SEGREDO }}" \
            "${{ secrets.COMMANDER_URL }}/api/alertas/disparar")
          echo "HTTP $resposta"; cat corpo.json
          test "$resposta" = "200"
```

- [ ] **Step 3: `docs/OPERACAO.md`:**

```markdown
# Operação do Commander

## Alertas automáticos
O motor de alertas é a rota `POST /api/alertas/disparar`, protegida por
`Authorization: Bearer $ALERTAS_SEGREDO`. Ela varre todos os barcos, calcula o semáforo
com o mesmo domínio das telas, grava em `alertas_enviados` (o que dedupe por item+janela+ciclo)
e envia push (+ e-mail se `RESEND_API_KEY` existir).

**Para ligar em produção:**
1. Cadastre no GitHub os secrets `COMMANDER_URL` (ex.: `https://app.commander.com.br`) e `ALERTAS_SEGREDO`.
2. Crie a variável de repositório `ALERTAS_ATIVOS = true`.
3. O workflow `.github/workflows/alertas.yml` roda todo dia às 08:00 de Brasília.
4. Confira a primeira execução em Actions: a resposta traz `{alertas, pushes, emails, removidas}`.

**Se os alertas pararem:** o workflow falha (exit ≠ 0) quando a rota não responde 200 — o GitHub
notifica por e-mail. Rode manualmente por "Run workflow" para testar.

## Variáveis de ambiente
| Nome | Onde | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | app | acesso do cliente com RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | só servidor | rota de alertas (ignora RLS) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | app / servidor | Web Push |
| `ALERTAS_SEGREDO` | servidor + CI | proteção da rota de disparo |
| `RESEND_API_KEY` | servidor (opcional) | e-mail de alerta |
| `NEXT_PUBLIC_APP_URL` | app | link do convite de tripulação |

## Banco
Migrations em `supabase/migrations/`, aplicadas via MCP no projeto `khgjtxvmduizyooqaoox`.
Antes de mexer em RLS, leia `docs/auditoria/auditoria-cto.md`.
```

- [ ] **Step 4:** `npm test` 86/86; `npm run build` verde; commit:
`git add .github docs web; git commit -m "feat: agendamento dos alertas preparado e rota mais robusta"`

---

## Self-review (executado na escrita)

- **Cobertura:** editar dados gerais (T3) · Elétrica utilizável + criar equipamentos (T4) · campos completos do motor e média de uso (T2/T5) · tela do motor com abas (T5) · saudação/avatar/seletor (T6) · toast e navegação (T7) · cron preparado + rota robusta (T8) · CI e hook (T1). Ficam para a Onda 3 (declarado): landing/preços/assinatura, lightbox das fotos, headings semânticos `<h2>`, validação inline, Selo Ouro, histórico por contato.
- **Placeholders:** nenhum.
- **Tipos:** `Perfil`/campos novos de `Equipamento` e `ItemMonitorado` (T2) usados em T4/T5/T6; `mediaHorasPorSemana`/`previsaoDias` (T5) só na tela do motor; `carregarPainel().embarcacoes` (T6) consumido na Home; `<Toast>` (T7) montado no layout e alimentado pelos `?ok=` que T3/T4/T6 produzem.
- **Contagem de testes:** 79 → 86 após T5 (7 de uso).

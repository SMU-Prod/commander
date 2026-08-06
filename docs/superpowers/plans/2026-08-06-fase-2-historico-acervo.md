# Commander Fase 2 — Histórico e acervo: Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diário de Bordo com filtros por sistema, criação de eventos que zeram o ciclo dos itens monitorados, Documentos com upload (Supabase Storage), Contatos com avaliação, Casco por categorias e painel de Gastos — completando a espec v2.0 §5.

**Architecture:** Mesma da Fase 1 — server components + server actions, domínio puro testado em `lib/domain/`, Supabase com RLS. Novidades: tabela `contatos`, tabela `documentos` + bucket privado `acervo` (policies por prefixo `embarcacao_id/` no path), colunas `categoria`/`contato_id`/`anexo_path` em eventos e `categoria` em itens monitorados. A UI de Documentos lista **itens monitorados de categoria `documento`** (fonte da validade/semáforo) com arquivo opcional vinculado — os seeds do onboarding (Seguro/TIE) aparecem lá pedindo anexo.

**Tech Stack:** o já instalado (Next 16, Tailwind v4 tokens Commander, `@supabase/ssr`, Vitest). Nenhuma dependência nova.

## Global Constraints

- Todo texto de UI em PT-BR; controles dizem o que fazem ("Salvar no diário", "Anexar apólice").
- Semáforo sempre calculado via `calcularSemaforo` (margens: documentos 30 dias; horas 15% do intervalo). Nunca gravar status.
- RLS em toda tabela e no bucket desde a migration — nunca `USING (true)`.
- Tokens do tema Commander (`bg-panel`, `text-dim`, `text-accent-forte`, `bg-campo`, `bg-accent text-acao-texto`); dígitos e datas com `font-mono-instr tabular-nums`; light e dark saem dos mesmos tokens.
- Valores em dinheiro: gravar `custo_centavos` (bigint); entrada aceita vírgula pt-BR via `parseDecimalPtBr`; exibir com `formatarReais`.
- Datas: ISO `yyyy-mm-dd`; "hoje" = `hojeISO()` (America/Sao_Paulo).
- Upload: máx. 10 MB; tipos `application/pdf`, `image/jpeg`, `image/png`, `image/webp`; path `{embarcacao_id}/documentos/...` ou `{embarcacao_id}/eventos/...` no bucket privado `acervo`; acesso de leitura por signed URL (3600 s).
- Escritas: capturar `error` de todo insert/update/delete; falha → redirect com `?erro=` legível (padrão da Fase 1). `redirect()` nunca dentro de try/catch.
- Convenção `cache()`: nunca chamar `carregarPainel()` depois de uma escrita na mesma action.

---

## Estrutura de arquivos

```
web/
├─ lib/domain/diario.ts (+ .test.ts)     filtros, grupos, agrupamento por mês, zerarCiclo, validarNovoItem
├─ lib/domain/gastos.ts (+ .test.ts)     resumoGastos, formatarReais
├─ lib/acoes/eventos.ts                  criarEvento (com anexo e zerar ciclo)
├─ lib/acoes/documentos.ts               criarDocumento, anexarArquivo, excluirDocumento
├─ lib/acoes/contatos.ts                 criarContato, avaliarContato, excluirContato
├─ lib/acoes/itens.ts                    criarItemMonitorado
├─ lib/acervo.ts                         validarArquivo + upload helper (servidor)
├─ app/(app)/diario/page.tsx             timeline com filtros (substitui stub)
├─ app/(app)/diario/novo/page.tsx        formulário de evento
├─ app/(app)/barco/documentos/page.tsx   documentos
├─ app/(app)/barco/contatos/page.tsx     contatos
├─ app/(app)/barco/gastos/page.tsx       gastos
├─ app/(app)/barco/itens/novo/page.tsx   novo item monitorado
├─ app/(app)/barco/page.tsx              + seção Casco + cards de navegação
├─ app/(app)/barco/equipamento/[id]/page.tsx  + histórico do equipamento + "Registrar serviço"
├─ lib/db/types.ts                       completar colunas + Contato + Documento
└─ lib/consultas.ts                      sem mudança (cache mantido)
```

---

### Task 1: Migration 003 + bucket + types completos

**Files:**
- Migration `003_fase2` aplicada via MCP Supabase (conector `mcp__6dcbebfb-...`, projeto `khgjtxvmduizyooqaoox`)
- Modify: `web/lib/db/types.ts` (substituir), `web/lib/acoes/onboarding.ts` (categoria nos seeds), `web/next.config.ts`

**Interfaces:**
- Produces: tabelas `contatos` e `documentos`; colunas novas `itens_monitorados.categoria`, `eventos.contato_id`, `eventos.categoria`, `eventos.anexo_path`; tipo de evento `outro`; bucket `acervo`. Tipos TS: `Contato { id, embarcacao_id, nome, especialidade, telefone, avaliacao, created_at }`, `Documento { id, embarcacao_id, nome, arquivo_path, validade, item_monitorado_id, created_at }`, e demais interfaces com TODAS as colunas das tabelas.

- [ ] **Step 1: Aplicar a migration `003_fase2`** via MCP `apply_migration`, SQL exato:

```sql
create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  nome text not null,
  especialidade text,
  telefone text,
  avaliacao int check (avaliacao between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  nome text not null,
  arquivo_path text,
  validade date,
  item_monitorado_id uuid references public.itens_monitorados(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.itens_monitorados add column categoria text
  check (categoria in ('documento','deck','fibra','inox','vidros','estofados','casco_outros'));
alter table public.eventos add column contato_id uuid references public.contatos(id) on delete set null;
alter table public.eventos add column categoria text
  check (categoria in ('documento','deck','fibra','inox','vidros','estofados','casco_outros'));
alter table public.eventos add column anexo_path text;
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('manutencao','abastecimento','navegacao','avaria','docagem','leitura_horas','outro'));

-- seeds antigos de documento ganham a categoria
update public.itens_monitorados set categoria = 'documento'
  where equipamento_id is null and categoria is null;

alter table public.contatos enable row level security;
alter table public.documentos enable row level security;
create policy "contatos: tudo com vinculo" on public.contatos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));
create policy "documentos: tudo com vinculo" on public.documentos for all
  using (public.pode_ver_embarcacao(embarcacao_id))
  with check (public.pode_ver_embarcacao(embarcacao_id));

insert into storage.buckets (id, name, public) values ('acervo', 'acervo', false);
create policy "acervo: ler com vinculo" on storage.objects for select to authenticated
  using (bucket_id = 'acervo' and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid));
create policy "acervo: gravar com vinculo" on storage.objects for insert to authenticated
  with check (bucket_id = 'acervo' and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid));
create policy "acervo: apagar com vinculo" on storage.objects for delete to authenticated
  using (bucket_id = 'acervo' and public.pode_ver_embarcacao(((storage.foldername(name))[1])::uuid));
```

- [ ] **Step 2: Conferir advisors** (`get_advisors` security). Expected: nenhuma tabela sem RLS.

- [ ] **Step 3: `types.ts` completo** — substituir `web/lib/db/types.ts` por:

```ts
export interface Embarcacao {
  id: string
  nome: string
  estaleiro: string | null
  modelo: string | null
  ano: number | null
  comprimento_m: number | null
  boca_m: number | null
  calado_m: number | null
  casco_material: string | null
  casco_numero: string | null
  tie: string | null
  capitania: string | null
  propulsao: string | null
  marina: string | null
  created_at: string
}

export interface Equipamento {
  id: string
  embarcacao_id: string
  tipo: "motor" | "gerador" | "bateria" | "outro"
  posicao: "BB" | "BE" | "central" | null
  marca: string | null
  modelo: string | null
  numero_serie: string | null
  ano: number | null
  potencia_hp: number | null
  combustivel: string | null
  horas_atuais: number | null
  ultima_leitura: string | null
  created_at: string
}

export type CategoriaItem =
  | "documento" | "deck" | "fibra" | "inox" | "vidros" | "estofados" | "casco_outros"

export interface ItemMonitorado {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  nome: string
  categoria: CategoriaItem | null
  intervalo_horas: number | null
  intervalo_meses: number | null
  data_fixa: string | null
  ultimo_ciclo_data: string | null
  ultimo_ciclo_horas: number | null
  created_at: string
}

export type TipoEvento =
  | "manutencao" | "abastecimento" | "navegacao" | "avaria" | "docagem" | "leitura_horas" | "outro"

export interface Evento {
  id: string
  embarcacao_id: string
  equipamento_id: string | null
  item_monitorado_id: string | null
  contato_id: string | null
  tipo: TipoEvento
  categoria: CategoriaItem | null
  data: string
  horas_no_momento: number | null
  descricao: string | null
  custo_centavos: number | null
  anexo_path: string | null
  criado_por: string | null
  created_at: string
}

export interface Contato {
  id: string
  embarcacao_id: string
  nome: string
  especialidade: string | null
  telefone: string | null
  avaliacao: number | null
  created_at: string
}

export interface Documento {
  id: string
  embarcacao_id: string
  nome: string
  arquivo_path: string | null
  validade: string | null
  item_monitorado_id: string | null
  created_at: string
}
```

Nota: `Embarcacao` agora tem mais campos que o `select` atual de `carregarPainel` (`id, nome, estaleiro, modelo, ano, marina`) — trocar esse select por `select("*")` em `web/lib/consultas.ts` para o tipo ser honesto.

- [ ] **Step 4: seeds do onboarding com categoria** — em `web/lib/acoes/onboarding.ts`, no insert dos documentos (Seguro/TIE), adicionar `categoria: "documento"` ao objeto inserido (map dos `documentos`).

- [ ] **Step 5: limite de upload** — em `web/next.config.ts`, dentro do objeto de config, adicionar:

```ts
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
```

(Se o build acusar chave movida/renomeada no Next 16, seguir a mensagem do build e usar a chave indicada, mantendo os 12mb.)

- [ ] **Step 6: `npm test` (28/28), `npm run build` verde. Commit:**

```powershell
git add web; git commit -m "feat: migration fase 2 - contatos, documentos, bucket acervo e tipos completos"
```

---

### Task 2: Domínio — diário, gastos, ciclo e item novo (TDD)

**Files:**
- Create: `web/lib/domain/diario.ts`, `web/lib/domain/diario.test.ts`, `web/lib/domain/gastos.ts`, `web/lib/domain/gastos.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces (exato):
  - `type FiltroDiario = "tudo" | "motores" | "eletrica" | "casco" | "docs" | "gastos"`
  - `const CATEGORIAS_CASCO = ["deck","fibra","inox","vidros","estofados","casco_outros"] as const`
  - `const ROTULO_CASCO: Record<string,string>` (deck→"Deck", fibra→"Fibra", inox→"Inox", vidros→"Vidros", estofados→"Estofados", casco_outros→"Outros")
  - `interface EventoParaFiltro { tipo: string; categoria: string | null; custoCentavos: number | null; tipoEquipamento: string | null }`
  - `eventoNoFiltro(e: EventoParaFiltro, filtro: FiltroDiario): boolean`
  - `grupoDoEvento(e: EventoParaFiltro): "Motores" | "Elétrica" | "Casco" | "Documentos" | "Geral"`
  - `agruparPorMes<T extends { data: string }>(eventos: T[]): { rotulo: string; eventos: T[] }[]` (entrada já ordenada desc; rótulo "agosto de 2026" capitalizado)
  - `zerarCiclo(item: { intervalo_horas: number | null }, dados: { data: string; horas: number | null }): { ultimo_ciclo_data: string; ultimo_ciclo_horas?: number }`
  - `validarNovoItem(i: { intervaloHoras: number | null; intervaloMeses: number | null; dataFixa: string | null }): { ok: true } | { ok: false; erro: string }`
  - Em `gastos.ts`: `interface GastoEntrada { data: string; custoCentavos: number; grupo: string }`, `interface ResumoGastos { totalMesCentavos: number; porGrupo: { grupo: string; totalCentavos: number }[]; meses: { mes: string; rotulo: string; totalCentavos: number }[] }`, `resumoGastos(entradas: GastoEntrada[], hoje: string): ResumoGastos` (6 meses terminando no mês de `hoje`, ordem cronológica; `porGrupo` só do mês atual, desc por total), `formatarReais(centavos: number): string`.

- [ ] **Step 1: testes que falham** — criar `web/lib/domain/diario.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { agruparPorMes, eventoNoFiltro, grupoDoEvento, validarNovoItem, zerarCiclo } from "./diario"

const ev = (p: Partial<Parameters<typeof eventoNoFiltro>[0]>) => ({
  tipo: "manutencao", categoria: null, custoCentavos: null, tipoEquipamento: null, ...p,
})

describe("eventoNoFiltro", () => {
  it("motores pega eventos de equipamento motor", () => {
    expect(eventoNoFiltro(ev({ tipoEquipamento: "motor" }), "motores")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "gerador" }), "motores")).toBe(false)
  })
  it("eletrica pega gerador e bateria", () => {
    expect(eventoNoFiltro(ev({ tipoEquipamento: "gerador" }), "eletrica")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "bateria" }), "eletrica")).toBe(true)
    expect(eventoNoFiltro(ev({ tipoEquipamento: "motor" }), "eletrica")).toBe(false)
  })
  it("casco pega categorias de casco e docagem", () => {
    expect(eventoNoFiltro(ev({ categoria: "fibra" }), "casco")).toBe(true)
    expect(eventoNoFiltro(ev({ tipo: "docagem" }), "casco")).toBe(true)
    expect(eventoNoFiltro(ev({ categoria: "documento" }), "casco")).toBe(false)
  })
  it("docs pega categoria documento; gastos pega custo positivo", () => {
    expect(eventoNoFiltro(ev({ categoria: "documento" }), "docs")).toBe(true)
    expect(eventoNoFiltro(ev({ custoCentavos: 185000 }), "gastos")).toBe(true)
    expect(eventoNoFiltro(ev({ custoCentavos: null }), "gastos")).toBe(false)
  })
  it("tudo aceita qualquer evento", () => {
    expect(eventoNoFiltro(ev({}), "tudo")).toBe(true)
  })
})

describe("grupoDoEvento", () => {
  it("classifica por equipamento, categoria e fallback", () => {
    expect(grupoDoEvento(ev({ tipoEquipamento: "motor" }))).toBe("Motores")
    expect(grupoDoEvento(ev({ tipoEquipamento: "bateria" }))).toBe("Elétrica")
    expect(grupoDoEvento(ev({ categoria: "inox" }))).toBe("Casco")
    expect(grupoDoEvento(ev({ tipo: "docagem" }))).toBe("Casco")
    expect(grupoDoEvento(ev({ categoria: "documento" }))).toBe("Documentos")
    expect(grupoDoEvento(ev({}))).toBe("Geral")
  })
})

describe("agruparPorMes", () => {
  it("agrupa preservando a ordem e rotula em pt-BR", () => {
    const grupos = agruparPorMes([
      { data: "2026-08-02" }, { data: "2026-08-01" }, { data: "2026-07-19" },
    ])
    expect(grupos).toHaveLength(2)
    expect(grupos[0].rotulo).toBe("Agosto de 2026")
    expect(grupos[0].eventos).toHaveLength(2)
    expect(grupos[1].rotulo).toBe("Julho de 2026")
  })
})

describe("zerarCiclo", () => {
  it("sempre zera a data; horas só quando o item monitora horas e há leitura", () => {
    expect(zerarCiclo({ intervalo_horas: 250 }, { data: "2026-08-06", horas: 1510 }))
      .toEqual({ ultimo_ciclo_data: "2026-08-06", ultimo_ciclo_horas: 1510 })
    expect(zerarCiclo({ intervalo_horas: null }, { data: "2026-08-06", horas: 1510 }))
      .toEqual({ ultimo_ciclo_data: "2026-08-06" })
    expect(zerarCiclo({ intervalo_horas: 250 }, { data: "2026-08-06", horas: null }))
      .toEqual({ ultimo_ciclo_data: "2026-08-06" })
  })
})

describe("validarNovoItem", () => {
  it("exige pelo menos uma regra de vencimento", () => {
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: null, dataFixa: null }).ok).toBe(false)
    expect(validarNovoItem({ intervaloHoras: 250, intervaloMeses: null, dataFixa: null }).ok).toBe(true)
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: 18, dataFixa: null }).ok).toBe(true)
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: null, dataFixa: "2027-01-10" }).ok).toBe(true)
  })
  it("recusa intervalos não positivos", () => {
    expect(validarNovoItem({ intervaloHoras: 0, intervaloMeses: null, dataFixa: null }).ok).toBe(false)
    expect(validarNovoItem({ intervaloHoras: null, intervaloMeses: -2, dataFixa: null }).ok).toBe(false)
  })
})
```

E `web/lib/domain/gastos.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { formatarReais, resumoGastos } from "./gastos"

describe("resumoGastos", () => {
  const entradas = [
    { data: "2026-08-02", custoCentavos: 185000, grupo: "Motores" },
    { data: "2026-08-01", custoCentavos: 78000, grupo: "Elétrica" },
    { data: "2026-07-19", custoCentavos: 235000, grupo: "Motores" },
    { data: "2026-02-10", custoCentavos: 99900, grupo: "Casco" }, // fora da janela de 6 meses
  ]
  const r = resumoGastos(entradas, "2026-08-06")

  it("total do mês atual", () => {
    expect(r.totalMesCentavos).toBe(263000)
  })
  it("quebra por grupo do mês atual, maior primeiro", () => {
    expect(r.porGrupo).toEqual([
      { grupo: "Motores", totalCentavos: 185000 },
      { grupo: "Elétrica", totalCentavos: 78000 },
    ])
  })
  it("janela de 6 meses em ordem cronológica, com zeros", () => {
    expect(r.meses).toHaveLength(6)
    expect(r.meses[0].mes).toBe("2026-03")
    expect(r.meses[5]).toMatchObject({ mes: "2026-08", totalCentavos: 263000 })
    expect(r.meses[4]).toMatchObject({ mes: "2026-07", totalCentavos: 235000 })
    expect(r.meses[1].totalCentavos).toBe(0)
  })
  it("rotulo curto pt-BR", () => {
    expect(r.meses[5].rotulo).toBe("ago")
  })
})

describe("formatarReais", () => {
  it("formata centavos como BRL", () => {
    expect(formatarReais(185000).replace(/ /g, " ")).toBe("R$ 1.850,00")
  })
})
```

- [ ] **Step 2: rodar e ver falhar** — `npm test`. Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: implementar** — `web/lib/domain/diario.ts`:

```ts
export type FiltroDiario = "tudo" | "motores" | "eletrica" | "casco" | "docs" | "gastos"

export const CATEGORIAS_CASCO = ["deck", "fibra", "inox", "vidros", "estofados", "casco_outros"] as const

export const ROTULO_CASCO: Record<string, string> = {
  deck: "Deck", fibra: "Fibra", inox: "Inox",
  vidros: "Vidros", estofados: "Estofados", casco_outros: "Outros",
}

export interface EventoParaFiltro {
  tipo: string
  categoria: string | null
  custoCentavos: number | null
  tipoEquipamento: string | null
}

const ehCasco = (e: EventoParaFiltro) =>
  e.tipo === "docagem" || (e.categoria != null && (CATEGORIAS_CASCO as readonly string[]).includes(e.categoria))

export function eventoNoFiltro(e: EventoParaFiltro, filtro: FiltroDiario): boolean {
  switch (filtro) {
    case "tudo": return true
    case "motores": return e.tipoEquipamento === "motor"
    case "eletrica": return e.tipoEquipamento === "gerador" || e.tipoEquipamento === "bateria"
    case "casco": return ehCasco(e)
    case "docs": return e.categoria === "documento"
    case "gastos": return e.custoCentavos != null && e.custoCentavos > 0
  }
}

export function grupoDoEvento(e: EventoParaFiltro): "Motores" | "Elétrica" | "Casco" | "Documentos" | "Geral" {
  if (e.tipoEquipamento === "motor") return "Motores"
  if (e.tipoEquipamento === "gerador" || e.tipoEquipamento === "bateria") return "Elétrica"
  if (ehCasco(e)) return "Casco"
  if (e.categoria === "documento") return "Documentos"
  return "Geral"
}

export function agruparPorMes<T extends { data: string }>(eventos: T[]): { rotulo: string; eventos: T[] }[] {
  const grupos: { chave: string; rotulo: string; eventos: T[] }[] = []
  for (const e of eventos) {
    const chave = e.data.slice(0, 7)
    const atual = grupos[grupos.length - 1]
    if (atual && atual.chave === chave) {
      atual.eventos.push(e)
    } else {
      const [y, m] = chave.split("-").map(Number)
      const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, 1)))
      grupos.push({ chave, rotulo: nome.charAt(0).toUpperCase() + nome.slice(1), eventos: [e] })
    }
  }
  return grupos.map(({ rotulo, eventos: evs }) => ({ rotulo, eventos: evs }))
}

export function zerarCiclo(
  item: { intervalo_horas: number | null },
  dados: { data: string; horas: number | null },
): { ultimo_ciclo_data: string; ultimo_ciclo_horas?: number } {
  if (item.intervalo_horas != null && dados.horas != null) {
    return { ultimo_ciclo_data: dados.data, ultimo_ciclo_horas: dados.horas }
  }
  return { ultimo_ciclo_data: dados.data }
}

export function validarNovoItem(i: {
  intervaloHoras: number | null
  intervaloMeses: number | null
  dataFixa: string | null
}): { ok: true } | { ok: false; erro: string } {
  if (i.intervaloHoras != null && i.intervaloHoras <= 0) {
    return { ok: false, erro: "O intervalo em horas precisa ser maior que zero." }
  }
  if (i.intervaloMeses != null && i.intervaloMeses <= 0) {
    return { ok: false, erro: "O intervalo em meses precisa ser maior que zero." }
  }
  if (i.intervaloHoras == null && i.intervaloMeses == null && i.dataFixa == null) {
    return { ok: false, erro: "Defina ao menos uma regra: horas, meses ou data de vencimento." }
  }
  return { ok: true }
}
```

`web/lib/domain/gastos.ts`:

```ts
export interface GastoEntrada { data: string; custoCentavos: number; grupo: string }

export interface ResumoGastos {
  totalMesCentavos: number
  porGrupo: { grupo: string; totalCentavos: number }[]
  meses: { mes: string; rotulo: string; totalCentavos: number }[]
}

export function resumoGastos(entradas: GastoEntrada[], hoje: string): ResumoGastos {
  const [anoAtual, mesAtual] = hoje.split("-").map(Number)
  const total = anoAtual * 12 + (mesAtual - 1)

  const meses = Array.from({ length: 6 }, (_, i) => {
    const t = total - (5 - i)
    const y = Math.floor(t / 12)
    const m = (t % 12) + 1
    const chave = `${y}-${String(m).padStart(2, "0")}`
    const rotulo = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(y, m - 1, 1)))
      .replace(".", "")
    return { mes: chave, rotulo, totalCentavos: 0 }
  })

  const porGrupo = new Map<string, number>()
  const chaveAtual = `${anoAtual}-${String(mesAtual).padStart(2, "0")}`
  for (const e of entradas) {
    const chave = e.data.slice(0, 7)
    const slot = meses.find((m) => m.mes === chave)
    if (slot) slot.totalCentavos += e.custoCentavos
    if (chave === chaveAtual) porGrupo.set(e.grupo, (porGrupo.get(e.grupo) ?? 0) + e.custoCentavos)
  }

  return {
    totalMesCentavos: meses[5].totalCentavos,
    porGrupo: [...porGrupo.entries()]
      .map(([grupo, totalCentavos]) => ({ grupo, totalCentavos }))
      .sort((a, b) => b.totalCentavos - a.totalCentavos),
    meses,
  }
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
```

- [ ] **Step 4: `npm test`** — Expected: PASS (28 + 13 novos = 41).

- [ ] **Step 5: Commit** — `git add web; git commit -m "feat: dominio do diario, gastos, zerar ciclo e item novo (TDD)"`

---

### Task 3: Upload helper + action criarEvento + página /diario/novo

**Files:**
- Create: `web/lib/acervo.ts`, `web/lib/acoes/eventos.ts`, `web/app/(app)/diario/novo/page.tsx`

**Interfaces:**
- Consumes: `zerarCiclo`, `validarNovoItem` não; `parseDecimalPtBr`, `hojeISO`, `carregarPainel`, tipos Task 1.
- Produces:
  - `validarArquivo(file: File): { ok: true } | { ok: false; erro: string }` e `subirArquivo(supabase, embarcacaoId: string, pasta: "documentos" | "eventos", file: File): Promise<{ path: string } | { erro: string }>` em `lib/acervo.ts`.
  - action `criarEvento(formData: FormData)` — campos: `tipo`, `data`, `descricao`, `custo` (reais, vírgula ok), `alvo` (`""` | `eq:<id>` | `cat:<categoria>`), `contato_id`, `item_id` (opcional — zera ciclo), `horas` (opcional), `anexo` (File opcional). Sucesso → `/diario`. Erro de validação → `/diario/novo?erro=...`.

- [ ] **Step 1: `web/lib/acervo.ts`:**

```ts
import type { SupabaseClient } from "@supabase/supabase-js"

const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 10 * 1024 * 1024

export function validarArquivo(file: File): { ok: true } | { ok: false; erro: string } {
  if (file.size === 0) return { ok: false, erro: "O arquivo está vazio." }
  if (file.size > MAX_BYTES) return { ok: false, erro: "Arquivo acima de 10 MB." }
  if (!TIPOS.includes(file.type)) return { ok: false, erro: "Use PDF, JPG, PNG ou WebP." }
  return { ok: true }
}

export async function subirArquivo(
  supabase: SupabaseClient,
  embarcacaoId: string,
  pasta: "documentos" | "eventos",
  file: File,
): Promise<{ path: string } | { erro: string }> {
  const v = validarArquivo(file)
  if (!v.ok) return { erro: v.erro }
  const limpo = file.name.normalize("NFD").replace(/[^\w.-]/g, "_").slice(-80)
  const path = `${embarcacaoId}/${pasta}/${crypto.randomUUID()}-${limpo}`
  const { error } = await supabase.storage.from("acervo").upload(path, file)
  if (error) return { erro: "Falha ao enviar o arquivo. Tente de novo." }
  return { path }
}
```

- [ ] **Step 2: `web/lib/acoes/eventos.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { zerarCiclo } from "@/lib/domain/diario"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

const erroNovo = (msg: string) => redirect(`/diario/novo?erro=${encodeURIComponent(msg)}`)

export async function criarEvento(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim()
    return v === "" ? null : v
  }
  const tipo = texto("tipo") ?? "manutencao"
  const data = texto("data") ?? hojeISO()
  const alvo = texto("alvo")
  const equipamentoId = alvo?.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo?.startsWith("cat:") ? alvo.slice(4) : null

  const custoBruto = texto("custo")
  let custoCentavos: number | null = null
  if (custoBruto != null) {
    const reais = parseDecimalPtBr(custoBruto)
    if (reais === null || reais < 0) erroNovo("Informe um custo válido (ex.: 1.850,00).")
    custoCentavos = Math.round(reais! * 100)
  }

  const horasBruto = texto("horas")
  const horas = horasBruto != null ? parseDecimalPtBr(horasBruto) : null
  if (horasBruto != null && horas === null) erroNovo("Informe horas válidas.")

  let anexoPath: string | null = null
  const anexo = formData.get("anexo")
  if (anexo instanceof File && anexo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "eventos", anexo)
    if ("erro" in r) erroNovo(r.erro)
    else anexoPath = r.path
  }

  const itemId = texto("item_id")
  const { error } = await supabase.from("eventos").insert({
    embarcacao_id: painel.embarcacao.id,
    equipamento_id: equipamentoId,
    item_monitorado_id: itemId,
    contato_id: texto("contato_id"),
    tipo,
    categoria,
    data,
    horas_no_momento: horas,
    descricao: texto("descricao"),
    custo_centavos: custoCentavos,
    anexo_path: anexoPath,
    criado_por: user.id,
  })
  if (error) erroNovo("Não foi possível salvar o evento. Tente de novo.")

  if (itemId) {
    const item = painel.itens.find((i) => i.id === itemId)
    if (item) {
      const eq = painel.equipamentos.find((e) => e.id === item.equipamento_id)
      const atualizacao = zerarCiclo(item, { data, horas: horas ?? eq?.horas_atuais ?? null })
      const { error: erroItem } = await supabase
        .from("itens_monitorados").update(atualizacao).eq("id", itemId)
      if (erroItem) {
        revalidatePath("/diario")
        redirect(`/diario?erro=${encodeURIComponent("Evento salvo, mas o ciclo do item não foi zerado. Confira o item.")}`)
      }
    }
  }

  revalidatePath("/diario")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect("/diario")
}
```

- [ ] **Step 3: `web/app/(app)/diario/novo/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import { criarEvento } from "@/lib/acoes/eventos"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"
import { supabaseServer } from "@/lib/supabase/server"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

const TIPOS = [
  ["manutencao", "Manutenção"], ["abastecimento", "Abastecimento"], ["navegacao", "Navegação"],
  ["avaria", "Avaria"], ["docagem", "Docagem"], ["outro", "Outro"],
] as const

export default async function NovoEventoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; alvo?: string; item?: string; custo?: string }>
}) {
  const { erro, alvo, item, custo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const { data: contatos } = await supabase
    .from("contatos").select("id, nome, especialidade").order("nome")

  const nomeAlvo = (id: string | null) => {
    const eq = painel.equipamentos.find((e) => e.id === id)
    return eq ? `${eq.tipo === "motor" ? "Motor" : eq.tipo === "gerador" ? "Gerador" : "Equip."} ${eq.posicao ?? ""}`.trim() : ""
  }

  return (
    <main>
      <a href="/diario" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Diário</a>
      <h1 className="mt-3 text-xl font-semibold">Novo evento</h1>
      {erro && <p className="mt-4 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarEvento} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue="manutencao" className={campo}>
              {TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo} htmlFor="data">Data</label>
            <input id="data" name="data" type="date" defaultValue={hojeISO()} className={campo} />
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="alvo">Sistema</label>
          <select id="alvo" name="alvo" defaultValue={alvo ?? ""} className={campo}>
            <option value="">Embarcação (geral)</option>
            {painel.equipamentos.map((e) => (
              <option key={e.id} value={`eq:${e.id}`}>{nomeAlvo(e.id)}</option>
            ))}
            {CATEGORIAS_CASCO.map((c) => (
              <option key={c} value={`cat:${c}`}>Casco — {ROTULO_CASCO[c]}</option>
            ))}
            <option value="cat:documento">Documentos</option>
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="item_id">Este serviço zera o ciclo de… (opcional)</label>
          <select id="item_id" name="item_id" defaultValue={item ?? ""} className={campo}>
            <option value="">Nenhum item</option>
            {painel.itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}{i.equipamento_id ? ` — ${nomeAlvo(i.equipamento_id)}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="descricao">Descrição</label>
          <input id="descricao" name="descricao" placeholder="Ex.: troca de óleo e filtros" className={campo} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="custo">Custo (R$) — opcional</label>
            <input id="custo" name="custo" inputMode="decimal" defaultValue={custo ?? undefined} placeholder="1.850,00" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="horas">Horas no momento — opcional</label>
            <input id="horas" name="horas" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>

        <div>
          <label className={rotulo} htmlFor="contato_id">Prestador (opcional)</label>
          <select id="contato_id" name="contato_id" defaultValue="" className={campo}>
            <option value="">Nenhum</option>
            {(contatos ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}{c.especialidade ? ` — ${c.especialidade}` : ""}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={rotulo} htmlFor="anexo">Anexo (NF, relatório, foto) — opcional, até 10 MB</label>
          <input id="anexo" name="anexo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${campo} py-2.5 text-sm`} />
        </div>

        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">
          Salvar no diário
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: `npm test` (41/41), `npm run build` verde (rota `/diario/novo`). Commit:**

`git add web; git commit -m "feat: novo evento com anexo e zerar ciclo do item"`

---

### Task 4: Página /diario — timeline com filtros

**Files:**
- Modify: `web/app/(app)/diario/page.tsx` (substituir o stub inteiro)

**Interfaces:**
- Consumes: `eventoNoFiltro`, `agruparPorMes`, `FiltroDiario`, `formatarReais`, `carregarPainel`, tipos `Evento`/`Contato`.

- [ ] **Step 1: substituir `web/app/(app)/diario/page.tsx`:**

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { agruparPorMes, eventoNoFiltro, type FiltroDiario } from "@/lib/domain/diario"
import { formatarReais } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato, Evento } from "@/lib/db/types"

const FILTROS: { valor: FiltroDiario; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" }, { valor: "motores", rotulo: "Motores" },
  { valor: "eletrica", rotulo: "Elétrica" }, { valor: "casco", rotulo: "Casco" },
  { valor: "docs", rotulo: "Docs" }, { valor: "gastos", rotulo: "Gastos" },
]

const TIPO_ROTULO: Record<string, string> = {
  manutencao: "Manutenção", abastecimento: "Abastecimento", navegacao: "Navegação",
  avaria: "Avaria", docagem: "Docagem", leitura_horas: "Leitura de horas", outro: "Outro",
}

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; erro?: string }>
}) {
  const { filtro: bruto, erro } = await searchParams
  const filtro = (FILTROS.some((f) => f.valor === bruto) ? bruto : "tudo") as FiltroDiario

  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const [{ data: eventos, error: erroEventos }, { data: contatos }] = await Promise.all([
    supabase.from("eventos").select("*").eq("embarcacao_id", painel.embarcacao.id)
      .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("contatos").select("id, nome"),
  ])
  if (erroEventos) throw new Error("Não foi possível carregar o diário. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))
  const nomeContato = new Map((contatos ?? []).map((c: Pick<Contato, "id" | "nome">) => [c.id, c.nome]))

  const visiveis = ((eventos ?? []) as Evento[]).filter((e) =>
    eventoNoFiltro(
      {
        tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
        tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
      },
      filtro,
    ),
  )
  const grupos = agruparPorMes(visiveis)

  return (
    <main>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Diário de Bordo</h1>
        <Link href="/diario/novo" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">+ Evento</Link>
      </div>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={f.valor === "tudo" ? "/diario" : `/diario?filtro=${f.valor}`}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono-instr text-[11.5px] tracking-wide ${
              filtro === f.valor ? "border-accent bg-accent font-semibold text-acao-texto" : "border-line bg-panel text-dim"
            }`}
          >
            {f.rotulo}
          </Link>
        ))}
      </div>

      {grupos.length === 0 && (
        <div className="mt-6 rounded-[14px] border border-line bg-panel p-5 text-center text-sm text-dim">
          Nenhum evento por aqui ainda. Toque em “+ Evento” para registrar o primeiro —
          cada serviço registrado vira histórico e dossiê do barco.
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.rotulo}>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">{g.rotulo}</p>
          <div className="rounded-[14px] border border-line bg-panel px-4">
            {g.eventos.map((e) => {
              const eq = e.equipamento_id ? porId.get(e.equipamento_id) : null
              const meta = [
                e.horas_no_momento != null ? `${e.horas_no_momento.toLocaleString("pt-BR")} h` : null,
                e.contato_id ? nomeContato.get(e.contato_id) : null,
                e.custo_centavos != null ? formatarReais(e.custo_centavos) : null,
                e.anexo_path ? "anexo" : null,
              ].filter(Boolean).join(" · ")
              return (
                <div key={e.id} className="flex gap-3 border-b border-line py-3 last:border-0">
                  <div className="w-11 shrink-0 text-center font-mono-instr text-[11px] leading-tight text-dim">
                    <span className="block text-base text-texto">{e.data.slice(8, 10)}</span>
                    {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
                      .format(new Date(`${e.data}T00:00:00Z`)).replace(".", "")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {TIPO_ROTULO[e.tipo] ?? e.tipo}
                      {eq ? ` — ${eq.tipo === "motor" ? "Motor" : "Gerador"} ${eq.posicao ?? ""}` : ""}
                    </p>
                    {e.descricao && <p className="mt-0.5 text-xs text-dim">{e.descricao}</p>}
                    {meta && <p className="mt-1 font-mono-instr text-[11px] tabular-nums text-dim">{meta}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
```

- [ ] **Step 2: `npm run build` verde; `npm test` 41/41. Commit:** `git add web; git commit -m "feat: diario de bordo com filtros por sistema"`

---

### Task 5: Documentos — página + actions

**Files:**
- Create: `web/lib/acoes/documentos.ts`, `web/app/(app)/barco/documentos/page.tsx`

**Interfaces:**
- Consumes: `subirArquivo`, `calcularSemaforo`, `itemMonitoradoToItemCalc`, `Farol`, `carregarPainel`, `hojeISO`.
- Produces: actions `criarDocumento(formData)` (campos `nome`, `validade` opcional, `arquivo` opcional — cria item categoria documento quando há validade), `anexarArquivo(formData)` (campos `item_id`, `arquivo` — anexa a item existente sem documento), `excluirDocumento(formData)` (campo `documento_id` — remove arquivo do storage, a linha e o item vinculado).

- [ ] **Step 1: `web/lib/acoes/documentos.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { subirArquivo } from "@/lib/acervo"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

const volta = (msg?: string) =>
  redirect(msg ? `/barco/documentos?erro=${encodeURIComponent(msg)}` : "/barco/documentos")

async function contexto() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  return { supabase, painel: painel! }
}

export async function criarDocumento(formData: FormData) {
  const { supabase, painel } = await contexto()
  const nome = String(formData.get("nome") ?? "").trim()
  if (nome === "") volta("Dê um nome ao documento.")
  const validade = String(formData.get("validade") ?? "").trim() || null

  let itemId: string | null = null
  if (validade) {
    const { data: item, error } = await supabase
      .from("itens_monitorados")
      .insert({ embarcacao_id: painel.embarcacao.id, nome, categoria: "documento", data_fixa: validade })
      .select("id").single()
    if (error || !item) volta("Não foi possível criar o vencimento do documento.")
    itemId = item!.id
  }

  let arquivoPath: string | null = null
  const arquivo = formData.get("arquivo")
  if (arquivo instanceof File && arquivo.size > 0) {
    const r = await subirArquivo(supabase, painel.embarcacao.id, "documentos", arquivo)
    if ("erro" in r) volta(r.erro)
    else arquivoPath = r.path
  }

  const { error } = await supabase.from("documentos").insert({
    embarcacao_id: painel.embarcacao.id, nome, arquivo_path: arquivoPath,
    validade, item_monitorado_id: itemId,
  })
  if (error) volta("Não foi possível salvar o documento.")

  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}

export async function anexarArquivo(formData: FormData) {
  const { supabase, painel } = await contexto()
  const itemId = String(formData.get("item_id") ?? "")
  const item = painel.itens.find((i) => i.id === itemId)
  if (!item) volta("Item não encontrado.")

  const arquivo = formData.get("arquivo")
  if (!(arquivo instanceof File) || arquivo.size === 0) volta("Escolha um arquivo.")
  const r = await subirArquivo(supabase, painel.embarcacao.id, "documentos", arquivo as File)
  if ("erro" in r) volta(r.erro)

  const { error } = await supabase.from("documentos").insert({
    embarcacao_id: painel.embarcacao.id, nome: item!.nome,
    arquivo_path: (r as { path: string }).path, validade: item!.data_fixa, item_monitorado_id: itemId,
  })
  if (error) volta("Não foi possível vincular o arquivo.")
  revalidatePath("/barco/documentos")
  volta()
}

export async function excluirDocumento(formData: FormData) {
  const { supabase } = await contexto()
  const id = String(formData.get("documento_id") ?? "")
  const { data: doc } = await supabase.from("documentos")
    .select("id, arquivo_path, item_monitorado_id").eq("id", id).maybeSingle()
  if (!doc) volta("Documento não encontrado.")

  if (doc!.arquivo_path) await supabase.storage.from("acervo").remove([doc!.arquivo_path])
  const { error } = await supabase.from("documentos").delete().eq("id", id)
  if (error) volta("Não foi possível excluir.")
  if (doc!.item_monitorado_id) {
    await supabase.from("itens_monitorados").delete().eq("id", doc!.item_monitorado_id)
  }
  revalidatePath("/barco/documentos")
  revalidatePath("/barco")
  revalidatePath("/hoje")
  volta()
}
```

- [ ] **Step 2: `web/app/(app)/barco/documentos/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import { Farol } from "@/components/farol"
import { anexarArquivo, criarDocumento, excluirDocumento } from "@/lib/acoes/documentos"
import { carregarPainel, hojeISO, itemMonitoradoToItemCalc } from "@/lib/consultas"
import { calcularSemaforo } from "@/lib/domain/semaforo"
import { supabaseServer } from "@/lib/supabase/server"
import type { Documento } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const { data: docs } = await supabase.from("documentos")
    .select("*").eq("embarcacao_id", painel.embarcacao.id).order("created_at")

  const hoje = hojeISO()
  const itensDocumento = painel.itens.filter((i) => i.categoria === "documento")
  const docPorItem = new Map(((docs ?? []) as Documento[]).filter((d) => d.item_monitorado_id)
    .map((d) => [d.item_monitorado_id as string, d]))
  const avulsos = ((docs ?? []) as Documento[]).filter((d) => !d.item_monitorado_id)

  const linkAssinado = async (path: string) => {
    const { data } = await supabase.storage.from("acervo").createSignedUrl(path, 3600)
    return data?.signedUrl ?? null
  }

  return (
    <main>
      <a href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Embarcação</a>
      <h1 className="mt-3 text-xl font-semibold">Documentos</h1>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <p className="mt-5 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Com vencimento</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {itensDocumento.length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum documento com vencimento cadastrado.</p>
        )}
        {await Promise.all(itensDocumento.map(async (i) => {
          const r = calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje)
          const doc = docPorItem.get(i.id)
          const url = doc?.arquivo_path ? await linkAssinado(doc.arquivo_path) : null
          return (
            <div key={i.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <Farol status={r.status} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.nome}</p>
                <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
                  {i.data_fixa ? `vence ${i.data_fixa.split("-").reverse().join("/")}` : "sem data"}
                  {r.diasRestantes != null && r.diasRestantes >= 0 ? ` · ${r.diasRestantes} dias` : ""}
                  {r.diasRestantes != null && r.diasRestantes < 0 ? ` · vencido há ${-r.diasRestantes} dias` : ""}
                </p>
              </div>
              {url ? (
                <a href={url} target="_blank" className="text-sm text-accent-forte">Abrir</a>
              ) : (
                <form action={anexarArquivo} className="flex items-center gap-2">
                  <input type="hidden" name="item_id" value={i.id} />
                  <label className="cursor-pointer text-sm text-accent-forte">
                    Anexar
                    <input type="file" name="arquivo" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" />
                  </label>
                  <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-dim">Enviar</button>
                </form>
              )}
            </div>
          )
        }))}
      </div>

      {avulsos.length > 0 && (
        <>
          <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Arquivos sem vencimento</p>
          <div className="rounded-[14px] border border-line bg-panel px-4">
            {await Promise.all(avulsos.map(async (d) => {
              const url = d.arquivo_path ? await linkAssinado(d.arquivo_path) : null
              return (
                <div key={d.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <p className="min-w-0 flex-1 text-sm font-medium">{d.nome}</p>
                  {url && <a href={url} target="_blank" className="text-sm text-accent-forte">Abrir</a>}
                  <form action={excluirDocumento}>
                    <input type="hidden" name="documento_id" value={d.id} />
                    <button className="text-xs text-crit">Excluir</button>
                  </form>
                </div>
              )
            }))}
          </div>
        </>
      )}

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Novo documento</p>
      <form action={criarDocumento} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className={rotulo} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required list="tipos-doc" placeholder="Ex.: Seguro da embarcação" className={campo} />
          <datalist id="tipos-doc">
            <option value="Seguro da embarcação" /><option value="TIE" />
            <option value="Vistoria da Marinha" /><option value="Licença de navegação" />
            <option value="Certificado de segurança" /><option value="Documento de propriedade" />
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="validade">Vence em — opcional</label>
            <input id="validade" name="validade" type="date" className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="arquivo">Arquivo — opcional</label>
            <input id="arquivo" name="arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={`${campo} py-2.5 text-sm`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar documento</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: `npm run build` verde; testes 41/41. Commit:** `git add web; git commit -m "feat: documentos com upload, validade e semaforo"`

---

### Task 6: Contatos — página + actions

**Files:**
- Create: `web/lib/acoes/contatos.ts`, `web/app/(app)/barco/contatos/page.tsx`

**Interfaces:**
- Consumes: `carregarPainel`, tipos `Contato`.
- Produces: `criarContato(formData)` (`nome`, `especialidade`, `telefone`), `avaliarContato(formData)` (`contato_id`, `avaliacao` 1-5), `excluirContato(formData)` (`contato_id`).

- [ ] **Step 1: `web/lib/acoes/contatos.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

const volta = (msg?: string) =>
  redirect(msg ? `/barco/contatos?erro=${encodeURIComponent(msg)}` : "/barco/contatos")

export async function criarContato(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const nome = String(formData.get("nome") ?? "").trim()
  if (nome === "") volta("Informe o nome do contato.")
  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const { error } = await supabase.from("contatos").insert({
    embarcacao_id: painel!.embarcacao.id, nome,
    especialidade: texto("especialidade"), telefone: texto("telefone"),
  })
  if (error) volta("Não foi possível salvar o contato.")
  revalidatePath("/barco/contatos")
  volta()
}

export async function avaliarContato(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("contato_id") ?? "")
  const nota = Number(formData.get("avaliacao"))
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) volta("Nota de 1 a 5.")
  const { error } = await supabase.from("contatos").update({ avaliacao: nota }).eq("id", id)
  if (error) volta("Não foi possível avaliar.")
  revalidatePath("/barco/contatos")
  volta()
}

export async function excluirContato(formData: FormData) {
  const supabase = await supabaseServer()
  const id = String(formData.get("contato_id") ?? "")
  const { error } = await supabase.from("contatos").delete().eq("id", id)
  if (error) volta("Não foi possível excluir — confira se há eventos ligados a ele.")
  revalidatePath("/barco/contatos")
  volta()
}
```

- [ ] **Step 2: `web/app/(app)/barco/contatos/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import { avaliarContato, criarContato, excluirContato } from "@/lib/acoes/contatos"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"
import type { Contato } from "@/lib/db/types"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const supabase = await supabaseServer()
  const [{ data: contatos }, { data: eventos }] = await Promise.all([
    supabase.from("contatos").select("*").eq("embarcacao_id", painel.embarcacao.id).order("nome"),
    supabase.from("eventos").select("contato_id").eq("embarcacao_id", painel.embarcacao.id).not("contato_id", "is", null),
  ])
  const servicos = new Map<string, number>()
  for (const e of eventos ?? []) {
    if (e.contato_id) servicos.set(e.contato_id, (servicos.get(e.contato_id) ?? 0) + 1)
  }

  return (
    <main>
      <a href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Embarcação</a>
      <h1 className="mt-3 text-xl font-semibold">Contatos</h1>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <div className="mt-5 rounded-[14px] border border-line bg-panel px-4">
        {(contatos ?? []).length === 0 && (
          <p className="py-4 text-sm text-dim">Salve aqui o mecânico, o eletricista e todo mundo que cuida do barco.</p>
        )}
        {((contatos ?? []) as Contato[]).map((c) => (
          <div key={c.id} className="border-b border-line py-3 last:border-0">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.nome}</p>
                <p className="mt-0.5 text-xs text-dim">
                  {[c.especialidade, c.telefone, `${servicos.get(c.id) ?? 0} serviços neste barco`]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              {c.telefone && (
                <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank"
                  className="rounded-lg border border-ok/40 px-2.5 py-1.5 text-xs text-ok">WhatsApp</a>
              )}
              <form action={excluirContato}>
                <input type="hidden" name="contato_id" value={c.id} />
                <button className="text-xs text-crit">Excluir</button>
              </form>
            </div>
            <form action={avaliarContato} className="mt-2 flex items-center gap-1" aria-label={`Avaliar ${c.nome}`}>
              <input type="hidden" name="contato_id" value={c.id} />
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} name="avaliacao" value={n} aria-label={`${n} estrelas`}
                  className={`text-lg leading-none ${c.avaliacao != null && n <= c.avaliacao ? "text-warn" : "text-line"}`}>
                  ★
                </button>
              ))}
            </form>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Novo contato</p>
      <form action={criarContato} className="space-y-3 rounded-[14px] border border-line bg-panel p-4">
        <div>
          <label className={rotulo} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="especialidade">Especialidade</label>
            <input id="especialidade" name="especialidade" placeholder="Mecânica diesel" className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="telefone">Telefone (com DDD)</label>
            <input id="telefone" name="telefone" inputMode="tel" placeholder="21 99999-0000" className={campo} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-acao-texto">Salvar contato</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: build verde, 41/41. Commit:** `git add web; git commit -m "feat: contatos com avaliacao e atalho de whatsapp"`

---

### Task 7: Itens monitorados genéricos + seção Casco no hub

**Files:**
- Create: `web/lib/acoes/itens.ts`, `web/app/(app)/barco/itens/novo/page.tsx`
- Modify: `web/app/(app)/barco/page.tsx` (adicionar seção Casco antes de "Documentos e embarcação"; a lista de documentos do hub passa a filtrar `categoria === "documento"`)

**Interfaces:**
- Consumes: `validarNovoItem`, `parseDecimalPtBr`, `hojeISO`, `CATEGORIAS_CASCO`, `ROTULO_CASCO`, `calcularSemaforo`, `itemMonitoradoToItemCalc`, `PESO`, `Farol`.
- Produces: action `criarItemMonitorado(formData)` — campos `nome`, `alvo` (`emb` | `eq:<id>` | `cat:<categoria>`), `intervalo_horas`, `intervalo_meses`, `data_fixa`, `ultimo_ciclo_data` (default hoje), `ultimo_ciclo_horas`; sucesso → `/barco`.

- [ ] **Step 1: `web/lib/acoes/itens.ts`:**

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { validarNovoItem } from "@/lib/domain/diario"
import { parseDecimalPtBr } from "@/lib/domain/numeros"
import { supabaseServer } from "@/lib/supabase/server"

const erroNovo = (msg: string) => redirect(`/barco/itens/novo?erro=${encodeURIComponent(msg)}`)

export async function criarItemMonitorado(formData: FormData) {
  const supabase = await supabaseServer()
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  const texto = (k: string) => String(formData.get(k) ?? "").trim() || null
  const nome = texto("nome")
  if (!nome) erroNovo("Dê um nome ao item.")

  const alvo = texto("alvo") ?? "emb"
  const equipamentoId = alvo.startsWith("eq:") ? alvo.slice(3) : null
  const categoria = alvo.startsWith("cat:") ? alvo.slice(4) : null

  const numero = (k: string) => {
    const v = texto(k)
    return v === null ? null : parseDecimalPtBr(v)
  }
  const intervaloHoras = numero("intervalo_horas")
  const intervaloMeses = numero("intervalo_meses")
  const dataFixa = texto("data_fixa")

  const v = validarNovoItem({ intervaloHoras, intervaloMeses, dataFixa })
  if (!v.ok) erroNovo((v as { ok: false; erro: string }).erro)

  const { error } = await supabase.from("itens_monitorados").insert({
    embarcacao_id: painel!.embarcacao.id,
    equipamento_id: equipamentoId,
    categoria,
    nome,
    intervalo_horas: intervaloHoras,
    intervalo_meses: intervaloMeses,
    data_fixa: dataFixa,
    ultimo_ciclo_data: texto("ultimo_ciclo_data") ?? hojeISO(),
    ultimo_ciclo_horas: numero("ultimo_ciclo_horas"),
  })
  if (error) erroNovo("Não foi possível criar o item. Tente de novo.")

  revalidatePath("/barco")
  revalidatePath("/hoje")
  redirect("/barco")
}
```

- [ ] **Step 2: `web/app/(app)/barco/itens/novo/page.tsx`:**

```tsx
import { redirect } from "next/navigation"
import { criarItemMonitorado } from "@/lib/acoes/itens"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"

const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[10.5px] uppercase tracking-[.14em] text-dim"

export default async function NovoItemPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; alvo?: string }>
}) {
  const { erro, alvo } = await searchParams
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")

  return (
    <main>
      <a href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Embarcação</a>
      <h1 className="mt-3 text-xl font-semibold">Novo item monitorado</h1>
      <p className="mt-1 text-sm text-dim">
        Tudo que vence por horas de uso e/ou por data — o semáforo cuida do resto.
      </p>
      {erro && <p className="mt-3 rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 text-sm">{erro}</p>}

      <form action={criarItemMonitorado} className="mt-5 space-y-4">
        <div>
          <label className={rotulo} htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required placeholder="Ex.: Antifouling" className={campo} />
        </div>
        <div>
          <label className={rotulo} htmlFor="alvo">Pertence a</label>
          <select id="alvo" name="alvo" defaultValue={alvo ?? "emb"} className={campo}>
            <option value="emb">Embarcação (geral)</option>
            {painel.equipamentos.map((e) => (
              <option key={e.id} value={`eq:${e.id}`}>
                {(e.tipo === "motor" ? "Motor" : e.tipo === "gerador" ? "Gerador" : "Equipamento")} {e.posicao ?? ""}
              </option>
            ))}
            {CATEGORIAS_CASCO.map((c) => (
              <option key={c} value={`cat:${c}`}>Casco — {ROTULO_CASCO[c]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="intervalo_horas">A cada X horas</label>
            <input id="intervalo_horas" name="intervalo_horas" inputMode="decimal" placeholder="500" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
          <div>
            <label className={rotulo} htmlFor="intervalo_meses">E/ou a cada X meses</label>
            <input id="intervalo_meses" name="intervalo_meses" inputMode="numeric" placeholder="18" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="data_fixa">Ou vencimento em data fixa</label>
          <input id="data_fixa" name="data_fixa" type="date" className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="ultimo_ciclo_data">Último serviço em</label>
            <input id="ultimo_ciclo_data" name="ultimo_ciclo_data" type="date" defaultValue={hojeISO()} className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="ultimo_ciclo_horas">Horas no último serviço</label>
            <input id="ultimo_ciclo_horas" name="ultimo_ciclo_horas" inputMode="decimal" className={`${campo} font-mono-instr tabular-nums`} />
          </div>
        </div>
        <button className="w-full rounded-xl bg-accent py-3.5 font-semibold text-acao-texto">Criar item</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: seção Casco no hub** — em `web/app/(app)/barco/page.tsx`:
  (a) a constante `documentos` passa a ser `const documentos = itens.filter((i) => i.categoria === "documento")`;
  (b) inserir ANTES do bloco "Documentos e embarcação":

```tsx
      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Casco</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {CATEGORIAS_CASCO.map((c) => {
          const doGrupo = itens.filter((i) => i.categoria === c)
          const status = doGrupo
            .map((i) => calcularSemaforo(itemMonitoradoToItemCalc(i), null, hoje).status)
            .sort((a, b) => PESO[b] - PESO[a])[0]
          return (
            <div key={c} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              {status ? <Farol status={status} /> : <span className="size-2 rounded-full border border-line" />}
              <span className="flex-1 text-sm">{ROTULO_CASCO[c]}</span>
              {doGrupo.length === 0 ? (
                <Link href={`/barco/itens/novo?alvo=${encodeURIComponent(`cat:${c}`)}`} className="text-xs text-accent-forte">
                  Monitorar
                </Link>
              ) : (
                <span className="font-mono-instr text-xs tabular-nums text-dim">{doGrupo.length} itens</span>
              )}
            </div>
          )
        })}
      </div>
```

  (c) imports novos no topo: `import { CATEGORIAS_CASCO, ROTULO_CASCO } from "@/lib/domain/diario"`.

- [ ] **Step 4: build verde (rota `/barco/itens/novo`), 41/41. Commit:** `git add web; git commit -m "feat: itens monitorados genericos e casco por categorias"`

---

### Task 8: Gastos — painel

**Files:**
- Create: `web/app/(app)/barco/gastos/page.tsx`

**Interfaces:**
- Consumes: `resumoGastos`, `formatarReais`, `grupoDoEvento`, `hojeISO`, `carregarPainel`.

- [ ] **Step 1: `web/app/(app)/barco/gastos/page.tsx`:**

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { grupoDoEvento } from "@/lib/domain/diario"
import { formatarReais, resumoGastos } from "@/lib/domain/gastos"
import { supabaseServer } from "@/lib/supabase/server"
import type { Evento } from "@/lib/db/types"

export default async function GastosPage() {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  const hoje = hojeISO()
  const inicioJanela = `${hoje.slice(0, 4) - 1}-01-01`
  const supabase = await supabaseServer()
  const { data: eventos, error } = await supabase.from("eventos")
    .select("*").eq("embarcacao_id", painel.embarcacao.id)
    .not("custo_centavos", "is", null).gte("data", inicioJanela)
    .order("data", { ascending: false })
  if (error) throw new Error("Não foi possível carregar os gastos. Recarregue a página.")

  const porId = new Map(painel.equipamentos.map((e) => [e.id, e]))
  const comCusto = ((eventos ?? []) as Evento[]).filter((e) => (e.custo_centavos ?? 0) > 0)
  const entradas = comCusto.map((e) => ({
    data: e.data,
    custoCentavos: e.custo_centavos as number,
    grupo: grupoDoEvento({
      tipo: e.tipo, categoria: e.categoria, custoCentavos: e.custo_centavos,
      tipoEquipamento: e.equipamento_id ? porId.get(e.equipamento_id)?.tipo ?? null : null,
    }),
  }))
  const r = resumoGastos(entradas, hoje)
  const maiorMes = Math.max(1, ...r.meses.map((m) => m.totalCentavos))

  return (
    <main>
      <a href="/barco" className="font-mono-instr text-xs uppercase tracking-widest text-accent-forte">‹ Embarcação</a>
      <div className="mt-3 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Gastos</h1>
        <Link href="/diario/novo?custo=0,00" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-acao-texto">
          + Lançamento
        </Link>
      </div>

      <div className="mt-5 rounded-[14px] border border-line bg-panel p-4">
        <p className="font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Total do mês</p>
        <p className="mt-1 font-mono-instr text-3xl tabular-nums">{formatarReais(r.totalMesCentavos)}</p>
        {r.porGrupo.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {r.porGrupo.map((g) => (
              <div key={g.grupo} className="flex justify-between text-sm">
                <span className="text-dim">{g.grupo}</span>
                <span className="font-mono-instr tabular-nums">{formatarReais(g.totalCentavos)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Últimos 6 meses</p>
      <div className="flex items-end gap-2 rounded-[14px] border border-line bg-panel p-4" style={{ height: 132 }}>
        {r.meses.map((m) => (
          <div key={m.mes} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
            <div
              className={`w-full rounded-t ${m.mes === hoje.slice(0, 7) ? "bg-accent" : "bg-panel2 border border-line"}`}
              style={{ height: `${Math.round((m.totalCentavos / maiorMes) * 100)}%`, minHeight: m.totalCentavos > 0 ? 4 : 1 }}
            />
            <span className="font-mono-instr text-[10px] uppercase text-dim">{m.rotulo}</span>
          </div>
        ))}
      </div>

      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Lançamentos recentes</p>
      <div className="rounded-[14px] border border-line bg-panel px-4">
        {comCusto.length === 0 && (
          <p className="py-4 text-sm text-dim">
            Nenhum gasto registrado. Registre custos nos eventos do diário e eles aparecem aqui.
          </p>
        )}
        {comCusto.slice(0, 20).map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{e.descricao ?? e.tipo}</p>
              <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
                {e.data.split("-").reverse().join("/")}
              </p>
            </div>
            <span className="font-mono-instr text-sm tabular-nums">{formatarReais(e.custo_centavos as number)}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
```

Nota: `inicioJanela` usa template com subtração — escrever como
`const inicioJanela = \`${Number(hoje.slice(0, 4)) - 1}-01-01\`` para tipagem correta.

- [ ] **Step 2: build verde, 41/41. Commit:** `git add web; git commit -m "feat: painel de gastos com resumo e grafico de 6 meses"`

---

### Task 9: Integração — hub, detalhe do motor e Hoje

**Files:**
- Modify: `web/app/(app)/barco/page.tsx` (cards de navegação no fim), `web/app/(app)/barco/equipamento/[id]/page.tsx` (histórico + botão), `web/app/(app)/hoje/page.tsx` (acesso rápido)

**Interfaces:**
- Consumes: tudo já existente; `formatarReais`.

- [ ] **Step 1: cards no hub** — em `web/app/(app)/barco/page.tsx`, adicionar ao FINAL do `<main>` (depois do bloco "Dados gerais" se houver, senão após "Documentos e embarcação"):

```tsx
      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Acervo do barco</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: "/diario", rotulo: "Diário de Bordo", desc: "todo o histórico" },
          { href: "/barco/documentos", rotulo: "Documentos", desc: "validade e arquivos" },
          { href: "/barco/contatos", rotulo: "Contatos", desc: "quem cuida do barco" },
          { href: "/barco/gastos", rotulo: "Gastos", desc: "custos por mês" },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="rounded-[14px] border border-line bg-panel p-3.5">
            <p className="text-sm font-semibold">{c.rotulo}</p>
            <p className="mt-0.5 text-xs text-dim">{c.desc}</p>
          </Link>
        ))}
      </div>
```

- [ ] **Step 2: histórico no detalhe do motor** — em `web/app/(app)/barco/equipamento/[id]/page.tsx`: buscar eventos do equipamento e renderizar após "Identificação". Adicionar imports `supabaseServer`, `formatarReais`, e no corpo (após obter `equipamento`):

```tsx
  const supabase = await supabaseServer()
  const { data: eventos } = await supabase.from("eventos")
    .select("id, data, tipo, descricao, horas_no_momento, custo_centavos")
    .eq("equipamento_id", id).order("data", { ascending: false }).limit(10)
```

E o bloco de UI, ao final do `<main>`:

```tsx
      <div className="mt-6 flex items-baseline justify-between">
        <p className="font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Histórico</p>
        <Link href={`/diario/novo?alvo=${encodeURIComponent(`eq:${id}`)}`} className="text-sm text-accent-forte">
          Registrar serviço
        </Link>
      </div>
      <div className="mt-2 rounded-[14px] border border-line bg-panel px-4">
        {(eventos ?? []).length === 0 && (
          <p className="py-4 text-sm text-dim">Nenhum serviço registrado neste equipamento ainda.</p>
        )}
        {(eventos ?? []).map((e) => (
          <div key={e.id} className="border-b border-line py-3 last:border-0">
            <p className="text-sm font-medium">{e.descricao ?? e.tipo}</p>
            <p className="mt-0.5 font-mono-instr text-[11px] tabular-nums text-dim">
              {e.data.split("-").reverse().join("/")}
              {e.horas_no_momento != null ? ` · ${e.horas_no_momento.toLocaleString("pt-BR")} h` : ""}
              {e.custo_centavos != null ? ` · ${formatarReais(e.custo_centavos)}` : ""}
            </p>
          </div>
        ))}
      </div>
```

(import `Link` já existe nessa página; adicionar `formatarReais` de `@/lib/domain/gastos`.)

- [ ] **Step 3: acesso rápido na Hoje** — em `web/app/(app)/hoje/page.tsx`, ao final do `<main>`:

```tsx
      <p className="mt-6 mb-2 font-mono-instr text-[10.5px] uppercase tracking-[.16em] text-dim">Acesso rápido</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { href: "/barco", rotulo: "Motores" },
          { href: "/barco/documentos", rotulo: "Docs" },
          { href: "/diario", rotulo: "Diário" },
          { href: "/barco/contatos", rotulo: "Contatos" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="rounded-[12px] border border-line bg-panel px-1 py-3 text-xs font-medium">
            {a.rotulo}
          </Link>
        ))}
      </div>
```

(adicionar `import Link from "next/link"` se ainda não houver.)

- [ ] **Step 4: verificação final da fase** — `npm test` (41/41), `npm run build` verde com rotas `/diario`, `/diario/novo`, `/barco/documentos`, `/barco/contatos`, `/barco/gastos`, `/barco/itens/novo`. Commit:

`git add web; git commit -m "feat: integracao fase 2 - hub, historico do motor e acesso rapido"`

---

## Self-review (executado na escrita)

- **Cobertura:** espec v2.0 §5 — casco por categorias (T7), gastos (T8), documentos com validade+arquivo (T5), contatos (T6), diário por aba + visão geral (T4), "zerar ciclo" do §4.1 da v1.1 (T2/T3), históricos por aba (T4 filtros + T9 detalhe). Fotos/álbuns ficaram para a fase de PWA (storage já pronto) — decisão de escopo declarada.
- **Placeholders:** nenhum; todos os passos têm código completo.
- **Tipos:** `EventoParaFiltro` idêntico em T2/T4/T8; `zerarCiclo` consumido em T3 com a mesma assinatura; `CATEGORIAS_CASCO`/`ROTULO_CASCO` usados em T3/T7; nomes de campos de form batem com as actions correspondentes em T3/T5/T6/T7.

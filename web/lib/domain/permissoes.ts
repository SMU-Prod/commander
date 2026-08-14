// 13 áreas (onda 32 — antes eram 9; faltavam Hidráulica, Segurança,
// Equipamentos e Histórico, ver docs/auditoria/2026-08-14-prd-upgrade2-parte1.md
// §5). Adicionar uma aba aqui é seguro por construção: `normalizarPermissoes`
// preenche o que falta com `{ver:false, editar:false}` e `permissao()` no
// banco (jsonb path) faz o mesmo — vínculo existente nunca GANHA acesso a
// uma aba nova sem migração explícita, e PROP (permissoes = null) sempre
// tem tudo (`podeVer`/`podeEditar` abaixo, e `papel = 'PROP'` no banco).
export const ABAS = [
  "embarcacao", "motores", "eletrica", "casco", "hidraulica", "seguranca", "equipamentos",
  "documentos", "fotos", "contatos", "gastos", "diario", "historico",
] as const

export type Aba = (typeof ABAS)[number]

export const ROTULO_ABA: Record<Aba, string> = {
  embarcacao: "Embarcação", motores: "Motores", eletrica: "Elétrica", casco: "Casco",
  hidraulica: "Hidráulica", seguranca: "Segurança", equipamentos: "Equipamentos",
  documentos: "Documentos", fotos: "Fotos", contatos: "Contatos", gastos: "Gastos", diario: "Diário",
  historico: "Histórico",
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
    // Hidráulica segue o mesmo critério de Elétrica (manutenção do dia a dia,
    // ex.: nível de água/esgoto) — Segurança fica como Casco (área crítica,
    // tripulação vê mas só o PROP edita validade/estado de itens de
    // segurança). Equipamentos (hub genérico) segue Fotos, risco baixo.
    hidraulica: { ver: true, editar: true },
    seguranca: { ver: true, editar: false },
    equipamentos: { ver: true, editar: true },
    fotos: { ver: true, editar: true },
    diario: { ver: true, editar: true },
    // Histórico central espelha Diário: quem já via o feed do diário
    // continua vendo o mesmo tanto de informação consolidada.
    historico: { ver: true, editar: false },
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

export const ABAS = [
  "embarcacao", "motores", "eletrica", "casco",
  "documentos", "fotos", "contatos", "gastos", "diario",
] as const

export type Aba = (typeof ABAS)[number]

export const ROTULO_ABA: Record<Aba, string> = {
  embarcacao: "Embarcação", motores: "Motores", eletrica: "Elétrica", casco: "Casco",
  documentos: "Documentos", fotos: "Fotos", contatos: "Contatos", gastos: "Gastos", diario: "Diário",
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
    fotos: { ver: true, editar: true },
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

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
  // Onda 42 (PRD FINAL §9.4): "Financeiro completo e Carteira são permissões
  // independentes" — o PRD diz isso com todas as letras, então a Carteira
  // NÃO pode ser um pedaço de `gastos`. Um tripulante pode ter carteira sem
  // ver um centavo do Financeiro do barco (é o caso comum: ele vê o que
  // recebeu e gastou, não a mensalidade da marina), e o contrário também
  // vale. Área nova não herda nada: `normalizarPermissoes` e o `coalesce`
  // de `permissao()` no banco devolvem false pra quem não tem a chave.
  "carteira",
] as const

export type Aba = (typeof ABAS)[number]

export const ROTULO_ABA: Record<Aba, string> = {
  embarcacao: "Embarcação", motores: "Motores", eletrica: "Elétrica", casco: "Casco",
  hidraulica: "Hidráulica", seguranca: "Segurança", equipamentos: "Equipamentos",
  documentos: "Documentos", fotos: "Fotos", contatos: "Contatos",
  // A CHAVE continua `gastos`, o RÓTULO virou "Financeiro" (onda 42, PRD
  // §9.1 chama a aba assim). Trocar a chave exigiria reescrever o jsonb de
  // `vinculos.permissoes` de todo mundo que já foi convidado — e qualquer
  // vínculo que a migração não alcançasse perderia acesso em silêncio.
  // Rótulo é vocabulário; chave é acesso. Só o vocabulário mudou.
  gastos: "Financeiro",
  diario: "Diário", historico: "Histórico", carteira: "Carteira da Tripulação",
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
    // `carteira` fica de fora do Operacional de propósito: no PRD §9.4 quem
    // libera Carteira é o proprietário, tripulante por tripulante, com
    // regra própria (comprovante, aprovação). Vir ligada num preset seria
    // liberar dinheiro por atacado — o oposto do que o PRD descreve.
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

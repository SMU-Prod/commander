export type FiltroDiario = "tudo" | "motores" | "eletrica" | "casco" | "docs" | "gastos"

export const CATEGORIAS_CASCO = ["deck", "fibra", "inox", "vidros", "estofados", "casco_outros"] as const

export const ROTULO_CASCO: Record<string, string> = {
  deck: "Deck", fibra: "Fibra", inox: "Inox",
  vidros: "Vidros", estofados: "Estofados", casco_outros: "Outros",
}

export const TIPO_ROTULO: Record<string, string> = {
  manutencao: "Manutenção", abastecimento: "Abastecimento", navegacao: "Navegação",
  avaria: "Avaria", docagem: "Docagem", leitura_horas: "Leitura de horas", outro: "Outro",
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

/** Assume eventos já ordenados desc por data — entradas fora de ordem geram grupos duplicados. */
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

export function nomeDoEquipamento(eq: { tipo: string; posicao: string | null }): string {
  const tipo =
    eq.tipo === "motor" ? "Motor" : eq.tipo === "gerador" ? "Gerador" : eq.tipo === "bateria" ? "Bateria" : "Equipamento"
  return eq.posicao ? `${tipo} ${eq.posicao}` : tipo
}

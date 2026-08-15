import type { Aba } from "@/lib/domain/permissoes"

export type FiltroDiario =
  | "tudo" | "motores" | "eletrica" | "casco" | "hidraulica" | "seguranca" | "equipamentos" | "docs" | "gastos"

export const CATEGORIAS_CASCO = ["deck", "fibra", "inox", "vidros", "estofados", "casco_outros"] as const

export const ROTULO_CASCO: Record<string, string> = {
  deck: "Deck", fibra: "Fibra", inox: "Inox",
  vidros: "Vidros", estofados: "Estofados", casco_outros: "Outros",
}

/** Hidráulica (onda 32, PRD §15) — mesmo padrão categoria-based do Casco,
 *  sem tabela nova: um item_monitorado com uma destas categorias. */
export const CATEGORIAS_HIDRAULICA = ["hidraulica_agua_doce", "hidraulica_grey_water", "hidraulica_black_water"] as const

export const ROTULO_HIDRAULICA: Record<string, string> = {
  hidraulica_agua_doce: "Água doce", hidraulica_grey_water: "Grey Water", hidraulica_black_water: "Black Water",
}

/** Segurança (onda 32, PRD §16) — área crítica, mas sem sub-categorias no
 *  PRD (diferente de Hidráulica): um único balde "seguranca", os itens se
 *  diferenciam pelo nome (colete, extintor, bengala...). */
export const CATEGORIA_SEGURANCA = "seguranca"

/** Óleo e Filtros do motor (onda 41, PRD §11) — subtipo, não área. Estes
 *  itens sempre andam com `equipamento_id` (o motor), então quem decide a
 *  área é o equipamento; a categoria aqui só diz O QUE é, pra tela do motor
 *  poder separar "Óleo" de "Filtro de ar" em vez de depender do nome que a
 *  pessoa digitou. */
export const CATEGORIAS_MOTOR = [
  "motor_oleo", "motor_filtro_oleo", "motor_filtro_combustivel",
  "motor_filtro_ar", "motor_filtro_outros",
] as const

export const ROTULO_MOTOR: Record<string, string> = {
  motor_oleo: "Óleo",
  motor_filtro_oleo: "Filtro de óleo",
  motor_filtro_combustivel: "Filtro de combustível",
  motor_filtro_ar: "Filtro de ar",
  motor_filtro_outros: "Outro filtro",
}

/** Qual área governa um equipamento pelo `tipo` — espelha exatamente
 *  `aba_do_equipamento` no banco (migration 010, remapeada na 032). Único
 *  lugar no front que decide isso: `abaDoItem` abaixo e as telas de
 *  equipamento (`barco/equipamento/novo`, `lib/acoes/equipamentos.ts`)
 *  chamam esta função em vez de duplicar o `if`, senão o dia que o mapa
 *  mudar de novo alguém esquece um dos três lugares. */
export function abaDoEquipamento(tipo: string): Aba {
  if (tipo === "motor") return "motores"
  if (tipo === "outro") return "equipamentos"
  return "eletrica"
}

/**
 * Que categoria gravar num item que pertence a um motor (onda 41, PRD §11).
 *
 * Só devolve a categoria quando o alvo é MESMO um motor: um "filtro de ar"
 * pendurado num gerador não é o Óleo/Filtros do PRD §11, e gravar a
 * categoria nesse caso faria a tela do motor mostrar item de outro
 * equipamento. Fora disso devolve null — item de motor sem subtipo continua
 * valendo (é a maioria: "revisão dos 500h" não é óleo nem filtro).
 *
 * Uma função só, usada por criar e por editar, porque a regra precisa ser
 * a mesma nos dois: no editar dá pra mudar o alvo de um motor pra um
 * gerador, e sem isto a categoria antiga ficaria pendurada.
 */
export function categoriaDeItemDeMotor(
  equipamentoId: string | null,
  tipoMotor: string | null,
  equipamentos: { id: string; tipo: string }[],
): string | null {
  if (equipamentoId == null || tipoMotor == null) return null
  if (!(CATEGORIAS_MOTOR as readonly string[]).includes(tipoMotor)) return null
  const eq = equipamentos.find((e) => e.id === equipamentoId)
  return eq?.tipo === "motor" ? tipoMotor : null
}

/**
 * Qual área (da tela de acessos) governa uma manutenção ou documento —
 * espelha exatamente a função `aba_alvo` do banco (migration 010, estendida
 * na 032), quem de fato decide na RLS. Sem isso, o guard da tela e o guard
 * do banco divergem.
 */
export function abaDoItem(
  item: { equipamento_id: string | null; categoria: string | null },
  equipamentos: { id: string; tipo: string }[],
): Aba {
  if (item.equipamento_id) {
    const eq = equipamentos.find((e) => e.id === item.equipamento_id)
    return eq ? abaDoEquipamento(eq.tipo) : "eletrica"
  }
  if (item.categoria === "documento") return "documentos"
  if (item.categoria != null && (CATEGORIAS_CASCO as readonly string[]).includes(item.categoria)) return "casco"
  if (item.categoria != null && (CATEGORIAS_HIDRAULICA as readonly string[]).includes(item.categoria)) return "hidraulica"
  if (item.categoria === CATEGORIA_SEGURANCA) return "seguranca"
  // Rede de segurança: um item de óleo/filtro só chega aqui sem
  // `equipamento_id` se o motor dele foi apagado. Sem esta linha ele cairia
  // em "embarcacao" — área errada, e divergindo de `aba_alvo` no banco
  // (migration 041), que é quem a RLS de fato consulta.
  if (item.categoria != null && (CATEGORIAS_MOTOR as readonly string[]).includes(item.categoria)) return "motores"
  return "embarcacao"
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
const ehHidraulica = (e: EventoParaFiltro) =>
  e.categoria != null && (CATEGORIAS_HIDRAULICA as readonly string[]).includes(e.categoria)
const ehSeguranca = (e: EventoParaFiltro) => e.categoria === CATEGORIA_SEGURANCA

export function eventoNoFiltro(e: EventoParaFiltro, filtro: FiltroDiario): boolean {
  switch (filtro) {
    case "tudo": return true
    case "motores": return e.tipoEquipamento === "motor"
    case "eletrica": return e.tipoEquipamento === "gerador" || e.tipoEquipamento === "bateria"
    case "equipamentos": return e.tipoEquipamento === "outro"
    case "casco": return ehCasco(e)
    case "hidraulica": return ehHidraulica(e)
    case "seguranca": return ehSeguranca(e)
    case "docs": return e.categoria === "documento"
    case "gastos": return e.custoCentavos != null && e.custoCentavos > 0
  }
}

export function grupoDoEvento(
  e: EventoParaFiltro,
): "Motores" | "Elétrica" | "Casco" | "Hidráulica" | "Segurança" | "Equipamentos" | "Documentos" | "Geral" {
  if (e.tipoEquipamento === "motor") return "Motores"
  if (e.tipoEquipamento === "gerador" || e.tipoEquipamento === "bateria") return "Elétrica"
  if (e.tipoEquipamento === "outro") return "Equipamentos"
  if (ehCasco(e)) return "Casco"
  if (ehHidraulica(e)) return "Hidráulica"
  if (ehSeguranca(e)) return "Segurança"
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

import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { vencimentoPorData } from "@/lib/domain/semaforo"
import type { CategoriaItem, Equipamento, ItemMonitorado, TipoEvento } from "@/lib/db/types"

/**
 * O QUE UM RESUMO PRECISA SABER DE UM EVENTO — seis campos, e nenhum a mais.
 *
 * ONDA 100 — ESTE TIPO EXISTE PORQUE A TELA PEDIA A TABELA INTEIRA.
 *
 * `resumoDoMes` e `montarResumoPeriodo` pediam `Evento[]` completo, e por isso
 * `/barco/resumos` fazia `select("*")` — trazendo junto `trilha` (até 205,6 kB
 * por saída, medido) e `checklist`, que nenhuma linha destas funções lê. O
 * tipo largo não era descrição, era exigência: enquanto a assinatura pedisse o
 * evento inteiro, a consulta não podia parar de buscá-lo.
 *
 * Estreitar o tipo é o que autoriza a consulta a estreitar junto — e é a mesma
 * escolha que `OcorrenciaParaResumo`, `EventoParaFiltro` e `ItemParaSaude` já
 * faziam neste mesmo módulo. `Evento` continua servindo aqui por
 * compatibilidade estrutural: o cron mensal, que já tem a linha inteira em
 * mãos, passa como sempre passou.
 */
export interface EventoParaResumo {
  data: string
  tipo: TipoEvento
  categoria: CategoriaItem | null
  custo_centavos: number | null
  equipamento_id: string | null
  horas_no_momento: number | null
}

export interface ResumoMes {
  horasMotor: number
  totalGastosCentavos: number
  saidas: number
  aVencer: Array<{ nome: string; quando: string }>
}

/** Mes seguinte a um mesISO ("2026-08" -> "2026-09"), virando o ano em dezembro. */
export function mesSeguinte(mesISO: string): string {
  const [a, m] = mesISO.split("-").map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`
}

/**
 * Mes anterior a uma data ISO ("2026-01-05" -> "2025-12"), pra fechar o mes que
 * acabou de passar. O cron do relatorio roda no dia 1 de manha: o mes "atual"
 * naquele instante ainda nao tem nada pra contar — o que interessa e o mes anterior.
 */
export function mesAnteriorISO(hoje: string): string {
  const [a, m] = hoje.slice(0, 7).split("-").map(Number)
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`
}

/** Resumo fechado de um mes ("2026-08") para o e-mail mensal. Puro e testavel. */
export function resumoDoMes(
  dados: { eventos: EventoParaResumo[]; itens: ItemMonitorado[]; equipamentos: Equipamento[] },
  mesISO: string,
): ResumoMes {
  const doMes = dados.eventos.filter((e) => e.data.startsWith(mesISO))

  let horasMotor = 0
  for (const eq of dados.equipamentos.filter((e) => e.tipo === "motor")) {
    const leituras = doMes
      .filter((e) => e.tipo === "leitura_horas" && e.equipamento_id === eq.id && e.horas_no_momento != null)
      .map((e) => ({ data: e.data, horas: e.horas_no_momento as number }))
      .sort((a, b) => a.data.localeCompare(b.data))
    if (leituras.length >= 2) {
      const delta = leituras[leituras.length - 1].horas - leituras[0].horas
      if (delta > 0) horasMotor += delta
    }
  }

  const totalGastosCentavos = doMes.reduce((s, e) => s + (e.custo_centavos ?? 0), 0)
  const saidas = doMes.filter((e) => e.tipo === "navegacao").length

  // mesma derivacao do farol (data fixa OU ultimo ciclo + intervalo em meses):
  // um item "revisao a cada 6 meses" aparece aqui como aparece na tela
  const proximo = mesSeguinte(mesISO)
  const aVencer = dados.itens
    .map((i) => ({ nome: i.nome, quando: vencimentoPorData(itemMonitoradoToItemCalc(i)) }))
    .filter((i): i is { nome: string; quando: string } => i.quando?.startsWith(proximo) ?? false)
    .sort((a, b) => a.quando.localeCompare(b.quando))

  return { horasMotor, totalGastosCentavos, saidas, aVencer }
}

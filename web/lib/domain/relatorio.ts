import type { Equipamento, Evento, ItemMonitorado } from "@/lib/db/types"

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
  dados: { eventos: Evento[]; itens: ItemMonitorado[]; equipamentos: Equipamento[] },
  mesISO: string,
): ResumoMes {
  const doMes = dados.eventos.filter((e) => e.data.startsWith(mesISO))

  let horasMotor = 0
  for (const eq of dados.equipamentos) {
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

  const proximo = mesSeguinte(mesISO)
  const aVencer = dados.itens
    .filter((i) => i.data_fixa?.startsWith(proximo))
    .map((i) => ({ nome: i.nome, quando: i.data_fixa as string }))
    .sort((a, b) => a.quando.localeCompare(b.quando))

  return { horasMotor, totalGastosCentavos, saidas, aVencer }
}

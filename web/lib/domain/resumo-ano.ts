import { duracaoHoras } from "@/lib/domain/bordo"
import { resumoTrilha, type PontoTrilha } from "@/lib/domain/geo"

export interface EventoParaResumoAno {
  tipo: string
  data: string
  hora_saida: string | null
  hora_retorno: string | null
  trilha: PontoTrilha[] | null
}

export interface ResumoAno {
  saidas: number
  milhasNm: number
  horasNoMar: number
}

/**
 * Totais pessoais do ano corrente — "Seu ano no mar" (onda 18, Pilar Strava do
 * Mar). Puro e testável: só soma o que os dados já sustentam, nunca inventa.
 *
 * - saídas: toda saída (tipo "navegacao") registrada no ano.
 * - milhasNm: só soma quando a saída tem trilha GPS de verdade (>= 2 pontos)
 *   — sem trilha, a distância dessa saída fica de fora da conta em vez de
 *   virar zero disfarçado de "não navegou".
 * - horasNoMar: soma `duracaoHoras(hora_saida, hora_retorno)` de cada saída
 *   que tem os dois horários — vale tanto pra saída registrada manualmente
 *   quanto pra saída gravada por trilha (que deriva esses campos dos pontos
 *   extremos, ver lib/acoes/trilha.ts).
 *
 * Sem nenhuma saída no ano, devolve `null` — quem usa isto não mostra cartão
 * nenhum (nada de "0 saídas · 0 MN · 0 h" espalhafatoso).
 */
export function resumoAno(eventos: EventoParaResumoAno[], ano: number): ResumoAno | null {
  const doAno = eventos.filter((e) => e.tipo === "navegacao" && e.data.slice(0, 4) === String(ano))
  if (doAno.length === 0) return null

  let milhasNm = 0
  let horasNoMar = 0
  for (const e of doAno) {
    if (Array.isArray(e.trilha) && e.trilha.length >= 2) {
      milhasNm += resumoTrilha(e.trilha).distanciaNm
    }
    const duracao = duracaoHoras(e.hora_saida, e.hora_retorno)
    if (duracao != null) horasNoMar += duracao
  }
  return { saidas: doAno.length, milhasNm, horasNoMar }
}

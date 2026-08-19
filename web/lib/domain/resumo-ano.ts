import { duracaoHoras } from "@/lib/domain/bordo"

export interface EventoParaResumoAno {
  tipo: string
  data: string
  hora_saida: string | null
  hora_retorno: string | null
  /**
   * Distância da trilha em milhas náuticas, gravada quando a saída foi salva
   * (`lib/acoes/trilha.ts`, `lib/acoes/importar-gpx.ts`, migration 092).
   *
   * `null` é "esta saída não tem trilha" — NUNCA "andou zero". A distinção é a
   * mesma régua de `lib/domain/patio.ts`, e ela decide o que a tela desenha:
   * saída sem trilha fica de fora da soma, em vez de entrar como zero e
   * dissolver a média de quem navegou.
   */
  distancia_nm: number | null
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
 * - milhasNm: só soma quando a saída tem distância gravada — sem trilha, a
 *   distância dessa saída fica de fora da conta em vez de virar zero
 *   disfarçado de "não navegou".
 * - horasNoMar: soma `duracaoHoras(hora_saida, hora_retorno)` de cada saída
 *   que tem os dois horários — vale tanto pra saída registrada manualmente
 *   quanto pra saída gravada por trilha (que deriva esses campos dos pontos
 *   extremos, ver lib/acoes/trilha.ts).
 *
 * Sem nenhuma saída no ano, devolve `null` — quem usa isto não mostra cartão
 * nenhum (nada de "0 saídas · 0 MN · 0 h" espalhafatoso).
 *
 * ONDA 100 — ESTA FUNÇÃO NÃO RECALCULA MAIS A DISTÂNCIA A PARTIR DOS PONTOS.
 *
 * Ela recebia a trilha GPS inteira de cada saída e chamava `resumoTrilha` para
 * extrair um float por evento. Como quem chama são telas de LISTA, isso
 * obrigava a consulta a baixar a coluna `trilha` de todas as saídas do ano:
 * uma trilha no teto pesa 227 kB, e um barco que sai três vezes por semana
 * chega a dezembro com 144 saídas — 32 MB baixados a cada abertura da tela
 * inicial para exibir um número.
 *
 * A distância passa a ser lida de onde ela já era calculada e jogada fora: no
 * momento de gravar a saída. O dono do cálculo continua sendo um só —
 * `resumoTrilha` em `lib/domain/geo.ts` —, e é por isso que a soma daqui não
 * pode divergir do traçado: ninguém reimplementou a conta, ela só parou de ser
 * refeita a cada abertura de tela sobre um dado que não muda (nenhum caminho
 * do app faz UPDATE em `eventos.trilha`).
 */
export function resumoAno(eventos: EventoParaResumoAno[], ano: number): ResumoAno | null {
  const doAno = eventos.filter((e) => e.tipo === "navegacao" && e.data.slice(0, 4) === String(ano))
  if (doAno.length === 0) return null

  let milhasNm = 0
  let horasNoMar = 0
  for (const e of doAno) {
    if (e.distancia_nm != null) milhasNm += e.distancia_nm
    const duracao = duracaoHoras(e.hora_saida, e.hora_retorno)
    if (duracao != null) horasNoMar += duracao
  }
  return { saidas: doAno.length, milhasNm, horasNoMar }
}

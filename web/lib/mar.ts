import { avaliarMar, proximaMare, type EventoMare, type NivelMarHora, type SeloMar } from "@/lib/domain/mar"

export interface BoletimMar {
  ondaM: number | null
  periodoS: number | null
  ventoKt: number | null
  /** Direção EM GRAUS de onde o vento sopra (convenção meteorológica) —
   *  quem exibe converte pra rosa dos ventos com `pontoCardeal`
   *  (web/lib/domain/mar.ts). `null` quando a API não devolveu a hora. */
  ventoGraus: number | null
  /** Rajada em nós — a API às vezes não tem o dado pra uma hora específica
   *  (mais raro que vento/onda faltarem, mas acontece); `null` nesse caso,
   *  nunca 0 fingindo calmaria. */
  rajadaKt: number | null
  aguaC: number | null
  /** Nível do mar por hora do dia inteiro (0-23h, horário de Brasília) —
   *  curva ESTIMADA POR MODELO (Open-Meteo Marine, sea_level_height_msl),
   *  NUNCA a tábua oficial do CHM. Alimenta o gráfico do painel de tempo e
   *  `proximaMareEstimada` abaixo. Pode vir menor que 24 pontos se a API
   *  não cobrir a hora inteira. */
  serieNivelMar: NivelMarHora[]
  /** Próxima preamar/baixa-mar ESTIMADA a partir de agora, derivada de
   *  `serieNivelMar` (extremosMare/proximaMare, lib/domain/mar.ts) — `null`
   *  sem série suficiente ou sem mais virada no dia. Rótulo honesto: quem
   *  exibe SEMPRE diz "estimativa" e nunca "tábua oficial" (ver
   *  CONTRIBUTING.md). */
  proximaMareEstimada: EventoMare | null
  selo: SeloMar
}

/** Hora atual em America/Sao_Paulo (0-23) — mesma definição de "agora" usada
 *  pra escolher a leitura atual do boletim (abaixo) E pra marcar "agora" no
 *  gráfico de maré do painel de tempo (web/components/mapa/tempo-painel.tsx),
 *  exportada pra não duplicar a lógica de fuso horário em dois lugares. */
export function horaSp(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })
      .format(new Date()),
  )
}

function valorHora(dados: unknown, campo: string, hora: number): number | null {
  const hourly = (dados as { hourly?: Record<string, unknown> } | null)?.hourly
  const serie = hourly?.[campo]
  if (!Array.isArray(serie) || hora >= serie.length) return null
  const v = serie[hora]
  return typeof v === "number" ? v : null
}

/** Série completa (todas as horas que a API devolveu) de um campo horário —
 *  usada só pro nível do mar, que precisa do DIA inteiro pra achar preamar/
 *  baixa-mar, diferente dos outros campos (que só olham a hora atual). */
function serieHoraCompleta(dados: unknown, campo: string): NivelMarHora[] {
  const hourly = (dados as { hourly?: Record<string, unknown> } | null)?.hourly
  const serie = hourly?.[campo]
  if (!Array.isArray(serie)) return []
  return serie
    .map((v, hora) => ({ hora, nivelM: typeof v === "number" ? v : null }))
    .filter((p): p is NivelMarHora => p.nivelM !== null)
}

export async function boletimDoMar(lat: number, lon: number): Promise<BoletimMar | null> {
  try {
    const [marinho, tempo] = await Promise.all([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,sea_surface_temperature,sea_level_height_msl&timezone=America%2FSao_Paulo&forecast_days=1`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) },
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=1`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) },
      ).then((r) => (r.ok ? r.json() : null)),
    ])
    if (!marinho && !tempo) return null

    const h = horaSp()
    const ondaM = valorHora(marinho, "wave_height", h)
    const periodoS = valorHora(marinho, "wave_period", h)
    const aguaC = valorHora(marinho, "sea_surface_temperature", h)
    const ventoKt = valorHora(tempo, "wind_speed_10m", h)
    const ventoGraus = valorHora(tempo, "wind_direction_10m", h)
    const rajadaKt = valorHora(tempo, "wind_gusts_10m", h)
    const serieNivelMar = serieHoraCompleta(marinho, "sea_level_height_msl")
    return {
      ondaM,
      periodoS,
      ventoKt,
      ventoGraus,
      rajadaKt,
      aguaC,
      serieNivelMar,
      proximaMareEstimada: proximaMare(serieNivelMar, h),
      selo: avaliarMar(ondaM, ventoKt),
    }
  } catch {
    return null
  }
}

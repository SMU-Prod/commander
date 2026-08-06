import { avaliarMar, type SeloMar } from "@/lib/domain/mar"

export interface BoletimMar {
  ondaM: number | null
  periodoS: number | null
  ventoKt: number | null
  aguaC: number | null
  selo: SeloMar
}

function horaSp(): number {
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

export async function boletimDoMar(lat: number, lon: number): Promise<BoletimMar | null> {
  try {
    const [marinho, tempo] = await Promise.all([
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,sea_surface_temperature&timezone=America%2FSao_Paulo&forecast_days=1`,
        { next: { revalidate: 3600 } },
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m&wind_speed_unit=kn&timezone=America%2FSao_Paulo&forecast_days=1`,
        { next: { revalidate: 3600 } },
      ).then((r) => (r.ok ? r.json() : null)),
    ])
    if (!marinho && !tempo) return null

    const h = horaSp()
    const ondaM = valorHora(marinho, "wave_height", h)
    const periodoS = valorHora(marinho, "wave_period", h)
    const aguaC = valorHora(marinho, "sea_surface_temperature", h)
    const ventoKt = valorHora(tempo, "wind_speed_10m", h)
    return { ondaM, periodoS, ventoKt, aguaC, selo: avaliarMar(ondaM, ventoKt) }
  } catch {
    return null
  }
}

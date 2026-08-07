export interface LeituraHoras {
  data: string
  horas: number
}

/** Horas de motor por semana entre a primeira e a última leitura. */
export function mediaHorasPorSemana(leituras: LeituraHoras[]): number | null {
  if (leituras.length < 2) return null
  const ordenadas = [...leituras].sort((a, b) => a.data.localeCompare(b.data))
  const primeira = ordenadas[0]
  const ultima = ordenadas[ordenadas.length - 1]
  const dias =
    (Date.parse(`${ultima.data}T00:00:00Z`) - Date.parse(`${primeira.data}T00:00:00Z`)) / 86_400_000
  if (dias <= 0) return null
  const horas = ultima.horas - primeira.horas
  if (horas <= 0) return 0
  return (horas / dias) * 7
}

/** Em quantos dias as horas restantes acabam, no ritmo atual. */
export function previsaoDias(horasRestantes: number, mediaSemana: number): number | null {
  if (mediaSemana <= 0) return null
  if (horasRestantes <= 0) return 0
  return Math.round((horasRestantes / mediaSemana) * 7)
}

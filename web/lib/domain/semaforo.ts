export type StatusFarol = "ok" | "atencao" | "vencido"

export interface ItemCalc {
  intervaloHoras: number | null
  intervaloMeses: number | null
  dataFixa: string | null
  ultimoCicloData: string | null
  ultimoCicloHoras: number | null
}

export interface ResultadoCalc {
  status: StatusFarol
  horasRestantes: number | null
  diasRestantes: number | null
}

export const MARGEM_DIAS = 30 // documentos/datas: atenção a 30 dias (espec §4.1)
const MARGEM_HORAS_PCT = 0.15 // horas: atenção nos últimos 15% do intervalo (espec §4.1)

function paraUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const total = y * 12 + (m - 1) + meses
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const ultimoDia = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, ultimoDia)
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`
}

function diffDias(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000)
}

export const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

export function calcularSemaforo(item: ItemCalc, horasAtuais: number | null, hoje: string): ResultadoCalc {
  let statusHoras: StatusFarol | null = null
  let horasRestantes: number | null = null
  if (item.intervaloHoras != null && item.ultimoCicloHoras != null && horasAtuais != null) {
    horasRestantes = item.ultimoCicloHoras + item.intervaloHoras - horasAtuais
    if (horasRestantes < 0) statusHoras = "vencido"
    else if (horasRestantes <= item.intervaloHoras * MARGEM_HORAS_PCT) statusHoras = "atencao"
    else statusHoras = "ok"
  }

  let statusData: StatusFarol | null = null
  let diasRestantes: number | null = null
  const vencimento =
    item.dataFixa ??
    (item.intervaloMeses != null && item.ultimoCicloData != null
      ? somarMeses(item.ultimoCicloData, item.intervaloMeses)
      : null)
  if (vencimento != null) {
    diasRestantes = diffDias(hoje, vencimento)
    if (diasRestantes < 0) statusData = "vencido"
    else if (diasRestantes <= MARGEM_DIAS) statusData = "atencao"
    else statusData = "ok"
  }

  const candidatos = [statusHoras, statusData].filter((s): s is StatusFarol => s != null)
  const status = candidatos.length === 0 ? "ok" : candidatos.sort((a, b) => PESO[b] - PESO[a])[0]
  return { status, horasRestantes, diasRestantes }
}

export function textoRestante(r: ResultadoCalc): string {
  const h = r.horasRestantes
  const d = r.diasRestantes
  if (h != null && h < 0) return `vencido há ${Math.round(-h)} h`
  if (d != null && d < 0) return `vencido há ${-d} dias`
  const partes: string[] = []
  if (h != null) partes.push(`${Math.round(h)} h`)
  if (d != null) partes.push(`${d} dias`)
  return partes.length > 0 ? `em ${partes.join(" ou ")}` : ""
}

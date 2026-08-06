import type { ItemMonitorado } from "@/lib/db/types"
import type { ResultadoCalc } from "@/lib/domain/semaforo"

export type JanelaAlerta = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido"

export function janelaDoAlerta(r: ResultadoCalc): JanelaAlerta | null {
  if (r.horasRestantes != null && r.horasRestantes < 0) return "h_vencido"
  if (r.diasRestantes != null && r.diasRestantes < 0) return "vencido"
  if (r.diasRestantes != null && r.diasRestantes <= 30) {
    if (r.diasRestantes <= 5) return "d5"
    if (r.diasRestantes <= 15) return "d15"
    return "d30"
  }
  if (r.status === "atencao" && r.horasRestantes != null) return "h_margem"
  return null
}

export function cicloRef(
  i: Pick<ItemMonitorado, "data_fixa" | "ultimo_ciclo_data" | "ultimo_ciclo_horas">,
): string {
  return `${i.data_fixa ?? ""}|${i.ultimo_ciclo_data ?? ""}|${i.ultimo_ciclo_horas ?? ""}`
}

export function textoDoAlerta(
  nomeItem: string,
  nomeAlvo: string | null,
  janela: JanelaAlerta,
  r: ResultadoCalc,
): { titulo: string; corpo: string } {
  const onde = nomeAlvo ? `${nomeItem} — ${nomeAlvo}` : nomeItem
  switch (janela) {
    case "h_vencido":
      return { titulo: `🔴 ${onde}`, corpo: `Vencido há ${Math.round(-(r.horasRestantes ?? 0))} h de uso.` }
    case "vencido":
      return { titulo: `🔴 ${onde}`, corpo: `Vencido há ${-(r.diasRestantes ?? 0)} dias.` }
    case "h_margem":
      return { titulo: `🟡 ${onde}`, corpo: `Faltam ${Math.round(r.horasRestantes ?? 0)} h de uso.` }
    default:
      return { titulo: `🟡 ${onde}`, corpo: `Vence em ${r.diasRestantes} dias.` }
  }
}

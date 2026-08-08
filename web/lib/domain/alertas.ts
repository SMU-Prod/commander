import type { ItemMonitorado } from "@/lib/db/types"
import type { SeloMar } from "@/lib/domain/mar"
import { MARGEM_DIAS, type ResultadoCalc } from "@/lib/domain/semaforo"

export type JanelaAlerta = "d30" | "d15" | "d5" | "vencido" | "h_margem" | "h_vencido"

export function janelaDoAlerta(r: ResultadoCalc): JanelaAlerta | null {
  if (r.horasRestantes != null && r.horasRestantes < 0) return "h_vencido"
  if (r.diasRestantes != null && r.diasRestantes < 0) return "vencido"
  if (r.diasRestantes != null && r.diasRestantes <= MARGEM_DIAS) {
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

export type JanelaGeral = "mar_ruim" | "motor_parado"

export interface AvisoGeral {
  titulo: string
  corpo: string
  janela: JanelaGeral
  cicloRef: string
}

const LIMITE_DIAS_MOTOR_PARADO = 30

function formatarMetros(m: number): string {
  return m.toFixed(1).replace(".", ",")
}

/** Avalia se o boletim do mar de hoje justifica interromper o dono com um push. So mar pesado
 *  (nivel "crit") vale o alerta — "atencao" e cotidiano demais pra virar notificacao.
 *  cicloRef = hoje: junto com a dedupe de alertas_enviados, garante no maximo 1 aviso/dia/embarcacao. */
export function alertaDeMar(
  boletim: { ondaM: number | null; ventoKt: number | null; selo: SeloMar },
  hoje: string,
): AvisoGeral | null {
  if (boletim.selo.nivel !== "crit") return null
  const partes: string[] = []
  if (boletim.ondaM !== null) partes.push(`onda ${formatarMetros(boletim.ondaM)} m`)
  if (boletim.ventoKt !== null) partes.push(`vento ${Math.round(boletim.ventoKt)} kt`)
  const detalhe = partes.length ? ` — ${partes.join(" e ")}` : ""
  return {
    titulo: "🌊 Mar ruim",
    corpo: `Mar ruim na sua marina hoje${detalhe}.`,
    janela: "mar_ruim",
    cicloRef: hoje,
  }
}

/** Diferenca em dias de calendario entre duas datas ISO (so a parte "YYYY-MM-DD" importa —
 *  `ultima_leitura` chega como timestamptz, mas o horario nao muda quantos dias se passaram). */
function diasEntre(dataIso: string, hojeIso: string): number {
  const inicio = Date.parse(`${dataIso.slice(0, 10)}T00:00:00Z`)
  const fim = Date.parse(`${hojeIso.slice(0, 10)}T00:00:00Z`)
  return Math.round((fim - inicio) / 86_400_000)
}

/** Motor sem leitura de horas ha mais de 30 dias: sugere rodar/aquecer — e recomendacao, nao
 *  diagnostico (o dominio nao sabe se ha algo errado, so que ninguem registrou uso ha tempo).
 *  cicloRef = a propria ultima leitura: o aviso so reancora quando uma leitura nova chegar. */
export function lembreteMotorParado(ultimaLeitura: string | null, hoje: string): AvisoGeral | null {
  if (!ultimaLeitura) return null
  const dias = diasEntre(ultimaLeitura, hoje)
  if (dias <= LIMITE_DIAS_MOTOR_PARADO) return null
  return {
    titulo: "🛠️ Motor parado",
    corpo: `Já fazem ${dias} dias sem leitura de horas nesse motor — vale dar uma rodada pra manter tudo lubrificado.`,
    janela: "motor_parado",
    cicloRef: ultimaLeitura,
  }
}

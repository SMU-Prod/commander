/** Planos da promo 100 fundadores — preco travado enquanto assinar. Centavos, sempre. */
export type PlanoId = "fundador_mensal" | "fundador_anual"
export type CicloAsaas = "MONTHLY" | "YEARLY"

export const VAGAS_FUNDADOR = 100
export const ANCORA_MENSAL_CENTAVOS = 11990

export const PLANOS: Record<PlanoId, {
  rotulo: string
  valorCentavos: number
  ciclo: CicloAsaas
  descricao: string
}> = {
  fundador_mensal: {
    rotulo: "Fundador mensal",
    valorCentavos: 6999,
    ciclo: "MONTHLY",
    descricao: "Commander — plano fundador (mensal)",
  },
  fundador_anual: {
    rotulo: "Fundador anual",
    valorCentavos: 69990,
    ciclo: "YEARLY",
    descricao: "Commander — plano fundador (anual, 2 meses gratis)",
  },
}

export function vagasRestantes(ocupadas: number): number {
  return Math.max(0, VAGAS_FUNDADOR - ocupadas)
}

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00A0/g, " ")
}

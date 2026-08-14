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

/** Upgrade real disponível hoje (PRD §44, "Upgrade" na tela de assinatura) —
 *  como só existe UM nível pago (a promo fundador), o único upgrade possível
 *  é trocar o ciclo mensal pelo anual (2 meses grátis, mesmo preço/mês do
 *  fundador). `null` = já está no melhor ciclo, não há upgrade a oferecer.
 *  Nunca inventa um "Premium normal" — essa decisão de preço é do dono e
 *  ainda não foi tomada (PRD §79.8, auditoria de 14/08/2026). */
export function proximoUpgrade(planoAtual: PlanoId): PlanoId | null {
  return planoAtual === "fundador_mensal" ? "fundador_anual" : null
}

export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00A0/g, " ")
}

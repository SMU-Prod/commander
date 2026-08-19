/**
 * ESTOQUE E COMBUSTÍVEL (onda 73).
 * PRD-UPGRADE-3-COTAS §10 (Estoque) e §11 (Hub Combustível).
 *
 * Os dois §§ abrem com a mesma trava de escopo, cada um do seu jeito:
 * *"Logística simples de materiais; não criar WMS/ERP."* Nada de endereço
 * de prateleira, curva ABC, lote, validade por série ou inventário rotativo.
 * O que existe aqui responde três perguntas do pátio: o que tem, o que está
 * acabando, e para onde foi.
 *
 * Módulo puro.
 */

// ---------------------------------------------------------------------------
// §10 — Estoque
// ---------------------------------------------------------------------------

/** As categorias que o §10 lista, palavra por palavra. */
export const CATEGORIAS_ESTOQUE = [
  "peca", "oleo", "filtro", "bateria", "vela", "cabo", "seguranca", "consumivel", "outro",
] as const

export type CategoriaEstoque = (typeof CATEGORIAS_ESTOQUE)[number]

export const ROTULO_CATEGORIA_ESTOQUE: Record<CategoriaEstoque, string> = {
  peca: "Peças",
  oleo: "Óleo e lubrificante",
  filtro: "Filtro",
  bateria: "Bateria",
  vela: "Vela",
  cabo: "Cabo",
  seguranca: "Segurança e colete",
  consumivel: "Consumível",
  outro: "Outro",
}

export type EstadoEstoque = "zerado" | "abaixo_do_minimo" | "ok"

/**
 * Como está a quantidade de um item.
 *
 * `zerado` é separado de `abaixo_do_minimo` de propósito: acabou é uma
 * situação diferente de "está acabando", e o §10 pede que o ADM receba aviso
 * de estoque baixo — quem já zerou não está baixo, está parado.
 *
 * Sem mínimo definido (`null`), só existe zerado ou ok: inventar um mínimo
 * faria o app alertar sobre algo que ninguém pediu para acompanhar.
 */
export function estadoDoItem(quantidade: number, minimo: number | null): EstadoEstoque {
  if (quantidade <= 0) return "zerado"
  if (minimo != null && quantidade <= minimo) return "abaixo_do_minimo"
  return "ok"
}

export const ROTULO_ESTADO_ESTOQUE: Record<EstadoEstoque, string> = {
  zerado: "Acabou",
  abaixo_do_minimo: "Acabando",
  ok: "Em estoque",
}

/** O que entra no aviso de estoque baixo do §10 — acabou e acabando, nesta
 *  ordem de urgência. */
export function precisaRepor(e: EstadoEstoque): boolean {
  return e !== "ok"
}

/**
 * §10: "Consumo vinculado à unidade baixa estoque automaticamente."
 *
 * Devolve a quantidade nova, e recusa a retirada que não cabe — tirar 5 de um
 * estoque de 3 deixaria saldo negativo, que é a maneira de o app parar de
 * saber quanto realmente existe. Quem tirou mais do que o sistema achava que
 * havia precisa ajustar o estoque (com motivo, §22), não empurrar o saldo
 * para baixo de zero.
 */
export function retirarDoEstoque(
  quantidadeAtual: number,
  retirada: number,
): { ok: true; nova: number } | { ok: false; erro: string } {
  if (!(retirada > 0)) return { ok: false, erro: "Informe uma quantidade maior que zero." }
  if (retirada > quantidadeAtual) {
    return {
      ok: false,
      erro: `Só há ${quantidadeAtual} em estoque. Ajuste o estoque antes, com o motivo da diferença.`,
    }
  }
  return { ok: true, nova: quantidadeAtual - retirada }
}

// ---------------------------------------------------------------------------
// §11 — Hub Combustível
// ---------------------------------------------------------------------------

/**
 * §11: "Balanço: saldo inicial + entradas - saídas = saldo teórico."
 *
 * A conta inteira do tanque, num lugar só. É deliberadamente burra: soma o
 * que entrou, subtrai o que saiu. A inteligência está em quem compara isso
 * com a medição física — ver `divergenciaDoTanque`.
 */
export function saldoTeorico(saldoInicial: number, entradas: number, saidas: number): number {
  return saldoInicial + entradas - saidas
}

export interface DivergenciaTanque {
  teorico: number
  fisico: number
  /** Positivo = sobrou mais do que a conta dizia. Negativo = sumiu. */
  diferenca: number
  /** §22: ajuste que gera divergência exige motivo. */
  exigeMotivo: boolean
  frase: string
}

/**
 * Compara o saldo teórico com a medição física da régua.
 *
 * O sinal importa e não é simetria de fachada: combustível que SOME é
 * problema operacional (vazamento, abastecimento não registrado, desvio) e
 * combustível que SOBRA é erro de registro. As duas frases dizem coisas
 * diferentes porque o ADM age diferente em cada caso.
 *
 * `exigeMotivo` é `true` em qualquer diferença, inclusive a que sobra — o §22
 * fala em "divergência", não em "falta".
 */
export function divergenciaDoTanque(teorico: number, fisico: number): DivergenciaTanque {
  const diferenca = fisico - teorico
  const abs = Math.abs(diferenca)
  return {
    teorico,
    fisico,
    diferenca,
    exigeMotivo: diferenca !== 0,
    frase:
      diferenca === 0
        ? "A medição bate com o saldo teórico."
        : diferenca < 0
          ? `Faltam ${formatarLitros(abs)} em relação ao teórico. Registre o motivo.`
          : `Sobram ${formatarLitros(abs)} em relação ao teórico. Registre o motivo.`,
  }
}

/**
 * §11: "Saída: destino OBRIGATÓRIO (Jet/unidade ou outro destino
 * autorizado)."
 *
 * É a regra que faz o tanque próprio valer alguma coisa: sem destino, litro
 * que sai do tanque some do sistema e o consumo por unidade — que é o
 * relatório que o §11 pede — fica sem base.
 */
export function validarSaidaDoTanque(
  litros: number,
  destinoEmbarcacaoId: string | null,
  destinoLivre: string | null,
): string | null {
  if (!(litros > 0)) return "Informe quantos litros saíram."
  if (!destinoEmbarcacaoId && !destinoLivre?.trim()) {
    return "Diga para onde foi: uma unidade da frota ou outro destino."
  }
  return null
}

/** "1.250 L" — litro é medida de tanque, sempre inteiro na exibição. */
export function formatarLitros(litros: number): string {
  return `${Math.round(litros).toLocaleString("pt-BR")} L`
}

/**
 * Preço por litro a partir do total pago, ou o inverso.
 *
 * O §11 aceita "valor total E/OU preço/litro" — quem abastece anota um ou
 * outro, e o app completa. Dinheiro em centavos, como o resto da casa.
 */
export function precoPorLitroCentavos(totalCentavos: number, litros: number): number | null {
  if (!(litros > 0)) return null
  return Math.round(totalCentavos / litros)
}

export function totalCentavosPorLitro(precoLitroCentavos: number, litros: number): number | null {
  if (!(litros > 0)) return null
  return Math.round(precoLitroCentavos * litros)
}

/**
 * Consumo médio de uma unidade, em litros por hora de motor.
 *
 * `null` quando não houve hora rodada — dividir por zero daria Infinity, e
 * "∞ L/h" numa tela de frota é pior que não mostrar nada. É a mesma régua de
 * honestidade do resto do app: sem base, sem número.
 */
export function consumoPorHora(litros: number, horasDeMotor: number): number | null {
  if (!(horasDeMotor > 0)) return null
  return litros / horasDeMotor
}

import { duracaoHoras } from "@/lib/domain/bordo"

/**
 * MICRO-KPIs DO CARTÃO DE PESSOA (onda 62, canvas tela-1f).
 *
 * O cartão da Tripulação mostra, por comandante, o que o Diário JÁ registra
 * — saídas criadas pela pessoa e horas no mar somadas das saídas com par
 * saída/retorno. Nada aqui é uma segunda contagem: a fonte é a mesma tabela
 * `eventos` do Diário de Bordo, e a duração usa o MESMO `duracaoHoras` de
 * `lib/domain/bordo.ts` (com o mesmo limite conhecido de uma meia-noite).
 *
 * Honestidade do canvas: saída sem os dois horários conta como saída mas não
 * soma hora nenhuma — melhor um "3 saídas · 2 h" verdadeiro que um número
 * redondo inventado.
 */

/** O recorte mínimo de `eventos` que esta conta precisa. */
export interface SaidaParaTripulante {
  tipo: string
  criado_por: string | null
  hora_saida: string | null
  hora_retorno: string | null
}

export interface UsoDoTripulante {
  saidas: number
  horasNoMar: number
}

/**
 * Índice usuário → { saídas, horas no mar }, só com saídas (`tipo ===
 * "navegacao"`) que têm autor. Evento sem `criado_por` (registro antigo,
 * autor apagado) não é atribuído a ninguém — atribuir ao acaso seria
 * inventar currículo.
 */
export function usoPorTripulante(eventos: readonly SaidaParaTripulante[]): Map<string, UsoDoTripulante> {
  const indice = new Map<string, UsoDoTripulante>()
  for (const e of eventos) {
    if (e.tipo !== "navegacao" || e.criado_por == null) continue
    const atual = indice.get(e.criado_por) ?? { saidas: 0, horasNoMar: 0 }
    atual.saidas++
    const duracao = duracaoHoras(e.hora_saida, e.hora_retorno)
    if (duracao != null) atual.horasNoMar += duracao
    indice.set(e.criado_por, atual)
  }
  return indice
}

/**
 * Como o chip "No mar" escreve as horas: inteiro arredondado + " h".
 * Zero hora REGISTRADA com saídas existentes vira "—" (as saídas não têm
 * horários preenchidos — dizer "0 h" afirmaria que o barco saiu e voltou no
 * mesmo instante).
 */
export function horasNoMarCurto(uso: UsoDoTripulante): string {
  if (uso.horasNoMar <= 0) return "—"
  return `${Math.round(uso.horasNoMar)} h`
}

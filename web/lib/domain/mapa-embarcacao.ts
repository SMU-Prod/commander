import type { Equipamento } from "@/lib/db/types"

/**
 * MAPA DA EMBARCAÇÃO (onda 61) — o dado da zona física.
 * Spec `docs/superpowers/specs/2026-08-16-mapa-embarcacao-design.md` §2.
 *
 * A pergunta que este módulo responde é "ONDE no barco?" — ortogonal ao
 * "o que é" (`equipamentos.tipo`) e ao "como está" (farol da Saúde). No
 * banco é o enum `zona_embarcacao` e a coluna nullable `equipamentos.zona`
 * (migration 055); aqui é a fonte única de vocabulário: a lista, a ordem
 * e os rótulos. Nenhuma tela escreve esses nomes à mão.
 *
 * Regra pura, como a casa manda: nada aqui consulta banco, sessão ou
 * relógio.
 */

/** As sete zonas do spec §2.1 — fixas até doer (zonas customizadas por
 *  barco ficaram explicitamente fora do V1). Espelha o enum
 *  `zona_embarcacao` do banco, valor por valor. */
export type ZonaEmbarcacao =
  | "proa"
  | "conves"
  | "casaria"
  | "flybridge"
  | "praca_de_maquinas"
  | "popa"
  | "casco"

/** Ordem de exibição: espacial, da proa pra popa — a mesma leitura do
 *  corte lateral (§3.1, "PROA ← → POPA") — com o casco por último porque
 *  ele fica embaixo do barco inteiro, não entre uma zona e outra. */
export const ZONAS = [
  "proa",
  "conves",
  "casaria",
  "flybridge",
  "praca_de_maquinas",
  "popa",
  "casco",
] as const satisfies readonly ZonaEmbarcacao[]

/** Rótulos do spec §2.1, palavra por palavra — vocabulário de quem vive
 *  o barco, não de formulário de estaleiro. */
export const ROTULO_ZONA: Record<ZonaEmbarcacao, string> = {
  proa: "Proa",
  conves: "Convés",
  casaria: "Casaria",
  flybridge: "Flybridge",
  praca_de_maquinas: "Praça de máquinas",
  popa: "Popa",
  casco: "Casco",
}

/**
 * Palpite de zona a partir do tipo do equipamento — motores, geradores e
 * baterias moram na praça de máquinas em qualquer motor yacht; painel
 * elétrico interno mora na casaria (§2.1, coluna "o que mora lá").
 *
 * É SUGESTÃO de pré-seleção pro select do formulário, nada mais: só vira
 * dado quando o dono salva o formulário. Ninguém varre o banco aplicando
 * isto — "não se inventa dado" (§2.1), e é por isso que `outro` devolve
 * `null`: sem convicção, o select fica em "ainda não sei".
 */
export function sugestaoDeZona(tipo: Equipamento["tipo"]): ZonaEmbarcacao | null {
  switch (tipo) {
    case "motor":
    case "gerador":
    case "bateria":
      return "praca_de_maquinas"
    case "painel":
      return "casaria"
    default:
      return null
  }
}

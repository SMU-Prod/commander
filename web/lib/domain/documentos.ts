/**
 * Documentos e vencimentos (canvas tela-3d) — funções de APRESENTAÇÃO da
 * tela /barco/documentos. Quem decide estado é `calcularSemaforo`
 * (lib/domain/semaforo.ts), a única régua; aqui só se escreve a frase do
 * subtítulo e se escolhe qual vencido merece o cartão de destaque.
 */
import type { ResultadoCalc } from "@/lib/domain/semaforo"

/**
 * O subtítulo do cabeçalho: "8 documentos · 1 vencido, 1 na margem." —
 * conta TUDO que mora na tela (com vencimento + arquivos avulsos) e diz só
 * os problemas. Sem problema nenhum mas com algo sendo acompanhado, diz
 * "nenhum vencido" (o que sabemos de verdade — nunca um "em dia" que
 * incluiria arquivos avulsos que não têm estado). Sem nada acompanhado, a
 * frase para na contagem. `null` sem documento nenhum: o estado vazio da
 * lista já fala.
 */
export function resumoDosDocumentos(
  total: number,
  acompanhados: number,
  vencidos: number,
  naMargem: number,
): string | null {
  if (total === 0) return null
  const cabeca = total === 1 ? "1 documento" : `${total} documentos`
  const partes: string[] = []
  if (vencidos > 0) partes.push(vencidos === 1 ? "1 vencido" : `${vencidos} vencidos`)
  if (naMargem > 0) partes.push(`${naMargem} na margem`)
  if (partes.length > 0) return `${cabeca} · ${partes.join(", ")}.`
  if (acompanhados > 0) return `${cabeca} · nenhum vencido.`
  return `${cabeca}.`
}

/**
 * Qual vencido sai da lista e vira o cartão de destaque (canvas: "o único
 * documento que exige algo de você hoje"): o vencido HÁ MAIS TEMPO — é o
 * que está descoberto há mais dias. Empate ou sem dias conhecidos, o
 * primeiro da lista na ordem em que veio (determinístico). `null` quando
 * nenhum venceu — a tela não inventa destaque.
 */
export function indiceDoDestaque(resultados: ResultadoCalc[]): number | null {
  let indice: number | null = null
  let piorDias = Number.POSITIVE_INFINITY
  resultados.forEach((r, i) => {
    if (r.status !== "vencido") return
    const dias = r.diasRestantes ?? 0
    if (indice === null || dias < piorDias) {
      indice = i
      piorDias = dias
    }
  })
  return indice
}

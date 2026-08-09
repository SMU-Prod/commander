const SALTO_MAXIMO_H = 500

export function validarLeitura(
  nova: number,
  atual: number | null,
): { ok: true } | { ok: false; erro: string } {
  if (!Number.isFinite(nova) || nova <= 0) {
    return { ok: false, erro: "Informe um número de horas válido." }
  }
  if (atual != null && nova < atual) {
    return { ok: false, erro: `A leitura (${nova} h) é menor que a atual (${atual} h). Horímetro não anda para trás.` }
  }
  if (atual != null && nova - atual > SALTO_MAXIMO_H) {
    return { ok: false, erro: `Salto de ${Math.round(nova - atual)} h de uma vez — confira a leitura.` }
  }
  return { ok: true }
}

/**
 * Decide se uma leitura de horas deve virar a leitura oficial do equipamento
 * (`equipamentos.horas_atuais`) — horímetro não anda para trás. Diferente de
 * `validarLeitura` (usada em "Voltei ao mar", que também barra saltos grandes
 * de uma vez): aqui a leitura pode vir de um evento do diário registrado com
 * meses de intervalo do anterior, então um salto grande é normal, não
 * suspeito — só a regressão é. Leitura igual à atual também propaga (confirma
 * que a informação foi conferida agora, atualiza `ultima_leitura`).
 */
export function devePropagarLeitura(nova: number, atual: number | null): boolean {
  return atual == null || nova >= atual
}

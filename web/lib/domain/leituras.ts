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

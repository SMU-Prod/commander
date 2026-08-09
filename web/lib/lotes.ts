/**
 * Processa uma lista em lotes concorrentes, sem série: cada lote roda com
 * `Promise.allSettled` (o mesmo padrão que `alertas/disparar` já usa pra
 * pushes) e o lote seguinte só começa depois do anterior. Uma falha
 * individual nunca aborta o lote nem os demais itens — quem chama decide o
 * que fazer com sucesso/erro dentro de `tarefa`.
 *
 * Usado pelos crons (`relatorio/mensal`, `alertas/disparar`) pra trocar um
 * `await` em série (um usuário/e-mail por vez, ~78 s pra 100 barcos) por
 * lotes paralelos — sem lotes, `Promise.allSettled` numa lista grande de
 * uma vez só poderia estourar limite de taxa das APIs externas (Resend).
 */
export async function emLotes<T>(
  itens: T[],
  tamanhoLote: number,
  tarefa: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < itens.length; i += tamanhoLote) {
    const lote = itens.slice(i, i + tamanhoLote)
    await Promise.allSettled(lote.map(tarefa))
  }
}

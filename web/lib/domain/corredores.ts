import type { PontoTrilha } from "@/lib/domain/geo"
import { RESOLUCAO_CELULA_CORREDOR_M } from "@/lib/domain/rota"
import { celulaId } from "@/lib/domain/sondagem"

/** Converte os pontos de uma trilha em celulas UNICAS de corredor (onda 17)
 *  — uma trilha parada 10 minutos na mesma baia nao pode contar como 10
 *  passagens, so 1. Chave e resolucao IDENTICAS a `intensidadeCorredorEm`
 *  em lib/domain/rota.ts (RESOLUCAO_CELULA_CORREDOR_M), senao o A* nunca
 *  encontraria o que a trilha gravou.
 *
 * Fica num modulo `domain` (sem `"use server"`) de proposito: e funcao pura
 * e sincrona, e um arquivo `"use server"` (web/lib/acoes/trilha.ts) so pode
 * exportar async functions — Next.js trata TODO export de um modulo assim
 * como Server Action. Reusada por `salvarTrilha` (trilha ao vivo) e pela
 * importacao de GPX (onda 21, web/lib/acoes/importar-gpx.ts) — mesmo
 * caminho, nunca duas implementacoes. */
export function celulasUnicasDaTrilha(pontos: PontoTrilha[]): { celulaId: string; lat: number; lon: number }[] {
  const porCelula = new Map<string, { lat: number; lon: number }>()
  for (const p of pontos) {
    const id = celulaId(p.la, p.lo, RESOLUCAO_CELULA_CORREDOR_M)
    if (!porCelula.has(id)) porCelula.set(id, { lat: p.la, lon: p.lo })
  }
  return Array.from(porCelula, ([id, c]) => ({ celulaId: id, lat: c.lat, lon: c.lon }))
}

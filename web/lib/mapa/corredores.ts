import type { Bbox, CorredoresPorCelula } from "@/lib/domain/rota"
import type { CorredorAgregado } from "@/lib/db/types"

/** Passagens a partir das quais a intensidade satura em 1.0 (redutor de
 *  custo maximo, ver REDUTOR_CORREDOR_MAXIMO em lib/domain/rota.ts). 5
 *  embarcacoes DIFERENTES passando pela MESMA celula (nao a mesma saida —
 *  uma unica trilha ja incrementa no maximo 1 por celula, ver
 *  web/lib/acoes/trilha.ts) e evidencia solida o bastante pra nao precisar
 *  de mais confirmacao antes do redutor bater no teto. Numero pequeno de
 *  proposito: exigir muito mais atrasaria o corredor aparecer justo nas
 *  celulas mais uteis — as recem-mapeadas, com poucas passagens ainda. */
const PASSAGENS_SATURACAO = 5

function normalizarIntensidade(passagens: number): number {
  return Math.max(0, Math.min(1, passagens / PASSAGENS_SATURACAO))
}

/** Busca os corredores conhecidos no bbox da viagem — endpoint leve
 *  (`/api/corredores`, ver web/app/api/corredores/route.ts) que consulta o
 *  agregado ANONIMO por celula (migration 029). Falha de rede/servidor
 *  NUNCA aparece na tela: devolve um `CorredoresPorCelula` VAZIO
 *  (equivalente a "sem corredores"), e o A* roda exatamente como sem essa
 *  onda — mesma filosofia de degrade silencioso de `carregarGrade()` em
 *  lib/mapa/mascara.ts. */
export async function buscarCorredores(bbox: Bbox): Promise<CorredoresPorCelula> {
  try {
    const params = new URLSearchParams({
      lngMin: String(bbox.lngMin),
      latMin: String(bbox.latMin),
      lngMax: String(bbox.lngMax),
      latMax: String(bbox.latMax),
    })
    const resposta = await fetch(`/api/corredores?${params.toString()}`)
    if (!resposta.ok) return { porCelula: new Map() }

    const linhas = (await resposta.json()) as CorredorAgregado[]
    const porCelula = new Map<string, number>()
    if (Array.isArray(linhas)) {
      for (const l of linhas) {
        if (typeof l?.celula_id === "string" && typeof l?.passagens === "number") {
          porCelula.set(l.celula_id, normalizarIntensidade(l.passagens))
        }
      }
    }
    return { porCelula }
  } catch {
    return { porCelula: new Map() }
  }
}

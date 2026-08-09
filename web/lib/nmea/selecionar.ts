import { criarTransporteNativo, transporteNativoDisponivel } from "./nativo"
import { criarTransporteSignalK, URL_SIGNALK_PADRAO } from "./signalk"
import type { TransporteProfundidade } from "./transporte"

/**
 * Seletor de transporte (onda 14) — usa o nativo quando disponível, senão
 * cai pro Signal K (WebSocket, onda 13). Transparente pra tela:
 * `sondagem-painel.tsx` chama só `criarTransporteAtivo`, nunca decide entre
 * nativo/Signal K sozinho. Hoje `transporteNativoDisponivel()` é sempre
 * `false` (stub, ver `nativo.ts`), então isto sempre devolve Signal K; no
 * dia em que o shell Capacitor preencher o stub, o MESMO código passa a usar
 * o nativo automaticamente, sem tocar na tela nem neste arquivo.
 */
export function criarTransporteAtivo(urlSignalK: string = URL_SIGNALK_PADRAO): TransporteProfundidade {
  if (transporteNativoDisponivel()) {
    const nativo = criarTransporteNativo()
    if (nativo) return nativo
  }
  return criarTransporteSignalK(urlSignalK)
}

/** Qual transporte `criarTransporteAtivo` de fato vai usar agora — pra tela
 *  poder rotular certo ("via app nativo" vs "via Signal K") sem
 *  reimplementar a mesma decisão em dois lugares. */
export function transporteAtivoNome(): "nativo" | "signalk" {
  return transporteNativoDisponivel() ? "nativo" : "signalk"
}

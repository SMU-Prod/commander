import type { TransporteProfundidade } from "./transporte"

/**
 * Stub do transporte nativo (onda 14) — CONTRATO entre agentes: outro
 * agente está escrevendo o plugin Capacitor (socket TCP/UDP pro gateway
 * WiFi do ecobatímetro, decodificando NMEA 0183 cru — DPT/DBT) em paralelo
 * e vai substituir o miolo deste arquivo. As DUAS assinaturas abaixo são o
 * contrato entre as duas ondas — não mudar sem combinar; `selecionar.ts` e
 * a tela (`sondagem-painel.tsx`) dependem exatamente delas.
 *
 * Por que isto não é apenas "TODO": no navegador puro (sem shell
 * Capacitor), JavaScript de página não abre socket TCP/UDP cru — por isso
 * a onda 13 implementou Signal K (WebSocket) primeiro, e por isso este
 * stub é HONESTO — sempre indisponível no web, nunca finge ter um
 * transporte que não existe (mesma régua da onda 13 pra sondagem em si:
 * nunca sugerir algo que o app não pode entregar de verdade).
 */

/** `false` no navegador — sempre, hoje. Quando o outro agente terminar o
 *  plugin Capacitor, esta função passa a checar a plataforma nativa (ex.:
 *  `Capacitor.isNativePlatform()` + o plugin registrado) — a assinatura
 *  (sem parâmetros, devolve `boolean`) não muda. */
export function transporteNativoDisponivel(): boolean {
  return false
}

/** `null` enquanto o transporte nativo não existir — mesma regra de
 *  `transporteNativoDisponivel`. Quando o plugin Capacitor estiver pronto,
 *  esta função passa a devolver um `TransporteProfundidade` que reusa
 *  `parseSentencaProfundidade` (`web/lib/domain/sondagem.ts`) pra decodificar
 *  as sentenças cruas do gateway TCP/UDP — o painel de sondagem nunca muda
 *  uma linha, porque só conhece a interface `TransporteProfundidade`
 *  (`transporte.ts`), nunca o transporte concreto. */
export function criarTransporteNativo(): TransporteProfundidade | null {
  return null
}

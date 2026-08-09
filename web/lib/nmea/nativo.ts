import { Capacitor } from "@capacitor/core"
import { criarTransporteNativoCapacitor } from "./nativo-capacitor"
import type { TransporteProfundidade } from "./transporte"

/**
 * Onda 14 — ponto de entrada do transporte nativo, contrato com quem
 * consome (painel de sondagem / fila offline, `web/lib/nmea/fila.ts` e
 * `components/mapa/sondagem-painel.tsx` — nao mexidos nesta onda).
 * `transporteNativoDisponivel` e `criarTransporteNativo` sao as DUAS
 * assinaturas combinadas entre ondas — nao mudam.
 *
 * A implementacao de verdade (socket TCP/UDP contra o gateway WiFi NMEA
 * 0183, plugin Capacitor `NmeaSocket`) mora em `./nativo-capacitor.ts`;
 * este arquivo so decide QUANDO delegar pra ela.
 */

/** `true` quando o app roda dentro do shell nativo Capacitor
 *  (Android/iOS empacotado — onda 14, ver `capacitor.config.ts`). So
 *  nesse ambiente o plugin `NmeaSocket` existe de verdade; num navegador
 *  comum (incluindo o PWA instalado) isto e sempre `false`. */
export function transporteNativoDisponivel(): boolean {
  return Capacitor.isNativePlatform()
}

/** Cria o transporte nativo com a configuracao padrao (UDP broadcast,
 *  porta 10110 — ver `PORTA_PADRAO_NMEA` em `./nmea-socket-plugin.ts`) ou
 *  devolve `null` fora do shell Capacitor. Sem parametro de proposito:
 *  quem decide host/porta customizados (modo TCP, porta diferente) chama
 *  `criarTransporteNativoCapacitor` direto — esta funcao existe pro caso
 *  comum, pra bater com a assinatura combinada entre ondas. */
export function criarTransporteNativo(): TransporteProfundidade | null {
  if (!transporteNativoDisponivel()) return null
  return criarTransporteNativoCapacitor()
}

import { registerPlugin } from "@capacitor/core"
import type { Plugin } from "@capacitor/core"

/**
 * Onda 14 — tipo TS do plugin nativo `NmeaSocket` (Capacitor). Espelha
 * exatamente a ponte JS dos dois lados nativos:
 * `android/app/src/main/java/br/com/soumardivers/commander/nmea/NmeaSocketPlugin.java`
 * e `ios/App/App/NmeaSocket/NmeaSocketPlugin.swift`.
 *
 * So existe DENTRO do shell Capacitor — num navegador comum
 * `registerPlugin` ainda devolve um objeto (nunca `undefined`), mas
 * chamar qualquer metodo rejeita a Promise ("not implemented"). Quem usa
 * este arquivo (`nativo-capacitor.ts`) so chama depois de confirmar
 * `Capacitor.isNativePlatform()` — ver `./nativo.ts`.
 */

/** UDP: gateway manda em broadcast pra rede do barco inteira, o app so
 *  escuta (nao precisa saber o IP do gateway) — modo mais comum em
 *  gateways WiFi NMEA recreativos. TCP: cliente conecta direto no IP do
 *  gateway (exige `host`) — alternativa ponto-a-ponto que alguns
 *  fabricantes preferem. */
export type ModoSocketNmea = "udp" | "tcp"

/** 10110 e a porta registrada na IANA pro servico "nmea-0183" (TCP e UDP)
 *  e a que a maioria dos gateways WiFi NMEA recreativos (Yacht Devices,
 *  Digital Yacht, Actisense, Vesper) usa por padrao — mas nao e universal
 *  (alguns fabricantes usam 2000, 39150 ou 60001), por isso e so o
 *  DEFAULT: `conectar` sempre aceita sobrescrever via `porta`. */
export const PORTA_PADRAO_NMEA = 10110

export interface OpcoesConectarNmeaSocket {
  modo: ModoSocketNmea
  /** Obrigatorio em modo "tcp" (IP do gateway); ignorado em "udp". */
  host?: string
  /** Default: `PORTA_PADRAO_NMEA` (10110) quando omitido. */
  porta?: number
}

export interface EventoLinhaNmeaSocket {
  /** Uma sentenca NMEA 0183 crua, como chegou no socket — quem consome
   *  decide o que fazer (`parseSentencaProfundidade`, aqui em
   *  `nativo-capacitor.ts`; sentencas que nao sao DPT/DBT sao
   *  descartadas em silencio pelo parser, nao por este plugin). */
  linha: string
}

export interface EventoStatusNmeaSocket {
  status: "conectando" | "conectado" | "desconectado" | "erro"
  /** Detalhe da excecao nativa quando `status === "erro"`; ausente nos
   *  outros casos. */
  mensagem?: string
}

export interface NmeaSocketPlugin {
  /** Encerra qualquer conexao anterior deste plugin e sobe uma nova.
   *  Resolve assim que a tentativa comeca — o resultado de fato (conectou
   *  ou nao) chega depois pelo evento "status", nunca por esta Promise. */
  conectar(opcoes: OpcoesConectarNmeaSocket): Promise<void>
  /** Fecha o socket, mata a thread/queue nativa e emite "status":
   *  "desconectado" uma ultima vez (se havia algo rodando). Idempotente. */
  desconectar(): Promise<void>
  addListener(eventName: "linha", listenerFunc: (evento: EventoLinhaNmeaSocket) => void): ReturnType<Plugin["addListener"]>
  addListener(eventName: "status", listenerFunc: (evento: EventoStatusNmeaSocket) => void): ReturnType<Plugin["addListener"]>
  removeAllListeners(): Promise<void>
}

export const NmeaSocket = registerPlugin<NmeaSocketPlugin>("NmeaSocket")

/**
 * Onda 34 — Commander Connect: camada de quadro do NMEA 2000.
 *
 * Diferente do 0183 (`web/lib/domain/sondagem.ts`), que é texto ASCII com
 * checksum, o NMEA 2000 é BINÁRIO sobre CAN bus, organizado em PGNs
 * (Parameter Group Numbers). Este arquivo decodifica só a "casca" do
 * protocolo — de onde vem o PGN/prioridade/origem de um quadro CAN, e como
 * remontar um PGN que não cabe em 8 bytes (fast packet) — nunca o
 * SIGNIFICADO dos bytes de dado, que é `./n2k-motor.ts`.
 *
 * Fonte pesquisada (a especificação oficial da NMEA é paga/fechada; esta é
 * a referência pública de fato usada por todo o ecossistema open-source
 * NMEA 2000): canboat (github.com/canboat/canboat, MIT), arquivo
 * `docs/canboat.html`, seção "Packet framing", e a estrutura de
 * Priority/Reserved/Data-Page/PDU-Format/PDU-Specific/Source-Address do
 * identificador CAN de 29 bits, que o NMEA 2000 herda do J1939/ISO 11783
 * (mesma doc, seção "NMEA 2000 and CAN Bus"). Conferido em 14/08/2026.
 */

/** Um quadro CAN físico, como um adaptador (USB-CAN, gateway serial etc.)
 *  entregaria: identificador estendido de 29 bits + até 8 bytes de dado
 *  (limite do CAN 2.0B clássico — é por isso que PGNs maiores precisam de
 *  fast packet, ver `criarMontadorFastPacket`). */
export interface QuadroCan {
  idCan: number
  dados: number[]
}

export interface CampoIdCan {
  /** 0 (mais urgente) a 7 — não usado pelos decodificadores de motor desta
   *  onda, mas faz parte do identificador e é útil pra quem for logar/
   *  depurar quadros crus. */
  prioridade: number
  pgn: number
  /** Endereço (0-255) do dispositivo que enviou o quadro na rede N2K. */
  origem: number
}

/**
 * Extrai prioridade/PGN/origem do identificador CAN de 29 bits.
 *
 * Layout (MSB→LSB, canboat "NMEA 2000 and CAN Bus"):
 * `PPP R DP FFFFFFFF SSSSSSSS AAAAAAAA` — 3 bits de prioridade, 1
 * reservado (sempre 0 em N2K), 1 de Data Page, 8 de PDU Format, 8 de PDU
 * Specific, 8 de endereço de origem.
 *
 * Quando PDU Format < 240 (0xF0) a mensagem é endereçada (PDU1) e o PDU
 * Specific é o endereço de DESTINO — não faz parte do PGN. Quando PDU
 * Format >= 240 a mensagem é broadcast (PDU2) e o PDU Specific vira
 * "group extension", parte do PGN. As três PGNs decodificadas nesta onda
 * (127488, 127489, 127505) são todas PDU2/broadcast.
 */
export function decodificarIdCan(idCan: number): CampoIdCan {
  const prioridade = (idCan >> 26) & 0x7
  const dataPage = (idCan >> 24) & 0x1
  const pduFormat = (idCan >> 16) & 0xff
  const pduSpecific = (idCan >> 8) & 0xff
  const origem = idCan & 0xff
  const pgn = pduFormat < 240 ? (dataPage << 16) | (pduFormat << 8) : (dataPage << 16) | (pduFormat << 8) | pduSpecific
  return { prioridade, pgn, origem }
}

/** PGNs que este parser decodifica e que exigem remontagem de fast packet
 *  (dado > 8 bytes). Fora desta lista, um quadro CAN já É a mensagem N2K
 *  inteira — verdade pras outras duas PGNs desta onda (127488 tem 8 bytes,
 *  127505 tem 8 bytes; só 127489, com 26, precisa de fast packet). */
const PGNS_FAST_PACKET = new Set([127489])

export interface QuadroN2K extends CampoIdCan {
  /** Dado já remontado (fast packet) ou direto do quadro único. */
  dados: Uint8Array
}

interface SequenciaEmAndamento {
  total: number
  buffer: number[]
  sequencia: number
}

/**
 * Remonta quadros fast packet (canboat, "Packet framing"): o 1º quadro da
 * mensagem tem byte 0 = contador de sequência (3 bits altos) + contador de
 * quadro (5 bits baixos, sempre 0 no 1º) e byte 1 = tamanho TOTAL dos dados
 * da mensagem completa, seguidos de até 6 bytes de dado; quadros seguintes
 * têm só o byte 0 (mesmo contador de sequência, contador de quadro
 * incrementando) + até 7 bytes de dado. Até 32 quadros, no máximo
 * 6 + 31×7 = 223 bytes.
 *
 * Estado por instância — cada transporte (simulador, gateway real) precisa
 * do seu próprio montador; quadros de PGNs/origens diferentes são
 * remontados em paralelo, sem interferir uns nos outros.
 *
 * Sem reconhecimento no fast packet: se um quadro de continuação se
 * perder, a sequência fica incompleta e nunca é entregue — mesma postura
 * documentada no canboat ("o receptor tem que esperar a próxima
 * transmissão"). Esta implementação nunca lança nem entrega dado parcial;
 * só devolve `null` até a sequência fechar.
 */
export function criarMontadorFastPacket() {
  const emAndamento = new Map<string, SequenciaEmAndamento>()

  return {
    /** Processa um quadro CAN cru. Devolve o `QuadroN2K` completo quando
     *  (e só quando) a mensagem terminar de chegar; `null` enquanto uma
     *  mensagem de PGN de fast packet ainda está em andamento, ou quando o
     *  quadro é ruído (continuação sem início correspondente). */
    processar(quadro: QuadroCan): QuadroN2K | null {
      const campos = decodificarIdCan(quadro.idCan)

      if (!PGNS_FAST_PACKET.has(campos.pgn)) {
        return { ...campos, dados: Uint8Array.from(quadro.dados) }
      }

      const chave = `${campos.pgn}:${campos.origem}`
      const contadorSequencia = (quadro.dados[0] >> 5) & 0x7
      const contadorQuadro = quadro.dados[0] & 0x1f

      if (contadorQuadro === 0) {
        // Início de mensagem — substitui qualquer sequência anterior desta
        // PGN/origem que não tenha fechado (quadro de continuação perdido
        // no meio é normal em fast packet, sem reconhecimento).
        emAndamento.set(chave, { total: quadro.dados[1], buffer: quadro.dados.slice(2), sequencia: contadorSequencia })
        return null
      }

      const estado = emAndamento.get(chave)
      if (!estado || estado.sequencia !== contadorSequencia) {
        // Continuação sem início correspondente (perdido) ou de uma
        // sequência antiga já substituída — descarta em silêncio, não há
        // como remontar sem saber o tamanho total.
        return null
      }
      estado.buffer.push(...quadro.dados.slice(1))

      if (estado.buffer.length < estado.total) return null

      emAndamento.delete(chave)
      return { ...campos, dados: Uint8Array.from(estado.buffer.slice(0, estado.total)) }
    },
  }
}

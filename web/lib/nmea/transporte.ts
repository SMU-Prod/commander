/**
 * Ponto de extensao da sondagem colaborativa (onda 13): qualquer jeito de
 * obter profundidade de um ecobatimetro implementa esta MESMA interface.
 *
 * Hoje so existe `criarTransporteSignalK` (`./signalk.ts`) — WebSocket pro
 * servidor Signal K a bordo, funciona no PWA sem instalar nada a mais. O
 * ecobatimetro tambem fala NMEA 0183 (sentencas DPT/DBT) por um gateway
 * WiFi via socket TCP/UDP — esse caminho EXIGE app nativo (React
 * Native/Capacitor; navegador nao abre socket TCP/UDP cru) e ainda nao
 * existe. Quando existir, um `criarTransporteNativo` implementa esta mesma
 * `TransporteProfundidade`, reusando o parser NMEA de
 * `web/lib/domain/sondagem.ts` (parseSentencaProfundidade) pra decodificar
 * as sentencas — e o painel de sondagem (`components/mapa/`) nao muda uma
 * linha: ele so conhece esta interface, nunca o transporte concreto.
 */

/** Uma leitura de profundidade ja normalizada pro formato que o dominio
 *  espera (`CandidatoLeituraSondagem` em `web/lib/domain/sondagem.ts`) —
 *  cada transporte concreto converte o que recebe (JSON do Signal K, NMEA
 *  cru do socket nativo) pra este formato comum. */
export interface LeituraTransporte {
  profundidadeM: number
  /** Posicao no momento da leitura — `null` quando o transporte ainda nao
   *  recebeu nenhuma posicao (ex.: acabou de conectar). */
  lat: number | null
  lon: number | null
  /** Idade da posicao acima, em segundos, medida no instante em que a
   *  leitura de profundidade chegou — ver `validarLeituraSondagem`. */
  idadePosicaoS: number
  /** SOG em nos, quando o transporte souber; `null` caso contrario (nem
   *  toda instalacao expoe velocidade). */
  velocidadeKt: number | null
  fonte: "signalk" | "nativo"
  /** epoch em milissegundos de quando o transporte recebeu a leitura. */
  medidoEm: number
}

export type StatusTransporte = "conectando" | "conectado" | "desconectado" | "erro"

export interface TransporteProfundidade {
  /** Abre a conexao e comeca a entregar leituras. `aoReceberLeitura` dispara
   *  a cada leitura de profundidade nova; `aoMudarStatus` informa o estado
   *  da conexao pra UI poder mostrar sem travar a tela em nenhum estado
   *  (reconecta sozinho em caso de queda). Devolve uma funcao de limpeza —
   *  chamar ao desligar a coleta ou desmontar a tela. */
  conectar(
    aoReceberLeitura: (leitura: LeituraTransporte) => void,
    aoMudarStatus: (status: StatusTransporte) => void,
  ): () => void
}

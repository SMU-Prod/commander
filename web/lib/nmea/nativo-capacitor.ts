import { Geolocation } from "@capacitor/geolocation"
import { msParaNos } from "@/lib/domain/navegacao"
import { parseSentencaProfundidade } from "@/lib/domain/sondagem"
import { NmeaSocket, PORTA_PADRAO_NMEA, type ModoSocketNmea } from "./nmea-socket-plugin"
import type { LeituraTransporte, StatusTransporte, TransporteProfundidade } from "./transporte"

/**
 * Onda 14 — implementacao de verdade do transporte nativo (socket TCP/UDP
 * pro gateway WiFi NMEA 0183 do ecobatimetro, via o plugin Capacitor
 * `NmeaSocket` — ver `./nmea-socket-plugin.ts` e o codigo nativo em
 * `android/.../nmea/` e `ios/App/App/NmeaSocket/`).
 *
 * DUAS fontes de dado, uma leitura: o gateway NMEA entrega SO as sentencas
 * de profundidade (nem todo gateway multiplexa o barramento NMEA inteiro
 * do barco pro WiFi — muitos so repassam DPT/DBT); a posicao/velocidade
 * usadas pra carimbar cada leitura vem do PROPRIO GPS do aparelho
 * (`@capacitor/geolocation`, sempre disponivel em qualquer celular,
 * dispensando depender do gateway tambem repassar GGA/RMC). Mesmo
 * desenho conceitual do transporte Signal K (`./signalk.ts`): mantem a
 * ULTIMA posicao/velocidade conhecida num closure e so emite
 * `LeituraTransporte` quando uma profundidade nova chega.
 *
 * NAO TESTADO EM DEVICE — nesta maquina nao ha Android SDK/Xcode (ver
 * `docs/APP-NATIVO.md`). O parser (`parseSentencaProfundidade`) e testado
 * de verdade contra `scripts/simular-nmea.mjs`; a integracao com o
 * plugin nativo em si so foi revisada por leitura.
 */

export interface ConfigTransporteNativo {
  /** Default: "udp" (broadcast — o modo mais comum de gateway, nao exige
   *  saber o IP dele; ver `./nmea-socket-plugin.ts`). */
  modo?: ModoSocketNmea
  /** Obrigatorio quando `modo === "tcp"`. */
  host?: string
  /** Default: `PORTA_PADRAO_NMEA` (10110). */
  porta?: number
}

const OPCOES_GPS = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 5_000,
}

/** Cria o transporte nativo. `web/lib/nmea/nativo.ts` e quem decide QUANDO
 *  chamar isto (so dentro do shell Capacitor — `Capacitor.isNativePlatform()`)
 *  e delega pra ca; esta funcao em si nao verifica plataforma nenhuma,
 *  fica livre pra configurar (`modo`/`host`/`porta`) em cenarios que
 *  chamem direto (ex.: testes). */
export function criarTransporteNativoCapacitor(config: ConfigTransporteNativo = {}): TransporteProfundidade {
  const modo: ModoSocketNmea = config.modo ?? "udp"
  const host = config.host
  const porta = config.porta ?? PORTA_PADRAO_NMEA

  return {
    conectar(aoReceberLeitura: (leitura: LeituraTransporte) => void, aoMudarStatus: (status: StatusTransporte) => void) {
      let cancelado = false

      let ultimaPosicao: { lat: number; lon: number; recebidaEm: number } | null = null
      let ultimaVelocidadeKt: number | null = null

      let watchIdGps: string | null = null
      let removerListenerLinha: (() => void) | null = null
      let removerListenerStatus: (() => void) | null = null

      function statusNativoParaTransporte(status: string): StatusTransporte {
        // O plugin nativo ja fala a mesma nomenclatura da interface
        // (ver EventoStatusNmeaSocket em ./nmea-socket-plugin.ts) — esta
        // funcao so existe pra blindar contra um valor inesperado vindo
        // do lado nativo (nunca confiar cegamente em string cruzando a
        // ponte JS/nativo) sem quebrar a UI.
        if (status === "conectando" || status === "conectado" || status === "desconectado" || status === "erro") {
          return status
        }
        return "erro"
      }

      async function iniciarGps() {
        try {
          watchIdGps = await Geolocation.watchPosition(OPCOES_GPS, (posicao, erro) => {
            if (cancelado || erro || !posicao) return
            ultimaPosicao = {
              lat: posicao.coords.latitude,
              lon: posicao.coords.longitude,
              recebidaEm: Date.now(),
            }
            ultimaVelocidadeKt = msParaNos(posicao.coords.speed)
          })
        } catch {
          // Sem permissao de localizacao (usuario negou) ou GPS
          // desligado: o transporte SEGUE funcionando pra profundidade —
          // so entrega lat/lon null em cada leitura, e
          // `validarLeituraSondagem` (web/lib/domain/sondagem.ts) descarta
          // por falta de posicao. Nao trava a tela, nao lanca erro.
        }
      }

      async function iniciarSocket() {
        const listenerLinha = await NmeaSocket.addListener("linha", ({ linha }) => {
          if (cancelado) return
          const leitura = parseSentencaProfundidade(linha)
          if (!leitura) return
          const agora = Date.now()
          const idadePosicaoS = ultimaPosicao ? (agora - ultimaPosicao.recebidaEm) / 1000 : Number.POSITIVE_INFINITY
          aoReceberLeitura({
            profundidadeM: leitura.profundidadeM,
            lat: ultimaPosicao?.lat ?? null,
            lon: ultimaPosicao?.lon ?? null,
            idadePosicaoS,
            velocidadeKt: ultimaVelocidadeKt,
            fonte: "nativo",
            medidoEm: agora,
          })
        })
        removerListenerLinha = () => {
          void listenerLinha.remove()
        }

        const listenerStatus = await NmeaSocket.addListener("status", ({ status }) => {
          if (cancelado) return
          aoMudarStatus(statusNativoParaTransporte(status))
        })
        removerListenerStatus = () => {
          void listenerStatus.remove()
        }

        if (cancelado) return
        try {
          aoMudarStatus("conectando")
          await NmeaSocket.conectar({ modo, host, porta })
        } catch {
          if (!cancelado) aoMudarStatus("erro")
        }
      }

      void iniciarGps()
      void iniciarSocket()

      return () => {
        cancelado = true
        removerListenerLinha?.()
        removerListenerStatus?.()
        void NmeaSocket.desconectar().catch(() => {
          // Ja desconectado/plugin indisponivel — nada a fazer.
        })
        if (watchIdGps) {
          void Geolocation.clearWatch({ id: watchIdGps }).catch(() => {})
        }
      }
    },
  }
}

import { msParaNos } from "@/lib/domain/navegacao"
import type { LeituraTransporte, StatusTransporte, TransporteProfundidade } from "./transporte"

/**
 * Transporte Signal K (onda 13) — implementa `TransporteProfundidade` via
 * WebSocket pro Signal K Server a bordo (protocolo de assinatura pesquisado
 * na spec publica: `signalk.org/specification/.../subscription_protocol`).
 *
 * Signal K ja entrega os valores de profundidade convertidos pra metros em
 * JSON (nao manda NMEA cru nesse canal) — por isso este transporte NAO usa
 * o parser de `web/lib/domain/sondagem.ts` (`parseSentencaProfundidade`);
 * esse parser fica reservado pro transporte nativo futuro, que vai receber
 * as sentencas DPT/DBT cruas de um gateway TCP/UDP.
 */

/** "signalk.local" e o nome mDNS que a maioria das instalacoes (Signal K
 *  Server, OpenPlotter) anuncia sozinha na rede WiFi do barco — funciona
 *  como padrao razoavel sem a pessoa precisar descobrir o IP. A tela deixa
 *  trocar quando o barco usa outro host/porta. */
export const URL_SIGNALK_PADRAO = "ws://signalk.local:3000/signalk/v1/stream?subscribe=none"

const CHAVE_URL_SIGNALK = "commander:signalk-url"

/** Le a URL do servidor Signal K salva no aparelho, com o padrao mDNS como
 *  reserva. Preferencia de DISPOSITIVO, nao de conta — mesmo raciocinio de
 *  `lib/preferencias-navegacao.ts`.
 *  Onda 80: exportada porque `/menu/ajustes` passou a ser onde a pessoa
 *  EDITA a URL — antes era um campo dentro do painel de sondagem, em cima
 *  do mapa (configuracao nao e operacao, ver o comentario grande sobre
 *  consentimento em navegar-mapa.tsx). `sondagem-painel.tsx` continua so
 *  LENDO, pra abrir a conexao quando a coleta comeca. */
export function lerUrlSignalKSalva(): string {
  if (typeof localStorage === "undefined") return URL_SIGNALK_PADRAO
  try {
    return localStorage.getItem(CHAVE_URL_SIGNALK) || URL_SIGNALK_PADRAO
  } catch {
    return URL_SIGNALK_PADRAO
  }
}

export function salvarUrlSignalK(url: string) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(CHAVE_URL_SIGNALK, url)
  } catch {}
}

const CAMINHO_POSICAO = "navigation.position"
const CAMINHO_VELOCIDADE = "navigation.speedOverGround"
/** `belowKeel` primeiro (mais direto pra quem pilota — "quanto tenho sob a
 *  quilha agora"), com `belowTransducer` como alternativa: nem toda
 *  instalacao Signal K tem o offset de quilha configurado
 *  (`transducerToKeel`), entao `belowKeel` pode nunca aparecer — o valor
 *  bruto do transdutor ainda assim e uma leitura util. */
const CAMINHOS_PROFUNDIDADE = ["environment.depth.belowKeel", "environment.depth.belowTransducer"] as const

const RECONEXAO_BASE_MS = 1000
const RECONEXAO_MAXIMA_MS = 30_000

interface ValorDelta {
  path?: unknown
  value?: unknown
}
interface AtualizacaoDelta {
  values?: unknown
}
interface MensagemDelta {
  updates?: unknown
}

function ehPosicao(v: unknown): v is { latitude: number; longitude: number } {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.latitude === "number" && typeof o.longitude === "number"
}

function valoresDaAtualizacao(upd: unknown): ValorDelta[] {
  if (typeof upd !== "object" || upd === null) return []
  const valores = (upd as AtualizacaoDelta).values
  return Array.isArray(valores) ? (valores as ValorDelta[]) : []
}

function atualizacoesDaMensagem(msg: unknown): unknown[] {
  if (typeof msg !== "object" || msg === null) return []
  const updates = (msg as MensagemDelta).updates
  return Array.isArray(updates) ? updates : []
}

/** Cria o transporte Signal K. `url` e o endereco do WebSocket do servidor
 *  (ver `URL_SIGNALK_PADRAO`) — cada chamada a `conectar` abre a propria
 *  conexao e reconecta sozinha com backoff exponencial (1s, 2s, 4s... ate
 *  30s) enquanto ninguem chamar a funcao de limpeza devolvida. */
export function criarTransporteSignalK(url: string = URL_SIGNALK_PADRAO): TransporteProfundidade {
  return {
    conectar(
      aoReceberLeitura: (leitura: LeituraTransporte) => void,
      aoMudarStatus: (status: StatusTransporte) => void,
    ) {
      let ws: WebSocket | null = null
      let fechadoPeloConsumidor = false
      let tentativa = 0
      let timerReconexao: ReturnType<typeof setTimeout> | null = null

      let ultimaPosicao: { lat: number; lon: number; recebidaEm: number } | null = null
      let ultimaVelocidadeKt: number | null = null

      function processarDelta(msg: unknown) {
        for (const upd of atualizacoesDaMensagem(msg)) {
          for (const v of valoresDaAtualizacao(upd)) {
            if (v.path === CAMINHO_POSICAO && ehPosicao(v.value)) {
              ultimaPosicao = { lat: v.value.latitude, lon: v.value.longitude, recebidaEm: Date.now() }
              continue
            }
            if (v.path === CAMINHO_VELOCIDADE && typeof v.value === "number") {
              ultimaVelocidadeKt = msParaNos(v.value)
              continue
            }
            if (typeof v.path === "string" && (CAMINHOS_PROFUNDIDADE as readonly string[]).includes(v.path) && typeof v.value === "number") {
              const agora = Date.now()
              const idadePosicaoS = ultimaPosicao ? (agora - ultimaPosicao.recebidaEm) / 1000 : Number.POSITIVE_INFINITY
              aoReceberLeitura({
                profundidadeM: v.value,
                lat: ultimaPosicao?.lat ?? null,
                lon: ultimaPosicao?.lon ?? null,
                idadePosicaoS,
                velocidadeKt: ultimaVelocidadeKt,
                fonte: "signalk",
                medidoEm: agora,
              })
            }
          }
        }
      }

      function agendarReconexao() {
        if (fechadoPeloConsumidor) return
        const esperaMs = Math.min(RECONEXAO_BASE_MS * 2 ** tentativa, RECONEXAO_MAXIMA_MS)
        tentativa += 1
        timerReconexao = setTimeout(conectarAgora, esperaMs)
      }

      function conectarAgora() {
        if (fechadoPeloConsumidor) return
        aoMudarStatus("conectando")
        try {
          ws = new WebSocket(url)
        } catch {
          agendarReconexao()
          return
        }
        ws.onopen = () => {
          tentativa = 0
          aoMudarStatus("conectado")
          ws?.send(
            JSON.stringify({
              context: "vessels.self",
              subscribe: [
                { path: CAMINHO_POSICAO },
                { path: CAMINHO_VELOCIDADE },
                ...CAMINHOS_PROFUNDIDADE.map((path) => ({ path })),
              ],
            }),
          )
        }
        ws.onmessage = (ev) => {
          try {
            processarDelta(JSON.parse(ev.data))
          } catch {
            // Mensagem que nao e JSON valido — o proprio Signal K Server
            // manda uma linha de boas-vindas em texto puro na conexao;
            // ignorar em silencio nao trava a tela.
          }
        }
        ws.onerror = () => aoMudarStatus("erro")
        ws.onclose = () => {
          if (fechadoPeloConsumidor) return
          aoMudarStatus("desconectado")
          agendarReconexao()
        }
      }

      conectarAgora()

      return () => {
        fechadoPeloConsumidor = true
        if (timerReconexao) clearTimeout(timerReconexao)
        ws?.close()
      }
    },
  }
}

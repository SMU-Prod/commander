"use client"
import { useEffect, useRef, useState } from "react"
import { Icone } from "@/components/icone"
import { gravarSondagens, type LeituraParaGravar } from "@/lib/acoes/sondagem"
import {
  celulaId,
  deveAceitarPorMovimento,
  reduzirPorCelula,
  validarLeituraSondagem,
  type PontoAceitoSondagem,
} from "@/lib/domain/sondagem"
import { criarTransporteSignalK, URL_SIGNALK_PADRAO } from "@/lib/nmea/signalk"
import type { LeituraTransporte, StatusTransporte } from "@/lib/nmea/transporte"

const CHAVE_URL_SIGNALK = "commander:signalk-url"

function lerUrlSalva(): string {
  if (typeof localStorage === "undefined") return URL_SIGNALK_PADRAO
  try {
    return localStorage.getItem(CHAVE_URL_SIGNALK) || URL_SIGNALK_PADRAO
  } catch {
    return URL_SIGNALK_PADRAO
  }
}

function salvarUrl(url: string) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(CHAVE_URL_SIGNALK, url)
  } catch {}
}

interface LeituraBuffer {
  lat: number
  lon: number
  profundidadeM: number
  medidoEm: string
}

const ROTULO_STATUS: Record<StatusTransporte, string> = {
  conectando: "Conectando…",
  conectado: "Conectado",
  desconectado: "Sem conexão — tentando de novo",
  erro: "Erro de conexão — tentando de novo",
}

/** Painel de sondagem colaborativa (onda 13) — o equivalente do SonarChart
 *  do Navionics: liga a coleta de profundidade (via transporte Signal K,
 *  `web/lib/nmea/signalk.ts`), valida e deduplica cada leitura no cliente
 *  (`web/lib/domain/sondagem.ts`) e, ao encerrar, reduz por célula e envia
 *  pro banco (`gravarSondagens`). Mesma gramática visual do card de Trilha
 *  ao lado: pill recolhido por padrão, expande pra mostrar detalhe + ação. */
export function SondagemPainel() {
  const [painelAberto, setPainelAberto] = useState(false)
  const [consentimento, setConsentimento] = useState(false)
  const [coletando, setColetando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [statusConexao, setStatusConexao] = useState<StatusTransporte>("desconectado")
  const [profundidadeAtualM, setProfundidadeAtualM] = useState<number | null>(null)
  const [qtdLeituras, setQtdLeituras] = useState(0)
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null)
  const [msgResultado, setMsgResultado] = useState<string | null>(null)
  const [urlSignalK, setUrlSignalK] = useState(URL_SIGNALK_PADRAO)

  const bufferRef = useRef<LeituraBuffer[]>([])
  const ultimaAceitaRef = useRef<PontoAceitoSondagem | null>(null)
  const pararRef = useRef<(() => void) | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- so existe localStorage no cliente, le uma vez apos montar (evita mismatch de hidratacao)
  useEffect(() => setUrlSignalK(lerUrlSalva()), [])

  // Rede de seguranca: se a tela desmontar com a coleta ligada, fecha o
  // WebSocket mesmo assim (mesmo padrao do wakeLock em navegar-mapa.tsx).
  useEffect(() => {
    return () => pararRef.current?.()
  }, [])

  function aoReceberLeitura(leitura: LeituraTransporte) {
    setProfundidadeAtualM(leitura.profundidadeM)
    const validacao = validarLeituraSondagem({
      profundidadeM: leitura.profundidadeM,
      lat: leitura.lat,
      lon: leitura.lon,
      idadePosicaoS: leitura.idadePosicaoS,
      velocidadeKt: leitura.velocidadeKt,
    })
    if (!validacao.ok) {
      setMotivoRejeicao(validacao.motivo)
      return
    }
    // validacao.ok garante lat/lon != null — guarda de tipo, nao logica nova.
    if (leitura.lat == null || leitura.lon == null) return
    setMotivoRejeicao(null)
    const nova: PontoAceitoSondagem = { lat: leitura.lat, lon: leitura.lon, t: leitura.medidoEm / 1000 }
    if (!deveAceitarPorMovimento(ultimaAceitaRef.current, nova)) return
    ultimaAceitaRef.current = nova
    bufferRef.current.push({
      lat: leitura.lat,
      lon: leitura.lon,
      profundidadeM: leitura.profundidadeM,
      medidoEm: new Date(leitura.medidoEm).toISOString(),
    })
    setQtdLeituras(bufferRef.current.length)
  }

  function iniciarColeta() {
    if (!consentimento || coletando) return
    bufferRef.current = []
    ultimaAceitaRef.current = null
    setQtdLeituras(0)
    setProfundidadeAtualM(null)
    setMotivoRejeicao(null)
    setMsgResultado(null)
    const urlFinal = urlSignalK.trim() || URL_SIGNALK_PADRAO
    salvarUrl(urlFinal)
    const transporte = criarTransporteSignalK(urlFinal)
    pararRef.current = transporte.conectar(aoReceberLeitura, setStatusConexao)
    setColetando(true)
  }

  async function encerrarEEnviar() {
    pararRef.current?.()
    pararRef.current = null
    setColetando(false)
    setStatusConexao("desconectado")

    const leituras = bufferRef.current
    if (leituras.length === 0) {
      setMsgResultado("Nenhuma leitura capturada nesta saída.")
      return
    }

    setEnviando(true)
    const celulas = reduzirPorCelula(leituras)
    // A reducao por celula (dominio puro) nao carrega o "quando" de cada
    // ponto — recompoe aqui o momento mais recente de cada celula, pra
    // gravar uma data real em vez de "agora" no envio.
    const ultimoMomentoPorCelula = new Map<string, string>()
    for (const l of leituras) {
      const id = celulaId(l.lat, l.lon)
      const atual = ultimoMomentoPorCelula.get(id)
      if (!atual || l.medidoEm > atual) ultimoMomentoPorCelula.set(id, l.medidoEm)
    }
    const paraGravar: LeituraParaGravar[] = celulas.map((c) => ({
      lat: c.lat,
      lon: c.lon,
      profundidadeM: c.profundidadeM,
      celulaId: c.celulaId,
      transporte: "signalk",
      medidoEm: ultimoMomentoPorCelula.get(c.celulaId) ?? new Date().toISOString(),
    }))

    const r = await gravarSondagens(paraGravar, "signalk")
    setEnviando(false)
    bufferRef.current = []
    setQtdLeituras(0)
    if (r.ok) {
      setMsgResultado(
        `${r.gravadas} ${r.gravadas === 1 ? "ponto enviado" : "pontos enviados"} pro mapa colaborativo — obrigado por contribuir.`,
      )
    } else {
      setMsgResultado(r.erro)
    }
  }

  const mostrador = "rounded-[10px] border border-line bg-meter px-3 py-2 font-mono-instr tabular-nums text-meter-texto"
  const etiqueta = "text-[11px] uppercase tracking-[.14em] text-meter-dim"

  return (
    <div className="sombra-2 overflow-hidden rounded-[14px] border border-line bg-panel/95 backdrop-blur">
      <button
        type="button"
        onClick={() => setPainelAberto((v) => !v)}
        aria-expanded={painelAberto}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2">
          <Icone nome="sonar" className={`size-4 ${coletando ? "text-accent" : "text-dim"}`} />
          <span className="titulo-card">
            {coletando ? `Sondando — ${qtdLeituras} leitura${qtdLeituras === 1 ? "" : "s"}` : "Sondagem colaborativa"}
          </span>
        </span>
        <Icone
          nome="chevron"
          className={`size-4 text-dim transition-transform ${painelAberto ? "-rotate-90" : "rotate-90"}`}
        />
      </button>

      {painelAberto && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <p className="apoio text-dim">
            Cada leitura do seu ecobatímetro, com a posição do GPS, ajuda a completar o mapa colaborativo — como o
            SonarChart do Navionics. É dado colaborativo bruto: melhora com o tempo e nunca substitui a carta
            náutica oficial.
          </p>

          {!coletando && (
            <>
              <div className="mt-3">
                <label htmlFor="signalk-url" className="mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim">
                  Servidor Signal K
                </label>
                <input
                  id="signalk-url"
                  value={urlSignalK}
                  onChange={(e) => setUrlSignalK(e.target.value)}
                  placeholder={URL_SIGNALK_PADRAO}
                  className="w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
                />
              </div>

              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-dim">
                <input
                  type="checkbox"
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  className="size-5 shrink-0"
                />
                Concordo em compartilhar minhas leituras de profundidade e posição aproximada, de forma agregada por
                área — nunca minha rota individual.
              </label>

              <button
                onClick={iniciarColeta}
                disabled={!consentimento}
                className="mt-3 w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-acao-texto disabled:opacity-50"
              >
                Iniciar coleta
              </button>
            </>
          )}

          {coletando && (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className={mostrador}>
                  <p className={etiqueta}>Profundidade</p>
                  <p className="text-xl">
                    {profundidadeAtualM != null ? profundidadeAtualM.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                    <span className="text-sm text-meter-dim"> m</span>
                  </p>
                </div>
                <div className={mostrador}>
                  <p className={etiqueta}>Leituras</p>
                  <p className="text-xl">{qtdLeituras}</p>
                </div>
                <div className={mostrador}>
                  <p className={etiqueta}>Conexão</p>
                  <p className="flex items-center gap-1 text-xs">
                    <Icone nome="sinal" className={`size-3.5 ${statusConexao === "conectado" ? "text-accent" : "text-dim"}`} />
                    {ROTULO_STATUS[statusConexao]}
                  </p>
                </div>
              </div>

              {motivoRejeicao && (
                <p className="mt-2 text-center text-xs text-dim">Não registrando agora: {motivoRejeicao}</p>
              )}

              <button
                onClick={encerrarEEnviar}
                disabled={enviando}
                className="mt-3 w-full rounded-xl bg-crit py-3.5 text-base font-semibold text-white disabled:opacity-60"
              >
                {enviando ? "Enviando…" : "Encerrar e enviar"}
              </button>
            </>
          )}

          {msgResultado && <p className="mt-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-dim">{msgResultado}</p>}
        </div>
      )}
    </div>
  )
}

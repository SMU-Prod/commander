"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Icone } from "@/components/icone"
import { gravarSondagens, type LeituraParaGravar } from "@/lib/acoes/sondagem"
import { tempoRelativo } from "@/lib/domain/datas"
import {
  deveAceitarPorMovimento,
  validarLeituraSondagem,
  type PontoAceitoSondagem,
} from "@/lib/domain/sondagem"
import {
  despachar,
  enfileirar,
  estadoFila,
  type EstadoFila,
  type LoteParaEnviar,
  type ResultadoEnvioLote,
} from "@/lib/nmea/fila"
import { criarTransporteAtivo, transporteAtivoNome } from "@/lib/nmea/selecionar"
import { lerUrlSignalKSalva } from "@/lib/nmea/signalk"
import type { LeituraTransporte, StatusTransporte } from "@/lib/nmea/transporte"
import { lerConsentimentoSondagem } from "@/lib/preferencias-navegacao"

const ROTULO_STATUS: Record<StatusTransporte, string> = {
  conectando: "Conectando…",
  conectado: "Conectado",
  desconectado: "Sem conexão — tentando de novo",
  erro: "Erro de conexão — tentando de novo",
}

/** Nunca manda mais de N células por chamada ao servidor de uma vez — mesma
 *  lógica defensiva de `LIMITE_LEITURAS_POR_ENVIO` em `gravarSondagens`,
 *  mais conservadora aqui (lotes menores respondem mais rápido e sofrem
 *  menos com sinal fraco perto da costa, que é justamente quando este envio
 *  em segundo plano tem mais chance de rodar). Cada pedaço usa o MESMO
 *  `loteId` — a chave de deduplicação (`loteId:celulaId`) continua única
 *  por célula, então repetir um pedaço já gravado num retry não duplica
 *  (ver migration `026_sondagens_idempotencia.sql`). */
const MAX_CELULAS_POR_CHAMADA = 500

/** Liga a fila persistente (`web/lib/nmea/fila.ts`, puro e testado sem
 *  depender de nenhuma server action) à ação real de gravação. Fora do
 *  componente porque não depende de estado nenhum da tela — só do lote que
 *  `despachar` entrega. */
async function enviarLote(lote: LoteParaEnviar): Promise<ResultadoEnvioLote> {
  if (lote.celulas.length === 0) return { ok: true, gravadas: 0 }
  let totalGravadas = 0
  for (let i = 0; i < lote.celulas.length; i += MAX_CELULAS_POR_CHAMADA) {
    const pedaco = lote.celulas.slice(i, i + MAX_CELULAS_POR_CHAMADA)
    const paraGravar: LeituraParaGravar[] = pedaco.map((c) => ({
      lat: c.lat,
      lon: c.lon,
      profundidadeM: c.profundidadeM,
      celulaId: c.celulaId,
      transporte: lote.transporte,
      medidoEm: lote.ultimoMomentoPorCelula[c.celulaId] ?? new Date().toISOString(),
    }))
    const r = await gravarSondagens(paraGravar, lote.transporte, lote.loteId)
    if (!r.ok) return r // o resto do lote fica pra proxima retentativa — nao perde o pedaco que ainda nao foi
    totalGravadas += r.gravadas
  }
  return { ok: true, gravadas: totalGravadas }
}

const ESTADO_FILA_INICIAL: EstadoFila = {
  pendentes: 0,
  emVoo: 0,
  filaCheia: false,
  ultimoEnvioEm: null,
  proximaTentativaEm: null,
}

/** Painel de sondagem colaborativa (onda 13, com fila persistente da onda
 *  14) — o equivalente do SonarChart do Navionics: liga a coleta de
 *  profundidade (via `criarTransporteAtivo`, que usa o nativo quando existir
 *  e cai pro Signal K hoje), valida cada leitura no cliente
 *  (`web/lib/domain/sondagem.ts`) e guarda na fila local — nunca tenta
 *  mandar ao vivo. A leitura sai da fila sozinha quando a conexão volta ou o
 *  app volta ao primeiro plano; sem sinal a saída inteira, nada se perde —
 *  continua guardada no aparelho até a próxima chance.
 *
 *  Onda 80 (consolidação dos painéis flutuantes de `/navegar`): este
 *  componente PAROU de desenhar a própria casca de cartão/pílula — quem
 *  chama (`navegar-mapa.tsx`) agora é dono do cartão único, das abas e do
 *  recolher/expandir, e só esconde este conteúdo via CSS quando a aba
 *  "Sondagem" não está ativa (NUNCA um `{condicao && <SondagemPainel/>}`,
 *  que desmontaria e derrubaria a conexão em segundo plano — ver o
 *  comentário grande sobre isso em navegar-mapa.tsx). `aoMudarResumo`
 *  devolve pro pai só o que ele precisa pra pintar a pílula recolhida e o
 *  indicador da aba (coletando + quantidade guardada), sem o pai precisar
 *  conhecer o resto do estado interno.
 *
 *  O consentimento e a URL do Signal K também saíram daqui: viraram
 *  preferência deliberada de `/menu/ajustes` (`lib/preferencias-navegacao.ts`
 *  e `lib/nmea/signalk.ts`) em vez de caixa de seleção + campo de texto em
 *  cima do mapa — mesmo raciocínio do consentimento de corredores, ver o
 *  comentário grande sobre isso em navegar-mapa.tsx. Sem consentimento dado
 *  em Ajustes, "Iniciar coleta" fica desabilitado com um aviso curto e um
 *  link pra lá — nunca um checkbox aparecendo de novo sobre o mapa. */
export function SondagemPainel({
  aoMudarResumo,
}: {
  aoMudarResumo?: (resumo: { coletando: boolean; guardadas: number }) => void
}) {
  const [consentimento, setConsentimento] = useState(false)
  const [coletando, setColetando] = useState(false)
  const [statusConexao, setStatusConexao] = useState<StatusTransporte>("desconectado")
  const [profundidadeAtualM, setProfundidadeAtualM] = useState<number | null>(null)
  const [qtdLeituras, setQtdLeituras] = useState(0)
  const [motivoRejeicao, setMotivoRejeicao] = useState<string | null>(null)
  const [fila, setFila] = useState<EstadoFila>(ESTADO_FILA_INICIAL)

  const ultimaAceitaRef = useRef<PontoAceitoSondagem | null>(null)
  const pararRef = useRef<(() => void) | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- so existe localStorage no cliente, le uma vez apos montar (evita mismatch de hidratacao)
  useEffect(() => setConsentimento(lerConsentimentoSondagem()), [])

  // Rede de seguranca: se a tela desmontar com a coleta ligada, fecha o
  // transporte mesmo assim (mesmo padrao do wakeLock em navegar-mapa.tsx). A
  // FILA em si continua guardada e tenta enviar sozinha depois — parar de
  // COLETAR nao apaga o que ja foi guardado.
  useEffect(() => {
    return () => pararRef.current?.()
  }, [])

  // Ciclo de vida da fila: tenta despachar ao montar (pode haver leituras de
  // uma saida anterior interrompida), quando a conexao volta, quando o app
  // volta ao primeiro plano, e a cada 30s como rede de seguranca (nem todo
  // navegador/webview dispara `online` de forma confiavel — sem esse timer,
  // uma retentativa em backoff nunca reavaliaria sozinha). `despachar` e
  // async e engole os proprios erros — nunca trava nem quebra a tela.
  useEffect(() => {
    let cancelado = false
    function tentarDespachar() {
      despachar(enviarLote).finally(() => {
        if (!cancelado) setFila(estadoFila())
      })
    }
    tentarDespachar()
    function aoMudarVisibilidade() {
      if (document.visibilityState === "visible") tentarDespachar()
    }
    window.addEventListener("online", tentarDespachar)
    document.addEventListener("visibilitychange", aoMudarVisibilidade)
    const intervalo = setInterval(tentarDespachar, 30_000)
    return () => {
      cancelado = true
      window.removeEventListener("online", tentarDespachar)
      document.removeEventListener("visibilitychange", aoMudarVisibilidade)
      clearInterval(intervalo)
    }
  }, [])

  const totalGuardado = fila.pendentes + fila.emVoo

  // Resumo pro pai (pílula recolhida + indicador da aba) — só dispara quando
  // algo que o pai de fato usa muda, não a cada leitura de profundidade.
  useEffect(() => {
    aoMudarResumo?.({ coletando, guardadas: totalGuardado })
  }, [coletando, totalGuardado, aoMudarResumo])

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

    enfileirar({
      lat: leitura.lat,
      lon: leitura.lon,
      profundidadeM: leitura.profundidadeM,
      medidoEm: new Date(leitura.medidoEm).toISOString(),
      transporte: leitura.fonte,
    })
    setQtdLeituras((n) => n + 1)
    setFila(estadoFila())
  }

  function iniciarColeta() {
    if (!consentimento || coletando) return
    ultimaAceitaRef.current = null
    setQtdLeituras(0)
    setProfundidadeAtualM(null)
    setMotivoRejeicao(null)
    const transporte = criarTransporteAtivo(lerUrlSignalKSalva())
    pararRef.current = transporte.conectar(aoReceberLeitura, setStatusConexao)
    setColetando(true)
  }

  function pararColeta() {
    pararRef.current?.()
    pararRef.current = null
    setColetando(false)
    setStatusConexao("desconectado")
    // O que ja foi aceito continua guardado na fila e tenta enviar sozinho —
    // parar de coletar so desliga o transporte, nunca descarta uma leitura.
    despachar(enviarLote).finally(() => setFila(estadoFila()))
  }

  const usaNativo = transporteAtivoNome() === "nativo"

  // Onda 24 (passe de arte) — mesma identidade "instrumento de ponte" do
  // resto do /navegar: valores em dourado (text-accent — não accent-forte,
  // que troca com o tema e perderia contraste aqui dentro), texto em
  // meter-texto/meter-dim (não texto/dim, calibrados pra --superficie, não
  // pra este fundo fixo). Onda 80 — rótulo em CAIXA DE FRASE
  // (`.rotulo-dado`, ver app/globals.css), não mais uppercase rastreado: é
  // a mesma troca que o resto da tela fez, ver navegar-mapa.tsx.
  const mostrador = "rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-meter px-3 py-2 tabular-nums tabular-nums"
  const etiqueta = "rotulo-dado !text-meter-dim"

  return (
    <div>
      {!coletando && (
        <>
          {consentimento ? (
            <button
              onClick={iniciarColeta}
              className="w-full rounded-[var(--raio-controle)] bg-accent py-3.5 text-base font-semibold text-acao-texto"
            >
              Iniciar coleta {usaNativo ? "" : "via Signal K"}
            </button>
          ) : (
            // Sem consentimento (decidido em Ajustes, nunca aqui): honesto
            // sobre por que o botão não funciona, com o caminho pra decidir —
            // nunca um checkbox reaparecendo em cima do mapa (ver comentário
            // grande no topo do arquivo).
            <div className="rounded-[var(--raio-cartao)] border border-mapa-instrumento-borda bg-black/15 px-3 py-2.5 text-sm text-meter-dim">
              <p>Sondagem colaborativa desligada neste aparelho.</p>
              <Link href="/menu/ajustes#navegacao" className="mt-1 inline-block font-medium text-accent underline">
                Ativar em Ajustes → Navegação
              </Link>
            </div>
          )}
        </>
      )}

      {coletando && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className={mostrador}>
              <p className={etiqueta}>Profundidade</p>
              <p className="text-xl text-accent">
                {profundidadeAtualM != null ? profundidadeAtualM.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}
                <span className="text-sm text-meter-dim"> m</span>
              </p>
            </div>
            <div className={mostrador}>
              <p className={etiqueta}>Leituras</p>
              <p className="text-xl text-accent">{qtdLeituras}</p>
            </div>
            <div className={mostrador}>
              <p className={etiqueta}>Conexão</p>
              <p className="flex items-center gap-1 text-xs text-meter-texto">
                <Icone nome="sinal" className={`size-3.5 ${statusConexao === "conectado" ? "text-accent" : "text-meter-dim"}`} />
                {ROTULO_STATUS[statusConexao]}
              </p>
            </div>
          </div>

          {motivoRejeicao && (
            <p className="mt-2 text-center text-xs text-meter-dim">Não registrando agora: {motivoRejeicao}</p>
          )}

          <button
            onClick={pararColeta}
            className="mt-3 w-full rounded-[var(--raio-controle)] bg-crit py-3.5 text-base font-semibold text-white"
          >
            Parar coleta
          </button>
        </>
      )}

      {/* Verdade da fila — mesmo parado (sem coletar), uma leitura de uma
          saída anterior sem sinal pode continuar guardada esperando pra
          subir. Ninguém deve achar que perdeu a saída. */}
      {(totalGuardado > 0 || fila.ultimoEnvioEm != null) && (
        <div className="mt-3 flex items-start gap-2 rounded-[var(--raio-controle)] border border-mapa-instrumento-borda bg-black/15 px-3 py-2.5 text-sm text-meter-dim">
          <Icone nome="guardado" className="mt-0.5 size-4 shrink-0 text-meter-dim" />
          <p>
            {totalGuardado > 0 ? (
              <>
                {totalGuardado} leitura{totalGuardado === 1 ? "" : "s"} guardada{totalGuardado === 1 ? "" : "s"} no
                aparelho, esperando sinal pra enviar — nada foi perdido.
                {fila.filaCheia &&
                  " A fila está cheia; leituras de área ainda não visitada podem esperar até liberar espaço."}
              </>
            ) : (
              "Tudo enviado."
            )}{" "}
            {fila.ultimoEnvioEm != null && <>Último envio: {tempoRelativo(fila.ultimoEnvioEm)}.</>}
          </p>
        </div>
      )}
    </div>
  )
}

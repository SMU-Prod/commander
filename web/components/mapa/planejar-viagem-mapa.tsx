"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, MapMouseEvent, GeoJSONSource } from "mapbox-gl"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { Icone } from "@/components/icone"
import { avisoCaladoViagem, usePernasViagem, usouCorredoresViagem } from "@/components/mapa/usar-pernas-viagem"
import { criarViagem } from "@/lib/acoes/viagem"
import {
  montarViagem,
  velocidadeCruzeiroHistorica,
  velocidadeCruzeiroInformada,
  type EventoComTrilha,
  type Parada,
} from "@/lib/domain/viagem"
import { hojeISO } from "@/lib/domain/datas"
import { parseDecimalPtBr } from "@/lib/domain/numeros"

const COR_DOURADO = "#D4AF37"
const COR_ALARME = "#FF5C5C"
const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

function colecaoVazia() {
  return { type: "FeatureCollection" as const, features: [] as unknown[] }
}

/**
 * Planejar viagem (onda 19, Pilar Strava do Mar): escolher paradas TOCANDO
 * no mapa (mesmo mecanismo do modo "Definir destino" de navegar-mapa.tsx —
 * crosshair + `mapa.on("click")` — só que aqui cada toque ACRESCENTA uma
 * parada em vez de substituir um destino único), nomear cada uma, escolher
 * o nome da viagem, a data prevista e a velocidade de cruzeiro (histórico
 * das saídas com trilha se houver, senão informada na hora — nunca
 * inventada, ver web/lib/domain/viagem.ts), e salvar.
 *
 * Cada perna é traçada PELA ÁGUA pelo mesmo motor A* de sempre (o Worker
 * `rota.worker.ts`, via `usarPernasViagem`) — nunca uma linha reta
 * decorativa. Perna sem caminho (calado, fora da área) aparece honesta na
 * lista, com uma linha tracejada vermelha no mapa em vez de sumir.
 */
export function PlanejarViagemMapa({
  caladoM,
  eventosComTrilha,
}: {
  caladoM: number | null
  eventosComTrilha: EventoComTrilha[]
}) {
  const router = useRouter()
  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  const [paradas, setParadas] = useState<Parada[]>([])
  const [modoAdicionar, setModoAdicionar] = useState(true)
  const [nomeViagem, setNomeViagem] = useState("")
  const [dataPrevista, setDataPrevista] = useState("")
  const [velocidadeTexto, setVelocidadeTexto] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const pernasEstado = usePernasViagem(paradas, caladoM)

  const velocidadeHistorica = useMemo(() => velocidadeCruzeiroHistorica(eventosComTrilha), [eventosComTrilha])
  const velInformadaKt = parseDecimalPtBr(velocidadeTexto)
  const velocidade =
    velocidadeHistorica ?? (velInformadaKt != null && velInformadaKt > 0 ? velocidadeCruzeiroInformada(velInformadaKt) : null)

  const viagem = useMemo(
    () => montarViagem(paradas, pernasEstado.map((p) => p.pontos), velocidade),
    [paradas, pernasEstado, velocidade],
  )
  const algumaCalculando = pernasEstado.some((p) => p.carregando)
  const avisoCalado = useMemo(() => avisoCaladoViagem(pernasEstado, caladoM), [pernasEstado, caladoM])
  const usouCorredores = useMemo(() => usouCorredoresViagem(pernasEstado), [pernasEstado])

  function renomearParada(indice: number, nome: string) {
    setParadas((atual) => atual.map((p, i) => (i === indice ? { ...p, nome } : p)))
  }
  function removerParada(indice: number) {
    setParadas((atual) => atual.filter((_, i) => i !== indice))
  }

  // Toque no mapa acrescenta parada — mesmo mecanismo do modo "Definir
  // destino" de navegar-mapa.tsx (cursor crosshair + `mapa.on("click")`),
  // só que fica LIGADO entre toques (permite marcar várias paradas em
  // sequência) em vez de desligar depois do primeiro.
  useEffect(() => {
    if (!mapaPronto) return
    mapaPronto.getCanvas().style.cursor = modoAdicionar ? "crosshair" : ""
    if (!modoAdicionar) return
    function aoClicarNoMapa(e: MapMouseEvent) {
      setParadas((atual) => [...atual, { nome: `Parada ${atual.length + 1}`, la: e.lngLat.lat, lo: e.lngLat.lng }])
    }
    mapaPronto.on("click", aoClicarNoMapa)
    return () => {
      mapaPronto.off("click", aoClicarNoMapa)
    }
  }, [mapaPronto, modoAdicionar])

  // Fontes/camadas do mapa — criadas uma vez, atualizadas via setData abaixo.
  useEffect(() => {
    if (!mapaPronto) return
    if (!mapaPronto.getSource("viagem-pernas-ok")) {
      mapaPronto.addSource("viagem-pernas-ok", { type: "geojson", data: colecaoVazia() })
      mapaPronto.addLayer({
        id: "viagem-pernas-ok-linha",
        type: "line",
        source: "viagem-pernas-ok",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": COR_DOURADO, "line-width": 3 },
      })
    }
    if (!mapaPronto.getSource("viagem-pernas-sem-caminho")) {
      mapaPronto.addSource("viagem-pernas-sem-caminho", { type: "geojson", data: colecaoVazia() })
      mapaPronto.addLayer({
        id: "viagem-pernas-sem-caminho-linha",
        type: "line",
        source: "viagem-pernas-sem-caminho",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": COR_ALARME, "line-width": 2.5, "line-dasharray": [1.5, 1.5] },
      })
    }
    if (!mapaPronto.getSource("viagem-paradas")) {
      mapaPronto.addSource("viagem-paradas", { type: "geojson", data: colecaoVazia() })
      mapaPronto.addLayer({
        id: "viagem-paradas-circulos",
        type: "circle",
        source: "viagem-paradas",
        paint: {
          "circle-radius": 9,
          "circle-color": COR_DOURADO,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0B1D2D",
        },
      })
      mapaPronto.addLayer({
        id: "viagem-paradas-numeros",
        type: "symbol",
        source: "viagem-paradas",
        layout: {
          "text-field": ["get", "rotulo"],
          "text-size": 11,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#0B1D2D" },
      })
    }
  }, [mapaPronto])

  // Redesenha paradas (pontos numerados) a cada mudança da lista.
  useEffect(() => {
    if (!mapaPronto) return
    const source = mapaPronto.getSource("viagem-paradas") as GeoJSONSource | undefined
    if (!source) return
    source.setData({
      type: "FeatureCollection",
      features: paradas.map((p, i) => ({
        type: "Feature" as const,
        properties: { rotulo: String(i + 1) },
        geometry: { type: "Point" as const, coordinates: [p.lo, p.la] },
      })),
    })
  }, [mapaPronto, paradas])

  // Redesenha as pernas — linha dourada pela água pra quem tem caminho,
  // tracejado vermelho (reta entre as duas paradas, só pra indicar QUAL
  // perna falhou) pra quem não tem.
  useEffect(() => {
    if (!mapaPronto) return
    const sourceOk = mapaPronto.getSource("viagem-pernas-ok") as GeoJSONSource | undefined
    const sourceFalha = mapaPronto.getSource("viagem-pernas-sem-caminho") as GeoJSONSource | undefined
    if (!sourceOk || !sourceFalha) return
    const featuresOk: unknown[] = []
    const featuresFalha: unknown[] = []
    viagem.pernas.forEach((perna, i) => {
      const estado = pernasEstado[i]
      if (perna.pontos) {
        featuresOk.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: perna.pontos.map((p) => [p.lo, p.la]) },
        })
      } else if (estado && !estado.carregando) {
        featuresFalha.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [perna.de.lo, perna.de.la],
              [perna.para.lo, perna.para.la],
            ],
          },
        })
      }
    })
    sourceOk.setData({ type: "FeatureCollection", features: featuresOk })
    sourceFalha.setData({ type: "FeatureCollection", features: featuresFalha })
  }, [mapaPronto, viagem, pernasEstado])

  async function salvar() {
    setErro(null)
    if (nomeViagem.trim() === "") return setErro("Dê um nome pra viagem.")
    if (dataPrevista === "") return setErro("Escolha a data prevista de saída.")
    if (paradas.length < 2) return setErro("Marque pelo menos a origem e o destino no mapa.")
    if (paradas.some((p) => p.nome.trim() === "")) return setErro("Dê um nome pra cada parada.")
    setSalvando(true)
    const r = await criarViagem(nomeViagem, dataPrevista, paradas)
    setSalvando(false)
    if (!r.ok) return setErro(r.erro)
    router.push(`/navegar/viagem/${r.id}`)
  }

  return (
    <main className="relative -mx-4 -mt-5 -mb-24 h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Planejar viagem</h1>
      <MapaNautico aoIniciar={setMapaPronto} className="h-full w-full" />

      <div className="absolute left-3 right-14 top-3 z-20">
        <button
          type="button"
          onClick={() => setModoAdicionar((v) => !v)}
          aria-pressed={modoAdicionar}
          className={`sombra-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-medium backdrop-blur ${
            modoAdicionar ? "border-accent bg-accent text-acao-texto" : "border-line bg-panel/95 text-dim"
          }`}
        >
          <Icone nome="mapa" className="size-4" />
          {modoAdicionar ? "Toque no mapa para marcar uma parada" : "Adicionar parada"}
        </button>
      </div>

      <div className="sombra-2 absolute inset-x-0 bottom-0 z-20 max-h-[62dvh] overflow-y-auto rounded-t-[18px] border-t border-line bg-panel/95 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="titulo-card">Nova viagem</h2>
          <button
            type="button"
            onClick={() => router.push("/navegar")}
            aria-label="Cancelar"
            className="flex size-9 items-center justify-center text-dim"
          >
            <Icone nome="mais" className="size-4 rotate-45" />
          </button>
        </div>

        {paradas.length === 0 ? (
          <p className="apoio text-dim">Toque no mapa pra marcar a origem, as paradas e o destino, em ordem.</p>
        ) : (
          <div className="space-y-2">
            {paradas.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono-instr text-xs font-semibold text-accent-forte">
                  {i + 1}
                </span>
                <input
                  value={p.nome}
                  onChange={(e) => renomearParada(i, e.target.value)}
                  className={`${campo} py-2`}
                  aria-label={`Nome da parada ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removerParada(i)}
                  aria-label={`Remover parada ${i + 1}`}
                  className="flex size-9 shrink-0 items-center justify-center text-dim"
                >
                  <Icone nome="mais" className="size-4 rotate-45" />
                </button>
              </div>
            ))}
          </div>
        )}

        {viagem.pernas.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-line pt-3">
            {viagem.pernas.map((perna, i) => {
              const estado = pernasEstado[i]
              return (
                <p key={i} className="apoio flex items-center justify-between gap-2 text-dim">
                  <span className="truncate">{perna.de.nome} → {perna.para.nome}</span>
                  {estado?.carregando ? (
                    <span className="shrink-0">calculando…</span>
                  ) : perna.distanciaNm != null ? (
                    <span className="shrink-0 font-mono-instr tabular-nums">
                      {perna.distanciaNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN
                      {perna.etaMin != null && ` · ${Math.round(perna.etaMin)} min`}
                    </span>
                  ) : (
                    <span className="shrink-0 text-warn">
                      {estado?.foraDaArea ? "fora da área mapeada" : "sem caminho pela água"}
                    </span>
                  )}
                </p>
              )
            })}
            <p className="apoio flex items-center justify-between gap-2 pt-1 font-medium">
              <span>Total{!viagem.completa && " (parcial — falta trecho acima)"}</span>
              <span className="font-mono-instr tabular-nums">
                {viagem.distanciaTotalNm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MN
                {viagem.etaTotalMin != null && ` · ${Math.round(viagem.etaTotalMin / 60)} h ${Math.round(viagem.etaTotalMin % 60)} min`}
              </span>
            </p>
            {/* Mesmos disclaimers do /navegar — a rota planejada herda a honestidade
                de sempre, não inventa um texto novo (ver usar-pernas-viagem.ts). */}
            {avisoCalado && (
              <p className={`apoio pt-1 ${avisoCalado.tom === "aviso" ? "text-warn" : "text-dim"}`}>
                {avisoCalado.texto}
                {avisoCalado.linkCadastrar && (
                  <>
                    {" "}
                    <Link href="/barco/editar" className="underline">Cadastrar calado</Link>
                  </>
                )}
              </p>
            )}
            {usouCorredores && (
              <p className="apoio pt-1 text-dim">
                Considera passagens reais de outros barcos nesta área — não é garantia de profundidade.
              </p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div>
            <label className={rotulo} htmlFor="nome-viagem">Nome da viagem</label>
            <input
              id="nome-viagem"
              value={nomeViagem}
              onChange={(e) => setNomeViagem(e.target.value)}
              placeholder="Ex.: Fim de semana em Ilha Grande"
              className={campo}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="data-viagem">Data prevista de saída</label>
            <input
              id="data-viagem"
              type="date"
              min={hojeISO()}
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className={campo}
            />
          </div>

          {velocidadeHistorica ? (
            <p className="apoio text-dim">ETA calculado {velocidadeHistorica.texto}.</p>
          ) : (
            <div>
              <label className={rotulo} htmlFor="velocidade-viagem">Velocidade de cruzeiro (kt) — opcional</label>
              <input
                id="velocidade-viagem"
                inputMode="decimal"
                value={velocidadeTexto}
                onChange={(e) => setVelocidadeTexto(e.target.value)}
                placeholder="Ex.: 18"
                className={`${campo} font-mono-instr tabular-nums`}
              />
              <p className="apoio mt-1 text-dim">
                Sem saída com trilha registrada ainda — informe pra ver o ETA por perna. Não é salvo, só estima esta viagem.
              </p>
            </div>
          )}

          {erro && <p className="rounded-lg border border-crit/40 bg-crit/10 px-3 py-2 corpo">{erro}</p>}

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || algumaCalculando || paradas.length < 2}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-accent text-sm font-semibold text-acao-texto disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar viagem"}
          </button>
        </div>
      </div>
    </main>
  )
}

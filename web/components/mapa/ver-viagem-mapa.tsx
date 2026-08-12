"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Map as MapaMapbox, GeoJSONSource } from "mapbox-gl"
import { MapaNautico } from "@/components/mapa/mapa-nautico"
import { Icone } from "@/components/icone"
import { avisoCaladoViagem, usePernasViagem, usouCorredoresViagem } from "@/components/mapa/usar-pernas-viagem"
import {
  montarViagem,
  velocidadeCruzeiroHistorica,
  velocidadeCruzeiroInformada,
  type EventoComTrilha,
  type Parada,
} from "@/lib/domain/viagem"
import { parseDecimalPtBr } from "@/lib/domain/numeros"

const COR_DOURADO = "#D4AF37"
const COR_ALARME = "#FF5C5C"
const campo = "w-full rounded-[10px] border border-line bg-campo px-3 py-3 text-base"
const rotulo = "mb-1.5 block font-mono-instr text-[11px] uppercase tracking-[.14em] text-dim"

function colecaoVazia() {
  return { type: "FeatureCollection" as const, features: [] as unknown[] }
}

/**
 * Ver viagem (onda 19): mostra a viagem já planejada — rota completa
 * desenhada no mapa (todas as pernas, pelo A* com corredores/calado, ver
 * `usePernasViagem`), lista de paradas com distância e ETA por perna e
 * total. Herda os MESMOS disclaimers do /navegar (calado, corredores, "não
 * substitui a carta oficial") — o texto é o mesmo já usado lá, não um novo.
 * Read-only: diferente de PlanejarViagemMapa, não tem toque-pra-marcar nem
 * edição de paradas.
 */
export function VerViagemMapa({
  nome,
  dataPrevista,
  paradas,
  caladoM,
  eventosComTrilha,
}: {
  nome: string
  dataPrevista: string
  paradas: Parada[]
  caladoM: number | null
  eventosComTrilha: EventoComTrilha[]
}) {
  const router = useRouter()
  const [mapaPronto, setMapaPronto] = useState<MapaMapbox | null>(null)
  const [velocidadeTexto, setVelocidadeTexto] = useState("")

  const pernasEstado = usePernasViagem(paradas, caladoM)
  const velocidadeHistorica = useMemo(() => velocidadeCruzeiroHistorica(eventosComTrilha), [eventosComTrilha])
  const velInformadaKt = parseDecimalPtBr(velocidadeTexto)
  const velocidade =
    velocidadeHistorica ?? (velInformadaKt != null && velInformadaKt > 0 ? velocidadeCruzeiroInformada(velInformadaKt) : null)

  const viagem = useMemo(
    () => montarViagem(paradas, pernasEstado.map((p) => p.pontos), velocidade),
    [paradas, pernasEstado, velocidade],
  )
  const avisoCalado = useMemo(() => avisoCaladoViagem(pernasEstado, caladoM), [pernasEstado, caladoM])
  const usouCorredores = useMemo(() => usouCorredoresViagem(pernasEstado), [pernasEstado])

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
        layout: { "text-field": ["get", "rotulo"], "text-size": 11, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] },
        paint: { "text-color": "#0B1D2D" },
      })
    }

    const sourceParadas = mapaPronto.getSource("viagem-paradas") as GeoJSONSource
    sourceParadas.setData({
      type: "FeatureCollection",
      features: paradas.map((p, i) => ({
        type: "Feature" as const,
        properties: { rotulo: String(i + 1) },
        geometry: { type: "Point" as const, coordinates: [p.lo, p.la] },
      })),
    })

    // Enquadra o mapa em todas as paradas assim que ele carrega — é a rota
    // inteira que importa aqui, não a posição atual do aparelho.
    if (paradas.length > 0) {
      import("mapbox-gl").then(({ default: mapboxgl }) => {
        const bounds = paradas.reduce(
          (b, p) => b.extend([p.lo, p.la]),
          new mapboxgl.LngLatBounds([paradas[0].lo, paradas[0].la], [paradas[0].lo, paradas[0].la]),
        )
        mapaPronto.fitBounds(bounds, { padding: 56, duration: 0 })
      })
    }
    // roda só quando o mapa fica pronto (paradas vêm de props estáveis, vindas do servidor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapaPronto])

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
          geometry: { type: "LineString", coordinates: [[perna.de.lo, perna.de.la], [perna.para.lo, perna.para.la]] },
        })
      }
    })
    sourceOk.setData({ type: "FeatureCollection", features: featuresOk })
    sourceFalha.setData({ type: "FeatureCollection", features: featuresFalha })
  }, [mapaPronto, viagem, pernasEstado])

  const dataFormatada = new Date(`${dataPrevista}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <main className="relative -mx-4 -mt-5 -mb-24 h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">{nome}</h1>
      <MapaNautico aoIniciar={setMapaPronto} className="h-full w-full" />

      <div className="absolute left-3 right-3 top-3 z-20">
        <button
          type="button"
          onClick={() => router.push("/navegar")}
          className="sombra-2 flex h-11 items-center gap-1.5 rounded-full border border-line bg-panel/95 px-4 text-sm font-medium backdrop-blur"
        >
          <Icone nome="voltar" className="size-4" />
          Navegar
        </button>
      </div>

      <div className="sombra-2 absolute inset-x-0 bottom-0 z-20 max-h-[62dvh] overflow-y-auto rounded-t-[18px] border-t border-line bg-panel/95 p-4 backdrop-blur">
        <h2 className="titulo-card">{nome}</h2>
        <p className="apoio mt-0.5 text-dim">{dataFormatada}</p>

        <div className="mt-3 space-y-1.5 border-t border-line pt-3">
          {viagem.pernas.map((perna, i) => {
            const estado = pernasEstado[i]
            return (
              <p key={i} className="apoio flex items-center justify-between gap-2 text-dim">
                <span className="truncate">
                  {i + 1}. {perna.de.nome} → {perna.para.nome}
                </span>
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
        </div>

        {velocidadeHistorica ? (
          <p className="apoio mt-3 border-t border-line pt-3 text-dim">ETA calculado {velocidadeHistorica.texto}.</p>
        ) : (
          <div className="mt-3 border-t border-line pt-3">
            <label className={rotulo} htmlFor="velocidade-ver-viagem">Velocidade de cruzeiro (kt) — pra ver o ETA</label>
            <input
              id="velocidade-ver-viagem"
              inputMode="decimal"
              value={velocidadeTexto}
              onChange={(e) => setVelocidadeTexto(e.target.value)}
              placeholder="Ex.: 18"
              className={`${campo} font-mono-instr tabular-nums`}
            />
            <p className="apoio mt-1 text-dim">Sem saída com trilha registrada ainda — não é salvo, só estima aqui.</p>
          </div>
        )}

        {/* Mesmos disclaimers do /navegar (web/components/mapa/navegar-mapa.tsx) — a rota
            planejada herda a mesma honestidade, não repete pior nem inventa um texto novo. */}
        <p className="apoio mt-3 border-t border-line pt-3 text-dim">
          Rota pela água — contorna a costa. Auxílio à navegação, não substitui a carta náutica.
        </p>
        {avisoCalado && (
          <p className={`apoio mt-2 ${avisoCalado.tom === "aviso" ? "text-warn" : "text-dim"}`}>
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
          <p className="apoio mt-2 text-dim">
            Considera passagens reais de outros barcos nesta área — não é garantia de profundidade, a carta náutica
            continua sendo a referência.
          </p>
        )}
      </div>
    </main>
  )
}

"use client"
import { useEffect, useRef } from "react"
import "mapbox-gl/dist/mapbox-gl.css"
import type { Map as MapaMapbox } from "mapbox-gl"
import { Icone } from "@/components/icone"
import type { PontoTrilha } from "@/lib/domain/geo"

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Dourado da marca (--acao em globals.css) — mesmo valor em claro/escuro, por
// isso pode ser fixo aqui em vez de ler a variável CSS (que o Mapbox GL, um
// canvas, não enxerga de qualquer forma).
const COR_TRILHA = "#d4af37"
const COR_INICIO = "#2fd07a"
const COR_FIM = "#ff5c5c"

/**
 * Preview pequeno e não-interativo do percurso de uma saída (onda 18 — a
 * saída como atividade). Mesmo padrão de token/degradação do MapaNautico
 * (web/components/mapa/mapa-nautico.tsx): sem NEXT_PUBLIC_MAPBOX_TOKEN,
 * degrada com aviso — nunca quebra a tela nem fica em branco mudo. Aqui não
 * tem painel de camadas nem controles de navegação: a trilha é o único dado,
 * `interactive: false` porque este cartão só ilustra, não navega.
 */
export function TrilhaMapa({ pontos, className }: { pontos: PontoTrilha[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<MapaMapbox | null>(null)

  useEffect(() => {
    if (!TOKEN || !containerRef.current || pontos.length < 2) return
    let cancelado = false

    // .catch: falha de rede no chunk não pode deixar um buraco mudo na tela
    // (mesmo cuidado do MapaNautico).
    import("mapbox-gl").catch(() => null).then((mod) => {
      if (!mod || cancelado || !containerRef.current) return
      const mapboxgl = mod.default
      // Mesmo stub do MapaNautico: contexto inseguro (shell nativo em dev
      // carregando HTTP por IP) esconde DeviceOrientationEvent e o
      // GeolocateControl do mapbox-gl referencia o global sem checar —
      // aqui nem usamos GeolocateControl, mas o import do pacote já toca
      // nesse caminho internamente.
      if (typeof window.DeviceOrientationEvent === "undefined") {
        ;(window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = function () {}
      }
      mapboxgl.accessToken = TOKEN

      const coordenadas: [number, number][] = pontos.map((p) => [p.lo, p.la])
      const bounds = coordenadas.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coordenadas[0], coordenadas[0]),
      )

      const mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        // Mesmo config "instrumento de bordo" do estilo náutico do
        // MapaNautico — cores desbotadas, sem rótulo de rodovia/POI.
        config: {
          basemap: {
            theme: "faded",
            lightPreset: "day",
            showRoadLabels: false,
            showTransitLabels: false,
            showPointOfInterestLabels: false,
            show3dObjects: false,
          },
        },
        bounds,
        fitBoundsOptions: { padding: 28, duration: 0 },
        interactive: false,
        attributionControl: false,
      })
      mapaRef.current = mapa

      mapa.on("load", () => {
        if (cancelado) return
        mapa.addSource("trilha", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coordenadas },
          },
        })
        mapa.addLayer({
          id: "trilha-linha",
          type: "line",
          source: "trilha",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": COR_TRILHA, "line-width": 3 },
        })
        // Pontas início/fim — mesma convenção de cor do TrilhaSvg (verde
        // partida, vermelho chegada) que este componente substitui.
        mapa.addSource("trilha-pontas", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              { type: "Feature", properties: { cor: COR_INICIO }, geometry: { type: "Point", coordinates: coordenadas[0] } },
              {
                type: "Feature",
                properties: { cor: COR_FIM },
                geometry: { type: "Point", coordinates: coordenadas[coordenadas.length - 1] },
              },
            ],
          },
        })
        mapa.addLayer({
          id: "trilha-pontas",
          type: "circle",
          source: "trilha-pontas",
          paint: {
            "circle-radius": 5,
            "circle-color": ["get", "cor"],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#0b1d2d",
          },
        })
        mapa.resize()
      })
      mapa.addControl(new mapboxgl.AttributionControl({ compact: true }))
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
    }
    // `pontos` muda só quando a saída exibida muda (a página é server
    // component, `pontos` vem de props estáveis por render) — recriar o mapa
    // inteiro nesse caso é o comportamento certo.
  }, [pontos])

  if (pontos.length < 2) return null

  if (!TOKEN) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border border-line bg-[#0B1D2D] p-6 text-center ${className ?? ""}`}
      >
        <Icone nome="mapa" className="size-7 text-[#D4AF37]" />
        <p className="apoio text-[#e9f1f8]">
          {process.env.NODE_ENV === "development"
            ? "O mapa precisa de configuração — adicione NEXT_PUBLIC_MAPBOX_TOKEN ao .env.local."
            : "Mapa indisponível no momento."}
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className={`overflow-hidden rounded-[14px] border border-line ${className ?? ""}`} />
}

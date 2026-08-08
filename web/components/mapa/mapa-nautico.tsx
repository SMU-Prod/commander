"use client"
import { useEffect, useRef } from "react"
import "mapbox-gl/dist/mapbox-gl.css"
import type { Map as MapaMapbox } from "mapbox-gl"
import { Icone } from "@/components/icone"

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Baía da Ilha Grande — praça inicial do Commander.
const CENTRO_PADRAO: [number, number] = [-44.14, -23.09]

/** Mapa náutico do Commander: Mapbox + sinalização do OpenSeaMap + posição do
 *  aparelho no talo (alta precisão, rumo, acompanhamento). Sem token, degrada
 *  com aviso — nunca quebra a tela. */
export function MapaNautico({
  aoIniciar,
  className,
}: {
  aoIniciar?: (mapa: MapaMapbox) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<MapaMapbox | null>(null)
  const aoIniciarRef = useRef(aoIniciar)
  useEffect(() => {
    aoIniciarRef.current = aoIniciar
  }, [aoIniciar])

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return
    let cancelado = false

    // .catch: falha de rede no chunk nao pode deixar um buraco mudo na tela
    import("mapbox-gl").catch(() => null).then((mod) => {
      if (!mod) return
      const mapboxgl = mod.default
      if (cancelado || !containerRef.current) return
      mapboxgl.accessToken = TOKEN
      const mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: CENTRO_PADRAO,
        zoom: 10,
        attributionControl: false,
        // Instrumento de bordo, nao mapa de carro: cores desbotadas (a
        // sinalizacao nautica do OpenSeaMap e quem pinta por cima), sem
        // placas de rodovia, sem transporte publico, sem POI de cidade.
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
      })
      mapa.addControl(new mapboxgl.AttributionControl({ compact: true }))
      mapa.addControl(new mapboxgl.ScaleControl({ unit: "nautical" }), "bottom-left")
      mapa.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right")
      mapa.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
          fitBoundsOptions: { maxZoom: 14 },
        }),
        "top-right",
      )
      mapa.on("load", () => {
        if (cancelado) return
        // Sinalização náutica (boias, faróis, marcas) — overlay CC-BY-SA.
        mapa.addSource("openseamap", {
          type: "raster",
          tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenSeaMap",
        })
        mapa.addLayer({ id: "openseamap", type: "raster", source: "openseamap" })
        // se o container foi medido antes do CSS/layout assentar, o canvas
        // fica com tamanho errado (mapa "branco") — remedir resolve
        mapa.resize()
        aoIniciarRef.current?.(mapa)
      })
      mapaRef.current = mapa
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
    }
  }, [])

  if (!TOKEN) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-[14px] border border-line bg-[#0B1D2D] p-8 text-center ${className ?? ""}`}
      >
        {/* o plano pedia "bussola", que nao existe no conjunto de 28 — "mapa" e o mais proximo */}
        <Icone nome="mapa" className="size-8 text-[#D4AF37]" />
        <p className="corpo text-[#e9f1f8]">
          {process.env.NODE_ENV === "development"
            ? "O mapa precisa de configuração — adicione NEXT_PUBLIC_MAPBOX_TOKEN ao .env.local."
            : "Mapa indisponível no momento."}
        </p>
      </div>
    )
  }

  return (
    // Tela cheia: o mapa É a tela; quem emoldura é quem usa (via className).
    <div className={`relative ${className ?? ""}`}>
      {/* h-full em vez de absolute/inset: o CSS do mapbox forca
          .mapboxgl-map{position:relative}, que vence o .absolute na cascata e
          colapsava a altura para 0 (mapa branco) */}
      <div ref={containerRef} className="h-full w-full" />
      <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 max-w-[calc(100%-1.5rem)] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-[#0B1D2D]/70 px-2.5 py-1 font-mono-instr text-[10px] uppercase tracking-[.08em] text-[#9fb3c8]">
        Auxílio à navegação · não substitui as cartas oficiais
      </p>
    </div>
  )
}

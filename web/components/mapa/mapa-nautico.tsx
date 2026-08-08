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

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado || !containerRef.current) return
      mapboxgl.accessToken = TOKEN
      const mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: CENTRO_PADRAO,
        zoom: 10,
        attributionControl: false,
      })
      mapa.addControl(new mapboxgl.AttributionControl({ compact: true }))
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
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-[14px]" />
      <p className="rotulo pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0B1D2D]/80 px-3 py-1.5 text-[#7c93ab]">
        Auxílio à navegação — não substitui as cartas náuticas oficiais
      </p>
    </div>
  )
}

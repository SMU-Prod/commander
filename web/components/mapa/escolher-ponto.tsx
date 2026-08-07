"use client"
import { useEffect, useRef, useState } from "react"
import "mapbox-gl/dist/mapbox-gl.css"
import type { Map as MapaMapbox, Marker as MarcadorMapbox } from "mapbox-gl"
import { campo, rot } from "@/lib/ui/form"

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Guanabara Bay — centro padrão quando o parceiro ainda não tem ponto salvo.
const PADRAO = { lat: -22.83, lng: -43.15 }

/** Escolhe o ponto no mapa do parceiro (marina/posto/pousada/restaurante).
 *  Componente único desta tela — não é para reuso em outro lugar do app. */
export function EscolherPonto({ lat, lng }: { lat: number | null; lng: number | null }) {
  const [coords, setCoords] = useState({ lat: lat ?? PADRAO.lat, lng: lng ?? PADRAO.lng })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapaRef = useRef<MapaMapbox | null>(null)
  const marcadorRef = useRef<MarcadorMapbox | null>(null)

  useEffect(() => {
    if (!TOKEN || !containerRef.current) return
    let cancelado = false

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelado || !containerRef.current) return
      mapboxgl.accessToken = TOKEN
      const mapa = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [coords.lng, coords.lat],
        zoom: 12,
      })
      const marcador = new mapboxgl.Marker({ draggable: true })
        .setLngLat([coords.lng, coords.lat])
        .addTo(mapa)
      marcador.on("dragend", () => {
        const p = marcador.getLngLat()
        setCoords({ lat: p.lat, lng: p.lng })
      })
      mapaRef.current = mapa
      marcadorRef.current = marcador
    })

    return () => {
      cancelado = true
      marcadorRef.current?.remove()
      mapaRef.current?.remove()
    }
    // Inicializa o mapa uma única vez; o arraste do marcador atualiza `coords` por fora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!TOKEN) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lat" className={rot}>Latitude</label>
            <input
              id="lat" name="lat" type="number" step="any" required
              defaultValue={lat ?? ""} placeholder="-22.9068" className={campo}
            />
          </div>
          <div>
            <label htmlFor="lng" className={rot}>Longitude</label>
            <input
              id="lng" name="lng" type="number" step="any" required
              defaultValue={lng ?? ""} placeholder="-43.1729" className={campo}
            />
          </div>
        </div>
        <p className="apoio text-dim">
          Cole do Google Maps — toque e segure o ponto certo no mapa, copie os dois números que aparecem.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-[14px] border border-line" />
      <input type="hidden" name="lat" value={coords.lat} />
      <input type="hidden" name="lng" value={coords.lng} />
      <p className="apoio mt-1.5 text-dim">
        Arraste o marcador até o ponto certo — {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
      </p>
    </div>
  )
}

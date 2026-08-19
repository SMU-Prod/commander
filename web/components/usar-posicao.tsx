"use client"
import { useState } from "react"

export function UsarPosicao() {
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function usar() {
    if (ocupado) return
    if (!("geolocation" in navigator)) {
      setMsg("Este navegador não fornece localização.")
      return
    }
    setOcupado(true)
    setMsg("Obtendo posição…")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = document.getElementById("lat") as HTMLInputElement | null
        const lon = document.getElementById("lon") as HTMLInputElement | null
        if (lat) lat.value = p.coords.latitude.toFixed(6)
        if (lon) lon.value = p.coords.longitude.toFixed(6)
        setMsg("Posição preenchida — confira e salve.")
        setOcupado(false)
      },
      () => {
        setMsg("Não foi possível obter a posição. Preencha manualmente ou tente de novo.")
        setOcupado(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <div>
      <button type="button" onClick={usar} disabled={ocupado}
        className="w-full rounded-[var(--raio-controle)] border border-line py-3 text-sm font-medium disabled:opacity-60">
        Usar minha posição atual
      </button>
      {msg && <p className="mt-2 text-xs text-dim">{msg}</p>}
    </div>
  )
}

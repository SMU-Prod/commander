"use client"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import posthog from "posthog-js"

const CHAVE = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

let iniciado = false
function garantir() {
  if (!CHAVE || iniciado) return
  posthog.init(CHAVE, { api_host: HOST, capture_pageview: false, autocapture: false })
  iniciado = true
}

/** Evento manual (ex.: capturar("cta_fundador")). No-op sem chave. */
export function capturar(evento: string, props?: Record<string, string | number>) {
  if (!CHAVE) return
  garantir()
  posthog.capture(evento, props)
}

export function Analytics() {
  const pathname = usePathname()
  useEffect(() => {
    if (!CHAVE) return
    garantir()
    posthog.capture("$pageview")
  }, [pathname])
  return null
}

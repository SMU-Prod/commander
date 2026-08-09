"use client"
import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"

/** Onda 15 ("motor vivo") — aviso mostrado só dentro do shell nativo
 *  (Capacitor Android/iOS empacotado): o WebView não renderiza PDF, então
 *  o link do manual abre no leitor externo do aparelho e o fragmento
 *  `#page=N` pode se perder no caminho. No navegador comum (inclui o PWA
 *  instalado) o próprio visor de PDF do navegador respeita `#page=N`, sem
 *  nada a avisar. Nunca finge que a página certa abre onde ela não abre —
 *  mesma régua de honestidade nativa do resto do app (ver
 *  docs/CONTRIBUTING.md). Client component só por causa do
 *  `Capacitor.isNativePlatform()`, que só existe no browser: o servidor
 *  não sabe em qual shell a página vai ser aberta. */
export function DicaLeitorNativo() {
  const [nativo, setNativo] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado inicial com o shell pos-hydration (mesmo padrão de components/theme-toggle.tsx)
    setNativo(Capacitor.isNativePlatform())
  }, [])
  if (!nativo) return null
  return <span className="apoio block text-dim">abre no seu leitor de PDF</span>
}

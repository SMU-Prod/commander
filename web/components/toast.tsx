"use client"
import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Icone } from "@/components/icone"

export function Toast() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const mensagem = params.get("ok")

  useEffect(() => {
    if (!mensagem) return
    const t = setTimeout(() => {
      const restantes = new URLSearchParams(params.toString())
      restantes.delete("ok")
      const query = restantes.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, 3000)
    return () => clearTimeout(t)
  }, [mensagem, params, pathname, router])

  if (!mensagem) return null
  return (
    <div role="status" aria-live="polite"
      className="no-imprimir sombra-2 fixed inset-x-4 top-4 z-40 mx-auto flex max-w-[400px] items-center gap-2 rounded-[12px] border border-ok/40 bg-panel px-3.5 py-3">
      <Icone nome="escudo" className="size-4 text-ok" />
      <p className="corpo">{mensagem}</p>
    </div>
  )
}

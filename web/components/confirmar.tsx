"use client"
import { useState } from "react"

export function Confirmar({
  mensagem,
  rotulo,
  className = "text-xs text-crit",
  children,
}: {
  mensagem: string
  rotulo: string
  className?: string
  children?: React.ReactNode
}) {
  const [pedindo, setPedindo] = useState(false)

  if (!pedindo) {
    return (
      <button type="button" onClick={() => setPedindo(true)} className={className} aria-label={rotulo}>
        {children ?? rotulo}
      </button>
    )
  }
  return (
    <span className="flex items-center gap-2">
      <span className="apoio text-dim">{mensagem}</span>
      <button type="submit" className="rounded-lg bg-crit px-2.5 py-1.5 text-xs font-semibold text-white">
        Confirmar
      </button>
      <button type="button" onClick={() => setPedindo(false)} className="px-2 py-1.5 text-xs text-dim">
        Cancelar
      </button>
    </span>
  )
}

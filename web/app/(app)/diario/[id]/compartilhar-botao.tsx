"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"

type Status = "ocioso" | "copiado" | "erro"

const ROTULO: Record<Status, string> = {
  ocioso: "Compartilhar",
  copiado: "Copiado para a área de transferência",
  erro: "Não foi possível copiar",
}

/**
 * Botão de compartilhar a saída (onda 18). Web Share API quando o aparelho
 * tem (a maioria dos celulares); onde não tem — desktop, principalmente —
 * cai pro clipboard com confirmação visível no próprio botão. Se a pessoa
 * cancelou a folha nativa de compartilhamento (AbortError), respeita o
 * cancelamento e não faz nada — nunca copia por baixo dos panos sem avisar.
 */
export function CompartilharBotao({ texto }: { texto: string }) {
  const [status, setStatus] = useState<Status>("ocioso")

  async function copiarParaClipboard() {
    try {
      await navigator.clipboard.writeText(texto)
      setStatus("copiado")
    } catch {
      setStatus("erro")
    }
    setTimeout(() => setStatus("ocioso"), 2500)
  }

  async function compartilhar() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: texto })
      } catch (erro) {
        if (erro instanceof Error && erro.name === "AbortError") return
        await copiarParaClipboard()
      }
      return
    }
    await copiarParaClipboard()
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-panel px-4 py-3 text-sm font-semibold text-accent-forte"
    >
      <Icone nome="compartilhar" className="size-4" />
      {ROTULO[status]}
    </button>
  )
}

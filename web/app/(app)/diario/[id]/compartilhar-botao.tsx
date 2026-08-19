"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"
import { BASE_BOTAO_FICHA } from "@/components/ui/botao-ficha"

type Status = "ocioso" | "copiado" | "erro"

// ONDA 92 — os dois rótulos de retorno encurtaram porque o botão saiu do
// rodapé (bloco de largura inteira, onde texto longo cabia) e virou pílula da
// barra de ações da ficha, que é `whitespace-nowrap`. "Texto copiado" preserva
// a informação que importava na frase antiga — o compartilhamento nativo não
// abriu, o conteúdo foi pra área de transferência —, e cabe em 390px.
const ROTULO: Record<Status, string> = {
  ocioso: "Compartilhar",
  copiado: "Texto copiado",
  erro: "Não deu para copiar",
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
    // O vestido é o `BASE_BOTAO_FICHA` (spec §3 item 3), composto a partir da
    // BASE e não de `classesBotaoFicha("contorno")`: este botão é dourado no
    // contorno e no texto, e somar `border-*`/`text-*` por cima de uma variante
    // que já os declara é loteria de ordem de CSS — o mesmo motivo, letra por
    // letra, pelo qual o botão de excluir da ficha de equipamento compõe da
    // base pura (ver `botao-ficha.tsx`).
    <button
      type="button"
      onClick={compartilhar}
      className={`${BASE_BOTAO_FICHA} border-accent/40 bg-panel text-accent-forte`}
    >
      <Icone nome="compartilhar" className="size-4" />
      {ROTULO[status]}
    </button>
  )
}

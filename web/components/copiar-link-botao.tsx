"use client"
import { useState } from "react"
import { Icone } from "@/components/icone"
import { ALVO_ACAO, PILULA_ACAO } from "@/lib/ui/acoes"

type Status = "ocioso" | "copiado" | "erro"

const ROTULO: Record<Status, string> = {
  ocioso: "Copiar link",
  copiado: "Link copiado",
  erro: "Não deu para copiar",
}

/**
 * COPIAR LINK — o caminho que faltava ao convite (relato do dono, 20/08).
 * ===========================================================================
 * O convite da Tripulação só oferecia "Compartilhar no WhatsApp", e o `wa.me`
 * abre o WhatsApp COMUM — quem usa o Business cai no app errado, e quem quer
 * mandar por e-mail, SMS ou Telegram não tinha caminho nenhum. O link em si
 * aparecia como texto, mas selecionar uma URL de 60 caracteres na mão, no
 * celular, é o tipo de fricção que o dono descreve como "pequenas coisas".
 *
 * Um botão, uma responsabilidade: põe o link na área de transferência e
 * confirma NO PRÓPRIO RÓTULO (o mesmo desenho de `CompartilharBotao` do
 * Diário — a confirmação aparece onde o dedo acabou de tocar, sem toast).
 * Com o link copiado, a pessoa cola onde quiser — Business incluído.
 * Veste `PILULA_ACAO` para sentar ao lado do botão de WhatsApp como par.
 */
export function CopiarLinkBotao({ link }: { link: string }) {
  const [status, setStatus] = useState<Status>("ocioso")

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setStatus("copiado")
    } catch {
      setStatus("erro")
    }
    setTimeout(() => setStatus("ocioso"), 2500)
  }

  return (
    <button type="button" onClick={copiar} className={ALVO_ACAO}>
      <span className={PILULA_ACAO} aria-live="polite">
        <Icone nome={status === "copiado" ? "check" : "copiar"} className="size-4" />
        {ROTULO[status]}
      </span>
    </button>
  )
}

"use client"

import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"

/**
 * ONDA 125 — O IRMÃO SOB MEDIDA DO `BotaoEnviar`.
 * ===========================================================================
 * Relato do dono, 20/08: *"temos muitas páginas que clicamos nos botões e não
 * tem feedback visual de carregamento"*. A varredura confirmou: 13 arquivos
 * de formulário sem aviso de envio — e vários deles NÃO PODEM vestir o
 * `BotaoEnviar`, porque o desenho do botão pertence à tela: o disco de
 * excluir sobre a foto, a célula "Capa" da grade do álbum, a pílula de
 * `ALVO_ACAO` do "Paguei"/"Sair da conta".
 *
 * Este componente carrega só o COMPORTAMENTO — `disabled` + `aria-busy` +
 * pulso durante o envio — e deixa o desenho 100% com quem chama. O pulso é
 * `animate-pulse` na peça inteira: o mesmo vocabulário de "algo acontecendo"
 * do resto do app (BotaoEnviar, esqueletos), nunca um segundo (anel girando
 * seria drift, e congela mal sob `prefers-reduced-motion` — ver a discussão
 * no cabeçalho do BotaoEnviar).
 *
 * POR QUE É UM COMPONENTE, de novo: `useFormStatus` só enxerga o `<form>`
 * ANCESTRAL. Chamado no mesmo componente que renderiza o `<form>`, devolve
 * `pending: false` para sempre, sem quebrar nada — o bug silencioso perfeito.
 * Sendo componente, entrar como filho do `<form>` é o único jeito de usar.
 *
 * O `disabled` não bloqueia o primeiro envio (o navegador recolhe o FormData
 * no instante do submit); ele come o SEGUNDO toque — o que gravava duas
 * vezes.
 */
export function BotaoPendente({
  className = "",
  "aria-label": ariaLabel,
  children,
}: {
  className?: string
  "aria-label"?: string
  children: ReactNode
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      className={`${className} ${pending ? "animate-pulse" : ""}`}
    >
      {children}
    </button>
  )
}

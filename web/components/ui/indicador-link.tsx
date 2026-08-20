"use client"

import { useLinkStatus } from "next/link"

/**
 * ONDA 125 — O FILTRO AVISA QUE ESTÁ TROCANDO.
 * ===========================================================================
 * O buraco que os 15 `loading.tsx` não cobrem: navegação que só muda a QUERY
 * da mesma rota — trocar de álbum em /barco/fotos, de filtro no Diário, de
 * mês no Financeiro. O App Router não desenha `loading.tsx` nesses casos; a
 * tela velha fica parada até a nova chegar do servidor, e é exatamente o
 * *"clico e não tem feedback"* do relato do dono (20/08).
 *
 * `useLinkStatus` (next/link) lê o estado do `<Link>` ANCESTRAL — mesma
 * regra de lugar do `useFormStatus`, mesma solução: um componente que só
 * funciona no lugar certo. O `Chip` põe este indicador DENTRO do Link, e o
 * ponto pulsante aparece no chip tocado enquanto a resposta não vem — o
 * mesmo ponto do `BotaoEnviar`, porque é o mesmo aviso ("pedi, estou
 * esperando"), e vocabulário de espera se tem UM.
 *
 * Nada aparece em navegação instantânea (rota já no cache do router): o
 * pending não chega a virar frame — o ponto não pisca à toa.
 */
export function IndicadorLink() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden="true"
      className="size-1.5 shrink-0 animate-pulse rounded-[var(--raio-pilula)] bg-current"
    />
  )
}

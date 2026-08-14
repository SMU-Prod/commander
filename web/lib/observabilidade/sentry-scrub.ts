import type { ErrorEvent } from "@sentry/nextjs"

/** Nomes de parâmetro de URL (query string) que podem carregar coordenada de
 *  GPS ou outro dado sensível de navegação — mesmo com `sendDefaultPii:
 *  false` (que já tira IP/cookies/headers/corpo do evento por padrão), a URL
 *  em si ainda vai no evento, e o Commander tem link profundo com coordenada
 *  na query (`?destino_la=&destino_lo=&destino_nome=`, ver
 *  `app/(app)/navegar/page.tsx`). Nunca deixar isso vazar pro Sentry. */
const PARAMS_SENSIVEIS = [
  "destino_la",
  "destino_lo",
  "destino_nome",
  "lat",
  "lon",
  "lng",
  "latitude",
  "longitude",
  "email",
  "senha",
  "password",
  "token",
]

function higienizarUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    for (const chave of PARAMS_SENSIVEIS) {
      if (u.searchParams.has(chave)) u.searchParams.set(chave, "[removido]")
    }
    return u.toString()
  } catch {
    // URL relativa ou malformada — devolve como veio, nao trava o evento
    return url
  }
}

/** Higienização defensiva de todo evento ANTES de sair pro Sentry —
 *  "defense in depth" em cima do `sendDefaultPii: false` (ver comentário nos
 *  arquivos `sentry.*.config.ts`). O Commander lida com dado sensível de
 *  verdade (GPS, trilha de navegação, documento de embarcação, contato de
 *  tripulação) — isso é requisito do produto, não opção:
 *
 *  1. Nunca manda o corpo (`request.data`), cookies ou headers do request,
 *     mesmo que algum código futuro os anexe manualmente ao evento.
 *  2. Nunca manda `user` (nem e-mail nem id) — o Sentry não precisa saber
 *     QUEM teve o erro pra ajudar a corrigir o bug.
 *  3. Redige parâmetros de URL com coordenada/credencial (ver
 *     `PARAMS_SENSIVEIS`), tanto na URL principal quanto em breadcrumbs de
 *     fetch/xhr (o rastro de chamadas que antecedem o erro).
 */
export function higienizarEvento<E extends ErrorEvent>(event: E): E {
  if (event.request) {
    event.request.url = higienizarUrl(event.request.url)
    delete event.request.data
    delete event.request.cookies
    delete event.request.headers
  }
  delete event.user

  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if ((b.category === "fetch" || b.category === "xhr") && b.data) {
        if (typeof b.data.url === "string") b.data.url = higienizarUrl(b.data.url)
      }
    }
  }

  return event
}

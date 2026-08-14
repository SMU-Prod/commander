import * as Sentry from "@sentry/nextjs"
import { higienizarEvento } from "@/lib/observabilidade/sentry-scrub"

// Onda 31 (robustez) — observabilidade de erro no runtime EDGE
// (`middleware.ts`, que roda em toda navegação autenticada). Registrado por
// `instrumentation.ts`. Mesmas regras de privacidade e mesmo no-op sem DSN
// dos outros dois configs (`instrumentation-client.ts` / `sentry.server.config.ts`)
// — ver comentário completo lá.
const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    beforeSend: higienizarEvento,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
  })
}

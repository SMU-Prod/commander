import * as Sentry from "@sentry/nextjs"
import { higienizarEvento } from "@/lib/observabilidade/sentry-scrub"

// Onda 31 (robustez) — observabilidade de erro no SERVIDOR (rotas /api,
// server actions, middleware em runtime Node). Registrado por
// `instrumentation.ts` (convenção do Next.js App Router).
//
// `SENTRY_DSN` (privada, só servidor) com fallback pra
// `NEXT_PUBLIC_SENTRY_DSN` — na prática, uma chave só já basta; a variável
// privada existe pra quem quiser um projeto Sentry separado de cliente e
// servidor. Sem NENHUMA das duas, `Sentry.init` nunca é chamado: zero
// request de rede, zero overhead — mesmo padrão de no-op do PostHog (ver
// `components/analytics.tsx`).
const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,

    // PRIVACIDADE — requisito do produto, não opção. O servidor é onde
    // mais importa: é aqui que passam SUPABASE_SERVICE_ROLE_KEY,
    // ALERTAS_SEGREDO e o corpo bruto de toda escrita (sondagem, trilha,
    // documento). `sendDefaultPii: false` (default do SDK, explícito de
    // propósito) garante que IP, cookies, headers e corpo de
    // request/response NUNCA são anexados automaticamente ao evento.
    // `beforeSend` faz uma segunda passada (ver
    // `lib/observabilidade/sentry-scrub.ts`): tira `user`, redige
    // coordenada em query string e limpa breadcrumbs de fetch.
    sendDefaultPii: false,
    beforeSend: higienizarEvento,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
  })
}

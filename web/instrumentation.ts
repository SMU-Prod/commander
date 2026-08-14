import * as Sentry from "@sentry/nextjs"

// Convenção do Next.js App Router: este arquivo roda uma vez, cedo, em cada
// runtime do servidor. `register()` carrega o config certo pro runtime atual
// — os dois arquivos (`sentry.server.config.ts` / `sentry.edge.config.ts`)
// são no-op sem DSN configurada (ver comentário em cada um).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Captura erros que escapam de Server Components/rotas antes de virar uma
// resposta de erro genérica — só reporta de verdade quando algum dos
// configs acima chamou `Sentry.init` (DSN presente); sem DSN, a própria SDK
// não inicializada trata isso como no-op.
export const onRequestError = Sentry.captureRequestError

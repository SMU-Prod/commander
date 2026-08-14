import * as Sentry from "@sentry/nextjs"
import { higienizarEvento } from "@/lib/observabilidade/sentry-scrub"

// Onda 31 (robustez) — observabilidade de erro no CLIENTE (navegador).
//
// Sem `NEXT_PUBLIC_SENTRY_DSN` configurada, `Sentry.init` nunca é chamado —
// zero request de rede, zero overhead, app funciona idêntico a antes. Mesmo
// padrão de no-op que já existe pro PostHog (ver `components/analytics.tsx`,
// `if (!CHAVE) return`).
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,

    // PRIVACIDADE — requisito do produto, não opção (o Commander lida com
    // GPS, trilha de navegação e documento de embarcação):
    // - `sendDefaultPii: false` é o DEFAULT do SDK, mantido explícito aqui
    //   de propósito: impede a coleta automática de IP, cookies, headers e
    //   corpo de request/response nos eventos.
    // - Nenhuma integração de Session Replay é habilitada. Replay grava
    //   tela/DOM — o mapa náutico e o painel do barco mostram posição e
    //   dado sensível o tempo todo; o risco de vazar isso num replay não
    //   compensa o ganho de debug.
    // - `beforeSend` (ver `lib/observabilidade/sentry-scrub.ts`) faz uma
    //   segunda passada de limpeza em cima disso: tira `user`, redige
    //   coordenada em query string (`?destino_la=&destino_lo=`) e limpa
    //   breadcrumbs de fetch/xhr.
    sendDefaultPii: false,
    beforeSend: higienizarEvento,

    // Sinal de erro é o que importa aqui — não é um APM completo. Amostra
    // baixa de performance só em produção; zero em dev (não gera ruído
    // local nem consome quota do free tier durante desenvolvimento).
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
  })
}

// Necessário pro App Router capturar erros de transição de rota — só tem
// efeito quando o SDK foi inicializado (DSN presente); com Sentry.init nunca
// chamado, a própria função da SDK não inicializada é um no-op seguro.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

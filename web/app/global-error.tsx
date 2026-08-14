"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

// Onda 31 (robustez) — rede de segurança pro caso raro de erro DENTRO do
// próprio `app/layout.tsx` (o `error.tsx` normal não cobre isso, porque ele
// também vive dentro do layout — se o layout quebrar, o boundary comum
// quebra junto). Precisa renderizar <html>/<body> própios porque o layout
// raiz pode não ter chegado a montar. Sem DSN configurada,
// `captureException` é no-op — mesmo padrão do resto da observabilidade.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "24px",
            fontFamily: "sans-serif",
          }}
        >
          <h1>Algo deu errado</h1>
          <p>Não foi possível carregar o Commander. Recarregue a página.</p>
        </main>
      </body>
    </html>
  )
}

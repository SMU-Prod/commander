import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/hoje",
        "/barco",
        // Onda 103 — o índice "Meu barco" (§2.1 da spec de 19/08). Entra pelo
        // mesmo motivo de todas as outras: é tela de dentro do app, atrás de
        // sessão, e não tem o que indexar.
        "/meu-barco",
        "/agenda",
        "/diario",
        "/menu",
        "/rede",
        "/comandantes",
        "/prestadores",
        // "/servicos" foi alias da aba eliminada na onda 46 (PRD §10, §27.2) e
        // voltou a ser destino na onda 103 — é o quinto item do menu do §2.1,
        // o índice da rede náutica (o porquê está em
        // `app/(app)/servicos/page.tsx`). Continua NA lista de qualquer forma:
        // agora não por ser redirecionamento, mas por ser tela de dentro do
        // app, como "/barco" e "/menu". O `?categoria=` que ele ainda
        // redireciona é mais um motivo pra não convidar rastreador.
        "/servicos",
        "/oportunidades",
        "/marketplace",
        "/explorar",
        "/navegar",
        "/notificacoes",
        "/assinar",
        "/onboarding",
        "/convite",
        "/admin",
        "/consultor",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}

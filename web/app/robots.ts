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
        "/diario",
        "/menu",
        "/rede",
        "/comandantes",
        "/prestadores",
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

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
        "/agenda",
        "/diario",
        "/menu",
        "/rede",
        "/comandantes",
        "/prestadores",
        // Onda 46: a ABA Serviços deixou de existir (PRD §10, §27.2) e
        // "/servicos" virou só alias que redireciona pra /prestadores. Fica
        // NA lista mesmo assim, pelo mesmo motivo de "/oportunidades" logo
        // abaixo (o outro alias da mesma família): rota que só existe pra
        // link velho não tem por que ser rastreada, e tirar daqui seria
        // convidar o buscador a indexar um redirecionamento.
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

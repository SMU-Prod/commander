import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    // Onda 25 — /parceiros é a nova página pública de vendas pro parceiro
    // comercial (marina/posto/pousada/restaurante); antes só existia o
    // formulário logado (/parceiro), que não fazia sentido indexar.
    { url: `${APP_URL}/parceiros`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ]
}

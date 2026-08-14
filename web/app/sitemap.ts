import type { MetadataRoute } from "next"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    // Onda 25 — /parceiros é a nova página pública de vendas pro parceiro
    // comercial (marina/posto/pousada/restaurante); antes só existia o
    // formulário logado (/parceiro), que não fazia sentido indexar.
    { url: `${APP_URL}/parceiros`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    // Onda 30 — Termos e Privacidade são públicas (ver rotaPublica em
    // middleware.ts) e ficam melhor indexadas do que escondidas.
    { url: `${APP_URL}/termos`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_URL}/privacidade`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ]
}

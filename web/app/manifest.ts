import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Commander — Gestão completa da sua embarcação",
    short_name: "Commander",
    description: "Documentação, manutenção e histórico do seu barco num lugar só.",
    start_url: "/hoje",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#0b1d2d",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

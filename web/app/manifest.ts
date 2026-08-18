import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    // "Gestão" é palavra proibida pela narrativa do produto (PRD/CONTRIBUTING:
    // o Commander é o DOSSIÊ do barco, não um sistema de gestão) — e este é o
    // nome que aparece embaixo do ícone no iPhone do dono. A auditoria de CMO
    // (18/08) achou aqui a contradição mais cara por caractere do app.
    name: "Commander — o dossiê do seu barco",
    short_name: "Commander",
    description: "Documentação, manutenção e histórico do seu barco num lugar só.",
    start_url: "/hoje",
    display: "standalone",
    // O escuro virou o padrão do app (spec fundação §7) — o splash do PWA
    // abre na mesma cor do fundo real, sem flash claro.
    background_color: "#0a0e12",
    theme_color: "#0a0e12",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

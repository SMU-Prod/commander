import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  // Onda 14 (app nativo): em dev, o shell Capacitor acessa o `next dev`
  // por IP (10.0.2.2 = alias do host visto de dentro do emulador Android;
  // o IP da LAN e pro celular fisico). Sem listar as origens aqui o Next
  // devolve 403 em parte dos chunks /_next/* — sintoma real vivido: mapa
  // branco no emulador porque o chunk do mapbox-gl era barrado e o
  // import() dinamico engolia a falha. So vale pra dev; producao serve do
  // dominio publicado.
  allowedDevOrigins: ["10.0.2.2", "192.168.3.9"],
};

export default nextConfig;

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
  // Onda 25 (auditoria CTO P1) — headers minimos de seguranca em toda
  // resposta. App autenticado com dados pessoais (embarcacao, gastos,
  // contatos) servia so com os headers default do Next/Vercel ate aqui.
  //
  // CSP (Content-Security-Policy) fica de FORA de proposito — nao e
  // esquecimento, e risco calculado: o app carrega workers/blob do
  // mapbox-gl (tiles + o Worker de rota em components/mapa/rota.worker.ts),
  // websocket do Supabase Realtime, fontes do Google Fonts via
  // next/font e o proprio Vercel Analytics — uma CSP mal calibrada aqui
  // quebra o mapa em produção (pior que nao ter CSP nenhuma). Registrado
  // como P2 em docs/auditoria/2026-08-12-cto.md — precisa de um
  // levantamento dedicado de todas as origens antes de ligar.
  //
  // Permissions-Policy: so restringe o que o app REALMENTE nao usa. O
  // Commander usa geolocalizacao ativamente (GPS em /navegar, alarme de
  // ancora, trilha) — geolocation=(self) mantem isso liberado pro proprio
  // dominio e nega o resto (camera, microfone, etc., que o app nao usa).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Equivalente a X-Frame-Options: DENY, via CSP (frame-ancestors
          // tem suporte melhor e e a recomendacao atual — X-Frame-Options
          // esta em modo legado/descontinuado nas specs mais novas).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

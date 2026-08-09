import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Onda 14 — shell nativo (Capacitor) do Commander.
 *
 * O Commander e Next.js 16 com server components e server actions: nao da
 * pra `output: "export"` (quebraria SSR, server actions, rotas de API).
 * Entao o app nativo NAO empacota os assets web dentro do APK/IPA — ele
 * abre a URL do app publicado dentro do WebView nativo (`server.url`
 * abaixo) e so os PLUGINS nativos (socket NMEA, GPS em segundo plano) sao
 * codigo de verdade rodando no dispositivo. Isso e um uso documentado do
 * Capacitor (https://capacitorjs.com/docs/config, propriedade `server`),
 * normalmente descrito pra live-reload — aqui reaproveitado pra sempre
 * carregar o deploy real (dev: IP da LAN; producao: o dominio publicado).
 *
 * `webDir` ainda e obrigatorio pro `npx cap sync` gerar o projeto nativo
 * (copia a ponte JS do Capacitor pra dentro do APK/IPA e serve de pagina
 * de fallback se o dispositivo abrir o app sem rede) — aponta pra
 * `capacitor/www/`, uma pasta placeholder que NAO faz parte do build do
 * Next (nao conflita com `.next/` nem com `output: "export"`).
 *
 * AVISO DE APP STORE (documentar, nao deixar implicito): a Apple rejeita
 * apps que sao "so um site num WebView" (App Store Review Guideline 4.2 —
 * Minimum Functionality). A defesa do Commander e ter capacidade nativa
 * REAL que o navegador nao da: socket TCP/UDP pro ecobatimetro (plugin
 * `NmeaSocket`, ver `android/`/`ios/`), GPS em segundo plano pro alarme de
 * ancora e a trilha (ver `docs/APP-NATIVO.md`, secao GPS) e fila offline
 * de sondagem. Sem pelo menos o socket NMEA funcionando de verdade no
 * device, a submissao para review deve esperar — publicar so o shell
 * remoto arrisca rejeicao.
 */

/** URL do app a carregar dentro do WebView nativo. Resolvida NESTA ORDEM
 *  (nunca fixa no codigo):
 *  1. `CAPACITOR_SERVER_URL` — setada explicitamente pra rodar contra o
 *     dev server na rede local (ex.: `http://192.168.15.42:3010`) ou
 *     contra um preview da Vercel durante teste.
 *  2. `NEXT_PUBLIC_APP_URL` — a mesma env que o proprio Next usa pra
 *     montar links absolutos (`web/app/layout.tsx`, `sitemap.ts`, convite
 *     de tripulacao); em producao ja aponta pro dominio publicado.
 *  3. Fallback de producao documentado (`web/.env.example`):
 *     `https://commander.soumardivers.com`.
 *
 *  Ver `docs/APP-NATIVO.md` pra como apontar pro IP da LAN durante o
 *  desenvolvimento (o simulador do emulador/device precisa alcancar a
 *  maquina que roda `next dev`, `localhost` de dentro do device/emulador
 *  nao chega la). */
function resolverServerUrl(): string {
  return (
    process.env.CAPACITOR_SERVER_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://commander.soumardivers.com"
  )
}

/** `cleartext` (HTTP sem TLS) so faz sentido pro caso de dev na LAN — a
 *  producao e sempre HTTPS. Decidido pelo PROTOCOLO da URL resolvida, nao
 *  por uma flag separada que alguem podia esquecer de desligar: se a URL
 *  e `http://`, o Android bloquearia cleartext por padrao (API 28+) e o
 *  app ficaria em branco sem isso. */
function ehHttp(url: string): boolean {
  return url.startsWith("http://")
}

/** Origens extras que o WebView pode navegar sem sair pro navegador do
 *  sistema, alem da propria URL do server. Por padrao so o host resolvido
 *  acima; `CAPACITOR_ALLOW_NAVIGATION` aceita uma lista separada por
 *  virgula pra somar outras (ex.: preview URLs da Vercel durante teste
 *  `*.vercel.app`, ou um provedor de auth com redirect proprio no futuro
 *  — hoje o Commander nao tem OAuth externo). Links que abrem fora dessa
 *  lista (WhatsApp, Asaas checkout) continuam indo pro navegador/app
 *  externo — comportamento padrao do Capacitor, e o certo pra esses casos. */
function resolverAllowNavigation(serverUrl: string): string[] {
  const host = new URL(serverUrl).hostname
  const extras = (process.env.CAPACITOR_ALLOW_NAVIGATION ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return [host, `*.${host}`, ...extras]
}

const serverUrl = resolverServerUrl()

const config: CapacitorConfig = {
  appId: "br.com.soumardivers.commander",
  appName: "Commander",
  webDir: "capacitor/www",
  server: {
    url: serverUrl,
    cleartext: ehHttp(serverUrl),
    allowNavigation: resolverAllowNavigation(serverUrl),
  },
  android: {
    // Trafego cleartext tambem precisa ser liberado no
    // AndroidManifest.xml (`usesCleartextTraffic`/network security config)
    // quando `server.cleartext` for true — ver android/app/src/main/res/xml
    // e docs/APP-NATIVO.md.
  },
  ios: {
    // iOS exige `NSAppTransportSecurity` com excecao explicita de dominio
    // pra permitir HTTP puro em dev — ver ios/App/App/Info.plist e
    // docs/APP-NATIVO.md.
  },
}

export default config

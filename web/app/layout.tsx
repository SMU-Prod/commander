import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import { Analytics } from "@/components/analytics"
import "./globals.css"

// Onda 62 — IBM Plex assume no lugar da Urbanist. Decisão do dono no canvas
// (docs/design-mobile/): a seção 2 testou três direções tipográficas e a 3
// consolidou IBM Plex — as 32 telas foram desenhadas nela. Sans pro texto e
// títulos; Mono pros números de instrumento E pros rótulos uppercase de
// cartão (.rotulo em globals.css / --font-mono-instr no @theme).
// IBM Plex no Google Fonts é família de pesos estáticos (não variable font),
// por isso os quatro pesos explícitos.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const DESCRICAO = "Manutenção em dia, documentos alertados e um histórico que vale dinheiro na hora de vender."

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Commander — o dossiê do seu barco",
  description: DESCRICAO,
  openGraph: {
    siteName: "Commander",
    title: "Commander — o dossiê do seu barco",
    description: DESCRICAO,
    locale: "pt_BR",
    type: "website",
    url: "/",
    // A imagem em si vem da convenção de arquivo (app/opengraph-image.tsx,
    // ImageResponse) — o Next já injeta og:image/og:image:width/height
    // automaticamente; não duplicar aqui.
  },
  // Onda 25 (auditoria CMO P0) — card do Twitter/X explícito. A imagem vem
  // da convenção de arquivo (app/twitter-image.tsx); "summary_large_image"
  // é o card retangular grande, coerente com o og:image 1200×630.
  twitter: {
    card: "summary_large_image",
    title: "Commander — o dossiê do seu barco",
    description: DESCRICAO,
  },
  icons: { apple: "/apple-touch-icon.png" },
}

export const viewport: Viewport = { themeColor: "#0a0e12", viewportFit: "cover" }

// O ESCURO É O PADRÃO (spec da fundação §7: "o tema escuro vira o padrão da
// vitrine"). A referência que o dono aprovou é escura; a onda 57 construiu a
// paleta inteira — e esta linha a deixava atrás de um toggle que ninguém
// apertava: o dono passou três ondas olhando o tema claro e chamando o app
// de genérico, com razão. O claro CONTINUA existindo (leitura sob sol na
// marina, Ajustes → Aparência) — só deixa de ser o que abre.
// Roda antes da pintura para não piscar claro em quem escolheu claro.
const temaInicial = `try{if(localStorage.getItem("tema")!=="light")document.documentElement.dataset.theme="dark"}catch(e){document.documentElement.dataset.theme="dark"}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // As classes de VARIÁVEL das fontes ficam no <html>, não no <body> — a
    // pilha --pilha-mono-instr (globals.css) é definida em :root e referencia
    // var(--font-plex-mono): custom property resolve var() no elemento onde
    // ELA é computada, então com a variável da fonte um nível abaixo (body) a
    // pilha computava "guaranteed-invalid" no html e todo mundo herdava o
    // inválido — rótulo e instrumento caíam silenciosamente na fonte do corpo.
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
        <Analytics />
        {children}
      </body>
    </html>
  )
}

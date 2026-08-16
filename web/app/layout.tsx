import type { Metadata, Viewport } from "next"
import { Urbanist } from "next/font/google"
import { Analytics } from "@/components/analytics"
import "./globals.css"

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urbanist",
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
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${urbanist.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
        <Analytics />
        {children}
      </body>
    </html>
  )
}

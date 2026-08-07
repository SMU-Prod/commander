import type { Metadata, Viewport } from "next"
import { Urbanist } from "next/font/google"
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
    title: "Commander — o dossiê do seu barco",
    description: DESCRICAO,
    locale: "pt_BR",
    type: "website",
    url: "/",
  },
  icons: { apple: "/apple-touch-icon.png" },
}

export const viewport: Viewport = { themeColor: "#f5f7fa", viewportFit: "cover" }

// Aplica o tema salvo antes da pintura para evitar flash ao recarregar no dark.
const temaInicial = `try{if(localStorage.getItem("tema")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${urbanist.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
        {children}
      </body>
    </html>
  )
}

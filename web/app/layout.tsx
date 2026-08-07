import type { Metadata, Viewport } from "next"
import { Urbanist } from "next/font/google"
import "./globals.css"

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urbanist",
})

export const metadata: Metadata = {
  title: "Commander",
  description: "Gestão completa da sua embarcação",
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

import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, Inter } from "next/font/google"
import { Analytics } from "@/components/analytics"
import "./globals.css"

/**
 * ONDA 80 — INTER NO LUGAR DA IBM PLEX SANS.
 *
 * A Plex entrou na onda 62 porque o canvas do dono foi desenhado nela. Ela
 * saiu porque, com a paleta e a anatomia da referência já no lugar, ela
 * virou a coisa mais visível separando o app do painel Haulix.
 *
 * O problema não é gosto, é o que cada família comunica. A Plex é uma
 * humanista de contraforma aberta, com 'a' de dois andares e 'g' de desenho
 * marcado — foi feita pra ser a voz da IBM em documentação técnica, e é
 * ótima nisso. A referência usa uma grotesca neutra, de aberturas fechadas e
 * tracking apertado, que some atrás do dado. Numa tela cheia de número, a
 * Plex chama atenção pra si; a grotesca deixa o número falar.
 *
 * Inter é a escolha: variable font (um arquivo, todos os pesos, menos bytes
 * que os quatro estáticos da Plex), desenhada pra tela em corpo pequeno, com
 * algarismos tabulares de verdade. É a família da maioria dos painéis
 * escuros bons — inclusive o que serve de referência aqui.
 *
 * A MONO FICA. O número de instrumento continua em IBM Plex Mono: ela já
 * está afinada com o resto do app (.rotulo, --font-mono-instr), tem a
 * largura fixa que mantém dígito alinhado em coluna, e na referência os
 * números de painel são visivelmente monoespaçados. Trocar as duas de uma
 * vez seria duas variáveis mudando no mesmo experimento.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-app",
  // A grotesca precisa de tracking negativo em título pra ler como a
  // referência; isso mora em globals.css, não aqui.
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

// `themeColor` pinta a barra do navegador/sistema — tem que ser o MESMO
// valor de `--fundo` do tema escuro, senão a moldura do celular fica de uma
// cor e o app de outra. Era o navy antigo até a onda 79 medir a paleta da
// referência e o chão virar cinza puro.
//
// É o único hexadecimal legítimo do app fora de globals.css: `Viewport` do
// Next é metadado estático, não CSS — não existe `var()` aqui. Por isso o
// teto de cor literal deste arquivo em `lib/ui/tokens.test.ts` é 1, e o
// número acima é ele. Nem em comentário cabe um segundo: o guarda conta
// ocorrência de hexadecimal no arquivo inteiro, comentário incluído.
export const viewport: Viewport = { themeColor: "#101010", viewportFit: "cover" }

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
    <html lang="pt-BR" className={`${inter.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: temaInicial }} />
        <Analytics />
        {children}
      </body>
    </html>
  )
}

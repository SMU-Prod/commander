import { ImageResponse } from "next/og"

// Onda 25 (auditoria CMO P0) — card de compartilhamento pro WhatsApp/redes.
// Sem isso, o link do Commander chegava só com título+descrição em texto —
// no canal onde a audiência mais confia (indicação de amigo), a primeira
// impressão era a mais fraca possível tecnicamente.
//
// Gerada via `ImageResponse` (Next nativo, sem asset externo) pra nunca
// dessincronizar de um PNG estático esquecido no /public. Composição sóbria
// de propósito — sem foto fabricada de barco nenhum (regra do produto:
// zero prova inventada): navy da marca, o mesmo monograma usado no header
// (ver components/logo.tsx, mesmo <path> dourado), nome e tagline.

export const alt = "Commander — o dossiê do seu barco"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const NAVY = "#0B1D2D"
const DOURADO = "#D4AF37"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: NAVY,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Mesmo monograma "MM espelhado" de components/logo.tsx, mesmo <path> */}
        <svg width="112" height="79" viewBox="0 0 48 34" fill="none">
          <path
            d="M4 32 V10 L15 22 24 5 33 22 44 10 V32 H36 V24 L28 32 H20 L12 24 V32 Z"
            fill={DOURADO}
          />
        </svg>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#E9F1F8",
          }}
        >
          COMMANDER
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 32,
            color: DOURADO,
            letterSpacing: "0.02em",
          }}
        >
          O dossiê do seu barco
        </div>
      </div>
    ),
    { ...size }
  )
}

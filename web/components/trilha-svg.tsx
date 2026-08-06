import type { PontoTrilha } from "@/lib/domain/geo"

const LARGURA = 360
const ALTURA = 220
const MARGEM = 18

export function TrilhaSvg({ pontos }: { pontos: PontoTrilha[] }) {
  if (!Array.isArray(pontos) || pontos.length < 2) return null
  const rad = Math.PI / 180
  const laMedia = pontos.reduce((s, p) => s + p.la, 0) / pontos.length
  const fatorLon = Math.cos(laMedia * rad)

  const xs = pontos.map((p) => p.lo * fatorLon)
  const ys = pontos.map((p) => p.la)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1e-6)
  const spanY = Math.max(maxY - minY, 1e-6)
  const escala = Math.min((LARGURA - 2 * MARGEM) / spanX, (ALTURA - 2 * MARGEM) / spanY)
  const dx = (LARGURA - spanX * escala) / 2
  const dy = (ALTURA - spanY * escala) / 2

  const px = (i: number) => dx + (xs[i] - minX) * escala
  const py = (i: number) => ALTURA - (dy + (ys[i] - minY) * escala)
  const caminho = pontos.map((_, i) => `${px(i).toFixed(1)},${py(i).toFixed(1)}`).join(" ")

  const grade = [0.25, 0.5, 0.75]
  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full rounded-[10px] border border-line bg-meter" role="img" aria-label="Carta da trilha">
      {grade.map((g) => (
        <g key={g} stroke="#12283f" strokeWidth="1">
          <line x1={LARGURA * g} y1="0" x2={LARGURA * g} y2={ALTURA} />
          <line x1="0" y1={ALTURA * g} x2={LARGURA} y2={ALTURA * g} />
        </g>
      ))}
      <polyline points={caminho} fill="none" stroke="#d4af37" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(0)} cy={py(0)} r="4" fill="#2fd07a" />
      <circle cx={px(pontos.length - 1)} cy={py(pontos.length - 1)} r="4" fill="#ff5c5c" />
    </svg>
  )
}

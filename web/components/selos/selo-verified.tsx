"use client"
import { useId } from "react"

import { arredondarCoordenada } from "@/components/ui/instrumento"

/** Pontos ao longo de um círculo, 0° = topo (12h), sentido horário — mesma
 *  convenção de relógio que o resto do app usa pra ângulo (ex.: rumo).
 *
 *  O arredondamento NÃO é acabamento: sem ele este selo era a causa medida do
 *  erro de hidratação em 17 das 73 rotas (`/barco`, `/barco/selos*` e todo o
 *  `/admin`). O porquê inteiro — e por que a régua é de duas casas — está em
 *  `arredondarCoordenada`, que é a MESMA régua que `pontoNoArco` usa nos
 *  instrumentos desde o primeiro deles. Duas réguas de arredondamento no mesmo
 *  app seria a deriva de sempre, só que em número. */
function polarDoTopo(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180
  return {
    x: arredondarCoordenada(cx + r * Math.cos(rad)),
    y: arredondarCoordenada(cy + r * Math.sin(rad)),
  }
}

/** Uma folha da coroa de louros ao longo do ramo direito — o ramo esquerdo é
 *  este mesmo conjunto espelhado (`scale(-1,1)` em torno do centro), não uma
 *  segunda lista de números pra manter sincronizada à mão. */
const N_FOLHAS = 8
const INICIO_DEG = 42
const FIM_DEG = 178
const FOLHAS = Array.from({ length: N_FOLHAS }, (_, i) => {
  const t = i / (N_FOLHAS - 1)
  const deg = INICIO_DEG + t * (FIM_DEG - INICIO_DEG)
  const r = 40 - t * 3
  const p = polarDoTopo(50, 50, r, deg)
  // O ÂNGULO TAMBÉM PASSA PELA RÉGUA, e ele não precisaria: `deg` sai de
  // divisão e multiplicação, que o IEEE 754 especifica exatamente, então sai
  // igual no servidor e no navegador — diferente de `Math.cos`/`Math.sin`.
  // Passa mesmo assim por dois motivos. Primeiro, a invariante que o teste
  // cobra é do HTML ("nenhum número serializado tem mais de duas casas") e
  // vale a pena ela ser simples de verificar em vez de ter uma exceção que
  // alguém precise lembrar. Segundo, é barato: 0,005° de giro numa folha de
  // 12,8×4,8px é menos que um subpixel — e no dia em que este ângulo vier de
  // um `Math.atan2`, ele já está protegido.
  return { x: p.x, y: p.y, rot: arredondarCoordenada(deg + 90) }
})

const CAMINHO_ESCUDO = "M50 10 C 40 10 30 14 22 18 L 22 46 C 22 68 34 84 50 92 C 66 84 78 68 78 46 L 78 18 C 70 14 60 10 50 10 Z"

/** Monograma dos dois M espelhados — mesmo path de `components/logo.tsx`
 *  (viewBox 0 0 48 34), só reposicionado/escalado pra caber dentro do
 *  escudo. Um path só, sem duplicar a marca em dois lugares do código. */
const CAMINHO_MONOGRAMA = "M4 32 V10 L15 22 24 5 33 22 44 10 V32 H36 V24 L28 32 H20 L12 24 V32 Z"

/**
 * Selo Commander Verified (onda 40, PRD §7 + prancha de marca do dono) —
 * escudo prateado/aço com o monograma "MM", coroa de louros e um "✓" na
 * base. SVG próprio (sem asset externo — CSP estrita), escala de 24px
 * (ícone de lista) a 160px (tela do selo) porque tudo aqui é vetor: nenhum
 * detalhe depende de pixel fixo.
 *
 * Sempre a mesma identidade em aço/prata — Verified nunca usa o dourado do
 * Gold (Correção 13 do PRD de Correções: "nada entre os dois", cada selo
 * com sua própria linguagem visual). Cor fixa por design (não segue
 * light/dark) — é a mesma "liga metálica" em qualquer tema, igual ao
 * dourado do Gold já é (`--acao` tem o mesmo hex nos dois temas).
 */
export function SeloVerified({ size = 40, className = "" }: { size?: number; className?: string }) {
  const uid = useId()
  const idGrad = `selo-verified-aco-${uid}`
  const idFolha = `selo-verified-folha-${uid}`

  return (
    <svg
      viewBox="0 0 100 100" width={size} height={size} className={className}
      role="img" aria-label="Selo Commander Verified"
    >
      <defs>
        <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef2f5" />
          <stop offset="45%" stopColor="#c3ccd4" />
          <stop offset="100%" stopColor="#8a97a3" />
        </linearGradient>
        <g id={idFolha}>
          <ellipse cx={0} cy={0} rx={6.4} ry={2.4} fill={`url(#${idGrad})`} stroke="#57626c" strokeWidth={0.5} />
        </g>
      </defs>

      {/* coroa de louros — ramo direito + espelho pro esquerdo */}
      <g>
        {FOLHAS.map((f, i) => (
          <use key={i} href={`#${idFolha}`} transform={`translate(${f.x},${f.y}) rotate(${f.rot})`} />
        ))}
      </g>
      <g transform="translate(100,0) scale(-1,1)">
        {FOLHAS.map((f, i) => (
          <use key={i} href={`#${idFolha}`} transform={`translate(${f.x},${f.y}) rotate(${f.rot})`} />
        ))}
      </g>

      {/* escudo */}
      <path d={CAMINHO_ESCUDO} fill={`url(#${idGrad})`} stroke="#57626c" strokeWidth={1.5} />

      {/* monograma MM, tom mais escuro pra contrastar com o escudo claro */}
      <path d={CAMINHO_MONOGRAMA} fill="#3d4b57" transform="translate(28.4,41.5) scale(0.9)" />

      {/* "✓" na base do escudo */}
      <circle cx={50} cy={88} r={10} fill="#e9edf1" stroke="#57626c" strokeWidth={1.2} />
      <path
        d="M45 88 l3.5 3.5 7-7" fill="none" stroke="#3d4b57" strokeWidth={2.4}
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

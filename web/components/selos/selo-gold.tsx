"use client"
import { useId } from "react"

import { arredondarCoordenada } from "@/components/ui/instrumento"

/** Pontos ao longo de um círculo, 0° = topo (12h), sentido horário — mesma
 *  convenção de `selo-verified.tsx`, e o mesmo arredondamento pelo mesmo
 *  motivo: são 28 traços × 2 pontos × 2 eixos = 112 floats de `Math.cos`/
 *  `Math.sin` serializados por selo, e bastava um deles divergir no último
 *  dígito entre o Node do servidor e o V8 do navegador pra derrubar a
 *  hidratação da rota inteira. Ver `arredondarCoordenada`. */
function polarDoTopo(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180
  return {
    x: arredondarCoordenada(cx + r * Math.cos(rad)),
    y: arredondarCoordenada(cy + r * Math.sin(rad)),
  }
}

/** Textura de cordame no anel — pequenos traços radiais espaçados
 *  igualmente, sugerindo corda torcida sem desenhar cada fio à mão. */
const N_TRACOS = 28
const TRACOS = Array.from({ length: N_TRACOS }, (_, i) => {
  const deg = i * (360 / N_TRACOS)
  return { p1: polarDoTopo(50, 50, 41.5, deg), p2: polarDoTopo(50, 50, 47.5, deg) }
})

const CAMINHO_ANCORA =
  "M50 33 V78 M32 44 H68 M50 78 C 50 87 41 91 35 85 M50 78 C 50 87 59 91 65 85"

function formatarData(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR")
}

/**
 * Selo Commander Gold (onda 40, PRD §7 + Correção 12 + prancha de marca do
 * dono) — âncora dourada dentro de um anel/cordame com "COMMANDER GOLD", e
 * uma placa opcional com data da avaliação e validade quando existirem
 * (`gold_selos`, onda 35). SVG próprio, escala de 24px a 160px.
 *
 * `variant="ativo"` é o selo de verdade (dourado, disco cheio) — só entra em
 * tela onde há um `GoldSelo` real vindo do banco. `variant="convite"` é o
 * MESMO desenho em tom neutro/vazado, pra vitrine ("conheça o Gold", "quero
 * avaliar") sem nunca parecer uma âncora dourada conquistada — regra de
 * honestidade do PRD: "selo nenhum aparece sem lastro". Quem chama decide a
 * variante; este componente nunca consulta o banco pra isso.
 */
export function SeloGold({
  size = 40,
  className = "",
  variant = "ativo",
  dataAvaliacao,
  validadeAte,
}: {
  size?: number
  className?: string
  variant?: "ativo" | "convite"
  /** ISO (YYYY-MM-DD) — quando os dois vêm preenchidos, mostra a placa abaixo do selo. */
  dataAvaliacao?: string | null
  validadeAte?: string | null
}) {
  const uid = useId()
  const idGrad = `selo-gold-${uid}`
  const ativo = variant === "ativo"
  const corTraco = ativo ? "#8a6d1c" : "var(--texto-dim)"
  const mostrarPlaca = ativo && Boolean(dataAvaliacao && validadeAte)

  return (
    <span className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Selo Commander Gold">
        <defs>
          {ativo ? (
            <linearGradient id={idGrad} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f3dd8a" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#8a6d1c" />
            </linearGradient>
          ) : (
            // convite: sem gradiente — cor chapada (mesma linguagem de
            // "ainda não conquistado" do resto do app, `text-dim`).
            <linearGradient id={idGrad} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--texto-dim)" />
              <stop offset="100%" stopColor="var(--texto-dim)" />
            </linearGradient>
          )}
        </defs>

        {/* anel/cordame */}
        <circle cx={50} cy={50} r={44} fill="none" stroke={`url(#${idGrad})`} strokeWidth={7} />
        <g opacity={0.55}>
          {TRACOS.map((t, i) => (
            <line key={i} x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y} stroke={corTraco} strokeWidth={1.1} />
          ))}
        </g>
        <circle
          cx={50} cy={50} r={37} stroke={corTraco} strokeWidth={1}
          fill={ativo ? "var(--meter)" : "none"} opacity={ativo ? 1 : 0.35}
        />

        {/* COMMANDER / GOLD — bandas retas (não curvas: legível em qualquer
            tamanho, sem depender de textPath) */}
        <text
          x={50} y={19} textAnchor="middle" fontSize={7.5} fontWeight={700} letterSpacing={1}
          fill={ativo ? `url(#${idGrad})` : corTraco} fontFamily="ui-monospace, monospace"
        >
          COMMANDER
        </text>
        <text
          x={50} y={88} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing={2}
          fill={ativo ? `url(#${idGrad})` : corTraco} fontFamily="ui-monospace, monospace"
        >
          GOLD
        </text>

        {/* âncora */}
        <g fill="none" stroke={`url(#${idGrad})`} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={50} cy={26} r={5} strokeWidth={3.4} />
          <path d={CAMINHO_ANCORA} />
        </g>
      </svg>

      {mostrarPlaca && (
        <span className="flex flex-col items-center rounded-md border border-accent-forte/40 bg-accent/10 px-2 py-1 text-center font-mono-instr text-xs leading-tight text-accent-forte">
          <span>Avaliado em {formatarData(dataAvaliacao!)}</span>
          <span>Válido até {formatarData(validadeAte!)}</span>
        </span>
      )}
    </span>
  )
}

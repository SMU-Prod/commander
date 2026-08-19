import { escalaTopo, formatarNumero, idDefs } from "./instrumento"

/**
 * GRÁFICO DE ÁREA — o "On-Time Delivery Performance" da referência (gastos ao
 * longo do ano, horas de motor, saídas por mês). Spec §2, item 4.
 *
 * SEM BIBLIOTECA, E O MOTIVO NÃO É PESO DE BUNDLE: é que toda biblioteca de
 * gráfico traz a própria paleta, a própria tipografia e o próprio tooltip, e
 * a partir daí o painel tem dois sistemas de design. Um `<path>` com os tokens
 * do app é menos código do que a configuração necessária para fazer uma
 * biblioteca parecer com isto.
 *
 * O TRUQUE DA ESCALA NÃO-UNIFORME: o `viewBox` é 100×100 e o SVG estica com
 * `preserveAspectRatio="none"`, então a área acompanha qualquer largura e
 * altura sem recalcular ponto nenhum. O preço seria a linha do topo esticar
 * junto (1,5px viraria 4px de largura e 0,6px de altura, e a curva ficaria com
 * espessura variável); `vectorEffect="non-scaling-stroke"` cancela isso — o
 * traço volta a ser medido em pixels de tela. Texto NENHUM entra neste SVG,
 * pelo mesmo motivo: fonte esticada não tem conserto. Os dois eixos são HTML.
 */

export type PontoArea = { rotulo: string; valor: number }

const DIVISOES = 4

function arredondar(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Catmull-Rom convertido em Bézier: a curva passa POR CIMA de cada ponto (não
 * é uma suavização que "chuta" o dado) e os pontos de controle são presos em
 * 0–100 para a área não vazar do gráfico num vale ou num pico brusco.
 */
function caminhoSuave(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ""
  const preso = (v: number) => arredondar(Math.min(100, Math.max(0, v)))
  if (pts.length === 1) return `M 0 ${preso(pts[0].y)} L 100 ${preso(pts[0].y)}`

  let d = `M ${arredondar(pts[0].x)} ${preso(pts[0].y)}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] ?? pts[i - 1]
    const p1 = pts[i - 1]
    const p2 = pts[i]
    const p3 = pts[i + 1] ?? pts[i]
    const c1x = arredondar(p1.x + (p2.x - p0.x) / 6)
    const c1y = preso(p1.y + (p2.y - p0.y) / 6)
    const c2x = arredondar(p2.x - (p3.x - p1.x) / 6)
    const c2y = preso(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${arredondar(p2.x)} ${preso(p2.y)}`
  }
  return d
}

export function GraficoArea({
  pontos,
  cor = "var(--dado)",
  alturaClasse = "h-[140px] sm:h-[200px]",
  rotulo,
  sufixo = "",
  className = "",
}: {
  pontos: PontoArea[]
  /** Cor do dado — `--dado`, a família que o `docs/DESIGN.md` §5 reserva pra
   *  série. ONDA 91 (achado 5.5): o padrão era `var(--acao)`, o dourado de
   *  ação/marca. Este componente tem ZERO consumidores hoje, então aqui o
   *  conserto é preventivo — era o irmão de `GraficoBarras` esperando pra
   *  repassar o mesmo defeito ao primeiro que o usasse, pela terceira vez
   *  (a onda 63 já o tinha corrigido no gráfico antigo). */
  cor?: string
  /** Spec §5: 140px no celular, 200px no desktop. */
  alturaClasse?: string
  rotulo?: string
  /** Vai junto do número no eixo Y e na descrição ("%", "h", "L"). */
  sufixo?: string
  className?: string
}) {
  const valores = pontos.map((p) => (Number.isFinite(p.valor) ? p.valor : 0))
  const topo = escalaTopo(Math.max(...valores, 0), DIVISOES)
  const ultimo = Math.max(1, pontos.length - 1)

  const pts = pontos.map((p, i) => ({
    x: pontos.length === 1 ? 50 : (i / ultimo) * 100,
    y: 100 - (Math.min(topo, Math.max(0, valores[i])) / topo) * 100,
  }))

  const linha = caminhoSuave(pts)
  const area = linha ? `${linha} L 100 100 L 0 100 Z` : ""
  const idGradiente = idDefs("area", cor)

  const marcasY = Array.from({ length: DIVISOES + 1 }, (_, i) => ({
    pos: (i / DIVISOES) * 100,
    texto: formatarNumero(topo * (1 - i / DIVISOES)),
  }))

  const nome = rotulo ?? "Gráfico de área"
  const descricao = pontos.length
    ? `${nome}: ${pontos.length} pontos, de ${formatarNumero(Math.min(...valores))}${sufixo} a ${formatarNumero(Math.max(...valores))}${sufixo}`
    : `${nome}: sem dados`

  return (
    <div className={`flex w-full gap-2 ${className}`}>
      {/* Eixo Y posicionado por porcentagem, e não por `justify-between`:
          com `justify-between` o rótulo do topo encosta a BORDA DE CIMA da
          caixa na linha do topo, e o olho lê o número meio dedo abaixo da
          linha que ele nomeia. `-translate-y-1/2` põe o miolo do texto na
          linha. */}
      <div className={`relative w-7 shrink-0 sm:w-9 ${alturaClasse}`} aria-hidden="true">
        {marcasY.map((marca) => (
          <span
            key={marca.pos}
            style={{ top: `${marca.pos}%` }}
            // ONDA 91 (achado 5.6, mesmo conserto do eixo X de
            // `GraficoBarras`): 11px é o piso declarado em `globals.css`, e
            // `text-[10px]` no celular ficava um pixel abaixo dele.
            className="absolute right-0 -translate-y-1/2 font-mono-instr text-[11px] leading-none tabular-nums text-dim"
          >
            {marca.texto}
            {sufixo}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className={`relative w-full ${alturaClasse}`}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={descricao}
          >
            <defs>
              {/* Três paradas, e não duas: com um degradê linear de 0,42 a 0 o
                  preenchimento fica meio-tom no gráfico inteiro e lê como
                  bloco cor de oliva. Forte no topo e caindo rápido no primeiro
                  terço, a cor vira ATMOSFERA embaixo da linha — que é o efeito
                  da referência. */}
              <linearGradient id={idGradiente} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={cor} stopOpacity="0.5" />
                <stop offset="0.45" stopColor={cor} stopOpacity="0.14" />
                <stop offset="1" stopColor={cor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grade quase invisível: presente o bastante para o olho medir a
                altura de um pico, discreta o bastante para o dado continuar
                sendo a única coisa que se vê. */}
            {marcasY.map((marca) => (
              <line
                key={marca.pos}
                x1="0"
                y1={marca.pos}
                x2="100"
                y2={marca.pos}
                stroke="var(--linha)"
                strokeOpacity="0.55"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {area && <path d={area} fill={`url(#${idGradiente})`} />}
            {linha && (
              <path
                d={linha}
                fill="none"
                stroke={cor}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>

        {/* Eixo X ancorado no MESMO x% do ponto — rótulo distribuído em fatias
            iguais fica meia fatia fora do lugar, e a mentira cresce quanto
            menos pontos a série tem. Spec §5: no celular a série alterna
            rótulo sim, rótulo não, para parar de colidir a 390px. */}
        <div className="relative mt-2 h-3.5" aria-hidden="true">
          {pontos.map((p, i) => {
            const x = pontos.length === 1 ? 50 : (i / ultimo) * 100
            const ancora =
              i === 0 ? "translate-x-0 text-left" : i === pontos.length - 1 ? "-translate-x-full text-right" : "-translate-x-1/2 text-center"
            const raleiaNoCelular = i % 2 === 1 && i !== pontos.length - 1
            return (
              <span
                key={`${p.rotulo}-${i}`}
                style={{ left: `${x}%` }}
                className={`absolute top-0 whitespace-nowrap font-mono-instr text-[11px] leading-none tabular-nums text-dim ${ancora} ${raleiaNoCelular ? "max-sm:invisible" : ""}`}
              >
                {p.rotulo}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

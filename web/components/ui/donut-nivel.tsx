import { formatarNumero, idDefs, percentualPreso } from "./instrumento"

/**
 * DONUT DE NÍVEL — o medidor de combustível da referência (tanque de diesel e
 * de água doce; cota de fotos). Spec §2, item 2.
 *
 * O QUE FAZ ESTA PEÇA NÃO SER UM DONUT QUALQUER: o preenchimento não é um
 * arco. É LÍQUIDO — uma superfície com menisco, subindo dentro do círculo como
 * um tanque visto de lado. A diferença não é enfeite: um arco de 31% conta
 * quanto falta para a volta completa (uma grandeza circular, inventada); uma
 * lâmina de líquido a 31% da altura conta quanto tem no tanque, que é a
 * grandeza real. O anel espesso em volta é a PAREDE do tanque, e é por isso
 * que ele não se pinta — parede cheia não existe.
 *
 * A onda que copiar isto para um "% de conclusão" está usando a peça errada:
 * para fração de trabalho feito existe a `BarraCapacidade`.
 */

// Geometria: viewBox quadrado, parede em `RAIO_PAREDE` e o interior recortado
// em `RAIO_INTERNO` — o líquido é desenhado transbordando de propósito e o
// clip é que lhe dá a forma de círculo.
const CX = 100
const CY = 100
const RAIO_PAREDE = 86
const LARGURA_PAREDE = 9
const RAIO_INTERNO = RAIO_PAREDE - LARGURA_PAREDE / 2 - 1
const TOPO = CY - RAIO_INTERNO
const BASE = CY + RAIO_INTERNO

/** A partir daqui o líquido chega na altura do número central e o branco
 *  precisa do halo — abaixo disso o halo seria uma sombra à toa sobre o fundo
 *  escuro do tanque. */
const NIVEL_QUE_ALCANCA_O_NUMERO = 52

/** Duas ondas mansas de amplitude 6 — o suficiente para ler como superfície de
 *  líquido, pouco o bastante para não virar desenho animado num painel. */
function superficie(y: number): string {
  return `M -10 ${y} C 25 ${y - 6} 65 ${y + 6} 100 ${y} C 135 ${y - 6} 175 ${y + 6} 210 ${y}`
}

export function DonutNivel({
  valor,
  unidade,
  percentual,
  apoio,
  rotulo,
  className = "",
}: {
  /** `null` = sem leitura: o tanque fica vazio e o número vira "—". */
  valor: number | null
  unidade: string
  /** 0–100. Acima de 100 e abaixo de 0 é preso — tanque não transborda a tela. */
  percentual: number | null
  /** O badge pequeno embaixo do número ("⌀ 72°F" na referência). */
  apoio?: string
  /** Nome da grandeza, para leitor de tela. */
  rotulo?: string
  className?: string
}) {
  const semLeitura = valor == null || !Number.isFinite(valor)
  const pct = percentualPreso(percentual)
  const nivel = BASE - (pct / 100) * (BASE - TOPO)
  const idDourado = idDefs("liq", "dourado", Math.round(nivel))
  /** Tanque sem leitura e tanque a 0% desenham a mesma coisa: nada. */
  const temLiquido = !semLeitura && pct > 0

  const textoAcessivel = semLeitura
    ? `${rotulo ?? "Nível"}: sem leitura`
    : `${rotulo ?? "Nível"}: ${formatarNumero(valor)} ${unidade}, ${pct}% da capacidade`

  return (
    // Duas caixas pelo mesmo motivo do `Medidor`: o chip de % é do canto do
    // CARTÃO, o mostrador é estreito e centrado.
    <div className={`relative w-full ${className}`}>
      {percentual != null && (
        <span className="absolute right-0 top-0 z-10 inline-flex items-center rounded-[var(--raio-pilula)] border border-accent/40 px-2 py-0.5 font-mono-instr text-xs font-semibold tabular-nums text-accent">
          {pct}%
        </span>
      )}

      <div className="@container relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 200 200" className="block w-full" role="img" aria-label={textoAcessivel}>
          <defs>
            {/* `clipPath` e geometria são CONSTANTES, então dois donuts na mesma
                página compartilham este id sem consequência: as definições são
                idênticas. Já o degradê depende do nível, e por isso o id dele
                carrega o nível — ver `idDefs`. */}
            <clipPath id="liq-interior">
              <circle cx={CX} cy={CY} r={RAIO_INTERNO} />
            </clipPath>
            {/* `userSpaceOnUse` da SUPERFÍCIE até o FUNDO DO TANQUE, e não
                `objectBoundingBox`. A caixa do caminho do líquido desce até
                y=210 (ele é desenhado transbordando, para o clip recortar), de
                modo que em bounding box o degradê inteiro se espalhava por uma
                área que não se vê: dentro do círculo a opacidade quase não
                mudava e o líquido lia como bloco chapado (captura v3). Preso ao
                espaço do usuário, o claro fica na lâmina de cima e o escuro no
                fundo do tanque, onde deve estar. */}
            {temLiquido && (
              <linearGradient
                id={idDourado}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={nivel}
                x2="0"
                y2={BASE}
              >
                <stop offset="0" stopColor="var(--acao-forte)" stopOpacity="0.78" />
                <stop offset="1" stopColor="var(--acao)" stopOpacity="0.34" />
              </linearGradient>
            )}
          </defs>

          {/* Interior do tanque — o vazio precisa ser mais fundo que o cartão,
              senão a parede parece um anel solto sobre o painel. */}
          <circle cx={CX} cy={CY} r={RAIO_INTERNO} fill="var(--campo)" />

          {temLiquido && (
            <g clipPath="url(#liq-interior)">
              <path d={`${superficie(nivel)} L 210 210 L -10 210 Z`} fill={`url(#${idDourado})`} />
              <path d={superficie(nivel)} fill="none" stroke="var(--acao-forte)" strokeWidth={2.2} />
            </g>
          )}

          {/* A parede, por último: o líquido encosta nela por dentro em vez de
              passar por cima. */}
          <circle
            cx={CX}
            cy={CY}
            r={RAIO_PAREDE}
            fill="none"
            stroke="var(--linha)"
            strokeWidth={LARGURA_PAREDE}
          />
        </svg>

        {/* O HALO SÓ ENTRA COM O TANQUE CHEIO. A partir de ~52% o número cai em
            cima do líquido, e branco sobre dourado é o pior contraste que este
            app produz. A primeira tentativa foi um véu radial escuro atrás do
            texto: passou em contraste e reprovou em desenho — na captura v2 lia
            como um borrão sujo no meio do tanque. Um halo colado nas letras faz
            o mesmo trabalho sem desenhar forma nenhuma, e fica FORA quando não
            é preciso, para não sujar o tanque vazio. `var(--fundo)` e não um
            preto: no tema claro o halo tem de ser claro. */}
        <div
          className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 ${
            !semLeitura && pct >= NIVEL_QUE_ALCANCA_O_NUMERO ? "[text-shadow:0_1px_8px_var(--fundo)]" : ""
          }`}
        >
          <div className="flex items-baseline gap-1">
            <span className="font-mono-instr text-[clamp(1.125rem,13cqw,2.125rem)] font-semibold leading-none tabular-nums text-texto">
              {semLeitura ? "—" : formatarNumero(valor)}
            </span>
            <span className="font-mono-instr text-[clamp(0.625rem,4.5cqw,0.8125rem)] leading-none text-dim">
              {unidade}
            </span>
          </div>
          {apoio && (
            <span className="inline-flex items-center rounded-[var(--raio-pilula)] border border-line bg-panel px-2 py-0.5 font-mono-instr text-xs tabular-nums text-dim">
              {apoio}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

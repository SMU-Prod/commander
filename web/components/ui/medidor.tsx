import {
  caminhoArco,
  COR_TOM,
  formatarNumero,
  fracao,
  idDefs,
  pontoNoArco,
  type TomInstrumento,
} from "./instrumento"
import { Selo } from "./selo"

/**
 * MEDIDOR DE ARCO — o velocímetro da referência (SOG hoje; RPM e temperatura
 * quando o Connect chegar). Spec: `docs/superpowers/specs/2026-08-16-haulix-exato-design.md` §2, item 1.
 *
 * Três decisões de desenho que a imagem cobra e que um arco genérico erra:
 *
 * 1. O ARCO COLORIDO É A ESCALA, NÃO O VALOR. Barra de progresso pinta até
 *    onde chegou; velocímetro pinta a faixa inteira e aponta. Quem lê o valor
 *    é o PONTEIRO. Trocar isso destrói a leitura de relance que faz a peça
 *    valer — "estou perto do vermelho?" se responde pela posição da agulha
 *    contra a zona, não pelo comprimento de um traço.
 *
 * 2. UM GRADIENTE POR ZONA, DA COR DELA ATÉ A COR DA SEGUINTE. Um
 *    `linearGradient` só, esticado sobre a corda do arco, mente nas pontas
 *    (a corda não acompanha a curva) e apaga a fronteira das zonas. Um
 *    `stroke` chapado por zona acerta a fronteira e perde o degradê contínuo
 *    da referência. Interpolando de cada zona para a SEGUINTE, as duas coisas
 *    valem ao mesmo tempo: verde→âmbar dá amarelo no meio, âmbar→vermelho dá
 *    laranja — o "verde, amarelo, laranja, vermelho" da imagem sai de três
 *    tokens, sem inventar cor nenhuma.
 *
 * 3. SEM VALOR, NADA DE VERDE. `valor: null` desliga as zonas (tudo em
 *    `--linha`), esconde o ponteiro e mostra "—". Um medidor com a agulha no
 *    zero, dentro da faixa verde, afirma "está tudo bem" sobre uma leitura que
 *    ninguém fez. Onde o dado não existe, o medidor não pinta (spec §7).
 */

/** Uma faixa da escala: vale de onde a anterior parou ATÉ `ate` (na mesma
 *  unidade de `valor`/`max`). */
export type ZonaMedidor = { ate: number; tom: TomInstrumento }

/** Verde até a metade, âmbar até três quartos, vermelho no resto — a divisão
 *  da imagem de referência. Função de `max`, e não constante: `ate` está na
 *  UNIDADE do medidor, então uma constante `{ ate: 0.5 }` significaria "meio
 *  nó", não "metade da escala" — e o arco sairia cinza com um respingo de cor
 *  colado no zero. (Foi exatamente o que a primeira captura mostrou.) */
function zonasPadrao(max: number): ZonaMedidor[] {
  return [
    { ate: max * 0.5, tom: "ok" },
    { ate: max * 0.75, tom: "atencao" },
    { ate: max, tom: "critico" },
  ]
}

// A geometria, num só lugar. Arco de 240° abrindo embaixo: começa a 210°
// (baixo-esquerda), sobe pelo topo e fecha a -30° (baixo-direita). A abertura
// de 120° embaixo é onde o número grande mora.
//
// Altura do viewBox 160 e não 200: o desenho mais baixo é o rótulo `0`/`150`
// do pé do arco, a y≈154. Sobra vira faixa morta, e o número grande — ancorado
// no pé da caixa — flutuava destacado do instrumento em vez de morar na boca
// do arco (visto na captura v2).
const CX = 100
const CY = 104
const RAIO = 68
const GRAU_INICIO = 210
const GRAU_FIM = -30
const VARREDURA = GRAU_INICIO - GRAU_FIM
const LARGURA_TRILHO = 13
const LARGURA_FAIXA = 8
/** 6 marcas grandes (0, 1/5, … , max) e 4 traços miúdos entre cada par —
 *  a densidade de escala da referência. */
const MARCAS_GRANDES = 6
const MIUDAS_POR_TRECHO = 4
const TOTAL_MARCAS = (MARCAS_GRANDES - 1) * MIUDAS_POR_TRECHO

const grauDe = (f: number) => GRAU_INICIO - VARREDURA * f

export function Medidor({
  valor,
  max,
  unidade,
  zonas,
  estado,
  rotulo,
  className = "",
}: {
  /** `null` = sem leitura. Não é o mesmo que zero, e não pinta como zero. */
  valor: number | null
  max: number
  unidade: string
  /** Faixas na unidade do valor. Por padrão, 0–50% ok, 50–75% atenção, 75–100% crítico. */
  zonas?: ZonaMedidor[]
  /** O chip do canto superior direito da referência ("High", vermelho). */
  estado?: { rotulo: string; tom: TomInstrumento }
  /** Nome da grandeza. NÃO é desenhado — quem mostra o nome é o título do
   *  cartão, e repetir "Velocidade" dentro do mostrador é exatamente o ruído
   *  que a referência não tem. Serve ao `aria-label`, que não tem cartão. */
  rotulo?: string
  className?: string
}) {
  const semLeitura = valor == null || !Number.isFinite(valor)
  const f = fracao(valor, max)
  const faixas = zonas ?? zonasPadrao(max)

  // As zonas viram trechos [de, ate] em fração de escala, com a cor da zona e
  // a cor da PRÓXIMA (o alvo do degradê). Sem leitura, todas caem em neutro.
  //
  // Cada trecho começa onde o ANTERIOR terminou — lido do vizinho, e não de um
  // acumulador `let` percorrido no `.map`: o compilador do React reprova
  // reatribuição durante render (`react-hooks/immutability`), e com razão, um
  // `.map` que carrega estado entre iterações é armadilha esperando um
  // `.filter` na frente.
  const trechos = faixas.map((zona, i) => {
    const de = i === 0 ? 0 : fracao(faixas[i - 1].ate, max)
    const ate = Math.max(fracao(zona.ate, max), de)
    const cor = COR_TOM[semLeitura ? "neutro" : zona.tom]
    const corFim = COR_TOM[semLeitura ? "neutro" : (faixas[i + 1]?.tom ?? zona.tom)]
    const a = pontoNoArco(CX, CY, RAIO, grauDe(de))
    const b = pontoNoArco(CX, CY, RAIO, grauDe(ate))
    return { de, ate, cor, corFim, a, b, id: idDefs("zona", cor, corFim, a.x, a.y, b.x, b.y) }
  })

  const grauPonteiro = grauDe(f)
  const pontaPonteiro = pontoNoArco(CX, CY, RAIO - 15, grauPonteiro)

  const textoAcessivel = semLeitura
    ? `${rotulo ?? "Medidor"}: sem leitura`
    : `${rotulo ?? "Medidor"}: ${formatarNumero(valor)} ${unidade} de ${formatarNumero(max)}`

  return (
    // DUAS CAIXAS, E A DE FORA É LARGA DE PROPÓSITO. O chip de estado pertence
    // ao canto do CARTÃO (é assim na referência) e o mostrador é estreito e
    // centrado — pendurar o chip na caixa estreita o deixava boiando no meio
    // do cartão, a meio caminho da borda (visto na captura v3). A de fora
    // ocupa a largura inteira e ancora o chip; a de dentro tem o teto de
    // largura e o `@container`.
    <div className={`relative w-full ${className}`}>
      {estado && (
        <div className="absolute right-0 top-0 z-10">
          <Selo estado={estado.tom}>{estado.rotulo}</Selo>
        </div>
      )}

      {/* `@container` + `cqw` no tamanho do número, e não `vw`: o mesmo medidor
          aparece de cartão inteiro (≈260px) e de meia largura ao lado de outro
          (≈160px) NA MESMA página — em `vw` os dois recebem o mesmo corpo e o
          pequeno estoura por cima do arco. `max-w` porque num painel de 1440
          sem teto o mostrador vira um relógio de parede de 600px; quem quiser
          maior passa `max-w-none` pelo `className`. */}
      <div className="@container relative mx-auto w-full max-w-[260px]">
        <svg viewBox="0 0 200 160" className="block w-full" role="img" aria-label={textoAcessivel}>
          <defs>
            {trechos.map((trecho) => (
              <linearGradient
                key={trecho.de}
                id={trecho.id}
                gradientUnits="userSpaceOnUse"
                x1={trecho.a.x}
                y1={trecho.a.y}
                x2={trecho.b.x}
                y2={trecho.b.y}
              >
                <stop offset="0" stopColor={trecho.cor} />
                <stop offset="1" stopColor={trecho.corFim} />
              </linearGradient>
            ))}
          </defs>

          {/* Trilho: o sulco escuro por baixo. Mais largo que a faixa de
              propósito — os 2,5px que sobram de cada lado são o que dá a
              impressão de a cor estar EMBUTIDA no instrumento, e não pousada
              em cima dele. */}
          <path
            d={caminhoArco(CX, CY, RAIO, GRAU_INICIO, GRAU_FIM)}
            fill="none"
            stroke="var(--linha)"
            strokeWidth={LARGURA_TRILHO}
            strokeLinecap="round"
          />

          {trechos.map((trecho) => (
            <path
              key={trecho.de}
              d={caminhoArco(CX, CY, RAIO, grauDe(trecho.de), grauDe(trecho.ate))}
              fill="none"
              stroke={`url(#${trecho.id})`}
              strokeWidth={LARGURA_FAIXA}
            />
          ))}

          {/* Escala: traços por fora da faixa, rótulo mais fora ainda. */}
          <g>
            {Array.from({ length: TOTAL_MARCAS + 1 }, (_, i) => {
              const fracaoMarca = i / TOTAL_MARCAS
              const grande = i % MIUDAS_POR_TRECHO === 0
              const p1 = pontoNoArco(CX, CY, RAIO + 8, grauDe(fracaoMarca))
              const p2 = pontoNoArco(CX, CY, RAIO + (grande ? 14 : 11), grauDe(fracaoMarca))
              return (
                <line
                  key={fracaoMarca}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={grande ? "var(--texto-dim)" : "var(--linha)"}
                  strokeWidth={grande ? 1.6 : 1}
                  strokeLinecap="round"
                />
              )
            })}
            {Array.from({ length: MARCAS_GRANDES }, (_, i) => {
              const fracaoMarca = i / (MARCAS_GRANDES - 1)
              const p = pontoNoArco(CX, CY, RAIO + 23, grauDe(fracaoMarca))
              return (
                <text
                  key={fracaoMarca}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-mono-instr tabular-nums"
                  fontSize="9.5"
                  fill="var(--texto-dim)"
                >
                  {formatarNumero(max * fracaoMarca, 0)}
                </text>
              )
            })}
          </g>

          {/* Ponteiro. Fica em `--texto` (e não na cor da zona) porque a agulha
              é o INSTRUMENTO, não o alarme: quem diz o estado é o chip e a zona
              atrás dela. Agulha colorida sobre zona colorida some. */}
          {!semLeitura && (
            <g>
              <line
                x1={CX}
                y1={CY}
                x2={pontaPonteiro.x}
                y2={pontaPonteiro.y}
                stroke="var(--texto)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={CX} cy={CY} r={6.5} fill="var(--superficie-2)" stroke="var(--linha)" strokeWidth={1.5} />
              <circle cx={CX} cy={CY} r={2.6} fill="var(--texto)" />
            </g>
          )}
        </svg>

        {/* O número vive em HTML, não em `<text>`: dentro do SVG ele escalaria
            junto com o viewBox e um cartão largo no desktop viraria um número
            de 80px. Em HTML ele obedece `clamp()` — o "responsivo total" da
            spec §5. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[2%] flex items-baseline justify-center gap-1">
          <span className="font-mono-instr text-[clamp(1.125rem,13cqw,2.125rem)] font-semibold leading-none tabular-nums text-texto">
            {semLeitura ? "—" : formatarNumero(valor)}
          </span>
          <span className="font-mono-instr text-[clamp(0.625rem,4.5cqw,0.8125rem)] leading-none text-dim">
            {unidade}
          </span>
        </div>
      </div>
    </div>
  )
}

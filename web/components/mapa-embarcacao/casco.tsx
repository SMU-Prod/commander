import Link from "next/link"
import { ROTULO_ZONA, ZONAS, type ZonaEmbarcacao } from "@/lib/domain/mapa-embarcacao"
import { rotuloDoFarol, type StatusFarol } from "@/lib/domain/semaforo"

/**
 * O PALCO do Mapa da Embarcação (onda 61, spec §3.1–3.2): o corte lateral
 * de uma motor yacht de flybridge, proa pra ESQUERDA, com um pino por zona
 * que tenha equipamento. Regra Navionics (docs/DESIGN.md §2): o desenho é
 * chrome — traço fino em `--linha`, preenchimento em `--superficie` — e os
 * PINOS são o dado.
 *
 * O 3D é o destino (onda 62, decisão do dono em 16/08): este SVG é o palco
 * versão 1. Por isso o CONTRATO é o que importa aqui — `zonas` (contagem e
 * estado por zona), `selecionada` e `hrefBase` sobrevivem intactos quando o
 * SVG virar canvas three.js; só o desenho troca.
 *
 * Decisões de forma:
 * - o desenho é um `<svg>` decorativo (`aria-hidden`); TODA a informação
 *   mora nos links dos pinos, com `aria-label` completo ("Praça de
 *   máquinas, 4 equipamentos, atenção");
 * - os pinos são HTML absoluto por cima do SVG, não círculos dentro dele:
 *   assim o alvo de toque fica em PIXEL (44px do `<a>`, círculo visual de
 *   32px) em qualquer largura de tela, em vez de encolher junto com o
 *   viewBox no celular;
 * - zona selecionada: contorno `--acao` no pino (o ÚNICO dourado de
 *   conteúdo da tela) + a região correspondente do corte levemente acesa;
 * - pino cinza (`--texto-dim`) quando `estado` é null — zona com
 *   equipamento mas sem NENHUM dado atrás. Nunca verde por omissão (mesma
 *   régua de `seloDoFarol`/`estadoDaZona`);
 * - RSC puro, zero JS de cliente: a seleção vem de `?zona=` na URL (§3.3).
 */

export interface ZonaDoCasco {
  zona: ZonaEmbarcacao
  quantidade: number
  estado: StatusFarol | null
}

/* Espaço do desenho. Tudo abaixo (âncoras de pino, regiões, caminhos) fala
   nessas coordenadas; os pinos convertem pra porcentagem pra sobreviver a
   qualquer largura renderizada. */
const LARGURA = 760
const ALTURA = 320
const pct = (p: { x: number; y: number }) => ({
  left: `${((p.x / LARGURA) * 100).toFixed(2)}%`,
  top: `${((p.y / ALTURA) * 100).toFixed(2)}%`,
})

/** A linha d'água — a fronteira semântica do desenho: acima dela, obras
 *  mortas; abaixo, a zona CASCO. */
const LINHA_DAGUA = 240

/** Os traços estruturais do barco, nomeados porque servem DUAS vezes: como
 *  desenho e como recorte (clipPath) das regiões de seleção. Os caminhos do
 *  casco/casaria/flybridge ficam ABERTOS de propósito: o fill fecha a forma
 *  sozinho, e a borda que fecharia (a linha d'água no casco, a base da
 *  casaria no convés) não ganha traço — senão o tracejado da linha d'água
 *  viraria linha cheia e a base da casaria desenharia uma risca no meio do
 *  costado. */
const TRACO = {
  /* obras mortas: roda de proa lançada, borda sobe suave até a proa, gio
     levemente invertido na popa */
  cascoAcima: "M108 240 C84 205 70 168 66 140 C250 152 500 176 700 192 L712 240",
  /* obras vivas: fundo de planeio — mais fundo a meia-nau, subindo pro gio */
  cascoAbaixo: "M108 240 C150 262 260 274 400 276 C520 277 630 268 712 240",
  /* casaria: para-brisa bem inclinado, teto longo, espelho da cabine em rake */
  casaria: "M270 156 L318 100 C380 94 450 92 520 94 L556 178",
  /* flybridge: para-brisa próprio e o deque se lançando POR CIMA do cockpit —
     o balanço sobre a popa é o que faz o perfil ser "de flybridge" */
  flybridge: "M330 96 L352 66 C420 58 480 58 540 62 L596 66 L604 96",
  /* arco de radar inclinado pra ré, plantado no fim do flybridge */
  arco: "M558 64 L570 40 L594 40 L586 66 Z",
  /* radome: meia-cúpula sobre o arco */
  radome: "M570 40 A12 7 0 0 1 594 40 Z",
  plataforma: "M712 234 L748 234 L748 241 L712 241 Z",
} as const

/** Âncora do pino de cada zona, DENTRO da região dela no corte. Vizinhas
 *  guardam ≥100 unidades entre si — a 358px de largura útil (celular de
 *  390px com padding) isso dá ≥47px entre centros, e os alvos de 44px não
 *  se atropelam. */
const PINO: Record<ZonaEmbarcacao, { x: number; y: number }> = {
  proa: { x: 150, y: 195 },
  conves: { x: 250, y: 200 },
  casaria: { x: 360, y: 142 },
  flybridge: { x: 465, y: 78 },
  praca_de_maquinas: { x: 555, y: 210 },
  popa: { x: 680, y: 205 },
  casco: { x: 390, y: 262 },
}

/** A região de cada zona no corte — o contorno que acende quando a zona
 *  está selecionada (imagem 5 do catálogo: item selecionado no desenho
 *  ganha contorno dourado). São aproximações honestas de um corte 2D —
 *  fatias verticais (anteparas SÃO verticais) recortadas pela silhueta do
 *  barco via clipPath, pra região acesa abraçar o costado em vez de virar
 *  caixa flutuando. */
const REGIAO: Record<ZonaEmbarcacao, string> = {
  proa: "M50 70 L225 70 L225 240 L50 240 Z",
  conves: "M225 120 L270 120 L270 240 L225 240 Z",
  casaria: `${TRACO.casaria} Z`,
  flybridge: "M326 98 L350 62 L554 58 L564 32 L600 32 L598 98 Z",
  praca_de_maquinas: "M470 184 L640 184 L640 240 L470 240 Z",
  popa: "M640 178 L716 178 L716 240 L640 240 Z M712 234 L748 234 L748 241 L712 241 Z",
  casco: `${TRACO.cascoAbaixo} Z`,
}

/** Cor E palavra: a cor entra por estas classes, a palavra entra no
 *  `aria-label` via `rotuloDoFarol` (docs/DESIGN.md §6, regra 3). */
const COR_PINO: Record<StatusFarol, string> = {
  ok: "border-ok text-ok",
  atencao: "border-warn text-warn",
  vencido: "border-crit text-crit",
}
const COR_PINO_SEM_DADO = "border-dim text-dim"

function rotuloDoPino({ zona, quantidade, estado }: ZonaDoCasco): string {
  const plural = quantidade === 1 ? "equipamento" : "equipamentos"
  return `${ROTULO_ZONA[zona]}, ${quantidade} ${plural}, ${rotuloDoFarol(estado).toLocaleLowerCase("pt-BR")}`
}

export function Casco({
  zonas,
  selecionada = null,
  hrefBase,
}: {
  zonas: readonly ZonaDoCasco[]
  selecionada?: ZonaEmbarcacao | null
  hrefBase: string
}) {
  /* Ordem espacial fixa (proa→popa, casco por último) independente da ordem
     em que o chamador montou o array — e é também a ordem de tabulação dos
     pinos. Zona com contagem zero não ganha pino: pino "0" seria decorar o
     vazio (DESIGN §6.4); zona sem equipamento simplesmente não está aqui. */
  const porZona = new Map(zonas.map((z) => [z.zona, z]))
  const pinos = ZONAS.map((zona) => porZona.get(zona)).filter((z): z is ZonaDoCasco => z != null && z.quantidade > 0)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} aria-hidden="true" className="block h-auto w-full">
        {/* A silhueta inteira do barco, como recorte das regiões de seleção.
            Id estático: o mapa renderiza UM casco por tela. */}
        <defs>
          <clipPath id="casco-silhueta">
            <path d={TRACO.cascoAcima} />
            <path d={TRACO.cascoAbaixo} />
            <path d={TRACO.casaria} />
            <path d={TRACO.flybridge} />
            <path d={TRACO.arco} />
            <path d={TRACO.radome} />
            <path d={TRACO.plataforma} />
          </clipPath>
        </defs>
        {/* ---- o barco (chrome) ---------------------------------------- */}
        <g strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className="stroke-dim" fill="none">
          {/* obras vivas — a faixa da zona CASCO, abaixo da linha d'água */}
          <path d={TRACO.cascoAbaixo} className="fill-panel2" />
          {/* obras mortas, casaria, flybridge, arco de radar e radome */}
          <path d={TRACO.cascoAcima} className="fill-panel" />
          <path d={TRACO.casaria} className="fill-panel" />
          <path d={TRACO.flybridge} className="fill-panel" />
          <path d={TRACO.arco} className="fill-panel" />
          <path d={TRACO.radome} className="fill-panel" />
          <path d={TRACO.plataforma} className="fill-panel" />
        </g>
        {/* ---- os detalhes (mais finos, um degrau mais apagados) -------- */}
        <g strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" className="stroke-line" fill="none">
          {/* friso do costado (quebra a chapa lisa) */}
          <path d="M116 218 C300 206 500 200 700 204" />
          {/* faixa envidraçada da casaria + montantes */}
          <path d="M330 116 L510 110 L514 126 L336 132 Z" className="fill-panel2" />
          <path d="M390 114 L394 130 M450 112 L454 128" />
          {/* antena sobre o arco */}
          <path d="M592 40 L600 22" />
          {/* balaustrada da proa */}
          <path d="M74 128 C150 120 220 130 278 150" />
          <path d="M100 125 L100 143 M150 121 L150 148 M205 127 L205 152 M255 140 L255 156" />
          {/* balaustrada do cockpit, embaixo do balanço do flybridge */}
          <path d="M566 160 C620 162 668 168 698 176" />
          <path d="M585 161 L585 182 M630 164 L630 186 M676 170 L676 190" />
          {/* vigias de proa e janela do costado do salão */}
          <circle cx={170} cy={186} r={4.5} />
          <circle cx={200} cy={190} r={4.5} />
          <circle cx={230} cy={194} r={4.5} />
          <rect x={330} y={182} width={140} height={11} rx={5.5} />
          {/* eixo, hélice e leme — o que faz o corte ser de MOTOR yacht */}
          <path d="M540 268 L592 282" />
          <circle cx={596} cy={283} r={6} />
          <path d="M636 266 L642 290" />
        </g>
        {/* linha d'água tracejada POR CIMA dos preenchimentos, atravessando
            o palco inteiro — é ela que separa a zona casco do resto */}
        <line
          x1={24}
          y1={LINHA_DAGUA}
          x2={748}
          y2={LINHA_DAGUA}
          strokeDasharray="7 6"
          className="stroke-dim"
          strokeWidth={1}
        />
        {/* ---- a região selecionada acende (o dourado da tela) ---------- */}
        {selecionada && (
          <path
            d={REGIAO[selecionada]}
            clipPath="url(#casco-silhueta)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="fill-accent/10 stroke-accent"
          />
        )}
      </svg>

      {/* Orientação escrita nas pontas — a lição do "Front (Cab) ← → Rear
          (Doors)" da imagem 5. Em HTML absoluto (não <text>) pra ficar nos
          11px da escala em qualquer largura. */}
      <span aria-hidden="true" className="rotulo pointer-events-none absolute bottom-0 left-0 text-dim">
        PROA ←
      </span>
      <span aria-hidden="true" className="rotulo pointer-events-none absolute bottom-0 right-0 text-dim">
        → POPA
      </span>

      {/* ---- os pinos (o dado) ------------------------------------------ */}
      {pinos.map((z) => {
        const ativa = selecionada === z.zona
        return (
          <Link
            key={z.zona}
            href={`${hrefBase}?zona=${z.zona}`}
            aria-label={rotuloDoPino(z)}
            aria-current={ativa ? "true" : undefined}
            className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={pct(PINO[z.zona])}
          >
            <span
              className={`flex size-8 items-center justify-center rounded-full border-2 bg-panel font-mono-instr text-xs font-semibold tabular-nums ${
                z.estado ? COR_PINO[z.estado] : COR_PINO_SEM_DADO
              } ${ativa ? "outline-2 outline-offset-2 outline-accent" : ""}`}
            >
              {z.quantidade}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

import type { ChaveHub } from "@/lib/ui/hubs"

/**
 * OS OITO OBJETOS DOS HUBS, DESENHADOS AQUI.
 * ===========================================================================
 * O §6 do Guia de Design v1 pede uma biblioteca de renders 3D por hub. Ela não
 * existe, e a busca por uma pronta e gratuita deu negativo — o levantamento
 * fonte por fonte está em `docs/DESIGN-SYSTEM.md` §15.3: nenhuma biblioteca
 * CC0 séria (3dicons, Kenney, Poly Haven) tem motor marítimo, casco, bomba ou
 * balsa, e misturar procedências fura o próprio §6 ("não misturar sólido,
 * outline, emoji, clipart e 3D na mesma função").
 *
 * Então os objetos são DESENHADOS, em projeção isométrica. Não é ícone
 * ampliado — é volume: cada peça tem três faces com luz diferente, e a cena
 * inteira obedece à mesma câmera. O §6 exige exatamente isso do pacote final
 * ("perspectiva 3/4 consistente, luz principal superior esquerda, fundo
 * transparente, rim light na cor do hub"), e é o que dá para cumprir sem
 * asset: a projeção é a mesma para os oito, a luz vem do mesmo canto, o fundo
 * é transparente e a cor é a do hub via `currentColor`.
 *
 * ---------------------------------------------------------------------------
 * A PROJEÇÃO, EM UMA LINHA
 * ---------------------------------------------------------------------------
 * Isometria clássica 2:1 — `x` cresce para a direita e para baixo, `y` para a
 * esquerda e para baixo, `z` sobe. É a mesma matemática das cartas náuticas
 * em perspectiva e do desenho técnico: linhas paralelas continuam paralelas,
 * então NÃO existe ponto de fuga para errar, e as oito cenas encaixam sem
 * ninguém precisar conferir ângulo à mão.
 *
 * ---------------------------------------------------------------------------
 * A LUZ, E POR QUE A FACE DA ESQUERDA É A MAIS CLARA DEPOIS DO TOPO
 * ---------------------------------------------------------------------------
 * §6: *"luz principal superior esquerda"*. Na isometria, a face de `y+dy` cai
 * do lado esquerdo da tela e a de `x+dx` do direito — então topo 72%, esquerda
 * 45%, direita 26%. Três degraus e não dois: com dois, um cubo vira um "L" e
 * o volume some. As opacidades são as mesmas nas oito cenas, o que é o que faz
 * um motor e uma pasta parecerem do mesmo mundo.
 *
 * ---------------------------------------------------------------------------
 * ZERO COR ESCRITA À MÃO
 * ---------------------------------------------------------------------------
 * Tudo é `currentColor` com `fillOpacity`/`strokeOpacity`. Quem define a cor é
 * o `text-hub-*` do pai (`HeroiTecnico`), então trocar o token de um hub
 * repinta o objeto dele sozinho — e o teto de `lib/ui/tokens.test.ts` continua
 * zero neste arquivo.
 */

/** cos(30°). A constante da isometria 2:1. */
const C = 0.866
type Ponto = readonly [number, number]

/** Um ponto do espaço na tela. `z` sobe; `x` vai para a direita, `y` para a esquerda. */
function p(x: number, y: number, z: number): Ponto {
  return [(x - y) * C, (x + y) * 0.5 - z]
}

function pts(lista: readonly Ponto[]): string {
  return lista.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")
}

/** Topo, esquerda, direita — a escada de luz do §6, num lugar só. */
const LUZ = { topo: 0.72, esquerda: 0.45, direita: 0.26 } as const
/** O fio que contorna cada face. É ele que dá o ar de desenho TÉCNICO em vez
 *  de blocos coloridos — e é o "rim light" do §6 resolvido como aresta. */
const FIO = { stroke: "currentColor", strokeOpacity: 0.55, strokeWidth: 0.9, strokeLinejoin: "round" } as const

/** Uma caixa. Três faces visíveis, cada uma no seu degrau de luz. */
function Caixa({
  x, y, z, dx, dy, dz,
}: { x: number; y: number; z: number; dx: number; dy: number; dz: number }) {
  const topo = [p(x, y, z + dz), p(x + dx, y, z + dz), p(x + dx, y + dy, z + dz), p(x, y + dy, z + dz)]
  const dir = [p(x + dx, y, z), p(x + dx, y + dy, z), p(x + dx, y + dy, z + dz), p(x + dx, y, z + dz)]
  const esq = [p(x, y + dy, z), p(x + dx, y + dy, z), p(x + dx, y + dy, z + dz), p(x, y + dy, z + dz)]
  return (
    <g {...FIO}>
      <polygon points={pts(dir)} fill="currentColor" fillOpacity={LUZ.direita} />
      <polygon points={pts(esq)} fill="currentColor" fillOpacity={LUZ.esquerda} />
      <polygon points={pts(topo)} fill="currentColor" fillOpacity={LUZ.topo} />
    </g>
  )
}

/**
 * Um cilindro de eixo vertical. A tampa é uma elipse porque círculo em
 * isometria É elipse — proporção 2:1,155, que é `rx = r·2C` e `ry = r`.
 * O corpo é o quadrilátero entre os extremos das duas tampas: é aproximação,
 * e é a aproximação certa nesta escala (a barriga do cilindro mede menos de
 * meio pixel a 96px de altura).
 */
function Cilindro({
  cx, cy, z, r, h,
}: { cx: number; cy: number; z: number; r: number; h: number }) {
  const rx = r * 2 * C
  const [tx, ty] = p(cx, cy, z + h)
  const [bx, by] = p(cx, cy, z)
  const corpo = [
    [tx - rx, ty] as const, [tx + rx, ty] as const,
    [bx + rx, by] as const, [bx - rx, by] as const,
  ]
  return (
    <g {...FIO}>
      <polygon points={pts(corpo)} fill="currentColor" fillOpacity={LUZ.direita} />
      <ellipse cx={bx} cy={by} rx={rx} ry={r} fill="currentColor" fillOpacity={LUZ.esquerda} />
      <ellipse cx={tx} cy={ty} rx={rx} ry={r} fill="currentColor" fillOpacity={LUZ.topo} />
    </g>
  )
}

/** Um cilindro deitado no eixo x — eixo de manivela, tubo, guincho. */
function Tubo({
  x, cy, cz, r, comp,
}: { x: number; cy: number; cz: number; r: number; comp: number }) {
  const rx = r * 2 * C
  const [ax, ay] = p(x, cy, cz)
  const [bx2, by2] = p(x + comp, cy, cz)
  const corpo = [
    [ax, ay - r] as const, [bx2, by2 - r] as const,
    [bx2, by2 + r] as const, [ax, ay + r] as const,
  ]
  return (
    <g {...FIO}>
      <polygon points={pts(corpo)} fill="currentColor" fillOpacity={LUZ.esquerda} />
      <ellipse cx={bx2} cy={by2} rx={r * 0.7} ry={rx * 0.55} fill="currentColor" fillOpacity={LUZ.topo} />
    </g>
  )
}

/* ===========================================================================
   AS OITO CENAS. Cada uma é montada com as três primitivas acima, em torno da
   origem, dentro de um viewBox de 200×160 — a mesma caixa para todas, que é o
   que o §6 chama de "tamanhos e ângulos padronizados".
   =========================================================================== */

/** Motor marítimo: bloco, cabeçote, coletor de escape, volante e berço. */
function Motor() {
  return (
    <>
      <Caixa x={-26} y={-16} z={0} dx={10} dy={32} dz={4} />
      <Caixa x={14} y={-16} z={0} dx={10} dy={32} dz={4} />
      <Caixa x={-24} y={-14} z={4} dx={44} dy={28} dz={20} />
      <Caixa x={-16} y={-9} z={24} dx={30} dy={18} dz={9} />
      <Cilindro cx={-8} cy={-14} z={33} r={4} h={6} />
      <Cilindro cx={2} cy={-14} z={33} r={4} h={6} />
      <Cilindro cx={12} cy={-14} z={33} r={4} h={6} />
      <Tubo x={20} cy={0} cz={16} r={9} comp={12} />
    </>
  )
}

/** Casco: convés, costados e quilha. Proa em x positivo. */
function Casco() {
  const deck = [
    p(-34, -13, 12), p(20, -13, 12), p(40, 0, 12), p(20, 13, 12), p(-34, 13, 12),
  ]
  const costadoEsq = [
    p(-34, 13, 12), p(20, 13, 12), p(40, 0, 12), p(34, 0, 0), p(-30, 0, 0),
  ]
  const costadoDir = [
    p(-34, -13, 12), p(20, -13, 12), p(40, 0, 12), p(34, 0, 0), p(-30, 0, 0),
  ]
  return (
    <g {...FIO}>
      <polygon points={pts(costadoDir)} fill="currentColor" fillOpacity={LUZ.direita} />
      <polygon points={pts(costadoEsq)} fill="currentColor" fillOpacity={LUZ.esquerda} />
      <polygon points={pts(deck)} fill="currentColor" fillOpacity={LUZ.topo} />
      {/* A superestrutura, para o casco não ler como uma cunha. */}
      <Caixa x={-20} y={-8} z={12} dx={22} dy={16} dz={11} />
    </g>
  )
}

/** Elétrica: banco de três baterias com terminais e barramento. */
function Eletrica() {
  return (
    <>
      <Caixa x={-30} y={-18} z={0} dx={60} dy={36} dz={3} />
      {[-26, -4, 18].map((x) => (
        <g key={x}>
          <Caixa x={x} y={-14} z={3} dx={18} dy={28} dz={20} />
          <Cilindro cx={x + 4} cy={-8} z={23} r={2.5} h={4} />
          <Cilindro cx={x + 13} cy={-8} z={23} r={2.5} h={4} />
        </g>
      ))}
      {/* O barramento que liga os três — é ele que faz "banco" em vez de
          "três caixas". */}
      <Caixa x={-22} y={-9} z={26} dx={44} dy={2} dz={1.5} />
    </>
  )
}

/** Hidráulica: tanque, bomba e a tubulação entre os dois. */
function Hidraulica() {
  return (
    <>
      <Caixa x={-32} y={-18} z={0} dx={64} dy={36} dz={3} />
      <Cilindro cx={-14} cy={0} z={3} r={15} h={34} />
      <Caixa x={10} y={-10} z={3} dx={20} dy={20} dz={14} />
      <Cilindro cx={20} cy={0} z={17} r={7} h={9} />
      {/* O tubo que sai do tanque e entra na bomba. */}
      <Caixa x={-2} y={-2} z={20} dx={14} dy={4} dz={4} />
    </>
  )
}

/**
 * Segurança: boia salva-vidas deitada e extintor em pé, separados na base.
 *
 * A BOIA É UMA ELIPSE COM TRAÇO GROSSO, e não duas concêntricas com `evenodd`.
 * O furo por regra de preenchimento exigiria pintar o miolo da cor do painel —
 * e o painel aqui tem um véu colorido por cima, então "a cor do painel" não é
 * uma cor só. Traço grosso vaza o miolo de verdade, em qualquer fundo.
 *
 * O RAIO DA BOIA SAI DA PROJEÇÃO, e não do olho: um círculo de raio 18 no
 * chão isométrico projeta uma elipse de `rx = 18·2·cos30` por `ry = 18·0,5·2`.
 * O primeiro desenho usou 26×15 escolhidos à mão e a boia saiu maior que a
 * base e encavalada no extintor — que foi o que o dono viu.
 */
function Seguranca() {
  const rBoia = 17
  const [ax, ay] = p(-16, 0, 4)
  const rx = rBoia * 2 * C
  return (
    <>
      <Caixa x={-36} y={-22} z={0} dx={72} dy={44} dz={3} />
      <ellipse
        cx={ax} cy={ay} rx={rx} ry={rBoia}
        fill="none" stroke="currentColor" strokeOpacity={LUZ.direita + 0.14} strokeWidth={10}
      />
      <ellipse
        cx={ax} cy={ay - 3.5} rx={rx} ry={rBoia}
        fill="none" stroke="currentColor" strokeOpacity={LUZ.topo} strokeWidth={5}
      />
      <Cilindro cx={26} cy={0} z={3} r={9} h={26} />
      <Cilindro cx={26} cy={0} z={29} r={4} h={7} />
    </>
  )
}

/** Equipamentos: guincho de tambor sobre berço, com a manivela. */
function Equipamentos() {
  return (
    <>
      <Caixa x={-30} y={-16} z={0} dx={60} dy={32} dz={3} />
      <Caixa x={-26} y={-14} z={3} dx={8} dy={28} dz={22} />
      <Caixa x={18} y={-14} z={3} dx={8} dy={28} dz={22} />
      <Tubo x={-18} cy={0} cz={22} r={13} comp={36} />
      <Cilindro cx={-22} cy={0} z={30} r={4} h={5} />
    </>
  )
}

/** Documentos: três pastas empilhadas com desencontro. */
function Documentos() {
  return (
    <>
      <Caixa x={-26} y={-20} z={0} dx={52} dy={40} dz={5} />
      <Caixa x={-22} y={-17} z={5} dx={46} dy={35} dz={5} />
      <Caixa x={-18} y={-14} z={10} dx={40} dy={30} dz={5} />
      {/* A aba da pasta de cima — o detalhe que faz "pasta" e não "bloco". */}
      <Caixa x={-18} y={-14} z={15} dx={14} dy={8} dz={2} />
    </>
  )
}

/**
 * Manutenções: engrenagem em isometria com a chave apoiada à frente.
 *
 * O MIOLO É MENOR QUE O ANEL DE DENTES, e isso é o conserto do primeiro
 * desenho: o cilindro central tinha raio 20 contra dentes a raio 24, e a
 * tampa dele (elipse de rx = 20·2·cos30 ≈ 34,6) cobria os dentes inteiros —
 * a engrenagem saía como uma bolha. Com miolo 13 e dentes a 23, a tampa mede
 * 22,5 de rx e os dentes aparecem em volta dela.
 *
 * A ORDEM DE PINTURA É POR PROFUNDIDADE, e não a ordem do laço. Em isometria
 * quem está atrás tem `x+y` menor; desenhar na ordem do ângulo faria um dente
 * de trás cobrir um da frente. Por isso os dentes são ordenados antes de
 * desenhar — é o "z-sort" que qualquer cena isométrica precisa e que a
 * primeira versão não tinha.
 */
function Manutencoes() {
  const dentes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return { x: Math.cos(a) * 23, y: Math.sin(a) * 23 }
  }).sort((a, b) => a.x + a.y - (b.x + b.y))
  const [gx, gy] = p(0, 0, 13)
  return (
    <>
      <Caixa x={-34} y={-22} z={0} dx={68} dy={44} dz={3} />
      {dentes.map((d, i) => (
        <Caixa key={i} x={d.x - 4.5} y={d.y - 4.5} z={3} dx={9} dy={9} dz={10} />
      ))}
      <Cilindro cx={0} cy={0} z={3} r={13} h={10} />
      {/* O furo do eixo — sombra rasa no centro da tampa. */}
      <ellipse cx={gx} cy={gy} rx={5 * 2 * C} ry={5} fill="currentColor" fillOpacity={0.1} {...FIO} />
      {/* A chave, deitada NA FRENTE da engrenagem (x+y maior), com a boca
          aberta na ponta. Antes ela ficava em y=16, dentro do anel de dentes:
          sumia debaixo da engrenagem. */}
      <Caixa x={-14} y={30} z={3} dx={36} dy={5} dz={4} />
      <Caixa x={20} y={27} z={3} dx={8} dy={11} dz={4} />
    </>
  )
}

const CENA: Record<ChaveHub, () => React.ReactElement> = {
  motores: Motor,
  casco: Casco,
  eletrica: Eletrica,
  hidraulica: Hidraulica,
  seguranca: Seguranca,
  equipamentos: Equipamentos,
  documentos: Documentos,
  manutencoes: Manutencoes,
}

export function ObjetoHub({ chave, className = "" }: { chave: ChaveHub; className?: string }) {
  const Desenho = CENA[chave]
  return (
    // O `viewBox` centrado na origem é o que permite as cenas serem escritas em
    // coordenadas do OBJETO (a origem é o centro dele) em vez de coordenadas de
    // tela — sem isso, cada cena precisaria de um deslocamento próprio e o
    // "mesmo enquadramento nos oito" viraria ajuste manual oito vezes.
    //
    // OS LIMITES SÃO CALCULADOS, NÃO CHUTADOS. As cenas usam x,y em [-34,40] e
    // z em [0,40]; a projeção leva isso a horizontal (x−y)·0,866 ∈ [−47, 50] e
    // vertical (x+y)/2 − z ∈ [−66, 29]. A caixa abaixo é essa faixa com 6 de
    // folga. O primeiro enquadramento era 200×150 e desenhava o objeto dentro
    // de um terço da altura — parecia miniatura, e foi o que o dono viu.
    <svg viewBox="-56 -72 112 104" className={className} aria-hidden="true">
      <Desenho />
    </svg>
  )
}

import type { EstadoSelo } from "./selo"

/**
 * A caixa de ferramentas compartilhada dos INSTRUMENTOS (medidor de arco,
 * donut de nível, barra de capacidade, gráficos, progresso de rota).
 *
 * Existe por dois motivos que só ficam óbvios depois de escrever o segundo
 * instrumento:
 *
 * 1. TRIGONOMETRIA NÃO É DESIGN. `pontoNoArco`/`caminhoArco` estavam prestes
 *    a ser copiadas entre `medidor` e `donut-nivel` — e arco copiado deriva
 *    igual pílula copiada derivou nas 12 telas que originaram o `Chip`.
 *
 * 2. COR DE INSTRUMENTO NUNCA É LITERAL. `COR_TOM` traduz o tom semântico
 *    para a custom property de `app/globals.css`. Dentro de SVG não existe
 *    classe utilitária do Tailwind para `stop-color`/`stroke` de gradiente:
 *    o único jeito honesto é `var(--ok)`, e o único jeito de garantir que
 *    todo instrumento use a MESMA string é ela morar aqui. É o que mantém os
 *    sete arquivos novos em zero na catraca de cor literal
 *    (`lib/ui/tokens.test.ts`), que para arquivo novo é literalmente zero.
 *
 * Mora em `components/ui/` e não em `lib/` de propósito: só a interface
 * consome isto, e `.ts` (não `.tsx`) porque não renderiza nada.
 */

/** O tom de um instrumento é o mesmo vocabulário do `Selo` — quatro estados,
 *  não uma escala nova. Instrumento que inventa a própria paleta é a deriva
 *  que a onda 57 fechou. */
export type TomInstrumento = EstadoSelo

/** Tom → custom property. `neutro` cai em `--linha` (o trilho): é o valor de
 *  "sem dado", e sem dado NÃO é verde — ver `tomPorUso`. */
export const COR_TOM: Record<TomInstrumento, string> = {
  ok: "var(--ok)",
  atencao: "var(--warn)",
  critico: "var(--crit)",
  neutro: "var(--linha)",
}

/** A mesma tradução em classe utilitária, para o texto/fundo fora do SVG. */
export const TEXTO_TOM: Record<TomInstrumento, string> = {
  ok: "text-ok",
  atencao: "text-warn",
  critico: "text-crit",
  neutro: "text-dim",
}

export const FUNDO_TOM: Record<TomInstrumento, string> = {
  ok: "bg-ok",
  atencao: "bg-warn",
  critico: "bg-crit",
  neutro: "bg-line",
}

export const BORDA_TOM: Record<TomInstrumento, string> = {
  ok: "border-ok/40 text-ok",
  atencao: "border-warn/40 text-warn",
  critico: "border-crit/40 text-crit",
  neutro: "border-line text-dim",
}

/**
 * Quantas casas decimais o número PEDE — não quantas o programador lembrou de
 * passar. `28700` sai "28.700" (inteiro é inteiro), `282.1` sai "282,1" e
 * `3.61` sai "3,61". Sem isto, ou toda distância ganha ",00" ou todo volume
 * perde o centésimo, e nos dois casos o mostrador mente sobre a precisão.
 */
function casasAuto(valor: number): number {
  if (Number.isInteger(valor)) return 0
  return Math.abs(valor * 10 - Math.round(valor * 10)) < 1e-9 ? 1 : 2
}

/**
 * Número no padrão pt-BR (ponto no milhar, vírgula no decimal), à mão em vez
 * de `Intl.NumberFormat`: o valor entra em SVG e em teste de string, e
 * `Intl` traz espaço-estreito-sem-quebra (U+202F) em algumas versões de ICU —
 * um caractere invisível que reprova `toContain("28.700")` sem dar pista.
 */
export function formatarNumero(valor: number, casas = casasAuto(valor)): string {
  const fixo = Math.abs(valor).toFixed(casas)
  const [inteira, decimal] = fixo.split(".")
  const agrupada = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${valor < 0 ? "-" : ""}${agrupada}${decimal ? `,${decimal}` : ""}`
}

/** Fração 0..1 de `valor` dentro de `max`, presa nas duas pontas. É ela que
 *  impede 110% de estourar a barra para fora do trilho. */
export function fracao(valor: number | null | undefined, max: number): number {
  if (valor == null || !Number.isFinite(valor) || max <= 0) return 0
  return Math.min(1, Math.max(0, valor / max))
}

/** Percentual apresentável (0..100, inteiro), preso igual. */
export function percentualPreso(pct: number | null | undefined): number {
  if (pct == null || !Number.isFinite(pct)) return 0
  return Math.min(100, Math.max(0, Math.round(pct)))
}

/**
 * O tom de uma medida de OCUPAÇÃO (quanto do teto já foi gasto: peso, volume,
 * cota de fotos). Mais cheio é pior — o contrário de um tanque de combustível,
 * que não usa esta função.
 *
 * `null` E `0` caem em `neutro`, e essa é a regra que o teste guarda: neste
 * app "zero usado" quase sempre significa "ninguém preencheu ainda", e pintar
 * de verde um cartão vazio é dizer "está tudo em dia" sobre um dado que não
 * existe (docs/DESIGN.md §6 — não decorar o vazio). Quem tem zero legítimo
 * passa o tom na mão.
 */
export function tomPorUso(percentual: number | null | undefined): TomInstrumento {
  if (percentual == null || !Number.isFinite(percentual) || percentual <= 0) return "neutro"
  if (percentual >= 90) return "critico"
  if (percentual >= 60) return "atencao"
  return "ok"
}

/**
 * O TETO DO EIXO Y — o número redondo logo acima do maior dado.
 *
 * Sem isto, o eixo ou é fixo em 100 (e um gráfico de horas de motor com 340h
 * sai todo estourado) ou é o próprio máximo (e o eixo lê "0 · 23,55 · 47,1 ·
 * 70,65 · 94,2", que ninguém consegue usar de relance). Escolhe o PASSO numa
 * escala de números que a cabeça reconhece — 1, 1,5, 2, 2,5, 3, 4, 5, 6, 8,
 * 10 vezes a potência de dez — e o teto é `passo × divisões`.
 *
 * Nota de acaso feliz: dado até 94,2 devolve teto 100 e o eixo sai
 * `0/25/50/75/100`, exatamente o da imagem de referência.
 */
const PASSOS_BONITOS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

export function escalaTopo(bruto: number, divisoes = 4): number {
  if (!Number.isFinite(bruto) || bruto <= 0) return 100
  const alvo = bruto / divisoes
  const exp = 10 ** Math.floor(Math.log10(alvo))
  const passo = PASSOS_BONITOS.map((m) => m * exp).find((p) => p >= alvo - 1e-9) ?? 10 * exp
  return Math.round(passo * divisoes * 1000) / 1000
}

/**
 * A RÉGUA DE CASA DECIMAL DE TODA COORDENADA QUE ENTRA NUM SVG — duas casas.
 *
 * Ela existia inline dentro de `pontoNoArco` desde que o primeiro instrumento
 * foi escrito, e por isso passou por decoração de arredondamento. Não é: é o
 * que impede ERRO DE HIDRATAÇÃO. `Math.cos`/`Math.sin` são as duas funções que
 * o ECMAScript explicitamente NÃO exige serem bit-idênticas entre
 * implementações — o Node que renderiza no servidor e o V8 do navegador podem
 * divergir no último dígito do double. Serializado cru, o servidor manda
 * `translate(63.674192626285084,…)` e o cliente calcula
 * `63.67419262628509`: o React reclama e NÃO conserta ("This won't be patched
 * up"). A varredura de 19/08 achou o erro em 17 das 73 rotas do app, e a causa
 * era exatamente esta — os dois selos calculavam polar e devolviam o float
 * cru. Arredondar MATA a divergência porque `Math.round` de dois valores que
 * só diferem no 15º dígito devolve o mesmo inteiro, e a divisão por 100 que
 * vem depois é operação básica de IEEE 754, ou seja, idêntica nos dois lados.
 *
 * DUAS CASAS, E NÃO TRÊS OU SEIS: os SVGs deste app desenham em viewBox de
 * 100 unidades e são renderizados no máximo a 160px, então uma unidade vale
 * 1,6px e o centésimo vale 0,016px — abaixo de qualquer subpixel que exista.
 * Passar a régua pra mais casas não muda desenho nenhum e aproxima do dígito
 * que diverge; passar pra menos começaria a achatar arco.
 *
 * Em rigor, só coordenada vinda de trigonometria PRECISA disto: ângulo
 * derivado de soma, multiplicação e divisão é exatamente especificado pelo
 * IEEE 754 e sai igual nos dois lados sem ajuda. Mesmo assim a régua vale pra
 * todo número que vira atributo — a invariante que `selos-hidratacao.test.ts`
 * cobra é do HTML inteiro, e uma regra sem exceção é a única que a próxima
 * pessoa aplica certo sem ter lido este parágrafo.
 */
export function arredondarCoordenada(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Ponto na circunferência. Graus em convenção MATEMÁTICA (0° = leste, sentido
 * anti-horário) com o Y invertido do SVG — então grau DECRESCENTE anda no
 * sentido horário na tela, que é como um ponteiro de velocímetro anda.
 */
export function pontoNoArco(cx: number, cy: number, raio: number, grau: number): { x: number; y: number } {
  const rad = (grau * Math.PI) / 180
  return {
    x: arredondarCoordenada(cx + raio * Math.cos(rad)),
    y: arredondarCoordenada(cy - raio * Math.sin(rad)),
  }
}

/** Comando `A` de um arco entre dois graus. Sem `M`+`A` na mão em cada
 *  componente: o par largeArc/sweep é exatamente onde arco copiado inverte. */
export function caminhoArco(cx: number, cy: number, raio: number, grauInicio: number, grauFim: number): string {
  const p1 = pontoNoArco(cx, cy, raio, grauInicio)
  const p2 = pontoNoArco(cx, cy, raio, grauFim)
  const arcoGrande = Math.abs(grauFim - grauInicio) > 180 ? 1 : 0
  // Y invertido: grau decrescente = horário na tela = sweep 1.
  const sentido = grauFim < grauInicio ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${raio} ${raio} 0 ${arcoGrande} ${sentido} ${p2.x} ${p2.y}`
}

/**
 * Id de `<defs>` estável e único POR CONTEÚDO.
 *
 * `useId()` não serve: é hook, e estes componentes são de servidor. Id fixo
 * também não: dois medidores na mesma página com zonas diferentes viram um só
 * gradiente (o navegador resolve `url(#x)` no PRIMEIRO nó do documento, e o
 * segundo medidor herdaria as cores do primeiro em silêncio). Derivando o id
 * do conteúdo do gradiente, dois iguais colidem sem consequência — porque são
 * iguais — e dois diferentes nunca colidem.
 *
 * O prefixo NUNCA pode começar com 3+ dígitos hexadecimais: `url(#dadada…)`
 * casaria com o regex da catraca de cor literal e o arquivo entraria no mapa
 * de dívida por um id de gradiente. Os prefixos usados (`zona`, `liq`, `area`)
 * começam em letra fora de a–f.
 */
export function idDefs(prefixo: string, ...partes: (string | number)[]): string {
  const assinatura = partes.join("-").replace(/[^a-zA-Z0-9-]/g, "")
  return `${prefixo}-${assinatura}`
}

/**
 * ONDA 89 (achado 4.1) — O MAPA PASSA A FALAR A COR DO TOKEN.
 *
 * O que estava medido: `/navegar` mostrava DUAS marcas ao mesmo tempo. A
 * linha da rota era um dourado cravado em hexadecimal dentro do componente e
 * a pílula de SOG encostada nela vinha de `--acao`, que no tema escuro virou
 * limão na onda 79. Duas cores de marca, na mesma tela, lado a lado.
 *
 * POR QUE PRECISOU DE UM MÓDULO E NÃO DE UM `var(--acao)`: as camadas do
 * Mapbox pintam num canvas WebGL, não no DOM. `"line-color": "var(--acao)"`
 * não é CSS — é uma string que o Mapbox tenta interpretar como cor e
 * descarta. O único caminho honesto é LER o valor já computado do token no
 * documento e entregar a string resolvida pro `paint`. Este módulo é essa
 * leitura, e só ela: de agora em diante nenhum componente de mapa escreve
 * cor de camada à mão.
 *
 * ALTERNATIVA DESCARTADA — duplicar os valores dos dois temas num objeto TS
 * e escolher pelo `data-theme`: seria uma segunda fonte da verdade pras
 * mesmas cores, e a divergência que o achado 4.1 documenta (o comentário do
 * `Mostrador` afirmando um dourado que já não existia) nasceu exatamente
 * assim. Ler o documento não tem como divergir dele.
 *
 * O QUE FICA DE FORA, DE PROPÓSITO: os `.ts` onde o Mapbox pede string de
 * cor sem nenhum documento por perto (a paleta curada do pino de parceiro em
 * `lib/mapa/pino-parceiro.ts`, o manifesto de PWA) continuam com literal —
 * ali não há token pra consultar. Ver `lib/ui/tokens.test.ts`.
 */

/** Os tokens de `app/globals.css` que as camadas do mapa consomem. Chave =
 *  nome curto usado no código; valor = a custom property de verdade. */
export const TOKENS_MAPA = {
  /** Marca — linha da rota, ponto de virada, trilha, pino de destino. */
  acao: "--acao",
  /** O par de contraste da marca: o traço ESCURO desenhado por cima do
   *  dourado/limão (ícone dentro do pino, anel do ponto de virada, número da
   *  parada). É o único par "escuro sobre cor viva" que o app declara. */
  acaoTexto: "--acao-texto",
  /** Navy fixo de instrumento — o casing translúcido por baixo da rota, que
   *  existe pra ela continuar legível tanto no náutico claro quanto no
   *  satélite. */
  meter: "--meter",
  /** Partida da trilha. */
  ok: "--ok",
  /** Alarme de âncora, perna sem caminho, chegada da trilha. */
  crit: "--crit",
} as const

// `-readonly` porque `TOKENS_MAPA` é `as const`: sem isso o objeto montado
// dentro de `lerCoresMapa` não poderia receber os valores lidos.
export type CoresMapa = { -readonly [K in keyof typeof TOKENS_MAPA]: string }

const CHAVES = Object.keys(TOKENS_MAPA) as (keyof CoresMapa)[]

/**
 * Valor de emergência de cada token — os do TEMA CLARO, byte a byte os de
 * `app/globals.css`.
 *
 * Existe pra dois instantes, não pra uso normal: (1) o render do servidor e
 * o primeiro render do cliente, onde não há documento pra consultar; (2) o
 * caso de o token sumir do CSS (renomeado, folha não carregada). Sem ele, a
 * alternativa seria pintar com string vazia — e camada com cor vazia fica
 * TRANSPARENTE, ou seja, a linha da rota some da tela sem nenhum aviso. Num
 * app de navegação esse é o pior desfecho possível; uma cor errada por um
 * quadro é infinitamente melhor que uma rota invisível.
 */
export const CORES_MAPA_PADRAO: CoresMapa = {
  acao: "#d4af37",
  acaoTexto: "#0b1d2d",
  meter: "#0b1d2d",
  ok: "#15803d",
  crit: "#d2373c",
}

/** A regra de "vazio não vale": `getPropertyValue` devolve string vazia
 *  quando o token ainda não existe (CSS não assentou) ou não existe mais
 *  (renomeado). Nos dois casos cai no valor de emergência — ver o porquê
 *  acima. Pura de propósito: é a única parte deste módulo que dá pra testar
 *  sem navegador. */
export function escolherCor(bruto: string | null | undefined, padrao: string): string {
  const limpo = (bruto ?? "").trim()
  return limpo === "" ? padrao : limpo
}

/** Lê os cinco tokens do `<html>` de uma vez. Fora do navegador (SSR, teste
 *  em Node) devolve os valores de emergência sem lançar. */
export function lerCoresMapa(): CoresMapa {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
    return { ...CORES_MAPA_PADRAO }
  }
  const estilo = getComputedStyle(document.documentElement)
  const cores = {} as CoresMapa
  for (const chave of CHAVES) {
    cores[chave] = escolherCor(estilo.getPropertyValue(TOKENS_MAPA[chave]), CORES_MAPA_PADRAO[chave])
  }
  return cores
}

/** true = os dois conjuntos são a mesma leitura. Quem consome guarda a
 *  identidade do objeto anterior quando isto der true — `cores` entra nas
 *  dependências dos efeitos que pintam camada, e devolver objeto novo a cada
 *  disparo do observador repintaria o mapa inteiro à toa. */
export function mesmasCores(a: CoresMapa, b: CoresMapa): boolean {
  return CHAVES.every((chave) => a[chave] === b[chave])
}

/**
 * Avisa quando o tema do documento troca EM TEMPO DE EXECUÇÃO — o app tem
 * alternador claro/escuro (`components/theme-toggle.tsx`), que escreve e
 * apaga `data-theme` no `<html>`. O DOM se repinta sozinho nessa troca; o
 * canvas do Mapbox não, e é justamente por isso que este observador existe.
 *
 * `attributeFilter` cobre `data-theme` (o alternador), `class` (telas que
 * forçam um tema por classe) e `style` (token sobrescrito inline). Devolve a
 * função de desinscrever; fora do navegador devolve um no-op.
 */
export function observarTema(aoTrocar: () => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {}
  const observador = new MutationObserver(aoTrocar)
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class", "style"],
  })
  return () => observador.disconnect()
}

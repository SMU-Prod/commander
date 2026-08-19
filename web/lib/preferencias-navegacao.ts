/**
 * Preferências de navegação guardadas no APARELHO (localStorage) — onda 80
 * (consolidação dos painéis flutuantes de `/navegar`).
 *
 * As duas primeiras chaves já existiam, cada uma presa dentro do componente
 * que as usava (`CHAVE_CONSENTIMENTO_CORREDOR` em `navegar-mapa.tsx`, um
 * consentimento efêmero — nem localStorage — dentro de `sondagem-painel.tsx`).
 * Isso bastava enquanto só existia UM lugar interessado: o próprio mapa. A
 * partir desta onda existem DOIS — a tela `/navegar`, que só LÊ a preferência
 * pra decidir o que gravar, e `/menu/ajustes`, que é onde a pessoa DECIDE
 * essa preferência. O porquê da mudança de casa está no comentário grande de
 * `navegar-mapa.tsx` (procure "consentimento"): consentimento é decisão
 * deliberada, não coisa pra tocar com o barco andando, e por isso saiu de
 * cima do mapa — mas o dado em si continua sendo lido no mapa, silenciosamente.
 *
 * Preferência de DISPOSITIVO/navegador, não de conta — mesmo raciocínio do
 * `CHAVE_URL_SIGNALK` (`lib/nmea/signalk.ts`): o mesmo login em dois
 * aparelhos pode decidir diferente em cada um (ex.: barco emprestado). Por
 * isso localStorage, nunca uma coluna no banco.
 */

const CHAVE_CONSENTIMENTO_CORREDOR = "commander:consentimento-corredor"
const CHAVE_CONSENTIMENTO_SONDAGEM = "commander:consentimento-sondagem"
const CHAVE_AVISO_NAVEGAR_VISTO = "commander:aviso-navegar-visto"

function lerBooleano(chave: string): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    return localStorage.getItem(chave) === "1"
  } catch {
    return false
  }
}

function salvarBooleano(chave: string, valor: boolean) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(chave, valor ? "1" : "0")
  } catch {}
}

/** Contribuir com o mapa de corredores (onda 17) — ao salvar uma trilha, ela
 *  vira passagens anônimas agregadas por área. Opt-IN explícito: nasce
 *  `false` até a pessoa decidir em Ajustes. */
export const lerConsentimentoCorredor = () => lerBooleano(CHAVE_CONSENTIMENTO_CORREDOR)
export const salvarConsentimentoCorredor = (valor: boolean) => salvarBooleano(CHAVE_CONSENTIMENTO_CORREDOR, valor)

/** Contribuir com a sondagem colaborativa (onda 13) — cada leitura do
 *  ecobatímetro some agregada por área, como o SonarChart do Navionics.
 *  Opt-IN explícito, mesma regra do consentimento de corredor. */
export const lerConsentimentoSondagem = () => lerBooleano(CHAVE_CONSENTIMENTO_SONDAGEM)
export const salvarConsentimentoSondagem = (valor: boolean) => salvarBooleano(CHAVE_CONSENTIMENTO_SONDAGEM, valor)

/** "Já vi o aviso de primeira visita de `/navegar`" (onda 80) — controla o
 *  cartão de boas-vindas com o aviso obrigatório ("Commander não é auxílio à
 *  navegação"): aparece UMA vez, nunca a cada sessão. O botão "?" da tela
 *  reabre o mesmo texto a qualquer momento sem tocar nesta chave — só a
 *  MARCA de primeira leitura fica guardada aqui. */
export const lerAvisoNavegarVisto = () => lerBooleano(CHAVE_AVISO_NAVEGAR_VISTO)
export const marcarAvisoNavegarVisto = () => salvarBooleano(CHAVE_AVISO_NAVEGAR_VISTO, true)

/**
 * COTISTAS — vagas, convite por link e suspensão (onda 71).
 * PRD-UPGRADE-3-COTAS §13 ("Cotistas — acesso básico Enterprise") e §16.
 *
 * Módulo puro. Nada consulta banco; quem junta os números é `lib/consultas*`.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A VAGA NÃO MORA NO LINK
 * ---------------------------------------------------------------------------
 * O §13 pede duas coisas que, juntas, decidem a modelagem inteira:
 *
 *   "cada cadastro ocupa 1 vaga (1/10 ... 10/10)"
 *   "ADM pode remover acesso, liberando vaga, e REDEFINIR O LINK SEM
 *    REMOVER USUÁRIOS EXISTENTES"
 *
 * Se a contagem morasse no link, redefinir o link zeraria a contagem e a
 * unidade passaria a aceitar 10 cotistas NOVOS além dos 10 que já tinha. Por
 * isso o total de cotas é da UNIDADE e a ocupação é DERIVADA dos vínculos que
 * existem — não há contador a manter em sincronia, e "remover acesso libera
 * vaga" acontece sozinho.
 *
 * O link, então, é só uma porta: pode ser trocado a qualquer momento sem
 * afetar quem já entrou.
 */

// ---------------------------------------------------------------------------
// §13 — as vagas
// ---------------------------------------------------------------------------

export interface Vagas {
  total: number
  ocupadas: number
  restantes: number
  cabeMais: boolean
  /** "7/10" — o formato que o próprio §13 escreve. Mono na tela. */
  rotulo: string
}

/**
 * O estado das vagas de uma unidade.
 *
 * `ocupadas` pode passar de `total` sem que isso seja um bug: o ADM pode
 * REDUZIR a cota de 10 pra 5 com 8 cotistas já dentro. Nesse caso `restantes`
 * é 0 e ninguém novo entra, mas os 8 continuam com acesso — a mesma regra do
 * §23 do PRD anterior, que o app já aplica no downgrade de plano: recursos
 * ficam bloqueados, nunca apagados. Tirar três pessoas do acesso por causa de
 * uma mudança de número seria o app decidindo por quem fica de fora.
 */
export function vagasDeCotista(total: number, ocupadas: number): Vagas {
  const t = Math.max(0, Math.trunc(total))
  const o = Math.max(0, Math.trunc(ocupadas))
  return {
    total: t,
    ocupadas: o,
    restantes: Math.max(0, t - o),
    cabeMais: o < t,
    rotulo: `${o}/${t}`,
  }
}

/** Passou do teto porque a cota foi reduzida com gente dentro. A tela avisa o
 *  ADM em voz alta, em vez de deixá-lo achar que o link quebrou. */
export function acimaDaCota(v: Vagas): boolean {
  return v.ocupadas > v.total
}

// ---------------------------------------------------------------------------
// §13 — o convite por link
// ---------------------------------------------------------------------------

export type RecusaDeEntrada =
  | "link_desativado"
  | "sem_vaga"
  | "ja_e_cotista"

/**
 * Esta pessoa pode entrar por este link?
 *
 * Devolve `null` quando pode. Quando não, devolve o MOTIVO — e o motivo
 * importa porque as três recusas pedem saídas diferentes na tela: link velho
 * pede link novo, lotação pede falar com o ADM, e quem já é cotista só
 * precisa ser mandado pra unidade dele em vez de ver "erro".
 */
export function podeEntrarComLink(
  linkAtivo: boolean,
  vagas: Vagas,
  jaEhCotista: boolean,
): RecusaDeEntrada | null {
  if (jaEhCotista) return "ja_e_cotista"
  if (!linkAtivo) return "link_desativado"
  if (!vagas.cabeMais) return "sem_vaga"
  return null
}

/**
 * O que a pessoa lê quando o link não funciona.
 *
 * Nenhuma das três frases culpa quem chegou: a pessoa recebeu um link no
 * grupo do barco e não tem como saber do estado da cota. As três mandam pra
 * administradora, que é quem resolve.
 */
export function mensagemDeRecusa(motivo: RecusaDeEntrada): string {
  switch (motivo) {
    case "ja_e_cotista":
      return "Você já tem acesso a esta unidade — pode entrar direto."
    case "link_desativado":
      return "Este link de convite não vale mais. Peça um novo à administradora."
    case "sem_vaga":
      return "As vagas de cotista desta unidade estão todas ocupadas. Fale com a administradora."
  }
}

/** §13: "Cadastro exige nome, e-mail e telefone." Os três, e nada além —
 *  cada campo a mais é uma pessoa a menos terminando o cadastro. */
export function faltaNoCadastro(dados: {
  nome: string | null
  email: string | null
  telefone: string | null
}): string | null {
  if (!dados.nome?.trim()) return "Informe seu nome."
  if (!dados.email?.trim()) return "Informe seu e-mail."
  if (!dados.telefone?.trim()) return "Informe seu telefone."
  return null
}

// ---------------------------------------------------------------------------
// §13 — inadimplência
// ---------------------------------------------------------------------------

/**
 * A frase que o cotista suspenso lê.
 *
 * O §13 é explícito sobre a fronteira: *"Cobrança acontece FORA do
 * Commander."* O app não sabe se a pessoa deve, não cobra, não negocia e não
 * diz quanto. Ele só reflete o estado que o ADM marcou.
 *
 * Por isso a frase não fala em dívida, valor nem prazo — falar disso seria o
 * Commander afirmando um fato financeiro que ele não tem como conhecer, na
 * tela de um cliente da administradora. Ela diz o que é verdade (o acesso foi
 * suspenso, e por quem) e para onde ir.
 */
export const MENSAGEM_SUSPENSO =
  "Seu acesso a esta unidade está suspenso pela administradora. Fale com ela para reativar."

export interface EstadoCotista {
  suspensoEm: string | null
}

export function estaSuspenso(c: EstadoCotista): boolean {
  return c.suspensoEm != null
}

/**
 * §16 — "ADM gera/publica uma vez por unidade; cotistas visualizam/baixam o
 * mesmo relatório. Evitar geração individual repetida pelos viewers."
 *
 * O cotista NUNCA gera relatório oficial: ele lê o que o ADM publicou. Se
 * nada foi publicado, a tela diz isso — em vez de oferecer um botão que
 * geraria dez PDFs iguais quando dez cotistas abrissem a mesma unidade.
 *
 * (O relatório PESSOAL do cotista pagante é outra coisa, e essa ele gera
 * sozinho porque usa dado do uso dele — §16, segunda metade, onda 75.)
 */
export function cotistaPodeGerarRelatorioOficial(): false {
  return false
}

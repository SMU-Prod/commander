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

// ---------------------------------------------------------------------------
// §13 — o resgate do link (onda 84, P1-6 da auditoria de 19/08/2026)
// ---------------------------------------------------------------------------

/**
 * A MATRIZ COM QUE UM COTISTA NASCE — cópia declarada do que o banco escreve.
 *
 * `aceitar_convite_cotista` (migration 077) é `SECURITY DEFINER` e grava esta
 * matriz no vínculo novo. Ela NÃO pode vir do app: `vinculos` não tem policy
 * de INSERT (é a peça que impede alguém de se dar acesso a barco alheio), e
 * aceitar a matriz como parâmetro deixaria qualquer um pedir `editar` em tudo.
 * Ou seja: quem decide é o SQL, e o SQL não importa TypeScript.
 *
 * Por isso a mesma tabela existe em dois lugares — e por isso existe teste
 * comparando esta constante com `PRESET_ENTERPRISE.COTISTA`. Mexer no preset
 * sem mexer na migration quebra `npm test`, de propósito: o alarme é o único
 * jeito de a divergência não passar despercebida até um cotista real entrar
 * numa unidade em que não enxerga nada.
 *
 * Espelha `supabase/migrations/077_convite_cotista_resgate.sql`. Se um dia a
 * migration mudar, mude aqui na mesma leva.
 */
export const MATRIZ_COTISTA_NO_BANCO: Record<string, { ver: boolean; editar: boolean }> = {
  embarcacao: { ver: true, editar: false },
  motores: { ver: true, editar: false },
  eletrica: { ver: false, editar: false },
  casco: { ver: false, editar: false },
  hidraulica: { ver: false, editar: false },
  seguranca: { ver: false, editar: false },
  equipamentos: { ver: false, editar: false },
  documentos: { ver: true, editar: false },
  fotos: { ver: true, editar: false },
  contatos: { ver: false, editar: false },
  gastos: { ver: false, editar: false },
  diario: { ver: false, editar: false },
  historico: { ver: true, editar: false },
  carteira: { ver: false, editar: false },
  agenda: { ver: false, editar: false },
}

/**
 * Os erros que `aceitar_convite_cotista` levanta.
 *
 * São CÓDIGOS, não frases. `aceitar_convite` (migration 008) levanta prosa
 * acentuada e o app casa substring (`error.message.includes("expirado")`) —
 * o que quebra em silêncio no dia em que alguém melhorar o texto do banco.
 * Aqui o banco diz o quê e o app diz como.
 */
export type ErroAoEntrarComoCotista =
  | "nao_autenticado"
  | "convite_invalido"
  | "ja_faz_parte"
  | "sem_vaga_de_cota"

const MENSAGEM_POR_ERRO: Record<ErroAoEntrarComoCotista, string> = {
  nao_autenticado: "Entre na sua conta para usar este convite.",
  convite_invalido: "Este link de convite não vale mais. Peça um novo à administradora.",
  ja_faz_parte: "Você já tem acesso a esta unidade — pode entrar direto.",
  // A frase é a mesma de `sem_vaga` acima porque o caso é o mesmo visto do
  // outro lado: a vaga acabou entre a tela desenhar e a pessoa clicar. Quem lê
  // não precisa saber que houve corrida.
  sem_vaga_de_cota: "As vagas de cotista desta unidade estão todas ocupadas. Fale com a administradora.",
}

/**
 * A frase que a pessoa lê quando a entrada falha.
 *
 * Erro desconhecido NÃO vira "convite inválido": acusar de link velho um
 * convite que pode estar perfeitamente vivo é a classe de mentira que esta
 * tela existe para não cometer. Vira uma frase que admite não saber.
 */
export function mensagemDeErroAoEntrar(bruto: string | null | undefined): string {
  const codigo = (bruto ?? "").trim()
  // `hasOwnProperty` e não `in`: com `in`, um erro chamado "toString" ou
  // "constructor" casaria com o que o objeto herda de `Object` e a tela
  // mostraria uma função no lugar da frase.
  if (Object.prototype.hasOwnProperty.call(MENSAGEM_POR_ERRO, codigo)) {
    return MENSAGEM_POR_ERRO[codigo as ErroAoEntrarComoCotista]
  }
  return "Não foi possível entrar com este convite agora. Tente de novo em instantes."
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

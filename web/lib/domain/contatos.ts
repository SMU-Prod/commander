/**
 * CONTATOS DO BARCO (canvas tela-4b) — a parte de regra da tela: o que é
 * emergência universal, como um telefone brasileiro vira link discável e a
 * linha-resumo de cada contato. Puro e testável; a tela só desenha.
 */

/**
 * Emergência primeiro, sempre no topo — no mar não se procura telefone.
 *
 * Só entra aqui o que é UNIVERSAL e verdadeiro para qualquer barco no
 * Brasil, nunca dado inventado por barco:
 *  · 185 é o número nacional de emergências marítimas (SALVAMAR / Serviço
 *    de Busca e Salvamento da Marinha do Brasil).
 *  · O canal VHF 16 (156,8 MHz) é o canal internacional de socorro e
 *    chamada — não é discável, é leitura pra quem está no rádio.
 * Os contatos DO barco (marina, mecânico, seguradora) são dados reais da
 * tabela `contatos`; quando não existem, a tela diz isso em vez de fingir.
 */
export interface ContatoEmergencia {
  nome: string
  apoio: string
  /** O que se lê no aparelho — número curto ou canal de rádio, em mono. */
  valor: string
  /** Presente só quando o valor é discável (o 185); o VHF não disca. */
  telefone?: string
}

export const CONTATOS_EMERGENCIA: readonly ContatoEmergencia[] = [
  {
    nome: "Salvamar — Marinha do Brasil",
    apoio: "Emergência marítima · 24 h",
    valor: "185",
    telefone: "185",
  },
  {
    nome: "Rádio VHF — socorro e chamada",
    apoio: "Canal internacional de emergência",
    valor: "VHF 16",
  },
]

/**
 * `tel:` discável a partir do que a pessoa digitou no cadastro.
 * Número com DDD (10–11 dígitos) ganha +55 — o link continua funcionando
 * com o celular em roaming fora do Brasil, que é exatamente quando mais se
 * precisa dele. Números curtos de serviço (185, 190…) discam como estão:
 * prefixá-los quebraria a chamada.
 */
export function telefoneHref(telefone: string | null): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "")
  if (!digitos) return null
  if (digitos.length <= 5) return `tel:${digitos}`
  // 0800/0300 e afins discam como estão — DDD nunca começa com 0, e +55 na
  // frente de um 0800 quebra a chamada.
  if (digitos.startsWith("0")) return `tel:${digitos}`
  if (digitos.length === 10 || digitos.length === 11) return `tel:+55${digitos}`
  // Já veio com código de país (ou formato fora do padrão) — não adivinhar.
  return `tel:+${digitos}`
}

/** WhatsApp só pra número de gente (DDD + número). Número curto de serviço
 *  e 0800 não têm WhatsApp — devolver null é o que impede a tela de oferecer
 *  um botão que abriria uma conversa com ninguém. */
export function whatsappHref(telefone: string | null): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "")
  if (digitos.startsWith("0")) return null
  if (digitos.length !== 10 && digitos.length !== 11) return null
  return `https://wa.me/55${digitos}`
}

/**
 * A linha de apoio de cada contato: especialidade e quantos serviços este
 * barco já registrou com ele (o vínculo `contato_id` dos eventos do Diário —
 * contagem real, não estimativa). Telefone/e-mail ficam FORA da linha de
 * propósito: no canvas o telefone é o botão redondo à direita, não texto.
 */
export function resumoDoContato(
  c: { empresa: string | null; especialidade: string | null },
  servicos: number,
): string {
  const partes = [c.empresa, c.especialidade].filter(Boolean) as string[]
  partes.push(servicos === 1 ? "1 serviço neste barco" : `${servicos} serviços neste barco`)
  return partes.join(" · ")
}

import type { EstadoItemProtocolo, EstadoSolicitacaoGold, FaixaPorteGold, GoldPreco, HubProtocoloGold } from "@/lib/db/types"

/**
 * Commander Gold — fluxo completo (onda 35, `docs/prd/upgrade2-correcoes.txt`
 * Correções 02/06/08/09/10/12/15/16/18/19):
 *
 *   SOLICITAR GOLD → PAGAMENTO → AGENDAMENTO → AVALIAÇÃO PRESENCIAL →
 *   PROTOCOLO COMMANDER → ANÁLISE → APROVAÇÃO → COMMANDER GOLD
 *
 * Função pura, no espírito de `semaforo.ts`/`verified.ts` — nunca consulta o
 * banco. A fonte da verdade da máquina de estados é o SQL
 * (`gold_transicao_valida`/`gold_definir_estado`, migration 033); as funções
 * aqui espelham a MESMA regra só pra UI desabilitar botão sem round-trip —
 * nunca o contrário.
 *
 * Nunca a palavra "Review" nesta tela ou em qualquer texto do produto
 * (Correção 01/02/07/20) — a avaliação presencial é uma ETAPA do processo do
 * Gold, não um produto/serviço com nome próprio.
 */

export const PASSOS_GOLD = [
  "Solicitar Commander Gold",
  "Pagamento da avaliação",
  "Agendamento da visita",
  "Avaliação presencial",
  "Protocolo Commander",
  "Análise",
  "Aprovação",
  "Commander Gold ativo",
] as const

export const HUBS_PROTOCOLO_GOLD: readonly HubProtocoloGold[] = [
  "motores", "casco", "eletrica", "hidraulica", "seguranca", "equipamentos", "documentacao", "historico",
]

export const ROTULO_HUB_GOLD: Record<HubProtocoloGold, string> = {
  motores: "Motores",
  casco: "Casco",
  eletrica: "Elétrica",
  hidraulica: "Hidráulica",
  seguranca: "Segurança",
  equipamentos: "Equipamentos",
  documentacao: "Documentação",
  historico: "Histórico",
}

export const ROTULO_ESTADO_ITEM: Record<EstadoItemProtocolo, string> = {
  avaliado: "Avaliado",
  atencao: "Atenção",
  na: "Não aplicável",
}

export const ROTULO_FAIXA_PORTE: Record<FaixaPorteGold, string> = {
  ate_30: "Até 30 pés",
  "31_40": "31–40 pés",
  "41_50": "41–50 pés",
  "51_60": "51–60 pés",
  "61_80": "61–80 pés",
  "81_mais": "81+ pés",
}

/** Texto oficial do modal do Gold (Correção 12 do PRD de Correções) — não
 *  reescrever livremente, é o texto que o dono travou. */
export const TEXTO_MODAL_GOLD =
  "Esta embarcação passou por avaliação presencial realizada por um consultor náutico autorizado, " +
  "seguindo o Protocolo Commander."

export const ROTULO_ESTADO_SOLICITACAO: Record<EstadoSolicitacaoGold, string> = {
  solicitado: "Solicitado",
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  aguardando_agendamento: "Aguardando agendamento",
  agendado: "Agendado",
  avaliacao_realizada: "Avaliação realizada",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
}

/** Mensagem curta pro dono acompanhar o processo — sempre honesta sobre o
 *  que falta, nunca promete prazo (regra de honestidade da casa). */
export const DESCRICAO_ESTADO_SOLICITACAO: Record<EstadoSolicitacaoGold, string> = {
  solicitado: "Seu pedido foi registrado. A equipe Commander prepara o pagamento da avaliação.",
  aguardando_pagamento: "Falta concluir o pagamento da avaliação para seguir para o agendamento.",
  pago: "Pagamento confirmado. A equipe Commander vai agendar a avaliação presencial.",
  aguardando_agendamento: "Pagamento confirmado. Aguardando a equipe Commander agendar a avaliação.",
  agendado: "Avaliação presencial agendada — confira a data, o horário e o consultor abaixo.",
  avaliacao_realizada: "A avaliação presencial já aconteceu. O resultado está em análise.",
  em_analise: "A equipe Commander está analisando o resultado da avaliação.",
  aprovado: "Avaliação aprovada — Commander Gold ativo.",
  reprovado: "A embarcação não atingiu os critérios do Commander Gold nesta avaliação.",
  cancelado: "Este pedido foi cancelado.",
}

/** Espelho de `gold_transicao_valida` (migration 033) — só pra UI. */
const TRANSICOES_VALIDAS: Record<EstadoSolicitacaoGold, readonly EstadoSolicitacaoGold[]> = {
  solicitado: ["aguardando_pagamento", "cancelado"],
  aguardando_pagamento: ["pago", "cancelado"],
  pago: ["aguardando_agendamento", "cancelado"],
  aguardando_agendamento: ["agendado", "cancelado"],
  agendado: ["avaliacao_realizada", "cancelado"],
  avaliacao_realizada: ["em_analise"],
  em_analise: ["aprovado", "reprovado"],
  aprovado: [],
  reprovado: [],
  cancelado: [],
}

export function transicaoValidaGold(atual: EstadoSolicitacaoGold, novo: EstadoSolicitacaoGold): boolean {
  return TRANSICOES_VALIDAS[atual].includes(novo)
}

/** Cancelamento é permitido a qualquer momento antes do resultado final —
 *  espelha o `case p_novo_estado = 'cancelado'` de `gold_transicao_valida`
 *  (que aceita de QUALQUER estado não-terminal, não só do "de onde saiu"). */
export function podeCancelarGold(estado: EstadoSolicitacaoGold): boolean {
  return !["aprovado", "reprovado", "cancelado"].includes(estado)
}

export function estadoFinal(estado: EstadoSolicitacaoGold): boolean {
  return TRANSICOES_VALIDAS[estado].length === 0
}

/** 1 metro = 3.28084 pés — sugestão de faixa a partir do comprimento já
 *  cadastrado na embarcação. Sempre uma SUGESTÃO: quem solicita pode
 *  corrigir (embarcação "outra" não tem comprimento cadastrado no Commander
 *  nenhuma vez, então a faixa entra sempre manual nesse caso). */
export function sugerirFaixaPorte(comprimentoM: number | null | undefined): FaixaPorteGold | null {
  if (comprimentoM == null || comprimentoM <= 0) return null
  const pes = comprimentoM * 3.28084
  if (pes <= 30) return "ate_30"
  if (pes <= 40) return "31_40"
  if (pes <= 50) return "41_50"
  if (pes <= 60) return "51_60"
  if (pes <= 80) return "61_80"
  return "81_mais"
}

export function precoDaFaixa(precos: GoldPreco[], faixa: FaixaPorteGold): GoldPreco | null {
  return precos.find((p) => p.faixa === faixa) ?? null
}

/** `null` = "sob consulta" (faixa 81+ ou preço zerado pelo admin) — nunca
 *  formata como R$ 0,00, que pareceria grátis. */
export function formatarPrecoGold(centavos: number | null): string {
  if (centavos == null) return "Sob consulta"
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ")
}

export type StatusSeloGold = "ativo" | "vencendo" | "expirado"

/** Estado do selo é sempre CALCULADO a partir de `validade_ate`, nunca
 *  armazenado (mesma filosofia do farol de documentos, `semaforo.ts`) —
 *  "vencendo" nos últimos 30 dias antes de expirar. */
export function statusSeloGold(validadeAte: string, hoje: string): StatusSeloGold {
  if (hoje > validadeAte) return "expirado"
  const dataAte = new Date(`${validadeAte}T00:00:00`)
  const dataHoje = new Date(`${hoje}T00:00:00`)
  const diasRestantes = Math.round((dataAte.getTime() - dataHoje.getTime()) / 86_400_000)
  return diasRestantes <= 30 ? "vencendo" : "ativo"
}

export const ROTULO_STATUS_SELO: Record<StatusSeloGold, string> = {
  ativo: "Ativo",
  vencendo: "Vencendo",
  expirado: "Expirado",
}

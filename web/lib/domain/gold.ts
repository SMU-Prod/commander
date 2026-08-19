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

/**
 * Um pé são 0,3048 m, por definição — não 1/3,28084, que é a mesma conta
 * arredondada e erra pra cima. A diferença não é acadêmica: uma embarcação de
 * 9,144 m (exatamente 30 pés) dava 30,00000096 pés com o fator arredondado e
 * caía na faixa "31–40", R$ 500 mais cara. Um erro de ponto flutuante não
 * pode cobrar meio milhar a mais de ninguém.
 */
export const METROS_POR_PE = 0.3048

/**
 * Comprimento em metros -> PÉS INTEIROS.
 *
 * ARREDONDAMENTO ESCOLHIDO: para o pé inteiro mais próximo (0,5 pé sobe).
 * A tabela do §16 é escrita em pés inteiros e com um degrau entre as faixas
 * ("Até 30 pés", depois "31–40 pés") — quem a escreveu pensa em barco de
 * "32 pés", não em 32,4. Os outros dois caminhos foram descartados:
 *  · truncar (`Math.floor`) faria um barco de 30,9 pés pagar como 30, e a
 *    faixa "até 30" passaria a valer até quase 31;
 *  · arredondar sempre pra cima (`Math.ceil`) faria 30,04 pés — 1 cm a mais
 *    na ficha — custar R$ 500, que é exatamente o problema que a constante
 *    acima resolve.
 * Meio pé pra cima muda de faixa, e é o único caso em que a régua favorece o
 * valor maior; está declarado aqui e visível na tela, não escondido na conta.
 *
 * Vale lembrar o que esta função É: uma SUGESTÃO. Quem solicita confirma ou
 * corrige a faixa no formulário, e a medida que vale de verdade é a do
 * consultor na avaliação presencial.
 */
export function pesDeMetros(comprimentoM: number): number {
  return Math.round(comprimentoM / METROS_POR_PE)
}

/** Faixa a partir de pés inteiros. Espelha os `limite_pes` semeados em
 *  `gold_precos` (migration 033): o PREÇO de cada faixa é configurável pelo
 *  Admin (§20), as faixas em si são o enum do banco. */
export function faixaPorteDePes(pes: number): FaixaPorteGold {
  if (pes <= 30) return "ate_30"
  if (pes <= 40) return "31_40"
  if (pes <= 50) return "41_50"
  if (pes <= 60) return "51_60"
  if (pes <= 80) return "61_80"
  return "81_mais"
}

/** Sugestão de faixa a partir do comprimento já cadastrado na embarcação.
 *  `null` quando não há comprimento — embarcação "outra" (§16: pode ser
 *  solicitada para barco ainda não cadastrado) nunca tem, então ali a faixa
 *  entra sempre à mão. */
export function sugerirFaixaPorte(comprimentoM: number | null | undefined): FaixaPorteGold | null {
  if (comprimentoM == null || !Number.isFinite(comprimentoM) || comprimentoM <= 0) return null
  return faixaPorteDePes(pesDeMetros(comprimentoM))
}

export function precoDaFaixa(precos: GoldPreco[], faixa: FaixaPorteGold): GoldPreco | null {
  return precos.find((p) => p.faixa === faixa) ?? null
}

/**
 * §16, última linha da tabela: "81+ pés — Sob consulta".
 *
 * `valor_centavos = null` não é preço faltando nem preço zero: é um ESTADO do
 * produto. Barco grande tem avaliação sob medida, e o valor sai de uma
 * conversa. Por isso a tela não pode oferecer "pagar" nesse caso — e a action
 * de pagamento recusa gerar cobrança (`iniciarPagamentoGold`). Um R$ 0,00
 * exibido ali, ou um botão que abre uma cobrança vazia, seria pior que a
 * ausência do preço.
 *
 * Vale também quando o Admin apaga o valor de qualquer faixa em
 * /admin/gold/precos: apagar é justamente a forma de dizer "essa faixa passou
 * a ser sob consulta" (§20 — preço é dado configurável, não constante).
 */
export function precoSobConsulta(preco: GoldPreco | null | undefined): boolean {
  return preco?.valor_centavos == null
}

/** O que a tela diz quando a faixa está sob consulta — honesto sobre o que
 *  acontece a seguir, sem prometer prazo.
 *
 *  Achado 3.7 da auditoria de 19/08: a versão anterior dizia "A equipe
 *  Commander entra em contato para combinar", e nada avisa a equipe. A fila
 *  (`gold_solicitacoes` → `/admin/gold`) existe e é visível, o que faz disto
 *  gravidade 3 e não 1 — a diferença entre "não vai acontecer" e "pode
 *  demorar". A frase passa a nomear a fila em vez do contato. */
export const TEXTO_SOB_CONSULTA =
  "O valor desta faixa é definido caso a caso: o pedido entra na fila que a equipe Commander " +
  "acompanha, e o valor é combinado antes de qualquer cobrança — nada é cobrado automaticamente."

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

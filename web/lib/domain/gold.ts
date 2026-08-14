/** Marcador do pedido de Commander Gold, gravado como evento no diario (nao
 *  existe tabela dedicada nesta onda — construir workflow completo de
 *  pagamento/agendamento/aprovacao fica para quando a operacao presencial
 *  existir, ver PRD de Correcoes). Vive aqui, no dominio do Gold, porque DOIS
 *  lados precisam dele: a action que grava (`lib/acoes/gold.ts`) e a
 *  contagem do checklist do Verified (`lib/consultas.ts`), que tem de
 *  EXCLUIR esses eventos — senao pedir o Gold aumentaria o percentual do
 *  criterio "eventos no diario" do Verified, que e justamente o que o
 *  pedido deveria ser consequencia, nao causa. Confirma a Correcao 14 do PRD
 *  de Correcoes: Gold nao depende de Verified, entao essa exclusao so evita
 *  o pedido inflar o proprio Verified — nunca o contrario.
 *
 *  Nome do marcador: "Commander Gold", nunca "Review" (Correcao 01/02/07 do
 *  PRD de Correcoes) — a avaliacao presencial e uma ETAPA do processo do
 *  Gold, nao um produto/servico com nome proprio. */
export const MARCADOR_SOLICITACAO_GOLD = "Commander Gold — avaliação presencial solicitada"

/**
 * Passos do fluxo do Commander Gold (Correção 02 do PRD de Correções) — só
 * texto para a vitrine (`/barco/selos/gold`), nenhum passo depois do
 * primeiro está implementado ainda. Pagamento, agendamento, avaliação
 * presencial, Protocolo Commander e aprovação dependem de decisão comercial
 * do dono (preços e operação de campo) e de uma onda futura dedicada — esta
 * tela só explica o fluxo e recebe a manifestação de interesse.
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

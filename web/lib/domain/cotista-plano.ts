/**
 * PLANO INDIVIDUAL DO COTISTA (onda 75).
 * PRD-UPGRADE-3-COTAS §14 e §15.
 *
 * R$ 24,90/mês, produto PESSOAL do cotista. O §14 abre dizendo o que ele NÃO
 * é: *"Não substitui o acesso básico fornecido pela empresa."* O cotista já
 * enxerga a unidade dele de graça, pela licença Enterprise da administradora
 * (§13) — este plano é o registro do uso DELE.
 *
 * Módulo puro.
 */

import { COTISTA_INDIVIDUAL_CENTAVOS, formatarPreco } from "./planos"

// ---------------------------------------------------------------------------
// §14 — o que o plano entrega
// ---------------------------------------------------------------------------

export const RECURSOS_COTISTA_PAGO = [
  { chave: "meu_uso", nome: "Meu Uso", descricao: "Registro pessoal de retirada e entrega." },
  { chave: "fotos_painel", nome: "Fotos e painel", descricao: "Condição recebida e entregue, horas e combustível." },
  { chave: "historico", nome: "Histórico com procedência", descricao: "Cada registro com seu autor, data e utilização." },
  { chave: "diario", nome: "Diário de Bordo pessoal", descricao: "Suas saídas e seu histórico próprio." },
  { chave: "relatorios", nome: "Relatórios pessoais", descricao: "Por utilização e resumo mensal." },
  { chave: "envio_adm", nome: "Envio ao ADM", descricao: "Comunicação estruturada direta com a administradora." },
  { chave: "mapa", nome: "Mapa e Explorar", descricao: "Os recursos náuticos do Commander." },
  { chave: "meteorologia", nome: "Meteorologia", descricao: "Informação auxiliar para planejar o uso." },
  { chave: "seguranca", nome: "Central de Segurança", descricao: "Pane, abastecimento, regras e boas práticas." },
] as const

export type RecursoCotista = (typeof RECURSOS_COTISTA_PAGO)[number]["chave"]

/** O preço, em texto, saindo do catálogo — nenhuma tela escreve o número. */
export function precoCotistaEmTexto(): string {
  return `${formatarPreco(COTISTA_INDIVIDUAL_CENTAVOS)}/mês`
}

// ---------------------------------------------------------------------------
// §14 — a copy, com duas proibições explícitas
// ---------------------------------------------------------------------------

/**
 * A headline do §14, palavra por palavra:
 * "Você divide o Jet. Não precisa dividir a dúvida sobre quem fez o quê."
 */
export const HEADLINE_COTISTA =
  "Você divide o Jet. Não precisa dividir a dúvida sobre quem fez o quê."

export const MENSAGEM_COTISTA =
  "Registre como recebeu e como entregou a embarcação. Fotos, horas, combustível, ocorrências e " +
  "Diário de Bordo ficam organizados no seu histórico. Envie informações diretamente à " +
  "administradora sem depender do lançamento posterior da equipe do pátio."

/**
 * §14, as duas travas de copy, escritas como proibição no próprio PRD:
 *
 *   "NÃO USAR linguagem de 'prova jurídica' ou garantia contra cobrança."
 *   "Deixar EXPLÍCITO que o acesso básico fornecido pela administradora
 *    continua disponível sem assinatura."
 *
 * A primeira é risco real: o cotista que ler "prova" vai assinar achando que
 * comprou defesa contra uma cobrança da administradora, e o Commander não
 * garante isso — as fotos dele são registro pessoal, não perícia. A segunda
 * evita vender o que a pessoa já tem de graça.
 *
 * `RESSALVA_ACESSO_BASICO` existe pra que a tela não possa esquecer: ela é
 * parte do bloco de venda, não um rodapé opcional.
 */
export const RESSALVA_ACESSO_BASICO =
  "O acesso que a administradora te dá para ver esta unidade continua funcionando sem assinar nada. " +
  "Este plano é o seu registro pessoal de uso."

/** Palavras que a copy deste plano não pode conter (§14). Usada em teste — é
 *  a única forma de a proibição sobreviver a uma reescrita futura. */
export const PALAVRAS_PROIBIDAS_COTISTA = [
  "prova jurídica", "prova juridica", "valor probatório", "valor probatorio",
  "garantia", "garante", "juridicamente", "defesa", "processo",
] as const

// ---------------------------------------------------------------------------
// §15 — Atualizações dos Cotistas
// ---------------------------------------------------------------------------

/** O que o ADM pode fazer com o que o cotista enviou (§15). */
export const ACOES_SOBRE_ENVIO = [
  "adicionar_a_unidade", "atualizar_horas", "criar_avaria",
  "adicionar_observacao", "incorporar_ao_historico", "arquivar",
] as const

export type AcaoSobreEnvio = (typeof ACOES_SOBRE_ENVIO)[number]

export const ROTULO_ACAO_ENVIO: Record<AcaoSobreEnvio, string> = {
  adicionar_a_unidade: "Adicionar à unidade",
  atualizar_horas: "Atualizar horas",
  criar_avaria: "Criar avaria",
  adicionar_observacao: "Adicionar observação",
  incorporar_ao_historico: "Incorporar ao histórico",
  arquivar: "Arquivar",
}

export type EstadoEnvio = "aguardando" | "incorporado" | "arquivado"

export const ROTULO_ESTADO_ENVIO: Record<EstadoEnvio, string> = {
  aguardando: "Aguardando análise",
  incorporado: "Incorporado",
  arquivado: "Arquivado",
}

/**
 * §15, a regra que sustenta o hub inteiro: *"NADA enviado pelo cotista altera
 * automaticamente o registro oficial."*
 *
 * O envio é sempre um pedido, nunca um fato do barco. Sem isso, dez cotistas
 * com opiniões diferentes sobre o horímetro escreveriam por cima uns dos
 * outros na ficha da unidade — e a administradora perderia a única versão que
 * ela responde por.
 */
export function envioAlteraRegistroOficial(): false {
  return false
}

/**
 * §15: *"Manter procedência: informado por cotista X; incorporado por ADM Y."*
 *
 * A frase é montada num lugar só porque ela é o produto do hub: o valor não
 * está no dado enviado, está em saber de quem veio e quem decidiu aceitar.
 */
export function linhaDeProcedencia(
  cotista: string,
  estado: EstadoEnvio,
  adm: string | null,
): string {
  const origem = `Informado por ${cotista}`
  if (estado === "aguardando") return `${origem} · aguardando análise`
  const quem = adm?.trim() || "a administradora"
  return estado === "incorporado"
    ? `${origem} · incorporado por ${quem}`
    : `${origem} · arquivado por ${quem}`
}

/**
 * O que o cotista pagante pode gerar sozinho (§16, segunda metade).
 *
 * O relatório OFICIAL da unidade continua sendo do ADM — gerado uma vez e
 * lido por todos (ver `cotistaPodeGerarRelatorioOficial` em cotistas.ts). O
 * pessoal é outra coisa: usa só o uso DELE, então dez cotistas gerando dez
 * relatórios pessoais é o esperado, não desperdício.
 */
export function cotistaPodeGerarRelatorioPessoal(assinantePago: boolean): boolean {
  return assinantePago
}

import type { Aba } from "@/lib/domain/permissoes"
import type { StatusFarol } from "@/lib/domain/semaforo"

/**
 * Ocorrências (onda 32) — "Diário gera histórico. Ocorrência gera ação."
 * Entidade com estado, sempre nascida ligada a um setor (hub) da embarcação.
 * Ver docs/prd/upgrade2-master.txt §22 e docs/auditoria/2026-08-14-prd-upgrade2-parte1.md §22.
 */
export const ESTADOS_OCORRENCIA = ["aberta", "em_acompanhamento", "resolvida"] as const
export type EstadoOcorrencia = (typeof ESTADOS_OCORRENCIA)[number]

export const ROTULO_ESTADO: Record<EstadoOcorrencia, string> = {
  aberta: "Aberta",
  em_acompanhamento: "Em acompanhamento",
  resolvida: "Resolvida",
}

export const GRAVIDADES = ["baixa", "media", "alta"] as const
export type Gravidade = (typeof GRAVIDADES)[number]

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { baixa: "Baixa", media: "Média", alta: "Alta" }

/** Setores onde uma ocorrência pode nascer — os hubs de verdade da
 *  embarcação. Deriva de `Aba` (mesma régua de permissão do resto do app),
 *  mas exclui as áreas que não são "lugar no barco" (diário é a origem, não
 *  o destino; histórico é uma visão, não um setor; fotos/contatos/gastos
 *  não têm componente físico pra ter uma avaria). Espelha exatamente o
 *  check constraint `ocorrencias_aba_check` no banco (migration 032) — sem
 *  isso, o formulário aceitaria um setor que o banco rejeitaria. */
export const ABAS_OCORRENCIA = [
  "embarcacao", "motores", "eletrica", "casco", "hidraulica", "seguranca", "equipamentos", "documentos",
] as const satisfies readonly Aba[]
export type AbaOcorrencia = (typeof ABAS_OCORRENCIA)[number]

/** O que uma ocorrência pode virar a partir do estado atual (nunca o
 *  próprio estado — não é transição ficar onde já está). Regra: "resolvida"
 *  só reabre para "em acompanhamento" (nunca direto pra "aberta" de novo —
 *  isso apagaria o fato de que alguém já retomou o caso). Único domínio
 *  puro testado por TDD que decide "o que pode virar o quê" (CLAUDE.md,
 *  seção 1). */
export const TRANSICOES: Record<EstadoOcorrencia, readonly EstadoOcorrencia[]> = {
  aberta: ["em_acompanhamento", "resolvida"],
  em_acompanhamento: ["aberta", "resolvida"],
  resolvida: ["em_acompanhamento"],
}

export function transicoesPossiveis(atual: EstadoOcorrencia): readonly EstadoOcorrencia[] {
  return TRANSICOES[atual]
}

export function podeTransicionar(atual: EstadoOcorrencia, novo: EstadoOcorrencia): boolean {
  return TRANSICOES[atual].includes(novo)
}

/** Farol reaproveitado (mesma linguagem visual do resto do app, onda 7):
 *  aberta = vermelho (ninguém cuidou ainda — "!" reservado a crítico, PRD
 *  §16), em_acompanhamento = amarelo (alguém já está de olho), resolvida =
 *  verde. */
export function faroDoEstado(estado: EstadoOcorrencia): StatusFarol {
  if (estado === "resolvida") return "ok"
  if (estado === "em_acompanhamento") return "atencao"
  return "vencido"
}

/** `resolvida_em` anda junto do estado: grava a hora exata ao resolver,
 *  limpa ao sair de "resolvida" (reabertura) — nunca fica um carimbo velho
 *  mentindo que ainda está resolvida. PRD: "quando resolvida, o evento
 *  permanece no histórico" — isso é sobre a LINHA (nunca apagada), não
 *  sobre este campo. */
export function proximaResolvidaEm(novoEstado: EstadoOcorrencia, agoraISO: string): string | null {
  return novoEstado === "resolvida" ? agoraISO : null
}

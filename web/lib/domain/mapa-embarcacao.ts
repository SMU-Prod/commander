import type { Equipamento } from "@/lib/db/types"
import type { Gravidade } from "@/lib/domain/ocorrencias"
import { GRAVIDADE_CRITICA } from "@/lib/domain/saude"
import { PESO, type StatusFarol } from "@/lib/domain/semaforo"

/**
 * MAPA DA EMBARCAÇÃO (onda 61) — o dado da zona física.
 * Spec `docs/superpowers/specs/2026-08-16-mapa-embarcacao-design.md` §2.
 *
 * A pergunta que este módulo responde é "ONDE no barco?" — ortogonal ao
 * "o que é" (`equipamentos.tipo`) e ao "como está" (farol da Saúde). No
 * banco é o enum `zona_embarcacao` e a coluna nullable `equipamentos.zona`
 * (migration 055); aqui é a fonte única de vocabulário: a lista, a ordem
 * e os rótulos. Nenhuma tela escreve esses nomes à mão.
 *
 * Regra pura, como a casa manda: nada aqui consulta banco, sessão ou
 * relógio.
 */

/** As sete zonas do spec §2.1 — fixas até doer (zonas customizadas por
 *  barco ficaram explicitamente fora do V1). Espelha o enum
 *  `zona_embarcacao` do banco, valor por valor. */
export type ZonaEmbarcacao =
  | "proa"
  | "conves"
  | "casaria"
  | "flybridge"
  | "praca_de_maquinas"
  | "popa"
  | "casco"

/** Ordem de exibição: espacial, da proa pra popa — a mesma leitura do
 *  corte lateral (§3.1, "PROA ← → POPA") — com o casco por último porque
 *  ele fica embaixo do barco inteiro, não entre uma zona e outra. */
export const ZONAS = [
  "proa",
  "conves",
  "casaria",
  "flybridge",
  "praca_de_maquinas",
  "popa",
  "casco",
] as const satisfies readonly ZonaEmbarcacao[]

/** Rótulos do spec §2.1, palavra por palavra — vocabulário de quem vive
 *  o barco, não de formulário de estaleiro. */
export const ROTULO_ZONA: Record<ZonaEmbarcacao, string> = {
  proa: "Proa",
  conves: "Convés",
  casaria: "Casaria",
  flybridge: "Flybridge",
  praca_de_maquinas: "Praça de máquinas",
  popa: "Popa",
  casco: "Casco",
}

/**
 * Palpite de zona a partir do tipo do equipamento — motores, geradores e
 * baterias moram na praça de máquinas em qualquer motor yacht; painel
 * elétrico interno mora na casaria (§2.1, coluna "o que mora lá").
 *
 * É SUGESTÃO de pré-seleção pro select do formulário, nada mais: só vira
 * dado quando o dono salva o formulário. Ninguém varre o banco aplicando
 * isto — "não se inventa dado" (§2.1), e é por isso que `outro` devolve
 * `null`: sem convicção, o select fica em "ainda não sei".
 */
export function sugestaoDeZona(tipo: Equipamento["tipo"]): ZonaEmbarcacao | null {
  switch (tipo) {
    case "motor":
    case "gerador":
    case "bateria":
      return "praca_de_maquinas"
    case "painel":
      return "casaria"
    default:
      return null
  }
}

// ---------------------------------------------------------------------
// estadoDaZona — o cérebro do mapa (spec §2.2)
// ---------------------------------------------------------------------

/**
 * O que a zona precisa saber de cada item monitorado: o farol JÁ calculado
 * por `calcularSemaforo` (`lib/domain/semaforo.ts`) — esta função agrega,
 * não recalcula ("REUSE a régua existente", não segunda fórmula). Quem
 * monta esta lista roda `calcularSemaforo` por item (com `horas_atuais` do
 * equipamento dono e a data de hoje) exatamente como `saude.ts`/`/barco/saude`
 * já fazem hoje — este módulo não precisa saber de horímetro nem de relógio.
 *
 * `temInformacao` é o mesmo contrato de `temInformacaoSuficiente`
 * (`semaforo.ts`) e `ItemParaSaude.temInformacao` (`saude.ts`): item sem
 * intervalo, sem data e sem horas não conta nem a favor nem contra — é a
 * regra de honestidade que atravessa Semáforo, Saúde e agora o Mapa.
 */
export interface ItemParaZona {
  status: StatusFarol
  temInformacao: boolean
}

/**
 * O que a zona precisa saber de cada ocorrência do setor: só a gravidade —
 * o ESTADO (aberta/em_acompanhamento) já decidiu, antes de chegar aqui, que
 * a ocorrência pesa (mesma régua de `pesaNaSaude`/`ESTADOS_QUE_PESAM_NA_SAUDE`
 * em `ocorrencias.ts`: resolvida e anulada não chegam a esta lista).
 */
export interface OcorrenciaParaZona {
  gravidade: Gravidade | null
}

/**
 * A zona pinta o PIOR estado do que mora nela — mesma régua de "pior vence"
 * que a Saúde usa (spec §2.2), sem inventar segunda fórmula:
 *
 *   - item: o farol que `calcularSemaforo` já decidiu, filtrado por
 *     `temInformacao` (item sem dado real não vota);
 *   - ocorrência: pesa pela GRAVIDADE, não pelo estado — `alta` (a mesma
 *     `GRAVIDADE_CRITICA` que `saude.ts` usa pra decidir "crítico") pinta
 *     `"vencido"`; `media`/`baixa`/ausente pintam só `"atencao"` — uma
 *     ocorrência leve não deveria sozinha deixar a zona inteira vermelha, e
 *     gravidade ausente nunca inventa "alta" (mesma honestidade de
 *     `SEVERIDADE_GRAVIDADE_AUSENTE`).
 *
 * `null` é o pino CINZA: zona com equipamento mapeado, mas sem nenhum dado
 * por trás — nem item com informação suficiente, nem ocorrência. Nunca verde
 * por omissão: um equipamento cadastrado sem NENHUM acompanhamento não é um
 * equipamento "em dia", é um equipamento desconhecido (mesma regra de
 * honestidade de `SaudeEmbarcacao.estado === null`). Zona sem equipamento
 * nenhum também devolve `null` — não existe zona pra pintar; decidir se
 * DESENHA um pino ali é da tela (T3), não deste domínio.
 *
 * Assinatura pensada pro consumidor real (T4, `/barco/mapa`): a tela tem à
 * mão os equipamentos da embarcação, os itens monitorados por equipamento e
 * as ocorrências com setor — filtra cada um pela zona/setor corrente e chama
 * esta função uma vez por zona. `equipamentosDaZona` não entra na conta do
 * "pior vence" (isso já sai de `itensPorEquipamento`/`ocorrenciasDoSetor`
 * vazios); ele só torna explícito, com teste próprio, que zona sem
 * equipamento é `null` — em vez de deixar isso como efeito colateral
 * acidental de duas listas vazias.
 */
export function estadoDaZona(
  equipamentosDaZona: readonly { id: string }[],
  itensPorEquipamento: readonly ItemParaZona[],
  ocorrenciasDoSetor: readonly OcorrenciaParaZona[],
): StatusFarol | null {
  if (equipamentosDaZona.length === 0) return null

  const statusItens = itensPorEquipamento.filter((i) => i.temInformacao).map((i): StatusFarol => i.status)
  const statusOcorrencias = ocorrenciasDoSetor.map((o): StatusFarol => (o.gravidade === GRAVIDADE_CRITICA ? "vencido" : "atencao"))

  const candidatos = [...statusItens, ...statusOcorrencias]
  if (candidatos.length === 0) return null

  return candidatos.sort((a, b) => PESO[b] - PESO[a])[0]
}

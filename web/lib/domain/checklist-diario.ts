import type { Aba } from "@/lib/domain/permissoes"

/**
 * Checklist rápido do Diário por hub (onda 40, PRD §23) — "Motores — ✓ OK /
 * observação" por Motores/Casco/Elétrica/Hidráulica/Segurança ao finalizar
 * uma saída, com atalho "OK GERAL" pra não obrigar a tocar em cada um.
 *
 * Progressivo por desenho: um hub não tocado simplesmente não entra no
 * resultado (silêncio não vira "OK" inventado — mesma regra de honestidade
 * do resto do app, `temInformacaoSuficiente` em semaforo.ts). Só existem
 * dois jeitos de um hub aparecer aqui: "OK GERAL" (marca os 5 de uma vez) ou
 * tocar o hub individualmente.
 */
export const HUBS_CHECKLIST_DIARIO = ["motores", "casco", "eletrica", "hidraulica", "seguranca"] as const
export type HubChecklistDiario = (typeof HUBS_CHECKLIST_DIARIO)[number]

export const ROTULO_HUB_CHECKLIST: Record<HubChecklistDiario, string> = {
  motores: "Motores",
  casco: "Casco",
  eletrica: "Elétrica",
  hidraulica: "Hidráulica",
  seguranca: "Segurança",
}

export type EstadoChecklistHub = "ok" | "observacao"

export interface ItemChecklistDiario {
  hub: HubChecklistDiario
  estado: EstadoChecklistHub
  /** só existe quando `estado === "observacao"` */
  nota: string | null
}

/** Ocorrência nasce com um título curto derivado da nota — o checklist tem
 *  um campo só por hub (nota), não título+descrição separados: dois campos
 *  por hub x 5 hubs é exatamente o formulário de 9 campos que esta onda
 *  existe pra evitar. Corta em ~60 chars numa fronteira de palavra quando dá,
 *  sempre com reticências quando corta de verdade. */
export function tituloDaObservacaoChecklist(nota: string): string {
  const limpa = nota.trim()
  if (limpa.length <= 60) return limpa
  const corte = limpa.slice(0, 60)
  const ultimoEspaco = corte.lastIndexOf(" ")
  const base = ultimoEspaco > 30 ? corte.slice(0, ultimoEspaco) : corte
  return `${base}…`
}

/** Lê os campos `checklist_<hub>_estado`/`checklist_<hub>_nota` de um
 *  FormData (nomes fixos, um por hub — nunca um array indexado, mais simples
 *  de ler e de testar). `campo` é o mesmo helper `texto()` que
 *  `lib/acoes/eventos.ts` já usa pros outros campos do formulário (lê,
 *  aparra e devolve `null` quando vazio). Hub sem `estado` reconhecido
 *  (ninguém tocou) não entra no resultado. */
export function lerChecklistDoFormulario(campo: (nome: string) => string | null): ItemChecklistDiario[] {
  const itens: ItemChecklistDiario[] = []
  for (const hub of HUBS_CHECKLIST_DIARIO) {
    const estado = campo(`checklist_${hub}_estado`)
    if (estado !== "ok" && estado !== "observacao") continue
    const nota = estado === "observacao" ? campo(`checklist_${hub}_nota`) : null
    itens.push({ hub, estado, nota })
  }
  return itens
}

/** Quais itens do checklist devem virar ocorrência — só observação com nota
 *  de verdade E a caixinha "isso é um problema" marcada (`ehOcorrencia`).
 *  Uma observação registrada sem marcar essa caixa fica só no checklist da
 *  saída (histórico do hub), sem abrir uma ocorrência acionável. */
export function itensQueViramOcorrencia(
  itens: readonly ItemChecklistDiario[],
  ehOcorrencia: (hub: HubChecklistDiario) => boolean,
): { hub: HubChecklistDiario; titulo: string; descricao: string }[] {
  return itens
    .filter((i): i is ItemChecklistDiario & { nota: string } =>
      i.estado === "observacao" && Boolean(i.nota?.trim()) && ehOcorrencia(i.hub))
    .map((i) => ({ hub: i.hub, titulo: tituloDaObservacaoChecklist(i.nota), descricao: i.nota.trim() }))
}

/** `HubChecklistDiario` é sempre um `Aba` válido (mesmo conjunto de nomes de
 *  `ABAS_OCORRENCIA`) — cast explícito num lugar só, documentado, em vez de
 *  espalhar `as Aba` pelo código que consome isto. */
export function abaDoHubChecklist(hub: HubChecklistDiario): Aba {
  return hub
}

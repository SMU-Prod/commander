import { ROTULO_ESTADO, ROTULO_GRAVIDADE, type EstadoOcorrencia, type Gravidade } from "@/lib/domain/ocorrencias"
import type { Aba } from "@/lib/domain/permissoes"
import type { StatusFarol } from "@/lib/domain/semaforo"

/**
 * SAÚDE DA EMBARCAÇÃO — fórmula oficial.
 *
 * Histórico: o PRD Master do Upgrade 2 (§10, `docs/prd/upgrade2-master.txt`) dizia
 * textualmente que a fórmula NÃO estava fechada e que "o programador não deve
 * inventar pesos ou algoritmo". A onda 16 inventou mesmo assim (faixas ≥90/≥70/≥40,
 * % = itens em dia com informação / itens com informação) e foi pro ar — achado
 * registrado em `docs/auditoria/2026-08-14-prd-upgrade2-parte1.md` (seção 10).
 * Em 14/08/2026 o DONO do produto delegou a decisão pra engenharia fechar com
 * rigor. Esta função e os pesos abaixo são essa decisão — não é mais provisório.
 *
 * TODOS os pesos da saúde vivem NESTE arquivo e em nenhum outro. Trocar um
 * número é trocar uma linha aqui; qualquer mudança de peso é decisão de
 * produto de novo (não é refactor livre — ver `docs/CONTRIBUTING.md`).
 *
 * MODELO: dedução. A nota começa em 100 e cada problema tira pontos:
 *   pontos = PESO_CATEGORIA[aba do problema] × severidade do problema × PONTOS_POR_PESO_EFETIVO
 * "Severidade" usa a MESMA régua (0 a 3) pros dois tipos de fator que existem
 * hoje no app — manutenção/documento com status ruim, e ocorrência aberta —
 * pra que um problema grave pese igual não importa de onde ele veio:
 *   - manutenção/documento: `atencao` = 1, `vencido` = 3 (vencido é fato
 *     consumado — já passou do prazo — não só aviso; pesa 3x mais, nunca só um
 *     pouco mais, senão um vencido se escondia atrás de vários "atenção").
 *   - ocorrência aberta: gravidade (baixa=1, média=2, alta=3 — alta fica no
 *     mesmo teto de "vencido", uma ocorrência grave é tão séria quanto um item
 *     vencido) × estado (aberta=1, em_acompanhamento=0.5 — alguém já está
 *     cuidando, pesa metade). Sem gravidade registrada, nunca inventa "alta":
 *     usa o mesmo piso de "baixa" (regra de honestidade — menos informação
 *     nunca vira MAIS penalidade).
 *
 * PESO_CATEGORIA é onde mora o segundo princípio: segurança e documentação
 * pesam mais que estética. Ver a constante abaixo para o valor e a
 * justificativa de cada área.
 *
 * Regras de honestidade que NÃO mudam (onda 16, mantidas aqui):
 *   - item sem informação suficiente fica fora da conta, nem a favor nem
 *     contra (`temInformacao`, mesmo contrato de `temInformacaoSuficiente`
 *     em `semaforo.ts`);
 *   - sem nenhum dado (nenhum item com informação e nenhuma ocorrência ativa),
 *     não existe nota — `nota`/`rotulo` voltam `null` e a tela vira convite,
 *     nunca um número mentiroso.
 */

// Quanto cada status de manutenção/documento tira, numa régua de 0-3 —
// mesma régua da severidade de ocorrência abaixo, pra dar pontuação
// comparável a problemas igualmente graves.
export const SEVERIDADE_STATUS_ITEM: Record<"atencao" | "vencido", number> = {
  atencao: 1, // aviso: ainda dá tempo de agir antes do prazo
  vencido: 3, // fato consumado: já passou do prazo, risco já materializado
}

// Quanto a gravidade de uma ocorrência tira, na mesma régua 0-3 do status de
// item — "alta" fica no teto, igual "vencido": uma ocorrência grave (ex.:
// via d'água, incêndio) é tão séria quanto um item vencido, não menos.
export const SEVERIDADE_GRAVIDADE_OCORRENCIA: Record<Gravidade, number> = {
  baixa: 1,
  media: 2,
  alta: 3,
}
// Sem gravidade registrada: nunca inventa "alta" — usa o mesmo piso de
// "baixa" (regra de honestidade: dado ausente nunca vira MAIS penalidade).
export const SEVERIDADE_GRAVIDADE_AUSENTE = SEVERIDADE_GRAVIDADE_OCORRENCIA.baixa

// "Em acompanhamento" já tem alguém cuidando do problema — pesa metade de
// uma "aberta" (ninguém tocou ainda). "Resolvida" nem chega a este cálculo
// (filtrada antes, ver `calcularSaudeEmbarcacao`).
export const MULTIPLICADOR_ESTADO_OCORRENCIA: Record<"aberta" | "em_acompanhamento", number> = {
  aberta: 1,
  em_acompanhamento: 0.5,
}

// Quanto cada área (hub) multiplica o problema — o princípio "segurança e
// documentação pesam mais que estética" mora AQUI, num só lugar, pra
// manutenção/documento E ocorrência (mesma tabela pros dois).
//   - Documentos e Segurança = 6 ("crítica"): documento vencido pode tirar o
//     barco de circulação (seguro, TIE) e item de segurança vencido é risco
//     de vida direto — nunca podem pesar igual a um item estético.
//   - Motores, Elétrica, Hidráulica = 4 ("funcional"): o barco ainda anda,
//     mas com um problema real de propulsão/energia/saneamento a bordo.
//   - Equipamentos e Embarcação (visão geral) = 2 ("moderada"): relevante,
//     mas nem crítico nem puramente estético.
//   - Casco = 2 ("estética/conforto", mesmo peso de Equipamentos): deck,
//     fibra, inox, vidros, estofados — nunca deveria, sozinho, derrubar a
//     nota tanto quanto um extintor vencido (pedido explícito do dono).
//   - Fotos, Contatos, Gastos, Diário, Histórico = 0: essas abas nunca têm
//     manutenção/documento nem ocorrência vinculada (não são "lugar no
//     barco" com estado físico — ver `ABAS_OCORRENCIA` em `ocorrencias.ts`);
//     ficam aqui só porque o tipo `Aba` exige as 13 chaves.
export const PESO_CATEGORIA: Record<Aba, number> = {
  documentos: 6,
  seguranca: 6,
  motores: 4,
  eletrica: 4,
  hidraulica: 4,
  equipamentos: 2,
  embarcacao: 2,
  casco: 2,
  fotos: 0,
  contatos: 0,
  gastos: 0,
  diario: 0,
  historico: 0,
}

// Conversão final de "peso efetivo" (categoria × severidade, teto 6×3=18)
// pra pontos de 0-100. Único lugar que controla o quão "duro" o app é no
// geral — subir este número faz TODO problema doer mais, sem mexer em
// nenhuma outra régua. Calibrado para que um único problema no teto (ex.:
// documento vencido, 6×3=18 de peso efetivo) tire 36 pontos — cai de Ótimo
// pra Atenção sozinho, sem já jogar pra Crítico: um problema sério não
// deveria, isolado, derrubar o barco inteiro pro pior rótulo.
export const PONTOS_POR_PESO_EFETIVO = 2

export interface ItemParaSaude {
  id: string
  nome: string
  aba: Aba
  status: StatusFarol
  /** Mesmo contrato de `temInformacaoSuficiente` (`semaforo.ts`) — item sem
   *  dado real por trás não entra na conta, nem a favor nem contra. */
  temInformacao: boolean
}

export interface OcorrenciaParaSaude {
  id: string
  titulo: string
  aba: Aba
  estado: EstadoOcorrencia
  gravidade: Gravidade | null
}

export interface FatorSaude {
  tipo: "manutencao" | "ocorrencia"
  id: string
  nome: string
  aba: Aba
  /** Texto curto do que está errado — "Vencido", "Atenção", "Aberta · gravidade Alta" etc. */
  detalhe: string
  /** Quanto este fator tirou da nota de 100 — sempre > 0 (só entram fatores que pesam). */
  pontos: number
}

export interface SaudeEmbarcacao {
  /** null quando não há dado nenhum (nenhum item com informação e nenhuma
   *  ocorrência ativa) — o anel não aparece, vira convite, nunca um número mentiroso. */
  nota: number | null
  rotulo: string | null
  emDia: number
  atencao: number
  vencido: number
  /** itens com informação suficiente — não conta ocorrências, que não têm "informação suficiente" como conceito */
  total: number
  /** o que está puxando a nota pra baixo, ordenado do maior impacto pro menor */
  fatores: FatorSaude[]
}

const FAIXAS_NOTA: { minimo: number; rotulo: string }[] = [
  { minimo: 90, rotulo: "Ótimo" },
  { minimo: 70, rotulo: "Bom" },
  { minimo: 40, rotulo: "Atenção" },
  { minimo: 0, rotulo: "Crítico" },
]

/** Rótulo central do anel de saúde — mesmas faixas testadas desde a onda 16
 *  (≥90 Ótimo, ≥70 Bom, ≥40 Atenção, senão Crítico), agora reaplicadas sobre
 *  a nota ponderada em vez do percentual ingênuo de itens em dia. */
export function rotuloDaNota(nota: number): string {
  return (FAIXAS_NOTA.find((f) => nota >= f.minimo) ?? FAIXAS_NOTA[FAIXAS_NOTA.length - 1]).rotulo
}

/** Fórmula oficial da Saúde da Embarcação — ver o comentário grande no topo
 *  deste arquivo para o histórico da decisão e a justificativa de cada peso. */
export function calcularSaudeEmbarcacao(
  itens: ItemParaSaude[],
  ocorrencias: OcorrenciaParaSaude[],
): SaudeEmbarcacao {
  const comInfo = itens.filter((i) => i.temInformacao)
  const emDia = comInfo.filter((i) => i.status === "ok").length
  const atencao = comInfo.filter((i) => i.status === "atencao").length
  const vencido = comInfo.filter((i) => i.status === "vencido").length
  const total = comInfo.length

  const ocorrenciasAtivas = ocorrencias.filter((o) => o.estado !== "resolvida")

  if (total === 0 && ocorrenciasAtivas.length === 0) {
    return { nota: null, rotulo: null, emDia: 0, atencao: 0, vencido: 0, total: 0, fatores: [] }
  }

  const fatoresItens: FatorSaude[] = comInfo
    .filter((i): i is ItemParaSaude & { status: "atencao" | "vencido" } => i.status !== "ok")
    .map((i) => ({
      tipo: "manutencao",
      id: i.id,
      nome: i.nome,
      aba: i.aba,
      detalhe: i.status === "vencido" ? "Vencido" : "Atenção",
      pontos: Math.round(PESO_CATEGORIA[i.aba] * SEVERIDADE_STATUS_ITEM[i.status] * PONTOS_POR_PESO_EFETIVO),
    }))

  const fatoresOcorrencias: FatorSaude[] = ocorrenciasAtivas.map((o) => {
    const estado = o.estado as "aberta" | "em_acompanhamento"
    const severidadeGravidade = o.gravidade != null ? SEVERIDADE_GRAVIDADE_OCORRENCIA[o.gravidade] : SEVERIDADE_GRAVIDADE_AUSENTE
    const pontos = Math.round(
      PESO_CATEGORIA[o.aba] * severidadeGravidade * MULTIPLICADOR_ESTADO_OCORRENCIA[estado] * PONTOS_POR_PESO_EFETIVO,
    )
    const detalhe = `${ROTULO_ESTADO[o.estado]}${o.gravidade != null ? ` · gravidade ${ROTULO_GRAVIDADE[o.gravidade]}` : ""}`
    return { tipo: "ocorrencia", id: o.id, nome: o.titulo, aba: o.aba, detalhe, pontos }
  })

  const fatores = [...fatoresItens, ...fatoresOcorrencias].sort((a, b) => b.pontos - a.pontos)
  const penalidadeTotal = fatores.reduce((soma, f) => soma + f.pontos, 0)
  const nota = Math.max(0, Math.min(100, 100 - penalidadeTotal))

  return { nota, rotulo: rotuloDaNota(nota), emDia, atencao, vencido, total, fatores }
}

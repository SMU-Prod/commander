import { podeVer, type Aba, type Permissoes } from "@/lib/domain/permissoes"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { EstadoOcorrencia, Gravidade } from "@/lib/domain/ocorrencias"

/**
 * CENTRAL DE NOTIFICAÇÕES (onda 44, PRD §5.2).
 *
 * Regra pura: monta, filtra, classifica e agrupa. Nunca consulta o banco e
 * nunca envia nada — quem busca os dados é `lib/consultas.ts`, quem dispara
 * push é `app/api/alertas/disparar/route.ts`. Os dois usam as MESMAS funções
 * daqui, porque a pior falha possível deste módulo é a tela mostrar uma
 * coisa e o push mandar outra.
 */

// --- Categorias ------------------------------------------------------------

/**
 * As quatro categorias do PRD §5.2 ("filtros: Todas, Embarcação, Agenda,
 * Marketplace, Financeiro").
 *
 * ONDA 53 — as três últimas passaram a ter FONTE. A onda 44 as declarou aqui
 * mesmo sem módulo por trás, com estado vazio honesto ("a Agenda ainda não
 * está no ar"), justamente pra que ligar a fonte não custasse nada além de
 * produzir `Notificacao` com a categoria certa. Foi o que aconteceu: as
 * fontes moram em `lib/consultas.ts` (`carregarNotificacoes`) e nada da
 * mecânica deste arquivo mudou — só os textos de vazio, que agora falam de
 * um módulo que existe.
 */
export const CATEGORIAS_NOTIFICACAO = ["embarcacao", "agenda", "marketplace", "financeiro"] as const
export type CategoriaNotificacao = (typeof CATEGORIAS_NOTIFICACAO)[number]

export const ROTULO_CATEGORIA_NOTIFICACAO: Record<CategoriaNotificacao, string> = {
  embarcacao: "Embarcação",
  agenda: "Agenda",
  marketplace: "Marketplace",
  financeiro: "Financeiro",
}

/** Texto do estado vazio de cada categoria. Agora que os quatro módulos
 *  existem, todo vazio quer dizer a mesma coisa: não há nada pendente —
 *  nunca "o módulo não está pronto". */
export const VAZIO_CATEGORIA_NOTIFICACAO: Record<CategoriaNotificacao, string> = {
  embarcacao: "Nada vencido, nada na margem e nenhuma ocorrência aberta. Bom vento e mar calmo.",
  agenda: "Nenhum compromisso à vista nos próximos dias, e ninguém compartilhou nada novo com você.",
  marketplace: "Nenhum aviso de negócio agora. Propostas e confirmações pendentes aparecem aqui.",
  financeiro: "Nenhuma conta vencendo e nada pendente de pagamento. O caixa está em dia.",
}

// --- Níveis ----------------------------------------------------------------

/**
 * Os três níveis do PRD §5.2, e o que cada um significa na prática:
 *
 *   CRÍTICA     in-app + push, com destaque visual. Algo já é fato
 *               consumado: documento vencido, item de segurança vencido,
 *               ocorrência grave aberta.
 *   IMPORTANTE  in-app + push "quando exigem ação ou envolvem outra
 *               pessoa". Ainda dá tempo: vencimento na margem, ocorrência
 *               em acompanhamento.
 *   INFORMATIVA "normalmente somente in-app". Não interrompe ninguém.
 *
 * `PUSH_POR_NIVEL` é a tradução direta dessas frases — a decisão de
 * interromper alguém no celular mora num lugar só.
 */
export const NIVEIS_NOTIFICACAO = ["critica", "importante", "informativa"] as const
export type NivelNotificacao = (typeof NIVEIS_NOTIFICACAO)[number]

export const ROTULO_NIVEL_NOTIFICACAO: Record<NivelNotificacao, string> = {
  critica: "Crítica",
  importante: "Importante",
  informativa: "Informativa",
}

export const PUSH_POR_NIVEL: Record<NivelNotificacao, boolean> = {
  critica: true,
  importante: true,
  informativa: false,
}

/** Ordem de urgência — crítica sempre primeiro, informativa sempre por
 *  último. Mesma ideia do `PESO` do farol (`lib/domain/semaforo.ts`). */
export const PESO_NIVEL: Record<NivelNotificacao, number> = {
  critica: 3,
  importante: 2,
  informativa: 1,
}

// --- A notificação em si ---------------------------------------------------

export interface Notificacao {
  id: string
  titulo: string
  detalhe: string
  categoria: CategoriaNotificacao
  nivel: NivelNotificacao
  /**
   * Aba de permissão que a pessoa precisa poder VER pra receber isto.
   * `null` = aviso que não pertence a nenhum hub (conta, assinatura,
   * boletim do mar) e todo mundo com vínculo pode ver.
   *
   * Este campo é o coração do "Notificações sempre respeitam permissões do
   * usuário" (PRD §5.2): um tripulante sem acesso a Documentos não pode nem
   * ver na lista, nem receber push, de um documento vencendo.
   */
  aba: Aba | null
  href: string
  /** ISO — null quando é um estado atual (item vencido hoje), não um evento datado. */
  quando: string | null
  /**
   * Chave de agrupamento. Notificações com a mesma chave viram UMA linha com
   * contador — é o "oportunidades semelhantes devem ser agrupadas para evitar
   * spam" do PRD §5.2, generalizado: cinco documentos vencendo no mesmo mês
   * também são spam.
   */
  grupo: string
}

export interface NotificacaoAgrupada extends Notificacao {
  /** 1 = notificação solitária; >1 = quantas semelhantes foram dobradas nesta linha */
  quantidade: number
}

// --- Classificação ---------------------------------------------------------

/** Manutenção/documento: vencido é fato consumado (crítica), na margem ainda
 *  dá tempo de agir (importante). Mesma régua do farol, sem inventar uma
 *  segunda. */
export function nivelDoStatusItem(status: StatusFarol): NivelNotificacao {
  if (status === "vencido") return "critica"
  if (status === "atencao") return "importante"
  return "informativa"
}

/** Ocorrência: gravidade alta em aberto é crítica; o resto pede ação mas não
 *  é emergência. Em acompanhamento nunca é crítica — alguém já está cuidando,
 *  e interromper de novo é o spam que o PRD manda evitar. Sem gravidade
 *  registrada não se inventa "alta" (mesma regra de honestidade da Saúde:
 *  menos informação nunca vira MAIS alarme). */
export function nivelDaOcorrencia(estado: EstadoOcorrencia, gravidade: Gravidade | null): NivelNotificacao {
  if (estado === "aberta" && gravidade === "alta") return "critica"
  if (estado === "aberta" || estado === "em_acompanhamento") return "importante"
  return "informativa"
}

// --- Agenda, Marketplace e Financeiro (onda 53) ----------------------------

/**
 * Quantos dias à frente cada módulo olha. Sete porque é a semana que a
 * pessoa consegue reorganizar: aviso de conta que vence daqui a um mês não
 * muda decisão nenhuma hoje, e vira ruído até virar cego.
 */
export const DIAS_AVISO_AGENDA = 7
export const DIAS_AVISO_FINANCEIRO = 7

/**
 * Compromisso chegando (PRD §8 + §5.2). Nunca crítica — e isto é decisão,
 * não esquecimento: no Commander "crítica" quer dizer que o BARCO tem um
 * fato consumado (documento vencido, item de segurança vencido, ocorrência
 * grave). Perder um almoço no iate clube não é da mesma família, e misturar
 * as duas coisas ensina o dono a ignorar o vermelho.
 *
 * Hoje ou amanhã é `importante` ("exige ação"); mais longe é `informativa`.
 */
export function nivelDoCompromisso(diasAte: number): NivelNotificacao {
  return diasAte <= 1 ? "importante" : "informativa"
}

/**
 * Vencimento de dinheiro (PRD §9.2 + §5.2). Mesma régua e mesmo motivo do
 * compromisso: conta atrasada pede ação hoje (`importante`), conta que ainda
 * vai vencer é aviso (`informativa`). Dinheiro nunca é `crítica` aqui — o
 * PRD reserva o destaque visual pro que ameaça a embarcação, e o Commander
 * não sabe se a conta já foi paga por fora.
 *
 * `diasAte` negativo = já venceu.
 */
export function nivelDoVencimentoFinanceiro(diasAte: number): NivelNotificacao {
  return diasAte <= 0 ? "importante" : "informativa"
}

/**
 * Os avisos do Marketplace (PRD §11.5 e §11.6). §5.2 define `importante`
 * como "exigem ação ou envolvem outra pessoa" — e é literalmente o caso de
 * proposta recebida, proposta aceita e negócio esperando a sua confirmação:
 * tem alguém do outro lado parado esperando você. Recusa não: já acabou,
 * não há o que fazer, então é `informativa`.
 */
export type AvisoMarketplace =
  | "proposta_recebida"
  | "proposta_aceita"
  | "proposta_recusada"
  | "negocio_aguardando"

export const NIVEL_AVISO_MARKETPLACE: Record<AvisoMarketplace, NivelNotificacao> = {
  proposta_recebida: "importante",
  proposta_aceita: "importante",
  proposta_recusada: "informativa",
  negocio_aguardando: "importante",
}

// --- Permissão, filtro, ordenação e agrupamento ----------------------------

/**
 * O filtro que o PRD §5.2 exige. `permissoes = null` é PROP (dono), que vê
 * tudo — mesmo contrato de `podeVer`. Notificação sem `aba` passa sempre:
 * não pertence a hub nenhum.
 */
export function filtrarPorPermissao<T extends Notificacao>(
  notificacoes: readonly T[],
  permissoes: Permissoes | null,
): T[] {
  return notificacoes.filter((n) => n.aba == null || podeVer(permissoes, n.aba))
}

export function filtrarPorCategoria<T extends Notificacao>(
  notificacoes: readonly T[],
  categoria: CategoriaNotificacao | "todas",
): T[] {
  return categoria === "todas" ? [...notificacoes] : notificacoes.filter((n) => n.categoria === categoria)
}

/** Mais urgente primeiro; dentro do mesmo nível, o mais recente primeiro.
 *  Sem data (`quando = null`) é estado atual do barco, que vem antes de
 *  histórico do mesmo nível. */
export function ordenarNotificacoes<T extends Notificacao>(notificacoes: readonly T[]): T[] {
  return [...notificacoes].sort((a, b) => {
    const porNivel = PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel]
    if (porNivel !== 0) return porNivel
    if (a.quando === b.quando) return 0
    if (a.quando == null) return -1
    if (b.quando == null) return 1
    return b.quando.localeCompare(a.quando)
  })
}

/**
 * "Oportunidades semelhantes devem ser agrupadas para evitar spam" (PRD
 * §5.2). Dobra tudo que compartilha a mesma `grupo` numa linha só, mantendo
 * a PRIMEIRA da lista como representante — por isso ordene antes de agrupar
 * (`agruparSemelhantes(ordenarNotificacoes(ns))`): assim a linha mostrada é
 * a mais urgente do grupo, não uma qualquer.
 *
 * Não some com nada: quem quer o detalhe abre o hub. O que se evita é a
 * lista de dez linhas quase idênticas que ninguém lê até o fim.
 */
export function agruparSemelhantes(notificacoes: readonly Notificacao[]): NotificacaoAgrupada[] {
  const porGrupo = new Map<string, NotificacaoAgrupada>()
  for (const n of notificacoes) {
    const existente = porGrupo.get(n.grupo)
    if (existente) existente.quantidade++
    else porGrupo.set(n.grupo, { ...n, quantidade: 1 })
  }
  return [...porGrupo.values()]
}

export function contarPorCategoria(
  notificacoes: readonly Notificacao[],
): Record<CategoriaNotificacao, number> {
  const contagem = Object.fromEntries(
    CATEGORIAS_NOTIFICACAO.map((c) => [c, 0]),
  ) as Record<CategoriaNotificacao, number>
  for (const n of notificacoes) contagem[n.categoria]++
  return contagem
}

/**
 * O número dentro do sino. Conta críticas e importantes — nunca as
 * informativas: um badge vermelho que nunca zera porque tem três avisos
 * "pra saber" perde o significado, e aí ninguém olha quando importa.
 * Mesmo critério de `PUSH_POR_NIVEL`: o que interrompe é o que conta.
 */
export function contadorSino(notificacoes: readonly Notificacao[]): number {
  return notificacoes.filter((n) => PUSH_POR_NIVEL[n.nivel]).length
}

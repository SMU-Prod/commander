/**
 * FINANCEIRO ENTERPRISE (onda 74).
 * PRD-UPGRADE-3-COTAS §12.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO É FECHADO, E ISSO É A COISA MAIS IMPORTANTE DO ARQUIVO
 * ---------------------------------------------------------------------------
 * §12, primeira linha: *"Escopo fechado: somente administração operacional.
 * NÃO INCLUIR cobrança de cotistas, venda de cotas, receitas comerciais,
 * repasses ou contabilidade societária."*
 *
 * O §26 repete na lista do que está fora do produto. Ou seja: não é uma fase
 * seguinte, é uma fronteira. O Commander diz quanto CUSTA operar a frota; o
 * quanto a administradora FATURA com ela é assunto do sistema dela.
 *
 * Por isso este módulo só conhece CUSTO. Não há função aqui que some receita,
 * calcule margem ou reparta valor entre cotistas — e o teste
 * `financeiro-frota.test.ts` guarda essa ausência de propósito.
 *
 * Módulo puro.
 */

// ---------------------------------------------------------------------------
// §12 — de onde o custo veio
// ---------------------------------------------------------------------------

/**
 * As seis origens que o §12 lista na tabela "Origem → Entrada automática no
 * Financeiro". `manual` é a última linha dele: "exceções e despesas não
 * cobertas".
 *
 * Saber a origem não é enfeite de relatório: é o que permite ao ADM
 * responder "por que este Jet custou o dobro do outro" sem abrir lançamento
 * por lançamento.
 */
export const ORIGENS_CUSTO = [
  "combustivel", "mecanica", "estoque", "avaria", "documentacao", "manual",
] as const

export type OrigemCusto = (typeof ORIGENS_CUSTO)[number]

export const ROTULO_ORIGEM: Record<OrigemCusto, string> = {
  combustivel: "Combustível",
  mecanica: "Mecânica",
  estoque: "Estoque",
  avaria: "Avaria",
  documentacao: "Documentação",
  manual: "Lançamento manual",
}

// ---------------------------------------------------------------------------
// §12 — períodos
// ---------------------------------------------------------------------------

/** "Períodos: mês, 6 meses, ano." Exatamente os três. */
export const PERIODOS_FROTA = ["mes", "semestre", "ano"] as const
export type PeriodoFrota = (typeof PERIODOS_FROTA)[number]

export const ROTULO_PERIODO: Record<PeriodoFrota, string> = {
  mes: "Mês",
  semestre: "6 meses",
  ano: "Ano",
}

/** Quantos meses o período cobre — usado pra montar a data de corte. */
export const MESES_DO_PERIODO: Record<PeriodoFrota, number> = {
  mes: 1,
  semestre: 6,
  ano: 12,
}

/**
 * A data de corte (AAAA-MM-DD) de um período contado a partir de `hoje`.
 *
 * Volta em meses de calendário, não em "30 dias": o ADM compara agosto com
 * julho, não com "os últimos 30 dias", e um mês de 31 dias não pode roubar
 * um dia do anterior.
 */
export function inicioDoPeriodo(periodo: PeriodoFrota, hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number)
  const alvo = mes - 1 - MESES_DO_PERIODO[periodo]
  const anoAlvo = ano + Math.floor(alvo / 12)
  const mesAlvo = ((alvo % 12) + 12) % 12
  const ultimoDia = new Date(Date.UTC(anoAlvo, mesAlvo + 1, 0)).getUTCDate()
  const d = new Date(Date.UTC(anoAlvo, mesAlvo, Math.min(dia, ultimoDia)))
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// §12 — a consolidação
// ---------------------------------------------------------------------------

export interface CustoLancado {
  embarcacaoId: string
  origem: OrigemCusto
  valorCentavos: number
}

export interface CustoDaUnidade {
  embarcacaoId: string
  nome: string
  totalCentavos: number
  porOrigem: Record<OrigemCusto, number>
  /** Fatia do custo da frota, 0 a 100. */
  percentualDaFrota: number
}

export interface CustoDaFrota {
  totalCentavos: number
  porOrigem: Record<OrigemCusto, number>
  /** §12: "Ordenar unidades por maior custo." Já vem ordenado. */
  unidades: CustoDaUnidade[]
}

function zeradoPorOrigem(): Record<OrigemCusto, number> {
  return Object.fromEntries(ORIGENS_CUSTO.map((o) => [o, 0])) as Record<OrigemCusto, number>
}

/**
 * Consolida o custo da frota e de cada unidade.
 *
 * Duas decisões que a tela depende:
 *
 *   UNIDADE SEM CUSTO APARECE, com zero. Some da lista seria pior: o ADM
 *   olharia 12 unidades numa frota de 20 e não saberia se as outras 8 não
 *   gastaram ou se o app perdeu. Custo zero é informação — pode significar
 *   unidade parada, que é justamente o que ele quer notar.
 *
 *   A ORDEM É POR CUSTO, decrescente, com desempate por nome. O §12 pede
 *   isso e o motivo é operacional: numa frota de 40, quem está no topo é
 *   quem merece a próxima conversa.
 */
export function consolidarFrota(
  unidades: readonly { id: string; nome: string }[],
  lancamentos: readonly CustoLancado[],
): CustoDaFrota {
  const porUnidade = new Map<string, CustoDaUnidade>(
    unidades.map((u) => [
      u.id,
      { embarcacaoId: u.id, nome: u.nome, totalCentavos: 0, porOrigem: zeradoPorOrigem(), percentualDaFrota: 0 },
    ]),
  )
  const frotaPorOrigem = zeradoPorOrigem()
  let total = 0

  for (const l of lancamentos) {
    const u = porUnidade.get(l.embarcacaoId)
    // Lançamento de unidade que não está na lista é ignorado em silêncio de
    // propósito: acontece quando o ADM filtra por base e o custo é de outra.
    if (!u) continue
    u.totalCentavos += l.valorCentavos
    u.porOrigem[l.origem] += l.valorCentavos
    frotaPorOrigem[l.origem] += l.valorCentavos
    total += l.valorCentavos
  }

  const lista = [...porUnidade.values()]
    .map((u) => ({
      ...u,
      percentualDaFrota: total > 0 ? Math.round((u.totalCentavos / total) * 100) : 0,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.nome.localeCompare(b.nome, "pt-BR"))

  return { totalCentavos: total, porOrigem: frotaPorOrigem, unidades: lista }
}

/** As origens que realmente pesaram, da maior pra menor — a tela mostra as
 *  três primeiras e não uma lista de seis com quatro zeros. */
export function origensQuePesaram(porOrigem: Record<OrigemCusto, number>): OrigemCusto[] {
  return ORIGENS_CUSTO
    .filter((o) => porOrigem[o] > 0)
    .sort((a, b) => porOrigem[b] - porOrigem[a])
}

// ---------------------------------------------------------------------------
// §12 — a armadilha da duplicidade
// ---------------------------------------------------------------------------

/**
 * §12, última linha: *"Evitar duplicidade: ao registrar serviço, perguntar se
 * peças já estão incluídas no valor."*
 *
 * A armadilha é real e silenciosa. O mecânico retira R$ 800 em peças do
 * estoque (que já entram como custo, §10) e depois lança o serviço da oficina
 * por R$ 2.000 — valor que, na nota, JÁ INCLUI as mesmas peças. A unidade
 * aparece com R$ 2.800 de custo tendo gasto R$ 2.000, e ninguém percebe
 * porque os dois lançamentos estão certos separadamente.
 *
 * O app não pode adivinhar qual dos dois casos é. O que ele pode — e o que o
 * §12 pede — é PERGUNTAR, e só quando faz sentido perguntar: se nenhuma peça
 * saiu do estoque para este serviço, não há duplicidade possível e a pergunta
 * seria ruído.
 */
export function avisoDeDuplicidade(
  pecasJaLancadasCentavos: number,
): { perguntar: boolean; pergunta: string; opcoes: [string, string] } | null {
  if (pecasJaLancadasCentavos <= 0) return null
  const valor = (pecasJaLancadasCentavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).replace(/ /g, " ")
  return {
    perguntar: true,
    pergunta:
      `Já foram lançados ${valor} em peças do estoque para este serviço. ` +
      "O valor que você está informando inclui essas peças?",
    // A ordem importa: a primeira opção é a que evita contar duas vezes, e
    // é a mais comum (a nota da oficina costuma vir com peça e mão de obra
    // juntas).
    opcoes: [
      "Sim, o valor já inclui as peças",
      "Não, é só a mão de obra",
    ],
  }
}

/**
 * Quanto de fato lançar, depois da resposta.
 *
 * Quando o valor JÁ inclui as peças, o que entra é a diferença — a mão de
 * obra — porque as peças já viraram custo quando saíram do estoque. Se a
 * diferença der negativo (o serviço custou menos que as peças, o que
 * acontece quando a oficina cobrou só parte), lança zero em vez de crédito:
 * o Financeiro operacional não tem entrada, e um valor negativo aqui
 * mascararia o custo de outra unidade na consolidação.
 */
export function valorAlancar(
  valorInformadoCentavos: number,
  pecasJaLancadasCentavos: number,
  jaInclui: boolean,
): number {
  if (!jaInclui) return Math.max(0, valorInformadoCentavos)
  return Math.max(0, valorInformadoCentavos - Math.max(0, pecasJaLancadasCentavos))
}

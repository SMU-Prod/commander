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

import { formatarReais } from "./gastos"

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
  /**
   * `null` NÃO É `"manual"`.
   *
   * Esta distinção é a correção da auditoria de 19/08 (achado B1), e vale a
   * pena registrar por que ela existe. A tela lia `l.origem ?? "manual"`: como
   * nenhum insert do app preenchia a coluna, TODO custo caía em "Lançamento
   * manual" e o gráfico "Em quê" tinha uma barra só, 100%, em qualquer conta e
   * para sempre. Era a regra da casa quebrada na versão mais cara dela — não
   * um `null` virando zero desenhado, e sim um `null` virando um FATO
   * desenhado, afirmando uma procedência que ninguém informou.
   *
   * `manual` continua sendo uma origem legítima: é a última linha da tabela do
   * §12 ("exceções e despesas não cobertas") e vale para o lançamento em que
   * alguém DISSE que foi manual. Ausência de origem é outra coisa — é o app
   * não sabendo — e a consolidação abaixo a separa em `semProcedenciaCentavos`
   * em vez de escolher uma gaveta por ela.
   */
  origem: OrigemCusto | null
  valorCentavos: number
}

export interface CustoDaUnidade {
  embarcacaoId: string
  nome: string
  totalCentavos: number
  porOrigem: Record<OrigemCusto, number>
  /** Parte do total que não diz de onde veio. Entra no total (o dinheiro saiu,
   *  isso é fato), nunca numa das seis origens. */
  semProcedenciaCentavos: number
  /** Fatia do custo da frota, 0 a 100. */
  percentualDaFrota: number
}

export interface CustoDaFrota {
  totalCentavos: number
  porOrigem: Record<OrigemCusto, number>
  semProcedenciaCentavos: number
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
 *
 *   CUSTO SEM ORIGEM NÃO ESCOLHE UMA GAVETA. Ele soma no total — o dinheiro
 *   saiu, e isso a tela sabe — e fica separado em `semProcedenciaCentavos`,
 *   para que o "Em quê" mostre só o que foi de fato informado. Somá-lo em
 *   `manual` faria a tela responder uma pergunta que ninguém respondeu.
 */
export function consolidarFrota(
  unidades: readonly { id: string; nome: string }[],
  lancamentos: readonly CustoLancado[],
): CustoDaFrota {
  const porUnidade = new Map<string, CustoDaUnidade>(
    unidades.map((u) => [
      u.id,
      {
        embarcacaoId: u.id, nome: u.nome, totalCentavos: 0,
        porOrigem: zeradoPorOrigem(), semProcedenciaCentavos: 0, percentualDaFrota: 0,
      },
    ]),
  )
  const frotaPorOrigem = zeradoPorOrigem()
  let total = 0
  let semProcedencia = 0

  for (const l of lancamentos) {
    const u = porUnidade.get(l.embarcacaoId)
    // Lançamento de unidade que não está na lista é ignorado em silêncio de
    // propósito: acontece quando o ADM filtra por base e o custo é de outra.
    if (!u) continue
    u.totalCentavos += l.valorCentavos
    total += l.valorCentavos
    if (l.origem === null) {
      u.semProcedenciaCentavos += l.valorCentavos
      semProcedencia += l.valorCentavos
      continue
    }
    u.porOrigem[l.origem] += l.valorCentavos
    frotaPorOrigem[l.origem] += l.valorCentavos
  }

  const lista = [...porUnidade.values()]
    .map((u) => ({
      ...u,
      percentualDaFrota: total > 0 ? Math.round((u.totalCentavos / total) * 100) : 0,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos || a.nome.localeCompare(b.nome, "pt-BR"))

  return {
    totalCentavos: total,
    porOrigem: frotaPorOrigem,
    semProcedenciaCentavos: semProcedencia,
    unidades: lista,
  }
}

/** As origens que realmente pesaram, da maior pra menor — a tela mostra as
 *  três primeiras e não uma lista de seis com quatro zeros. */
export function origensQuePesaram(porOrigem: Record<OrigemCusto, number>): OrigemCusto[] {
  return ORIGENS_CUSTO
    .filter((o) => porOrigem[o] > 0)
    .sort((a, b) => porOrigem[b] - porOrigem[a])
}

// ---------------------------------------------------------------------------
// §12 — o que a tela diz sobre o que ela NÃO sabe
// ---------------------------------------------------------------------------

/**
 * A frase que confessa a parte do custo sem procedência — `null` quando não
 * há nada a confessar.
 *
 * Ela existe porque a alternativa honesta à barra falsa não é esconder o
 * dinheiro: é dizê-lo. Um ADM que veja "R$ 4.200 · 62% do total sem
 * procedência" entende na hora por que o gráfico "Em quê" cobre pouco, e
 * entende também o que precisa mudar no hábito da equipe (retirar peça pelo
 * Estoque e abastecer pelo Combustível, em vez de lançar à mão no Financeiro).
 * Sumir com o número transformaria o gráfico numa mentira menor, não numa
 * verdade.
 */
export function fraseSemProcedencia(
  totalCentavos: number,
  semProcedenciaCentavos: number,
): string | null {
  if (semProcedenciaCentavos <= 0) return null
  if (totalCentavos <= 0) return null
  const pct = Math.round((semProcedenciaCentavos / totalCentavos) * 100)
  return `${formatarReais(semProcedenciaCentavos)} · ${pct}% do total sem procedência registrada`
}

/**
 * A linha de apoio de cada unidade.
 *
 * Mora aqui, e não no JSX, porque ela é uma decisão sobre o que a tela pode
 * AFIRMAR — e a versão anterior afirmava errado ("Lançamento manual" em cima
 * de origem ausente). São quatro casos, e cada um diz exatamente o que se
 * sabe:
 *
 *   sem custo         → zero é informação: costuma ser unidade parada (§12)
 *   só sem procedência → não inventa origem nenhuma
 *   só com procedência → as duas que mais pesaram, como o §12 pede
 *   os dois            → as origens conhecidas E o quanto ficou sem explicação
 */
export function linhaDaUnidade(u: CustoDaUnidade): string {
  if (u.totalCentavos === 0) return "Nenhum custo no período"

  const fatia = `${u.percentualDaFrota}% do custo da frota`
  const conhecidas = origensQuePesaram(u.porOrigem)
    .slice(0, 2)
    .map((o) => ROTULO_ORIGEM[o])
    .join(", ")

  if (conhecidas === "") return `${fatia} · procedência não registrada`
  if (u.semProcedenciaCentavos <= 0) return `${fatia} · ${conhecidas}`
  return `${fatia} · ${conhecidas} · ${formatarReais(u.semProcedenciaCentavos)} sem procedência`
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

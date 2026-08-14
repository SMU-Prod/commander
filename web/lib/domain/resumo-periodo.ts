import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { abaDoItem, grupoDoEvento } from "@/lib/domain/diario"
import type { Aba } from "@/lib/domain/permissoes"
import { mesSeguinte, resumoDoMes } from "@/lib/domain/relatorio"
import { calcularSemaforo, temInformacaoSuficiente } from "@/lib/domain/semaforo"
import type { Equipamento, Evento, ItemMonitorado } from "@/lib/db/types"

/**
 * RESUMOS (onda 37, PRD §28-29) — área de produto com períodos Mensal /
 * Semestral / Anual, gerados sob demanda pelo dono. Um único modelo de
 * relatório (PRD proíbe "executivo"/"completo"/"premium" nesta fase).
 *
 * Regra de ouro: NUNCA recalcula os números que o cron mensal
 * (`web/app/api/relatorio/mensal/route.ts`) já calcula — `resumoDoMes`
 * (abaixo) é chamado mês a mês e somado, exatamente como o cron faz para um
 * mês só. Duas fontes calculando a mesma coisa é a receita clássica pra
 * divergência (o pedido explícito do PRD é reaproveitar).
 */

export type TipoPeriodo = "mensal" | "semestral" | "anual"

export interface OpcaoPeriodo {
  chave: string
  rotulo: string
}

/** Ocorrência mínima que este domínio precisa — evita acoplar ao tipo `Ocorrencia`
 *  completo (a página só busca as 3 colunas usadas aqui). */
export interface OcorrenciaParaResumo {
  estado: string
  created_at: string
  resolvida_em: string | null
}

const HUBS_RESUMO = ["casco", "eletrica", "hidraulica", "seguranca", "equipamentos", "documentos"] as const
export type AbaHubResumo = (typeof HUBS_RESUMO)[number]

export interface HubResumo {
  aba: AbaHubResumo
  total: number
  ok: number
  atencao: number
  vencido: number
  /** Item cadastrado mas sem regra de vencimento suficiente pra ter status
   *  (mesmo critério de `temInformacaoSuficiente` — honestidade da onda 16:
   *  não conta a favor nem contra). */
  semInformacao: number
}

export interface ResumoPeriodo {
  tipo: TipoPeriodo
  chave: string
  rotulo: string
  /** Meses ("AAAA-MM") cobertos pelo período, já cortados em "hoje" — nunca
   *  inclui mês futuro (não há dado real pra inventar lá). */
  meses: string[]
  horasMotor: number
  totalGastosCentavos: number
  saidas: number
  /** Todo lançamento do diário no período, qualquer tipo — distinto de
   *  `saidas` (só navegação), é o "Diários" do PRD §29. */
  totalDiario: number
  manutencoesRealizadas: number
  abastecimentos: { quantidade: number; totalCentavos: number }
  gastosPorGrupo: { grupo: string; totalCentavos: number }[]
  /** Ocorrências ABERTAS (criadas) dentro do período — não é "em aberto
   *  hoje", é "quantas nasceram nessas datas", simétrico a `resolvidas`. */
  ocorrenciasAbertasNoPeriodo: number
  ocorrenciasResolvidasNoPeriodo: number
  /** Reaproveita literalmente `resumoDoMes(...).aVencer` do último mês do
   *  período — é a mesma lista que o cron já produz pro mês seguinte. */
  aVencer: { nome: string; quando: string }[]
  /** Só tem mais de 1 entrada em semestral/anual — mensal sempre tem 1. */
  evolucaoMensal: { mes: string; rotulo: string; horasMotor: number; gastosCentavos: number; saidas: number }[]
  /** Estado ATUAL (hoje, não do período — ver `periodoSemAtividade`) dos
   *  hubs por status do farol. Não existe forma honesta de reconstruir o
   *  status desses hubs em uma data passada (itens_monitorados não guarda
   *  histórico de status), então o relatório rotula isso como "hoje". */
  hubs: HubResumo[]
}

function nomeMesExtenso(mesISO: string): string {
  const [a, m] = mesISO.split("-").map(Number)
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)))
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

/** Últimos N meses (incluindo o atual), do mais recente pro mais antigo — pro seletor de período. */
export function opcoesMensais(hoje: string, quantidade = 12): OpcaoPeriodo[] {
  const [anoAtual, mesAtualNum] = hoje.slice(0, 7).split("-").map(Number)
  const totalAtual = anoAtual * 12 + (mesAtualNum - 1)
  return Array.from({ length: quantidade }, (_, i) => {
    const t = totalAtual - i
    const y = Math.floor(t / 12)
    const m = (t % 12) + 1
    const chave = `${y}-${String(m).padStart(2, "0")}`
    return { chave, rotulo: `${nomeMesExtenso(chave)} de ${y}` }
  })
}

/** Últimos N semestres (incluindo o em andamento), do mais recente pro mais antigo. */
export function opcoesSemestrais(hoje: string, quantidade = 4): OpcaoPeriodo[] {
  const ano = Number(hoje.slice(0, 4))
  const semestreAtual = Number(hoje.slice(5, 7)) <= 6 ? 1 : 2
  const opcoes: OpcaoPeriodo[] = []
  let a = ano
  let s = semestreAtual
  for (let i = 0; i < quantidade; i++) {
    opcoes.push({ chave: `${a}-S${s}`, rotulo: `${s}º semestre de ${a}` })
    s -= 1
    if (s === 0) {
      s = 2
      a -= 1
    }
  }
  return opcoes
}

/** Últimos N anos (incluindo o atual), do mais recente pro mais antigo. */
export function opcoesAnuais(hoje: string, quantidade = 5): OpcaoPeriodo[] {
  const ano = Number(hoje.slice(0, 4))
  return Array.from({ length: quantidade }, (_, i) => ({ chave: String(ano - i), rotulo: String(ano - i) }))
}

export function rotuloPeriodo(tipo: TipoPeriodo, chave: string): string {
  if (tipo === "mensal") return `${nomeMesExtenso(chave)} de ${chave.slice(0, 4)}`
  if (tipo === "semestral") {
    const [ano, sem] = chave.split("-S")
    return `${sem}º semestre de ${ano}`
  }
  return chave
}

/** Meses ("AAAA-MM") que compõem o período, cortados em "hoje" — um
 *  semestre/ano ainda em curso só entra com os meses que já aconteceram.
 *  Período inteiramente no futuro devolve `[]` (nunca deveria acontecer: o
 *  seletor da tela só oferece períodos já iniciados). */
export function mesesDoPeriodo(tipo: TipoPeriodo, chave: string, hoje: string): string[] {
  const mesAtual = hoje.slice(0, 7)
  let inicio: string
  let quantidade: number
  if (tipo === "mensal") {
    inicio = chave
    quantidade = 1
  } else if (tipo === "semestral") {
    const [ano, sem] = chave.split("-S")
    inicio = `${ano}-${sem === "1" ? "01" : "07"}`
    quantidade = 6
  } else {
    inicio = `${chave}-01`
    quantidade = 12
  }
  const meses: string[] = []
  let atual = inicio
  for (let i = 0; i < quantidade; i++) {
    if (atual > mesAtual) break
    meses.push(atual)
    atual = mesSeguinte(atual)
  }
  return meses
}

export function periodoSemAtividade(r: ResumoPeriodo): boolean {
  return (
    r.horasMotor === 0 &&
    r.totalGastosCentavos === 0 &&
    r.saidas === 0 &&
    r.totalDiario === 0 &&
    r.manutencoesRealizadas === 0 &&
    r.abastecimentos.quantidade === 0 &&
    r.ocorrenciasAbertasNoPeriodo === 0 &&
    r.ocorrenciasResolvidasNoPeriodo === 0
  )
}

export function montarResumoPeriodo(
  dados: {
    eventos: Evento[]
    itens: ItemMonitorado[]
    equipamentos: Equipamento[]
    ocorrencias: OcorrenciaParaResumo[]
  },
  periodo: { tipo: TipoPeriodo; chave: string },
  hoje: string,
): ResumoPeriodo {
  const meses = mesesDoPeriodo(periodo.tipo, periodo.chave, hoje)

  let horasMotor = 0
  let totalGastosCentavos = 0
  let saidas = 0
  let aVencer: { nome: string; quando: string }[] = []
  const evolucaoMensal = meses.map((mes) => {
    const r = resumoDoMes(dados, mes)
    horasMotor += r.horasMotor
    totalGastosCentavos += r.totalGastosCentavos
    saidas += r.saidas
    aVencer = r.aVencer // fica com o do ultimo laco: e o mes seguinte ao FIM do periodo
    return { mes, rotulo: nomeMesExtenso(mes), horasMotor: r.horasMotor, gastosCentavos: r.totalGastosCentavos, saidas: r.saidas }
  })

  // Janela [primeiro mes, fim exclusivo) do periodo, como string ISO —
  // comparacao lexica funciona porque "AAAA-MM-DD" e largura fixa.
  const fimExclusivo = meses.length > 0 ? mesSeguinte(meses[meses.length - 1]) : null
  const noPeriodo = (dataISO: string): boolean =>
    meses.length > 0 && dataISO >= `${meses[0]}-01` && dataISO < `${fimExclusivo}-01`

  const eventosNoPeriodo = dados.eventos.filter((e) => noPeriodo(e.data))
  const totalDiario = eventosNoPeriodo.length
  const manutencoesRealizadas = eventosNoPeriodo.filter((e) => e.tipo === "manutencao").length
  const eventosAbastecimento = eventosNoPeriodo.filter((e) => e.tipo === "abastecimento")
  const abastecimentos = {
    quantidade: eventosAbastecimento.length,
    totalCentavos: eventosAbastecimento.reduce((s, e) => s + (e.custo_centavos ?? 0), 0),
  }

  const equipamentoPorId = new Map(dados.equipamentos.map((e) => [e.id, e]))
  const gastosMap = new Map<string, number>()
  for (const e of eventosNoPeriodo) {
    const custo = e.custo_centavos ?? 0
    if (custo <= 0) continue
    const grupo = grupoDoEvento({
      tipo: e.tipo,
      categoria: e.categoria,
      custoCentavos: e.custo_centavos,
      tipoEquipamento: e.equipamento_id ? equipamentoPorId.get(e.equipamento_id)?.tipo ?? null : null,
    })
    gastosMap.set(grupo, (gastosMap.get(grupo) ?? 0) + custo)
  }
  const gastosPorGrupo = [...gastosMap.entries()]
    .map(([grupo, totalCentavos]) => ({ grupo, totalCentavos }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos)

  // Timestamptz -> data de calendario por corte simples (UTC): suficiente
  // pra classificar "em qual mes isso caiu" num relatorio (nao e alerta de
  // seguranca que precisa do fuso exato de SP como `hojeISO`).
  const ocorrenciasAbertasNoPeriodo = dados.ocorrencias.filter((o) => noPeriodo(o.created_at.slice(0, 10))).length
  const ocorrenciasResolvidasNoPeriodo = dados.ocorrencias.filter(
    (o) => o.resolvida_em != null && noPeriodo(o.resolvida_em.slice(0, 10)),
  ).length

  const hubs: HubResumo[] = HUBS_RESUMO.map((aba) => {
    const itensDoHub = dados.itens.filter((i) => abaDoItem(i, dados.equipamentos) === (aba as Aba))
    let ok = 0
    let atencao = 0
    let vencido = 0
    let semInformacao = 0
    for (const i of itensDoHub) {
      const eq = dados.equipamentos.find((e) => e.id === i.equipamento_id)
      const horasAtuais = eq?.horas_atuais ?? null
      const calc = itemMonitoradoToItemCalc(i)
      if (!temInformacaoSuficiente(calc, horasAtuais)) {
        semInformacao++
        continue
      }
      const status = calcularSemaforo(calc, horasAtuais, hoje).status
      if (status === "ok") ok++
      else if (status === "atencao") atencao++
      else vencido++
    }
    return { aba, total: itensDoHub.length, ok, atencao, vencido, semInformacao }
  })

  return {
    tipo: periodo.tipo,
    chave: periodo.chave,
    rotulo: rotuloPeriodo(periodo.tipo, periodo.chave),
    meses,
    horasMotor,
    totalGastosCentavos,
    saidas,
    totalDiario,
    manutencoesRealizadas,
    abastecimentos,
    gastosPorGrupo,
    ocorrenciasAbertasNoPeriodo,
    ocorrenciasResolvidasNoPeriodo,
    aVencer,
    evolucaoMensal,
    hubs,
  }
}

import { variacaoPercentual } from "@/lib/domain/gastos"
import type { TipoDemanda } from "@/lib/domain/marketplace"

/**
 * Financeiro (onda 42, PRD FINAL §9.1–9.3) — a aba oficial de dinheiro da
 * embarcação. Tudo aqui é função pura: quem lê o banco é `lib/acoes/financeiro.ts`
 * e as telas de `app/(app)/financeiro`.
 *
 * Duas regras do PRD que moram neste arquivo e não podem sair dele:
 *
 * 1. "O Financeiro nunca depende de integração de Hub" — por isso o
 *    lançamento se valida sozinho (`validarLancamento`), sem precisar de
 *    evento do Diário, ocorrência nem negócio fechado. O caminho vindo de
 *    um Hub é um atalho, não o caminho.
 *
 * 2. "Orçamento/proposta não é despesa. Somente gasto efetivado/confirmado
 *    pode ser registrado como despesa." — é o motivo de `STATUS_LANCAMENTO`
 *    ter só dois valores. Não existe "orçado"/"proposto": uma proposta que
 *    ninguém aceitou não entra no Financeiro de jeito nenhum, e "pendente"
 *    é a conta que a pessoa JÁ assumiu e ainda não pagou (a mensalidade da
 *    marina que vence dia 10), não um orçamento em análise.
 */

export const TIPOS_LANCAMENTO = ["despesa", "entrada"] as const
export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number]

export const ROTULO_TIPO: Record<TipoLancamento, string> = {
  despesa: "Despesa",
  entrada: "Entrada",
}

/** As 10 categorias sugeridas do PRD §9.1, na ordem em que ele as lista —
 *  a ordem vira a ordem do select, então mexer aqui muda a tela. Espelha o
 *  check constraint da migration 042; divergir faz o banco recusar o que o
 *  formulário aceitou. */
export const CATEGORIAS_FINANCEIRAS = [
  "marina_vaga", "combustivel", "manutencao", "tripulacao", "seguro",
  "documentacao_taxas", "limpeza_conservacao", "pecas_equipamentos", "transporte", "outros",
] as const
export type CategoriaFinanceira = (typeof CATEGORIAS_FINANCEIRAS)[number]

export const ROTULO_CATEGORIA: Record<CategoriaFinanceira, string> = {
  marina_vaga: "Marina/Vaga",
  combustivel: "Combustível",
  manutencao: "Manutenção",
  tripulacao: "Tripulação",
  seguro: "Seguro",
  documentacao_taxas: "Documentação/Taxas",
  limpeza_conservacao: "Limpeza/Conservação",
  pecas_equipamentos: "Peças/Equipamentos",
  transporte: "Transporte",
  outros: "Outros",
}

/** O PRD diz "forma de pagamento opcional" sem listar as opções. Lista
 *  fechada em vez de texto livre porque o campo só serve pra filtrar e
 *  conferir depois — "PIX", "pix" e "Pix" digitados à mão viram três coisas
 *  diferentes num relatório. "Outro" cobre o que faltar. */
export const FORMAS_PAGAMENTO = [
  "dinheiro", "pix", "cartao_credito", "cartao_debito", "boleto", "transferencia", "outro",
] as const
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
}

export const STATUS_LANCAMENTO = ["pago", "pendente"] as const
export type StatusLancamento = (typeof STATUS_LANCAMENTO)[number]

/** "pago/pendente ou recebido/pendente" (PRD §9.1) — é o mesmo estado com
 *  dois nomes, dependendo de o dinheiro estar saindo ou entrando. O banco
 *  guarda um só (`pago`); quem traduz pra tela é esta função. */
export function rotuloStatus(tipo: TipoLancamento, status: StatusLancamento): string {
  if (status === "pendente") return "Pendente"
  return tipo === "entrada" ? "Recebido" : "Pago"
}

/** Verbo do botão que confirma o lançamento, pela mesma régua acima. */
export function rotuloAcaoConfirmar(tipo: TipoLancamento): string {
  return tipo === "entrada" ? "Marcar como recebida" : "Marcar como paga"
}

export const FREQUENCIAS = ["semanal", "mensal", "trimestral", "semestral", "anual"] as const
export type Frequencia = (typeof FREQUENCIAS)[number]

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
}

/** Quantos meses cada frequência anda por vez. `semanal` não está aqui de
 *  propósito — semana não é fração de mês, anda por dias (ver `vencimento`). */
const MESES_POR_FREQUENCIA: Record<Exclude<Frequencia, "semanal">, number> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12,
}

function dois(n: number): string {
  return String(n).padStart(2, "0")
}

function somarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
}

/** Soma meses grudando no último dia quando o mês de destino é mais curto:
 *  31/01 + 1 mês = 28/02 (ou 29 em bissexto), não 03/03 como o `Date` faria
 *  sozinho. Importante porque vencimento de marina no dia 31 é comum. */
function somarMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number)
  const total = ano * 12 + (mes - 1) + meses
  const anoDestino = Math.floor(total / 12)
  const mesDestino = (total % 12) + 1
  const ultimoDia = new Date(Date.UTC(anoDestino, mesDestino, 0)).getUTCDate()
  return `${anoDestino}-${dois(mesDestino)}-${dois(Math.min(dia, ultimoDia))}`
}

/** A n-ésima ocorrência de uma série, SEMPRE contada a partir do início e
 *  nunca do vencimento anterior. A diferença aparece em série que começa
 *  dia 31: contando do início, 31/01 → 28/02 → 31/03; encadeando um cálculo
 *  no outro, o dia 31 se perderia no primeiro mês curto e a série inteira
 *  viraria "dia 28" pra sempre. */
export function vencimento(inicio: string, frequencia: Frequencia, n: number): string {
  if (frequencia === "semanal") return somarDias(inicio, 7 * n)
  return somarMeses(inicio, MESES_POR_FREQUENCIA[frequencia] * n)
}

export interface SerieRecorrente {
  inicio: string
  /** Último dia coberto pela série (`null` = sem fim previsto). */
  fim: string | null
  frequencia: Frequencia
}

/** Todos os vencimentos de uma série dentro de [de, ate]. Nada disso está
 *  gravado no banco: o PRD manda que "um vencimento não é automaticamente
 *  pago", então gerar linha de dívida futura que ninguém confirmou seria
 *  inventar dado. A linha só nasce quando alguém marca pago (ou muda o
 *  valor só daquele mês) — ver `lib/acoes/financeiro.ts`.
 *
 *  O teto de 600 iterações é rede de segurança contra intervalo absurdo
 *  (semanal por 20 anos = 1040): trunca a lista em vez de travar a tela. */
export function vencimentosNoIntervalo(serie: SerieRecorrente, de: string, ate: string): string[] {
  const limite = serie.fim != null && serie.fim < ate ? serie.fim : ate
  const datas: string[] = []
  for (let n = 0; n < 600; n++) {
    const d = vencimento(serie.inicio, serie.frequencia, n)
    if (d > limite) break
    if (d >= de) datas.push(d)
  }
  return datas
}

/** O próximo vencimento a partir de uma data (inclusive) — `null` quando a
 *  série já acabou. Usado no cartão da recorrente ("próximo: 10/09"). */
export function proximoVencimento(serie: SerieRecorrente, apartirDe: string): string | null {
  for (let n = 0; n < 600; n++) {
    const d = vencimento(serie.inicio, serie.frequencia, n)
    if (serie.fim != null && d > serie.fim) return null
    if (d >= apartirDe) return d
  }
  return null
}

export interface Periodo {
  de: string
  ate: string
  rotulo: string
}

const MES_EXTENSO = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })

export function periodoMensal(ano: number, mes: number): Periodo {
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const nome = MES_EXTENSO.format(new Date(Date.UTC(ano, mes - 1, 1)))
  return {
    de: `${ano}-${dois(mes)}-01`,
    ate: `${ano}-${dois(mes)}-${dois(ultimo)}`,
    rotulo: `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`,
  }
}

export function periodoAnual(ano: number): Periodo {
  return { de: `${ano}-01-01`, ate: `${ano}-12-31`, rotulo: String(ano) }
}

export function periodoPersonalizado(de: string, ate: string): Periodo {
  return { de, ate, rotulo: `${formatarDataBr(de)} a ${formatarDataBr(ate)}` }
}

export function formatarDataBr(iso: string): string {
  return iso.split("-").reverse().join("/")
}

/** O período imediatamente anterior, do mesmo tamanho — base da "comparação
 *  entre períodos" do PRD §9.3. Mês fecha com mês (não com 30 dias atrás):
 *  comparar fevereiro com "os 28 dias antes de 1º de março" daria um recorte
 *  que não bate com nenhum extrato. */
export function periodoAnterior(p: Periodo): Periodo {
  const ehMesCheio = p.de.endsWith("-01") && p.ate === fimDoMes(p.de)
  if (ehMesCheio) {
    const [ano, mes] = p.de.split("-").map(Number)
    return mes === 1 ? periodoMensal(ano - 1, 12) : periodoMensal(ano, mes - 1)
  }
  if (p.de.endsWith("-01-01") && p.ate.endsWith("-12-31") && p.de.slice(0, 4) === p.ate.slice(0, 4)) {
    return periodoAnual(Number(p.de.slice(0, 4)) - 1)
  }
  const dias = Math.round((Date.parse(`${p.ate}T00:00:00Z`) - Date.parse(`${p.de}T00:00:00Z`)) / 86_400_000) + 1
  return periodoPersonalizado(somarDias(p.de, -dias), somarDias(p.de, -1))
}

function fimDoMes(iso: string): string {
  const [ano, mes] = iso.split("-").map(Number)
  return `${ano}-${dois(mes)}-${dois(new Date(Date.UTC(ano, mes, 0)).getUTCDate())}`
}

export interface LancamentoParaResumo {
  tipo: TipoLancamento
  categoria: CategoriaFinanceira
  valorCentavos: number
  data: string
  status: StatusLancamento
  /** Veio de uma série recorrente. É o que separa "recorrentes" de
   *  "variáveis" no relatório do PRD §9.3 — sem coluna redundante, é só
   *  `recorrencia_id != null`. */
  recorrente: boolean
}

export interface TotalCategoria {
  categoria: CategoriaFinanceira
  rotulo: string
  despesasCentavos: number
  entradasCentavos: number
}

export interface ResumoFinanceiro {
  /** Só o que JÁ saiu (status pago). Conta a pagar não é dinheiro gasto —
   *  misturar as duas faria o saldo mentir. */
  despesasCentavos: number
  entradasCentavos: number
  /** entradas recebidas − despesas pagas. */
  saldoCentavos: number
  aPagarCentavos: number
  aReceberCentavos: number
  recorrentesCentavos: number
  variaveisCentavos: number
  porCategoria: TotalCategoria[]
  maiorCategoria: TotalCategoria | null
  /** Despesas pagas divididas pelos meses que o período cobre. */
  mediaMensalDespesasCentavos: number
  mesesNoPeriodo: number
  totalLancamentos: number
}

/** Quantos meses o período cobre — mínimo 1, pra média mensal nunca dividir
 *  por zero num período de poucos dias. */
export function mesesNoPeriodo(p: Periodo): number {
  const [a1, m1] = p.de.split("-").map(Number)
  const [a2, m2] = p.ate.split("-").map(Number)
  return Math.max(1, (a2 * 12 + m2) - (a1 * 12 + m1) + 1)
}

export function resumoFinanceiro(lancamentos: LancamentoParaResumo[], periodo: Periodo): ResumoFinanceiro {
  const doPeriodo = lancamentos.filter((l) => l.data >= periodo.de && l.data <= periodo.ate)
  const porCategoria = new Map<CategoriaFinanceira, TotalCategoria>()
  let despesas = 0, entradas = 0, aPagar = 0, aReceber = 0, recorrentes = 0, variaveis = 0

  for (const l of doPeriodo) {
    if (l.status === "pendente") {
      if (l.tipo === "despesa") aPagar += l.valorCentavos
      else aReceber += l.valorCentavos
      continue
    }
    if (l.tipo === "despesa") {
      despesas += l.valorCentavos
      // Recorrentes vs variáveis é sobre DESPESA (é o custo fixo do barco
      // que o dono quer enxergar); entrada recorrente entra no total de
      // entradas normalmente.
      if (l.recorrente) recorrentes += l.valorCentavos
      else variaveis += l.valorCentavos
    } else {
      entradas += l.valorCentavos
    }
    const atual = porCategoria.get(l.categoria) ?? {
      categoria: l.categoria, rotulo: ROTULO_CATEGORIA[l.categoria],
      despesasCentavos: 0, entradasCentavos: 0,
    }
    if (l.tipo === "despesa") atual.despesasCentavos += l.valorCentavos
    else atual.entradasCentavos += l.valorCentavos
    porCategoria.set(l.categoria, atual)
  }

  const lista = [...porCategoria.values()].sort((a, b) => b.despesasCentavos - a.despesasCentavos)
  const meses = mesesNoPeriodo(periodo)

  return {
    despesasCentavos: despesas,
    entradasCentavos: entradas,
    saldoCentavos: entradas - despesas,
    aPagarCentavos: aPagar,
    aReceberCentavos: aReceber,
    recorrentesCentavos: recorrentes,
    variaveisCentavos: variaveis,
    porCategoria: lista,
    // "Maior categoria" (PRD §9.3) é sobre gasto — categoria só com entrada
    // não disputa esse posto, senão o cartão diria "sua maior categoria é
    // Outros" apontando pra uma receita.
    maiorCategoria: lista.length > 0 && lista[0].despesasCentavos > 0 ? lista[0] : null,
    mediaMensalDespesasCentavos: Math.round(despesas / meses),
    mesesNoPeriodo: meses,
    totalLancamentos: doPeriodo.length,
  }
}

export interface ComparacaoPeriodos {
  despesasPercentual: number | null
  entradasPercentual: number | null
  despesasDiferencaCentavos: number
  entradasDiferencaCentavos: number
}

/** Comparação entre períodos (PRD §9.3). Reaproveita `variacaoPercentual`
 *  de `gastos.ts` — mesma regra de honestidade da onda 16: sem os dois lados
 *  com valor real, o percentual não aparece (null), nunca uma conta contra
 *  zero que mostraria "+∞%" ou "+100%" sem significado. */
export function compararPeriodos(atual: ResumoFinanceiro, anterior: ResumoFinanceiro): ComparacaoPeriodos {
  return {
    despesasPercentual: variacaoPercentual(atual.despesasCentavos, anterior.despesasCentavos),
    entradasPercentual: variacaoPercentual(atual.entradasCentavos, anterior.entradasCentavos),
    despesasDiferencaCentavos: atual.despesasCentavos - anterior.despesasCentavos,
    entradasDiferencaCentavos: atual.entradasCentavos - anterior.entradasCentavos,
  }
}

export interface DadosLancamento {
  descricao: string | null
  valorCentavos: number | null
  data: string | null
  categoria: string | null
  tipo: string | null
}

export type Validacao = { ok: true } | { ok: false; erro: string }

/** Mensagem de erro diz O QUE FAZER (voz do app, docs/CONTRIBUTING.md), não
 *  só que deu errado. */
export function validarLancamento(d: DadosLancamento): Validacao {
  if (!(TIPOS_LANCAMENTO as readonly string[]).includes(d.tipo ?? "")) {
    return { ok: false, erro: "Escolha se é uma despesa ou uma entrada." }
  }
  if (!d.descricao || d.descricao.trim() === "") {
    return { ok: false, erro: "Descreva o lançamento — ex.: “Vaga molhada de agosto”." }
  }
  if (!(CATEGORIAS_FINANCEIRAS as readonly string[]).includes(d.categoria ?? "")) {
    return { ok: false, erro: "Escolha uma categoria." }
  }
  if (d.valorCentavos == null || d.valorCentavos <= 0) {
    return { ok: false, erro: "Informe um valor maior que zero (ex.: 1.850,00)." }
  }
  if (!d.data || !/^\d{4}-\d{2}-\d{2}$/.test(d.data)) {
    return { ok: false, erro: "Informe a data do lançamento." }
  }
  return { ok: true }
}

export function validarRecorrente(d: DadosLancamento & { frequencia: string | null; fim: string | null }): Validacao {
  const base = validarLancamento(d)
  if (!base.ok) return base
  if (!(FREQUENCIAS as readonly string[]).includes(d.frequencia ?? "")) {
    return { ok: false, erro: "Escolha de quanto em quanto tempo isso se repete." }
  }
  if (d.fim != null && d.data != null && d.fim < d.data) {
    return { ok: false, erro: "A data final não pode ser antes do primeiro vencimento." }
  }
  return { ok: true }
}

/**
 * Categoria financeira de um evento do Diário que tem custo. Espelha
 * exatamente o `case` da migração de dados na migration 042 — se os dois
 * divergirem, o gasto migrado e o gasto novo do mesmo tipo cairiam em
 * categorias diferentes e o relatório ficaria incoerente com o histórico.
 * Quando o evento não diz o suficiente sobre si, cai em "Outros" em vez de
 * chutar (o dono corrige em um toque na tela do lançamento).
 */
export function categoriaFinanceiraDoEvento(e: { tipo: string; categoria: string | null }): CategoriaFinanceira {
  if (e.categoria === "documento") return "documentacao_taxas"
  if (e.categoria != null && ["deck", "fibra", "inox", "vidros", "estofados", "casco_outros"].includes(e.categoria)) {
    return "limpeza_conservacao"
  }
  if (e.categoria != null && e.categoria.startsWith("motor_")) return "manutencao"
  if (e.tipo === "abastecimento") return "combustivel"
  if (["manutencao", "avaria", "docagem"].includes(e.tipo)) return "manutencao"
  return "outros"
}

/**
 * PONTE MARKETPLACE → FINANCEIRO (onda 53, PRD §11.6: "Após confirmação
 * bilateral, liberar avaliação e oferecer 'Adicionar ao Financeiro'").
 *
 * Em que categoria cai um negócio fechado, a partir do tipo da demanda. Os
 * cinco tipos do §11.1 são todos o dono GASTANDO — por isso o lançamento
 * nascido daqui é sempre `despesa`, nunca entrada, e não existe função
 * espelho pro fornecedor: o Commander Partner não tem embarcação, e o
 * Financeiro é da embarcação (§9.1).
 *
 * Sem `default` de propósito: acrescentar um sexto tipo de demanda quebra a
 * build aqui, e é exatamente onde alguém precisa parar pra decidir em que
 * categoria ele cai — em vez de descobrir meses depois que tudo virou
 * "Outros" no relatório.
 */
export function categoriaFinanceiraDaDemanda(tipo: TipoDemanda): CategoriaFinanceira {
  switch (tipo) {
    // Serviço de profissional (eletricista, mecânico, pintor) é manutenção do
    // barco — a mesma categoria que o gasto equivalente lançado à mão.
    case "profissional":
      return "manutencao"
    case "tripulacao":
      return "tripulacao"
    // "Compro / Procuro" é sempre coisa física pro barco (§11.1: rádio VHF,
    // peça, equipamento).
    case "produto":
      return "pecas_equipamentos"
    case "vaga_embarcacao":
      return "marina_vaga"
    // Caminhão-tanque = abastecimento. O frete/deslocamento vai junto porque
    // é parte do preço daquele abastecimento, não um gasto de transporte do
    // dono (a categoria "Transporte" é pra quando o BARCO se desloca).
    case "caminhao":
      return "combustivel"
  }
}

/** Valor digitado em pt-BR → centavos. `null` quando não é número válido —
 *  quem chama decide a mensagem. */
export function centavosDeReais(reais: number | null): number | null {
  if (reais == null || !Number.isFinite(reais) || reais < 0) return null
  return Math.round(reais * 100)
}

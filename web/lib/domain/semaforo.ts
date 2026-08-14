export type StatusFarol = "ok" | "atencao" | "vencido"

export interface ItemCalc {
  intervaloHoras: number | null
  intervaloMeses: number | null
  dataFixa: string | null
  ultimoCicloData: string | null
  ultimoCicloHoras: number | null
}

export interface ResultadoCalc {
  status: StatusFarol
  horasRestantes: number | null
  diasRestantes: number | null
}

export const MARGEM_DIAS = 30 // documentos/datas: atenção a 30 dias (espec §4.1)
const MARGEM_HORAS_PCT = 0.15 // horas: atenção nos últimos 15% do intervalo (espec §4.1)

function paraUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const total = y * 12 + (m - 1) + meses
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const ultimoDia = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, ultimoDia)
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`
}

function diffDias(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000)
}

export const PESO: Record<StatusFarol, number> = { ok: 0, atencao: 1, vencido: 2 }

/** Vencimento por data de um item: data fixa, ou ultimo ciclo + intervalo em meses.
 *  E a MESMA regra do farol — quem listar vencimentos (relatorio mensal) usa esta
 *  funcao para nunca divergir da tela. */
export function vencimentoPorData(item: ItemCalc): string | null {
  return (
    item.dataFixa ??
    (item.intervaloMeses != null && item.ultimoCicloData != null
      ? somarMeses(item.ultimoCicloData, item.intervaloMeses)
      : null)
  )
}

export function calcularSemaforo(item: ItemCalc, horasAtuais: number | null, hoje: string): ResultadoCalc {
  let statusHoras: StatusFarol | null = null
  let horasRestantes: number | null = null
  if (item.intervaloHoras != null && item.ultimoCicloHoras != null && horasAtuais != null) {
    horasRestantes = item.ultimoCicloHoras + item.intervaloHoras - horasAtuais
    if (horasRestantes < 0) statusHoras = "vencido"
    else if (horasRestantes <= item.intervaloHoras * MARGEM_HORAS_PCT) statusHoras = "atencao"
    else statusHoras = "ok"
  }

  let statusData: StatusFarol | null = null
  let diasRestantes: number | null = null
  const vencimento = vencimentoPorData(item)
  if (vencimento != null) {
    diasRestantes = diffDias(hoje, vencimento)
    if (diasRestantes < 0) statusData = "vencido"
    else if (diasRestantes <= MARGEM_DIAS) statusData = "atencao"
    else statusData = "ok"
  }

  const candidatos = [statusHoras, statusData].filter((s): s is StatusFarol => s != null)
  const status = candidatos.length === 0 ? "ok" : candidatos.sort((a, b) => PESO[b] - PESO[a])[0]
  return { status, horasRestantes, diasRestantes }
}

/** Data de calendário curta ("2026-08-20" -> "20/08") pra complementar a
 *  contagem relativa (dias/horas) — o dono quer saber QUANDO, não só
 *  "faltam quantos dias". Não recalcula nada: só formata o que
 *  vencimentoPorData já devolveu. */
export function formatarDataCurta(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

export function textoRestante(r: ResultadoCalc): string {
  const h = r.horasRestantes
  const d = r.diasRestantes
  if (h != null && h < 0) return `vencido há ${Math.round(-h)} h`
  if (d != null && d < 0) return `vencido há ${-d} dias`
  const partes: string[] = []
  if (h != null) partes.push(`${Math.round(h)} h`)
  if (d != null) partes.push(`${d} dias`)
  return partes.length > 0 ? `em ${partes.join(" ou ")}` : ""
}

/** Versão de uma linha só de `textoRestante`, pro hero de /hoje e pra lista
 *  de "Manutenção próxima" (mockup do Pedro: "37h restantes", não "em 37 h
 *  ou 298 dias" — ali sobra espaço, aqui não). Quando os dois prazos
 *  existem, horas manda: é o dado mais preciso pra motor (fração direta do
 *  intervalo), dias é a margem mais grosseira de documento/data. */
export function textoRestanteCompacto(r: ResultadoCalc): string {
  if (r.horasRestantes != null) {
    return r.horasRestantes < 0
      ? `vencido há ${Math.round(-r.horasRestantes)} h`
      : `${Math.round(r.horasRestantes)}h restantes`
  }
  if (r.diasRestantes != null) {
    return r.diasRestantes < 0
      ? `vencido há ${-r.diasRestantes} dias`
      : `${r.diasRestantes} dias restantes`
  }
  return "—"
}

/** Versão MÍNIMA pro grid de mini-métricas do hero de /hoje (3 colunas de
 *  ~120px): "500h restantes" truncava em "500h restan…" no aparelho (visto
 *  no QA do emulador, onda 16) — aqui o rótulo da métrica ("Próxima
 *  revisão") já carrega o contexto, então só o número basta. Vencido
 *  mantém a palavra: é a informação mais importante da tela. */
export function textoRestanteHero(r: ResultadoCalc): string {
  if (r.horasRestantes != null) {
    return r.horasRestantes < 0 ? `vencido ${Math.round(-r.horasRestantes)}h` : `${Math.round(r.horasRestantes)}h`
  }
  if (r.diasRestantes != null) {
    return r.diasRestantes < 0 ? `vencido ${-r.diasRestantes}d` : `${r.diasRestantes} dias`
  }
  return "—"
}

/** Um item só entra no cálculo do anel de completude de /hoje quando há
 *  dado real por trás do status: motor com intervalo + último ciclo +
 *  leitura atual, OU uma data de vencimento (fixa, ou por ciclo + meses).
 *  Espelha os mesmos candidatos que `calcularSemaforo` avalia internamente
 *  — exposta à parte porque quem soma o anel precisa distinguir um "ok" de
 *  verdade de um "ok" só por ausência de dado (regra de honestidade da
 *  onda 16: item sem informação não conta nem a favor nem contra). */
export function temInformacaoSuficiente(item: ItemCalc, horasAtuais: number | null): boolean {
  const temHoras = item.intervaloHoras != null && item.ultimoCicloHoras != null && horasAtuais != null
  const temData = vencimentoPorData(item) != null
  return temHoras || temData
}

/* A fórmula da nota de Saúde da Embarcação (o anel de /hoje) NÃO mora mais
 * aqui — decisão de produto fechada em 14/08/2026 (dono delegou depois do
 * achado da auditoria, `docs/auditoria/2026-08-14-prd-upgrade2-parte1.md`
 * §10). Ver `lib/domain/saude.ts` (`calcularSaudeEmbarcacao`) para os pesos,
 * a justificativa de cada um e os testes. `temInformacaoSuficiente` acima
 * continua sendo o insumo — cada item avaliado por `calcularSemaforo` entra
 * na saúde só quando este helper diz que há dado real por trás. */

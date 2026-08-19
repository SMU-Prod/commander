/**
 * AFAZERES E IMPORTAÇÃO DE FROTA (onda 77).
 * PRD-UPGRADE-3-COTAS §20 e §21.
 *
 * ---------------------------------------------------------------------------
 * UMA CORREÇÃO AO PRD, REGISTRADA
 * ---------------------------------------------------------------------------
 * O §20 abre com "Reaproveitar módulo de Afazeres JÁ EXISTENTE, adaptado ao
 * Enterprise". Não existe módulo de Afazeres no Commander — nunca existiu.
 * Isto aqui é construção, não adaptação. Vale dizer porque a diferença muda a
 * estimativa de quem ler o PRD sem abrir o código.
 *
 * Módulo puro.
 */

// ---------------------------------------------------------------------------
// §20 — Afazeres
// ---------------------------------------------------------------------------

export const ESTADOS_AFAZER = ["aberto", "em_andamento", "concluido"] as const
export type EstadoAfazer = (typeof ESTADOS_AFAZER)[number]

export const ROTULO_ESTADO_AFAZER: Record<EstadoAfazer, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
}

/** Para quem a tarefa pode ser criada (§20: "ADM pode criar tarefa para
 *  Operações/Mecânica"). */
export const DESTINOS_AFAZER = ["operacoes", "mecanica", "qualquer"] as const
export type DestinoAfazer = (typeof DESTINOS_AFAZER)[number]

export const ROTULO_DESTINO_AFAZER: Record<DestinoAfazer, string> = {
  operacoes: "Operações",
  mecanica: "Mecânica",
  qualquer: "Qualquer um da equipe",
}

/**
 * §20: *"Operações pode criar tarefa própria SOMENTE SE AUTORIZADO."*
 *
 * A autorização é a mesma régua de confiança do §3 — quem está em
 * `sem_aprovacao` cria direto; quem não está, o ADM cria por ele. Reusar a
 * régua existente em vez de inventar uma permissão nova é o que impede o
 * Enterprise de ter dois sistemas de confiança concorrentes.
 */
export function podeCriarAfazerProprio(
  papel: string,
  modoAprovacao: string,
): boolean {
  if (papel === "ADM" || papel === "ADM_GERAL" || papel === "PROP") return true
  if (papel === "OPERACOES" || papel === "MECANICA") return modoAprovacao === "sem_aprovacao"
  return false
}

/*
 * §20, a última linha e a mais importante: *"NÃO GERAR AUTOMATICAMENTE uma
 * tarefa para cada alerta."*
 *
 * O motivo é operacional e conhecido: uma frota de 40 unidades com semáforo
 * de manutenção produz dezenas de alertas por semana. Virar tarefa
 * automaticamente encheria a lista de Afazeres de coisa que ninguém aceitou
 * fazer — e uma lista que ninguém confia é uma lista que ninguém abre.
 *
 * Alerta é aviso; afazer é compromisso. A conversão existe, mas passa por
 * alguém: `converterEmAfazer` recebe a decisão, não a deduz.
 *
 * AUDITORIA 19/08: aqui existia `alertaViraAfazerAutomaticamente(): false`,
 * sem nenhum consumidor fora do próprio teste. Ela não IMPEDIA nada — quem
 * garante a regra é não haver gatilho nenhum ligando alerta a esta tabela, e
 * isso um `expect(...).toBe(false)` não mede. Apagada pelo mesmo motivo que a
 * onda 57 apagou `rotuloDoSelo`: garantia medida num galho que não roda dá a
 * impressão de que existe trava onde só existe prosa. A prosa fica; ela é
 * honesta sobre ser prosa.
 */

/** A conversão manual do §20 ("manutenção/avaria pode ser convertida em
 *  afazer"). Recebe o título do que originou e devolve o afazer pronto. */
export function converterEmAfazer(
  origem: { tipo: "manutencao" | "avaria"; titulo: string },
  destino: DestinoAfazer,
): { titulo: string; destino: DestinoAfazer } {
  const prefixo = origem.tipo === "avaria" ? "Resolver" : "Executar"
  return { titulo: `${prefixo}: ${origem.titulo}`.trim(), destino }
}

// ---------------------------------------------------------------------------
// §21 — importação de frota
// ---------------------------------------------------------------------------

/** Os campos mínimos que o §21 sugere para a planilha. */
export const COLUNAS_IMPORTACAO = [
  "nome", "tipo", "marca", "modelo", "ano", "serial", "horas", "proxima_revisao",
] as const

export type ColunaImportacao = (typeof COLUNAS_IMPORTACAO)[number]

export interface LinhaImportada {
  linha: number
  nome: string | null
  tipo: string | null
  marca: string | null
  modelo: string | null
  ano: number | null
  serial: string | null
  horas: number | null
}

export interface ResultadoValidacao {
  validas: LinhaImportada[]
  erros: { linha: number; problema: string }[]
}

/**
 * DA PLANILHA COLADA PARA AS LINHAS QUE O VALIDADOR ENTENDE.
 *
 * AUDITORIA 19/08, A9: `validarImportacao` e companhia existiam, com 11 casos
 * de teste, e não havia por onde entrar — nem página, nem upload, nem action.
 * Faltava este pedaço: o que a administradora TEM na mão é uma planilha, e o
 * que ela consegue fazer sem instalar nada é selecionar tudo e colar.
 *
 * Colar em vez de subir arquivo é decisão, não atalho: aceitar `.xlsx` pediria
 * uma biblioteca de leitura de planilha binária no servidor para resolver um
 * problema que Ctrl+C resolve — e o Excel, o Google Sheets e o Numbers todos
 * colam TSV. O que sai do Ctrl+C já é o formato.
 *
 * O separador é DETECTADO e não perguntado. Brasil usa vírgula decimal, então
 * um CSV brasileiro vem com `;`; a colagem direta vem com tabulação; e um
 * arquivo exportado em inglês vem com `,`. Perguntar isso a quem quer
 * cadastrar 40 barcos seria a primeira das quarenta desistências.
 *
 * O número da linha é o da planilha COM cabeçalho contado — é o que a pessoa
 * enxerga no Excel. Um erro em "linha 7" que aponte para a linha 6 da tela é
 * pior que não numerar.
 */
export function lerPlanilha(colado: string): LinhaImportada[] {
  const linhas = colado.split(/\r?\n/)
  const primeiraComTexto = linhas.findIndex((l) => l.trim() !== "")
  if (primeiraComTexto === -1) return []

  const separador = detectarSeparador(linhas[primeiraComTexto])
  const cabecalho = mapearCabecalho(linhas[primeiraComTexto].split(separador))
  // Sem cabeçalho reconhecível, a ordem é a de `COLUNAS_IMPORTACAO` e a
  // primeira linha já é dado — quem colou só os valores não fica de fora.
  const ordem = cabecalho ?? [...COLUNAS_IMPORTACAO]
  const primeiraDeDados = cabecalho ? primeiraComTexto + 1 : primeiraComTexto

  const saida: LinhaImportada[] = []
  for (let i = primeiraDeDados; i < linhas.length; i++) {
    if (linhas[i].trim() === "") continue
    const celulas = linhas[i].split(separador).map((c) => c.trim().replace(/^"|"$/g, ""))
    const valor = (coluna: ColunaImportacao): string | null => {
      const pos = ordem.indexOf(coluna)
      if (pos === -1) return null
      return celulas[pos]?.trim() || null
    }
    saida.push({
      linha: i + 1,
      nome: valor("nome"),
      tipo: valor("tipo"),
      marca: valor("marca"),
      modelo: valor("modelo"),
      ano: inteiro(valor("ano")),
      serial: valor("serial"),
      horas: decimal(valor("horas")),
    })
  }
  return saida
}

/** Tabulação, `;` ou `,` — o que aparecer mais na primeira linha. Empate vai
 *  pra tabulação, que é o que a colagem direta produz. */
function detectarSeparador(linha: string): string {
  const candidatos = ["\t", ";", ","]
  let melhor = "\t"
  let maior = 0
  for (const c of candidatos) {
    const n = linha.split(c).length - 1
    if (n > maior) { maior = n; melhor = c }
  }
  return melhor
}

/**
 * O cabeçalho, quando existe. `null` quando a primeira linha já é dado.
 *
 * Reconhece pelo menos DUAS colunas conhecidas antes de aceitar que é
 * cabeçalho: uma frota real pode ter uma unidade chamada "Modelo 3", e tratar
 * essa linha como título perderia um barco em silêncio.
 */
function mapearCabecalho(celulas: readonly string[]): ColunaImportacao[] | null {
  const mapeadas = celulas.map((c) => {
    const chave = c.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
    // Os apelidos que a planilha do cliente traz de verdade.
    const apelidos: Record<string, ColunaImportacao> = {
      nome: "nome", unidade: "nome", embarcacao: "nome", barco: "nome",
      tipo: "tipo", marca: "marca", fabricante: "marca",
      modelo: "modelo", ano: "ano",
      serial: "serial", numeroserie: "serial", numerodeserie: "serial", chassi: "serial",
      horas: "horas", horimetro: "horas", horasatuais: "horas",
      proximarevisao: "proxima_revisao",
    }
    return apelidos[chave] ?? null
  })
  const reconhecidas = mapeadas.filter(Boolean).length
  return reconhecidas >= 2 ? (mapeadas as ColunaImportacao[]) : null
}

function inteiro(bruto: string | null): number | null {
  if (!bruto) return null
  const n = Number.parseInt(bruto.replace(/[^\d-]/g, ""), 10)
  return Number.isFinite(n) ? n : null
}

/** Aceita "1.234,5" e "1234.5" — a mesma planilha vem dos dois jeitos
 *  conforme a máquina que exportou. */
function decimal(bruto: string | null): number | null {
  if (!bruto) return null
  const limpo = bruto.replace(/\s/g, "")
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/**
 * Valida a planilha ANTES de gravar qualquer coisa.
 *
 * Duas decisões que importam numa importação de 40 unidades:
 *
 *   O ÚNICO CAMPO OBRIGATÓRIO É O NOME. É o mesmo que o onboarding pede
 *   para uma embarcação avulsa — exigir mais na importação faria a empresa
 *   grande ter mais trabalho que a pequena, que é o oposto do §21 ("evitar
 *   cadastro manual em empresas grandes"). O resto o ADM completa depois,
 *   no fluxo normal de configuração que o próprio §21 prevê.
 *
 *   NOME REPETIDO É ERRO, não silêncio. Duas unidades "Jet 01" na mesma
 *   frota tornam impossível saber qual saiu do pátio — e o erro aponta a
 *   linha, porque numa planilha de 40 linhas "nome duplicado" sem número é
 *   inútil.
 */
export function validarImportacao(linhas: readonly LinhaImportada[]): ResultadoValidacao {
  const validas: LinhaImportada[] = []
  const erros: { linha: number; problema: string }[] = []
  const vistos = new Map<string, number>()

  for (const l of linhas) {
    const nome = l.nome?.trim()
    if (!nome) {
      erros.push({ linha: l.linha, problema: "Sem nome da unidade." })
      continue
    }
    const chave = nome.toLocaleLowerCase("pt-BR")
    const antes = vistos.get(chave)
    if (antes != null) {
      erros.push({ linha: l.linha, problema: `Nome repetido — já apareceu na linha ${antes}.` })
      continue
    }
    if (l.ano != null && (l.ano < 1900 || l.ano > 2100)) {
      erros.push({ linha: l.linha, problema: `Ano fora do razoável (${l.ano}).` })
      continue
    }
    if (l.horas != null && l.horas < 0) {
      erros.push({ linha: l.linha, problema: "Horas negativas." })
      continue
    }
    vistos.set(chave, l.linha)
    validas.push({ ...l, nome })
  }

  return { validas, erros }
}

/**
 * A frase do resumo antes de confirmar.
 *
 * Diz os dois números sempre, inclusive quando não há erro — "40 unidades
 * prontas para importar" é a confirmação que a pessoa precisa antes de
 * apertar o botão numa operação que cria 40 registros de uma vez.
 */
export function resumoDaImportacao(r: ResultadoValidacao): string {
  const n = r.validas.length
  const e = r.erros.length
  const base = n === 1 ? "1 unidade pronta para importar" : `${n} unidades prontas para importar`
  if (e === 0) return `${base}.`
  return `${base} · ${e === 1 ? "1 linha com problema" : `${e} linhas com problema`}.`
}

/** Importação que não traz nada aproveitável — a tela diz isso em vez de
 *  mostrar um botão "Importar 0 unidades". */
export function importacaoVazia(r: ResultadoValidacao): boolean {
  return r.validas.length === 0
}

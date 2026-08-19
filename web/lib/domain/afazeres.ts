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

/**
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
 */
export function alertaViraAfazerAutomaticamente(): false {
  return false
}

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

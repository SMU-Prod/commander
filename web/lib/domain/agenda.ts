import type { Permissoes } from "@/lib/domain/permissoes"
import { podeEditar, podeVer } from "@/lib/domain/permissoes"
import type { StatusFarol } from "@/lib/domain/semaforo"

/**
 * AGENDA (onda 43, PRD FINAL §8) — a regra pura por trás de `/agenda`.
 *
 * O que o PRD decide, e este arquivo obedece:
 * - "o usuário não 'cria uma agenda', cria eventos/compromissos" — não
 *   existe entidade "agenda" em lugar nenhum, nem no banco nem aqui. O que
 *   existe é COMPROMISSO (`agenda_eventos`, migration 044) e a agenda é só
 *   o recorte "os meus + os que compartilharam comigo".
 * - "Agenda normal mostra somente eventos criados pelo usuário ou
 *   compartilhados com ele" — quem garante isso é a RLS (migration 044);
 *   este domínio nunca recebe evento de terceiro pra filtrar.
 * - "Agenda Detalhada adiciona camadas técnicas/operacionais... com
 *   filtros" — camadas são DERIVADAS do que o app já tem
 *   (`itens_monitorados` com vencimento, `documentos` com validade,
 *   ocorrências em aberto). Nada é duplicado: some o item, some da agenda.
 * - "Histórico de coisas já realizadas não polui a Agenda normal" —
 *   `concluido_em` tira da lista sem apagar (`ehHistorico` abaixo).
 *
 * Nota de vocabulário, porque vai confundir alguém: `eventos` no banco é o
 * DIÁRIO DE BORDO (o que aconteceu). A Agenda é `agenda_eventos` (o que
 * está marcado). Ver o cabeçalho da migration 044.
 */

// ---------------------------------------------------------------------
// Visualizações — PRD §8: "Mês, Semana e Lista". Três, nem mais nem menos.
// ---------------------------------------------------------------------
export const VISUALIZACOES = ["mes", "semana", "lista"] as const
export type Visualizacao = (typeof VISUALIZACOES)[number]

export const ROTULO_VISUALIZACAO: Record<Visualizacao, string> = {
  mes: "Mês",
  semana: "Semana",
  lista: "Lista",
}

// ---------------------------------------------------------------------
// Modos do compromisso — PRD §8: "particular, compartilhado ou atribuído
// a alguém". 'atribuido' é 'compartilhado' com um dono do recado: alguém
// tem que fazer, não é só ficar sabendo.
// ---------------------------------------------------------------------
export const VISIBILIDADES = ["particular", "compartilhado", "atribuido"] as const
export type Visibilidade = (typeof VISIBILIDADES)[number]

export const ROTULO_VISIBILIDADE: Record<Visibilidade, string> = {
  particular: "Só pra mim",
  compartilhado: "Compartilhado",
  atribuido: "Atribuído a alguém",
}

/** Texto de ajuda do formulário — explica a consequência, não repete o nome. */
export const EXPLICACAO_VISIBILIDADE: Record<Visibilidade, string> = {
  particular: "Ninguém mais vê este compromisso.",
  compartilhado: "Aparece também na agenda de quem você escolher.",
  atribuido: "Aparece na agenda de quem você escolher, marcado como responsável.",
}

export function ehCompartilhavel(v: Visibilidade): boolean {
  return v !== "particular"
}

/**
 * O modo REAL de um compromisso, lido da lista de participantes em vez do
 * campo `visibilidade`.
 *
 * Por que existe: um participante pode sair sozinho do compromisso
 * (policy "criador remove, participante sai"), e nesse caso ele NÃO tem
 * permissão de reescrever `agenda_eventos.visibilidade` — o campo ficaria
 * dizendo "Compartilhado" com a lista já vazia. Onde a lista está na mão
 * (tela de detalhe), o rótulo sai daqui e nunca mente.
 *
 * Cuidado de leitura: quem recebeu o compromisso só enxerga a PRÓPRIA
 * linha (RLS), então pra ele o resultado é "compartilhado" mesmo que sejam
 * cinco pessoas. Continua verdade — só não é a contagem.
 */
export function visibilidadeEfetiva(participantes: readonly { responsavel: boolean }[]): Visibilidade {
  if (participantes.length === 0) return "particular"
  return participantes.some((p) => p.responsavel) ? "atribuido" : "compartilhado"
}

// ---------------------------------------------------------------------
// Camadas da Agenda Detalhada — os seis nomes do PRD §8, na ordem em que
// ele os lista. Quatro têm fonte de dado hoje; 'servicos' e 'financeiro'
// dependem de módulos que ainda não existem (Financeiro §9, Marketplace
// com propostas §11 — ver docs/auditoria/2026-08-15-prd-final-vs-codigo.md
// §3). Ficam declarados aqui pra ninguém "descobrir" depois que faltavam,
// e FORA de `CAMADAS_COM_FONTE` pra tela não abrir porta de sala vazia.
// ---------------------------------------------------------------------
export const CAMADAS = [
  "manutencoes", "documentos", "seguranca", "tarefas", "servicos", "financeiro",
] as const
export type Camada = (typeof CAMADAS)[number]

export const ROTULO_CAMADA: Record<Camada, string> = {
  manutencoes: "Manutenções",
  documentos: "Documentos",
  seguranca: "Segurança",
  tarefas: "Tarefas",
  servicos: "Serviços",
  financeiro: "Financeiro",
}

export const CAMADAS_COM_FONTE = ["manutencoes", "documentos", "seguranca", "tarefas"] as const
export type CamadaComFonte = (typeof CAMADAS_COM_FONTE)[number]

export function camadaTemFonte(c: Camada): c is CamadaComFonte {
  return (CAMADAS_COM_FONTE as readonly Camada[]).includes(c)
}

/**
 * Área da matriz que governa a Agenda — PRD §8: "Captain só pode
 * criar/compartilhar eventos da embarcação se tiver permissão 'Gerenciar
 * eventos da embarcação'".
 *
 * Onda 46: agora é área PRÓPRIA. A onda 43 entregou a Agenda pegando carona
 * em 'diario' porque a matriz (`ABAS`) estava sendo alterada por outra
 * frente na mesma janela, e o TODO registrado aqui admitia a consequência:
 * um vínculo personalizado SEM 'diario' não enxergava a agenda do barco,
 * mesmo sendo a agenda dele. Com a área própria, "ver Agenda" e "gerenciar
 * eventos" viraram duas chaves nomeadas na tela de permissões.
 *
 * Ninguém perdeu acesso na troca: a migration 047 copiou o valor de 'diario'
 * pra 'agenda' em todo vínculo já gravado (mesmo padrão da 032, quando
 * 'historico' herdou de 'diario'), e as 6 policies da migration 044 passaram
 * a citar 'agenda'. Aqui e no banco, sempre a mesma área — se estas duas
 * pontas divergirem, a tela mostra um botão que a RLS rejeita.
 */
export const AREA_AGENDA = "agenda" as const

export function podeVerAgenda(p: Permissoes | null): boolean {
  return podeVer(p, AREA_AGENDA)
}

/** "Gerenciar eventos da embarcação" (PRD §8) — criar e compartilhar. */
export function podeGerenciarEventos(p: Permissoes | null): boolean {
  return podeEditar(p, AREA_AGENDA)
}

// ---------------------------------------------------------------------
// Calendário. Tudo em "AAAA-MM-DD" e aritmética em UTC — o app inteiro já
// trabalha assim (`lib/domain/datas.ts`, `hojeISO` em America/Sao_Paulo);
// somar dias em UTC nunca escorrega, e a data só é convertida pra fuso na
// hora de descobrir que dia é hoje, não aqui.
// ---------------------------------------------------------------------

/** 0 = domingo … 6 = sábado. Semana começa no domingo (calendário brasileiro). */
export function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** Domingo da semana que contém `iso`. */
export function inicioDaSemana(iso: string): string {
  return somarDias(iso, -diaDaSemana(iso))
}

/** Os 7 dias da semana que contém `iso`, de domingo a sábado. */
export function diasDaSemana(iso: string): string[] {
  const inicio = inicioDaSemana(iso)
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i))
}

export function ultimoDiaDoMes(mesISO: string): string {
  const [a, m] = mesISO.split("-").map(Number)
  const dia = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return `${mesISO}-${String(dia).padStart(2, "0")}`
}

export interface DiaGrade {
  data: string
  /** false = dia de preenchimento vindo do mês vizinho (fica apagado na tela). */
  doMes: boolean
}

/**
 * A grade do mês: semanas completas de domingo a sábado, com os dias do
 * mês vizinho preenchendo as pontas. É o que a visualização Mês desenha —
 * 7 colunas sempre, sem buraco no começo nem no fim (buraco quebra o
 * alinhamento com o cabeçalho D/S/T/Q/Q/S/S).
 */
export function gradeDoMes(mesISO: string): DiaGrade[][] {
  const inicio = inicioDaSemana(`${mesISO}-01`)
  const ultimo = ultimoDiaDoMes(mesISO)
  const fim = somarDias(ultimo, 6 - diaDaSemana(ultimo))

  const semanas: DiaGrade[][] = []
  let cursor = inicio
  while (cursor <= fim) {
    const semana: DiaGrade[] = []
    for (let i = 0; i < 7; i++) {
      semana.push({ data: cursor, doMes: cursor.slice(0, 7) === mesISO })
      cursor = somarDias(cursor, 1)
    }
    semanas.push(semana)
  }
  return semanas
}

export interface Janela {
  /** primeiro dia visível, inclusivo */
  de: string
  /** último dia visível, inclusivo */
  ate: string
}

/**
 * Faixa de datas que cada visualização precisa carregar.
 *
 * Lista não é "o resto da eternidade": vai do começo do mês âncora até 12
 * meses à frente. O começo do mês (e não "hoje") é de propósito — uma
 * ocorrência aberta semana passada continua sendo pendência e some da
 * lista se o corte for hoje. O teto de 12 meses existe pra consulta ter
 * fim; ninguém marca compromisso de barco a mais de um ano.
 */
export function janelaDaVisualizacao(v: Visualizacao, ancora: string): Janela {
  if (v === "semana") {
    const dias = diasDaSemana(ancora)
    return { de: dias[0], ate: dias[6] }
  }
  const mes = ancora.slice(0, 7)
  if (v === "mes") {
    const semanas = gradeDoMes(mes)
    return { de: semanas[0][0].data, ate: semanas[semanas.length - 1][6].data }
  }
  return { de: `${mes}-01`, ate: somarDias(`${mes}-01`, 365) }
}

// ---------------------------------------------------------------------
// Itens da agenda — compromissos criados por gente e camadas derivadas
// chegam aqui no mesmo formato, porque a tela desenha os dois do mesmo
// jeito (uma linha num dia).
// ---------------------------------------------------------------------
export interface ItemAgenda {
  /** Único na lista. Prefixado pela origem porque um compromisso e uma
   *  manutenção podem, em tese, ter o mesmo uuid vindo de tabelas
   *  diferentes. */
  chave: string
  data: string
  /** "HH:MM" ou null (compromisso de dia inteiro / vencimento sem hora). */
  hora: string | null
  titulo: string
  detalhe: string | null
  origem: "compromisso" | Camada
  href: string | null
  /** Só nas camadas derivadas — o farol que a área de origem já calcula. */
  status: StatusFarol | null
  compartilhado: boolean
  /** true = eu criei este compromisso (nas camadas derivadas é sempre false). */
  meu: boolean
  concluido: boolean
}

/** O que a página lê de `agenda_eventos` — só o que o domínio usa. */
export interface CompromissoParaAgenda {
  id: string
  titulo: string
  descricao: string | null
  data: string
  hora: string | null
  visibilidade: Visibilidade
  concluido_em: string | null
  criado_por: string | null
}

/**
 * Uma linha derivada de outra área do app (manutenção que vence, documento
 * com validade, ocorrência em aberto). Quem monta isso é a página, que já
 * calculou o farol com `calcularSemaforo` — o domínio da agenda não
 * recalcula vencimento nenhum, senão vira uma segunda fonte de verdade
 * divergindo da tela do hub (mesmo cuidado de `resumo-periodo.ts`).
 */
export interface DerivadoParaAgenda {
  id: string
  data: string
  titulo: string
  detalhe: string | null
  camada: Camada
  href: string
  status: StatusFarol
}

/** "08:00:00" (time do Postgres) -> "08:00". Null continua null. */
export function horaCurta(hora: string | null): string | null {
  return hora == null ? null : hora.slice(0, 5)
}

/**
 * "Histórico de coisas já realizadas não polui a Agenda normal" (PRD §8).
 * Concluído é histórico. Vencimento atrasado NÃO é: continua pendente, e
 * some da agenda só quando alguém resolver na área de origem.
 */
export function ehHistorico(c: Pick<CompromissoParaAgenda, "concluido_em">): boolean {
  return c.concluido_em != null
}

export function compromissoParaItem(c: CompromissoParaAgenda, usuarioId: string | null): ItemAgenda {
  return {
    chave: `compromisso:${c.id}`,
    data: c.data,
    hora: horaCurta(c.hora),
    titulo: c.titulo,
    detalhe: c.descricao,
    origem: "compromisso",
    href: `/agenda/${c.id}`,
    status: null,
    compartilhado: ehCompartilhavel(c.visibilidade),
    meu: usuarioId != null && c.criado_por === usuarioId,
    concluido: ehHistorico(c),
  }
}

export function derivadoParaItem(d: DerivadoParaAgenda): ItemAgenda {
  return {
    chave: `${d.camada}:${d.id}`,
    data: d.data,
    hora: null,
    titulo: d.titulo,
    detalhe: d.detalhe,
    origem: d.camada,
    href: d.href,
    status: d.status,
    compartilhado: false,
    meu: false,
    concluido: false,
  }
}

/** Dentro da janela, comparando string ISO (largura fixa, comparação lexical serve). */
export function naJanela(data: string, j: Janela): boolean {
  return data >= j.de && data <= j.ate
}

/** Data, depois hora (dia inteiro primeiro — abre o dia), depois título. */
export function ordenarAgenda(itens: ItemAgenda[]): ItemAgenda[] {
  return [...itens].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1
    if (a.hora !== b.hora) {
      if (a.hora == null) return -1
      if (b.hora == null) return 1
      return a.hora < b.hora ? -1 : 1
    }
    return a.titulo.localeCompare(b.titulo, "pt-BR")
  })
}

export interface DadosAgenda {
  compromissos: CompromissoParaAgenda[]
  derivados: DerivadoParaAgenda[]
}

export interface OpcoesAgenda {
  usuarioId: string | null
  janela: Janela
  /** Camadas ligadas. Vazio = Agenda normal (só compromissos). */
  camadas: readonly Camada[]
  /** "Ver o que já foi feito" — desligado por padrão (PRD: não polui). */
  incluirConcluidos?: boolean
}

/**
 * A lista final da tela. Recebe tudo pronto (a página consulta, a RLS já
 * filtrou) e só decide o que entra e em que ordem — nenhuma consulta,
 * nenhum `new Date()` escondido: `janela` e `usuarioId` chegam de fora
 * justamente pra isso ser testável sem mockar relógio nem banco.
 */
export function montarAgenda(dados: DadosAgenda, opcoes: OpcoesAgenda): ItemAgenda[] {
  const ligadas = new Set(opcoes.camadas)
  const itens: ItemAgenda[] = []

  for (const c of dados.compromissos) {
    if (!naJanela(c.data, opcoes.janela)) continue
    if (ehHistorico(c) && opcoes.incluirConcluidos !== true) continue
    itens.push(compromissoParaItem(c, opcoes.usuarioId))
  }

  for (const d of dados.derivados) {
    if (!ligadas.has(d.camada)) continue
    if (!naJanela(d.data, opcoes.janela)) continue
    itens.push(derivadoParaItem(d))
  }

  return ordenarAgenda(itens)
}

/** Índice dia -> itens daquele dia, pro Mês pintar marcador e a Semana listar. */
export function agruparPorDia(itens: ItemAgenda[]): Map<string, ItemAgenda[]> {
  const mapa = new Map<string, ItemAgenda[]>()
  for (const i of itens) {
    const doDia = mapa.get(i.data)
    if (doDia) doDia.push(i)
    else mapa.set(i.data, [i])
  }
  return mapa
}

// ---------------------------------------------------------------------
// Rótulos de data. Ficam aqui (e não na página) porque são regra de
// apresentação pura e o teste cobre a virada de mês/ano de graça.
// ---------------------------------------------------------------------
export const NOMES_DIA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const

export function rotuloMes(mesISO: string): string {
  const [a, m] = mesISO.split("-").map(Number)
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, m - 1, 1)))
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`
}

/** "sáb, 22/08" — cabeçalho de dia na Semana e na Lista. */
export function rotuloDia(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number)
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, m - 1, d)))
    .replace(".", "")
  return `${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`
}

/** Faixa da semana pro cabeçalho: "17 – 23/08". */
export function rotuloSemana(iso: string): string {
  const dias = diasDaSemana(iso)
  const [, mi, di] = dias[0].split("-")
  const [, mf, df] = dias[6].split("-")
  return mi === mf ? `${di} – ${df}/${mf}` : `${di}/${mi} – ${df}/${mf}`
}

// ---------------------------------------------------------------------
// Onda 62 (canvas tela-1h) — a Lista com a data em mono à esquerda no
// lugar do cabeçalho de dia, agrupada por período legível ("Esta semana",
// depois o nome do mês). Regras puras de apresentação, testáveis sem
// relógio.
// ---------------------------------------------------------------------

/** O bloco de data à esquerda da linha: dia com dois dígitos + dia da
 *  semana curto em minúsculas, sem ponto ("18" / "seg"). */
export function diaCompacto(iso: string): { dia: string; semana: string } {
  const [a, m, d] = iso.split("-").map(Number)
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, m - 1, d)))
    .replace(".", "")
    .toLowerCase()
  return { dia: String(d).padStart(2, "0"), semana }
}

export interface SecaoAgenda {
  rotulo: string
  itens: ItemAgenda[]
}

/** "Setembro" quando o ano é o corrente; "Janeiro de 2027" quando não é —
 *  o ano só aparece quando acrescenta informação. */
function rotuloMesSecao(mesISO: string, hoje: string): string {
  const [a, m] = mesISO.split("-").map(Number)
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, m - 1, 1)))
  const capitalizado = `${nome.charAt(0).toUpperCase()}${nome.slice(1)}`
  return mesISO.slice(0, 4) === hoje.slice(0, 4) ? capitalizado : `${capitalizado} de ${a}`
}

/**
 * Seções da Lista (canvas tela-1h): o que cai na semana corrente vira
 * "Esta semana"; o resto se agrupa pelo nome do mês. A lista chega ORDENADA
 * (`ordenarAgenda`) e o agrupamento é sequencial de propósito — a cronologia
 * manda, então um mês que começa antes da semana corrente e continua depois
 * dela aparece em duas seções com o mesmo nome, nunca fora de ordem.
 */
export function agruparPorPeriodo(itens: ItemAgenda[], hoje: string): SecaoAgenda[] {
  const semana = new Set(diasDaSemana(hoje))
  const secoes: SecaoAgenda[] = []
  for (const item of itens) {
    const rotulo = semana.has(item.data) ? "Esta semana" : rotuloMesSecao(item.data.slice(0, 7), hoje)
    const ultima = secoes[secoes.length - 1]
    if (ultima && ultima.rotulo === rotulo) ultima.itens.push(item)
    else secoes.push({ rotulo, itens: [item] })
  }
  return secoes
}

/** Rótulo curto da pílula de origem na linha da Lista (canvas tela-1h):
 *  singular, uma palavra — a pílula diz DE ONDE o item veio, o status diz a
 *  cor. "Docs" e não "Documento" segue o canvas (a pílula divide a linha com
 *  título e data; cada letra conta). */
export const ROTULO_CAMADA_PILULA: Record<CamadaComFonte, string> = {
  manutencoes: "Manutenção",
  documentos: "Docs",
  seguranca: "Segurança",
  tarefas: "Tarefa",
}

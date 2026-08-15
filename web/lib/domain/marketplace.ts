import type { NomeIcone } from "@/components/icone"
import { formatarReais } from "@/lib/domain/gastos"

/**
 * MARKETPLACE ORIENTADO POR DEMANDA (onda 45).
 * PRD `docs/prd/upgrade2-master-final.txt` §11 inteira (11.1 a 11.6) + §21.2
 * (taxonomia compartilhada com o Explorar).
 *
 * A regra toda mora aqui, pura e testável: que campos cada tipo de demanda
 * exige, como o Commander MONTA o título do anúncio (o usuário nunca digita
 * um), quando a publicação expira, quem recebe cada demanda, e qual é o
 * estado de verdade de um negócio a partir das duas declarações das partes.
 * As telas e as actions só orquestram — nenhuma delas decide nada disto.
 *
 * O que NÃO está aqui, de propósito:
 * · comissão — §11.6: "Não cobrar comissão sobre transações no Upgrade 2";
 * · gate por plano (Free/Captain Pro/Partner) — os planos ainda não estão
 *   definidos; os pontos ficam marcados em `lib/acoes/marketplace.ts`;
 * · avaliação — outra onda. Aqui fica só o fato que a libera
 *   (`avaliacaoLiberada`), calculado da confirmação bilateral.
 */

// ===========================================================================
// §11.1 — os cinco tipos de demanda
// ===========================================================================
export const TIPOS_DEMANDA = [
  "profissional",
  "tripulacao",
  "produto",
  "vaga_embarcacao",
  "caminhao",
] as const
export type TipoDemanda = (typeof TIPOS_DEMANDA)[number]

export const ROTULO_TIPO_DEMANDA: Record<TipoDemanda, string> = {
  profissional: "Preciso de profissional",
  tripulacao: "Preciso de tripulação",
  produto: "Compro / Procuro",
  vaga_embarcacao: "Vaga para embarcação",
  caminhao: "Solicitar caminhão",
}

/** Os exemplos são os do próprio PRD §11.1 — servem de âncora pra pessoa
 *  reconhecer o tipo certo sem ler definição de software. */
export const EXEMPLO_TIPO_DEMANDA: Record<TipoDemanda, string> = {
  profissional: "Preciso de eletricista em Angra",
  tripulacao: "Preciso de marinheiro sábado",
  produto: "Procuro rádio VHF",
  vaga_embarcacao: "Procuro vaga molhada para 80 pés",
  caminhao: "Preciso de 1.500 L de diesel",
}

/** Coluna "Quem recebe" da tabela do §11.1 — mostrada na tela de publicação
 *  pra ninguém publicar achando que o anúncio vai pro mundo inteiro. */
export const QUEM_RECEBE_TIPO_DEMANDA: Record<TipoDemanda, string> = {
  profissional: "Prestadores da categoria escolhida, na sua região",
  tripulacao: "Comandantes e profissionais compatíveis com a função",
  produto: "Lojas e parceiros que vendem essa categoria",
  vaga_embarcacao: "Marinas da região com porte compatível",
  caminhao: "Postos da região que fornecem esse combustível",
}

export const ICONE_TIPO_DEMANDA: Record<TipoDemanda, NomeIcone> = {
  profissional: "ferramenta",
  tripulacao: "pessoas",
  produto: "marketplace",
  vaga_embarcacao: "ancora",
  caminhao: "oleo",
}

export const STATUS_DEMANDA = ["aberta", "em_negociacao", "fechada", "cancelada"] as const
export type StatusDemanda = (typeof STATUS_DEMANDA)[number]

export const ROTULO_STATUS_DEMANDA: Record<StatusDemanda, string> = {
  aberta: "Aberta",
  em_negociacao: "Em negociação",
  fechada: "Fechada",
  cancelada: "Cancelada",
}

// ===========================================================================
// §21.2 — taxonomia padronizada (mesma do Explorar)
// ===========================================================================
export const TIPOS_TAXONOMIA = [
  "regiao",
  "categoria_servico",
  "categoria_produto",
  "funcao",
  "marca",
  "combustivel",
] as const
export type TipoTaxonomia = (typeof TIPOS_TAXONOMIA)[number]

export const ROTULO_TIPO_TAXONOMIA: Record<TipoTaxonomia, string> = {
  regiao: "Região",
  categoria_servico: "Categoria de serviço",
  categoria_produto: "Categoria de produto",
  funcao: "Função a bordo",
  marca: "Marca",
  combustivel: "Combustível",
}

export interface ItemTaxonomia {
  id: string
  tipo: TipoTaxonomia
  slug: string
  nome: string
  uf: string | null
  ordem: number
  ativo: boolean
}

/** Qual lista de categorias cada tipo de demanda usa. `profissional` puxa
 *  serviço ("Elétrica"), `produto` puxa produto ("Rádio e comunicação") — os
 *  outros três não têm categoria, o requisito deles é outro (função, porte,
 *  combustível). Retorna null quando o tipo não usa categoria, e é isso que
 *  o formulário consulta pra decidir se mostra o campo. */
export function taxonomiaDaCategoria(tipo: TipoDemanda): TipoTaxonomia | null {
  if (tipo === "profissional") return "categoria_servico"
  if (tipo === "produto") return "categoria_produto"
  return null
}

// ===========================================================================
// §11.2 — o Commander gera o título; a pessoa nunca digita um
// ===========================================================================
/** Dados mínimos pra montar o cartão — os nomes já resolvidos da taxonomia,
 *  não os ids (quem lê a tela não conhece uuid). */
export interface DemandaParaTitulo {
  tipo: TipoDemanda
  regiaoNome: string
  categoriaNome?: string | null
  funcaoNome?: string | null
  marcaNome?: string | null
  combustivelNome?: string | null
  portePes?: number | null
  tipoVaga?: "seca" | "molhada" | null
  quantidadeLitros?: number | null
  dataDesejada?: string | null
  dataFim?: string | null
}

/** "22/08" a partir de "2026-08-22". Parse manual (não `new Date`) porque
 *  `new Date("2026-08-22")` é interpretado como UTC e vira 21/08 no Brasil. */
export function formatarDiaCurto(dataISO: string): string {
  const [, mes, dia] = dataISO.split("-")
  return `${dia}/${mes}`
}

function trechoDePeriodo(dataDesejada?: string | null, dataFim?: string | null): string {
  if (dataDesejada && dataFim && dataFim !== dataDesejada) {
    return ` — ${formatarDiaCurto(dataDesejada)} a ${formatarDiaCurto(dataFim)}`
  }
  const unica = dataDesejada ?? dataFim
  return unica ? ` — ${formatarDiaCurto(unica)}` : ""
}

/**
 * §11.2: "O Commander gera o título/cartão final do anúncio a partir dos
 * campos." Não existe coluna `titulo` no banco justamente por isso: se o
 * título fosse gravado, renomear uma categoria no Admin deixaria anúncios
 * antigos exibindo um nome que não existe mais. Aqui ele é sempre derivado
 * do estado atual dos campos.
 *
 * A observação da pessoa NUNCA entra no título — §11.2 é explícito: "Texto
 * livre é apenas observação curta complementar".
 */
export function tituloDaDemanda(d: DemandaParaTitulo): string {
  const periodo = trechoDePeriodo(d.dataDesejada, d.dataFim)
  switch (d.tipo) {
    case "profissional":
      return `Serviço de ${d.categoriaNome ?? "profissional"} em ${d.regiaoNome}${periodo}`
    case "tripulacao":
      return `${d.funcaoNome ?? "Tripulação"} em ${d.regiaoNome}${periodo}`
    case "produto": {
      const marca = d.marcaNome ? ` ${d.marcaNome}` : ""
      return `Compro ${d.categoriaNome ?? "produto náutico"}${marca} — ${d.regiaoNome}`
    }
    case "vaga_embarcacao": {
      const vaga = d.tipoVaga === "seca" ? "seca" : "molhada"
      const porte = d.portePes != null ? ` para ${d.portePes} pés` : ""
      return `Vaga ${vaga}${porte} em ${d.regiaoNome}${periodo}`
    }
    case "caminhao": {
      const litros = d.quantidadeLitros != null ? `${d.quantidadeLitros.toLocaleString("pt-BR")} L` : "Abastecimento"
      return `${litros} de ${d.combustivelNome ?? "combustível"} em ${d.regiaoNome}${periodo}`
    }
  }
}

// ===========================================================================
// §11.2 — expiração
// ===========================================================================
/** "Publicações sem data específica podem expirar por padrão em 30 dias"
 *  (§11.2). Trinta é o padrão do PRD, não um número escolhido aqui. */
export const DIAS_PADRAO_EXPIRACAO = 30

function somarDiasSP(dataISO: string, dias: number): string {
  const base = new Date(dataISO)
  const alvo = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(alvo)
}

/**
 * §11.2: "Publicações sem data específica podem expirar por padrão em 30
 * dias; quando existe data/período, usar o próprio prazo da demanda."
 * Ou seja: a demanda de sábado morre no sábado, não daqui a um mês — quem
 * responder na terça seguinte só perde tempo dos dois lados.
 */
export function calcularExpiracao(
  criadoEmISO: string,
  dataDesejada: string | null,
  dataFim: string | null,
): string {
  const prazoProprio = dataFim ?? dataDesejada
  if (prazoProprio) return prazoProprio
  return somarDiasSP(criadoEmISO, DIAS_PADRAO_EXPIRACAO)
}

/** Expirar é comparação com o dia de hoje, não um estado gravado — não
 *  existe status 'expirada' no banco. Datas em "AAAA-MM-DD" comparam
 *  corretamente como texto. */
export function demandaExpirada(expiraEm: string, hojeISO: string): boolean {
  return expiraEm < hojeISO
}

/** Dias que faltam (0 = vence hoje, negativo = já venceu). Usado no aviso
 *  "vence em 3 dias" do cartão. */
export function diasAteExpirar(expiraEm: string, hojeISO: string): number {
  const [ay, am, ad] = expiraEm.split("-").map(Number)
  const [hy, hm, hd] = hojeISO.split("-").map(Number)
  const msDia = 24 * 60 * 60 * 1000
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(hy, hm - 1, hd)) / msDia)
}

/** Uma demanda está "viva" quando ainda aceita proposta: aberta ou em
 *  negociação, e dentro do prazo. Mesma condição da RLS (migration 046) —
 *  interface e banco dizendo a mesma coisa, como o §27.2 exige. */
export function demandaViva(
  d: { status: StatusDemanda; expira_em: string },
  hojeISO: string,
): boolean {
  return (d.status === "aberta" || d.status === "em_negociacao") && !demandaExpirada(d.expira_em, hojeISO)
}

// ===========================================================================
// §11.4 — matching determinístico
// ===========================================================================
export interface InteresseParaMatching {
  usuario_id: string
  tipo_demanda: TipoDemanda
  regiao_id: string
  categoria_id: string | null
  funcao_id: string | null
  combustivel_id: string | null
  porte_max_pes: number | null
  ativo: boolean
}

export interface DemandaParaMatching {
  tipo: TipoDemanda
  regiao_id: string
  categoria_id: string | null
  funcao_id: string | null
  combustivel_id: string | null
  porte_pes: number | null
}

/**
 * §11.4: "Distribuição simples e determinística: categoria/atividade + região
 * + requisitos específicos (ex.: porte máximo, combustível, função)."
 *
 * Sem pontuação, sem "relevância", sem ordem secreta — a resposta é sim ou
 * não, pelas mesmas três perguntas, e dá pra explicar pro parceiro por que
 * ele recebeu (ou não) um pedido. É por isso que isto é uma função pura com
 * teste, e não um `order by` espalhado numa query.
 *
 * Regra do campo vazio: interesse com `categoria_id` null significa "qualquer
 * categoria deste tipo", não "nenhuma" — quem atende a região inteira não
 * precisa marcar as doze categorias uma a uma.
 */
export function interesseAtendeDemanda(
  interesse: InteresseParaMatching,
  demanda: DemandaParaMatching,
): boolean {
  if (!interesse.ativo) return false
  if (interesse.tipo_demanda !== demanda.tipo) return false
  if (interesse.regiao_id !== demanda.regiao_id) return false

  if (interesse.categoria_id != null && interesse.categoria_id !== demanda.categoria_id) return false
  if (interesse.funcao_id != null && interesse.funcao_id !== demanda.funcao_id) return false
  if (interesse.combustivel_id != null && interesse.combustivel_id !== demanda.combustivel_id) return false

  // Porte é teto, não igualdade: a marina que declara 80 pés recebe a demanda
  // de 60, mas não a de 100. Marina sem teto declarado recebe todas.
  if (
    interesse.porte_max_pes != null &&
    demanda.porte_pes != null &&
    demanda.porte_pes > interesse.porte_max_pes
  ) {
    return false
  }
  return true
}

/** As demandas que batem com pelo menos um interesse meu, preservando a
 *  ordem em que chegaram (a query já ordena por data — o matching não
 *  reordena nada, senão deixaria de ser explicável). */
export function demandasCompativeis<T extends DemandaParaMatching>(
  demandas: readonly T[],
  interesses: readonly InteresseParaMatching[],
): T[] {
  return demandas.filter((d) => interesses.some((i) => interesseAtendeDemanda(i, d)))
}

/** O outro lado da mesma pergunta: quem deve ser avisado desta demanda.
 *  Ordenado por id pra ser determinístico entre execuções (§11.4 pede
 *  "distribuição simples e determinística" — inclusive na ordem). */
export function usuariosCompativeis(
  demanda: DemandaParaMatching,
  interesses: readonly InteresseParaMatching[],
): string[] {
  const ids = new Set<string>()
  for (const i of interesses) {
    if (interesseAtendeDemanda(i, demanda)) ids.add(i.usuario_id)
  }
  return [...ids].sort()
}

// ===========================================================================
// §11.5 — propostas e candidaturas: cada tipo tem os seus campos
// ===========================================================================
export const CAMPOS_PROPOSTA_POSSIVEIS = [
  "disponibilidade",
  "data_possivel",
  "valor",
  "precisa_visita",
  "marca_modelo",
  "condicao",
  "entrega",
  "prazo_dias",
  "tipo_vaga",
  "periodo",
  "agua_energia",
  "preco_litro",
  "quantidade_litros",
  "taxa_deslocamento",
  "valor_estimado",
  "perfil_profissional",
  "observacao",
] as const
export type CampoProposta = (typeof CAMPOS_PROPOSTA_POSSIVEIS)[number]

/**
 * A lista de campos de cada tipo é a do §11.5, na ordem em que o PRD escreve:
 * · Serviço: disponibilidade, data possível, valor estimado/a combinar,
 *   necessidade de visita e observação curta.
 * · Tripulação: perfil profissional, disponibilidade, valor quando aplicável
 *   e observação curta.
 * · Produto: marca/modelo, condição, valor, entrega/retirada e prazo.
 * · Marina: tipo de vaga, disponibilidade, diária/mensal/período,
 *   valor/sob consulta, água/energia e observação curta.
 * · Posto: preço/L, quantidade, data/período, taxa de deslocamento e valor
 *   estimado.
 * O formulário renderiza exatamente isto — sem essa lista, cada tela viraria
 * um `if` diferente e algum campo do PRD ficaria de fora sem ninguém notar.
 *
 * Fotos do Produto (§11.5) ficaram FORA: o app ainda não tem upload fora da
 * ficha da embarcação, e uma coluna que nenhuma tela preenche é pior que a
 * ausência. Registrado como pendência da onda.
 */
export const CAMPOS_PROPOSTA: Record<TipoDemanda, readonly CampoProposta[]> = {
  profissional: ["disponibilidade", "data_possivel", "valor", "precisa_visita", "observacao"],
  tripulacao: ["perfil_profissional", "disponibilidade", "valor", "observacao"],
  produto: ["marca_modelo", "condicao", "valor", "entrega", "prazo_dias", "observacao"],
  vaga_embarcacao: ["tipo_vaga", "disponibilidade", "periodo", "valor", "agua_energia", "observacao"],
  caminhao: ["preco_litro", "quantidade_litros", "data_possivel", "taxa_deslocamento", "valor_estimado", "observacao"],
}

export function propostaTem(tipo: TipoDemanda, campo: CampoProposta): boolean {
  return CAMPOS_PROPOSTA[tipo].includes(campo)
}

/** Como o app chama a ação de responder, por tipo — "candidatura" quando é
 *  gente se oferecendo pra uma vaga, "proposta" quando é negócio (§11.5 usa
 *  os dois termos, e a tela precisa escolher o certo pra cada caso). */
export function rotuloDaResposta(tipo: TipoDemanda): string {
  return tipo === "tripulacao" ? "candidatura" : "proposta"
}

export const CONDICOES_PRODUTO = ["novo", "seminovo", "usado", "recondicionado"] as const
export type CondicaoProduto = (typeof CONDICOES_PRODUTO)[number]
export const ROTULO_CONDICAO: Record<CondicaoProduto, string> = {
  novo: "Novo",
  seminovo: "Seminovo",
  usado: "Usado",
  recondicionado: "Recondicionado",
}

export const FORMAS_ENTREGA = ["entrega", "retirada", "ambos"] as const
export type FormaEntrega = (typeof FORMAS_ENTREGA)[number]
export const ROTULO_ENTREGA: Record<FormaEntrega, string> = {
  entrega: "Entrego",
  retirada: "Retirada no local",
  ambos: "Entrego ou retirada",
}

export const PERIODOS_VAGA = ["diaria", "mensal", "periodo"] as const
export type PeriodoVaga = (typeof PERIODOS_VAGA)[number]
export const ROTULO_PERIODO_VAGA: Record<PeriodoVaga, string> = {
  diaria: "Diária",
  mensal: "Mensal",
  periodo: "Período combinado",
}

export const TIPOS_VAGA = ["seca", "molhada"] as const
export type TipoVaga = (typeof TIPOS_VAGA)[number]
export const ROTULO_TIPO_VAGA: Record<TipoVaga, string> = { seca: "Vaga seca", molhada: "Vaga molhada" }

export const STATUS_PROPOSTA = ["enviada", "aceita", "recusada", "retirada"] as const
export type StatusProposta = (typeof STATUS_PROPOSTA)[number]
export const ROTULO_STATUS_PROPOSTA: Record<StatusProposta, string> = {
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  retirada: "Retirada",
}

export interface PropostaParaResumo {
  disponibilidade?: string | null
  data_possivel?: string | null
  valor_centavos?: number | null
  valor_a_combinar?: boolean
  precisa_visita?: boolean | null
  marca_modelo?: string | null
  condicao?: CondicaoProduto | null
  entrega?: FormaEntrega | null
  prazo_dias?: number | null
  tipo_vaga?: TipoVaga | null
  periodo?: PeriodoVaga | null
  tem_agua_energia?: boolean | null
  preco_litro_centavos?: number | null
  quantidade_litros?: number | null
  taxa_deslocamento_centavos?: number | null
  valor_estimado_centavos?: number | null
}

/**
 * Linhas curtas que descrevem uma proposta no cartão, só com o que aquele
 * tipo usa. Fica aqui (e não na tela) porque é a mesma lógica em três
 * lugares: lista de propostas recebidas, "minhas propostas" e o resumo do
 * negócio fechado.
 */
export function resumoDaProposta(tipo: TipoDemanda, p: PropostaParaResumo): string[] {
  const linhas: string[] = []
  const usa = (c: CampoProposta) => propostaTem(tipo, c)

  if (usa("tipo_vaga") && p.tipo_vaga) linhas.push(ROTULO_TIPO_VAGA[p.tipo_vaga])
  if (usa("marca_modelo") && p.marca_modelo) linhas.push(p.marca_modelo)
  if (usa("condicao") && p.condicao) linhas.push(ROTULO_CONDICAO[p.condicao])
  if (usa("disponibilidade") && p.disponibilidade) linhas.push(p.disponibilidade)
  if (usa("periodo") && p.periodo) linhas.push(ROTULO_PERIODO_VAGA[p.periodo])
  if (usa("data_possivel") && p.data_possivel) linhas.push(`A partir de ${formatarDiaCurto(p.data_possivel)}`)
  if (usa("preco_litro") && p.preco_litro_centavos != null) {
    linhas.push(`${formatarReais(p.preco_litro_centavos)}/L`)
  }
  if (usa("quantidade_litros") && p.quantidade_litros != null) {
    linhas.push(`${p.quantidade_litros.toLocaleString("pt-BR")} L`)
  }
  if (usa("taxa_deslocamento") && p.taxa_deslocamento_centavos != null) {
    linhas.push(
      p.taxa_deslocamento_centavos === 0
        ? "Sem taxa de deslocamento"
        : `Deslocamento ${formatarReais(p.taxa_deslocamento_centavos)}`,
    )
  }
  if (usa("valor_estimado") && p.valor_estimado_centavos != null) {
    linhas.push(`Estimado ${formatarReais(p.valor_estimado_centavos)}`)
  }
  if (usa("valor")) {
    if (p.valor_a_combinar) linhas.push("Valor a combinar")
    else if (p.valor_centavos != null) linhas.push(formatarReais(p.valor_centavos))
  }
  if (usa("entrega") && p.entrega) linhas.push(ROTULO_ENTREGA[p.entrega])
  if (usa("prazo_dias") && p.prazo_dias != null) {
    linhas.push(p.prazo_dias === 0 ? "Pronta entrega" : `Prazo ${p.prazo_dias} dia${p.prazo_dias === 1 ? "" : "s"}`)
  }
  if (usa("agua_energia") && p.tem_agua_energia != null) {
    linhas.push(p.tem_agua_energia ? "Com água e energia" : "Sem água/energia")
  }
  if (usa("precisa_visita") && p.precisa_visita != null) {
    linhas.push(p.precisa_visita ? "Precisa de visita técnica antes" : "Sem necessidade de visita")
  }
  return linhas
}

// ===========================================================================
// §11.6 — fechamento e confirmação bilateral
// ===========================================================================
export const PAPEIS_NEGOCIO = ["cliente", "fornecedor"] as const
export type PapelNegocio = (typeof PAPEIS_NEGOCIO)[number]

export const DECISOES_CONFIRMACAO = ["realizado", "confirmado", "negado"] as const
export type DecisaoConfirmacao = (typeof DECISOES_CONFIRMACAO)[number]

export interface ConfirmacaoNegocio {
  usuario_id: string
  papel: PapelNegocio
  decisao: DecisaoConfirmacao
}

export const ESTADOS_NEGOCIO = ["aguardando_confirmacao", "confirmado", "negado"] as const
export type EstadoNegocio = (typeof ESTADOS_NEGOCIO)[number]

export const ROTULO_ESTADO_NEGOCIO: Record<EstadoNegocio, string> = {
  aguardando_confirmacao: "Aguardando confirmação do outro lado",
  confirmado: "Negócio confirmado pelos dois lados",
  negado: "Negado por um dos lados",
}

/**
 * §11.6: "Um lado marca como realizado; o outro confirma ou nega."
 *
 * O estado não é um campo que alguém carimba: são as DUAS declarações
 * gravadas (`negocios_confirmacoes`, uma linha por pessoa, unique por
 * negócio+pessoa). Daí as três regras, nesta ordem:
 *  1. qualquer "negado" derruba — discordância vence acordo parcial;
 *  2. duas declarações sem negação = confirmado bilateralmente (inclusive
 *     "realizado" dos dois lados, que é acordo mais forte ainda);
 *  3. uma só = ainda esperando o outro.
 * Sem linha nenhuma também é "aguardando" — negócio recém-criado sem a
 * declaração de quem o criou seria um bug, e mentir "confirmado" aqui seria
 * pior do que mostrar que falta gente responder.
 */
export function estadoDoNegocio(confirmacoes: readonly ConfirmacaoNegocio[]): EstadoNegocio {
  if (confirmacoes.some((c) => c.decisao === "negado")) return "negado"
  const papeis = new Set(confirmacoes.map((c) => c.papel))
  if (papeis.size >= 2) return "confirmado"
  return "aguardando_confirmacao"
}

/** Quem ainda não se manifestou. A tela usa isto pra saber se mostra
 *  "confirmar/negar" pra você ou "esperando fulano". */
export function faltaConfirmacaoDe(
  confirmacoes: readonly ConfirmacaoNegocio[],
  usuarioId: string,
): boolean {
  return !confirmacoes.some((c) => c.usuario_id === usuarioId)
}

/**
 * §11.6: "Após confirmação bilateral, liberar avaliação". A Avaliação em si
 * (§14) é outra onda — o que esta onda entrega é o FATO que a destrava, num
 * lugar só, pra próxima onda não precisar reimplementar a regra.
 */
export function avaliacaoLiberada(confirmacoes: readonly ConfirmacaoNegocio[]): boolean {
  return estadoDoNegocio(confirmacoes) === "confirmado"
}

// ===========================================================================
// §11.6 — a esteira comercial inteira
// ===========================================================================
export const ETAPAS_COMERCIAIS = [
  "solicitacao",
  "proposta",
  "em_negociacao",
  "negocio_realizado",
  "confirmado",
] as const
export type EtapaComercial = (typeof ETAPAS_COMERCIAIS)[number]

export const ROTULO_ETAPA_COMERCIAL: Record<EtapaComercial, string> = {
  solicitacao: "Solicitação",
  proposta: "Proposta / candidatura",
  em_negociacao: "Em negociação",
  negocio_realizado: "Negócio realizado",
  confirmado: "Confirmado pelos dois lados",
}

/**
 * §11.6: "Solicitação → Proposta/Candidatura → Em negociação → Negócio
 * realizado → Confirmação bilateral." A etapa é derivada do que existe, não
 * gravada: uma demanda com proposta aceita ESTÁ em negociação, mesmo que
 * ninguém tenha lembrado de mudar um campo.
 *
 * Um negócio negado volta a exibir "em negociação" — as partes ainda estão
 * conversando, e travar em "negado" esconderia que dá pra resolver.
 */
export function etapaComercial(entrada: {
  temProposta: boolean
  temPropostaAceita: boolean
  temNegocio: boolean
  confirmacoes: readonly ConfirmacaoNegocio[]
}): EtapaComercial {
  if (entrada.temNegocio) {
    const estado = estadoDoNegocio(entrada.confirmacoes)
    if (estado === "confirmado") return "confirmado"
    if (estado === "negado") return "em_negociacao"
    return "negocio_realizado"
  }
  if (entrada.temPropostaAceita) return "em_negociacao"
  if (entrada.temProposta) return "proposta"
  return "solicitacao"
}

// ===========================================================================
// §11.3 — Ofereço / Estou disponível
// ===========================================================================
export const TIPOS_TRABALHO = ["diaria", "temporada", "fixo", "eventual"] as const
export type TipoTrabalho = (typeof TIPOS_TRABALHO)[number]

export const ROTULO_TIPO_TRABALHO: Record<TipoTrabalho, string> = {
  diaria: "Diária",
  temporada: "Temporada",
  fixo: "Fixo",
  eventual: "Eventual",
}

export interface DisponibilidadeParaTitulo {
  funcaoNome: string
  regiaoNome: string
  tipoTrabalho: TipoTrabalho
  dataInicio?: string | null
  dataFim?: string | null
}

/** Mesmo princípio do §11.2: o cartão do "estou disponível" é montado a
 *  partir dos campos padronizados, não de um texto que a pessoa escreveu. */
export function tituloDaDisponibilidade(d: DisponibilidadeParaTitulo): string {
  const periodo = trechoDePeriodo(d.dataInicio, d.dataFim)
  return `${d.funcaoNome} — ${ROTULO_TIPO_TRABALHO[d.tipoTrabalho]} em ${d.regiaoNome}${periodo}`
}

// ===========================================================================
// §21.1 — números que o Admin acumula
// ===========================================================================
export interface NegocioParaMetrica {
  fornecedor_id: string
  valor_final_centavos: number | null
  confirmacoes: readonly ConfirmacaoNegocio[]
}

export interface MetricasComerciais {
  demandasPublicadas: number
  propostasEnviadas: number
  negociosConfirmados: number
  /** §21.1 diz "volume financeiro INFORMADO" — só entra negócio confirmado
   *  com valor declarado. Negócio sem valor não vira zero na média (isso
   *  puxaria o ticket pra baixo e mentiria), fica de fora da conta. */
  volumeInformadoCentavos: number
  negociosComValor: number
  ticketMedioCentavos: number | null
  /** Demanda que virou negócio confirmado, em % — a "conversão" do §21.1. */
  conversaoPercentual: number | null
}

export function calcularMetricasComerciais(entrada: {
  demandasPublicadas: number
  propostasEnviadas: number
  negocios: readonly NegocioParaMetrica[]
}): MetricasComerciais {
  const confirmados = entrada.negocios.filter((n) => estadoDoNegocio(n.confirmacoes) === "confirmado")
  const comValor = confirmados.filter((n) => n.valor_final_centavos != null)
  const volume = comValor.reduce((s, n) => s + (n.valor_final_centavos ?? 0), 0)
  return {
    demandasPublicadas: entrada.demandasPublicadas,
    propostasEnviadas: entrada.propostasEnviadas,
    negociosConfirmados: confirmados.length,
    volumeInformadoCentavos: volume,
    negociosComValor: comValor.length,
    ticketMedioCentavos: comValor.length > 0 ? Math.round(volume / comValor.length) : null,
    conversaoPercentual:
      entrada.demandasPublicadas > 0
        ? Math.round((confirmados.length / entrada.demandasPublicadas) * 100)
        : null,
  }
}

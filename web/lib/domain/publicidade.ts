/**
 * PUBLICIDADE E DESTAQUES (PRD §20, §3.4) — regra pura.
 *
 * O §20 abre com a frase que define o produto inteiro: *"Regra única para
 * qualquer Commander Partner, pago ou gratuito"*. Por isso nada aqui olha
 * pro plano do Partner: uma Marina (grátis no §2) e um Prestador (pago no
 * §2) compram destaque exatamente igual. Se um dia a regra deixar de ser
 * única, vai precisar de uma exceção escrita — e este comentário é onde ela
 * vai bater.
 *
 * ---------------------------------------------------------------------------
 * A LINHA QUE NÃO PODE SER CRUZADA
 * ---------------------------------------------------------------------------
 * *"Publicidade nunca interfere na nota/reputação do Partner"* (§20).
 *
 * A garantia não é uma promessa deste comentário, é estrutural: nenhuma
 * função deste arquivo recebe nota, média ou avaliação, e `calcularReputacao`
 * (lib/domain/avaliacoes.ts) recebe apenas `{ nota, visibilidade }` — não há
 * como um campo de campanha entrar naquela conta sem alguém mudar a
 * assinatura da função de propósito. O teste
 * "campanha não muda a reputação do Partner" existe pra que essa mudança,
 * se vier, quebre alguma coisa em vez de passar batida.
 *
 * O contrário TAMBÉM vale e é menos óbvio: nota não decide anúncio. Quem
 * pagou destaque aparece em destaque mesmo com nota baixa, e quem tem 5
 * estrelas não ganha espaço de graça. Misturar os dois transformaria a
 * vitrine paga em ranking de qualidade, que é enganar quem lê.
 *
 * ---------------------------------------------------------------------------
 * HONESTIDADE DE PRODUTO — o que o §3.4 impõe e por quê
 * ---------------------------------------------------------------------------
 * Anúncio dentro de um app de gestão que o cliente PAGA é assunto delicado.
 * O PRD desenha os limites e eles estão codificados aqui, não deixados a
 * critério de quem monta a tela:
 *
 *   · `MAX_PATROCINADORES_DASHBOARD = 5` e `selecionarPatrocinios` NUNCA
 *     devolve mais que isso ("carrossel de até 5 patrocinadores");
 *   · uma unidade visível por vez — o carrossel mostra um item, e é o
 *     componente que respeita isso (`components/publicidade/patrocinio-
 *     dashboard.tsx`);
 *   · `ROTULO_PATROCINADO` é constante e obrigatório na exibição
 *     ("identificado como 'Patrocinado'"). Anúncio que não se identifica é
 *     publicidade disfarçada de conteúdo do produto;
 *   · o lugar é "abaixo da área operacional prioritária" — decisão de layout,
 *     cumprida em `app/(app)/barco/page.tsx`, no fim da página.
 *
 * E uma decisão que o PRD não pede mas o bom senso exige:
 * `TELAS_SEM_PUBLICIDADE` lista onde anúncio não entra nunca. Vender espaço
 * ao lado de um alerta crítico de Segurança seria monetizar o susto.
 */

// ===========================================================================
// §20 — os três produtos
// ===========================================================================
export const PRODUTOS_PUBLICIDADE = [
  "destaque_explorar",
  "destaque_superior",
  "patrocinio_dashboard",
] as const
export type ProdutoPublicidade = (typeof PRODUTOS_PUBLICIDADE)[number]

export const ROTULO_PRODUTO: Record<ProdutoPublicidade, string> = {
  destaque_explorar: "Destaque no Explorar",
  destaque_superior: "Destaque superior",
  patrocinio_dashboard: "Patrocínio no Dashboard",
}

/** O que cada produto entrega, na voz de quem vende. Fica ao lado do preço
 *  na tela do Comercial pra que ninguém venda a coisa errada. */
export const DESCRICAO_PRODUTO: Record<ProdutoPublicidade, string> = {
  destaque_explorar: "O perfil sobe na lista do Explorar dentro da região contratada.",
  destaque_superior: "Faixa no topo do Explorar, acima da lista, um anunciante por vez.",
  patrocinio_dashboard: "Entra no carrossel do Dashboard do proprietário, abaixo da área operacional.",
}

export function produtoValido(v: string): v is ProdutoPublicidade {
  return (PRODUTOS_PUBLICIDADE as readonly string[]).includes(v)
}

// ===========================================================================
// Estados da campanha
// ===========================================================================
export const STATUS_CAMPANHA = ["rascunho", "ativa", "pausada", "encerrada"] as const
export type StatusCampanha = (typeof STATUS_CAMPANHA)[number]

export const ROTULO_STATUS_CAMPANHA: Record<StatusCampanha, string> = {
  rascunho: "Rascunho",
  ativa: "No ar",
  pausada: "Pausada",
  encerrada: "Encerrada",
}

/**
 * Transições possíveis. `encerrada` é terminal de propósito: reabrir uma
 * campanha encerrada apagaria a fronteira entre "esta veiculação" e "uma
 * nova venda", e as impressões das duas ficariam somadas na mesma linha.
 * Quem quer voltar ao ar cria campanha nova — o histórico continua legível.
 */
const TRANSICOES: Record<StatusCampanha, readonly StatusCampanha[]> = {
  rascunho: ["ativa", "encerrada"],
  ativa: ["pausada", "encerrada"],
  pausada: ["ativa", "encerrada"],
  encerrada: [],
}

export function podeTransicionar(de: StatusCampanha, para: StatusCampanha): boolean {
  return TRANSICOES[de].includes(para)
}

export function statusValido(v: string): v is StatusCampanha {
  return (STATUS_CAMPANHA as readonly string[]).includes(v)
}

// ===========================================================================
// Vigência e segmentação
// ===========================================================================
export interface CampanhaParaExibicao {
  id: string
  parceiro_id: string
  produto: ProdutoPublicidade
  status: StatusCampanha
  /** "AAAA-MM-DD" */
  inicio: string
  /** "AAAA-MM-DD" ou null (sem término previsto). */
  fim: string | null
  /** null = sem segmentação por região (alcança todo mundo). */
  regiao_id: string | null
  /** null = sem segmentação por categoria. */
  categoria_id: string | null
  prioridade: number
}

/** Quem está olhando. `regiaoId` nulo significa "não sei onde esta pessoa
 *  está" — e é tratado como desconhecimento, não como "qualquer lugar". */
export interface ContextoExibicao {
  regiaoId: string | null
  categoriaId?: string | null
}

/**
 * "No ar": ativa E dentro do período. A MESMA definição que a função
 * `publicidade_vigente()` do banco usa (migration 053) — se as duas
 * divergirem, quem manda é o banco, porque é ele que entrega ou nega a
 * linha. Esta existe pra tela não montar um carrossel com campanha que a
 * RLS já filtrou.
 */
export function campanhaVigente(c: CampanhaParaExibicao, hojeISO: string): boolean {
  if (c.status !== "ativa") return false
  if (c.inicio > hojeISO) return false
  if (c.fim != null && c.fim < hojeISO) return false
  return true
}

/**
 * Segmentação do §20 ("mínima recomendada: região; categoria quando
 * aplicável").
 *
 * A regra assimétrica é o ponto: campanha SEM região alcança todo mundo,
 * inclusive quem tem região desconhecida. Campanha COM região só alcança
 * quem tem aquela região — se não sabemos onde a pessoa está, ela não
 * recebe. O contrário (na dúvida, mostra) entregaria anúncio de marina de
 * Angra pra um barco em Salvador, e o Partner pagaria por alcance que não
 * comprou.
 */
export function segmentacaoAtende(c: CampanhaParaExibicao, ctx: ContextoExibicao): boolean {
  if (c.regiao_id != null && c.regiao_id !== ctx.regiaoId) return false
  if (c.categoria_id != null && c.categoria_id !== (ctx.categoriaId ?? null)) return false
  return true
}

// ===========================================================================
// §3.4 — o carrossel do Dashboard
// ===========================================================================
/** "carrossel de até 5 patrocinadores" (§20 e §3.4). Constante, não número
 *  solto na tela: o limite é regra do PRD, não escolha de layout. */
export const MAX_PATROCINADORES_DASHBOARD = 5

/** "identificado como 'Patrocinado'" (§20/§3.4). Palavra literal do PRD —
 *  é uma DECLARAÇÃO de que aquilo é anúncio, então não se traduz nem se
 *  suaviza pra "Parceiro em destaque". */
export const ROTULO_PATROCINADO = "Patrocinado"

/**
 * Telas onde publicidade não entra, aconteça o que acontecer.
 *
 * O PRD não escreve esta lista; ela vem do que ele exige em volta. O §4.6
 * manda alerta crítico de Segurança usar vermelho + "!" e subir pro
 * Dashboard, e o §24 manda estado de erro/sem-permissão explicar em vez de
 * distrair. Um anúncio ao lado de "colete vencido" ou de uma ocorrência
 * aberta compete com a informação que pode evitar um acidente — e cobra do
 * cliente pelo direito de ser distraído numa hora dessas.
 */
export const TELAS_SEM_PUBLICIDADE = [
  "/barco/seguranca",
  "/barco/ocorrencias",
  "/barco/saude",
  "/alertas",
  "/navegando",
] as const

export function permitePublicidade(caminho: string): boolean {
  return !TELAS_SEM_PUBLICIDADE.some((t) => caminho === t || caminho.startsWith(`${t}/`))
}

/**
 * Escolhe os patrocinadores do Dashboard.
 *
 * Ordem: prioridade maior primeiro (é o que o Comercial vendeu), e o `id`
 * como desempate — determinístico de propósito. Um `Math.random()` aqui
 * faria o mesmo barco ver um anunciante diferente a cada refresh, e nenhum
 * relatório de impressão faria sentido depois.
 *
 * NÃO recebe nota, média nem contagem de avaliação. Ver o cabeçalho: a
 * separação entre publicidade e reputação começa na assinatura desta
 * função.
 */
export function selecionarPatrocinios<T extends CampanhaParaExibicao>(
  campanhas: readonly T[],
  ctx: ContextoExibicao,
  hojeISO: string,
): T[] {
  return campanhas
    .filter((c) => c.produto === "patrocinio_dashboard")
    .filter((c) => campanhaVigente(c, hojeISO))
    .filter((c) => segmentacaoAtende(c, ctx))
    .sort((a, b) => b.prioridade - a.prioridade || a.id.localeCompare(b.id))
    .slice(0, MAX_PATROCINADORES_DASHBOARD)
}

// ===========================================================================
// §20 — destaque no Explorar
// ===========================================================================
/**
 * Ids dos Partners com destaque vigente no Explorar, na ordem em que devem
 * subir. Devolve ids, não perfis, porque quem monta o Explorar é outra
 * parte do app (e outra onda) — esta função entrega a REGRA, não a tela.
 *
 * `destaque_superior` entra junto e na frente: é o mesmo lugar do Explorar,
 * só que acima da lista. Separar em duas listas obrigaria a tela a saber a
 * ordem entre os produtos, que é decisão de produto, não de layout.
 */
export function destaquesDoExplorar(
  campanhas: readonly CampanhaParaExibicao[],
  ctx: ContextoExibicao,
  hojeISO: string,
): string[] {
  const peso = (p: ProdutoPublicidade) => (p === "destaque_superior" ? 1 : 0)
  const vigentes = campanhas
    .filter((c) => c.produto === "destaque_explorar" || c.produto === "destaque_superior")
    .filter((c) => campanhaVigente(c, hojeISO))
    .filter((c) => segmentacaoAtende(c, ctx))
    .sort(
      (a, b) =>
        peso(b.produto) - peso(a.produto) || b.prioridade - a.prioridade || a.id.localeCompare(b.id),
    )
  // Um Partner com dois produtos ao mesmo tempo aparece UMA vez, na melhor
  // posição que comprou — não duas.
  return [...new Set(vigentes.map((c) => c.parceiro_id))]
}

/**
 * Aplica os destaques a uma lista já ordenada, preservando a ordem original
 * de quem não comprou nada.
 *
 * Genérico e sem opinião sobre o que é um "parceiro": recebe a lista, uma
 * função que extrai o id e os destaques. É assim que a regra de publicidade
 * chega ao Explorar sem que este arquivo precise conhecer o formato do
 * perfil — que está sendo reescrito em outra onda.
 *
 * De novo: nenhuma nota entra aqui. A ordem de quem não tem destaque é a
 * que veio, seja ela por distância, por nome ou por reputação.
 */
export function ordenarComDestaque<T>(
  itens: readonly T[],
  idDe: (item: T) => string,
  destaques: readonly string[],
): T[] {
  const posicao = new Map(destaques.map((id, i) => [id, i]))
  const emDestaque = itens
    .filter((i) => posicao.has(idDe(i)))
    .sort((a, b) => (posicao.get(idDe(a)) ?? 0) - (posicao.get(idDe(b)) ?? 0))
  const resto = itens.filter((i) => !posicao.has(idDe(i)))
  return [...emDestaque, ...resto]
}

// ===========================================================================
// Preço e desempenho
// ===========================================================================
/** "sob consulta" quando não há preço definido. Mesmo vocabulário do Gold
 *  (§16): é um ESTADO, não um preço zerado — não gera cobrança nenhuma. */
export function formatarPrecoPublicidade(centavos: number | null): string {
  if (centavos == null) return "Sob consulta"
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}/mês`
}

/**
 * Taxa de clique. `null` sem impressão — não existe "0% de cliques" quando
 * ninguém viu o anúncio; existe ausência de amostra. Mesma disciplina de
 * `percentual` em `admin-metricas.ts`, e pela mesma razão: 0% num painel
 * comercial lê-se como "o anúncio não funciona", quando o fato é "o anúncio
 * não rodou".
 */
export function taxaDeClique(impressoes: number, cliques: number): number | null {
  if (impressoes <= 0) return null
  return Math.round((cliques / impressoes) * 1000) / 10
}

export function formatarTaxa(taxa: number | null): string {
  return taxa == null ? "—" : `${taxa.toString().replace(".", ",")}%`
}

/**
 * Período válido: fim não pode ser antes do início. Espelha o
 * `constraint publicidade_periodo_coerente` da migration 053 — a tela avisa
 * em português, o banco garante.
 */
export function periodoValido(inicio: string, fim: string | null): boolean {
  if (!inicio) return false
  if (fim == null || fim === "") return true
  return fim >= inicio
}

/** Resumo do período pra lista do Comercial. */
export function descreverPeriodo(inicio: string, fim: string | null): string {
  const br = (iso: string) => iso.split("-").reverse().join("/")
  return fim == null ? `Desde ${br(inicio)}` : `${br(inicio)} a ${br(fim)}`
}

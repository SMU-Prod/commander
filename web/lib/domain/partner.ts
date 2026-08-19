import type { NomeIcone } from "@/components/icone"
import type { PlanoId } from "@/lib/domain/planos"
import type { TipoDemanda, TipoTaxonomia } from "@/lib/domain/marketplace"
import type { CategoriaParceiro } from "@/lib/db/types"

/**
 * COMMANDER PARTNER POR TIPO (onda 51).
 * PRD `docs/prd/upgrade2-master-final.txt` §13 inteira (13.1 a 13.6), §10
 * (Explorar Parceiros) e §2 (os sete planos).
 *
 * ---------------------------------------------------------------------------
 * A FRASE QUE MANDA NO ARQUIVO INTEIRO
 * ---------------------------------------------------------------------------
 * §13: "Commander Partner é o plano/ecossistema B2B. O Dashboard e o perfil
 * exibem o TIPO REAL do parceiro. Um Partner possui UM tipo principal e pode
 * ter atividades complementares."
 *
 * Ou seja: "Commander Partner" é vocabulário COMERCIAL (é o que aparece em
 * `lib/domain/planos.ts`, na fatura e na tela de assinatura). Na tela de quem
 * usa, o que se lê é "Marina", "Loja Náutica", "Prestador de Serviço" — nunca
 * "Commander Partner". `ROTULO_TIPO_PARTNER` abaixo é a fonte única disso, e
 * nenhuma tela escreve esses nomes à mão.
 *
 * "UM tipo principal + atividades complementares, SEM DUPLICAR PERFIL" é
 * também o que decidiu a modelagem no banco: uma linha em `parceiros`, com
 * `categoria` sendo o tipo principal, mais duas flags e uma tabela de junção
 * com a taxonomia. Ver o cabeçalho de `supabase/migrations/052_partner_por_tipo.sql`.
 *
 * ---------------------------------------------------------------------------
 * REGRA PURA, COMO A CASA MANDA
 * ---------------------------------------------------------------------------
 * Nada aqui consulta banco, sessão ou relógio. Quem junta os dados é
 * `lib/consultas-partner.ts`; quem escreve é `lib/acoes/parceiro.ts`. Este
 * módulo só responde perguntas fechadas: qual menu este tipo tem, quais
 * demandas ele recebe, que campos o perfil dele pede, que taxonomia ele
 * declara.
 */

/** O tipo principal do Partner. É literalmente `parceiros.categoria` — o
 *  alias existe pra o código do §13 falar a língua do PRD ("tipo de Partner")
 *  sem criar um segundo vocabulário pro mesmo dado. */
export type TipoPartner = CategoriaParceiro

/** Ordem de exibição: os dois pagos primeiro (§2), depois os gratuitos na
 *  ordem em que o §13 os apresenta, e "outros" por último. */
export const TIPOS_PARTNER = [
  "prestador",
  "loja_nautica",
  "marina",
  "posto",
  "restaurante",
  "pousada",
  "outros",
] as const satisfies readonly TipoPartner[]

/**
 * §13: "o Dashboard e o perfil exibem o TIPO REAL do parceiro". Estes são os
 * nomes do próprio PRD, títulos das seções 13.1 a 13.6 — não sinônimos
 * escolhidos aqui.
 *
 * `outros` não tem seção no §13: é a categoria-válvula do §10 ("outros
 * parceiros pertinentes"), então ganha o rótulo neutro "Parceiro".
 */
export const ROTULO_TIPO_PARTNER: Record<TipoPartner, string> = {
  prestador: "Prestador de Serviço",
  loja_nautica: "Loja Náutica",
  marina: "Marina",
  posto: "Posto Náutico",
  restaurante: "Restaurante",
  pousada: "Pousada/Hotel",
  outros: "Parceiro",
}

/** Ícone do tipo — subconjunto de `components/icone.tsx`, sem inventar
 *  nenhum novo. Bate com `ICONE_PADRAO_POR_CATEGORIA` (pino no mapa). */
export const ICONE_TIPO_PARTNER: Record<TipoPartner, NomeIcone> = {
  prestador: "ferramenta",
  loja_nautica: "marketplace",
  marina: "ancora",
  posto: "oleo",
  restaurante: "estrela",
  pousada: "inicio",
  outros: "embarcacao",
}

/**
 * O plano do §2 que cada tipo contrata. `outros` fica `null` porque o §2 não
 * lista plano pra ele: é uma categoria de vitrine, não um produto vendido —
 * inventar um preço aqui seria inventar produto.
 */
export const PLANO_DO_TIPO_PARTNER: Record<TipoPartner, PlanoId | null> = {
  prestador: "partner_prestador",
  loja_nautica: "partner_loja",
  marina: "partner_marina",
  posto: "partner_posto",
  restaurante: "partner_restaurante",
  pousada: "partner_pousada",
  outros: null,
}

/** Os dois tipos cobrados do §2 (R$ 24,90). Os outros são grátis — e o §2
 *  distingue "Grátis" (Marina/Posto) de "Grátis inicialmente"
 *  (Restaurante/Pousada); essa diferença mora no catálogo de planos, que é
 *  quem fala de dinheiro. Aqui só interessa "tem cobrança?". */
export function partnerPago(tipo: TipoPartner): boolean {
  return tipo === "prestador" || tipo === "loja_nautica"
}

// ===========================================================================
// §13 — o menu de cada tipo
// ===========================================================================

export interface ItemMenuPartner {
  href: string
  rotulo: string
  icone: NomeIcone
}

/**
 * §13.1 dá o menu do Prestador literalmente ("Início | Marketplace | Explorar
 * | Meu Perfil | Minha Conta") e §13.2 o da Loja (com "Minha Loja" no lugar
 * de "Meu Perfil"). Os quatro tipos gratuitos não têm o menu enumerado no
 * PRD, então ele é DEDUZIDO das regras que o PRD dá, não inventado:
 *
 * · Marina — §13.3: "Marketplace da Marina mostra apenas demandas de VAGAS".
 *   Tem Marketplace, com escopo reduzido.
 * · Posto — §13.4: "Função especial: Solicitações de Caminhão" e "Não precisa
 *   receber o Marketplace geral". O destino é o mesmo (as demandas do tipo
 *   `caminhao` são demandas do Marketplace), mas o rótulo é o da função que o
 *   PRD nomeia: "Solicitações". Chamar de "Marketplace" prometeria um mural
 *   geral que ele não recebe.
 * · Restaurante e Pousada — §13.5/§13.6 descrevem só perfil e fotos; nenhum
 *   tipo de demanda do §11.1 se dirige a eles. Menu sem Marketplace: uma aba
 *   que abriria sempre vazia é pior que a ausência dela (§24).
 *
 * "Meu Perfil" muda de nome por tipo pela mesma razão do §13.2 ter pedido
 * "Minha Loja": a pessoa reconhece o próprio negócio, não uma abstração.
 */
export function menuDoPartner(tipo: TipoPartner): ItemMenuPartner[] {
  const inicio: ItemMenuPartner = { href: "/parceiro", rotulo: "Início", icone: "inicio" }
  const explorar: ItemMenuPartner = { href: "/explorar", rotulo: "Explorar", icone: "mapa" }
  const perfil: ItemMenuPartner = {
    href: "/parceiro/perfil",
    rotulo: ROTULO_MEU_PERFIL[tipo],
    icone: ICONE_TIPO_PARTNER[tipo],
  }
  const conta: ItemMenuPartner = { href: "/parceiro/conta", rotulo: "Minha Conta", icone: "pessoas" }

  const rotuloMarketplace = tipo === "posto" ? "Solicitações" : "Marketplace"
  const marketplace: ItemMenuPartner = {
    href: "/parceiro/marketplace",
    rotulo: rotuloMarketplace,
    icone: "marketplace",
  }

  return recebeDemandas(tipo)
    ? [inicio, marketplace, explorar, perfil, conta]
    : [inicio, explorar, perfil, conta]
}

/** O nome da aba de perfil por tipo. §13.2 pede "Minha Loja" explicitamente;
 *  os demais seguem a mesma lógica de posse. */
export const ROTULO_MEU_PERFIL: Record<TipoPartner, string> = {
  prestador: "Meu Perfil",
  loja_nautica: "Minha Loja",
  marina: "Minha Marina",
  posto: "Meu Posto",
  restaurante: "Meu Restaurante",
  pousada: "Minha Pousada",
  outros: "Meu Perfil",
}

// ===========================================================================
// §13 — atividades complementares
// ===========================================================================

/** O que o parceiro declarou além do tipo principal. Espelha as duas colunas
 *  booleanas de `parceiros` (migration 052). */
export interface AtividadesPartner {
  tambem_vende_produtos: boolean
  tambem_presta_servicos: boolean
}

/** O Partner inteiro, na medida que estas regras precisam. Não é a linha do
 *  banco: quem chama passa só isto, e o módulo continua puro. */
export interface PartnerParaRegra extends AtividadesPartner {
  categoria: TipoPartner
}

/**
 * Quais toggles o tipo pode ativar. O PRD só concede dois, e a cada um deles
 * um tipo específico:
 *   §13.1 (Prestador): "Pode ativar 'Também vendo produtos'";
 *   §13.2 (Loja):      "Pode ativar 'Também presto serviços'".
 *
 * Ninguém mais recebe toggle — inclusive Marina e Posto, cujo Marketplace o
 * PRD fecha com a palavra "apenas" (§13.3) e com "não precisa receber o
 * Marketplace geral" (§13.4). Dar o toggle a eles seria contrariar o texto
 * pra ganhar simetria de código.
 */
export function toggleDisponivel(tipo: TipoPartner): AtividadesPartner {
  return {
    tambem_vende_produtos: tipo === "prestador",
    tambem_presta_servicos: tipo === "loja_nautica",
  }
}

/** O rótulo é o texto do próprio PRD, entre aspas no §13.1/§13.2 — a tela
 *  mostra exatamente a frase que o parceiro leu na oferta. */
export const ROTULO_TOGGLE = {
  tambem_vende_produtos: "Também vendo produtos",
  tambem_presta_servicos: "Também presto serviços",
} as const

/** Normaliza o que veio do formulário: toggle que o tipo não pode ativar
 *  volta `false`, sempre. É a trava que impede uma Marina de virar loja por
 *  um POST forjado — a tela esconde o campo, isto aqui o desliga. */
export function atividadesValidas(tipo: TipoPartner, pedido: AtividadesPartner): AtividadesPartner {
  const permitido = toggleDisponivel(tipo)
  return {
    tambem_vende_produtos: permitido.tambem_vende_produtos && pedido.tambem_vende_produtos,
    tambem_presta_servicos: permitido.tambem_presta_servicos && pedido.tambem_presta_servicos,
  }
}

// ===========================================================================
// §13 + §11.1 — que demandas cada tipo recebe
// ===========================================================================

/**
 * O Marketplace por tipo. Sai direto da coluna "Quem recebe" do §11.1
 * cruzada com os limites do §13:
 *
 *   Prestador       → "Preciso de profissional"   (+ "Compro/Procuro" se vende produtos)
 *   Loja Náutica    → "Compro / Procuro"          (+ "Preciso de profissional" se presta serviços)
 *   Marina          → "Vaga para embarcação"      — §13.3: "APENAS demandas de VAGAS"
 *   Posto           → "Solicitar caminhão"        — §13.4: "Não precisa receber o Marketplace geral"
 *   Restaurante     → nenhuma                     — §13.5 não descreve Marketplace
 *   Pousada/Hotel   → nenhuma                     — §13.6 idem
 *   Outros          → nenhuma
 *
 * `tripulacao` nunca aparece: o §11.1 manda essa demanda pra "Captains/
 * profissionais compatíveis", que é a rede do §12, não o ecossistema Partner.
 *
 * A ordem da lista é estável (a do §11.1) porque o §11.4 pede distribuição
 * "simples e determinística" — inclusive na ordem em que a tela mostra.
 */
export function tiposDeDemandaDoPartner(p: PartnerParaRegra): TipoDemanda[] {
  const atividades = atividadesValidas(p.categoria, p)
  switch (p.categoria) {
    case "prestador":
      return atividades.tambem_vende_produtos ? ["profissional", "produto"] : ["profissional"]
    case "loja_nautica":
      return atividades.tambem_presta_servicos ? ["profissional", "produto"] : ["produto"]
    case "marina":
      return ["vaga_embarcacao"]
    case "posto":
      return ["caminhao"]
    case "restaurante":
    case "pousada":
    case "outros":
      return []
  }
}

/** Este tipo tem aba de Marketplace? (Falso quando não recebe demanda
 *  nenhuma — ver `menuDoPartner`.) */
export function recebeDemandas(tipo: TipoPartner): boolean {
  return tiposDeDemandaDoPartner({
    categoria: tipo,
    tambem_vende_produtos: false,
    tambem_presta_servicos: false,
  }).length > 0
}

/*
 * AUDITORIA 19/08, A20 — AQUI MORAVA `demandasDoPartner`, que filtrava a
 * vitrine só pelo TIPO de demanda. APAGADA: ela foi SUPLANTADA, não esquecida.
 *
 * Quem as duas telas do Partner chamam é `demandasParaPartner` (mais abaixo
 * neste arquivo) — `app/(parceiro)/parceiro/marketplace/page.tsx:68` e
 * `app/(parceiro)/parceiro/page.tsx:86`. Ela aplica o mesmo corte por tipo, via
 * `demandaCompativelComPartner` → `tiposDeDemandaDoPartner`, e MAIS a região, a
 * atividade declarada e a vaga. Nenhuma tela quer o corte por tipo sozinho: um
 * parceiro que visse toda demanda do seu tipo no país inteiro receberia pedidos
 * de vaga a 800 km da marina dele.
 *
 * Manter as duas era o risco real: dois filtros de vitrine com nomes quase
 * iguais, um mais frouxo que o outro, e o mais frouxo com teste verde. A
 * próxima tela de Partner escolheria pelo nome, não pelo comportamento.
 */

// ===========================================================================
// §13 + §21.2 — que taxonomia cada tipo declara
// ===========================================================================

/**
 * "Loja cadastra categorias e marcas" (§13.2), "selecionar categorias de
 * produto" (§13.1), "selecionar serviços oferecidos" (§13.2) e o combustível
 * do Posto (§13.4/§11.1) são a mesma operação: escolher itens de `taxonomia`.
 *
 * Sempre da taxonomia, nunca texto livre — §21.2: "evitar duplicatas livres".
 * É isso que faz o filtro do Explorar (§10) e o matching do Marketplace
 * (§11.4) falarem do mesmo "Elétrica".
 */
export function taxonomiasDoPartner(p: PartnerParaRegra): TipoTaxonomia[] {
  const atividades = atividadesValidas(p.categoria, p)
  const lista: TipoTaxonomia[] = []
  if (p.categoria === "prestador" || atividades.tambem_presta_servicos) lista.push("categoria_servico")
  if (p.categoria === "loja_nautica" || atividades.tambem_vende_produtos) {
    lista.push("categoria_produto")
    // Marca só faz sentido pra quem vende: §13.2 pede "categorias E MARCAS"
    // da Loja, e o §11.5 deixa a marca na proposta de produto.
    lista.push("marca")
  }
  if (p.categoria === "posto") lista.push("combustivel")
  return lista
}

// ===========================================================================
// §13.3 a §13.6 — que campos o perfil de cada tipo pede
// ===========================================================================

/** Blocos opcionais do formulário/perfil. Cada um sai nominalmente de uma
 *  linha do §13 — nada aqui é enfeite de tela. */
export type BlocoPerfilPartner =
  | "acesso_nautico"   // §13.3 "acesso náutico"; §13.5/§13.6 "informações náuticas / acesso pelo mar"
  | "estrutura"        // §13.3 "estrutura"
  | "atracacao"        // §13.3 "atracação"
  | "combustivel"      // §13.3 "combustível quando aplicável"; §13.4 "combustível, preço opcional"
  | "vagas"            // §13.3 "Vagas secas/molhadas"
  | "poita"            // herdado da 020 — poita é vaga de fundeio, coisa de marina
  | "calado"           // profundidade que o barco encontra ao chegar
  | "cardapio"         // §13.5 "Cardápio; galeria de imagens"
  | "restaurante_extra" // §13.5 culinária e vaga de carro cortesia (campos já existentes)
  | "acomodacoes"      // §13.6 "acomodações, valores opcionais"
  | "check_in_out"     // §13.6 "check-in/out"
  | "traslado"         // §13.6 acesso/traslado (campo já existente)

export const BLOCOS_PERFIL_PARTNER: Record<TipoPartner, readonly BlocoPerfilPartner[]> = {
  // §13.1 e §13.2 não pedem campo físico nenhum além de identificação,
  // contato e as atividades — por isso a lista é vazia de propósito.
  prestador: [],
  loja_nautica: [],
  marina: ["acesso_nautico", "estrutura", "atracacao", "combustivel", "vagas", "poita", "calado"],
  posto: ["combustivel", "acesso_nautico", "calado"],
  restaurante: ["cardapio", "restaurante_extra", "acesso_nautico", "calado"],
  pousada: ["acomodacoes", "check_in_out", "traslado", "acesso_nautico", "calado"],
  outros: [],
}

export function perfilTem(tipo: TipoPartner, bloco: BlocoPerfilPartner): boolean {
  return BLOCOS_PERFIL_PARTNER[tipo].includes(bloco)
}

// ===========================================================================
// §13.3 — vagas da Marina
// ===========================================================================

export const TIPOS_VAGA_MARINA = ["seca", "molhada"] as const
export type TipoVagaMarina = (typeof TIPOS_VAGA_MARINA)[number]

export const ROTULO_TIPO_VAGA: Record<TipoVagaMarina, string> = {
  seca: "Vaga seca",
  molhada: "Vaga molhada",
}

/**
 * §13.3, palavra por palavra: "Informação de disponibilidade é declarada pela
 * Marina; não é estoque/reserva transacional."
 *
 * Esta constante existe pra a frase aparecer NA TELA — nos dois lados: pra
 * marina que digita o número e pro proprietário que o lê. Sem ela, um "3
 * vagas disponíveis" grande e bonito vira promessa de reserva que o app não
 * tem como cumprir, e a decepção sobra pro parceiro.
 */
export const AVISO_DISPONIBILIDADE_MARINA =
  "A disponibilidade é declarada pela própria Marina e não é reserva: confirme com ela antes de contar com a vaga."

export interface VagaDeclarada {
  tipo: TipoVagaMarina
  total: number | null
  disponiveis: number | null
  porte_max_pes: number | null
  preco_diaria_centavos: number | null
  preco_mensal_centavos: number | null
  sob_consulta: boolean
}

/** Uma vaga só entra na vitrine se disser alguma coisa. Linha toda vazia é
 *  ruído: o §24 pede estado vazio honesto, não um cartão "— / —". */
export function vagaTemConteudo(v: VagaDeclarada): boolean {
  return (
    v.total != null ||
    v.disponiveis != null ||
    v.porte_max_pes != null ||
    v.preco_diaria_centavos != null ||
    v.preco_mensal_centavos != null ||
    v.sob_consulta
  )
}

/**
 * A marina atende esta demanda de vaga? Tipo (seca/molhada) tem que bater e o
 * porte do barco tem que caber no teto declarado — a mesma régua de porte que
 * `interesseAtendeDemanda` (§11.4) usa, pra as duas telas nunca discordarem.
 * Vaga sem teto declarado atende qualquer porte: não declarar não é declarar
 * zero.
 */
export function vagaAtendeDemanda(
  v: VagaDeclarada,
  demanda: { tipo_vaga: TipoVagaMarina | null; porte_pes: number | null },
): boolean {
  if (demanda.tipo_vaga != null && demanda.tipo_vaga !== v.tipo) return false
  if (v.porte_max_pes != null && demanda.porte_pes != null && demanda.porte_pes > v.porte_max_pes) return false
  return true
}

// ===========================================================================
// §11.4 — matching pelo próprio cadastro do Partner
// ===========================================================================

/** Uma atividade declarada, com o tipo de taxonomia junto: sem ele um id
 *  solto não diz se é "Elétrica (serviço)" ou "Elétrica (produto)". */
export interface AtividadeDeclarada {
  id: string
  tipo: TipoTaxonomia
}

export interface PartnerParaMatching extends PartnerParaRegra {
  regiao_id: string
  atividades: readonly AtividadeDeclarada[]
}

export interface DemandaParaPartner {
  tipo: TipoDemanda
  regiao_id: string
  categoria_id: string | null
  combustivel_id: string | null
  tipo_vaga: TipoVagaMarina | null
  porte_pes: number | null
}

function declaradas(p: PartnerParaMatching, tipo: TipoTaxonomia): string[] {
  return p.atividades.filter((a) => a.tipo === tipo).map((a) => a.id)
}

/**
 * §11.4: "Parceiro escolhe NO CADASTRO suas regiões e áreas de interesse/
 * atuação" e "Distribuição simples e determinística: categoria/atividade +
 * região + requisitos específicos".
 *
 * Por isso o matching do Partner sai do PERFIL DELE, não de uma tela extra de
 * "interesses" que ele teria que lembrar de preencher: região é
 * `parceiros.regiao_id`, atividade é `parceiro_atividades`, o requisito de
 * vaga são as `parceiro_vagas` que ele declarou. `interesses_marketplace`
 * (onda 45) continua servindo a quem NÃO é Partner.
 *
 * Regra do campo vazio, igual à do §11.4: quem não declarou categoria nenhuma
 * atende todas daquele tipo — não declarar não é declarar zero. Quem declarou
 * alguma passa a receber só o que declarou; foi a escolha dele.
 */
export function demandaCompativelComPartner(
  d: DemandaParaPartner,
  p: PartnerParaMatching,
  vagas: readonly VagaDeclarada[] = [],
): boolean {
  if (!tiposDeDemandaDoPartner(p).includes(d.tipo)) return false
  if (d.regiao_id !== p.regiao_id) return false

  if (d.tipo === "profissional" || d.tipo === "produto") {
    const tipoTaxonomia: TipoTaxonomia = d.tipo === "profissional" ? "categoria_servico" : "categoria_produto"
    const minhas = declaradas(p, tipoTaxonomia)
    if (minhas.length > 0 && d.categoria_id != null && !minhas.includes(d.categoria_id)) return false
  }

  if (d.tipo === "caminhao") {
    const meus = declaradas(p, "combustivel")
    if (meus.length > 0 && d.combustivel_id != null && !meus.includes(d.combustivel_id)) return false
  }

  if (d.tipo === "vaga_embarcacao") {
    const comConteudo = vagas.filter(vagaTemConteudo)
    if (comConteudo.length > 0 && !comConteudo.some((v) => vagaAtendeDemanda(v, d))) return false
  }

  return true
}

/** As demandas que este Partner deve ver, na ordem em que chegaram (a query
 *  já ordena; o matching não reordena — §11.4 pede que seja explicável). */
export function demandasParaPartner<T extends DemandaParaPartner>(
  demandas: readonly T[],
  p: PartnerParaMatching,
  vagas: readonly VagaDeclarada[] = [],
): T[] {
  return demandas.filter((d) => demandaCompativelComPartner(d, p, vagas))
}

// ===========================================================================
// §10 — Explorar Parceiros
// ===========================================================================

/** O valor "Todos" do filtro do §10 ("Filtros: Todos, tipo de Partner,
 *  categoria/atividade, região"). String e não `null` porque vira query
 *  param — `?tipo=todos` é legível, `?tipo=` não. */
export const FILTRO_TODOS = "todos" as const

export type FiltroTipoPartner = TipoPartner | typeof FILTRO_TODOS

export function ehTipoPartner(v: unknown): v is TipoPartner {
  return typeof v === "string" && (TIPOS_PARTNER as readonly string[]).includes(v)
}

/** Normaliza o que veio da URL — qualquer coisa fora da lista vira "Todos",
 *  nunca erro de página. */
export function filtroTipoValido(v: unknown): FiltroTipoPartner {
  return ehTipoPartner(v) ? v : FILTRO_TODOS
}

/**
 * Quem tem direito ao Explorar COMPLETO (§10: "Clique abre perfil completo
 * para usuários ELEGÍVEIS").
 *
 * `ehPago` sozinho não responde isso, e por um motivo estrutural: aquela régua
 * é do PROPRIETÁRIO (`NivelPlano` só tem Free/Commander/Commander Pro), e um
 * Partner não é proprietário de embarcação nenhuma. Sem esta função, uma
 * Marina cadastrada clicaria em "Explorar" — item do MENU DELA no §13 — e
 * tomaria o paywall de gestão de barco, que não é o produto dela.
 *
 * As três portas, cada uma com a linha que a sustenta:
 *   · proprietário em plano pago — §2.3, por exclusão (o corte é do Free);
 *   · Captain Pro — §2 e §12 dizem, com estas palavras, "Explorar completo";
 *   · ter perfil de Partner — §13 põe "Explorar" no menu de TODOS os tipos,
 *     inclusive os gratuitos. Quem está do lado de dentro da rede não é
 *     tratado como visitante dela.
 *
 * O que continua bloqueado é exatamente quem o §2.3 nomeia: "Free
 * proprietário/Captain".
 */
export function explorarCompletoLiberado(sinal: {
  proprietarioPago: boolean
  plano: PlanoId
  temPerfilPartner: boolean
}): boolean {
  return sinal.proprietarioPago || sinal.plano === "captain_pro" || sinal.temPerfilPartner
}

export interface PartnerParaVitrine {
  id: string
  categoria: TipoPartner
  regiao_id: string
  atividades: readonly string[]
}

/**
 * §10 — o filtro da vitrine, os três eixos juntos: tipo de Partner,
 * categoria/atividade e região. Campo vazio significa "não filtra por isso"
 * (mesma regra de campo vazio do matching do §11.4), o que permite os quatro
 * estados úteis sem quatro funções.
 *
 * A categoria/atividade casa contra as atividades DECLARADAS pelo parceiro
 * (`parceiro_atividades`), que são ids da mesma `taxonomia` do Marketplace —
 * é o que o §10 quer dizer com "padronizadas e compartilhadas".
 */
export function filtrarVitrine<T extends PartnerParaVitrine>(
  parceiros: readonly T[],
  filtro: { tipo?: FiltroTipoPartner; atividadeId?: string | null; regiaoId?: string | null },
): T[] {
  return parceiros.filter((p) => {
    if (filtro.tipo && filtro.tipo !== FILTRO_TODOS && p.categoria !== filtro.tipo) return false
    if (filtro.regiaoId && p.regiao_id !== filtro.regiaoId) return false
    if (filtro.atividadeId && !p.atividades.includes(filtro.atividadeId)) return false
    return true
  })
}

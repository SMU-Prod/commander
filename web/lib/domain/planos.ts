/**
 * CATÁLOGO DE PLANOS (onda 47 — PRD FINAL `docs/prd/upgrade2-master-final.txt`
 * §2, §2.1, §2.2 e §28 "Decisões congeladas").
 *
 * Este arquivo é a fonte ÚNICA de preço, rótulo e capacidade de cada plano.
 * Dinheiro sempre em centavos (regra da casa) e o preço só existe aqui — nem
 * a tela nem a action repetem número nenhum.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O PLANO FUNDADOR SUMIU
 * ---------------------------------------------------------------------------
 * Até a onda 46 este módulo tinha só `fundador_mensal` (R$ 69,99) e
 * `fundador_anual` (R$ 699,90), com o mecanismo da promo "100 fundadores":
 * preço promocional travado por um tempo + contador de vagas. O PRD FINAL
 * (feature freeze) não menciona o plano fundador em lugar NENHUM — e a
 * consulta ao banco de produção em 15/08/2026 mostrou ZERO assinaturas. Ou
 * seja: ele nunca chegou a valer pra ninguém, e aposentá-lo agora não tira
 * nada de nenhum cliente.
 *
 * O que NÃO se perdeu foi o mecanismo. "Preço promocional temporário para um
 * plano, com data de fim e volta ao preço cheio" é exatamente o que o PRD §2.1
 * (migração de concorrente) e §2.2 (entrada direta pelo Gold) pedem — então a
 * máquina do fundador foi reaproveitada em `PROMOCOES`/`aplicarPromocao` logo
 * abaixo, em vez de deletada. Ganhou de quebra a regra que o fundador não
 * tinha: promoções NÃO ACUMULAM (§2.1, última linha).
 *
 * O que morreu junto e não voltou: `VAGAS_FUNDADOR`, `ANCORA_MENSAL_CENTAVOS`
 * (o preço "cheio" de R$ 119,90 era âncora de marketing da promo — o PRD
 * congelou R$ 49,90 como preço real do Commander, sem âncora) e a RPC
 * `vagas_fundador_restantes()` (removida na migration 048).
 */

/** Ciclo de cobrança como o gateway espera. Só existe pra plano cobrável. */
export type CicloAsaas = "MONTHLY" | "YEARLY"

/** A quem o plano pertence — decide qual menu/dashboard a pessoa vê (§3). */
export type PerfilPlano = "proprietario" | "captain" | "partner"

export type PlanoId =
  | "proprietario_free"
  | "commander"
  | "commander_pro"
  | "captain_free"
  | "captain_pro"
  | "partner_prestador"
  | "partner_loja"
  | "partner_marina"
  | "partner_posto"
  | "partner_restaurante"
  | "partner_pousada"
  // As cinco faixas do §2 do PRD Upgrade 3 (onda 69). Substituem o
  // `commander_enterprise` único que existia como reserva — ver o bloco
  // ENTERPRISE em `PLANOS` pra saber por que cinco e não um.
  | "commander_enterprise_5"
  | "commander_enterprise_10"
  | "commander_enterprise_20"
  | "commander_enterprise_30"
  | "commander_enterprise_40"

/** `em_breve` = aparece no catálogo como reservado, sem botão de assinar.
 *  Hoje só o Enterprise (§2: "Exibir apenas como reservado/Em breve.
 *  Definição no Upgrade 3"). */
export type DisponibilidadePlano = "disponivel" | "em_breve"

export interface Plano {
  id: PlanoId
  rotulo: string
  perfil: PerfilPlano
  /** Centavos por ciclo. `0` = grátis de verdade; `null` = preço a definir
   *  (Enterprise). Nunca inventa número que o PRD não deu. */
  valorCentavos: number | null
  /** `null` quando não há cobrança recorrente (grátis ou a definir). */
  ciclo: CicloAsaas | null
  /** Vai na descrição da assinatura no gateway — é o que o cliente lê na
   *  fatura, então fala a língua dele. */
  descricao: string
  /** A regra principal do plano, copiada da tabela do §2. É o texto que a
   *  tela de planos mostra — mantido aqui pra tela e catálogo nunca
   *  divergirem. */
  regra: string
  disponibilidade: DisponibilidadePlano
  /** Quantas embarcações o plano deixa CADASTRAR (§2, §28). `null` = o plano
   *  não cadastra embarcação (Captain e Partner recebem acesso, não criam). */
  limiteEmbarcacoes: number | null
  /** Acessos de tripulação por embarcação (§19, §28). Convite pendente ocupa
   *  vaga — a contagem é feita em `plano-acesso.ts`/no banco, aqui é só o
   *  teto. `0` no Free: "Não pode adicionar tripulação" (§2.3). */
  limiteAcessosPorEmbarcacao: number | null
  /** Diários de Bordo completos. `null` = sem limite. `2` no Free (§2.3, §28
   *  — sem "ex.:", é regra fechada). */
  limiteDiarios: number | null
  /** §2 marca Restaurante e Pousada/Hotel como "Grátis INICIALMENTE" — a
   *  diferença importa: é gratuidade de lançamento, não plano grátis
   *  permanente como Marina/Posto. A tela avisa isso pro parceiro. */
  gratuitoInicialmente: boolean
}

/** Planos aposentados na onda 47 — existem aqui só pra teste garantir que
 *  nenhum deles voltou pro catálogo por descuido. Nunca foram vendidos
 *  (0 assinaturas no banco em 15/08/2026). */
export const PLANOS_APOSENTADOS = ["fundador_mensal", "fundador_anual"] as const

/**
 * §2 — "Cotistas viewers são incluídos na licença da empresa". Dez por unidade
 * é a régua do §2, e precisa ser UM número.
 *
 * AUDITORIA 19/08, A20 — até aqui ele era escrito DUAS vezes: o argumento
 * `viewers` de `enterprise()`, que virava a frase de `regra` lida na tela, e a
 * conta `limite * 10` de `viewersIncluidos`. As duas concordavam nas cinco
 * faixas por sorte, e nada as comparava: bastava o dono revisar uma faixa pelo
 * argumento pra tela dizer 60 enquanto a função respondia 50.
 *
 * Mora ACIMA de `PLANOS` porque `enterprise()` a lê enquanto o objeto está
 * sendo construído — `const` não sobe, e declará-la junto de `viewersIncluidos`
 * derrubava o módulo inteiro no import.
 */
const VIEWERS_POR_UNIDADE = 10

export const PLANOS: Record<PlanoId, Plano> = {
  proprietario_free: {
    id: "proprietario_free",
    rotulo: "Proprietário Free",
    perfil: "proprietario",
    valorCentavos: 0,
    ciclo: null,
    descricao: "Commander — plano gratuito do proprietário",
    regra: "1 embarcação; 2 Diários completos; o resto em demonstração.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: 1,
    limiteAcessosPorEmbarcacao: 0,
    limiteDiarios: 2,
    gratuitoInicialmente: false,
  },
  commander: {
    id: "commander",
    rotulo: "Commander",
    perfil: "proprietario",
    valorCentavos: 4990,
    ciclo: "MONTHLY",
    // Sem "gestão" (palavra proibida pela narrativa — o produto é o DOSSIÊ do
    // barco): esta `descricao` vai na FATURA do Asaas, é o que o dono lê no
    // cartão de crédito. Auditoria de CMO, 18/08.
    descricao: "Commander — o dossiê de 1 embarcação",
    regra: "1 embarcação; até 2 acessos de tripulação; dossiê completo.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: 1,
    limiteAcessosPorEmbarcacao: 2,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  commander_pro: {
    id: "commander_pro",
    rotulo: "Commander Pro",
    perfil: "proprietario",
    valorCentavos: 6990,
    ciclo: "MONTHLY",
    descricao: "Commander Pro — até 4 embarcações com visão consolidada",
    regra: "Até 4 embarcações; até 2 acessos por embarcação; visão consolidada.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: 4,
    limiteAcessosPorEmbarcacao: 2,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  captain_free: {
    id: "captain_free",
    rotulo: "Captain Free",
    perfil: "captain",
    valorCentavos: 0,
    ciclo: null,
    descricao: "Captain — acesso operacional às embarcações",
    regra: "Opera embarcações conforme as permissões do proprietário; carreira profissional bloqueada.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  captain_pro: {
    id: "captain_pro",
    rotulo: "Captain Pro",
    perfil: "captain",
    valorCentavos: 2490,
    ciclo: "MONTHLY",
    descricao: "Captain Pro — perfil profissional e Marketplace",
    regra: "Perfil profissional, Marketplace, candidaturas, disponibilidade e Explorar completo.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  partner_prestador: {
    id: "partner_prestador",
    rotulo: "Partner — Prestador de Serviço",
    perfil: "partner",
    valorCentavos: 2490,
    ciclo: "MONTHLY",
    descricao: "Commander Partner — Prestador de Serviço",
    regra: "Perfil ativo, Explorar, oportunidades, propostas e histórico comercial.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  partner_loja: {
    id: "partner_loja",
    rotulo: "Partner — Loja Náutica",
    perfil: "partner",
    valorCentavos: 2490,
    ciclo: "MONTHLY",
    descricao: "Commander Partner — Loja Náutica",
    regra: "Perfil ativo, Explorar, demandas de produto e atividades complementares.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  partner_marina: {
    id: "partner_marina",
    rotulo: "Partner — Marina",
    perfil: "partner",
    valorCentavos: 0,
    ciclo: null,
    descricao: "Commander Partner — Marina",
    regra: "Perfil completo + Marketplace de vagas. Destaques pagos à parte.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  partner_posto: {
    id: "partner_posto",
    rotulo: "Partner — Posto Náutico",
    perfil: "partner",
    valorCentavos: 0,
    ciclo: null,
    descricao: "Commander Partner — Posto Náutico",
    regra: "Perfil completo + Solicitações de Caminhão. Destaques pagos à parte.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  },
  partner_restaurante: {
    id: "partner_restaurante",
    rotulo: "Partner — Restaurante",
    perfil: "partner",
    valorCentavos: 0,
    ciclo: null,
    descricao: "Commander Partner — Restaurante",
    regra: "Perfil no Explorar + cardápio em imagens.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: true,
  },
  partner_pousada: {
    id: "partner_pousada",
    rotulo: "Partner — Pousada/Hotel",
    perfil: "partner",
    valorCentavos: 0,
    ciclo: null,
    descricao: "Commander Partner — Pousada/Hotel",
    regra: "Perfil no Explorar + acomodações e informações náuticas.",
    disponibilidade: "disponivel",
    limiteEmbarcacoes: null,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: true,
  },
  // -------------------------------------------------------------------------
  // ENTERPRISE (onda 69 — PRD-UPGRADE-3-COTAS §2)
  // -------------------------------------------------------------------------
  // Até a onda 68 havia UM `commander_enterprise` com preço `null` e o
  // comentário "Definição no Upgrade 3". A definição chegou: o §2 traz cinco
  // faixas por número de unidades, e é por isso que um plano só não servia —
  // o que muda entre elas é capacidade, não recurso.
  //
  // `disponibilidade: "em_breve"` CONTINUA nas cinco, de propósito. O §2 diz
  // que são "faixas comerciais preliminares" e que "o preço final pode ser
  // revisado após medir infraestrutura e suporte em clientes-piloto" — então
  // o número entra no catálogo (a tela precisa dele pra conversar com o
  // cliente) mas o plano não vira vendável até o dono destravar. `ehCobravel`
  // já barra "em_breve", então nenhuma assinatura Enterprise é criada por
  // acidente enquanto isso.
  //
  // `limiteAcessosPorEmbarcacao` é `null` nas cinco: no Enterprise quem
  // limita acesso não é a embarcação, é a conta (viewers/cotistas por
  // licença, §2) e a régua de vagas por unidade do §13 — reaproveitar o teto
  // de tripulação aqui misturaria duas contagens diferentes.
  commander_enterprise_5: enterprise("commander_enterprise_5", 5, 19990),
  commander_enterprise_10: enterprise("commander_enterprise_10", 10, 29990),
  commander_enterprise_20: enterprise("commander_enterprise_20", 20, 54990),
  commander_enterprise_30: enterprise("commander_enterprise_30", 30, 79990),
  commander_enterprise_40: enterprise("commander_enterprise_40", 40, 99990),
}

/** Uma faixa Enterprise. Existe pra as cinco linhas acima não serem cinco
 *  cópias do mesmo objeto — e pra "unidades" e "viewers" saírem do mesmo
 *  lugar em que o §2 os escreveu. */
function enterprise(
  id: PlanoId,
  unidades: number,
  valorCentavos: number,
): Plano {
  const viewers = unidades * VIEWERS_POR_UNIDADE
  return {
    id,
    rotulo: `Commander Enterprise ${unidades}`,
    perfil: "proprietario",
    valorCentavos,
    ciclo: "MONTHLY",
    descricao: `Commander Enterprise — até ${unidades} unidades`,
    regra: `Até ${unidades} unidades; até ${viewers} cotistas incluídos na licença.`,
    disponibilidade: "em_breve",
    limiteEmbarcacoes: unidades,
    limiteAcessosPorEmbarcacao: null,
    limiteDiarios: null,
    gratuitoInicialmente: false,
  }
}

/**
 * Quantos cotistas viewers a licença inclui (§2: "Cotistas viewers são
 * incluídos na licença da empresa; não são cobrados individualmente para o
 * acesso básico"). `null` = o plano não é Enterprise.
 *
 * SEM CONSUMIDOR HOJE, DE PROPÓSITO (auditoria 19/08, A20). O número JÁ chega
 * à tela — pela frase de `regra`, que `/assinar` imprime no cartão "Em breve"
 * (`app/(assinatura)/assinar/page.tsx:195`). Quem precisa dele como NÚMERO, e
 * não como frase, é a única coisa que o Enterprise ainda não tem: o painel que
 * conta quantos viewers a empresa já usou contra o teto da licença ("38 de
 * 50"). Esse painel só faz sentido depois que existir empresa Enterprise, e
 * hoje as cinco faixas são `disponibilidade: "em_breve"` — `ehCobravel` barra
 * todas, nenhuma assinatura Enterprise pode ser criada.
 *
 * Não foi apagada porque, ao contrário de `escolherPromocao` (apagada logo
 * abaixo), o caminho até o consumidor existe e é curto: destravar as faixas é
 * decisão comercial do dono, não código que falta. E ela deixou de ser uma
 * segunda fonte de verdade quando passou a dividir `VIEWERS_POR_UNIDADE` com a
 * frase — que era o risco real de mantê-la.
 */
export function viewersIncluidos(id: PlanoId): number | null {
  const limite = PLANOS[id].limiteEmbarcacoes
  return ehPlanoEnterprise(id) && limite != null ? limite * VIEWERS_POR_UNIDADE : null
}

export function ehPlanoEnterprise(id: PlanoId): boolean {
  return id.startsWith("commander_enterprise")
}

/** §2, última linha da tabela: acima de 40 unidades é "personalizado / sob
 *  consulta". A tela precisa dizer isso em vez de simplesmente não ter opção
 *  — empresa com 60 Jets não pode achar que o Commander não serve pra ela. */
export const ENTERPRISE_SOB_CONSULTA_ACIMA_DE = 40

/**
 * §14 — o plano pessoal do cotista, que NÃO substitui o acesso básico dado
 * pela administradora.
 *
 * É O ÚNICO RESTO DO §14 NO CÓDIGO, e é assim de propósito: a auditoria 19/08
 * (A8) apagou o bloco de venda inteiro de `lib/domain/cotista-plano.ts` —
 * headline, nove recursos, copy — porque `cotista_individual` não existe em
 * `PLANOS`, logo não está em `PLANOS_COBRAVEIS`, logo a constraint
 * `assinaturas_plano_check` do banco recusaria a linha. Não há como cobrar.
 * O preço fica aqui, com os outros preços, para o dia em que houver checkout;
 * a leitura longa do porquê está em `cotista-plano.ts:14-44`.
 */
export const COTISTA_INDIVIDUAL_CENTAVOS = 2490

/**
 * Planos que geram assinatura no gateway — grátis não vira linha de assinatura
 * e "em breve" não é vendável.
 *
 * QUEM CHAMA ISTO É O TESTE, e esse é o trabalho dela (auditoria 19/08, A20).
 * Quem decide se um plano pode ser contratado é `ehCobravel`, um id por vez —
 * é o que a action `assinar` e a tela `/assinar` usam. Esta lista é o INVENTÁRIO
 * derivado, e existe para `planos.test.ts:96` travá-la contra as cinco strings
 * que a constraint `assinaturas_plano_check` aceita. Conferido no banco vivo em
 * 19/08: a constraint lista exatamente `commander`, `commander_pro`,
 * `captain_pro`, `partner_prestador`, `partner_loja`. Sem esta trava, tornar um
 * plano vendável no catálogo compila, passa, sobe — e só falha no INSERT do
 * primeiro cliente que tentar pagar.
 */
export const PLANOS_COBRAVEIS: readonly PlanoId[] = (Object.keys(PLANOS) as PlanoId[]).filter(
  (id) => ehCobravel(id),
)

export function ehCobravel(id: PlanoId): boolean {
  const p = PLANOS[id]
  return p.disponibilidade === "disponivel" && p.valorCentavos != null && p.valorCentavos > 0 && p.ciclo != null
}

/** Planos de um perfil, na ordem do catálogo (grátis primeiro, depois pagos,
 *  "em breve" por último) — é a ordem em que a tela de planos lista. */
export function planosDoPerfil(perfil: PerfilPlano): Plano[] {
  return (Object.keys(PLANOS) as PlanoId[])
    .map((id) => PLANOS[id])
    .filter((p) => p.perfil === perfil)
    .sort((a, b) => {
      if (a.disponibilidade !== b.disponibilidade) return a.disponibilidade === "disponivel" ? -1 : 1
      return (a.valorCentavos ?? Number.MAX_SAFE_INTEGER) - (b.valorCentavos ?? Number.MAX_SAFE_INTEGER)
    })
}

/**
 * Próximo degrau pago a oferecer a quem já está em `planoAtual`. `null` = não
 * há upgrade a oferecer (já está no topo do perfil, ou o próximo é "em breve"
 * e não pode ser vendido).
 *
 * Diferente da versão antiga (que só trocava mensal→anual porque existia UM
 * nível pago), agora o upgrade é de VALOR: Free → Commander → Commander Pro.
 * Enterprise nunca entra: §2 manda exibir como reservado, não vender.
 */
export function proximoUpgrade(planoAtual: PlanoId): PlanoId | null {
  switch (planoAtual) {
    case "proprietario_free":
      return "commander"
    case "commander":
      return "commander_pro"
    case "captain_free":
      return "captain_pro"
    default:
      return null
  }
}

/** Caminho inverso do `proximoUpgrade` — pra onde o plano cai quando a
 *  assinatura acaba (§23: "conta volta ao nível Free aplicável"). */
export function freeEquivalente(planoAtual: PlanoId): PlanoId {
  switch (PLANOS[planoAtual].perfil) {
    case "captain":
      return "captain_free"
    case "partner":
      // Partner sem assinatura não vira "Partner grátis" automaticamente — os
      // tipos gratuitos (Marina/Posto) são OUTRO cadastro, não um degrau
      // abaixo do Prestador/Loja. Sem plano pago, o que sobra é a conta de
      // pessoa física dele.
      return "proprietario_free"
    default:
      return "proprietario_free"
  }
}

// ---------------------------------------------------------------------------
// PROMOÇÕES (§2.1 e §2.2) — o mecanismo que herdou a máquina do fundador
// ---------------------------------------------------------------------------

export type PromocaoId = "migracao_concorrente" | "entrada_gold"

export interface Promocao {
  id: PromocaoId
  rotulo: string
  descricao: string
  /** Qual plano a promoção entrega. Ambas entregam Commander hoje. */
  planoAlvo: PlanoId
  /** Quanto o cliente paga POR MÊS enquanto a promoção vale. `0` = incluído
   *  (não gera cobrança — caso do §2.2, "recebe 6 meses do plano Commander
   *  incluídos"). */
  valorPromocionalCentavos: number
  /** Quantos meses a promoção dura antes de voltar ao preço cheio. */
  duracaoMeses: number
  /** Desconto na avaliação Commander Gold enquanto a promoção vale (§2.1:
   *  "20% de desconto na avaliação para Commander Gold"). 0 = nenhum. */
  descontoGoldPercentual: number
}

export const PROMOCOES: Record<PromocaoId, Promocao> = {
  migracao_concorrente: {
    id: "migracao_concorrente",
    rotulo: "Migração de concorrente",
    descricao:
      "Cliente comprovadamente vindo de outro aplicativo: R$ 24,90/mês por 3 meses no Commander, " +
      "com 20% de desconto na avaliação Commander Gold no mesmo período.",
    planoAlvo: "commander",
    valorPromocionalCentavos: 2490,
    duracaoMeses: 3,
    descontoGoldPercentual: 20,
  },
  entrada_gold: {
    id: "entrada_gold",
    rotulo: "Entrada direta pelo Gold",
    descricao:
      "Quem contrata a avaliação Commander Gold pelo preço integral e tem a embarcação aprovada " +
      "recebe 6 meses do plano Commander incluídos.",
    planoAlvo: "commander",
    valorPromocionalCentavos: 0,
    duracaoMeses: 6,
    descontoGoldPercentual: 0,
  },
}

/*
 * AUDITORIA 19/08, A20 — AQUI MORAVAM `escolherPromocao`,
 * `economiaDaPromocao` E `validadeDaPromocao`. AS TRÊS FORAM APAGADAS.
 *
 * As três eram funções do momento de CONCEDER uma promoção: qual das duas
 * ofertas vence quando as duas se aplicam (§2.1, "não acumulam"), quanto cada
 * uma economiza, e até que dia a concessão vale. Nenhuma tinha consumidor
 * fora do próprio teste, e o motivo não é esquecimento — é que o app NÃO TEM
 * como conceder promoção, e não é questão de faltar tela:
 *
 *   Medido em `pg_policies` no banco de hoje: `assinatura_promocoes` tem RLS
 *   ligada e UMA policy, "promocoes: ver a propria", de SELECT. Não existe
 *   policy de INSERT. Nenhum código autenticado do Commander consegue gravar
 *   uma linha ali — a concessão é ato da operação, feito por fora. A tabela
 *   tem 0 linhas.
 *
 * Manter as três seria o defeito que o A20 aponta: código que só o próprio
 * teste usa dá a impressão de que a funcionalidade existe. Quem lesse
 * `escolherPromocao` com 11 casos verdes concluiria que o Commander decide
 * entre as duas ofertas — ele não decide, porque nunca chega a ter duas
 * candidatas na mão. Mesmo tratamento que a onda 57 deu a `rotuloDoSelo` e
 * esta mesma auditoria deu a `alertaViraAfazerAutomaticamente`.
 *
 * O QUE FICA, porque tem consumidor de verdade: `PROMOCOES` (a tabela de
 * ofertas, lida na tela de assinar), `precoVigenteCentavos` (usada por
 * `/assinar` e por `lib/acoes/assinatura.ts`) e `precoGoldComDesconto` —
 * esta última ligada nesta rodada em `lib/acoes/gold.ts`, no ponto em que o
 * valor da avaliação vira cobrança.
 *
 * O QUE PRECISA EXISTIR PARA AS TRÊS VOLTAREM (nesta ordem): uma policy de
 * INSERT em `assinatura_promocoes` — provavelmente restrita a papel de
 * admin/suporte, como as demais tabelas de operação — e a tela que concede.
 * Aí a regra de desempate volta a ser decisão de código e volta com teste.
 *
 * A REGRA EM SI, para não se perder junto com o código: quando as duas
 * ofertas se aplicam, vence a que economiza mais no total (duração × desconto
 * por mês); e a validade soma meses de calendário, com 31/01 + 1 mês caindo
 * em 28/02 e nunca em 03/03, pra ninguém perder dia por causa de mês curto.
 */

/** Quanto cobrar por mês agora: o valor da promoção quando ela ainda vale,
 *  senão o preço cheio do plano. `null` = plano sem preço definido. */
export function precoVigenteCentavos(
  plano: PlanoId,
  promocao: { promocao: PromocaoId; validoAte: string } | null,
  hoje: string,
): number | null {
  if (promocao != null && promocao.validoAte >= hoje && PROMOCOES[promocao.promocao].planoAlvo === plano) {
    return PROMOCOES[promocao.promocao].valorPromocionalCentavos
  }
  return PLANOS[plano].valorCentavos
}

/** Preço da avaliação Gold com o desconto da promoção vigente (§2.1).
 *  Arredonda pra baixo no centavo — nunca cobra a mais que o anunciado. */
export function precoGoldComDesconto(
  valorCentavos: number,
  promocao: { promocao: PromocaoId; validoAte: string } | null,
  hoje: string,
): number {
  if (promocao == null || promocao.validoAte < hoje) return valorCentavos
  const pct = PROMOCOES[promocao.promocao].descontoGoldPercentual
  if (pct <= 0) return valorCentavos
  return Math.floor((valorCentavos * (100 - pct)) / 100)
}

/** "R$ 49,90" — usado em toda tela que fala de dinheiro. O `replace` troca o
 *  espaço não separável que o Intl coloca depois do "R$" por espaço normal,
 *  senão o texto quebra em comparações e em busca na página. */
export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00A0/g, " ")
}

/** Preço pra tela: "R$ 49,90/mês", "Grátis" ou "A definir" — um lugar só,
 *  porque cada tela escrevendo o seu vira divergência na primeira mudança. */
export function precoEmTexto(id: PlanoId): string {
  const p = PLANOS[id]
  if (p.valorCentavos == null) return "A definir"
  if (p.valorCentavos === 0) return p.gratuitoInicialmente ? "Grátis inicialmente" : "Grátis"
  return `${formatarPreco(p.valorCentavos)}${p.ciclo === "YEARLY" ? "/ano" : "/mês"}`
}

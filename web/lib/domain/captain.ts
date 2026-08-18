/**
 * CAPTAIN E CARREIRA PROFISSIONAL (onda 50).
 * PRD FINAL `docs/prd/upgrade2-master-final.txt` §12 inteiro, apoiado em §2
 * (Captain Free x Captain Pro), §11.3 (disponibilidade), §13.1 (Prestador) e
 * §14 (avaliações).
 *
 * ---------------------------------------------------------------------------
 * A SEPARAÇÃO QUE ESTE ARQUIVO EXISTE PARA GUARDAR
 * ---------------------------------------------------------------------------
 * O §12 tem duas frases que parecem redundantes e não são:
 *
 *   "Captain Free pode operar a embarcação conforme permissões do
 *    proprietário; isso NÃO DEPENDE de Captain Pro."
 *   "Captain Pro NUNCA concede acesso adicional à embarcação por si só."
 *
 * Juntas, elas dizem que EMBARCAÇÃO e CARREIRA são dois eixos que não se
 * tocam. O acesso ao barco vem do convite do dono e da matriz de permissões
 * dele (`permissoes.ts`, `vinculos`); a carreira vem da assinatura da própria
 * pessoa. Um comandante contratado nunca fica sem trabalhar por não assinar
 * nada — e ninguém compra acesso ao barco de terceiro assinando R$ 24,90.
 *
 * Por isso este módulo NÃO exporta nenhuma função que devolva permissão de
 * embarcação, e `plano-acesso.ts` (o eixo do barco) devolve `null` em
 * `comoNivel("captain_pro")`. Os dois lados são testados justamente na
 * fronteira, em `captain.test.ts` — a garantia é a ausência, e ausência só
 * fica garantida quando alguém a afirma em teste.
 *
 * A mesma régua vale no banco: a migration 051 tem uma asserção executável
 * que faz a migration FALHAR se alguma policy de tabela de embarcação passar
 * a consultar plano.
 */

import { PLANOS, type PlanoId } from "./planos"

/** Os dois tipos de perfil profissional que dividem `perfis_comandante`
 *  desde a migration 037. Repetido aqui (em vez de importado de
 *  `lib/db/types`) porque este módulo é regra pura: ele descreve o PRD, não o
 *  formato da linha do banco. */
export type TipoPerfilProfissional = "comandante" | "prestador"

/**
 * Qual plano ATIVA o perfil profissional de cada tipo.
 *
 * §12: Captain Pro desbloqueia "perfil ativo" pro comandante.
 * §13.1: Prestador de Serviço, R$ 24,90, tem "Perfil ativo" pela mesma lógica.
 *
 * Espelho exato de `plano_que_ativa_perfil()` (migration 051). Duas cópias de
 * propósito: o banco GARANTE (a vitrine não devolve a linha) e o app EXPLICA
 * (a tela diz qual assinatura falta). Sem a cópia daqui, a tela teria que
 * adivinhar o motivo de o perfil não aparecer.
 */
export const PLANO_QUE_ATIVA_PERFIL: Record<TipoPerfilProfissional, PlanoId> = {
  comandante: "captain_pro",
  prestador: "partner_prestador",
}

/**
 * A "camada profissional" do §12, item por item, na ordem em que a frase do
 * PRD os lista: "perfil ativo, Explorar completo, Marketplace, candidaturas,
 * disponibilidade, avaliações e histórico de trabalhos".
 *
 * É uma união fechada porque cada tela que quiser um portão novo precisa
 * entrar aqui — e aí o TypeScript obriga a escrever a mensagem de bloqueio
 * correspondente. Portão sem explicação é cadeado mudo.
 */
export type RecursoCarreira =
  | "perfil_ativo"
  | "explorar_completo"
  | "marketplace_candidatura"
  | "disponibilidade"
  | "avaliacoes"
  | "historico_trabalhos"

export const RECURSOS_CARREIRA: readonly RecursoCarreira[] = [
  "perfil_ativo",
  "explorar_completo",
  "marketplace_candidatura",
  "disponibilidade",
  "avaliacoes",
  "historico_trabalhos",
]

/**
 * Este recurso de CARREIRA está liberado para quem tem este plano?
 *
 * `tipo` decide qual assinatura conta: o comandante paga Captain Pro, o
 * prestador paga Partner Prestador. Nenhum dos dois libera nada do outro —
 * pagar Captain Pro não põe ninguém na vitrine de Prestadores.
 *
 * Nunca recebe nem devolve nada sobre embarcação. Ver o cabeçalho.
 */
export function carreiraLiberada(
  recurso: RecursoCarreira,
  plano: PlanoId,
  tipo: TipoPerfilProfissional = "comandante",
): boolean {
  // `recurso` não altera a resposta hoje: o §12 lista a camada inteira como
  // um pacote só, e inventar degraus internos seria vender uma escada que o
  // PRD não desenhou. O parâmetro existe porque a MENSAGEM é diferente por
  // recurso e porque um portão futuro vai precisar dele — sem ele, cada tela
  // reescreveria a chamada quando a régua deixasse de ser uniforme.
  void recurso
  return plano === PLANO_QUE_ATIVA_PERFIL[tipo]
}

/**
 * O perfil profissional desta pessoa aparece na vitrine?
 *
 * Espelho de `perfil_profissional_ativo()` (migration 051): a VONTADE
 * (`visivel`, o marcador que a própria pessoa liga) e a CONDIÇÃO (o plano)
 * precisam ser verdade ao mesmo tempo. A tela usa isto pra dizer qual das
 * duas está faltando — o banco já garante o resultado.
 */
export function perfilNaVitrine(entrada: {
  tipo: TipoPerfilProfissional
  visivel: boolean
  plano: PlanoId
}): boolean {
  return entrada.visivel && carreiraLiberada("perfil_ativo", entrada.plano, entrada.tipo)
}

/** Por que o perfil não está no ar — `null` quando está. Duas causas
 *  possíveis e uma frase pra cada, porque "seu perfil não aparece" sem o
 *  motivo é a pior tela que dá pra escrever. */
export function motivoForaDaVitrine(entrada: {
  tipo: TipoPerfilProfissional
  visivel: boolean
  plano: PlanoId
}): { titulo: string; descricao: string } | null {
  if (perfilNaVitrine(entrada)) return null
  const exigido = PLANOS[PLANO_QUE_ATIVA_PERFIL[entrada.tipo]]
  const onde = entrada.tipo === "comandante" ? "Comandantes" : "Prestadores"

  if (!entrada.visivel) {
    return {
      titulo: "Seu perfil está oculto por escolha sua",
      descricao:
        `Marque "Aparecer na lista de ${onde.toLowerCase()}" para voltar à vitrine. ` +
        "Tudo o que você preencheu continua salvo enquanto isso.",
    }
  }
  return {
    titulo: `Seu perfil aparece na vitrine com o ${exigido.rotulo}`,
    descricao:
      `Você pode preencher e revisar o perfil inteiro sem assinar nada — ele só entra na lista de ${onde} ` +
      `para os proprietários depois do ${exigido.rotulo}. O acesso às embarcações que você já opera não ` +
      "muda em nada: isso vem do convite do proprietário, não de assinatura.",
  }
}

/** Texto do cadeado de cada recurso da camada profissional. Fonte única —
 *  usada pelo componente de bloqueio e pela tela de assinatura. */
export function mensagemCarreiraBloqueada(
  recurso: RecursoCarreira,
  tipo: TipoPerfilProfissional = "comandante",
): { titulo: string; descricao: string } {
  const preco = PLANOS[PLANO_QUE_ATIVA_PERFIL[tipo]].rotulo
  switch (recurso) {
    case "perfil_ativo":
      return {
        titulo: `Perfil na vitrine é do ${preco}`,
        descricao:
          "Você monta o perfil inteiro de graça. Aparecer para quem procura profissional é o que a " +
          "assinatura libera.",
      }
    case "explorar_completo":
      return {
        titulo: `Explorar completo é do ${preco}`,
        descricao:
          "Sem assinatura, o Explorar mostra uma amostra de parceiros só com foto e nome. Perfil completo, " +
          "contato e ação comercial vêm com a assinatura.",
      }
    case "marketplace_candidatura":
      return {
        titulo: `Candidatar-se é do ${preco}`,
        descricao:
          "Você vê as demandas abertas e monta a proposta inteira. Enviar a candidatura para o proprietário " +
          "é o que a assinatura libera.",
      }
    case "disponibilidade":
      return {
        titulo: `Publicar disponibilidade é do ${preco}`,
        descricao:
          "Anunciar o seu período de trabalho para os proprietários da sua região é da camada profissional. " +
          "O acesso às embarcações que você já opera não depende disso.",
      }
    case "avaliacoes":
      return {
        titulo: `Receber avaliações é do ${preco}`,
        descricao:
          "A nota só nasce de negócio fechado e confirmado pelos dois lados aqui dentro — e para fechar " +
          "negócio pelo Commander é preciso estar na vitrine.",
      }
    case "historico_trabalhos":
      return {
        titulo: `Histórico de trabalhos é do ${preco}`,
        descricao:
          "Cada negócio confirmado pelos dois lados vira uma linha do seu currículo dentro do Commander. " +
          "O histórico aparece no seu perfil com a assinatura ativa.",
      }
  }
}

/**
 * A trilha da conta (§3) — qual dashboard/menu/tela de plano a pessoa vê.
 *
 * Não existe coluna "tipo de conta" no banco, e isso é proposital: a mesma
 * pessoa pode ser dona de um barco E comandante do barco de outro. A trilha
 * é DEDUZIDA dos fatos que já existem, na ordem de quem paga o quê:
 *
 *   1. Assinatura vigente manda. Quem paga Captain Pro é Captain, ponto.
 *   2. Sem assinatura de carreira, ser PROP de alguma embarcação manda —
 *      é quem tem o que gerenciar e quem vê paywall de gestão.
 *   3. Sem barco próprio, ser tripulação de alguém (ou já ter perfil de
 *      comandante) faz da pessoa um Captain: foi convidada pra operar.
 *   4. Perfil de prestador sem nada disso: trilha Partner.
 *   5. Nada de nada: proprietário — é a trilha do onboarding, de quem acabou
 *      de chegar pra cadastrar o próprio barco.
 */
export type TrilhaDaConta = "proprietario" | "captain" | "partner"

export function trilhaDaConta(sinal: {
  plano: PlanoId
  ehProprietario: boolean
  ehTripulacao: boolean
  tipoPerfilProfissional: TipoPerfilProfissional | null
}): TrilhaDaConta {
  const perfilDoPlano = PLANOS[sinal.plano].perfil
  if (perfilDoPlano === "captain") return "captain"
  if (perfilDoPlano === "partner") return "partner"
  if (sinal.ehProprietario) return "proprietario"
  if (sinal.ehTripulacao || sinal.tipoPerfilProfissional === "comandante") return "captain"
  if (sinal.tipoPerfilProfissional === "prestador") return "partner"
  return "proprietario"
}

/**
 * O degrau de carreira que a pessoa ocupa hoje, pra tela mostrar o rótulo
 * certo. Quem não paga carreira nenhuma é **Captain Free** — e essa é
 * exatamente a frase do §12 sobre quem entra por convite: "a conta vinculada
 * funciona como Captain Free".
 *
 * `carregarAssinatura` devolve `proprietario_free` pra quem não tem
 * assinatura (é o Free de quem tem barco). Traduzir isso pra `captain_free`
 * quando a trilha é Captain não é enfeite: é a diferença entre a tela dizer
 * "Proprietário Free" pra um comandante contratado — que não tem barco
 * nenhum — e dizer o nome do degrau em que ele realmente está.
 */
export function planoDeCarreira(plano: PlanoId, trilha: TrilhaDaConta): PlanoId {
  if (trilha !== "captain") return plano
  return plano === "captain_pro" ? "captain_pro" : "captain_free"
}

/** O que o Captain Pro entrega, na ordem do §12. Lista única — a tela de
 *  assinatura, o cartão de bloqueio e o perfil leem daqui, pra nunca
 *  prometerem coisas diferentes. */
export const O_QUE_O_CAPTAIN_PRO_LIBERA: readonly string[] = [
  "Perfil profissional ativo na vitrine de Comandantes",
  "Explorar Parceiros completo, com perfil e contato",
  "Marketplace com as demandas de tripulação da sua região",
  "Candidatura às vagas publicadas pelos proprietários",
  "Publicar sua disponibilidade (função, região, período e porte)",
  "Avaliações de negócios confirmados pelos dois lados",
  "Histórico de trabalhos confirmados dentro do Commander",
]

/** O que o Captain FREE já faz — dito na afirmativa, porque é a metade do
 *  §12 que costuma sumir da conversa: o comandante contratado trabalha sem
 *  pagar nada. Espelha `O_QUE_O_FREE_FAZ` (plano-acesso.ts) no outro eixo. */
export const O_QUE_O_CAPTAIN_FREE_FAZ: readonly string[] = [
  "Operar as embarcações em que você foi convidado, com as permissões que o proprietário deu",
  "Diário de Bordo, hubs técnicos e histórico do barco conforme essas permissões",
  "Avisos de vencimento e alertas de segurança — sempre, sem cadeado",
  "Montar o perfil profissional inteiro e ver como ele fica",
]

// ---------------------------------------------------------------------------
// Onda 62 (canvas tela-3l) — os micro-KPIs do cartão de pessoa
// ---------------------------------------------------------------------------

export interface MicroKpiPerfil {
  /** Etiqueta de instrumento — mono 11px uppercase na tela. */
  rotulo: string
  /** Valor em mono. */
  valor: string
}

/**
 * Os chips de número do cartão da vitrine (canvas: "Saídas 86 · Nota 4,8").
 * O Commander não conta saídas de comandante — os números DECLARADOS que o
 * §12 pede no perfil são experiência e porte, então são eles que viram chip.
 * Só entra o que a pessoa realmente preencheu: chip vazio ou "0" inventado
 * é pior que ausência (a nota, quando existe, vem de `SeloReputacao`, que já
 * carrega média + quantidade do §14).
 */
export function microKpisDoPerfil(perfil: {
  experiencia_anos: number | null
  porte_max_pes: number | null
}): MicroKpiPerfil[] {
  const kpis: MicroKpiPerfil[] = []
  if (perfil.experiencia_anos != null) {
    kpis.push({
      rotulo: "Experiência",
      valor: `${perfil.experiencia_anos} ano${perfil.experiencia_anos === 1 ? "" : "s"}`,
    })
  }
  if (perfil.porte_max_pes != null) {
    kpis.push({ rotulo: "Porte", valor: `até ${perfil.porte_max_pes} pés` })
  }
  return kpis
}

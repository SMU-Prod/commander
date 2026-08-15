/**
 * O QUE CADA PLANO LIBERA (onda 47 — PRD FINAL §2, §2.3, §19, §23, §28).
 *
 * Substitui a régua binária Free/Premium da onda 38. Agora o degrau é o plano
 * de verdade (`PlanoId`), porque Commander e Commander Pro liberam os MESMOS
 * recursos e diferem só em capacidade (1 vs 4 embarcações) — uma régua de dois
 * valores não conseguia expressar isso.
 *
 * Duas decisões puras, como antes (nunca consultam o banco — quem chama junta
 * o sinal em `web/lib/consultas.ts` e entrega pronto aqui, mesmo espírito de
 * `semaforo.ts`/`verified.ts`/`gold.ts`):
 *
 *   1. `nivelPlano`      — em que degrau esta embarcação/pessoa está?
 *   2. `recursoLiberado` — este recurso específico está liberado nesse degrau?
 *
 * ---------------------------------------------------------------------------
 * A REGRA QUE NÃO PODE ESCAPAR (§23)
 * ---------------------------------------------------------------------------
 * "Falha persistente/cancelamento → conta volta ao nível Free aplicável,
 * PRESERVANDO DADOS E HISTÓRICO; recursos pagos ficam BLOQUEADOS, NÃO
 * APAGADOS."
 *
 * Isso vale também pra mudança de régua: o teto do Diário no Free caiu de 20
 * (escolha da onda 38, quando o PRD dizia "ex.: até 2") pra 2 (PRD FINAL, sem
 * "ex.:", §2.3 e §28). Quem já tem 9 Diários MANTÉM os 9 — pode abrir, ler,
 * editar, imprimir e exportar todos. O limite só barra CRIAR o próximo.
 * Nenhuma função deste módulo é consultada em caminho de LEITURA; a única
 * pergunta que ele responde é "pode criar mais um?". `avisoAcervoAcimaDoTeto`
 * existe justamente pra tela dizer isso em voz alta em vez de a pessoa achar
 * que vai perder coisa.
 *
 * ---------------------------------------------------------------------------
 * SEGURANÇA NUNCA ENTRA NO PAYWALL
 * ---------------------------------------------------------------------------
 * Decisão de produto, não detalhe de escopo. O alarme de âncora e o MOB vivem
 * em `web/components/mapa/navegar-mapa.tsx` e os avisos de vencimento de
 * documento/manutenção usam o farol de `web/lib/domain/semaforo.ts` + os
 * pushes de `web/lib/acoes/push.ts`/`web/lib/domain/alertas.ts`. Nenhum desses
 * arquivos importa nada deste módulo — a AUSÊNCIA de qualquer chamada a
 * `nivelPlano`/`recursoLiberado` ali É a garantia: colocar segurança atrás de
 * assinatura tiraria justo de quem mais precisa, na hora que mais importa.
 */

import { PLANOS, type PlanoId } from "./planos"

/** Degrau do PROPRIETÁRIO — o subconjunto de `PlanoId` que decide o acesso à
 *  gestão de uma embarcação. Captain e Partner têm régua própria (o plano
 *  deles não muda o que a EMBARCAÇÃO libera; §12: "Captain Pro nunca concede
 *  acesso adicional à embarcação por si só"). */
export type NivelPlano = Extract<PlanoId, "proprietario_free" | "commander" | "commander_pro">

/** Ordem do degrau, pra comparar sem `if` aninhado. */
const ORDEM: Record<NivelPlano, number> = {
  proprietario_free: 0,
  commander: 1,
  commander_pro: 2,
}

/** O que o `web/lib/consultas.ts` traz do banco pra decidir o degrau — nunca
 *  mais que isso: o domínio não precisa saber COMO a assinatura ou a concessão
 *  foram lidas, só o resultado. */
export interface SinalPlano {
  /** Plano da assinatura VIVA do proprietário — "ativa" ou
   *  "problema_pagamento" dentro da tolerância (§23: durante a tolerância os
   *  recursos continuam liberados, com aviso claro antes de bloquear). Quem
   *  monta o sinal é `carregarNivelPlano`, que usa `avaliarCiclo`
   *  (`assinatura-ciclo.ts`) pra decidir se a tolerância ainda cobre.
   *  `null` = sem assinatura viva. */
  planoAssinatura: PlanoId | null
  /** Concessão vigente de `premium_concessoes` — Gold aprovado (§2.2) ou
   *  promoção (§2.1). Traz QUAL plano concede e até quando. `null` = nenhuma. */
  concessao: { plano: PlanoId; validoAte: string } | null
}

/**
 * O degrau do proprietário. Assinatura paga e concessão contam IGUAL: as duas
 * são formas legítimas de ter o plano, o app nunca trata uma como "de verdade"
 * e a outra como "quase". Se as duas existirem, vale a MAIOR (§2.1 diz que os
 * benefícios não acumulam, mas quando por algum motivo os dois existirem o
 * cliente nunca sai perdendo). `hoje` explícito (AAAA-MM-DD, mesmo formato de
 * `hojeISO()`) pra ser testável sem mockar relógio.
 */
export function nivelPlano(sinal: SinalPlano, hoje: string): NivelPlano {
  const candidatos: NivelPlano[] = ["proprietario_free"]
  if (sinal.planoAssinatura != null) {
    const n = comoNivel(sinal.planoAssinatura)
    if (n) candidatos.push(n)
  }
  if (sinal.concessao != null && sinal.concessao.validoAte >= hoje) {
    const n = comoNivel(sinal.concessao.plano)
    if (n) candidatos.push(n)
  }
  return candidatos.reduce((a, b) => (ORDEM[b] > ORDEM[a] ? b : a))
}

/** Um plano qualquer virando degrau de proprietário. Captain Pro/Partner
 *  devolvem `null` — pagar Captain Pro não libera a gestão de nenhuma
 *  embarcação (§12). */
export function comoNivel(plano: PlanoId): NivelPlano | null {
  return plano === "commander" || plano === "commander_pro" || plano === "proprietario_free" ? plano : null
}

/** Atalho honesto pra "este degrau é pago?" — usado onde a tela só precisa
 *  saber se mostra cadeado, sem se importar com Commander vs Pro. */
export function ehPago(nivel: NivelPlano): boolean {
  return ORDEM[nivel] > 0
}

// ---------------------------------------------------------------------------
// §2.3 — o que o Free faz e o que ele só demonstra
// ---------------------------------------------------------------------------

/**
 * Recursos com portão. Adicionar um recurso novo aqui é o único lugar que
 * precisa mudar: a união do tipo obriga a tratar o caso novo em
 * `recursoLiberado`/`mensagemBloqueio` — o TypeScript quebra a build se
 * esquecer.
 *
 * Cada um sai direto de uma linha do §2.3:
 *   · `diario_registros`         "criar e consultar exatamente 2 Diários completos"
 *   · `marketplace_publicar`     "pode preencher o fluxo de uma demanda, mas o
 *                                 botão Publicar aciona o paywall"
 *   · `agenda_criar`             "Agenda e Financeiro podem ser visualizados
 *   · `financeiro_lancar`         como estrutura, mas criação/lançamento ficam
 *                                 bloqueados"
 *   · `tripulacao_adicionar`     "Não pode adicionar tripulação"
 *   · `explorar_perfil_completo` "alguns Partners aleatórios mostram somente
 *                                 foto + nome; todo o restante do perfil e
 *                                 qualquer contato/ação ficam bloqueados"
 *   · `fotos` e `compartilhar_saida` vêm da onda 38 e o PRD FINAL não os
 *     contradiz (§4.9 deixa o teto de armazenamento por plano pra "fase
 *     posterior"), então continuam como estavam.
 */
export type RecursoControlado =
  | "diario_registros"
  | "fotos"
  | "compartilhar_saida"
  | "marketplace_publicar"
  | "agenda_criar"
  | "financeiro_lancar"
  | "financeiro_consolidado"
  | "tripulacao_adicionar"
  | "explorar_perfil_completo"

export const LIMITES_FREE = {
  /** §2.3 e §28, decisão congelada: "2 Diários completos". A onda 38 tinha 20
   *  porque o PRD anterior dizia "ex.: até 2" e aquilo foi lido como sugestão.
   *  O PRD FINAL fecha em 2, sem "ex.:" — e o §1.1 explica o porquê: "Free
   *  deve funcionar como demonstração interativa, não como versão paralela do
   *  aplicativo". Quem já criou mais que isso mantém tudo (ver o topo do
   *  arquivo). */
  diarioRegistros: 2,
  /** Fotos completam o dossiê visual que o PRD quer "visualmente completo" no
   *  Free — teto generoso o bastante pra um álbum inicial real (fachada,
   *  convés, cabine, motor, documentação básica) sem forçar o paywall na
   *  primeira sessão. O PRD FINAL não fixa número aqui (§4.9: "armazenamento
   *  pode ser limitado conforme plano em fase posterior"), então o número da
   *  onda 38 fica. */
  fotos: 8,
  /** §2.3, Explorar: "alguns Partners aleatórios mostram somente foto + nome".
   *  "Alguns" é o suficiente pra provar que existe gente do outro lado e não o
   *  bastante pra substituir o Explorar pago. */
  partnersNoExplorar: 6,
} as const

/** Recursos 100% pagos — sem contagem, bloqueado ou liberado, nunca "só mais
 *  um". Compartilhar uma saída é extra de divulgação/orgulho do registro, não
 *  essencial pra operar o barco; os outros quatro são literalmente as linhas
 *  do §2.3 que dizem "bloqueado". */
const RECURSOS_TUDO_OU_NADA: readonly RecursoControlado[] = [
  "compartilhar_saida",
  "marketplace_publicar",
  "agenda_criar",
  "financeiro_lancar",
  "tripulacao_adicionar",
  "explorar_perfil_completo",
]

/**
 * A função pura central: decide se ESTE recurso está liberado neste degrau.
 * `usoAtual` só importa pros recursos com contagem (`diario_registros` e
 * `fotos`) — omitido, conta como 0.
 *
 * Só responde "pode criar/abrir agora?". NUNCA é chamada pra decidir se um
 * registro que já existe pode ser lido (§23, ver topo do arquivo).
 */
export function recursoLiberado(recurso: RecursoControlado, nivel: NivelPlano, usoAtual = 0): boolean {
  // O ÚNICO recurso em que não basta ser pago (onda 53, §9.3: "Commander
  // Pro: visão consolidada de todas as embarcações + filtro individual").
  // A checagem vem ANTES de `ehPago` de propósito: o Commander comum é pago
  // e mesmo assim não tem consolidado — e não perde nada com isso, porque o
  // plano dele cadastra 1 embarcação e não há o que consolidar.
  if (recurso === "financeiro_consolidado") return nivel === "commander_pro"
  if (ehPago(nivel)) return true
  if (RECURSOS_TUDO_OU_NADA.includes(recurso)) return false
  switch (recurso) {
    case "diario_registros":
      return usoAtual < LIMITES_FREE.diarioRegistros
    case "fotos":
      return usoAtual < LIMITES_FREE.fotos
    default:
      return false
  }
}

/** Texto honesto do cadeado — sempre diz o limite E, quando faz sentido, o
 *  quanto já foi usado (nunca um "bloqueado" seco sem explicar). Fonte única
 *  da cópia: usada tanto pelo componente de bloqueio quanto (resumida) na tela
 *  de assinatura, pra nunca divergir. */
export function mensagemBloqueio(recurso: RecursoControlado, usoAtual?: number): { titulo: string; descricao: string } {
  switch (recurso) {
    case "diario_registros":
      return {
        titulo: "Limite do Diário no plano Free",
        descricao:
          usoAtual != null
            ? `O plano Free permite criar ${LIMITES_FREE.diarioRegistros} Diários de Bordo completos — este barco já tem ${usoAtual}. ` +
              "Os que já existem continuam seus: nada é apagado. Assine o Commander para registrar sem limite."
            : `O plano Free permite criar ${LIMITES_FREE.diarioRegistros} Diários de Bordo completos. Assine o Commander para registrar sem limite.`,
      }
    case "fotos":
      return {
        titulo: "Limite de fotos no plano Free",
        descricao:
          usoAtual != null
            ? `O plano Free permite até ${LIMITES_FREE.fotos} fotos no acervo — este barco já tem ${usoAtual}. As atuais continuam no lugar. Assine o Commander para um álbum sem limite.`
            : `O plano Free permite até ${LIMITES_FREE.fotos} fotos no acervo. Assine o Commander para um álbum sem limite.`,
      }
    case "compartilhar_saida":
      return {
        titulo: "Recurso do Commander",
        descricao: "Compartilhar uma saída do Diário como imagem ou link é um recurso do plano Commander.",
      }
    case "marketplace_publicar":
      return {
        titulo: "Publicar é do plano Commander",
        descricao:
          "Você pode montar o pedido inteiro no Free para ver como funciona — publicar e receber propostas de " +
          "profissionais, lojas, marinas e postos é do plano Commander. O que você preencheu não se perde.",
      }
    case "agenda_criar":
      return {
        titulo: "Criar compromissos é do plano Commander",
        descricao:
          "No Free a Agenda fica visível para você conhecer a estrutura. Criar compromissos, compartilhar com " +
          "a tripulação e ver a Agenda Detalhada são do plano Commander.",
      }
    case "financeiro_lancar":
      return {
        titulo: "Lançar no Financeiro é do plano Commander",
        descricao:
          "No Free o Financeiro fica visível para você conhecer a estrutura. Lançar despesas e entradas, " +
          "recorrentes e relatórios são do plano Commander.",
      }
    case "financeiro_consolidado":
      return {
        titulo: "Visão consolidada é do Commander Pro",
        descricao:
          `O Commander Pro reúne até ${PLANOS.commander_pro.limiteEmbarcacoes} embarcações num relatório só, ` +
          "com filtro para olhar uma de cada vez. Cada barco continua com o Financeiro dele — o consolidado " +
          "é uma leitura a mais, não uma mistura das contas.",
      }
    case "tripulacao_adicionar":
      return {
        titulo: "Tripulação é do plano Commander",
        descricao:
          "O plano Free não adiciona tripulação. No Commander você libera até " +
          `${PLANOS.commander.limiteAcessosPorEmbarcacao} acessos por embarcação, cada um com as permissões que você escolher.`,
      }
    case "explorar_perfil_completo":
      return {
        titulo: "Perfil completo é do plano Commander",
        descricao:
          "No Free o Explorar mostra uma amostra de parceiros só com foto e nome. Perfil completo, contato e " +
          "qualquer ação comercial são do plano Commander.",
      }
  }
}

/**
 * §23 — aviso pra quem já passou do teto novo. Devolve `null` quando não há o
 * que avisar. Existe pra tela dizer em voz alta "seus registros continuam
 * aqui" em vez de a pessoa descobrir o cadeado e achar que perdeu coisa.
 */
export function avisoAcervoAcimaDoTeto(
  recurso: Extract<RecursoControlado, "diario_registros" | "fotos">,
  nivel: NivelPlano,
  usoAtual: number,
): string | null {
  if (ehPago(nivel)) return null
  const teto = recurso === "diario_registros" ? LIMITES_FREE.diarioRegistros : LIMITES_FREE.fotos
  if (usoAtual <= teto) return null
  const oQue = recurso === "diario_registros" ? "Diários de Bordo" : "fotos"
  return (
    `Este barco tem ${usoAtual} ${oQue} e o plano Free cria até ${teto}. ` +
    "Tudo o que já existe continua disponível para ver, editar e exportar — o limite vale só para criar novos."
  )
}

// ---------------------------------------------------------------------------
// Capacidade por plano (§2, §19, §28)
// ---------------------------------------------------------------------------

/** Quantas embarcações este degrau deixa CADASTRAR. Free e Commander: 1.
 *  Commander Pro: 4. */
export function limiteEmbarcacoes(nivel: NivelPlano): number {
  return PLANOS[nivel].limiteEmbarcacoes ?? 1
}

/** Acessos de tripulação por embarcação (§19: "Limite: até 2 acessos de
 *  tripulação por embarcação. Convite pendente ocupa vaga"). Free: 0. */
export function limiteAcessosTripulacao(nivel: NivelPlano): number {
  return PLANOS[nivel].limiteAcessosPorEmbarcacao ?? 0
}

/** Vagas de tripulação de uma embarcação: quantas existem, quantas estão
 *  ocupadas (vínculos CMDT + convites pendentes) e se ainda cabe alguém.
 *  A mesma conta roda na tela, na action e no banco (migration 048,
 *  `acessos_ocupados`) — três lugares, uma regra. */
export function vagasTripulacao(
  nivel: NivelPlano,
  vinculosCmdt: number,
  convitesPendentes: number,
): { total: number; ocupadas: number; restantes: number; cabeMais: boolean } {
  const total = limiteAcessosTripulacao(nivel)
  const ocupadas = vinculosCmdt + convitesPendentes
  return {
    total,
    ocupadas,
    restantes: Math.max(0, total - ocupadas),
    cabeMais: ocupadas < total,
  }
}

// ---------------------------------------------------------------------------
// §2.3, Explorar — a amostra do Free
// ---------------------------------------------------------------------------

/**
 * "Alguns Partners ALEATÓRIOS mostram somente foto + nome."
 *
 * Aleatório de verdade a cada render seria hostil: o parceiro que a pessoa viu
 * há dez segundos some quando ela volta. Então a amostra é embaralhada por uma
 * SEMENTE estável (hoje + id da pessoa, escolhido por quem chama) — muda de um
 * dia pro outro e é diferente entre pessoas, mas não pisca dentro da mesma
 * sessão. Determinística também deixa testar sem mockar `Math.random`.
 */
export function amostraExplorarFree<T extends { id: string }>(
  partners: readonly T[],
  semente: string,
  quantidade: number = LIMITES_FREE.partnersNoExplorar,
): T[] {
  return [...partners]
    .map((p) => ({ p, peso: hashEstavel(`${semente}:${p.id}`) }))
    .sort((a, b) => a.peso - b.peso || a.p.id.localeCompare(b.p.id))
    .slice(0, Math.max(0, quantidade))
    .map(({ p }) => p)
}

/** Hash pequeno e estável — só precisa ESPALHAR, não é criptografia.
 *
 *  A mistura final (fmix32 do MurmurHash3) não é enfeite: sem ela, um djb2
 *  puro devolve hashes VIZINHOS para strings que diferem só no último
 *  caractere (`…:p0`, `…:p1`, `…:p2`), e ordenar por esse número devolveria a
 *  lista em ordem alfabética de id — ou seja, uma "amostra aleatória" que
 *  mostra sempre os mesmos primeiros parceiros do banco. */
function hashEstavel(texto: string): number {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 33) ^ texto.charCodeAt(i)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

// ---------------------------------------------------------------------------
// Cópia da tela de plano
// ---------------------------------------------------------------------------

/** Lista curta pra tela de assinatura e pro convite de upgrade — sempre em
 *  sincronia com `LIMITES_FREE` e com o catálogo (nada hardcoded duas vezes). */
export const BENEFICIOS_PAGOS: readonly string[] = [
  "Diário de Bordo sem limite de registros",
  "Álbum de fotos sem limite",
  "Compartilhar saídas do Diário como imagem ou link",
  "Publicar demandas no Marketplace e receber propostas",
  "Agenda com compromissos, compartilhamento e Agenda Detalhada",
  "Financeiro completo: lançamentos, recorrentes e relatórios",
  `Até ${PLANOS.commander.limiteAcessosPorEmbarcacao} acessos de tripulação por embarcação`,
  "Explorar Parceiros completo, com perfil e contato",
]

/** O que o Free faz — dito na afirmativa, porque §1.1 pede que o Free seja
 *  "demonstração interativa", e demonstração se apresenta pelo que mostra. */
export const O_QUE_O_FREE_FAZ: readonly string[] = [
  "1 embarcação com dados, motores, hubs técnicos e documentos",
  `${LIMITES_FREE.diarioRegistros} Diários de Bordo completos`,
  `Até ${LIMITES_FREE.fotos} fotos no acervo`,
  "Avisos de vencimento e alertas de segurança — sempre, sem cadeado",
  "Agenda, Financeiro e Marketplace visíveis para conhecer, com criação bloqueada",
]

import { lembreteMotorParado } from "@/lib/domain/alertas"
import { abaDoEquipamento } from "@/lib/domain/diario"
import { rotuloDaResposta, type TipoDemanda } from "@/lib/domain/marketplace"
import { podeVer, type Aba, type Permissoes } from "@/lib/domain/permissoes"
import type { StatusFarol } from "@/lib/domain/semaforo"
import type { EstadoOcorrencia, Gravidade } from "@/lib/domain/ocorrencias"

/**
 * CENTRAL DE NOTIFICAÇÕES (onda 44, PRD §5.2).
 *
 * Regra pura: monta, filtra, classifica e agrupa. Nunca consulta o banco e
 * nunca envia nada — quem busca os dados é `lib/consultas.ts`, quem dispara
 * push é `app/api/alertas/disparar/route.ts`. Os dois usam as MESMAS funções
 * daqui, porque a pior falha possível deste módulo é a tela mostrar uma
 * coisa e o push mandar outra.
 */

// --- Categorias ------------------------------------------------------------

/**
 * As quatro categorias do PRD §5.2 ("filtros: Todas, Embarcação, Agenda,
 * Marketplace, Financeiro").
 *
 * ONDA 53 — as três últimas passaram a ter FONTE. A onda 44 as declarou aqui
 * mesmo sem módulo por trás, com estado vazio honesto ("a Agenda ainda não
 * está no ar"), justamente pra que ligar a fonte não custasse nada além de
 * produzir `Notificacao` com a categoria certa. Foi o que aconteceu: as
 * fontes moram em `lib/consultas.ts` (`carregarNotificacoes`) e nada da
 * mecânica deste arquivo mudou — só os textos de vazio, que agora falam de
 * um módulo que existe.
 */
/**
 * ONDA 101 — POR QUE "MENSAGENS" NÃO É A QUINTA CATEGORIA.
 *
 * A pergunta foi feita e respondida, e fica escrita aqui pra não ser refeita do
 * zero: mensagem não lida (`contarConversasComNaoLidas`, onda 99) NÃO entra
 * nesta Central. Três motivos, em ordem de peso:
 *
 * 1. O DADO NÃO CABE NO LAYOUT. `contarConversasComNaoLidas` se apoia em
 *    `carregarCaixaDeEntrada`, que baixa os carimbos de TODAS as mensagens de
 *    TODAS as conversas da pessoa, sem teto — o próprio arquivo confessa isso.
 *    Hoje ela roda numa tela (o Menu). Entrar aqui é entrar em
 *    `carregarNotificacoes`, que roda no LAYOUT de toda tela logada: seria
 *    reintroduzir, por porta lateral, exatamente o custo que a onda 100 acabou
 *    de arrancar daqui.
 * 2. O NÍVEL NÃO TEM RESPOSTA HONESTA. Neste módulo o nível decide três coisas
 *    de uma vez: sino, push e ordenação. Não existe push de mensagem — nenhum
 *    canal, nem e-mail, nem Realtime (decisão escrita na migration 090).
 *    `importante` criaria pendência que o sino conta e que nenhum canal
 *    entrega; `informativa` não conta no sino, e aí não resolve nada.
 * 3. UMA CAIXA DE ENTRADA NÃO MORA DENTRO DE OUTRA. O spec §3.2 exige que cada
 *    item traga A AÇÃO e que a caixa possa ficar vazia. Mensagem se resolve
 *    LENDO, em `/mensagens/[id]` — que já é uma caixa de entrada, com o próprio
 *    zero e o próprio contador. O item daqui seria um espelho permanente da
 *    outra caixa, e nenhuma das duas zeraria pela outra.
 *
 * O problema que motivaria a entrada é real e continua de pé: mensagem nova é
 * hoje o evento mais silencioso do app. O conserto dele é dar a Mensagens um
 * canal próprio (push no envio, com dedupe por conversa), não pendurá-la num
 * sino que promete o que ela não tem. No dia em que esse push existir, esta
 * decisão se reabre — e o que muda primeiro é o item 2.
 */
export const CATEGORIAS_NOTIFICACAO = ["embarcacao", "agenda", "marketplace", "financeiro"] as const
export type CategoriaNotificacao = (typeof CATEGORIAS_NOTIFICACAO)[number]

export const ROTULO_CATEGORIA_NOTIFICACAO: Record<CategoriaNotificacao, string> = {
  embarcacao: "Embarcação",
  agenda: "Agenda",
  marketplace: "Marketplace",
  financeiro: "Financeiro",
}

/** Texto do estado vazio de cada categoria. Agora que os quatro módulos
 *  existem, todo vazio quer dizer a mesma coisa: não há nada pendente —
 *  nunca "o módulo não está pronto". */
export const VAZIO_CATEGORIA_NOTIFICACAO: Record<CategoriaNotificacao, string> = {
  embarcacao: "Nada vencido, nada na margem e nenhuma ocorrência aberta. Bom vento e mar calmo.",
  agenda: "Nenhum compromisso à vista nos próximos dias, e ninguém compartilhou nada novo com você.",
  marketplace: "Nenhum aviso de negócio agora. Propostas e confirmações pendentes aparecem aqui.",
  financeiro: "Nenhuma conta vencendo e nada pendente de pagamento. O caixa está em dia.",
}

// --- Níveis ----------------------------------------------------------------

/**
 * Os três níveis do PRD §5.2, e o que cada um significa na prática:
 *
 *   CRÍTICA     in-app + push, com destaque visual. Algo já é fato
 *               consumado: documento vencido, item de segurança vencido,
 *               ocorrência grave aberta.
 *   IMPORTANTE  in-app + push "quando exigem ação ou envolvem outra
 *               pessoa". Ainda dá tempo: vencimento na margem, ocorrência
 *               em acompanhamento.
 *   INFORMATIVA "normalmente somente in-app". Não interrompe ninguém.
 *
 * `PUSH_POR_NIVEL` é a tradução direta dessas frases — a decisão de
 * interromper alguém no celular mora num lugar só.
 */
export const NIVEIS_NOTIFICACAO = ["critica", "importante", "informativa"] as const
export type NivelNotificacao = (typeof NIVEIS_NOTIFICACAO)[number]

export const ROTULO_NIVEL_NOTIFICACAO: Record<NivelNotificacao, string> = {
  critica: "Crítica",
  importante: "Importante",
  informativa: "Informativa",
}

/**
 * ONDA 101 — ESTA CONSTANTE É DO PUSH, E SÓ DELE.
 *
 * Ela descreve o que o PRD §5.2 AUTORIZA a interromper no celular, e não o que
 * o app de fato manda: hoje só o cron (itens monitorados, mar, motor parado) e
 * o pedido novo do Marketplace viram push. Compromisso de agenda e conta
 * vencendo são `importante` aqui e nunca tocam o celular de ninguém.
 *
 * Enquanto `contadorSino` lia daqui, corrigir essa distância — que é uma
 * correção certa e vai acontecer — apagaria Agenda e Financeiro do badge de
 * quebra. A régua do sino agora é `PEDE_ACAO_POR_NIVEL`, logo abaixo; as duas
 * são iguais hoje e um teste confere isso, para que a divergência, quando
 * vier, seja escrita e não herdada.
 */
export const PUSH_POR_NIVEL: Record<NivelNotificacao, boolean> = {
  critica: true,
  importante: true,
  informativa: false,
}

/** Ordem de urgência — crítica sempre primeiro, informativa sempre por
 *  último. Mesma ideia do `PESO` do farol (`lib/domain/semaforo.ts`). */
export const PESO_NIVEL: Record<NivelNotificacao, number> = {
  critica: 3,
  importante: 2,
  informativa: 1,
}

// --- A notificação em si ---------------------------------------------------

export interface Notificacao {
  id: string
  titulo: string
  detalhe: string
  categoria: CategoriaNotificacao
  nivel: NivelNotificacao
  /**
   * Aba de permissão que a pessoa precisa poder VER pra receber isto.
   * `null` = aviso que não pertence a nenhum hub (conta, assinatura,
   * boletim do mar) e todo mundo com vínculo pode ver.
   *
   * Este campo é o coração do "Notificações sempre respeitam permissões do
   * usuário" (PRD §5.2): um tripulante sem acesso a Documentos não pode nem
   * ver na lista, nem receber push, de um documento vencendo.
   */
  aba: Aba | null
  href: string
  /**
   * O verbo da tela de destino, visível no rodapé do cartão — "Registrar
   * manutenção", "Responder proposta" (onda 59, imagem 6 do catálogo).
   * Obrigatório de propósito: aviso sem ação nomeada é o defeito que o spec
   * §3.2 aponta ("aviso que não se resolve pelo aviso é aviso que se lê
   * duas vezes"). Quem constrói a notificação conhece o `href`; logo conhece
   * o verbo — e o compilador cobra de cada construtor o seu.
   */
  acao: string
  /** ISO — null quando é um estado atual (item vencido hoje), não um evento datado. */
  quando: string | null
  /**
   * Chave de agrupamento. Notificações com a mesma chave viram UMA linha com
   * contador — é o "oportunidades semelhantes devem ser agrupadas para evitar
   * spam" do PRD §5.2, generalizado: cinco documentos vencendo no mesmo mês
   * também são spam.
   */
  grupo: string
}

export interface NotificacaoAgrupada extends Notificacao {
  /** 1 = notificação solitária; >1 = quantas semelhantes foram dobradas nesta linha */
  quantidade: number
}

// --- Classificação ---------------------------------------------------------

/** Manutenção/documento: vencido é fato consumado (crítica), na margem ainda
 *  dá tempo de agir (importante). Mesma régua do farol, sem inventar uma
 *  segunda. */
export function nivelDoStatusItem(status: StatusFarol): NivelNotificacao {
  if (status === "vencido") return "critica"
  if (status === "atencao") return "importante"
  return "informativa"
}

/** Ocorrência: gravidade alta em aberto é crítica; o resto pede ação mas não
 *  é emergência. Em acompanhamento nunca é crítica — alguém já está cuidando,
 *  e interromper de novo é o spam que o PRD manda evitar. Sem gravidade
 *  registrada não se inventa "alta" (mesma regra de honestidade da Saúde:
 *  menos informação nunca vira MAIS alarme). */
export function nivelDaOcorrencia(estado: EstadoOcorrencia, gravidade: Gravidade | null): NivelNotificacao {
  if (estado === "aberta" && gravidade === "alta") return "critica"
  if (estado === "aberta" || estado === "em_acompanhamento") return "importante"
  return "informativa"
}

// --- Agenda, Marketplace e Financeiro (onda 53) ----------------------------

/**
 * Quantos dias à frente cada módulo olha. Sete porque é a semana que a
 * pessoa consegue reorganizar: aviso de conta que vence daqui a um mês não
 * muda decisão nenhuma hoje, e vira ruído até virar cego.
 */
export const DIAS_AVISO_AGENDA = 7
export const DIAS_AVISO_FINANCEIRO = 7

/**
 * Compromisso chegando (PRD §8 + §5.2). Nunca crítica — e isto é decisão,
 * não esquecimento: no Commander "crítica" quer dizer que o BARCO tem um
 * fato consumado (documento vencido, item de segurança vencido, ocorrência
 * grave). Perder um almoço no iate clube não é da mesma família, e misturar
 * as duas coisas ensina o dono a ignorar o vermelho.
 *
 * Hoje ou amanhã é `importante` ("exige ação"); mais longe é `informativa`.
 */
export function nivelDoCompromisso(diasAte: number): NivelNotificacao {
  return diasAte <= 1 ? "importante" : "informativa"
}

/**
 * Vencimento de dinheiro (PRD §9.2 + §5.2). Mesma régua e mesmo motivo do
 * compromisso: conta atrasada pede ação hoje (`importante`), conta que ainda
 * vai vencer é aviso (`informativa`). Dinheiro nunca é `crítica` aqui — o
 * PRD reserva o destaque visual pro que ameaça a embarcação, e o Commander
 * não sabe se a conta já foi paga por fora.
 *
 * `diasAte` negativo = já venceu.
 */
export function nivelDoVencimentoFinanceiro(diasAte: number): NivelNotificacao {
  return diasAte <= 0 ? "importante" : "informativa"
}

/**
 * Os avisos do Marketplace (PRD §11.4, §11.5 e §11.6). §5.2 define
 * `importante` como "exigem ação ou envolvem outra pessoa" — e é literalmente
 * o caso de proposta recebida, proposta aceita e negócio esperando a sua
 * confirmação: tem alguém do outro lado parado esperando você. Recusa não: já
 * acabou, não há o que fazer, então é `informativa`.
 *
 * ONDA 99 — `demanda_compativel` ENTRA COMO IMPORTANTE, e a escolha custou
 * uma leitura da régua inteira deste arquivo antes de ser feita.
 *
 * `importante` aqui significa três coisas de uma vez, porque neste módulo elas
 * são a mesma decisão: entra no push (`PUSH_POR_NIVEL`), conta no sino
 * (`contadorSino` conta exatamente o que o push interrompe) e sobe na
 * ordenação (`PESO_NIVEL`). Marcar como `informativa` teria dado in-app sem
 * push — e in-app sem push é o estado de HOJE, que é o problema que esta onda
 * existe para resolver: o prestador não abre o Marketplace por conta própria.
 *
 * O teste do §5.2 é literal e passa nos dois braços: um pedido novo compatível
 * "exige ação" (responder com preço e prazo, antes de o pedido expirar — a
 * demanda tem `expira_em`, então a janela fecha sozinha) e "envolve outra
 * pessoa" (o dono está do outro lado esperando resposta). É a mesma família de
 * `proposta_recebida`, vista do outro lado do balcão.
 *
 * E `critica` está fora, também por régua e não por gosto: neste app crítica
 * quer dizer que o BARCO tem um fato consumado — documento vencido, item de
 * segurança vencido, ocorrência grave. Oportunidade comercial perdida não é
 * dessa família, e misturar as duas ensina o dono a ignorar o vermelho (é o
 * mesmo argumento escrito em `nivelDoCompromisso` e em
 * `nivelDoVencimentoFinanceiro`).
 *
 * O que impede este aviso de virar o spam que o §5.2 proíbe não é o nível: é
 * (a) o índice único `(demanda_id, usuario_id)` da migration 089, que dá UM
 * aviso por pedido por pessoa para sempre, e (b) o `grupo` compartilhado, que
 * dobra "5 pedidos novos combinam com você" numa linha só.
 */
export type AvisoMarketplace =
  | "demanda_compativel"
  | "proposta_recebida"
  | "proposta_aceita"
  | "proposta_recusada"
  | "negocio_aguardando"

export const NIVEL_AVISO_MARKETPLACE: Record<AvisoMarketplace, NivelNotificacao> = {
  demanda_compativel: "importante",
  proposta_recebida: "importante",
  proposta_aceita: "importante",
  proposta_recusada: "informativa",
  negocio_aguardando: "importante",
}

/** O pedido, na medida que o aviso precisa. O `titulo` já vem RESOLVIDO pela
 *  taxonomia (`tituloDeDemanda`, em `lib/consultas-marketplace.ts`) — o
 *  domínio não conhece uuid de categoria nem nome de região. */
export interface DemandaAvisada {
  id: string
  tipo: TipoDemanda
  titulo: string
  /** ISO da publicação. `null` quando quem monta não tem o carimbo em mãos —
   *  a lista trata `quando: null` como estado atual e o põe antes do histórico
   *  do mesmo nível, que é exatamente o certo pra um pedido recém-nascido. */
  criadoEm: string | null
}

/**
 * O aviso "chegou um pedido que combina com você" — UM construtor, usado
 * pelos DOIS canais.
 *
 * O cabeçalho deste arquivo diz que a pior falha possível daqui é a tela
 * mostrar uma coisa e o push mandar outra. Este aviso é o mais exposto a
 * isso, porque os dois canais nascem em lugares diferentes: o push sai de
 * `lib/avisos/marketplace.ts` no instante da publicação, e a linha in-app sai
 * de `carregarNotificacoes` (`lib/consultas.ts`) horas depois, relendo
 * `avisos_demanda`. Fazer os dois chamarem esta função é o que garante que o
 * nível (logo, o sino e o push), o destino e o verbo sejam os mesmos nos dois.
 *
 * `aba: null` porque Marketplace não pertence a hub nenhum — e não é um
 * detalhe: é o que faz `filtrarPorPermissao` deixar o aviso passar pro
 * Partner e pro Captain, que não têm embarcação e portanto não têm permissão
 * de aba nenhuma. O disparo passa por essa MESMA função antes de mandar push,
 * então no dia em que este aviso ganhar uma `aba`, os dois canais fecham
 * juntos, sem ninguém precisar lembrar de ir lá.
 *
 * O verbo é o da tela de destino, por tipo: quem responde uma demanda de
 * tripulação se CANDIDATA, quem responde as outras quatro faz PROPOSTA
 * (§11.5, e é o rótulo que o botão de `/marketplace/[id]` já mostra).
 */
export function notificacaoDeDemandaCompativel(d: DemandaAvisada): Notificacao {
  return {
    id: `demanda-compativel:${d.id}`,
    titulo: "Novo pedido combina com você",
    detalhe: d.titulo,
    categoria: "marketplace",
    nivel: NIVEL_AVISO_MARKETPLACE.demanda_compativel,
    aba: null,
    href: `/marketplace/${d.id}`,
    acao: `Enviar ${rotuloDaResposta(d.tipo)}`,
    quando: d.criadoEm,
    // Um grupo só pros pedidos todos: "Novo pedido combina com você · +4
    // semelhantes" numa linha, em vez de cinco linhas idênticas de título.
    // É o "oportunidades semelhantes devem ser agrupadas para evitar spam" do
    // §5.2 no caso que lhe deu nome — oportunidade é literalmente isto.
    grupo: "marketplace:demanda-compativel",
  }
}

// --- Motor parado (onda 101) -----------------------------------------------

/**
 * O AVISO QUE O APP MANDAVA E A CAIXA NÃO MOSTRAVA.
 *
 * O cron (`app/api/alertas/disparar/route.ts`) dispara três famílias de push, e
 * TODAS levam a pessoa para `/notificacoes` (o `url` do payload). Duas delas
 * não tinham linha nenhuma nesta Central:
 *
 *   · MOTOR PARADO — o que esta função conserta. O push saía, a pessoa tocava,
 *     chegava na caixa de entrada e lia "Nenhuma pendência". Um aviso que
 *     interrompe o celular e depois some ao ser procurado é pior que aviso
 *     nenhum: ele ensina que o número vermelho não corresponde a nada;
 *   · MAR RUIM — continua fora, e de propósito. Ele não é derivável aqui sem
 *     chamar a API de tempo (`boletimDoMar`) dentro de `carregarNotificacoes`,
 *     que roda no LAYOUT de toda tela logada — pagaria uma volta de rede
 *     EXTERNA por navegação para um dado que a Início já busca. E, pela régua
 *     desta caixa, ele nem é pendência: mar ruim não se resolve, passa. O
 *     conserto dele é o push apontar para `/hoje`, onde o boletim mora — está
 *     no relatório da onda, fora deste arquivo.
 *
 * NÍVEL: `importante`, e a régua decide sozinha. `informativa` está definida
 * como "não interrompe ninguém" (ver `PUSH_POR_NIVEL`) — e este aviso
 * interrompe, porque o cron já manda push dele hoje. Marcar informativa criaria
 * a contradição de um aviso que não interrompe mandando push. `critica` também
 * está fora por régua: crítica no Commander é fato consumado do barco
 * (documento vencido, item de segurança vencido, ocorrência grave), e motor sem
 * leitura é recomendação preventiva — o próprio `lembreteMotorParado` diz que
 * "é recomendação, não diagnóstico".
 *
 * A régua dos 30 dias e o TEXTO vêm de `lembreteMotorParado`, não de uma cópia:
 * é a mesma função que o push usa, então os dois canais dizem a mesma frase e
 * mudam juntos. É o princípio do cabeçalho deste arquivo — a pior falha
 * possível daqui é a tela mostrar uma coisa e o push mandar outra.
 *
 * Devolve `null` quando não há o que avisar (motor com leitura recente, ou
 * nunca lido — sem carimbo o domínio não inventa quantos dias faz).
 */
export interface MotorParaAviso {
  /** id do EQUIPAMENTO — o aviso leva pra ficha dele. */
  id: string
  /** "Motor BE", já resolvido por `nomeDoEquipamento` — o domínio de avisos
   *  não conhece o formato de `Equipamento`, igual ao que se faz com o título
   *  de demanda em `notificacaoDeDemandaCompativel`. */
  nome: string
  ultimaLeitura: string | null
}

export function notificacaoDeMotorParado(m: MotorParaAviso, hoje: string): Notificacao | null {
  const aviso = lembreteMotorParado(m.ultimaLeitura, hoje)
  if (!aviso) return null
  return {
    id: `motor-parado:${m.id}`,
    titulo: `${m.nome} sem leitura de horas`,
    // O corpo do MESMO aviso que vai no push, com o número de dias dentro.
    detalhe: aviso.corpo,
    categoria: "embarcacao",
    nivel: "importante",
    // A régua de área é `abaDoEquipamento`, que espelha `aba_do_equipamento`
    // no banco — nunca a string "motores" escrita à mão aqui. Sem isto, um
    // tripulante sem acesso a Motores veria o aviso (PRD §5.2).
    aba: abaDoEquipamento("motor"),
    href: `/barco/equipamento/${m.id}`,
    // "Informar leitura" seria o verbo exato, mas o botão dele na ficha está
    // atrás de `editavel` — prometer ação que metade das pessoas não encontra
    // é o defeito que `hrefDoItem` já documenta ter evitado. Vale o nome da
    // tela, como em "Ver recorrente".
    acao: "Ver motor",
    // Estado atual do barco, não evento datado — mesma escolha dos itens
    // vencidos, e o que faz o aviso vir antes do histórico do mesmo nível.
    quando: null,
    // Um grupo para todos os motores: um barco com dois motores parados dá
    // uma linha com "+1 semelhante", não duas linhas quase idênticas (§5.2).
    grupo: "motor-parado",
  }
}

// --- Permissão, filtro, ordenação e agrupamento ----------------------------

/**
 * O filtro que o PRD §5.2 exige. `permissoes = null` é PROP (dono), que vê
 * tudo — mesmo contrato de `podeVer`. Notificação sem `aba` passa sempre:
 * não pertence a hub nenhum.
 */
export function filtrarPorPermissao<T extends Notificacao>(
  notificacoes: readonly T[],
  permissoes: Permissoes | null,
): T[] {
  return notificacoes.filter((n) => n.aba == null || podeVer(permissoes, n.aba))
}

export function filtrarPorCategoria<T extends Notificacao>(
  notificacoes: readonly T[],
  categoria: CategoriaNotificacao | "todas",
): T[] {
  return categoria === "todas" ? [...notificacoes] : notificacoes.filter((n) => n.categoria === categoria)
}

/** Mais urgente primeiro; dentro do mesmo nível, o mais recente primeiro.
 *  Sem data (`quando = null`) é estado atual do barco, que vem antes de
 *  histórico do mesmo nível. */
export function ordenarNotificacoes<T extends Notificacao>(notificacoes: readonly T[]): T[] {
  return [...notificacoes].sort((a, b) => {
    const porNivel = PESO_NIVEL[b.nivel] - PESO_NIVEL[a.nivel]
    if (porNivel !== 0) return porNivel
    if (a.quando === b.quando) return 0
    if (a.quando == null) return -1
    if (b.quando == null) return 1
    return b.quando.localeCompare(a.quando)
  })
}

/**
 * "Oportunidades semelhantes devem ser agrupadas para evitar spam" (PRD
 * §5.2). Dobra tudo que compartilha a mesma `grupo` numa linha só, mantendo
 * a PRIMEIRA da lista como representante — por isso ordene antes de agrupar
 * (`agruparSemelhantes(ordenarNotificacoes(ns))`): assim a linha mostrada é
 * a mais urgente do grupo, não uma qualquer.
 *
 * Não some com nada: quem quer o detalhe abre o hub. O que se evita é a
 * lista de dez linhas quase idênticas que ninguém lê até o fim.
 */
export function agruparSemelhantes(notificacoes: readonly Notificacao[]): NotificacaoAgrupada[] {
  const porGrupo = new Map<string, NotificacaoAgrupada>()
  for (const n of notificacoes) {
    const existente = porGrupo.get(n.grupo)
    if (existente) existente.quantidade++
    else porGrupo.set(n.grupo, { ...n, quantidade: 1 })
  }
  return [...porGrupo.values()]
}

export function contarPorCategoria(
  notificacoes: readonly Notificacao[],
): Record<CategoriaNotificacao, number> {
  const contagem = Object.fromEntries(
    CATEGORIAS_NOTIFICACAO.map((c) => [c, 0]),
  ) as Record<CategoriaNotificacao, number>
  for (const n of notificacoes) contagem[n.categoria]++
  return contagem
}

/**
 * PENDÊNCIA — a régua do número vermelho, e ela é SÓ DAQUI.
 *
 * O spec de arquitetura §3.3 pede uma coisa específica: "a contagem passa a
 * ser de pendências que PEDEM AÇÃO — que é o que um número vermelho sobre um
 * ícone promete". Um badge que soma as três gravidades pode marcar "3" com
 * três informativas; quem abre e não acha nada pra fazer aprende a ignorar o
 * número — e aí ele não avisa mais nada quando importa.
 *
 * POR QUE ESTA CONSTANTE EXISTE, SE ELA É IDÊNTICA A `PUSH_POR_NIVEL`.
 *
 * Porque são DUAS perguntas diferentes que hoje têm a mesma resposta, e a
 * igualdade é coincidência de valor, não de significado:
 *
 *   `PUSH_POR_NIVEL`        "vale acordar alguém no celular por isto?"
 *   `PEDE_ACAO_POR_NIVEL`   "isto está parado esperando por mim?"
 *
 * Enquanto `contadorSino` lia `PUSH_POR_NIVEL`, a régua do badge era refém de
 * uma decisão de OUTRO canal — e desse canal em particular, que já não
 * descreve o app: `PUSH_POR_NIVEL` diz `true` para toda importante, mas o cron
 * (`app/api/alertas/disparar`) só varre itens monitorados, boletim de mar e
 * motor parado, e `lib/avisos/marketplace.ts` só o pedido novo. Compromisso de
 * agenda e conta vencendo são `importante` e NUNCA viram push. O dia em que
 * alguém corrigir essa constante pra dizer a verdade sobre o push — que é uma
 * correção certa, e vai acontecer — o sino perderia Agenda e Financeiro junto,
 * sem que ninguém tivesse pedido isso: pendência não deixa de esperar por você
 * só porque o celular não tocou.
 *
 * As duas continuam iguais por enquanto, e a igualdade é conferida por teste
 * justamente pra que a divergência, quando vier, seja uma escolha escrita — e
 * não um efeito colateral.
 */
export const PEDE_ACAO_POR_NIVEL: Record<NivelNotificacao, boolean> = {
  critica: true,
  importante: true,
  informativa: false,
}

/** A pergunta em função, pra que consumidor nenhum precise conhecer níveis.
 *  Quem quiser mudar a régua muda AQUI — e o sino, em todos os lugares onde
 *  ele aparece, muda junto, porque nenhum deles conta por conta própria. */
export function pedeAcao(n: Pick<Notificacao, "nivel">): boolean {
  return PEDE_ACAO_POR_NIVEL[n.nivel]
}

/**
 * O número dentro do sino — a barra de baixo, o trilho do desktop, a faixa de
 * topo e o sino da Início mostram TODOS este mesmo valor, calculado por esta
 * função e por nenhuma outra.
 *
 * Conta FATOS, não linhas desenhadas: três documentos vencidos são "3" aqui e
 * um cartão só na tela ("+2 semelhantes"), porque `agruparSemelhantes` é
 * apresentação. A aritmética fecha à vista — 1 linha + "+2" = 3 — e é a mesma
 * do chip "Todas" e da aba Pendentes, que também contam cru.
 */
export function contadorSino(notificacoes: readonly Notificacao[]): number {
  return notificacoes.filter(pedeAcao).length
}

// --- Ícone do cartão (onda 62, canvas tela-1e) -----------------------------

/**
 * Nomes válidos pro ícone de um aviso — subconjunto do sistema de ícones
 * fixo do app (`components/icone.tsx`), escrito aqui como união própria de
 * propósito: o domínio não importa componente, e o TypeScript confere a
 * compatibilidade no ponto de uso da página.
 */
export type IconeAviso =
  | "alerta" | "documento" | "seguranca" | "motor" | "ferramenta"
  | "calendario" | "cifrao" | "marketplace"

/**
 * O desenho dentro do círculo do cartão (canvas tela-1e): cada aviso carrega
 * o ícone da ÁREA de onde veio — documento vencido mostra a folha, extintor
 * mostra o escudo, revisão de motor mostra o motor — em vez do sino genérico
 * repetido em toda linha, que não ajudava a ler nada. DERIVADO dos campos
 * que a notificação já tem (categoria + aba), nunca um campo novo gravado em
 * outro lugar pra poder divergir.
 */
export function iconeDoAviso(n: Pick<Notificacao, "categoria" | "aba">): IconeAviso {
  if (n.categoria === "agenda") return "calendario"
  if (n.categoria === "financeiro") return "cifrao"
  if (n.categoria === "marketplace") return "marketplace"
  if (n.aba === "documentos") return "documento"
  if (n.aba === "seguranca") return "seguranca"
  if (n.aba === "motores") return "motor"
  if (n.aba === "eletrica" || n.aba === "hidraulica" || n.aba === "equipamentos" || n.aba === "casco") {
    return "ferramenta"
  }
  return "alerta"
}

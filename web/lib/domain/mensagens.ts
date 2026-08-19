/**
 * CONVERSA ENTRE AS DUAS PARTES (migration 090).
 *
 * O pedido do dono, na voz dele: *"as mensagens devem ser trocadas no próprio
 * app"*. Hoje o Marketplace vai até a proposta e para — o contato é liberado
 * (§22) e a conversa sai pro WhatsApp, levando junto o registro do combinado,
 * que é justamente o que o Commander vende.
 *
 * ISTO NÃO É O §65 DO PRD ("CHAT COMMANDER"). Aquele é falar com a EQUIPE
 * Commander (suporte), e o próprio PRD admite WhatsApp/Intercom para ele.
 * Aqui é conversa entre PESSOAS do app: quem publicou o pedido e quem
 * respondeu. Nada neste arquivo serve suporte.
 *
 * A regra toda mora aqui, pura e testável: o que é um corpo de mensagem
 * válido, quantas a pessoa não leu, o que a caixa de entrada mostra em cada
 * linha e como a thread se divide por dia. As telas e as actions só orquestram.
 *
 * OS TIPOS DE BANCO MORAM AQUI, E ISSO É PROVISÓRIO. `lib/db/types.ts` é o
 * lugar deles, mas o arquivo tem outro dono nesta rodada. Quando isto for
 * consolidado, `Conversa`, `Mensagem` e `LeituraConversa` migram para lá e
 * este bloco vira só um `import type` — está registrado no relatório da onda.
 */

// ===========================================================================
// As três linhas do banco (migration 090)
// ===========================================================================

/** Uma conversa é ancorada na PROPOSTA, não na demanda — um pedido com três
 *  respostas vira três conversas separadas. Ver o cabeçalho da migration 090:
 *  uma sala por demanda colocaria concorrentes lendo o preço um do outro. */
export interface Conversa {
  id: string
  demanda_id: string
  proposta_id: string
  /** Quem publicou o pedido (`demandas.autor_id`). */
  dono_id: string
  /** Quem respondeu (`propostas.autor_id`). */
  parceiro_id: string
  /**
   * CÓPIAS, e a migration 090 explica por quê em detalhe. O resumo: quando o
   * pedido vence, a RLS de `demandas` para de devolver a linha para quem
   * RESPONDEU — sem a cópia, a conversa dele perderia o assunto justamente
   * depois de o negócio acontecer. E `profiles` tem RLS de "próprio ou
   * tripulação", então nenhum JOIN alcança o nome do outro lado (é o mesmo
   * motivo de `demandas.autor_nome` existir desde a migration 038).
   */
  assunto: string
  dono_nome: string
  parceiro_nome: string
  criado_em: string
  ultima_mensagem_em: string
}

/** `apagada_em` preenchido e `corpo` vazio é a marca de que a mensagem
 *  existiu. O banco não deixa esses dois campos discordarem (CHECK
 *  `mensagens_viva_ou_apagada`), então a tela pode ler qualquer um dos dois. */
export interface Mensagem {
  id: string
  conversa_id: string
  autor_id: string
  corpo: string
  apagada_em: string | null
  criado_em: string
}

/** Até onde EU li. A RLS só devolve a minha linha — a do outro é invisível,
 *  e é isso que torna "visto às 14h" impossível de desenhar em vez de apenas
 *  proibido. */
export interface LeituraConversa {
  conversa_id: string
  usuario_id: string
  lido_ate: string
}

// ===========================================================================
// O corpo da mensagem
// ===========================================================================

/** O mesmo teto do CHECK `mensagens_corpo_no_limite`. Escrito nos dois lugares
 *  de propósito: aqui vira aviso em português antes de enviar, lá vira a trava
 *  que um POST direto no PostgREST também respeita. */
export const LIMITE_CORPO_MENSAGEM = 2000

/**
 * O texto que vai pro banco, ou `null` quando não há mensagem nenhuma.
 *
 * Corta espaço nas pontas e recusa o vazio — mensagem só de espaço ocuparia
 * uma linha na thread do outro sem dizer nada, e depois não poderia ser
 * apagada por ninguém além do autor. Recusa também o que passa do teto, em vez
 * de cortar em silêncio: truncar entregaria ao destinatário uma frase que o
 * remetente não escreveu.
 *
 * As quebras de linha ficam: quem manda três medidas em três linhas quer três
 * linhas, e a tela renderiza com `whitespace-pre-line`. O que some é a sequência
 * de mais de duas quebras seguidas — dez enters viram uma tela vazia no meio da
 * conversa do outro, que é empurrão de conteúdo disfarçado de formatação.
 */
export function corpoValido(bruto: string | null | undefined): string | null {
  if (typeof bruto !== "string") return null
  const limpo = bruto.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (limpo === "") return null
  if (limpo.length > LIMITE_CORPO_MENSAGEM) return null
  return limpo
}

/** Por que o corpo foi recusado — a tela precisa dizer QUAL dos dois casos
 *  foi, senão "não deu" é a mesma frase para "você não escreveu nada" e para
 *  "você escreveu demais", e a segunda tem conserto óbvio. */
export function motivoCorpoInvalido(bruto: string | null | undefined): string {
  const limpo = typeof bruto === "string" ? bruto.trim() : ""
  if (limpo === "") return "Escreva a mensagem antes de enviar."
  return `A mensagem passou de ${LIMITE_CORPO_MENSAGEM.toLocaleString("pt-BR")} caracteres. Encurte ou mande em duas.`
}

// ===========================================================================
// Quem é quem
// ===========================================================================

export type PapelConversa = "dono" | "parceiro"

/**
 * Meu lado da conversa, ou `null` se eu não sou parte dela.
 *
 * O `null` NÃO é a trava de acesso — a trava é a RLS, que nem devolve a linha
 * (migration 090). Isto existe para a tela escolher o texto certo ("quem
 * respondeu ao seu pedido" × "quem publicou o pedido") e para o `null` virar
 * um redirect honesto em vez de uma tela meio montada.
 */
export function papelNaConversa(c: Pick<Conversa, "dono_id" | "parceiro_id">, usuarioId: string): PapelConversa | null {
  if (c.dono_id === usuarioId) return "dono"
  if (c.parceiro_id === usuarioId) return "parceiro"
  return null
}

/** O id da outra pessoa — é dele que sai o nome exibido no cabeçalho da
 *  thread e na linha da caixa de entrada. */
export function idDoOutro(c: Pick<Conversa, "dono_id" | "parceiro_id">, usuarioId: string): string | null {
  const papel = papelNaConversa(c, usuarioId)
  if (papel === "dono") return c.parceiro_id
  if (papel === "parceiro") return c.dono_id
  return null
}

/** Como o app chama o outro lado, do meu ponto de vista. Não é enfeite: numa
 *  caixa de entrada com dez linhas, "respondeu ao seu pedido" e "publicou o
 *  pedido" são a diferença entre eu estar comprando ou vendendo naquela
 *  conversa — e o nome da pessoa sozinho não conta isso. */
export const RELACAO_DO_OUTRO: Record<PapelConversa, string> = {
  dono: "Respondeu ao seu pedido",
  parceiro: "Publicou o pedido",
}

/** O nome da outra pessoa, lido da cópia que a conversa carrega. Devolve `null`
 *  para quem não é parte — mesma postura de `idDoOutro`: a tela não monta meia
 *  linha, ela não monta linha nenhuma. */
export function nomeDoOutro(
  c: Pick<Conversa, "dono_id" | "parceiro_id" | "dono_nome" | "parceiro_nome">,
  usuarioId: string,
): string | null {
  const papel = papelNaConversa(c, usuarioId)
  if (papel === "dono") return c.parceiro_nome
  if (papel === "parceiro") return c.dono_nome
  return null
}

// ===========================================================================
// "Não lida" é estado de quem lê
// ===========================================================================

/** Duas pessoas na mesma conversa têm contagens diferentes — por isso a
 *  entrada é a MINHA marca (`lidoAte`), nunca um campo da mensagem. */
export interface EntradaNaoLidas {
  mensagens: readonly Pick<Mensagem, "autor_id" | "criado_em">[]
  usuarioId: string
  /** `null` = nunca abri esta conversa. */
  lidoAte: string | null
}

/**
 * Instante de um carimbo do Postgres, em milissegundos.
 *
 * `Date.parse` e não comparação de strings: os dois carimbos vêm da mesma
 * fonte hoje (o PostgREST devolve sempre `+00:00`), mas comparar texto quebra
 * em silêncio no dia em que um deles chegar com outra grafia do mesmo
 * instante — e "quebrar em silêncio" aqui significa a pessoa achar que leu
 * uma mensagem que ela nunca viu.
 */
function instante(iso: string): number {
  return Date.parse(iso)
}

/**
 * Quantas mensagens do OUTRO chegaram depois da minha marca de leitura.
 *
 * As minhas nunca contam — badge que sobe quando eu mesmo escrevo é o tipo de
 * número que ensina a pessoa a ignorar o badge.
 *
 * Sem marca nenhuma (`lidoAte = null`) tudo do outro conta: nunca abri, então
 * não li nada. Não é o caso de `null` virando zero — é `null` significando
 * "zero leituras", que é o oposto.
 *
 * Mensagem apagada CONTINUA contando enquanto não lida, e é decisão: a linha
 * existe na thread do outro, ele precisa saber que algo aconteceu ali. O que
 * ele vai encontrar ao abrir é a marca do apagamento, e isso é honesto — o
 * contrário (a contagem baixar sozinha) pareceria bug.
 *
 * Carimbo ilegível não conta. Preferimos avisar a menos a avisar errado: um
 * badge fantasma que nunca zera transforma o indicador em ruído permanente.
 */
export function contarNaoLidas(entrada: EntradaNaoLidas): number {
  const corte = entrada.lidoAte == null ? null : instante(entrada.lidoAte)
  return entrada.mensagens.filter((m) => {
    if (m.autor_id === entrada.usuarioId) return false
    if (corte == null) return true
    const quando = instante(m.criado_em)
    return Number.isFinite(quando) && quando > corte
  }).length
}

/**
 * O texto do contador, ou `null` quando não há nada a mostrar.
 *
 * `null` e não `"0"`: zero não lidas é a AUSÊNCIA de um aviso, e desenhar um
 * "0" cinza ao lado de toda conversa em dia é exatamente o zero fabricado que
 * `lib/domain/patio.ts` proíbe. Quem chama não escolhe — se vier `null`, não
 * há elemento nenhum a renderizar.
 *
 * O teto de 99 existe porque o desenho do contador é uma pílula curta; acima
 * disso o número deixa de informar (a diferença entre 100 e 340 não muda
 * decisão nenhuma) e passa a quebrar o layout da linha.
 */
export function rotuloNaoLidas(quantidade: number): string | null {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return null
  return quantidade > 99 ? "99+" : String(quantidade)
}

/**
 * Até onde a visita de agora marca como lido: o carimbo da mensagem mais
 * recente da thread, ou `null` se a conversa está vazia.
 *
 * É o carimbo da MENSAGEM e não `now()` do servidor, e a diferença aparece na
 * corrida: se eu abro a tela no mesmo segundo em que a outra pessoa envia,
 * `now()` marcaria como lida uma mensagem que não chegou a ser renderizada
 * para mim — e ela sumiria do contador sem nunca ter sido vista. Marcando
 * pela última mensagem QUE EU RECEBI, o que chegou depois continua não lido.
 */
export function marcaDeLeitura(mensagens: readonly Pick<Mensagem, "criado_em">[]): string | null {
  let maior: string | null = null
  for (const m of mensagens) {
    if (maior == null || instante(m.criado_em) > instante(maior)) maior = m.criado_em
  }
  return maior
}

// ===========================================================================
// A linha da caixa de entrada
// ===========================================================================

/** O que a tela mostra no lugar do texto de uma mensagem apagada. Uma
 *  constante e não uma string solta: ela aparece na thread e na prévia da
 *  caixa de entrada, e as duas têm de dizer a mesma coisa. */
export const TEXTO_MENSAGEM_APAGADA = "Mensagem apagada"

/**
 * A prévia de uma linha da caixa de entrada, ou `null` quando a conversa
 * ainda não tem mensagem nenhuma.
 *
 * `null` de novo em vez de string vazia: uma conversa recém-aberta é um estado
 * legítimo ("você abriu, ninguém escreveu ainda") e merece a frase dele, não
 * uma linha em branco que parece defeito de carregamento. Quem chama decide o
 * texto do vazio, porque só ele sabe se está desenhando lista ou cartão.
 *
 * O "Você: " na frente da própria mensagem é o que responde, sem abrir a
 * conversa, a pergunta que a caixa de entrada existe pra responder: a bola
 * está comigo ou com o outro?
 */
export function previaDaConversa(
  ultima: Pick<Mensagem, "autor_id" | "corpo" | "apagada_em"> | null,
  usuarioId: string,
): string | null {
  if (ultima == null) return null
  const texto = ultima.apagada_em != null ? TEXTO_MENSAGEM_APAGADA : ultima.corpo.replace(/\s+/g, " ").trim()
  if (texto === "") return null
  return ultima.autor_id === usuarioId ? `Você: ${texto}` : texto
}

/** A última mensagem de uma lista já ordenada por `criado_em` crescente.
 *  Existe pra tela não precisar lembrar da ordem — e para `previaDaConversa`
 *  receber sempre a mesma coisa vindo da caixa de entrada e da thread. */
export function ultimaMensagem<T extends Pick<Mensagem, "criado_em">>(
  mensagens: readonly T[],
): T | null {
  let maior: T | null = null
  for (const m of mensagens) {
    if (maior == null || instante(m.criado_em) >= instante(maior.criado_em)) maior = m
  }
  return maior
}

/**
 * A caixa de entrada, da conversa com atividade mais recente pra mais antiga.
 *
 * Ordenar por atividade e não por data de criação é o que faz a lista
 * responder "o que mexeu?" em vez de "o que eu abri primeiro?". A ordem é
 * total (desempate por id) para o React não remontar linhas à toa quando duas
 * conversas compartilham o mesmo carimbo — o que acontece de verdade quando
 * uma pessoa abre duas conversas no mesmo pedido em segundos.
 */
export function ordenarConversas<T extends Pick<Conversa, "id" | "ultima_mensagem_em">>(
  conversas: readonly T[],
): T[] {
  return [...conversas].sort((a, b) => {
    const porAtividade = instante(b.ultima_mensagem_em) - instante(a.ultima_mensagem_em)
    if (porAtividade !== 0 && Number.isFinite(porAtividade)) return porAtividade
    return a.id.localeCompare(b.id)
  })
}

// ===========================================================================
// A thread
// ===========================================================================

export interface DiaDeMensagens {
  /** "AAAA-MM-DD" no fuso da marina — a chave, não o rótulo. Quem desenha o
   *  rótulo é `formatarCarimbo` (`lib/domain/datas.ts`), que já sabe dizer
   *  "Hoje" e "Ontem" sem inventar uma segunda régua de data no app. */
  dia: string
  mensagens: Mensagem[]
}

/**
 * A thread quebrada por dia civil.
 *
 * Existe porque uma conversa de negociação atravessa dias, e sem a divisória
 * a pessoa lê "14:32" sem saber se foi hoje ou na terça — que é justamente a
 * informação que decide se ela está atrasada em responder. Carimbar cada
 * mensagem com a data inteira resolveria e custaria uma linha de ruído por
 * mensagem; a divisória custa uma por dia.
 *
 * `diaDe` entra por parâmetro em vez de importar `diaCivilSP`: o domínio não
 * decide fuso, e assim o teste não precisa do relógio do sistema. Na prática
 * quem passa é sempre `diaCivilSP` — o app inteiro conta dias em
 * America/Sao_Paulo, e usar `slice(0, 10)` aqui jogaria toda mensagem depois
 * das 21h para o dia seguinte.
 */
export function agruparPorDia(
  mensagens: readonly Mensagem[],
  diaDe: (iso: string) => string,
): DiaDeMensagens[] {
  const dias: DiaDeMensagens[] = []
  for (const m of mensagens) {
    const dia = diaDe(m.criado_em)
    const atual = dias[dias.length - 1]
    if (atual && atual.dia === dia) atual.mensagens.push(m)
    else dias.push({ dia, mensagens: [m] })
  }
  return dias
}

/**
 * Se esta mensagem mostra o botão de apagar.
 *
 * Só a própria, e só uma vez. Não há janela de tempo, e a ausência dela é
 * decisão: uma janela de 15 minutos protegeria o registro contra arrependimento
 * tardio, mas o registro já está protegido — apagar não some com a linha, ela
 * fica com autor e horário e o texto sai (migration 090). Ou seja, o que a
 * janela compraria já veio de graça no modelo, e o que ela custaria é real: a
 * pessoa que cola o telefone errado e percebe no dia seguinte ficaria sem
 * saída dentro do app.
 */
export function podeApagar(m: Pick<Mensagem, "autor_id" | "apagada_em">, usuarioId: string): boolean {
  return m.autor_id === usuarioId && m.apagada_em == null
}

/**
 * Se a porta de conversa aparece na ficha do pedido.
 *
 * Duas condições, e as duas são as da RLS do INSERT (migration 090) escritas
 * em português: eu sou uma das duas partes daquela proposta, e a proposta não
 * foi retirada. A tela não é a trava — se ela errar, a policy recusa e a
 * action avisa —, mas oferecer um botão que o banco vai recusar é o "falhar em
 * silêncio" que o §24 proíbe, ao contrário.
 *
 * Repare no que NÃO está aqui: nada sobre a proposta ter sido ACEITA, e nada
 * sobre a demanda ainda estar viva. Combinar é o passo ANTES de aceitar — é
 * conversando que se decide de quem é a proposta melhor — e uma conversa
 * aberta não morre quando o anúncio vence, senão o registro do combinado
 * evaporaria justo depois de o negócio acontecer.
 */
export function podeConversar(entrada: {
  usuarioId: string
  donoId: string
  parceiroId: string
  statusProposta: string
}): boolean {
  if (entrada.statusProposta === "retirada") return false
  return entrada.usuarioId === entrada.donoId || entrada.usuarioId === entrada.parceiroId
}

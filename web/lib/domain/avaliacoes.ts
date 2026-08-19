import { estadoDoNegocio, type ConfirmacaoNegocio } from "@/lib/domain/marketplace"

/**
 * AVALIAÇÕES E CONTESTAÇÕES (onda 49).
 * PRD `docs/prd/upgrade2-master-final.txt` §14 inteira, incluindo §14.1
 * (respostas prontas) e §14.2 (motivos de contestação).
 *
 * Toda a regra vive aqui, pura e testável: quem pode avaliar, por quanto
 * tempo dá pra editar, que resposta pronta cabe em cada nota, o que libera o
 * botão "Contestar" e — a conta mais delicada — como a média se comporta
 * quando uma avaliação foi ocultada por violação. As telas e as actions só
 * orquestram.
 *
 * As frases do §14.1 e os motivos do §14.2 são LITERAIS do PRD. Estão aqui e
 * não no banco porque o banco guarda o código da frase, não a prosa: uma
 * frase escrita em dois lugares vira duas frases diferentes na primeira
 * revisão de texto. O check constraint da migration 050 garante que só estes
 * códigos entram.
 */

// ===========================================================================
// §14 — a trava: avaliação só depois de negócio confirmado bilateralmente
// ===========================================================================
/**
 * "Avaliação somente após negócio confirmado bilateralmente no Commander."
 *
 * É a mesma pergunta que `avaliacaoLiberada` (marketplace.ts) já respondia
 * na onda 45 — aqui ela ganha o nome do que destrava. A resposta de verdade
 * é dada pela RLS (`negocio_confirmado()`, migration 050): esta função existe
 * pra tela não oferecer um botão que o banco vai recusar, nunca como a única
 * guarda.
 */
export function podeAvaliar(entrada: {
  usuarioId: string
  clienteId: string
  confirmacoes: readonly ConfirmacaoNegocio[]
  jaAvaliou: boolean
}): boolean {
  if (entrada.jaAvaliou) return false
  // Uma direção só: quem contratou avalia quem prestou (ver o cabeçalho da
  // migration 050 — o §14 fala sempre em "cliente" e "avaliado").
  if (entrada.usuarioId !== entrada.clienteId) return false
  return estadoDoNegocio(entrada.confirmacoes) === "confirmado"
}

/** A frase que o §14 manda o perfil exibir, literal. Existe como constante
 *  porque ela é uma AFIRMAÇÃO sobre o dado ("este negócio passou pelo
 *  fechamento bilateral") — se alguém a colar numa tela que não garante isso,
 *  o texto vira mentira. */
export const SELO_NEGOCIO_CONFIRMADO = "Negócio confirmado pelo Commander"

// ===========================================================================
// §14 — nota e prazo de edição
// ===========================================================================
export const NOTAS_POSSIVEIS = [1, 2, 3, 4, 5] as const
export type Nota = (typeof NOTAS_POSSIVEIS)[number]

export function notaValida(n: number): n is Nota {
  return Number.isInteger(n) && n >= 1 && n <= 5
}

/** "Cliente pode editar a própria avaliação por até 30 dias" (§14). */
export const DIAS_EDICAO_AVALIACAO = 30

/** Mesmo prazo que a policy de update aplica no banco (migration 050). Recebe
 *  `agora` explícito pra ser testável sem mockar relógio — mesma escolha de
 *  `formatarCarimbo` em `datas.ts`. */
export function podeEditarAvaliacao(criadoEmISO: string, agora: Date = new Date()): boolean {
  const criado = new Date(criadoEmISO).getTime()
  if (Number.isNaN(criado)) return false
  const limite = criado + DIAS_EDICAO_AVALIACAO * 24 * 60 * 60 * 1000
  return agora.getTime() < limite
}

/** Dias que ainda restam pra editar (0 = último dia, negativo = acabou) —
 *  o aviso honesto de "você tem 12 dias para mudar isso". */
export function diasRestantesParaEditar(criadoEmISO: string, agora: Date = new Date()): number {
  const criado = new Date(criadoEmISO).getTime()
  if (Number.isNaN(criado)) return -1
  const decorridos = (agora.getTime() - criado) / (24 * 60 * 60 * 1000)
  return Math.max(-1, Math.floor(DIAS_EDICAO_AVALIACAO - decorridos))
}

// ===========================================================================
// §14.1 — respostas prontas, nos três tons
// ===========================================================================
export const FAIXAS_NOTA = ["negativa", "intermediaria", "positiva"] as const
export type FaixaNota = (typeof FAIXAS_NOTA)[number]

/**
 * 1–2 negativa, 3 intermediária, 4–5 positiva. O corte em 2 não foi escolhido
 * aqui: é o mesmo do §14 ("1 ou 2 estrelas liberam botão Contestar"), o que
 * mantém uma única definição de "avaliação ruim" no produto inteiro.
 * Espelha `faixa_da_nota()` no banco (migration 050).
 */
export function faixaDaNota(nota: number): FaixaNota {
  if (nota <= 2) return "negativa"
  if (nota === 3) return "intermediaria"
  return "positiva"
}

export interface RespostaPronta {
  codigo: string
  faixa: FaixaNota
  texto: string
}

/**
 * §14.1 na íntegra — as frases são as do PRD, palavra por palavra. Nenhuma
 * foi reescrita, encurtada ou "melhorada": são a voz que o avaliado empresta
 * ao responder, e o dono as escreveu assim de propósito.
 *
 * A resposta é padronizada justamente porque o momento é quente: sem lista,
 * a resposta a uma nota 1 vira briga pública, e a briga é o que destrói a
 * credibilidade das duas partes.
 */
export const RESPOSTAS_PRONTAS: readonly RespostaPronta[] = [
  // Para avaliações positivas:
  {
    codigo: "pos_confianca",
    faixa: "positiva",
    texto: "Agradecemos pela avaliação e pela confiança em nosso trabalho.",
  },
  {
    codigo: "pos_preferencia",
    faixa: "positiva",
    texto: "Obrigado pela preferência. Será um prazer atendê-lo novamente.",
  },
  {
    codigo: "pos_reconhecimento",
    faixa: "positiva",
    texto: "Agradecemos pelo reconhecimento. Seguimos à disposição.",
  },
  // Para avaliações intermediárias:
  {
    codigo: "int_feedback",
    faixa: "intermediaria",
    texto: "Agradecemos pelo feedback. Sua opinião nos ajuda a melhorar nosso atendimento.",
  },
  {
    codigo: "int_experiencia",
    faixa: "intermediaria",
    texto:
      "Obrigado pela avaliação. Seguiremos trabalhando para oferecer uma experiência cada vez melhor.",
  },
  {
    codigo: "int_observacoes",
    faixa: "intermediaria",
    texto: "Agradecemos pelas observações e vamos considerá-las para aprimorar nosso atendimento.",
  },
  // Para avaliações negativas:
  {
    codigo: "neg_contato",
    faixa: "negativa",
    texto: "Entraremos em contato para entender melhor o ocorrido e buscar uma solução.",
  },
  {
    codigo: "neg_analise_equipe",
    faixa: "negativa",
    texto:
      "A situação será analisada por nossa equipe e entraremos em contato para os devidos esclarecimentos.",
  },
  {
    codigo: "neg_lamentamos",
    faixa: "negativa",
    texto: "Lamentamos que sua experiência não tenha atendido às expectativas. Vamos analisar o ocorrido.",
  },
  {
    codigo: "neg_compreensao_diferente",
    faixa: "negativa",
    texto:
      "Nossa equipe possui uma compreensão diferente sobre o ocorrido e permanece disponível para esclarecimentos.",
  },
  {
    codigo: "neg_nao_dependeu",
    faixa: "negativa",
    texto:
      "O ocorrido não dependeu diretamente de nossa atuação, mas permanecemos disponíveis para esclarecer a situação.",
  },
  {
    codigo: "neg_ja_tratada",
    faixa: "negativa",
    texto: "A situação já foi tratada diretamente com o cliente e permanecemos à disposição.",
  },
]

export const CODIGOS_RESPOSTA = RESPOSTAS_PRONTAS.map((r) => r.codigo)

/** As respostas que cabem numa nota. A tela nunca mostra as outras, e a RLS
 *  também recusa (a policy compara `faixa_da_nota` com `faixa_da_resposta`) —
 *  um "obrigado pelo reconhecimento" embaixo de uma nota 1 seria deboche. */
export function respostasParaNota(nota: number): RespostaPronta[] {
  const faixa = faixaDaNota(nota)
  return RESPOSTAS_PRONTAS.filter((r) => r.faixa === faixa)
}

export function textoDaResposta(codigo: string): string | null {
  return RESPOSTAS_PRONTAS.find((r) => r.codigo === codigo)?.texto ?? null
}

// ===========================================================================
// §14.2 — motivos de contestação
// ===========================================================================
export interface MotivoContestacao {
  codigo: string
  texto: string
}

/** §14.2 na íntegra, na ordem do PRD. "Outro motivo" é o último de propósito:
 *  é a saída, não a primeira opção — quem escolhe precisa explicar. */
export const MOTIVOS_CONTESTACAO: readonly MotivoContestacao[] = [
  { codigo: "nao_corresponde", texto: "A avaliação não corresponde ao serviço/produto negociado." },
  { codigo: "informacoes_incorretas", texto: "As informações apresentadas são incorretas." },
  { codigo: "nao_causado_por_nos", texto: "O problema relatado não foi causado por nossa atuação." },
  { codigo: "cliente_nao_cumpriu", texto: "O cliente não cumpriu as condições previamente acordadas." },
  { codigo: "conteudo_ofensivo", texto: "A avaliação contém conteúdo ofensivo ou inadequado." },
  { codigo: "ja_solucionada", texto: "A situação já havia sido solucionada." },
  { codigo: "uso_indevido", texto: "Suspeito de uso indevido do sistema de avaliações." },
  { codigo: "outro", texto: "Outro motivo." },
]

export const CODIGOS_MOTIVO = MOTIVOS_CONTESTACAO.map((m) => m.codigo)

export function textoDoMotivo(codigo: string): string | null {
  return MOTIVOS_CONTESTACAO.find((m) => m.codigo === codigo)?.texto ?? null
}

/** §14: "1 ou 2 estrelas liberam botão 'Contestar avaliação'." Nota 3 não
 *  contesta — é uma opinião morna, não uma acusação. */
export function podeContestar(nota: number): boolean {
  return nota <= 2
}

// ===========================================================================
// §14 — moderação
// ===========================================================================
export const VISIBILIDADES_AVALIACAO = ["publica", "oculta_violacao"] as const
export type VisibilidadeAvaliacao = (typeof VISIBILIDADES_AVALIACAO)[number]

export const DECISOES_MODERACAO = ["manter", "ocultar"] as const
export type DecisaoModeracao = (typeof DECISOES_MODERACAO)[number]

export const ROTULO_DECISAO_MODERACAO: Record<DecisaoModeracao, string> = {
  manter: "Manter a avaliação",
  ocultar: "Ocultar por violação",
}

/*
 * §14: "Contestação não remove avaliação automaticamente."
 *
 * AUDITORIA 19/08, A20 — AQUI MORAVA `contestacaoAfetaExibicao(): false`.
 * APAGADA, e ela é o caso mais puro da categoria: o tipo de retorno é o
 * literal `false`, então a função não APLICA nada — ela afirma. Não tinha
 * consumidor e, único caso da lista, nem teste: ninguém chamava, nem para
 * medir. Um `if` que consultasse essa função seria código morto por
 * construção, porque o compilador já sabe o resultado.
 *
 * A regra continua valendo, e continua sendo cumprida pelo código que de fato
 * decide: `calcularReputacao` filtra por `visibilidade === "publica"` (abaixo),
 * e a contestação não escreve em `visibilidade` — só a moderação do admin
 * escreve. É por aí que a garantia se sustenta, não por uma função-espelho.
 * A tela também já diz a frase, onde o cliente precisa lê-la:
 * `components/avaliacoes/cartao-avaliacao.tsx:103` e
 * `app/(app)/avaliacoes/page.tsx:218`.
 *
 * Mesmo diagnóstico que a onda 57 deu a `rotuloDoSelo` e esta auditoria deu a
 * `envioAlteraRegistroOficial` (`cotista-plano.ts:96-108`).
 */

// ===========================================================================
// §14 — "Problema solucionado"
// ===========================================================================
export const RESPOSTAS_SOLUCAO = ["confirmado", "negado"] as const
export type RespostaSolucao = (typeof RESPOSTAS_SOLUCAO)[number]

export type EstadoSolucao = "nenhuma" | "aguardando_cliente" | "confirmada" | "negada"

export function estadoDaSolucao(
  solucao: { resposta: RespostaSolucao | null } | null | undefined,
): EstadoSolucao {
  if (!solucao) return "nenhuma"
  if (solucao.resposta === "confirmado") return "confirmada"
  if (solucao.resposta === "negado") return "negada"
  return "aguardando_cliente"
}

/*
 * §14: "A nota não muda automaticamente."
 *
 * AUDITORIA 19/08, A20 — AQUI MORAVA `notaDepoisDaSolucao(n) => n`. APAGADA.
 * O comentário dela dizia existir "pra ficar impossível alguém otimizar isso
 * sem ver o teste quebrar", e essa promessa não se sustentava: a função é a
 * identidade, e o teste dela media a si mesmo. Quem quisesse fazer a nota
 * subir com a solução não editaria esta função — escreveria a conta no lugar
 * onde a nota é lida, e nada aqui quebraria.
 *
 * O que de fato garante a regra é não existir nenhum caminho que escreva
 * `avaliacoes.nota` a partir de `avaliacoes_solucoes`: a solução confirmada
 * muda o SELO (`ROTULO_ESTADO_SOLUCAO`, logo abaixo), nunca o número. Mudar a
 * nota é do cliente, editando dentro dos 30 dias (`DIAS_EDICAO_AVALIACAO`).
 *
 * Mesmo motivo pelo qual `cotistaPodeGerarRelatorioPessoal(x) => x` foi
 * apagada em A8 — "a identidade com nome bonito" (`cotista-plano.ts:130-136`).
 */

export const ROTULO_ESTADO_SOLUCAO: Record<EstadoSolucao, string> = {
  nenhuma: "",
  aguardando_cliente: "Solução informada — aguardando o cliente confirmar",
  confirmada: "Problema solucionado, confirmado pelo cliente",
  negada: "O cliente não reconheceu a solução informada",
}

// ===========================================================================
// §14 — média e quantidade no perfil
// ===========================================================================
export interface AvaliacaoParaReputacao {
  nota: number
  visibilidade: VisibilidadeAvaliacao
}

export interface Reputacao {
  /** `null` quando não há nenhuma avaliação visível — nunca 0. Um perfil sem
   *  avaliação não tem "nota zero", tem ausência de nota, e mostrar 0,0
   *  puniria quem acabou de chegar. */
  media: number | null
  quantidade: number
  /** Quantas ficaram de fora por terem sido ocultadas por violação. Serve pro
   *  próprio avaliado entender o número; não aparece pra quem só está lendo o
   *  perfil. */
  ocultadas: number
  /** Contagem por estrela (índice 0 = 1 estrela), só das que contam. */
  distribuicao: [number, number, number, number, number]
}

/**
 * A média que o perfil mostra (§14: "Perfil mostra média, quantidade").
 *
 * DECISÃO: avaliação OCULTA POR VIOLAÇÃO não entra na média nem na
 * quantidade. As duas leituras foram consideradas:
 *
 *  · Se entrasse, ocultar seria teatro. O leitor veria "média 2,0" com só
 *    avaliações de 5 estrelas na tela e nenhuma explicação possível — o
 *    número mentiria sobre a evidência exibida logo abaixo dele. E o
 *    avaliado seguiria punido por um texto que o próprio Commander declarou
 *    inválido, sem ter como respondê-lo (ele não está mais lá).
 *  · Se não entra, alguém poderia querer contestar tudo pra limpar a média.
 *    Só que quem decide não é o avaliado: contestar não oculta nada
 *    (§14, "não remove automaticamente"), e "Manter" devolve a avaliação
 *    inteira pra conta. O único caminho pra sair da média é o Admin afirmar
 *    que houve violação.
 *
 * Ou seja: a média sempre é explicável pelo que está na tela — sai a
 * avaliação, sai o peso dela. O que protege o cliente não é o número teimar,
 * é a decisão de ocultar ser do Commander e ficar registrada (quem ocultou,
 * quando e por quê, na própria linha).
 *
 * Contestação PENDENTE não muda nada aqui, de propósito.
 *
 * ---------------------------------------------------------------------------
 * PUBLICIDADE NÃO ENTRA NESTA CONTA (onda 52, §20)
 * ---------------------------------------------------------------------------
 * O §20 fecha com *"Publicidade nunca interfere na nota/reputação do
 * Partner"*, e o lugar de honrar isso é aqui, porque é aqui que a nota
 * nasce. `AvaliacaoParaReputacao` tem DOIS campos — `nota` e `visibilidade` —
 * e é assim que tem que continuar: campanha, destaque, patrocínio e valor
 * pago não são argumentos desta função e não podem virar.
 *
 * Quem for acrescentar um campo aqui um dia: se ele vier de
 * `publicidade_campanhas`, pare. Um Partner que compra destaque aparece
 * primeiro na vitrine (`ordenarComDestaque`, lib/domain/publicidade.ts) e
 * continua com a mesma média de antes — as duas ordenações são
 * independentes de propósito. O teste
 * "campanha não muda a reputação do Partner", em publicidade.test.ts, existe
 * pra que essa mudança quebre alguma coisa em vez de passar batida.
 */
export function calcularReputacao(avaliacoes: readonly AvaliacaoParaReputacao[]): Reputacao {
  const contam = avaliacoes.filter((a) => a.visibilidade === "publica")
  const distribuicao: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const a of contam) {
    if (notaValida(a.nota)) distribuicao[a.nota - 1] += 1
  }
  const soma = contam.reduce((s, a) => s + a.nota, 0)
  return {
    // Uma casa decimal: é o que o olho lê num cartão, e mais casas dariam
    // falsa precisão a uma amostra de meia dúzia de avaliações.
    media: contam.length > 0 ? Math.round((soma / contam.length) * 10) / 10 : null,
    quantidade: contam.length,
    ocultadas: avaliacoes.length - contam.length,
    distribuicao,
  }
}

/** "4,7" (vírgula, como se escreve em português) ou "—" quando ainda não há
 *  avaliação. Nunca "0,0" — ver o comentário de `Reputacao.media`. */
export function formatarMedia(media: number | null): string {
  if (media == null) return "—"
  return media.toFixed(1).replace(".", ",")
}

/** "12 avaliações" / "1 avaliação" / "Sem avaliações ainda". */
export function formatarQuantidade(quantidade: number): string {
  if (quantidade === 0) return "Sem avaliações ainda"
  return `${quantidade} ${quantidade === 1 ? "avaliação" : "avaliações"}`
}

/*
 * AUDITORIA 19/08, A20 — AQUI MORAVA `estrelasCheias(media)`, que arredondava
 * a média pro inteiro mais próximo pra desenhar uma régua de 5 estrelas.
 * APAGADA: o recurso foi cortado, e por decisão registrada.
 *
 * `components/avaliacoes/reputacao.tsx:15-17` diz por escrito que NÃO desenha
 * estrelas a partir da média — mostra o número exato (`formatarMedia`) e o
 * histograma (`barrasDaDistribuicao`, abaixo). O motivo é o mesmo do resto
 * desta base: 4,4 e 4,6 desenham as mesmas 4 ou 5 estrelas, e a régua
 * arredondada é a única coisa que o olho lê — um número derivado, desenhado
 * como se fosse o dado.
 *
 * O único componente de estrelas vivo (`components/avaliacoes/estrelas.tsx`)
 * recebe NOTA INTEIRA de uma avaliação, nunca média, e por isso não precisa
 * arredondar nada. Não havia reimplementação à mão para adotar: não existe um
 * `Math.round(media)` em `web/`. Mantê-la seria deixar no domínio a única
 * versão do app que ainda acredita na régua gráfica.
 */

/**
 * O histograma do cartão-resumo (canvas tela-4c): uma barra por estrela, de
 * 5 pra 1, com o percentual REAL da distribuição — nada de curva decorativa.
 * `destaque` marca UMA barra (a moda; no empate, a de mais estrelas) pra
 * receber o dourado do canvas — as demais ficam neutras. Vazio quando não há
 * avaliação nenhuma: histograma de zero linhas é ausência, não "tudo 0%".
 */
export interface BarraDistribuicao {
  estrela: number
  quantidade: number
  /** 0–100, participação desta nota entre as que contam. */
  percentual: number
  /** A barra que leva o dourado — só uma, a mais frequente. */
  destaque: boolean
}

export function barrasDaDistribuicao(r: Reputacao): BarraDistribuicao[] {
  if (r.quantidade === 0) return []
  const maior = Math.max(...r.distribuicao)
  let destacada = false
  return [5, 4, 3, 2, 1].map((estrela) => {
    const quantidade = r.distribuicao[estrela - 1]
    const destaque = !destacada && quantidade === maior && quantidade > 0
    if (destaque) destacada = true
    return {
      estrela,
      quantidade,
      percentual: Math.round((quantidade / r.quantidade) * 100),
      destaque,
    }
  })
}

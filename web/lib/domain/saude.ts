import { faroDoEstado, ROTULO_ESTADO, ROTULO_GRAVIDADE, type EstadoOcorrencia, type Gravidade } from "@/lib/domain/ocorrencias"
import type { Aba } from "@/lib/domain/permissoes"
import type { StatusFarol } from "@/lib/domain/semaforo"

/**
 * SAÚDE DA EMBARCAÇÃO — régua oficial.
 *
 * ESTE ARQUIVO JÁ MUDOU DUAS VEZES. A história inteira está aqui de
 * propósito: quem ler daqui a seis meses precisa entender por que o modelo
 * virou, e não achar que foi capricho de refactor.
 *
 *  1) ONDA 16 — INVENTADO. O PRD Master do Upgrade 2 (§10,
 *     `docs/prd/upgrade2-master.txt`) dizia textualmente que a fórmula NÃO
 *     estava fechada e que "o programador não deve inventar pesos ou
 *     algoritmo". A onda 16 inventou mesmo assim: nota = itens em dia /
 *     itens com informação, com faixas ≥90 Ótimo / ≥70 Bom / ≥40 Atenção /
 *     senão Crítico. Foi pro ar. Achado registrado em
 *     `docs/auditoria/2026-08-14-prd-upgrade2-parte1.md` (seção 10).
 *
 *  2) 14/08/2026 — FECHADO COM RIGOR. O dono delegou a decisão pra
 *     engenharia e a fórmula virou DEDUÇÃO: nota começava em 100 e cada
 *     problema tirava `PESO_CATEGORIA × severidade × PONTOS_POR_PESO_EFETIVO`.
 *     Deixou de ser chute, mas continuou sendo um NÚMERO.
 *
 *  3) 15/08/2026 — SUBSTITUÍDO PELO PRD FINAL, com autorização do dono.
 *     `docs/prd/upgrade2-master-final.txt` proíbe porcentagem na Saúde em
 *     TRÊS lugares (§1.1 "Nunca usar porcentagem para 'Saúde da
 *     Embarcação'", §27.2 "Saúde nunca exibe porcentagem", §28 "Sem
 *     porcentagem; Saudável / Atenção / Ação necessária") e o próprio
 *     documento declara que "decisões anteriores que conflitem com este PRD
 *     devem ser consideradas substituídas". A auditoria de 15/08
 *     (`docs/auditoria/2026-08-15-prd-final-vs-codigo.md`, seção 1) levou o
 *     conflito ao dono, e ele autorizou seguir o PRD FINAL.
 *
 *     A pergunta mudou: não é mais "quanto está bom" (0–100), é "QUAL O PIOR
 *     ESTADO PRESENTE". A régua declarativa do §5, literal:
 *       SAUDÁVEL         — nenhum item crítico vencido e nenhuma ocorrência
 *                          crítica aberta;
 *       ATENÇÃO          — existe item próximo do limite ou pendência não
 *                          crítica;
 *       AÇÃO NECESSÁRIA  — existe ao menos uma pendência crítica.
 *                          "O pior estado relevante prevalece."
 *
 * O QUE SOBREVIVEU DA DEDUÇÃO, E POR QUÊ: `PESO_CATEGORIA` e as severidades
 * NÃO foram jogados fora. A fórmula saiu da EXIBIÇÃO e ficou só na
 * ORDENAÇÃO: o PRD §3.4 pede o bloco "Precisa da sua atenção" *"ordenado por
 * criticidade"*, e ordenar exige comparar dois problemas — é exatamente o
 * que os pesos fazem bem ("documento vencido antes de verniz descascado").
 * O peso agora é um número INTERNO de comparação: nunca aparece na tela,
 * nunca é somado, nunca vira nota. `PONTOS_POR_PESO_EFETIVO` foi removido
 * porque era só a conversão pra escala 0–100 — a única peça que existia
 * exclusivamente pra desenhar o número proibido, e multiplicar tudo por uma
 * constante positiva não muda ordem nenhuma.
 *
 * TODOS os pesos da saúde continuam vivendo NESTE arquivo e em nenhum outro.
 * Mudar um número aqui continua sendo decisão de produto, não refactor
 * livre (ver `docs/CONTRIBUTING.md`).
 *
 * Regras de honestidade que NUNCA mudaram (onda 16, mantidas nas três
 * versões):
 *   - item sem informação suficiente fica fora da conta, nem a favor nem
 *     contra (`temInformacao`, mesmo contrato de `temInformacaoSuficiente`
 *     em `semaforo.ts`);
 *   - sem nenhum dado (nenhum item com informação e nenhuma ocorrência
 *     ativa), não existe estado — `estado` volta `null` e a tela vira
 *     convite, nunca "Saudável" inventado. Um barco sem nada cadastrado não
 *     é um barco saudável; é um barco desconhecido.
 */

// ---------------------------------------------------------------------
// Os três estados do PRD §5. Nem mais, nem menos, nem sinônimo.
// ---------------------------------------------------------------------
export const ESTADOS_SAUDE = ["saudavel", "atencao", "acao_necessaria"] as const
export type EstadoSaude = (typeof ESTADOS_SAUDE)[number]

export const ROTULO_ESTADO_SAUDE: Record<EstadoSaude, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  acao_necessaria: "Ação necessária",
}

/** Cor de farol de cada estado — a MESMA linguagem de cor do resto do app
 *  (`components/farol.tsx`, `semaforo.ts`). Nenhuma cor nova entra por causa
 *  da Saúde: verde = ok, amarelo = atenção, vermelho = crítico. */
export const FAROL_ESTADO_SAUDE: Record<EstadoSaude, StatusFarol> = {
  saudavel: "ok",
  atencao: "atencao",
  acao_necessaria: "vencido",
}

/** Do melhor pro pior. Existe porque "o pior estado relevante prevalece"
 *  (§5) é uma COMPARAÇÃO, e comparar três rótulos de texto exige uma ordem
 *  escrita em algum lugar — este lugar, uma vez só. */
export const ORDEM_ESTADO_SAUDE: Record<EstadoSaude, number> = {
  saudavel: 0,
  atencao: 1,
  acao_necessaria: 2,
}

// ---------------------------------------------------------------------
// Severidades — continuam existindo, agora só pra ORDENAR (ver o topo).
// ---------------------------------------------------------------------

// Quanto cada status de manutenção/documento vale, numa régua de 0-3 —
// mesma régua da gravidade de ocorrência abaixo, pra dar comparação
// justa entre problemas de origens diferentes.
export const SEVERIDADE_STATUS_ITEM: Record<"atencao" | "vencido", number> = {
  atencao: 1, // aviso: ainda dá tempo de agir antes do prazo
  vencido: 3, // fato consumado: já passou do prazo, risco já materializado
}

// Gravidade da ocorrência na mesma régua 0-3 do status de item — "alta"
// fica no teto, igual "vencido": uma ocorrência grave (ex.: via d'água,
// incêndio) é tão séria quanto um item vencido, não menos.
export const SEVERIDADE_GRAVIDADE_OCORRENCIA: Record<Gravidade, number> = {
  baixa: 1,
  media: 2,
  alta: 3,
}
// Sem gravidade registrada: nunca inventa "alta" — usa o mesmo piso de
// "baixa" (regra de honestidade: dado ausente nunca vira MAIS penalidade,
// e por consequência nunca sozinho joga o barco pra "Ação necessária").
export const SEVERIDADE_GRAVIDADE_AUSENTE = SEVERIDADE_GRAVIDADE_OCORRENCIA.baixa

// "Em acompanhamento" já tem alguém cuidando do problema — vale metade de
// uma "aberta" (ninguém tocou ainda) na hora de ORDENAR a lista.
// "Resolvida"/"anulada" nem chegam aqui (filtradas na origem, ver
// `ESTADOS_QUE_PESAM_NA_SAUDE` em `ocorrencias.ts`).
export const MULTIPLICADOR_ESTADO_OCORRENCIA: Record<"aberta" | "em_acompanhamento", number> = {
  aberta: 1,
  em_acompanhamento: 0.5,
}

// Quanto cada área (hub) multiplica o problema — o princípio "segurança e
// documentação pesam mais que estética" mora AQUI, num só lugar, pra
// manutenção/documento E ocorrência (mesma tabela pros dois).
//   - Documentos e Segurança = 6 ("crítica"): documento vencido pode tirar o
//     barco de circulação (seguro, TIE) e item de segurança vencido é risco
//     de vida direto — nunca podem pesar igual a um item estético. É este
//     6 que `PESO_AREA_CRITICA` lê pra decidir o que é "crítico" (abaixo).
//   - Motores, Elétrica, Hidráulica = 4 ("funcional"): o barco ainda anda,
//     mas com um problema real de propulsão/energia/saneamento a bordo.
//   - Equipamentos e Embarcação (visão geral) = 2 ("moderada"): relevante,
//     mas nem crítico nem puramente estético.
//   - Casco = 2 ("estética/conforto", mesmo peso de Equipamentos): deck,
//     fibra, inox, vidros, estofados — nunca deveria, sozinho, valer tanto
//     quanto um extintor vencido (pedido explícito do dono).
//   - Fotos, Contatos, Gastos, Diário, Histórico, Carteira, Agenda = 0:
//     essas abas nunca têm manutenção/documento nem ocorrência vinculada
//     (não são "lugar no barco" com estado físico — ver `ABAS_OCORRENCIA` em
//     `ocorrencias.ts`); ficam aqui só porque o tipo `Aba` exige todas as
//     chaves. `carteira` entrou na onda 42 e `agenda` na onda 46 pelo mesmo
//     motivo que as outras cinco: a matriz de permissões ganhou a área (PRD
//     §9.4 e §8), e o peso 0 mantém a régua EXATAMENTE como estava — nenhum
//     número desta tabela foi tocado nas duas entradas, porque peso é
//     decisão de produto (ver docs/CONTRIBUTING.md, "Saúde da Embarcação").
export const PESO_CATEGORIA: Record<Aba, number> = {
  documentos: 6,
  seguranca: 6,
  motores: 4,
  eletrica: 4,
  hidraulica: 4,
  equipamentos: 2,
  embarcacao: 2,
  casco: 2,
  fotos: 0,
  contatos: 0,
  gastos: 0,
  diario: 0,
  historico: 0,
  carteira: 0,
  agenda: 0,
}

/**
 * O QUE É "CRÍTICO" — a única definição, explícita e testável.
 *
 * O PRD §5 usa "item crítico vencido" e "ocorrência crítica aberta" sem
 * definir o que torna um deles crítico. Definir isso é engenharia, e a
 * definição precisa ser derivada do que o app JÁ decidiu, não de um segundo
 * critério paralelo que amanhã diverge do primeiro. Por isso:
 *
 *   - ITEM: área com `PESO_CATEGORIA >= PESO_AREA_CRITICA` (6) E status
 *     `vencido`. Na tabela acima, 6 é exatamente a faixa "crítica" —
 *     Documentos e Segurança —, escolhida em 14/08 com a justificativa de
 *     que documento vencido tira o barco de circulação e item de segurança
 *     vencido é risco de vida. Reusar esse número em vez de listar
 *     `["documentos", "seguranca"]` à mão significa que subir uma área pra
 *     faixa crítica na tabela também a torna crítica aqui, sem ninguém
 *     precisar lembrar de mexer em dois lugares.
 *     `atencao` numa área crítica NÃO é crítico: "próximo do limite" é
 *     literalmente a definição de ATENÇÃO no §5.
 *
 *   - OCORRÊNCIA: gravidade `alta`, em qualquer área. Gravidade é o campo em
 *     que a pessoa já declarou a seriedade do problema com a mão dela; "via
 *     d'água" é grave num barco inteiro, não só se for classificada em
 *     Segurança. E gravidade AUSENTE nunca é crítica — mesma regra de
 *     honestidade de sempre (dado que ninguém preencheu não vira alarme).
 *     Vale pros dois estados vivos, incluindo "em acompanhamento": alguém
 *     estar olhando não é a mesma coisa que estar resolvido, e o PRD diz
 *     "existe ao menos uma pendência crítica" — uma ocorrência grave em
 *     acompanhamento continua sendo uma pendência crítica. Ela pesa menos na
 *     ORDEM da lista (`MULTIPLICADOR_ESTADO_OCORRENCIA`), não no estado.
 */
export const PESO_AREA_CRITICA = 6
export const GRAVIDADE_CRITICA: Gravidade = "alta"

/** Área da faixa "crítica" da tabela de pesos (hoje: Documentos e Segurança). */
export function ehAreaCritica(aba: Aba): boolean {
  return PESO_CATEGORIA[aba] >= PESO_AREA_CRITICA
}

export interface ItemParaSaude {
  id: string
  nome: string
  aba: Aba
  status: StatusFarol
  /** Mesmo contrato de `temInformacaoSuficiente` (`semaforo.ts`) — item sem
   *  dado real por trás não entra na conta, nem a favor nem contra. */
  temInformacao: boolean
}

export interface OcorrenciaParaSaude {
  id: string
  titulo: string
  aba: Aba
  estado: EstadoOcorrencia
  gravidade: Gravidade | null
}

export interface FatorSaude {
  tipo: "manutencao" | "ocorrencia"
  id: string
  nome: string
  aba: Aba
  /** Texto curto do que está errado — "Vencido", "Atenção", "Aberta · gravidade Alta" etc. */
  detalhe: string
  /** Este fator sozinho já obriga "Ação necessária"? (ver `PESO_AREA_CRITICA`) */
  critico: boolean
  /**
   * Peso INTERNO de comparação — existe só pra ordenar o bloco "Precisa da
   * sua atenção" (PRD §3.4). NUNCA vai pra tela, nunca é somado, nunca vira
   * nota: é o resto vivo da fórmula de dedução de 14/08 (ver o topo do
   * arquivo). Se algum dia aparecer um `{f.peso}` num .tsx, o PRD §27.2 foi
   * violado de novo por uma porta lateral.
   */
  peso: number
  /** Cor de farol do fator, decidida aqui e não por parsing de `detalhe` na
   *  tela — a página não deveria ter que adivinhar a cor a partir do texto. */
  farol: StatusFarol
}

export interface SaudeEmbarcacao {
  /** null quando não há dado nenhum (nenhum item com informação e nenhuma
   *  ocorrência ativa) — não existe estado, a tela vira convite. */
  estado: EstadoSaude | null
  emDia: number
  atencao: number
  vencido: number
  /** itens com informação suficiente — não conta ocorrências, que não têm "informação suficiente" como conceito */
  total: number
  /** o que precisa da sua atenção, do mais crítico pro menos (PRD §3.4) */
  fatores: FatorSaude[]
}

/**
 * "O pior estado relevante prevalece" (PRD §5), escrito uma vez só.
 *
 * Cada fator "vota" no pior estado que ele sozinho já obriga — crítico vota
 * AÇÃO NECESSÁRIA, qualquer outra pendência vota ATENÇÃO — e o pior voto
 * vence. Sem fator nenhum, ninguém vota e sobra SAUDÁVEL. Escrito como
 * redução em vez de dois `if` porque é assim que o PRD descreve a regra:
 * não é "se tem crítico então...", é "o pior de todos".
 */
export function piorEstado(fatores: readonly FatorSaude[]): EstadoSaude {
  return fatores.reduce<EstadoSaude>((pior, f) => {
    const doFator: EstadoSaude = f.critico ? "acao_necessaria" : "atencao"
    return ORDEM_ESTADO_SAUDE[doFator] > ORDEM_ESTADO_SAUDE[pior] ? doFator : pior
  }, "saudavel")
}

/** Comparador de "criticidade" do PRD §3.4: crítico antes de não crítico e,
 *  dentro de cada grupo, o de maior peso primeiro. O desempate por nome é só
 *  pra lista ser determinística — mesma entrada, mesma ordem na tela,
 *  independente da ordem em que o banco devolveu as linhas. */
function porCriticidade(a: FatorSaude, b: FatorSaude): number {
  if (a.critico !== b.critico) return a.critico ? -1 : 1
  if (a.peso !== b.peso) return b.peso - a.peso
  return a.nome.localeCompare(b.nome, "pt-BR")
}

/** Régua oficial da Saúde da Embarcação — ver o comentário grande no topo
 *  deste arquivo para as três versões da decisão e o motivo de cada uma. */
export function calcularSaudeEmbarcacao(
  itens: ItemParaSaude[],
  ocorrencias: OcorrenciaParaSaude[],
): SaudeEmbarcacao {
  const comInfo = itens.filter((i) => i.temInformacao)
  const emDia = comInfo.filter((i) => i.status === "ok").length
  const atencao = comInfo.filter((i) => i.status === "atencao").length
  const vencido = comInfo.filter((i) => i.status === "vencido").length
  const total = comInfo.length

  // Lista EXPLÍCITA do que pesa, e não "tudo menos resolvida". A diferença
  // importa: `MULTIPLICADOR_ESTADO_OCORRENCIA` só conhece estes dois estados,
  // então qualquer estado novo que passasse por aqui viraria `undefined` na
  // multiplicação do peso — e antes, quando o peso ainda virava nota, isso
  // chegava na tela de Início como "NaN%". Com a lista explícita, estado novo
  // é ignorado até que alguém decida conscientemente quanto ele vale.
  const ocorrenciasAtivas = ocorrencias.filter(
    (o): o is OcorrenciaParaSaude & { estado: keyof typeof MULTIPLICADOR_ESTADO_OCORRENCIA } =>
      o.estado in MULTIPLICADOR_ESTADO_OCORRENCIA,
  )

  if (total === 0 && ocorrenciasAtivas.length === 0) {
    return { estado: null, emDia: 0, atencao: 0, vencido: 0, total: 0, fatores: [] }
  }

  const fatoresItens: FatorSaude[] = comInfo
    .filter((i): i is ItemParaSaude & { status: "atencao" | "vencido" } => i.status !== "ok")
    .map((i) => ({
      tipo: "manutencao",
      id: i.id,
      nome: i.nome,
      aba: i.aba,
      detalhe: i.status === "vencido" ? "Vencido" : "Atenção",
      critico: i.status === "vencido" && ehAreaCritica(i.aba),
      peso: PESO_CATEGORIA[i.aba] * SEVERIDADE_STATUS_ITEM[i.status],
      farol: i.status,
    }))

  const fatoresOcorrencias: FatorSaude[] = ocorrenciasAtivas.map((o) => {
    // Sem `as` aqui: o filtro acima já estreitou o tipo de verdade. O cast
    // que existia antes silenciava o TypeScript justamente no ponto onde ele
    // teria avisado do problema.
    const severidadeGravidade = o.gravidade != null ? SEVERIDADE_GRAVIDADE_OCORRENCIA[o.gravidade] : SEVERIDADE_GRAVIDADE_AUSENTE
    const detalhe = `${ROTULO_ESTADO[o.estado]}${o.gravidade != null ? ` · gravidade ${ROTULO_GRAVIDADE[o.gravidade]}` : ""}`
    return {
      tipo: "ocorrencia",
      id: o.id,
      nome: o.titulo,
      aba: o.aba,
      detalhe,
      critico: o.gravidade === GRAVIDADE_CRITICA,
      peso: PESO_CATEGORIA[o.aba] * severidadeGravidade * MULTIPLICADOR_ESTADO_OCORRENCIA[o.estado],
      // `faroDoEstado` nunca devolve null aqui: "anulada" (o único estado sem
      // farol) já foi filtrado por `ocorrenciasAtivas` acima.
      farol: faroDoEstado(o.estado) ?? "atencao",
    }
  })

  const fatores = [...fatoresItens, ...fatoresOcorrencias].sort(porCriticidade)

  return { estado: piorEstado(fatores), emDia, atencao, vencido, total, fatores }
}

export interface ContagemPorAba {
  aba: Aba
  quantidade: number
}

/**
 * Os chips do bloco "Em dia" da tela de Saúde (canvas tela-3k): quantos
 * itens COM INFORMAÇÃO estão ok em cada área — maior contagem primeiro,
 * desempate alfabético pra lista ser determinística. Item sem informação
 * continua de fora, como em tudo aqui: ele não está "em dia", está
 * desconhecido. Só APRESENTAÇÃO da contagem que `calcularSaudeEmbarcacao`
 * já faz no agregado — nenhuma régua nova.
 */
export function contarEmDiaPorAba(itens: ItemParaSaude[]): ContagemPorAba[] {
  const mapa = new Map<Aba, number>()
  for (const i of itens) {
    if (!i.temInformacao || i.status !== "ok") continue
    mapa.set(i.aba, (mapa.get(i.aba) ?? 0) + 1)
  }
  return [...mapa.entries()]
    .map(([aba, quantidade]) => ({ aba, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.aba.localeCompare(b.aba, "pt-BR"))
}

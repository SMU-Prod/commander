import { diaCivilSP, diasAteData } from "@/lib/domain/datas"
import type { Aba } from "@/lib/domain/permissoes"
import { formatarDataCurta, type StatusFarol } from "@/lib/domain/semaforo"

/**
 * Ocorrências (onda 32) — "Diário gera histórico. Ocorrência gera ação."
 * Entidade com estado, sempre nascida ligada a um setor (hub) da embarcação.
 * Ver docs/prd/upgrade2-master.txt §22 e docs/auditoria/2026-08-14-prd-upgrade2-parte1.md §22.
 *
 * Onda 44 — o PRD FINAL (§7) acrescenta um quarto estado: "ABERTA → EM
 * ACOMPANHAMENTO → RESOLVIDA; pode também ser anulada com registro quando
 * criada por engano". "Anulada" NÃO é exclusão: a linha continua no
 * histórico, com autor, data e motivo (§7: "Registros finalizados relevantes
 * não são apagados silenciosamente"). É o oposto de apagar — é dizer, por
 * escrito, que aquele registro não vale.
 */
export const ESTADOS_OCORRENCIA = ["aberta", "em_acompanhamento", "resolvida", "anulada"] as const
export type EstadoOcorrencia = (typeof ESTADOS_OCORRENCIA)[number]

export const ROTULO_ESTADO: Record<EstadoOcorrencia, string> = {
  aberta: "Aberta",
  em_acompanhamento: "Em acompanhamento",
  resolvida: "Resolvida",
  anulada: "Anulada",
}

export const GRAVIDADES = ["baixa", "media", "alta"] as const
export type Gravidade = (typeof GRAVIDADES)[number]

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { baixa: "Baixa", media: "Média", alta: "Alta" }

/** Setores onde uma ocorrência pode nascer — os hubs de verdade da
 *  embarcação. Deriva de `Aba` (mesma régua de permissão do resto do app),
 *  mas exclui as áreas que não são "lugar no barco" (diário é a origem, não
 *  o destino; histórico é uma visão, não um setor; fotos/contatos/gastos
 *  não têm componente físico pra ter uma avaria). Espelha exatamente o
 *  check constraint `ocorrencias_aba_check` no banco (migration 032) — sem
 *  isso, o formulário aceitaria um setor que o banco rejeitaria. */
export const ABAS_OCORRENCIA = [
  "embarcacao", "motores", "eletrica", "casco", "hidraulica", "seguranca", "equipamentos", "documentos",
] as const satisfies readonly Aba[]
export type AbaOcorrencia = (typeof ABAS_OCORRENCIA)[number]

/** O que uma ocorrência pode virar a partir do estado atual (nunca o
 *  próprio estado — não é transição ficar onde já está). Único domínio
 *  puro testado por TDD que decide "o que pode virar o quê" (CLAUDE.md,
 *  seção 1).
 *
 *  Regras e o porquê de cada uma:
 *
 *  - "resolvida" só reabre para "em acompanhamento" (nunca direto pra
 *    "aberta" de novo — isso apagaria o fato de que alguém já retomou o caso).
 *
 *  - ANULAR só a partir de "aberta" ou "em acompanhamento". O caso real do
 *    PRD é o engano recente: alguém marca "óleo vazando" no checklist do
 *    Diário na saída, percebe no minuto seguinte que apontou o motor errado,
 *    e precisa desfazer sem apagar. Nesse momento a ocorrência está aberta
 *    ou, no máximo, alguém já olhou (em acompanhamento) e viu que não era
 *    nada. Uma ocorrência RESOLVIDA, não: ela documenta trabalho que
 *    aconteceu de verdade (alguém trocou uma peça, pagou um mecânico) —
 *    anular ali reescreveria a história da manutenção do barco, que é
 *    exatamente o que o §7 proíbe. Se uma resolvida estava errada, o
 *    caminho honesto é reabrir e tratar.
 *
 *  - "anulada" volta só pra "aberta": anular exige motivo escrito
 *    (`validarMotivoAnulacao`), então não é um clique acidental — mas se a
 *    própria anulação foi o engano, a ocorrência recomeça do zero, do jeito
 *    que nasceu. Nada é perdido: cada ida e volta vira linha em
 *    `ocorrencias_transicoes`. */
export const TRANSICOES: Record<EstadoOcorrencia, readonly EstadoOcorrencia[]> = {
  aberta: ["em_acompanhamento", "resolvida", "anulada"],
  em_acompanhamento: ["aberta", "resolvida", "anulada"],
  resolvida: ["em_acompanhamento"],
  anulada: ["aberta"],
}

export function transicoesPossiveis(atual: EstadoOcorrencia): readonly EstadoOcorrencia[] {
  return TRANSICOES[atual]
}

export function podeTransicionar(atual: EstadoOcorrencia, novo: EstadoOcorrencia): boolean {
  return TRANSICOES[atual].includes(novo)
}

/** Farol reaproveitado (mesma linguagem visual do resto do app, onda 7):
 *  aberta = vermelho (ninguém cuidou ainda — "!" reservado a crítico, PRD
 *  §16), em_acompanhamento = amarelo (alguém já está de olho), resolvida =
 *  verde.
 *
 *  "Anulada" volta `null` de propósito: não tem farol. Verde diria "está
 *  tudo certo, foi resolvido", e não foi — ninguém consertou nada, o
 *  registro é que não valia. Quem desenha usa `FarolOcorrencia`
 *  (`components/farol.tsx`), que troca o ponto colorido por um ponto neutro
 *  nesse caso. */
export function faroDoEstado(estado: EstadoOcorrencia): StatusFarol | null {
  if (estado === "anulada") return null
  if (estado === "resolvida") return "ok"
  if (estado === "em_acompanhamento") return "atencao"
  return "vencido"
}

/** Os únicos estados que representam um problema VIVO no barco — os que
 *  ainda pedem ação de alguém.
 *
 *  Existe pra ser a origem única do filtro de quem monta a lista que a
 *  Saúde da Embarcação consome (`OcorrenciaParaSaude` em `lib/domain/saude.ts`)
 *  e do que aparece como "Ocorrências abertas" na Início. Uma ocorrência
 *  ANULADA não pode continuar puxando a nota pra baixo: ela foi declarada
 *  inexistente por escrito. Resolvida também não pesa — já era assim desde a
 *  onda 32. A conta em si (pesos e fórmula) não muda por causa disto: a
 *  filtragem acontece ANTES, na origem. */
export const ESTADOS_QUE_PESAM_NA_SAUDE = ["aberta", "em_acompanhamento"] as const
export type EstadoQuePesaNaSaude = (typeof ESTADOS_QUE_PESAM_NA_SAUDE)[number]

export function pesaNaSaude(estado: EstadoOcorrencia): estado is EstadoQuePesaNaSaude {
  return (ESTADOS_QUE_PESAM_NA_SAUDE as readonly string[]).includes(estado)
}

/** `resolvida_em` anda junto do estado: grava a hora exata ao resolver,
 *  limpa ao sair de "resolvida" (reabertura) — nunca fica um carimbo velho
 *  mentindo que ainda está resolvida. PRD: "quando resolvida, o evento
 *  permanece no histórico" — isso é sobre a LINHA (nunca apagada), não
 *  sobre este campo. */
export function proximaResolvidaEm(novoEstado: EstadoOcorrencia, agoraISO: string): string | null {
  return novoEstado === "resolvida" ? agoraISO : null
}

/** Motivo da anulação: obrigatório e com conteúdo de verdade. "Com registro"
 *  (PRD §7) perde o sentido se o motivo puder ser um espaço em branco ou um
 *  "x" — daqui a seis meses ninguém sabe por que aquela ocorrência foi
 *  invalidada, e o registro vira ruído em vez de memória. Devolve o texto
 *  limpo, ou null quando não serve — quem chama decide a mensagem de erro. */
export const MINIMO_MOTIVO_ANULACAO = 5

export function validarMotivoAnulacao(bruto: unknown): string | null {
  const texto = String(bruto ?? "").trim()
  return texto.length >= MINIMO_MOTIVO_ANULACAO ? texto : null
}

/** Os três campos de anulação andam juntos e sempre no mesmo passo da
 *  transição — autoria, data e motivo. Ao SAIR de "anulada" (reabertura) os
 *  três voltam a null: manter o carimbo faria a ocorrência reaberta parecer
 *  anulada pra qualquer consulta que olhe só as colunas. O rastro do que
 *  aconteceu não se perde por isso — ele mora em `ocorrencias_transicoes`,
 *  que nunca é apagada (mesmo contrato de `proximaResolvidaEm`). */
export interface RegistroAnulacao {
  anulada_em: string | null
  anulada_por: string | null
  motivo_anulacao: string | null
}

export function registroDaAnulacao(
  novoEstado: EstadoOcorrencia,
  agoraISO: string,
  usuarioId: string,
  motivo: string,
): RegistroAnulacao {
  return novoEstado === "anulada"
    ? { anulada_em: agoraISO, anulada_por: usuarioId, motivo_anulacao: motivo }
    : { anulada_em: null, anulada_por: null, motivo_anulacao: null }
}

// ---------------------------------------------------------------------------
// Apresentação da lista (onda 62, canvas tela-3f) — "ativa é cartão com
// severidade na borda; resolvida volta a ser linha". As funções abaixo só
// escrevem as frases e escolhem a luz; nenhuma régua nova de estado nasce
// aqui (estado continua sendo `faroDoEstado`/`pesaNaSaude` acima).
// ---------------------------------------------------------------------------

/** A luz da borda (e do selo) de um cartão de ocorrência ATIVA — a
 *  severidade que a pessoa DECLAROU, não o estado. Alta acende a luz de
 *  crítico (é o que a Saúde chama de ação necessária — `GRAVIDADE_CRITICA`
 *  em saude.ts); média e baixa acendem a de atenção (o canvas 3f pinta as
 *  duas de âmbar: problema conhecido, sem alarme). Sem gravidade registrada
 *  não se inventa cor — `null`, borda neutra (mesma regra de honestidade da
 *  Saúde: dado ausente nunca vira MAIS alarme). */
export function farolDaGravidade(gravidade: Gravidade | null): StatusFarol | null {
  if (gravidade == null) return null
  return gravidade === "alta" ? "vencido" : "atencao"
}

/**
 * ONDA 63 — TRÊS GRAVIDADES, TRÊS TONS (auditoria visual 18/08, §7).
 *
 * `farolDaGravidade` acima responde uma pergunta de LÓGICA — "isto pesa na
 * Saúde como ação necessária?" — e tem só duas respostas de peso, o que está
 * certo pra ela. Mas a tela de Ocorrências a usava também pra decidir COR, e
 * aí o resultado ficava mentiroso: "Média" e "Baixa" saíam no mesmo âmbar,
 * indistinguíveis, e uma escala de três níveis com duas cores é uma escala
 * de dois níveis com um rótulo a mais.
 *
 * A régua do tom é outra, e é a honesta: vermelho é o que pede ação agora
 * (alta); âmbar é o que está no radar (média); baixa é problema CONHECIDO e
 * registrado — não é alarme, é anotação, e anotação não acende luz. Neutro
 * não quer dizer "sem gravidade": a palavra "Baixa" continua no selo (cor E
 * palavra, DESIGN §6 regra 3), o que muda é ela parar de disputar atenção
 * com o que é urgente de verdade.
 *
 * Sem gravidade registrada continua `null` — dado ausente nunca vira mais
 * alarme, e nem menos.
 */
export type TomGravidade = "critico" | "atencao" | "neutro"

export function tomDaGravidade(gravidade: Gravidade | null): TomGravidade | null {
  if (gravidade == null) return null
  if (gravidade === "alta") return "critico"
  return gravidade === "media" ? "atencao" : "neutro"
}

/** A linha de contexto do cartão de uma ocorrência ATIVA (canvas 3f):
 *  "Casco · aberta em 10/08 por Marcos Jordão · em acompanhamento".
 *  Sem autor conhecido a frase para na data — nunca um "por Alguém" que só
 *  confessa que não sabemos. O estado só entra quando acrescenta algo:
 *  "aberta em 10/08" já diz que está aberta; "em acompanhamento" é a
 *  informação nova (alguém já está cuidando). */
export function linhaDaAtiva(p: {
  rotuloAba: string
  aberturaISO: string
  autor: string | null
  estado: EstadoQuePesaNaSaude
}): string {
  const quando = formatarDataCurta(diaCivilSP(p.aberturaISO))
  const abertura = `${p.rotuloAba} · aberta em ${quando}${p.autor ? ` por ${p.autor}` : ""}`
  return p.estado === "em_acompanhamento" ? `${abertura} · em acompanhamento` : abertura
}

/** Os chips de rodapé do cartão de uma ativa (canvas 3f: "2 fotos ·
 *  1 orçamento · 6 dias aberta") — só o que EXISTE de verdade no dado:
 *  o anexo quando há um, e há quanto tempo o problema está em aberto.
 *  Orçamento não é entidade do Commander; não se desenha chip pra ele. */
export function chipsDaAtiva(temAnexo: boolean, aberturaISO: string, hojeISO: string): string[] {
  const chips: string[] = []
  if (temAnexo) chips.push("1 anexo")
  const dias = diasAteData(hojeISO, diaCivilSP(aberturaISO))
  if (dias <= 0) chips.push("aberta hoje")
  else chips.push(dias === 1 ? "1 dia aberta" : `${dias} dias aberta`)
  return chips
}

/** O subtítulo de uma linha FINALIZADA (canvas 3f): "Resolvida em 02/08 ·
 *  troca de impelidor" / "Anulada em 21/07 · registro não procedia". A nota
 *  é a observação escrita por quem fechou (na anulada, o motivo obrigatório
 *  do PRD §7); sem data conhecida a palavra fica sozinha — nunca se inventa
 *  um carimbo. */
export function linhaDaFinalizada(p: {
  estado: "resolvida" | "anulada"
  quandoISO: string | null
  nota: string | null
}): string {
  const palavra = p.estado === "resolvida" ? "Resolvida" : "Anulada"
  const quando = p.quandoISO ? ` em ${formatarDataCurta(diaCivilSP(p.quandoISO))}` : ""
  const nota = p.nota?.trim() ? ` · ${p.nota.trim()}` : ""
  return `${palavra}${quando}${nota}`
}

/** O título do painel de finalizadas — diz o que o painel de fato contém,
 *  em vez de um "Resolvidas recentemente" fixo que mentiria quando o filtro
 *  mostra só anuladas. `null` sem nada finalizado: painel nenhum. */
export function tituloDasFinalizadas(temResolvida: boolean, temAnulada: boolean): string | null {
  if (temResolvida && temAnulada) return "Resolvidas e anuladas"
  if (temResolvida) return "Resolvidas recentemente"
  if (temAnulada) return "Anuladas"
  return null
}

/**
 * COMMANDER ENTERPRISE — perfis, aprovação e auditoria (onda 69).
 *
 * PRD-UPGRADE-3-COTAS §3 (perfis e permissões), §22 (auditoria e regras de
 * dados) e §24 (fase "P0 — Base Enterprise"). Módulo puro: nada aqui toca o
 * banco, como em `permissoes.ts` e `plano-acesso.ts`.
 *
 * ---------------------------------------------------------------------------
 * A BOA NOTÍCIA QUE MOLDA ESTE ARQUIVO
 * ---------------------------------------------------------------------------
 * O §22 do PRD termina com: "Permissões devem ser aplicadas no backend, não
 * apenas escondendo botões na interface." O Commander já faz exatamente isso
 * desde a onda 32 — 15 áreas em `ABAS`, jsonb por vínculo, e a função
 * `permissao()` no próprio Postgres decidindo o acesso. Não há máquina nova a
 * construir aqui.
 *
 * Então o perfil Enterprise NÃO é um sistema de permissão paralelo: é um
 * PRESET da matriz que já existe, do mesmo jeito que `completo` e
 * `operacional` já são em `PRESETS`. Um sistema paralelo criaria duas
 * verdades sobre quem pode o quê — e a onda 63 já mostrou o preço de ter duas
 * réguas pra mesma pergunta.
 */

import { ABAS, type Aba, type PermissaoAba, type Permissoes } from "./permissoes"

// ---------------------------------------------------------------------------
// §3 — os perfis
// ---------------------------------------------------------------------------

/**
 * Os papéis de um vínculo. `PROP` e `CMDT` são os de sempre (migration 001) e
 * seguem valendo pro Commander individual; os cinco de baixo são do
 * Enterprise. Um enum só, e não dois, porque `vinculos.papel` é uma coluna só:
 * duas listas concorrentes dariam no mesmo problema de duas verdades.
 */
export const PAPEIS = [
  "PROP", "CMDT",
  "ADM_GERAL", "ADM", "OPERACOES", "MECANICA", "COTISTA",
] as const

export type Papel = (typeof PAPEIS)[number]

/** Os cinco que só existem em conta empresarial. */
export const PAPEIS_ENTERPRISE = ["ADM_GERAL", "ADM", "OPERACOES", "MECANICA", "COTISTA"] as const
export type PapelEnterprise = (typeof PAPEIS_ENTERPRISE)[number]

export function ehPapelEnterprise(p: Papel): p is PapelEnterprise {
  return (PAPEIS_ENTERPRISE as readonly string[]).includes(p)
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  PROP: "Proprietário",
  CMDT: "Comandante",
  ADM_GERAL: "ADM Geral",
  ADM: "ADM",
  OPERACOES: "Operações",
  MECANICA: "Mecânica",
  COTISTA: "Cotista",
}

/** A função de cada perfil, na voz do §3 — é o texto que a tela de equipe
 *  mostra ao lado do nome. Fonte única pra tela e convite não divergirem. */
export const FUNCAO_PAPEL: Record<PapelEnterprise, string> = {
  ADM_GERAL: "Contato oficial com o suporte Commander; controle máximo da conta.",
  ADM: "Gestão da frota, publicações, aprovações, financeiro operacional, cotistas e equipe.",
  OPERACOES: "Campo e pátio: check-in/out, horas, avarias, fotos, combustível e tarefas.",
  MECANICA: "Diagnóstico, conserto, peças, fotos, datas e histórico técnico.",
  COTISTA: "Vê a própria unidade; vota e conversa com a administradora.",
}

// ---------------------------------------------------------------------------
// Os presets — cada perfil é um recorte da matriz de 15 áreas
// ---------------------------------------------------------------------------

function montar(entradas: Partial<Record<Aba, PermissaoAba>>): Permissoes {
  const base = {} as Permissoes
  for (const aba of ABAS) base[aba] = entradas[aba] ?? { ver: false, editar: false }
  return base
}

const TUDO = Object.fromEntries(ABAS.map((a) => [a, { ver: true, editar: true }])) as Record<Aba, PermissaoAba>

/**
 * O que cada perfil enxerga. Sai direto da tabela do §3.
 *
 * `COTISTA` é o mais restrito de propósito, e a regra que o define é o §13:
 * *"Cotista visualiza a própria unidade; não administra a frota."* Zero
 * `editar` em qualquer área — nada que ele envia altera o registro oficial
 * sozinho (§15: vai pro hub de Atualizações e o ADM incorpora ou arquiva).
 *
 * `MECANICA` edita o técnico e nada mais: não vê Financeiro nem Carteira. O
 * §7 é explícito que o módulo não deve virar ERP de oficina, e dar acesso a
 * dinheiro da frota a quem conserta motor é o começo desse caminho.
 */
export const PRESET_ENTERPRISE: Record<PapelEnterprise, Permissoes> = {
  // §3: "controle máximo da conta".
  ADM_GERAL: montar(TUDO),
  // §3: ADM faz gestão da frota inteira. Mesma superfície do ADM Geral — o
  // que os separa não é área, é o §19 (só o ADM Geral fala com o suporte
  // Commander) e a quantidade (1 principal). Permissão de tela não é o lugar
  // de expressar isso.
  ADM: montar(TUDO),
  // §6 — a home de campo: unidade, horas, avarias, fotos, combustível,
  // checks e tarefas. Sem Financeiro, sem Carteira, sem Contatos.
  OPERACOES: montar({
    embarcacao: { ver: true, editar: false },
    motores: { ver: true, editar: true },
    eletrica: { ver: true, editar: true },
    casco: { ver: true, editar: true },
    hidraulica: { ver: true, editar: true },
    seguranca: { ver: true, editar: false },
    equipamentos: { ver: true, editar: true },
    documentos: { ver: true, editar: false },
    fotos: { ver: true, editar: true },
    diario: { ver: true, editar: true },
    historico: { ver: true, editar: false },
    agenda: { ver: true, editar: true },
  }),
  // §7 — só o técnico.
  MECANICA: montar({
    embarcacao: { ver: true, editar: false },
    motores: { ver: true, editar: true },
    eletrica: { ver: true, editar: true },
    casco: { ver: true, editar: true },
    hidraulica: { ver: true, editar: true },
    seguranca: { ver: true, editar: true },
    equipamentos: { ver: true, editar: true },
    documentos: { ver: true, editar: false },
    fotos: { ver: true, editar: true },
    diario: { ver: true, editar: true },
    historico: { ver: true, editar: false },
    agenda: { ver: true, editar: false },
  }),
  // §13 — viewer da própria unidade, e só.
  COTISTA: montar({
    embarcacao: { ver: true, editar: false },
    motores: { ver: true, editar: false },
    documentos: { ver: true, editar: false },
    fotos: { ver: true, editar: false },
    historico: { ver: true, editar: false },
  }),
}

// ---------------------------------------------------------------------------
// §3 — a régua de aprovação
// ---------------------------------------------------------------------------

/**
 * "O ADM controla a régua de confiança por usuário e/ou ação."
 *
 * O exemplo do próprio PRD explica melhor que qualquer paráfrase: horas
 * lançadas por funcionário experiente entram direto; funcionário novo pode
 * exigir conferência 1 a 1.
 */
export const MODOS_APROVACAO = ["sem_aprovacao", "somente_criticos", "tudo"] as const
export type ModoAprovacao = (typeof MODOS_APROVACAO)[number]

export const ROTULO_MODO_APROVACAO: Record<ModoAprovacao, string> = {
  sem_aprovacao: "Sem aprovação",
  somente_criticos: "Somente críticos",
  tudo: "Tudo exige aprovação",
}

export const EXPLICACAO_MODO_APROVACAO: Record<ModoAprovacao, string> = {
  sem_aprovacao: "Lançamentos autorizados entram direto.",
  somente_criticos: "Ações críticas aguardam o ADM; rotina entra direto.",
  tudo: "Cada lançamento desta pessoa fica pendente.",
}

/**
 * As ações que a régua governa. `critica` marca o que espera o ADM no modo
 * "somente_criticos" — e a escolha de cada uma tem motivo:
 *
 *   · `avaria_abrir` é crítica porque avaria vira custo e some com a unidade
 *     da operação; `horas_lancar` é crítica porque horímetro puxa o plano de
 *     manutenção inteiro (o `calcularSemaforo` do app lê essas horas).
 *   · `check_out`/`check_in` NÃO são críticos: travar o pátio esperando ADM
 *     pra soltar um Jet é exatamente a fricção que o §6 manda evitar
 *     ("rápida, botões grandes e poucos passos").
 */
export const ACOES_ENTERPRISE = [
  "check_out", "check_in", "horas_lancar", "avaria_abrir", "combustivel_lancar",
  "estoque_retirar", "manutencao_registrar", "publicar_para_cotistas",
] as const
export type AcaoEnterprise = (typeof ACOES_ENTERPRISE)[number]

const CRITICA: Record<AcaoEnterprise, boolean> = {
  check_out: false,
  check_in: false,
  horas_lancar: true,
  avaria_abrir: true,
  combustivel_lancar: false,
  estoque_retirar: false,
  manutencao_registrar: true,
  publicar_para_cotistas: true,
}

export function ehAcaoCritica(acao: AcaoEnterprise): boolean {
  return CRITICA[acao]
}

/**
 * Esta ação, feita por esta pessoa, entra direto ou fica pendente?
 *
 * ---------------------------------------------------------------------------
 * A EXCEÇÃO QUE NÃO TEM EXCEÇÃO
 * ---------------------------------------------------------------------------
 * O §7 do PRD escreve, e o §25 repete nos critérios de aceite: *"Publicação
 * de registros da Mecânica para cotistas SEMPRE passa pelo ADM, mesmo que o
 * mecânico seja confiável"* e *"Mecânica nunca publica diretamente aos
 * cotistas"*.
 *
 * Por isso `publicar_para_cotistas` é checada ANTES do modo: nem
 * `sem_aprovacao` a libera. É a única ação do sistema que ignora a régua de
 * confiança — e ignora de propósito, porque o que está do outro lado dela não
 * é o dono do barco, são dez cotistas que vão ler aquilo como verdade oficial
 * da administradora.
 */
export function exigeAprovacao(
  modo: ModoAprovacao,
  acao: AcaoEnterprise,
  papel: Papel,
): boolean {
  if (acao === "publicar_para_cotistas" && papel === "MECANICA") return true
  switch (modo) {
    case "tudo":
      return true
    case "somente_criticos":
      return ehAcaoCritica(acao)
    case "sem_aprovacao":
      return false
  }
}

/**
 * §7 E §25 NA PERGUNTA QUE A TELA E A ACTION REALMENTE FAZEM.
 *
 * AUDITORIA 19/08, B6 e A7. A trava de "Mecânica nunca publica direto para
 * cotistas" era um `ehDono &&` escrito no JSX de /mecanica e um
 * `painel.papel !== "PROP"` na action — enquanto a régua que conhece os sete
 * papéis, tem 12 casos de teste e mora aqui não era chamada por ninguém. Quem
 * for "ADM" ou "Operações" caía no `else` por acidente, não por decisão.
 *
 * Vale lembrar por que isso é grave e não estético: a policy da migration 063
 * ("servicos_mecanica: quem edita motores atualiza") deixa QUALQUER pessoa com
 * `motores.editar` escrever `publicado_em` — e o mecânico tem essa permissão
 * no preset. A única coisa que impede o laudo de ir cru aos dez cotistas é
 * esta decisão, no app. Ela não podia continuar sendo um `&&` no meio do JSX.
 *
 * `exigeAprovacao` responde "entra direto ou fica pendente?"; esta função
 * traduz isso para o gesto de publicar, que é o único do app sem fila de
 * pendência — aqui "fica pendente" significa "não é você quem publica".
 */
const MOTIVO_SO_ADM = "Publicar laudo para os cotistas é ato da administradora."
const MOTIVO_MECANICA =
  "Laudo da Mecânica sempre passa pelo ADM antes de ir aos cotistas — mesmo com a régua de " +
  "confiança em “sem aprovação”."
const MOTIVO_APROVACAO =
  "Seu acesso está com aprovação do ADM ligada para esta ação. Peça a ele para publicar."

export function podePublicarParaCotistas(
  papel: Papel,
  modo: ModoAprovacao,
): { pode: boolean; motivo: string | null } {
  // A régua de confiança governa a EQUIPE de uma conta empresarial. PROP e
  // CMDT são o Commander individual e não têm preset Enterprise — fora do
  // Enterprise, publicar é do dono da conta e de mais ninguém.
  if (!ehPapelEnterprise(papel)) {
    return papel === "PROP" ? { pode: true, motivo: null } : { pode: false, motivo: MOTIVO_SO_ADM }
  }
  // Dentro do Enterprise a pergunta é a da régua — e ela já conhece a exceção
  // sem exceção do §7.
  if (exigeAprovacao(modo, "publicar_para_cotistas", papel)) {
    return { pode: false, motivo: papel === "MECANICA" ? MOTIVO_MECANICA : MOTIVO_APROVACAO }
  }
  // Sobrou quem É a administradora. Operações e Cotista não editam laudo pelo
  // `PRESET_ENTERPRISE` e não deveriam chegar aqui com serviço na mão — mas a
  // régua não é o lugar de contar com isso.
  return papel === "ADM" || papel === "ADM_GERAL"
    ? { pode: true, motivo: null }
    : { pode: false, motivo: MOTIVO_SO_ADM }
}

// ---------------------------------------------------------------------------
// §22 — auditoria
// ---------------------------------------------------------------------------

/**
 * O que a trilha de auditoria registra. Cada entrada sai de uma linha do §22:
 * autor e data/hora em todo lançamento; antes/depois nas alterações
 * relevantes; quem aprovou e quando; qual ADM publicou; bloqueio/desbloqueio
 * de cotista; e ajuste de tanque/estoque com motivo quando gera divergência.
 */
export const EVENTOS_AUDITADOS = [
  "criou", "alterou", "excluiu",
  "aprovou", "recusou",
  "publicou_para_cotistas",
  "bloqueou_cotista", "desbloqueou_cotista",
  "ajustou_com_divergencia",
] as const
export type EventoAuditado = (typeof EVENTOS_AUDITADOS)[number]

export const ROTULO_EVENTO: Record<EventoAuditado, string> = {
  criou: "criou",
  alterou: "alterou",
  excluiu: "excluiu",
  aprovou: "aprovou",
  recusou: "recusou",
  publicou_para_cotistas: "publicou para os cotistas",
  bloqueou_cotista: "bloqueou o acesso de",
  desbloqueou_cotista: "reativou o acesso de",
  ajustou_com_divergencia: "ajustou com divergência",
}

/**
 * §22: "Ajustes de tanque/estoque exigem motivo quando gerarem divergência."
 *
 * A palavra que carrega a regra é "quando": ajuste que bate com o saldo
 * teórico não precisa justificar nada. Só o que diverge é que precisa — e aí
 * precisa mesmo, porque combustível que some sem explicação é o problema que
 * o §11 existe pra tornar visível.
 */
export function exigeMotivoDeAjuste(saldoTeorico: number, medidoFisico: number): boolean {
  return saldoTeorico !== medidoFisico
}

/**
 * A frase da linha de auditoria, montada num lugar só.
 * "Ana Souza aprovou · 18/08/2026 14:32"
 */
export function linhaDeAuditoria(
  autor: string,
  evento: EventoAuditado,
  quandoISO: string,
  alvo?: string | null,
): string {
  const quando = new Date(quandoISO).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
  const meio = [ROTULO_EVENTO[evento], alvo?.trim() || null].filter(Boolean).join(" ")
  return `${autor} ${meio} · ${quando}`
}

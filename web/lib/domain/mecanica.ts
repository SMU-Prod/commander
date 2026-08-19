/**
 * MECÂNICA, ORÇAMENTOS E VOTAÇÃO (onda 72).
 * PRD-UPGRADE-3-COTAS §7 (Mecânica), §9 (Orçamentos e votação dos cotistas).
 *
 * Módulo puro, como o resto do domínio.
 *
 * O §7 abre com a trava de escopo: *"Módulo simples e objetivo; não criar ERP
 * de oficina."* Tudo o que não está aqui foi deixado de fora por causa dessa
 * frase — ordem de serviço numerada, apontamento de mão de obra por hora,
 * fila de bancada, faturamento. O Commander registra o que foi feito no
 * barco; quem gerencia a oficina é a oficina.
 */

import { diaCivilSP, diasAteData } from "./datas"

// ---------------------------------------------------------------------------
// §7 — o andamento do serviço
// ---------------------------------------------------------------------------

/** Os quatro estados que o §7 lista, nesta ordem. */
export const ESTADOS_SERVICO = [
  "em_diagnostico", "em_conserto", "aguardando_peca", "concluido",
] as const

export type EstadoServico = (typeof ESTADOS_SERVICO)[number]

export const ROTULO_ESTADO_SERVICO: Record<EstadoServico, string> = {
  em_diagnostico: "Em diagnóstico",
  em_conserto: "Em conserto",
  aguardando_peca: "Aguardando peça",
  concluido: "Concluído",
}

/**
 * O tom de cada estado no farol da tela.
 *
 * `aguardando_peca` é ATENÇÃO e não neutro de propósito: é o estado em que o
 * barco fica parado por causa de terceiro, e é o que o ADM precisa enxergar
 * numa lista de vinte unidades. "Em conserto" é trabalho acontecendo;
 * "aguardando peça" é trabalho parado.
 */
export type TomServico = "andando" | "parado" | "fechado"

export function tomDoServico(e: EstadoServico): TomServico {
  if (e === "concluido") return "fechado"
  return e === "aguardando_peca" ? "parado" : "andando"
}

/** Serviço aberto = qualquer coisa que não seja concluído. É o que conta no
 *  painel do ADM ("quantas unidades estão na mecânica agora"). */
export function servicoAberto(e: EstadoServico): boolean {
  return e !== "concluido"
}

/**
 * HÁ QUANTO TEMPO ESTE MOTOR ESTÁ NA OFICINA (auditoria 19/08, A15).
 *
 * `servicos_mecanica.entrada_em` era pedida no formulário de abrir serviço,
 * gravada por `abrirServico` e nunca chegava à tela. Devolvê-la como a DATA
 * CRUA ("entrou em 05/08") fechava o achado pela letra e não pelo espírito: a
 * pergunta que essa coluna existe pra responder não é "que dia entrou", é
 * *"há quanto tempo esse barco está parado lá"* — e quem lê uma data solta
 * numa lista de vinte serviços tem que fazer a subtração de cabeça, uma vez
 * por linha. O número que decide se o ADM liga pra oficina é o intervalo, não
 * a data; a data vira o detalhe de quem quiser conferir.
 *
 * A CONTA SÓ VALE ENQUANTO O SERVIÇO ESTÁ ABERTO. Num serviço concluído
 * "na oficina há 40 dias" seria mentira com cara de alarme — ele saiu de lá.
 * Fechado, a frase volta a ser a data, que é o fato que resta.
 *
 * SEM `entrada_em` NÃO SE ESCREVE NADA (devolve `null`, e a tela omite a
 * frase). Serviço sem entrada anotada não entrou "há 0 dias": ninguém digitou
 * a data. É a mesma régua de `lib/domain/patio.ts` — ausência não vira zero
 * desenhado.
 *
 * DATA NO FUTURO NÃO VIRA "HÁ −3 DIAS". Um dedo errado no seletor de data
 * (2027 em vez de 2026) produziria intervalo negativo, e "há −180 dias" é o
 * tipo de número que faz a pessoa desconfiar da tela inteira. A frase diz o
 * que o dado realmente é: uma entrada marcada pra frente.
 */
export const DIAS_OFICINA_DEMORADO = 30

export interface TempoNaOficina {
  frase: string
  /** Passou de `DIAS_OFICINA_DEMORADO` com o serviço ainda aberto — a tela
   *  pinta a frase em `text-warn`. Não é erro nem alarme: é o intervalo em que
   *  "está na oficina" deixa de ser andamento e vira pergunta pro fornecedor. */
  demorado: boolean
}

export function tempoNaOficina(
  entradaEm: string | null,
  hoje: string,
  aberto: boolean,
): TempoNaOficina | null {
  if (!entradaEm) return null
  const dia = diaCivilSP(entradaEm)
  const dataBr = dia.split("-").reverse().join("/")
  if (!aberto) return { frase: `entrou em ${dataBr}`, demorado: false }

  const dias = -diasAteData(dia, hoje)
  if (dias < 0) return { frase: `entrada marcada para ${dataBr}`, demorado: false }
  if (dias === 0) return { frase: "entrou hoje na oficina", demorado: false }
  if (dias === 1) return { frase: "na oficina há 1 dia", demorado: false }
  // Dois meses é onde a contagem em dias para de informar: "há 187 dias" é um
  // número que ninguém converte, e o que a frase precisa transmitir a partir
  // daí não é precisão, é a ordem de grandeza do abandono.
  if (dias < 60) return { frase: `na oficina há ${dias} dias`, demorado: dias >= DIAS_OFICINA_DEMORADO }
  return { frase: `na oficina há ${Math.floor(dias / 30)} meses`, demorado: true }
}

// ---------------------------------------------------------------------------
// §9 — votação dos cotistas
// ---------------------------------------------------------------------------

/**
 * §9: *"APROVAR ou NÃO APROVAR. Sem comentários no voto."*
 *
 * A ausência de comentário é regra, não simplificação: o §9 dá ao cotista um
 * canal separado (o Chat com a administradora) justamente pra dúvida não
 * virar debate no voto. Voto com comentário viraria fórum, e o ADM passaria
 * a moderar discussão em vez de tocar o serviço.
 */
export type Voto = "aprovar" | "nao_aprovar"

export interface ApuracaoVotacao {
  total: number
  aprovaram: number
  naoAprovaram: number
  faltamVotar: number
  /** "8/10" — quantos já votaram, no formato mono da tela. */
  rotulo: string
  /** §9: "10/10 aprovados → status 'Aprovado por todos'". */
  aprovadoPorTodos: boolean
  /** Alguém já votou contra. Não bloqueia nada sozinho — ver `situacao`. */
  temRecusa: boolean
}

export type SituacaoVotacao = "em_votacao" | "aprovada_por_todos" | "com_recusa"

/**
 * Apura uma votação.
 *
 * `total` é o número de cotistas convidados a votar, não o de votos dados —
 * quem não votou tem que aparecer como "falta votar" e não sumir da conta,
 * senão 2 votos a favor de 10 cotistas leria como unanimidade.
 */
export function apurarVotacao(total: number, votos: readonly Voto[]): ApuracaoVotacao {
  const t = Math.max(0, Math.trunc(total))
  const aprovaram = votos.filter((v) => v === "aprovar").length
  const naoAprovaram = votos.filter((v) => v === "nao_aprovar").length
  const votaram = aprovaram + naoAprovaram
  return {
    total: t,
    aprovaram,
    naoAprovaram,
    faltamVotar: Math.max(0, t - votaram),
    rotulo: `${votaram}/${t}`,
    // Unanimidade exige que TODOS tenham votado a favor. Com t = 0 não há
    // votação nenhuma pra aprovar.
    aprovadoPorTodos: t > 0 && aprovaram === t,
    temRecusa: naoAprovaram > 0,
  }
}

/**
 * Em que pé está a votação.
 *
 * Repare no que NÃO existe aqui: "reprovada". O §9 fecha com a fronteira mais
 * importante deste módulo — *"Commander não executa pagamento e NÃO DETERMINA
 * JURIDICAMENTE O QUÓRUM da empresa."*
 *
 * Se o app declarasse "reprovado", ele estaria decidindo por contrato de
 * sociedade que ele não conhece: em algumas cotas basta maioria, em outras
 * exige-se unanimidade, em outras o administrador decide sozinho. O que o
 * Commander pode afirmar com honestidade é o FATO — quem votou o quê — e o
 * único carimbo que o §9 autoriza, que é a unanimidade. O resto é decisão
 * da administradora, fora do app.
 */
export function situacaoDaVotacao(a: ApuracaoVotacao): SituacaoVotacao {
  if (a.aprovadoPorTodos) return "aprovada_por_todos"
  return a.temRecusa ? "com_recusa" : "em_votacao"
}

export const ROTULO_SITUACAO_VOTACAO: Record<SituacaoVotacao, string> = {
  em_votacao: "Em votação",
  aprovada_por_todos: "Aprovado por todos",
  // Não é "Reprovado": ver `situacaoDaVotacao`. O app relata, não julga.
  com_recusa: "Com voto contrário",
}

/**
 * A frase que o ADM lê embaixo da votação.
 *
 * Diz o número e, quando há recusa, diz explicitamente de quem é a decisão —
 * porque é o momento em que o ADM mais poderia achar que o app decidiu por
 * ele.
 */
export function linhaDaApuracao(a: ApuracaoVotacao): string {
  if (a.total === 0) return "Nenhum cotista com acesso para votar."
  if (a.aprovadoPorTodos) return `Todos os ${a.total} cotistas aprovaram.`
  const base = `${a.aprovaram} aprovaram · ${a.naoAprovaram} não aprovaram · ${a.faltamVotar} ainda não votaram`
  return a.temRecusa
    ? `${base}. Seguir ou não é decisão da administradora — o Commander não define quórum.`
    : base
}

// ---------------------------------------------------------------------------
// §9 — o orçamento
// ---------------------------------------------------------------------------

/**
 * §9: o orçamento tem validade. Vencido não some da tela — ele fica com o
 * aviso, porque o histórico de "pedimos e não aprovamos a tempo" é
 * informação. Mas não pode ir a votação: votar num preço que não vale mais é
 * como o app faria a administradora prometer o que o fornecedor não honra.
 */
export function orcamentoVencido(validoAte: string | null, hoje: string): boolean {
  return validoAte != null && validoAte < hoje
}

export function podeAbrirVotacao(
  validoAte: string | null,
  hoje: string,
  jaTemVotacao: boolean,
): { pode: boolean; motivo: string | null } {
  if (jaTemVotacao) return { pode: false, motivo: "Este orçamento já foi para votação." }
  if (orcamentoVencido(validoAte, hoje)) {
    return { pode: false, motivo: "Este orçamento venceu. Peça um novo ao fornecedor antes de votar." }
  }
  return { pode: true, motivo: null }
}

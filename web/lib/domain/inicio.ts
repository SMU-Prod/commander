import { duracaoHoras, retornoNoDiaSeguinte } from "@/lib/domain/bordo"
import type { EstadoSelo } from "@/components/ui/selo"
import type { SeloMar } from "@/lib/domain/mar"
import { ROTULO_ESTADO_SAUDE, type EstadoSaude, type FatorSaude, type SaudeEmbarcacao } from "@/lib/domain/saude"
import { formatarDataCurta, type ResultadoCalc } from "@/lib/domain/semaforo"

/**
 * AS FRASES E OS NÚMEROS DA INÍCIO — funções puras, testadas, fora do JSX.
 *
 * Existe porque a tela de casa é a única do app que junta seis assuntos
 * (foto, saúde, pendências, diário, motores, gastos) e, até a onda 57, cada
 * um deles formatava o próprio texto numa expressão solta no meio do
 * `return`. Regra de bolso desta onda: se dá pra escrever um `expect`, não
 * mora no `.tsx`.
 *
 * O que NÃO mora aqui: régua de saúde (`saude.ts`), semáforo de item
 * (`semaforo.ts`), conta de gasto (`gastos.ts`). Este arquivo só APRESENTA o
 * que aqueles decidiram — nenhuma regra de produto nova entra por esta porta.
 */

/**
 * O estado da Saúde que a Início pode MOSTRAR — que nem sempre é o que a
 * régua calculou, e o motivo é honestidade (docs/DESIGN.md §6, regra 7).
 *
 * O onboarding cria itens com `ultimo_ciclo_data = hoje` e
 * `intervalo_meses = 12` (`lib/acoes/onboarding.ts`). Pra régua da Saúde
 * isso conta como "informação suficiente", então um barco recém-cadastrado
 * nasce "Saudável" sem ninguém ter digitado uma leitura sequer. A Início já
 * recusava essa mentira no bloco de pendências (o `temDadoReal` que a página
 * calcula desde a onda 16); o que esta função faz é estender a MESMA recusa
 * ao selo que agora fica ao lado da foto — verde grande é a última coisa que
 * um barco desconhecido pode exibir.
 *
 * A exceção: pendência viva (`fatores`) vale por si. Ocorrência aberta é
 * fato que a pessoa informou com a própria mão, não depende de horímetro
 * nenhum pra ser verdade.
 *
 * Isto NÃO reescreve `calcularSaudeEmbarcacao`: a régua continua sendo uma
 * só e `/barco/saude` continua lendo ela direto. Aqui é decisão de EXIBIÇÃO,
 * do mesmo tipo que "não mostrar cartão de viagem sem viagem".
 */
export function estadoExibidoDaSaude(
  saude: Pick<SaudeEmbarcacao, "estado" | "fatores">,
  temDadoReal: boolean,
): EstadoSaude | null {
  if (saude.estado == null) return null
  if (saude.fatores.length > 0) return saude.estado
  return temDadoReal ? saude.estado : null
}

/** Do vocabulário do PRD §5 pro vocabulário do `Selo` (cor E palavra). Sem
 *  estado, neutro: cinza e "Sem dados", nunca verde por omissão.
 *  O `import type` de `components/ui/selo` é só o TIPO (some na compilação):
 *  o ponto de escrever a tradução aqui é que ela tem teste, e um `EstadoSelo`
 *  copiado à mão sairia de sincronia no dia que o Selo ganhar um estado. */
export function seloDaSaude(estado: EstadoSaude | null): EstadoSelo {
  if (estado == null) return "neutro"
  return estado === "saudavel" ? "ok" : estado === "atencao" ? "atencao" : "critico"
}

/** O boletim do mar fala a mesma língua de estado do resto da tela: o selo
 *  dele deixa de ser uma pílula escrita à mão em `/hoje` e passa pelo mesmo
 *  `Selo` do barco. Só a palavra muda ("Bom pra sair", "Mar pesado"). */
export function seloDoMar(nivel: SeloMar["nivel"]): EstadoSelo {
  return nivel === "ok" ? "ok" : nivel === "atencao" ? "atencao" : "critico"
}

/** A palavra do estado — a do PRD §5, ou "Sem dados". Nunca porcentagem
 *  (PRD §1.1, §27.2, §28). */
export function rotuloDaSaude(estado: EstadoSaude | null): string {
  return estado == null ? "Sem dados" : ROTULO_ESTADO_SAUDE[estado]
}

/**
 * A contagem que sobrou do anel: "5 em dia · 1 em atenção · 2 vencidos".
 *
 * Uma linha só, e não três com bolinha colorida do lado, porque o estado já
 * está dito em cima pelo selo — aqui embaixo o que falta é a leitura, e
 * leitura é uma fileira de números em fonte de instrumento (a tela põe
 * `font-mono-instr tabular-nums` na linha inteira).
 *
 * O que é zero não aparece: "0 vencidos" ocupa o mesmo espaço de uma
 * informação sem ser uma.
 */
export function contagemDaSaude(
  saude: Pick<SaudeEmbarcacao, "emDia" | "atencao" | "vencido" | "total">,
): string | null {
  if (saude.total === 0) return null
  const partes: string[] = []
  if (saude.emDia > 0) partes.push(`${saude.emDia} em dia`)
  if (saude.atencao > 0) partes.push(`${saude.atencao} em atenção`)
  if (saude.vencido > 0) partes.push(`${saude.vencido} ${saude.vencido === 1 ? "vencido" : "vencidos"}`)
  return partes.length > 0 ? partes.join(" · ") : null
}

/** Leitura do horímetro, com a casa decimal que o horímetro tem. Sem leitura
 *  vira traço e nunca "0,0 h": motor sem leitura não é motor zerado (PRD
 *  §11 — horímetro é sempre informado à mão). */
export function horasDoMotor(motor: { horas_atuais: number | null }): string {
  if (motor.horas_atuais == null) return "—"
  return `${motor.horas_atuais.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
}

/**
 * A linha de apoio do KPI do motor: quanto falta pra próxima revisão.
 *
 * Escrita aqui e não com `textoRestanteCompacto` porque a frase precisa
 * concordar com "revisão" ("Revisão vencida", não "Revisão vencido") e
 * porque o rótulo do KPI ("Motor BE") não carrega o assunto — sem a palavra
 * "Revisão" o "37h" ao lado de "612,0 h" vira dois números sem dono.
 * Horas mandam sobre dias pelo mesmo motivo de sempre: é o prazo mais
 * preciso que um motor tem.
 *
 * QUEM DECIDE "VENCIDA" É O `status`, NÃO O SINAL DO NÚMERO. Até a onda 57
 * esta função olhava o número arredondado — e `Math.round(-0.4)` é `-0`, com
 * `-0 < 0` valendo `false`: uma revisão vencida há 24 minutos aparecia como
 * "Revisão em 0h", o oposto do fato, no cartão que existe justamente pra
 * avisar. O `status` vem no mesmo objeto e já é a decisão do semáforo.
 *
 * E, vencida, a frase cita o prazo que de fato ESTOUROU: `calcularSemaforo`
 * devolve o pior dos dois lados, então um item com data fixa vencida e
 * horímetro folgado sai `vencido` com `horasRestantes` positivo — citar as
 * horas ali esconderia o vencimento que causou o estado.
 */
export function apoioDaRevisao(r: ResultadoCalc | null): string {
  if (r == null) return "Sem revisão programada"
  if (r.status === "vencido") {
    if (r.horasRestantes != null && r.horasRestantes < 0) {
      const h = Math.round(-r.horasRestantes)
      // Menos de meia hora arredonda pra zero: "vencida há 0h" é um número
      // que não diz nada. O fato — vencida — basta sozinho.
      return h > 0 ? `Revisão vencida há ${h}h` : "Revisão vencida"
    }
    if (r.diasRestantes != null && r.diasRestantes < 0) {
      return `Revisão vencida há ${-r.diasRestantes} dias`
    }
    return "Revisão vencida"
  }
  if (r.horasRestantes != null) return `Revisão em ${Math.round(r.horasRestantes)}h`
  if (r.diasRestantes != null) return `Revisão em ${r.diasRestantes} dias`
  return "Sem revisão programada"
}

/**
 * A frase do cartão do Diário.
 *
 * O ANO APARECE NO ESTADO VAZIO DE PROPÓSITO: a consulta que alimenta este
 * cartão cobre o ano corrente (é a mesma de "Seu ano no mar"), então um
 * "Nenhuma saída registrada" seco seria falso pra quem navegou em dezembro
 * passado. Dizer o ano custa três palavras e mantém a frase verdadeira.
 *
 * A VIRADA DA MEIA-NOITE É DITA EM VOZ ALTA. "22:00 → 01:30" são 3,5 h de
 * verdade — `duracaoHoras` já conta o retorno como dia seguinte — mas sem a
 * marca a frase soa como conta errada, porque o dia da saída não tem 3,5 h
 * depois das 22h. `bordo.ts` já pedia isso de quem exibe a duração, e
 * /diario/[id] já usa exatamente estas palavras: duas telas que dizem a
 * mesma coisa dizem com as mesmas palavras (docs/DESIGN.md §6, regra 6).
 */
export function textoUltimaSaida(
  saida: { data: string; hora_saida: string | null; hora_retorno: string | null } | null,
  ano: string,
): string {
  if (saida == null) return `Nenhuma saída registrada em ${ano}.`
  const horas = duracaoHoras(saida.hora_saida, saida.hora_retorno)
  const tempo = horas != null
    ? ` · ${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h no mar`
    : ""
  const virada = retornoNoDiaSeguinte(saida.hora_saida, saida.hora_retorno)
    ? " · retorno no dia seguinte"
    : ""
  return `Última saída em ${formatarDataCurta(saida.data)}${tempo}${virada}`
}

/**
 * Pra onde vai uma linha de "Precisa da sua atenção".
 *
 * `undefined` (e não uma URL) quando a pessoa não pode editar a área do
 * item: a tela de edição recusaria, e linha que leva a uma recusa é pior que
 * linha que não leva a lugar nenhum. Ocorrência é leitura pra qualquer um
 * que já a enxerga — a RLS decidiu isso antes da lista chegar aqui.
 */
export function linkDoFator(fator: FatorSaude, podeEditarArea: boolean): string | undefined {
  if (fator.tipo === "ocorrencia") return `/barco/ocorrencias/${fator.id}`
  return podeEditarArea ? `/barco/itens/${fator.id}/editar` : undefined
}

/**
 * A variação de gasto do mês, em palavras.
 *
 * Em palavras e não em seta verde/vermelha: no Commander verde/âmbar/
 * vermelho são estado do BARCO (PRD §1.1 — vermelho é reservado a crítico),
 * e gastar 20% a mais que no mês passado não é uma emergência náutica. Era
 * o único vermelho decorativo que sobrava na Início.
 */
export function variacaoDoMes(percentual: number | null): string | undefined {
  if (percentual == null) return undefined
  if (percentual === 0) return "igual ao mês anterior"
  return percentual > 0
    ? `${percentual}% acima do mês anterior`
    : `${-percentual}% abaixo do mês anterior`
}

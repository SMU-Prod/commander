import { duracaoHoras, retornoNoDiaSeguinte, textoDuracao } from "@/lib/domain/bordo"
import type { EstadoSelo } from "@/components/ui/selo"
import { diaCivilSP, diasAteData } from "@/lib/domain/datas"
import type { SeloMar } from "@/lib/domain/mar"
import { ROTULO_ESTADO_SAUDE, type EstadoSaude, type FatorSaude, type SaudeEmbarcacao } from "@/lib/domain/saude"
import type { ResultadoCalc } from "@/lib/domain/semaforo"

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
 * O resumo do cartão da Saúde: "1 vencido · 2 na margem · 1 ocorrência
 * aberta" (canvas do dono, tela-1b) — o pior primeiro, e a mesma ordem de
 * severidade do resto do app.
 *
 * Uma linha só, e não três com bolinha colorida do lado, porque o estado já
 * está dito em cima pelo selo — aqui embaixo o que falta é a leitura.
 *
 * A REGRA DO CANVAS: quando existe problema, "em dia" não aparece — o
 * resumo é do que pede ação, não um censo. Só quando NADA pede ação a linha
 * vira "N em dia", que aí sim é a informação. O que é zero nunca aparece:
 * "0 vencidos" ocupa o mesmo espaço de uma informação sem ser uma.
 *
 * ONDA 62 — a ocorrência aberta ENTROU na linha (era só manutenção): o
 * canvas soma as duas na mesma leitura, e um barco cuja única pendência é
 * uma ocorrência dizia "Nenhum item monitorado…" com o selo âmbar do lado.
 * `ocorrenciasAbertas` já chega filtrado por RLS e por
 * `ESTADOS_QUE_PESAM_NA_SAUDE` — esta função só apresenta.
 *
 * DEVOLVE PARTES E NÃO UMA FRASE (revisão da onda 57). Enquanto era string, a
 * tela punha `font-mono-instr tabular-nums` no parágrafo inteiro e as OITO
 * PALAVRAS iam em monoespaçada junto com os números. Fonte de instrumento é
 * para NÚMERO (docs/DESIGN.md §5): com as partes separadas, quem renderiza
 * põe a mono só no numeral, como o cartão da Tripulação já faz.
 */
export function contagemDaSaude(
  saude: Pick<SaudeEmbarcacao, "emDia" | "atencao" | "vencido" | "total">,
  ocorrenciasAbertas = 0,
): { numero: number; rotulo: string }[] | null {
  if (saude.total === 0 && ocorrenciasAbertas === 0) return null
  const partes: { numero: number; rotulo: string }[] = []
  if (saude.vencido > 0) {
    partes.push({ numero: saude.vencido, rotulo: saude.vencido === 1 ? "vencido" : "vencidos" })
  }
  if (saude.atencao > 0) partes.push({ numero: saude.atencao, rotulo: "na margem" })
  if (ocorrenciasAbertas > 0) {
    partes.push({
      numero: ocorrenciasAbertas,
      rotulo: ocorrenciasAbertas === 1 ? "ocorrência aberta" : "ocorrências abertas",
    })
  }
  if (partes.length === 0 && saude.emDia > 0) partes.push({ numero: saude.emDia, rotulo: "em dia" })
  return partes.length > 0 ? partes : null
}

/**
 * A contagem regressiva da coluna direita de "Precisa da sua atenção"
 * (canvas tela-1b): "-19 d" vencido, "18 h" na margem — número de
 * instrumento, curto, com a cor vindo do farol da linha (nunca daqui).
 *
 * NÃO É UMA SEGUNDA RÉGUA: recebe o MESMO `ResultadoCalc` de
 * `calcularSemaforo` e repete a prioridade de `textoRestanteCompacto`
 * (horas mandam sobre dias — o prazo mais preciso de motor); só o formato
 * muda, de frase pra mostrador. Vencido há menos de meia hora arredonda pra
 * "0 h" — "-0 h" é um número que não existe; o vermelho do farol já diz que
 * venceu.
 */
export function prazoCompacto(r: ResultadoCalc): string {
  if (r.horasRestantes != null) {
    const h = Math.round(Math.abs(r.horasRestantes))
    return r.horasRestantes < 0 && h > 0 ? `-${h} h` : `${h} h`
  }
  if (r.diasRestantes != null) {
    return r.diasRestantes < 0 ? `-${-r.diasRestantes} d` : `${r.diasRestantes} d`
  }
  return "—"
}

/**
 * A idade de uma ocorrência na mesma coluna: "6 d" aberta há seis dias
 * (canvas tela-1b — a linha do vazamento). Ocorrência não tem prazo, então
 * o único número honesto ali é há quanto tempo ela existe. Nunca negativo:
 * carimbo de criação no futuro é relógio errado, não idade.
 */
export function idadeCompacta(criadaEmISO: string, hoje: string): string {
  // `diaCivilSP`, não `.slice(0, 10)`: o slice pega o dia em UTC, e das 21h
  // à meia-noite no Brasil o dia UTC já virou. A MESMA ocorrência aparecia
  // como "6 d" aqui e "7 dias aberta" em /barco/ocorrencias (que sempre usou
  // `diaCivilSP`) — dois lotes da onda 62 responderam diferente à mesma
  // pergunta. É pra isso que `diaCivilSP` existe (ver o docblock dela).
  const dias = Math.max(0, -diasAteData(diaCivilSP(criadaEmISO), hoje))
  return `${dias} d`
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
      // Menos de meia hora arredonda pra zero: "vencida há 0 h" é um número
      // que não diz nada. O fato — vencida — basta sozinho.
      return h > 0 ? `Revisão vencida há ${h} h` : "Revisão vencida"
    }
    if (r.diasRestantes != null && r.diasRestantes < 0) {
      return `Revisão vencida há ${-r.diasRestantes} dias`
    }
    return "Revisão vencida"
  }
  // "18 h" com espaço, não "18h" — a unidade separada do número é o formato
  // do canvas (tela-1b) e o mesmo de textoDuracao/prazoCompacto.
  if (r.horasRestantes != null) return `Revisão em ${Math.round(r.horasRestantes)} h`
  if (r.diasRestantes != null) return `Revisão em ${r.diasRestantes} dias`
  return "Sem revisão programada"
}

/** "2026-08-09" → "9 de agosto" — a data por extenso da frase do Diário
 *  (canvas tela-1b). Sem o ano: a janela da consulta é o ano corrente, e o
 *  estado vazio já o diz em voz alta quando importa. Aritmética via UTC de
 *  propósito — `new Date("2026-08-09")` é meia-noite UTC e viraria 08/08 no
 *  Brasil. */
function dataPorExtenso(iso: string): string {
  const [, m, d] = iso.split("-").map(Number)
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, m - 1, 1)))
  return `${d} de ${mes}`
}

/**
 * A frase do cartão do Diário — a do canvas (tela-1b): "Última saída em
 * 9 de agosto — 4 h 20 no mar." Data por extenso e a duração na voz de
 * `textoDuracao`, a mesma que /diario e /diario/[id] usam (docs/DESIGN.md
 * §6, regra 6: duas telas que dizem a mesma coisa dizem com as mesmas
 * palavras).
 *
 * O ANO APARECE NO ESTADO VAZIO DE PROPÓSITO: a consulta que alimenta este
 * cartão cobre o ano corrente (é a mesma de "Seu ano no mar"), então um
 * "Nenhuma saída registrada" seco seria falso pra quem navegou em dezembro
 * passado. Dizer o ano custa três palavras e mantém a frase verdadeira.
 *
 * A VIRADA DA MEIA-NOITE É DITA EM VOZ ALTA. "22:00 → 01:30" são 3,5 h de
 * verdade — `duracaoHoras` já conta o retorno como dia seguinte — mas sem a
 * marca a frase soa como conta errada, porque o dia da saída não tem 3,5 h
 * depois das 22h.
 */
export function textoUltimaSaida(
  saida: { data: string; hora_saida: string | null; hora_retorno: string | null } | null,
  ano: string,
): string {
  if (saida == null) return `Nenhuma saída registrada em ${ano}.`
  const horas = duracaoHoras(saida.hora_saida, saida.hora_retorno)
  const tempo = horas != null ? ` — ${textoDuracao(horas)} no mar` : ""
  const virada = retornoNoDiaSeguinte(saida.hora_saida, saida.hora_retorno)
    ? ", retorno no dia seguinte"
    : ""
  return `Última saída em ${dataPorExtenso(saida.data)}${tempo}${virada}.`
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

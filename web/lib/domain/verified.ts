import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { calcularSemaforo, vencimentoPorData } from "@/lib/domain/semaforo"
import type { Equipamento, ItemMonitorado } from "@/lib/db/types"

/**
 * Entrada do Commander Verified — funcao pura, no espirito de `semaforo.ts`:
 * quem chama busca os dados (painel + a contagem de eventos do diario, que
 * `carregarPainel` nao traz) e so entao chama `avaliarVerified`. O dominio
 * NUNCA consulta o banco.
 *
 * "Documentos com validade" NAO e uma contagem a parte: o onboarding grava
 * o vencimento do documento em `itens_monitorados` (categoria "documento"),
 * sem criar linha na tabela `documentos` — so o upload de arquivo passa por
 * la. Contar pela tabela `documentos` subestimaria (ficaria em 0) todo barco
 * que so passou pelo onboarding. Por isso o criterio usa `itens` + a MESMA
 * `vencimentoPorData` do farol.
 */
export interface DadosVerified {
  equipamentos: Equipamento[]
  itens: ItemMonitorado[]
  hoje: string
  totalEventosDiario: number
}

/** Os cinco pilares do PRD §15, nesta ordem e sem nenhum a mais. */
export const PILARES_VERIFIED = ["motores", "manutencoes", "seguranca", "documentacao", "historico"] as const
export type PilarVerified = (typeof PILARES_VERIFIED)[number]

export interface ItemVerified {
  chave: PilarVerified
  rotulo: string
  ok: boolean
  /** só faz sentido ler quando `!ok` — é o "o que falta" */
  dica: string
  /** tela que resolve a pendência — todo item pendente precisa de um caminho, nunca só acusar */
  href: string
}

/**
 * SEM PERCENTUAL, de propósito. O PRD §15 é direto: "Sem porcentagem;
 * mostrar requisitos atendidos e o que falta". Até a onda 43 este resultado
 * carregava um campo `percentual` que a tela transformava em barra de
 * progresso — que é uma porcentagem desenhada, só que sem o símbolo. Saiu.
 * O que sobra é uma contagem ("3 de 5") e, principalmente, as duas listas:
 * o que está atendido e o que falta.
 *
 * Isto é sobre o SELO. O anel de Saúde da Embarcação é outra régua, com
 * outra decisão, em `lib/domain/saude.ts` — não foi tocado aqui.
 */
export interface ResultadoVerified {
  itens: ItemVerified[]
  atendidos: ItemVerified[]
  pendentes: ItemVerified[]
  completos: number
  total: number
}

/**
 * Checklist dos cinco pilares do Commander Verified — verificação DIGITAL de
 * cadastro e acompanhamento, NUNCA de vistoria física. É a verificação do
 * Commander (cadastro + histórico + dados atualizados), distinta do Commander
 * Gold (presencial, ver `lib/domain/gold.ts`). Correção 05 do PRD de
 * Correções: Verified "não implica inspeção presencial".
 *
 * Correção 14: Gold NÃO depende de Verified — este checklist é só sobre o
 * próprio Verified, nunca um pré-requisito consultado pelo fluxo do Gold.
 *
 * REGRA QUE NÃO PODE ESCAPAR (PRD §15): "Ter ocorrência aberta não remove
 * Verified automaticamente; o selo mede acompanhamento, não ausência de
 * defeitos." Por isso `DadosVerified` não tem — e não pode ganhar — nenhum
 * campo de ocorrência: um barco com uma avaria ABERTA e acompanhada está
 * fazendo exatamente o que o selo reconhece. Quem quiser ligar ocorrência a
 * selo precisa mudar o PRD antes de mudar este arquivo.
 */
export function avaliarVerified(dados: DadosVerified): ResultadoVerified {
  const { equipamentos, itens, hoje } = dados

  const vencido = (i: ItemMonitorado) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id)
    return calcularSemaforo(itemMonitoradoToItemCalc(i), eq?.horas_atuais ?? null, hoje).status === "vencido"
  }

  // 1) Motores cadastrados — cadastrado aqui inclui o horímetro. Um motor sem
  //    leitura de horas não é acompanhável: metade do app (revisão por horas,
  //    "motor parado", manutenção preventiva) depende desse número, e o selo
  //    afirma acompanhamento, não só existência de uma linha no banco.
  const motoresOk = equipamentos.some((e) => e.tipo === "motor" && e.horas_atuais != null)

  // 2) Manutenções acompanhadas — precisa existir manutenção cadastrada E
  //    nenhuma vencida. Sem nenhum item não há o que acompanhar, então o
  //    critério NÃO conta como cumprido (evita um barco vazio "passar" por
  //    omissão — mesma regra de honestidade do resto do app). Documentos
  //    ficam fora: eles têm pilar próprio, logo abaixo.
  const manutencoes = itens.filter((i) => i.categoria !== "documento")
  const manutencoesOk = manutencoes.length > 0 && manutencoes.every((i) => !vencido(i))

  // 3) Segurança cadastrada — categoria própria desde a migration 032
  //    (colete, extintor, balsa). "Cadastrada", não "em dia": o PRD pede
  //    presença aqui; o vencimento de um item de segurança já é cobrado no
  //    pilar de manutenções acima, que inclui esta categoria.
  const segurancaOk = itens.some((i) => i.categoria === "seguranca")

  // 4) Documentação acompanhada — três ou mais documentos com validade FUTURA
  //    e nenhum documento vencido. Três é o piso prático de um barco em
  //    ordem no Brasil (inscrição, seguro e uma habilitação/vistoria).
  const documentos = itens.filter((i) => i.categoria === "documento")
  const documentosComValidadeFutura = documentos.filter((i) => {
    const vencimento = vencimentoPorData(itemMonitoradoToItemCalc(i))
    return vencimento != null && vencimento > hoje
  }).length
  const documentacaoOk = documentosComValidadeFutura >= 3 && documentos.every((i) => !vencido(i))

  // 5) Histórico ativo — o barco é usado e alguém registra. Seis eventos é o
  //    critério que já valia desde a onda 40, mantido pra não mudar a régua
  //    de quem já conquistou o selo por este caminho.
  const historicoOk = dados.totalEventosDiario >= 6

  const itensVerified: ItemVerified[] = [
    {
      chave: "motores",
      rotulo: "Motores cadastrados",
      ok: motoresOk,
      dica: "Cadastre ao menos um motor com o horímetro (horas atuais) preenchido.",
      href: "/barco/equipamento/novo?tipo=motor",
    },
    {
      chave: "manutencoes",
      rotulo: "Manutenções acompanhadas",
      ok: manutencoesOk,
      dica: manutencoes.length === 0
        ? "Cadastre as manutenções do barco — troca de óleo, filtros, fundo — pra que haja o que acompanhar."
        : "Há manutenção vencida. Registre o serviço feito ou atualize o prazo.",
      href: "/barco",
    },
    {
      chave: "seguranca",
      rotulo: "Segurança cadastrada",
      ok: segurancaOk,
      dica: "Cadastre os itens de segurança — coletes, extintor, balsa, sinalizadores.",
      href: "/barco/seguranca",
    },
    {
      chave: "documentacao",
      rotulo: "Documentação acompanhada",
      ok: documentacaoOk,
      dica: documentosComValidadeFutura < 3
        ? "Cadastre ao menos 3 documentos com validade futura — inscrição, seguro, habilitação."
        : "Há documento vencido. Renove e atualize a validade.",
      href: "/barco/documentos",
    },
    {
      chave: "historico",
      rotulo: "Histórico ativo",
      ok: historicoOk,
      dica: "Registre ao menos 6 saídas ou serviços no Diário de Bordo.",
      href: "/diario",
    },
  ]

  const atendidos = itensVerified.filter((i) => i.ok)
  const pendentes = itensVerified.filter((i) => !i.ok)

  return {
    itens: itensVerified,
    atendidos,
    pendentes,
    completos: atendidos.length,
    total: itensVerified.length,
  }
}

// ---------------------------------------------------------------------------
// PRAZO DE REGULARIZAÇÃO (PRD §15, onda 44)
// ---------------------------------------------------------------------------

/** "Se requisito deixar de ser atendido: 'Atualização necessária — 15 dias'."
 *  Número do PRD, num lugar só. */
export const DIAS_REGULARIZACAO_VERIFIED = 15

const MS_POR_DIA = 86_400_000

export type SituacaoVerified = "nao_conquistado" | "ativo" | "regularizacao" | "suspenso"

export const ROTULO_SITUACAO_VERIFIED: Record<SituacaoVerified, string> = {
  nao_conquistado: "Ainda não conquistado",
  ativo: "Verified ativo",
  regularizacao: "Atualização necessária",
  suspenso: "Verified suspenso",
}

/**
 * O dado mínimo que precisa sobreviver entre uma visita e outra pra que o
 * prazo de 15 dias exista. Duas datas, nada mais (tabela `verified_estado`,
 * migration 045):
 *
 *   - `conquistadoEm`: a primeira vez que os cinco pilares ficaram de pé.
 *     É o que separa "nunca teve o selo" (não há o que suspender) de
 *     "tinha e caiu" (aí sim começa a contagem). Nunca é limpo depois.
 *   - `pendenciaDesde`: quando o pilar caiu. É o relógio. Volta a null
 *     assim que tudo é regularizado — é isso que faz a reativação ser
 *     automática, sem ninguém aprovar nada.
 *
 * Não guardamos QUAL pilar caiu: isso é recalculado a cada avaliação a
 * partir dos dados reais do barco. Guardar a lista criaria uma segunda
 * verdade pra sair de sincronia com a primeira.
 */
export interface EstadoVerifiedGravado {
  conquistadoEm: string | null
  pendenciaDesde: string | null
}

export interface SeloVerifiedAvaliado {
  situacao: SituacaoVerified
  /** dias que faltam pra regularizar — só existe em "regularizacao" */
  diasRestantes: number | null
  /** instante em que o prazo termina — só existe em "regularizacao" e "suspenso" */
  prazoAte: string | null
  /** O que precisa ser gravado depois desta avaliação, ou null quando nada
   *  mudou. Devolver em vez de gravar mantém a função pura: quem chama
   *  (`lib/consultas.ts`) é quem fala com o banco. */
  estadoParaGravar: EstadoVerifiedGravado | null
}

/**
 * Ciclo do selo, exatamente como o PRD §15 descreve:
 *
 *   pilares todos de pé            → ativo (e conquistado, se for a 1ª vez)
 *   caiu um pilar, ≤ 15 dias       → regularizacao ("Atualização necessária — N dias"),
 *                                    o selo CONTINUA valendo neste intervalo
 *   caiu um pilar, > 15 dias       → suspenso
 *   regularizou (a qualquer hora)  → volta a ativo sozinho, sem pedir nada a ninguém
 *   nunca teve os cinco de pé      → nao_conquistado (não existe prazo correndo:
 *                                    não dá pra suspender o que nunca foi dado)
 *
 * `agoraISO` entra por parâmetro — o domínio nunca lê o relógio do sistema,
 * senão o teste não consegue simular o dia 16.
 */
export function avaliarSeloVerified(
  resultado: ResultadoVerified,
  gravado: EstadoVerifiedGravado,
  agoraISO: string,
): SeloVerifiedAvaliado {
  const tudoAtendido = resultado.pendentes.length === 0
  const agora = Date.parse(agoraISO)

  if (tudoAtendido) {
    // Primeira conquista, ou reativação automática depois de regularizar.
    const precisaGravar = gravado.conquistadoEm == null || gravado.pendenciaDesde != null
    return {
      situacao: "ativo",
      diasRestantes: null,
      prazoAte: null,
      estadoParaGravar: precisaGravar
        ? { conquistadoEm: gravado.conquistadoEm ?? agoraISO, pendenciaDesde: null }
        : null,
    }
  }

  // Nunca teve o selo: mostra o que falta, sem relógio nenhum correndo. Se
  // havia uma pendência gravada de um ciclo antigo, ela é limpa — sem
  // `conquistadoEm` esse carimbo não significa mais nada.
  if (gravado.conquistadoEm == null) {
    return {
      situacao: "nao_conquistado",
      diasRestantes: null,
      prazoAte: null,
      estadoParaGravar: gravado.pendenciaDesde != null
        ? { conquistadoEm: null, pendenciaDesde: null }
        : null,
    }
  }

  // Tinha o selo e caiu. O relógio começa AGORA se ainda não estava correndo.
  const inicio = gravado.pendenciaDesde ?? agoraISO
  const prazoAte = new Date(Date.parse(inicio) + DIAS_REGULARIZACAO_VERIFIED * MS_POR_DIA).toISOString()
  const estadoParaGravar = gravado.pendenciaDesde == null
    ? { conquistadoEm: gravado.conquistadoEm, pendenciaDesde: agoraISO }
    : null

  if (agora >= Date.parse(prazoAte)) {
    return { situacao: "suspenso", diasRestantes: 0, prazoAte, estadoParaGravar }
  }

  return {
    situacao: "regularizacao",
    diasRestantes: Math.ceil((Date.parse(prazoAte) - agora) / MS_POR_DIA),
    prazoAte,
    estadoParaGravar,
  }
}

/** A frase do PRD, palavra por palavra: "Atualização necessária — 15 dias".
 *  Devolve null quando não há prazo correndo (ativo, suspenso ou nunca
 *  conquistado) — quem desenha usa `ROTULO_SITUACAO_VERIFIED` nesses casos. */
export function textoPrazoVerified(avaliado: SeloVerifiedAvaliado): string | null {
  if (avaliado.situacao !== "regularizacao" || avaliado.diasRestantes == null) return null
  const dias = avaliado.diasRestantes
  return `${ROTULO_SITUACAO_VERIFIED.regularizacao} — ${dias} ${dias === 1 ? "dia" : "dias"}`
}

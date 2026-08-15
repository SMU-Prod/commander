/**
 * CICLO DE ASSINATURA (onda 47 — PRD FINAL §23).
 *
 * O §23 abre dizendo o mais importante deste arquivo: *"Este fluxo deve ser
 * implementado mesmo que o gateway definitivo ainda seja escolhido"* e fecha
 * com *"estados de assinatura devem ser modelados independentemente do
 * fornecedor"*. Por isso NADA aqui menciona Asaas: o gateway espelha o que
 * acontece lá fora em `assinaturas.status` (webhook), e daí pra frente quem
 * decide o que o cliente vê e o que ele perde é este módulo puro.
 *
 * O Asaas continua sendo quem cobra (`web/lib/asaas.ts`) — trocar de gateway
 * amanhã significa reescrever aquele arquivo e o webhook, não este.
 *
 * ---------------------------------------------------------------------------
 * OS ESTADOS, NA ORDEM QUE O §23 DESCREVE
 * ---------------------------------------------------------------------------
 *   pendente             escolheu o plano, ainda não pagou a primeira vez
 *   ativa                pagamento aprovado → "recursos liberados imediatamente"
 *   problema_pagamento   "Pagamento recusado → notificação + status 'problema
 *                        de pagamento' + tentativa/reprocessamento"
 *   cancelada            cancelou, ou a falha virou persistente
 *
 * E a SITUAÇÃO derivada, que é o que a tela mostra e o que os portões usam:
 *   aguardando_pagamento · ativa · em_tolerancia · bloqueada · cancelada
 *
 * `em_tolerancia` não é um status gravado — é `problema_pagamento` ainda
 * dentro do prazo. Manter isso derivado (e não uma coluna) evita a única coisa
 * pior que um bug de cobrança: um job de fundo que esquece de rodar e deixa
 * alguém bloqueado (ou liberado) por engano. Mesma filosofia do farol de
 * documentos (`semaforo.ts`) e do selo Gold.
 */

import { freeEquivalente, type PlanoId } from "./planos"

export type StatusAssinatura = "pendente" | "ativa" | "problema_pagamento" | "cancelada"

export type SituacaoAssinatura =
  | "aguardando_pagamento"
  | "ativa"
  | "em_tolerancia"
  | "bloqueada"
  | "cancelada"

/**
 * §23: "Período de tolerância recomendado deve ser configurável, NÃO
 * HARDCODED". O valor real vive em `assinatura_parametros.tolerancia_dias`
 * (migration 048) e é lido em `web/lib/consultas.ts`. Esta constante é só o
 * VALOR DE SEMENTE/fallback pra quando a tabela não puder ser lida — sem ela o
 * app teria que escolher entre bloquear todo mundo ou liberar todo mundo num
 * erro de leitura, e as duas opções são piores que um padrão conhecido.
 */
export const TOLERANCIA_PADRAO_DIAS = 7

export interface SinalCiclo {
  status: StatusAssinatura
  /** Data (AAAA-MM-DD) em que o pagamento passou a falhar. Gravada pelo banco
   *  no trigger de `assinaturas` (migration 048), não pela aplicação — assim
   *  o relógio da tolerância não depende de nenhuma tela ter sido aberta.
   *  `null` quando não há problema em curso. */
  problemaDesde: string | null
  /** Vem de `assinatura_parametros`. Ver `TOLERANCIA_PADRAO_DIAS`. */
  toleranciaDias: number
  /** AAAA-MM-DD, mesmo formato de `hojeISO()`. */
  hoje: string
}

export interface CicloAvaliado {
  situacao: SituacaoAssinatura
  /** Dias que ainda restam de tolerância. `null` fora da tolerância. Zero
   *  significa "hoje é o último dia" — nunca aparece negativo. */
  diasRestantes: number | null
  /** §23: "recursos liberados imediatamente" / "recursos pagos ficam
   *  bloqueados, não apagados". Este booleano é o único que os portões
   *  precisam consultar. */
  acessoPago: boolean
  /** §23: "durante tolerância, avisar CLARAMENTE antes de bloquear recursos
   *  pagos" — e §24, "Limite atingido: explicar o limite... nunca falhar
   *  silenciosamente". `null` quando não há nada a avisar. */
  aviso: string | null
}

/** Diferença em dias entre duas datas AAAA-MM-DD, sem fuso: as duas viram
 *  meia-noite UTC, então o resultado é sempre inteiro e não pula por horário
 *  de verão. */
function diasEntre(de: string, ate: string): number {
  const a = Date.parse(`${de}T00:00:00Z`)
  const b = Date.parse(`${ate}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/**
 * A função central: do status gravado + a data do problema + a tolerância
 * configurada, sai o que o cliente vê e o que ele pode usar.
 *
 * `problema_pagamento` sem `problemaDesde` (dado antigo, ou webhook que chegou
 * antes do trigger existir) conta como PRIMEIRO dia da tolerância, nunca como
 * bloqueio imediato — na dúvida, o erro é sempre a favor de quem paga.
 */
export function avaliarCiclo(sinal: SinalCiclo): CicloAvaliado {
  switch (sinal.status) {
    case "pendente":
      return {
        situacao: "aguardando_pagamento",
        diasRestantes: null,
        acessoPago: false,
        aviso: "Estamos aguardando a confirmação do primeiro pagamento. Assim que ele entrar, tudo é liberado na hora.",
      }

    case "ativa":
      return { situacao: "ativa", diasRestantes: null, acessoPago: true, aviso: null }

    case "cancelada":
      return {
        situacao: "cancelada",
        diasRestantes: null,
        acessoPago: false,
        aviso:
          "Sua assinatura está cancelada. Tudo o que você registrou continua guardado — reative quando quiser " +
          "e o acesso volta exatamente como estava.",
      }

    case "problema_pagamento": {
      const decorridos = sinal.problemaDesde == null ? 0 : Math.max(0, diasEntre(sinal.problemaDesde, sinal.hoje))
      const restantes = sinal.toleranciaDias - decorridos
      if (restantes < 0) {
        return {
          situacao: "bloqueada",
          diasRestantes: null,
          acessoPago: false,
          aviso:
            "Não conseguimos confirmar o pagamento e o prazo de regularização acabou. Os recursos do plano estão " +
            "bloqueados, mas nada foi apagado: regularize e o acesso volta na hora.",
        }
      }
      return {
        situacao: "em_tolerancia",
        diasRestantes: restantes,
        acessoPago: true,
        aviso:
          restantes === 0
            ? "Houve um problema com o pagamento e hoje é o último dia para regularizar antes de os recursos do plano serem bloqueados."
            : `Houve um problema com o pagamento. Você tem ${restantes} ${restantes === 1 ? "dia" : "dias"} para regularizar antes de os recursos do plano serem bloqueados. Nada será apagado.`,
      }
    }
  }
}

/** Rótulo curto do status pra tela — vocabulário de cliente, nunca o código
 *  cru (§1.1: "Evitar linguagem interna de software"). */
export const ROTULO_SITUACAO: Record<SituacaoAssinatura, string> = {
  aguardando_pagamento: "Aguardando o primeiro pagamento",
  ativa: "Ativa",
  em_tolerancia: "Problema de pagamento",
  bloqueada: "Bloqueada por falta de pagamento",
  cancelada: "Cancelada",
}

/**
 * §23: "Falha persistente/cancelamento → conta volta ao nível Free aplicável".
 * Qual é o Free aplicável depende do perfil do plano que acabou — quem pagava
 * Captain Pro volta pra Captain Free, não pra Proprietário Free.
 */
export function planoAposPerder(planoAtual: PlanoId): PlanoId {
  return freeEquivalente(planoAtual)
}

// ---------------------------------------------------------------------------
// Downgrade Commander Pro → Commander (§23, penúltima linha)
// ---------------------------------------------------------------------------

export interface DivisaoEmbarcacoes {
  /** Embarcações que continuam com gestão liberada. */
  liberadas: string[]
  /** Excedentes: gestão bloqueada, DADOS INTACTOS. */
  bloqueadas: string[]
  /** `true` quando o dono passou do limite e ainda não escolheu qual mantém
   *  ativa — §23: "exigir seleção da embarcação ativa até regularização". */
  precisaEscolher: boolean
}

/**
 * "Downgrade Commander Pro → Commander: NÃO APAGAR embarcações excedentes;
 * bloquear gestão das excedentes e exigir seleção da embarcação ativa até
 * regularização/mudança de plano."
 *
 * A escolha do dono é a embarcação ATIVA (o mesmo cookie que o app já usa pra
 * saber qual barco mostrar, `web/lib/embarcacao-ativa.ts`) — reaproveitar isso
 * evita inventar uma segunda noção de "barco principal" que ele teria que
 * manter em dia em dois lugares.
 *
 * Regras:
 *   · cabe todo mundo no limite → ninguém é bloqueado, e `precisaEscolher` é
 *     falso mesmo sem ativa definida;
 *   · passou do limite → a ativa entra primeiro (é a escolha dele), o resto
 *     entra na ordem recebida até encher, e o excedente é bloqueado;
 *   · passou do limite e não há ativa → `precisaEscolher`, e a tela pede a
 *     escolha ANTES de bloquear na cara dele. Mesmo assim uma divisão
 *     determinística já sai daqui, pra nenhuma tela ficar sem resposta.
 *
 * Ordem estável (a lista chega ordenada de `carregarPainel`) — o barco
 * liberado não muda de uma renderização pra outra.
 */
export function dividirEmbarcacoesPorPlano(
  todas: readonly string[],
  ativaId: string | null,
  limite: number,
): DivisaoEmbarcacoes {
  if (todas.length <= limite) {
    return { liberadas: [...todas], bloqueadas: [], precisaEscolher: false }
  }
  const ativaValida = ativaId != null && todas.includes(ativaId) ? ativaId : null
  const ordenadas = ativaValida != null ? [ativaValida, ...todas.filter((id) => id !== ativaValida)] : [...todas]
  return {
    liberadas: ordenadas.slice(0, Math.max(0, limite)),
    bloqueadas: ordenadas.slice(Math.max(0, limite)),
    precisaEscolher: ativaValida == null,
  }
}

/** O texto que a tela mostra quando há barco bloqueado por downgrade. `null`
 *  quando não há nada a dizer. */
export function mensagemDowngrade(divisao: DivisaoEmbarcacoes, limite: number): string | null {
  if (divisao.bloqueadas.length === 0) return null
  const quantas = divisao.bloqueadas.length
  const plural = quantas === 1 ? "1 embarcação está" : `${quantas} embarcações estão`
  const base =
    `Seu plano atual gerencia ${limite} ${limite === 1 ? "embarcação" : "embarcações"} por vez, então ${plural} ` +
    "com a gestão pausada. Nada foi apagado: o histórico, os documentos e os Diários continuam guardados e voltam " +
    "inteiros quando você mudar de plano."
  return divisao.precisaEscolher
    ? `${base} Escolha qual embarcação fica ativa para continuar gerenciando.`
    : base
}

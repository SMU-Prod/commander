import { NextResponse, type NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { carimboDoEvento } from "@/lib/asaas"
import type { ResultadoEventoAsaas, StatusAssinatura } from "@/lib/db/types"

export const maxDuration = 30

/**
 * Traduz o evento do gateway pro vocabulário do Commander (PRD §23).
 *
 * Este mapa é a ÚNICA fronteira entre "o que o Asaas chama" e "o que o
 * Commander chama" — §23 exige que os estados sejam modelados
 * independentemente do fornecedor, e é aqui que isso vira código. Trocar de
 * gateway amanhã significa reescrever este mapa, não o resto do app.
 *
 * `PAYMENT_OVERDUE` → `problema_pagamento` (§23: "Pagamento recusado →
 * notificação + status 'problema de pagamento'"). A partir daí o trigger do
 * banco marca `problema_desde`, e `avaliarCiclo` decide sozinho quando a
 * tolerância acaba — nenhum job precisa rodar pra bloquear na hora certa.
 *
 * `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `ativa` também é o caminho da
 * REGULARIZAÇÃO: quem estava em tolerância volta a `ativa`, o trigger limpa
 * `problema_desde` e o acesso é restabelecido imediatamente, sem intervenção.
 */
const STATUS_POR_EVENTO: Record<string, StatusAssinatura> = {
  PAYMENT_CONFIRMED: "ativa",
  PAYMENT_RECEIVED: "ativa",
  PAYMENT_OVERDUE: "problema_pagamento",

  // ONDA 83 (achado A-05 da auditoria de 19/08/2026) — ESTORNO E CONTESTAÇÃO
  // ENTRAM NO MAPA.
  //
  // Até aqui esses três eventos caíam no `ignorado` e devolviam 200 sem
  // efeito nenhum. O buraco: a pessoa paga, ganha acesso, pede estorno ou
  // abre contestação no cartão — e continua com acesso pago até um
  // `PAYMENT_OVERDUE` de algum ciclo futuro. Dinheiro volta, acesso não.
  //
  // Mais constrangedor ainda: a tela de faturas de `/menu/assinatura` já
  // TRADUZ esses status para o assinante. Ou seja, o app mostrava o
  // chargeback e não agia sobre ele.
  //
  // Vão para `problema_pagamento`, e não direto para `cancelada`, por dois
  // motivos. Primeiro: é o mesmo estado do `OVERDUE`, e ele já tem toda a
  // maquinaria pronta — o trigger carimba `problema_desde` e `avaliarCiclo`
  // conta a tolerância sozinho, sem job nenhum. Segundo, e mais importante:
  // contestação é uma ACUSAÇÃO, não uma sentença — o titular pode ter
  // contestado por engano, ou a operadora pode decidir a favor do lojista, e
  // nesse caso um `PAYMENT_CONFIRMED` posterior devolve tudo ao lugar. De
  // `cancelada`, que é terminal por desenho, não haveria volta.
  PAYMENT_REFUNDED: "problema_pagamento",
  PAYMENT_REFUND_IN_PROGRESS: "problema_pagamento",
  PAYMENT_CHARGEBACK_REQUESTED: "problema_pagamento",
  PAYMENT_CHARGEBACK_DISPUTE: "problema_pagamento",
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "problema_pagamento",
  // Cobrança apagada no painel do Asaas: não há mais o que pagar naquele
  // ciclo, então o acesso deixa de estar sustentado por pagamento.
  PAYMENT_DELETED: "problema_pagamento",
}

/** Eventos que confirmam pagamento recebido — únicos que avançam a avaliação
 *  Commander Gold (pagamento avulso, não assinatura: não há "inadimplente"
 *  nem "cancelada" pra espelhar aqui, só pago ou não). */
const EVENTOS_PAGAMENTO_CONFIRMADO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"])

/** O que o Asaas manda, na parte que este arquivo lê. */
interface CorpoAsaas {
  /** Id do EVENTO (`evt_…`). Pode faltar em entrega antiga do gateway. */
  id?: string
  event?: string
  /** Carimbo de criação do evento — ver `carimboDoEvento`. */
  dateCreated?: string
  payment?: { id?: string; subscription?: string; billingType?: string }
  subscription?: { id?: string }
}

/** O que uma entrega produziu. Vira linha em `asaas_eventos` (migration 076)
 *  e resposta HTTP — as duas saem do mesmo lugar de propósito, pra nunca
 *  divergirem. */
interface Desfecho {
  resultado: ResultadoEventoAsaas
  detalhe?: string
  linhasAfetadas?: number
  /** 200 salvo quando o Commander falhou de verdade: só aí o Asaas deve
   *  retentar. Evento que o app entendeu e decidiu não aplicar é 200 — senão
   *  o gateway reentrega para sempre um evento que nunca vai "dar certo". */
  http?: number
}

/**
 * ONDA 84 (achado A-07 da auditoria de 19/08/2026) — TODA ENTREGA DEIXA RASTRO.
 *
 * Antes disto, um pagamento confirmado para assinatura que o banco não conhece
 * devolvia `200 {atualizadas: 0}` e sumia: o Asaas considerava entregue e
 * nunca mais retentava. Reconstruir o que se perdeu virava investigação manual
 * no painel do gateway.
 *
 * Grava SEMPRE, inclusive reentrega do mesmo `evento_id` — duplicata é o fato
 * que se quer enxergar, não sujeira a esconder.
 *
 * Falha ao registrar NÃO derruba o webhook. A ordem de importância é clara:
 * primeiro o dinheiro chega ao lugar certo, depois se anota. Um erro aqui vira
 * `console.error` e a resposta segue — o contrário faria o Asaas retentar um
 * evento que JÁ foi aplicado, só porque a anotação falhou.
 */
async function registrar(
  admin: SupabaseClient,
  corpo: CorpoAsaas,
  desfecho: Desfecho,
): Promise<void> {
  const { data, error } = await admin
    .from("asaas_eventos")
    .insert({
      evento_id: corpo.id ?? null,
      tipo: corpo.event ?? "(sem evento)",
      ocorrido_em: carimboDoEvento(corpo),
      asaas_payment_id: corpo.payment?.id ?? null,
      asaas_subscription_id: corpo.payment?.subscription ?? corpo.subscription?.id ?? null,
      resultado: desfecho.resultado,
      detalhe: desfecho.detalhe ?? null,
      // `undefined` vira null: "não chegou a tentar escrever". Nunca 0 —
      // "não tentou" e "tentou e não mudou nada" são diagnósticos opostos.
      linhas_afetadas: desfecho.linhasAfetadas ?? null,
      corpo,
    })
    .select("id")

  // O `.select()` é o que prova que a linha entrou: sem ele, uma escrita
  // barrada voltaria com `error: null` e a trilha teria um buraco silencioso.
  if (error || !data?.length) {
    console.error(`[asaas] NÃO REGISTROU o evento ${corpo.event} (${corpo.id ?? "sem id"}):`, error?.message)
  }
}

function responder(desfecho: Desfecho) {
  return NextResponse.json(
    {
      ok: desfecho.resultado !== "erro",
      resultado: desfecho.resultado,
      detalhe: desfecho.detalhe,
      linhas: desfecho.linhasAfetadas,
    },
    { status: desfecho.http ?? 200 },
  )
}

export async function POST(req: NextRequest) {
  const segredo = process.env.ASAAS_WEBHOOK_TOKEN
  if (!segredo || req.headers.get("asaas-access-token") !== segredo) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 })
  }
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chaveServico) {
    return NextResponse.json({ erro: "configure SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
  }

  const corpo = (await req.json().catch(() => null)) as CorpoAsaas | null
  // Sem `event` não há o que registrar como evento — nem tipo tem. É o único
  // caminho que não deixa linha na trilha, e é o certo: corpo ilegível não é
  // um evento do Asaas, é ruído na porta.
  if (!corpo?.event) return NextResponse.json({ ok: true, ignorado: "sem evento" })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })

  const subscriptionId = corpo.payment?.subscription ?? corpo.subscription?.id
  const desfecho = subscriptionId
    ? await atualizarAssinatura(admin, corpo, subscriptionId)
    : corpo.payment?.id
      ? // Sem `subscription`: é cobrança avulsa — hoje só o Commander Gold usa
        // esse tipo (`criarCobrancaAvulsaAsaas`, `lib/asaas.ts`).
        await atualizarPagamentoGold(admin, corpo, corpo.payment.id)
      : // Payment sem subscription E sem id não é nada que a gente emitiu.
        ({ resultado: "evento_ignorado", detalhe: "sem assinatura nem cobrança" } as Desfecho)

  await registrar(admin, corpo, desfecho)
  return responder(desfecho)
}

async function atualizarAssinatura(
  admin: SupabaseClient, corpo: CorpoAsaas, subscriptionId: string,
): Promise<Desfecho> {
  const evento = corpo.event!
  const novoStatus: StatusAssinatura | null =
    evento === "SUBSCRIPTION_DELETED" ? "cancelada" : STATUS_POR_EVENTO[evento] ?? null
  if (!novoStatus) return { resultado: "evento_ignorado", detalhe: evento }

  const carimbo = carimboDoEvento(corpo)

  // ONDA 84 (achado A-06) — O EVENTO VELHO NÃO DERRUBA MAIS QUEM ESTÁ EM DIA.
  //
  // O Asaas reentrega. Um `PAYMENT_OVERDUE` de terça reentregue na quinta,
  // depois de um `PAYMENT_CONFIRMED` de quarta, jogava a assinatura de quem
  // pagou em `problema_pagamento` e a tela passava a gritar com o cliente
  // certo. O filtro `ultimo_evento_em <= carimbo` vai no MESMO `update` que
  // muda o status: uma instrução só, então duas entregas concorrentes não se
  // atropelam — quem perde a corrida não casa com o filtro e não escreve.
  //
  // Sem carimbo (`null`), o filtro não é aplicado e o evento passa. Na dúvida
  // sobre QUANDO, o erro é a favor de quem paga — descartar em silêncio uma
  // confirmação de pagamento seria bem pior.
  let consulta = admin
    .from("assinaturas")
    .update(carimbo ? { status: novoStatus, ultimo_evento_em: carimbo } : { status: novoStatus })
    .eq("asaas_subscription_id", subscriptionId)
    // cancelada é terminal: um PAYMENT_CONFIRMED atrasado não ressuscita a assinatura
    .neq("status", "cancelada")
  if (carimbo) {
    consulta = consulta.or(`ultimo_evento_em.is.null,ultimo_evento_em.lte."${carimbo}"`)
  }
  const { data, error } = await consulta.select("id")

  if (error) {
    console.error(`[asaas] falha ao atualizar assinatura ${subscriptionId}:`, error.message)
    return { resultado: "erro", detalhe: error.message.slice(0, 300), http: 500 }
  }

  if (data?.length) {
    console.log(`[asaas] ${evento} → assinatura ${novoStatus} (${data.length} linha)`)
    return { resultado: "aplicado", detalhe: novoStatus, linhasAfetadas: data.length }
  }

  // Zero linhas tem TRÊS causas muito diferentes, e chamar as três de
  // "atualizadas: 0" foi exatamente o que apagou o rastro do A-07. Uma
  // leitura extra — só neste caminho, que é o raro — separa as três.
  return await diagnosticarAssinatura(admin, subscriptionId, carimbo, novoStatus)
}

async function diagnosticarAssinatura(
  admin: SupabaseClient,
  subscriptionId: string,
  carimbo: string | null,
  novoStatus: StatusAssinatura,
): Promise<Desfecho> {
  const { data: atual, error } = await admin
    .from("assinaturas")
    .select("id, status, ultimo_evento_em")
    .eq("asaas_subscription_id", subscriptionId)
    .maybeSingle()

  if (error) {
    return { resultado: "erro", detalhe: error.message.slice(0, 300), http: 500 }
  }

  // A-07: pagamento confirmado para assinatura que o Commander não conhece.
  // É o caso grave — pode significar cliente sendo cobrado por um acesso que
  // o app não sabe que existe. Fica gritando na trilha até alguém olhar.
  if (!atual) {
    console.error(
      `[asaas] SEM CORRESPONDÊNCIA: assinatura ${subscriptionId} não existe no Commander ` +
        "— confira no painel do Asaas se há cliente sendo cobrado sem acesso.",
    )
    return {
      resultado: "sem_correspondencia",
      detalhe: `assinatura ${subscriptionId} não existe no Commander`,
      linhasAfetadas: 0,
    }
  }

  if (atual.status === "cancelada") {
    return { resultado: "sem_efeito", detalhe: "assinatura cancelada (terminal)", linhasAfetadas: 0 }
  }

  const anterior = atual.ultimo_evento_em as string | null
  if (carimbo && anterior && anterior > carimbo) {
    console.log(`[asaas] evento fora de ordem descartado (${carimbo} < ${anterior})`)
    return {
      resultado: "fora_de_ordem",
      detalhe: `evento de ${carimbo}, já aplicado até ${anterior}`,
      linhasAfetadas: 0,
    }
  }

  return { resultado: "sem_efeito", detalhe: `já estava em ${atual.status} (pedido: ${novoStatus})`, linhasAfetadas: 0 }
}

/**
 * ONDA 85 (achado A-12 da auditoria de 19/08/2026) — UMA MÁQUINA DE ESTADOS SÓ.
 *
 * Confirma o pagamento da avaliação Commander Gold e leva a solicitação de
 * `aguardando_pagamento` até `aguardando_agendamento` — passando por `pago`,
 * que é o degrau que a máquina de estados declara.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTAVA ERRADO
 * ---------------------------------------------------------------------------
 * Este bloco fazia o salto num hop só (`.in("estado", ["aguardando_pagamento",
 * "pago"])` → `aguardando_agendamento`), e funcionava: a chave de serviço passa
 * por cima da RLS e não consulta `gold_transicao_valida`. O problema não era
 * quebrar — era existirem DUAS definições da mesma máquina de estados, e a
 * versão que o dinheiro segue não ser a que está escrita:
 *
 *   · `gold_transicao_valida` (banco, migration 033):
 *       aguardando_pagamento → pago → aguardando_agendamento
 *   · `TRANSICOES` (`lib/domain/gold.ts:100-101`, com teste em gold.test.ts:84):
 *       idem
 *   · este arquivo, até agora:
 *       aguardando_pagamento → aguardando_agendamento
 *
 * ---------------------------------------------------------------------------
 * POR QUE O WEBHOOK CEDEU, E NÃO A RPC
 * ---------------------------------------------------------------------------
 * O caminho oposto — declarar o salto em `gold_transicao_valida` — parecia mais
 * barato (uma migration, uma linha). Foi descartado por três motivos:
 *
 *   1. Ele conserta UMA das duas definições e quebra a outra. `TRANSICOES` em
 *      `lib/domain/gold.ts` diz a mesma coisa que o banco, e tem teste. Mudar o
 *      banco obrigaria a mudar o TypeScript junto, e passariam a ser dois
 *      lugares para manter em vez de dois lugares que concordam.
 *   2. `pago` não é estado morto. A tela do cliente tem texto próprio para ele
 *      (`DESCRICAO_ESTADO_SOLICITACAO.pago`) e o passo do trilho já o trata
 *      (`barco/selos/gold/[id]/page.tsx:17`). Apagá-lo do caminho real seria
 *      mudar a máquina de estados publicada para acomodar um atalho de
 *      implementação.
 *   3. Alargar `gold_transicao_valida` alarga para TODO MUNDO, inclusive o
 *      Suporte chamando a RPC pela tela — e "avançar sem passar por pago"
 *      viraria uma operação legítima do admin, que ninguém pediu.
 *
 * O webhook era a única das três vozes discordantes. É ela que muda.
 *
 * ---------------------------------------------------------------------------
 * COMO OS DOIS PASSOS SE COMPORTAM
 * ---------------------------------------------------------------------------
 * Cada `update` carrega o estado de origem no `where` (`aguardando_pagamento`,
 * depois `pago`). Isso mantém a transição atômica por passo — duas entregas
 * concorrentes não se atropelam, porque quem perde a corrida não casa com o
 * filtro e não escreve — e torna cada passo reentrante: já estar no destino
 * simplesmente afeta 0 linhas.
 *
 * O risco novo, e o que se faz com ele: se o processo morrer ENTRE os dois
 * passos, a solicitação fica em `pago` — estado válido, mas parado. Por isso o
 * avanço passou a rodar mesmo quando o pagamento JÁ estava marcado `pago`
 * (reentrega): o Asaas reentrega, e a reentrega termina o serviço em vez de
 * sair pela porta de "já estava pago" e deixar o cliente preso. Antes desta
 * mudança não existia esse meio-caminho, e por isso a reentrega podia sair
 * cedo sem custo.
 *
 * Escrita direta via service role (bypassa RLS de propósito: o segredo do
 * webhook já é o gate de autoridade aqui, igual à assinatura acima) — nunca
 * passa pela RPC `gold_definir_estado`, que exigiria `auth.uid()` de uma sessão
 * de usuário que este webhook não tem.
 *
 * ---------------------------------------------------------------------------
 * A REGRA PASSOU A TER DENTES (migration 088)
 * ---------------------------------------------------------------------------
 * Quando a onda 85 foi escrita, a máquina de estados era só uma CONVENÇÃO deste
 * lado: `gold_transicao_valida` só era consultada de dentro de
 * `gold_definir_estado`, e `gold_solicitacoes` não tinha trigger nenhum — foi
 * exatamente por essa fresta que o salto sobreviveu por meses sem nada ter como
 * notar. A migration 088 põe um `BEFORE UPDATE` que aplica a mesma função a
 * QUALQUER escrita de `estado`, e de propósito **não** isenta a chave de
 * serviço: o webhook sabe uma coisa só — que o dinheiro entrou — e é a máquina
 * de estados que diz o que essa notícia significa.
 *
 * Consequência prática para quem for mexer nesta função: voltar a saltar deixa
 * de ser um erro invisível e vira um 500 com `transicao_invalida_…` na hora em
 * que alguém pagou. Os dois passos abaixo não são estilo — são o contrato.
 *
 * NÃO precisa do carimbo de ordem do A-06: cobrança avulsa não tem par de
 * eventos opostos (ou o pagamento foi confirmado, ou não foi).
 */
async function atualizarPagamentoGold(
  admin: SupabaseClient, corpo: CorpoAsaas, paymentId: string,
): Promise<Desfecho> {
  const evento = corpo.event!
  if (!EVENTOS_PAGAMENTO_CONFIRMADO.has(evento)) {
    return { resultado: "evento_ignorado", detalhe: evento }
  }

  const agora = new Date().toISOString()
  const { data: pagamentos, error: erroPagamento } = await admin
    .from("gold_pagamentos")
    .update({ status: "pago", pago_em: agora })
    .eq("asaas_payment_id", paymentId)
    .neq("status", "pago")
    .select("id, solicitacao_id")
  if (erroPagamento) {
    console.error(`[asaas] falha ao atualizar pagamento ${paymentId}:`, erroPagamento.message)
    return { resultado: "erro", detalhe: erroPagamento.message.slice(0, 300), http: 500 }
  }

  let solicitacaoId = pagamentos?.[0]?.solicitacao_id as string | undefined
  // `true` quando esta entrega não mudou nada em `gold_pagamentos` — ou é
  // reentrega, ou é cobrança que o Commander não emitiu. São coisas muito
  // diferentes, e a separação é a mesma do A-07.
  const reentrega = !solicitacaoId
  if (!solicitacaoId) {
    const { data: existente } = await admin
      .from("gold_pagamentos").select("id, solicitacao_id").eq("asaas_payment_id", paymentId).maybeSingle()
    if (!existente) {
      console.error(
        `[asaas] SEM CORRESPONDÊNCIA: cobrança ${paymentId} não existe em gold_pagamentos ` +
          "— alguém pagou uma avaliação que o Commander não registrou.",
      )
      return {
        resultado: "sem_correspondencia",
        detalhe: `cobrança ${paymentId} não existe no Commander`,
        linhasAfetadas: 0,
      }
    }
    solicitacaoId = existente.solicitacao_id as string
  }

  // Passo 1 — `aguardando_pagamento` → `pago`.
  const { error: erroPago } = await admin
    .from("gold_solicitacoes")
    .update({ estado: "pago", atualizado_em: agora })
    .eq("id", solicitacaoId)
    .eq("estado", "aguardando_pagamento")
    .select("id")
  if (erroPago) {
    console.error(`[asaas] falha ao marcar solicitação ${solicitacaoId} como paga:`, erroPago.message)
    return { resultado: "erro", detalhe: erroPago.message.slice(0, 300), http: 500 }
  }

  // Passo 2 — `pago` → `aguardando_agendamento`.
  const { data: solicitacoes, error: erroSolicitacao } = await admin
    .from("gold_solicitacoes")
    .update({ estado: "aguardando_agendamento", atualizado_em: agora })
    .eq("id", solicitacaoId)
    .eq("estado", "pago")
    .select("id")
  if (erroSolicitacao) {
    console.error(`[asaas] falha ao avançar solicitação ${solicitacaoId}:`, erroSolicitacao.message)
    return { resultado: "erro", detalhe: erroSolicitacao.message.slice(0, 300), http: 500 }
  }

  if (!solicitacoes?.length) {
    // Reentrega de um evento já inteiramente aplicado: o pagamento já estava
    // pago E a solicitação já tinha andado. Não é problema nenhum.
    if (reentrega) {
      return { resultado: "sem_efeito", detalhe: "pagamento já estava pago", linhasAfetadas: 0 }
    }
    // Pagamento gravado agora e solicitação NÃO avançada é divergência de
    // verdade: o dinheiro entrou e o processo não andou. Fica marcado, não
    // some num 200.
    console.error(
      `[asaas] pagamento ${paymentId} confirmado, mas a solicitação ${solicitacaoId} ` +
        "não estava em aguardando_pagamento/pago — conferir à mão.",
    )
    return {
      resultado: "sem_correspondencia",
      detalhe: `pagamento pago, solicitação ${solicitacaoId} não avançou`,
      linhasAfetadas: pagamentos?.length ?? 0,
    }
  }

  console.log(`[asaas] ${evento} → gold_pagamentos pago, solicitacao ${solicitacaoId} aguardando_agendamento`)
  return {
    resultado: "aplicado",
    detalhe: "gold: pago → aguardando_agendamento",
    linhasAfetadas: pagamentos?.length ?? 0,
  }
}

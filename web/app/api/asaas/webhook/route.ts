import { NextResponse, type NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { StatusAssinatura } from "@/lib/db/types"

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

export async function POST(req: NextRequest) {
  const segredo = process.env.ASAAS_WEBHOOK_TOKEN
  if (!segredo || req.headers.get("asaas-access-token") !== segredo) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 })
  }
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chaveServico) {
    return NextResponse.json({ erro: "configure SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
  }

  const corpo = await req.json().catch(() => null) as {
    event?: string
    payment?: { id?: string; subscription?: string; billingType?: string }
    subscription?: { id?: string }
  } | null
  if (!corpo?.event) return NextResponse.json({ ok: true, ignorado: "sem evento" })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })

  const subscriptionId = corpo.payment?.subscription ?? corpo.subscription?.id
  if (subscriptionId) {
    return atualizarAssinatura(admin, corpo.event, subscriptionId)
  }

  // Sem `subscription`: é cobrança avulsa — hoje só o Commander Gold usa
  // esse tipo (`criarCobrancaAvulsaAsaas`, `lib/asaas.ts`). Payment sem
  // subscription E sem id não é nada que a gente emitiu — ignora.
  const paymentId = corpo.payment?.id
  if (paymentId) return atualizarPagamentoGold(admin, corpo.event, paymentId)

  return NextResponse.json({ ok: true, ignorado: "sem assinatura nem cobrança" })
}

async function atualizarAssinatura(
  admin: SupabaseClient, evento: string, subscriptionId: string,
) {
  const novoStatus: StatusAssinatura | null =
    evento === "SUBSCRIPTION_DELETED" ? "cancelada" : STATUS_POR_EVENTO[evento] ?? null
  if (!novoStatus) return NextResponse.json({ ok: true, ignorado: evento })

  // cancelada e terminal: um PAYMENT_CONFIRMED atrasado nao ressuscita a assinatura
  const { data, error } = await admin
    .from("assinaturas")
    .update({ status: novoStatus })
    .eq("asaas_subscription_id", subscriptionId)
    .neq("status", "cancelada")
    .select("id")
  if (error) return NextResponse.json({ erro: "falha ao atualizar" }, { status: 500 })

  console.log(`[asaas] ${evento} → assinatura ${novoStatus} (${data?.length ?? 0} linha)`)
  return NextResponse.json({ ok: true, atualizadas: data?.length ?? 0 })
}

/** Confirma o pagamento da avaliação Commander Gold e avança a solicitação
 *  direto pra `aguardando_agendamento` — pulando o estado intermediário
 *  `pago` num único hop, porque nada além do admin agendando lê esse estado
 *  isoladamente. Escrita direta via service role (bypassa RLS de propósito:
 *  o segredo do webhook já é o gate de autoridade aqui, igual à assinatura
 *  acima) — nunca passa pela RPC `gold_definir_estado`, que exigiria
 *  `auth.uid()` de uma sessão de usuário que este webhook não tem. */
async function atualizarPagamentoGold(
  admin: SupabaseClient, evento: string, paymentId: string,
) {
  if (!EVENTOS_PAGAMENTO_CONFIRMADO.has(evento)) return NextResponse.json({ ok: true, ignorado: evento })

  const { data: pagamentos, error: erroPagamento } = await admin
    .from("gold_pagamentos")
    .update({ status: "pago", pago_em: new Date().toISOString() })
    .eq("asaas_payment_id", paymentId)
    .neq("status", "pago")
    .select("id, solicitacao_id")
  if (erroPagamento) return NextResponse.json({ erro: "falha ao atualizar pagamento" }, { status: 500 })
  if (!pagamentos?.length) return NextResponse.json({ ok: true, ignorado: "pagamento não encontrado ou já pago" })

  const solicitacaoId = pagamentos[0].solicitacao_id as string
  const { data: solicitacoes, error: erroSolicitacao } = await admin
    .from("gold_solicitacoes")
    .update({ estado: "aguardando_agendamento", atualizado_em: new Date().toISOString() })
    .eq("id", solicitacaoId)
    .in("estado", ["aguardando_pagamento", "pago"])
    .select("id")
  if (erroSolicitacao) return NextResponse.json({ erro: "falha ao atualizar solicitação" }, { status: 500 })

  console.log(`[asaas] ${evento} → gold_pagamentos pago, solicitacao ${solicitacaoId} aguardando_agendamento`)
  return NextResponse.json({ ok: true, pagamentos: pagamentos.length, solicitacoes: solicitacoes?.length ?? 0 })
}

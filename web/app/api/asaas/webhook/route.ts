import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { StatusAssinatura } from "@/lib/db/types"

export const maxDuration = 30

/** Espelha o estado do Asaas na tabela assinaturas. So eventos que mudam status. */
const STATUS_POR_EVENTO: Record<string, StatusAssinatura> = {
  PAYMENT_CONFIRMED: "ativa",
  PAYMENT_RECEIVED: "ativa",
  PAYMENT_OVERDUE: "inadimplente",
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

  const corpo = await req.json().catch(() => null) as {
    event?: string
    payment?: { subscription?: string }
    subscription?: { id?: string }
  } | null
  if (!corpo?.event) return NextResponse.json({ ok: true, ignorado: "sem evento" })

  const subscriptionId = corpo.payment?.subscription ?? corpo.subscription?.id
  if (!subscriptionId) return NextResponse.json({ ok: true, ignorado: "sem assinatura" })

  const novoStatus: StatusAssinatura | null =
    corpo.event === "SUBSCRIPTION_DELETED" ? "cancelada" : STATUS_POR_EVENTO[corpo.event] ?? null
  if (!novoStatus) return NextResponse.json({ ok: true, ignorado: corpo.event })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })
  // cancelada e terminal: um PAYMENT_CONFIRMED atrasado nao ressuscita a assinatura
  const { data, error } = await admin
    .from("assinaturas")
    .update({ status: novoStatus })
    .eq("asaas_subscription_id", subscriptionId)
    .neq("status", "cancelada")
    .select("id")
  if (error) return NextResponse.json({ erro: "falha ao atualizar" }, { status: 500 })

  console.log(`[asaas] ${corpo.event} → ${novoStatus} (${data?.length ?? 0} linha)`)
  return NextResponse.json({ ok: true, atualizadas: data?.length ?? 0 })
}

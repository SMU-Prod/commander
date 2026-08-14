"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  AsaasRecusa, atualizarAssinaturaAsaas, cancelarAssinaturaAsaas, criarAssinaturaAsaas, criarClienteAsaas,
  urlPrimeiraCobranca,
} from "@/lib/asaas"
import { PLANOS, proximoUpgrade, type PlanoId } from "@/lib/domain/planos"
import { supabaseServer } from "@/lib/supabase/server"
import type { Assinatura } from "@/lib/db/types"

function erroAssinar(msg: string): never {
  redirect(`/assinar?erro=${encodeURIComponent(msg)}`)
}

/** Para onde o Asaas devolve o assinante depois de pagar. */
function urlRetornoPosPagamento(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/menu/assinatura`
}

/** CPF: 11 digitos apos limpar mascara. A validacao forte fica no Asaas. */
function cpfLimpo(bruto: string): string | null {
  const d = bruto.replace(/\D/g, "")
  return d.length === 11 ? d : null
}

export async function assinar(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect("/login?volta=/assinar")

  const plano = String(formData.get("plano") ?? "") as PlanoId
  if (!(plano in PLANOS)) erroAssinar("Escolha um plano.")
  const nome = String(formData.get("nome") ?? "").trim()
  if (nome.length < 5 || !nome.includes(" ")) erroAssinar("Informe seu nome completo.")
  const cpf = cpfLimpo(String(formData.get("cpf") ?? ""))
  if (!cpf) erroAssinar("Informe um CPF válido (11 dígitos).")

  // ja tem assinatura viva? nao cria outra — reaproveita a cobranca aberta
  const { data: existente } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id).neq("status", "cancelada")
    .maybeSingle()
  if (existente) {
    const viva = existente as Assinatura
    if (viva.status === "pendente") {
      const url = await urlPrimeiraCobranca(viva.asaas_subscription_id, urlRetornoPosPagamento()).catch(() => null)
      if (url) redirect(url)
    }
    redirect("/menu/assinatura")
  }

  let customerId: string
  let subscriptionId: string
  try {
    customerId = await criarClienteAsaas({ nome, email: user.email, cpfCnpj: cpf })
    subscriptionId = await criarAssinaturaAsaas({
      customerId,
      valorCentavos: PLANOS[plano].valorCentavos,
      ciclo: PLANOS[plano].ciclo,
      descricao: PLANOS[plano].descricao,
      referenciaExterna: user.id,
    })
  } catch (e) {
    // recusa de validacao (ex.: CPF invalido) e corrigivel pelo usuario — mostra o motivo
    if (e instanceof AsaasRecusa) erroAssinar(`O sistema de pagamento recusou os dados: ${e.message}`)
    erroAssinar("Não foi possível falar com o sistema de pagamento. Tente de novo em instantes.")
  }

  const { data: criada, error } = await supabase
    .from("assinaturas")
    .insert({
      usuario_id: user.id,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      plano,
      valor_centavos: PLANOS[plano].valorCentavos,
    })
    .select("id")
  if (error || !criada?.length) {
    // Nunca deixa a assinatura orfa no Asaas: se a gravacao no banco falhou
    // (por QUALQUER motivo), desfaz o que ja foi criado la fora.
    await cancelarAssinaturaAsaas(subscriptionId).catch(() => {})
    // 23505 = violacao do indice unico `assinaturas_uma_viva_idx` (migration 019):
    // outra requisicao (duplo clique, ou retry de rede) venceu a corrida e ja
    // gravou a assinatura viva deste usuario primeiro. Nao e falha — e o duplo
    // clique sendo pego pelo banco. Manda pra tela de assinatura (onde a que
    // venceu ja aparece) em vez do erro cru "tente de novo", que so faria a
    // pessoa clicar de novo e criar mais um cliente/assinatura descartavel no Asaas.
    if (error?.code === "23505") {
      redirect("/menu/assinatura?ok=" + encodeURIComponent("Você já tem uma assinatura em andamento"))
    }
    erroAssinar("Não foi possível registrar a assinatura. Tente de novo.")
  }

  const url = await urlPrimeiraCobranca(subscriptionId, urlRetornoPosPagamento()).catch(() => null)
  revalidatePath("/menu/assinatura")
  if (url) redirect(url)
  redirect("/menu/assinatura?ok=" + encodeURIComponent("Assinatura criada — o link de pagamento chega por e-mail"))
}

export async function cancelarAssinatura() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: viva } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id).neq("status", "cancelada")
    .maybeSingle()
  if (!viva) redirect("/menu/assinatura")
  const assinatura = viva as Assinatura

  try {
    await cancelarAssinaturaAsaas(assinatura.asaas_subscription_id)
  } catch {
    redirect("/menu/assinatura?erro=" + encodeURIComponent("Não foi possível cancelar agora. Tente de novo."))
  }

  const { data: atualizada, error } = await supabase
    .from("assinaturas").update({ status: "cancelada" })
    .eq("id", assinatura.id).select("id")
  if (error || !atualizada?.length) {
    redirect("/menu/assinatura?erro=" + encodeURIComponent("Cancelada no pagamento, mas o app não atualizou. Recarregue."))
  }

  revalidatePath("/menu/assinatura")
  redirect("/menu/assinatura?ok=" + encodeURIComponent("Assinatura cancelada"))
}

/**
 * Upgrade (PRD §44) — troca o ciclo da assinatura viva pro próximo definido
 * em `proximoUpgrade` (hoje só mensal→anual).
 *
 * Só atualiza o Asaas (fonte de verdade da cobrança) — de propósito NÃO
 * escreve `plano`/`valor_centavos` na linha local de `assinaturas`: a
 * policy de UPDATE dessa tabela (migration 017) só deixa o dono mudar pra
 * `status = 'cancelada'`, nada mais — abrir uma segunda policy pra permitir
 * troca de ciclo é mudança de banco (RLS) fora do que esta onda pode aplicar
 * sozinha (aplicar migration em produção passa por revisão à parte). Por
 * isso a tela de assinatura (`menu/assinatura/page.tsx`) NUNCA confia cegamente
 * na coluna local pra mostrar valor/ciclo — sempre tenta ler o valor/ciclo
 * AO VIVO do Asaas primeiro (`detalhesAssinaturaAsaas`) e só cai pro dado
 * local se o Asaas não responder. `nivelPlano`/o gate de Premium não usam
 * `plano` nem `valor_centavos` em nenhum momento (só `status`), então esse
 * descompasso não afeta liberar/bloquear recurso nenhum — é só cosmético.
 */
export async function trocarPlano() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: viva } = await supabase
    .from("assinaturas").select("*")
    .eq("usuario_id", user.id).in("status", ["ativa", "inadimplente"])
    .maybeSingle()
  if (!viva) redirect("/menu/assinatura")
  const assinatura = viva as Assinatura

  const proximo = proximoUpgrade(assinatura.plano)
  if (!proximo) redirect("/menu/assinatura")

  try {
    await atualizarAssinaturaAsaas(assinatura.asaas_subscription_id, {
      valorCentavos: PLANOS[proximo].valorCentavos,
      ciclo: PLANOS[proximo].ciclo,
    })
  } catch {
    redirect("/menu/assinatura?erro=" + encodeURIComponent("Não foi possível trocar o plano agora. Tente de novo."))
  }

  revalidatePath("/menu/assinatura")
  redirect("/menu/assinatura?ok=" + encodeURIComponent(`Você passou para ${PLANOS[proximo].rotulo}`))
}

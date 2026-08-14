"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Transferência de propriedade (onda 37, PRD §27). Reaproveita o desenho do
 * convite de tripulação (web/lib/acoes/convites.ts): código de 10
 * caracteres, tela de aceite em `/convite/[codigo]` (mesma rota, mesmo
 * padrão — ver esse arquivo pra como as duas convivem). A diferença central:
 * quem aceita vira PROP (não CMDT), e o e-mail de destino é conferido no
 * banco (`aceitar_transferencia`, migration 038) contra o JWT de quem
 * clicou — só o dono daquele e-mail consegue assumir o barco.
 */

function erroTransferir(msg: string): never {
  redirect(`/barco/transferir?erro=${encodeURIComponent(msg)}`)
}

export async function iniciarTransferencia(formData: FormData) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroTransferir("Só o proprietário pode transferir a embarcação.")

  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email || !email.includes("@")) erroTransferir("Digite um e-mail válido.")
  if (email === (user.email ?? "").toLowerCase()) {
    erroTransferir("Você já é o proprietário — pra dar acesso a alguém sem trocar de dono, use Tripulação no Menu.")
  }

  // só uma transferência pendente por vez — uma nova pedida cancela a
  // anterior (o índice único parcial da migration 038 garante isso mesmo
  // sob corrida de dois pedidos simultâneos).
  await supabase.from("transferencias")
    .update({ status: "cancelada", cancelada_em: new Date().toISOString() })
    .eq("embarcacao_id", painel.embarcacao.id).eq("status", "pendente")

  const { data, error } = await supabase.from("transferencias")
    .insert({ embarcacao_id: painel.embarcacao.id, de_usuario_id: user.id, destinatario_email: email })
    .select("codigo").single()
  if (error || !data) erroTransferir("Não foi possível iniciar a transferência. Tente de novo.")

  revalidatePath("/barco/transferir")
  redirect(`/barco/transferir?criado=${encodeURIComponent(data.codigo)}`)
}

export async function cancelarTransferencia(formData: FormData) {
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") erroTransferir("Só o proprietário pode cancelar.")

  const supabase = await supabaseServer()
  const id = String(formData.get("transferencia_id") ?? "")
  const { error } = await supabase.from("transferencias")
    .update({ status: "cancelada", cancelada_em: new Date().toISOString() })
    .eq("id", id).eq("embarcacao_id", painel.embarcacao.id).eq("status", "pendente")
  if (error) erroTransferir("Não foi possível cancelar a transferência. Tente de novo.")

  revalidatePath("/barco/transferir")
  redirect("/barco/transferir")
}

export async function aceitarTransferencia(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim()
  function erroAceite(msg: string): never {
    redirect(`/convite/${encodeURIComponent(codigo)}?erro=${encodeURIComponent(msg)}`)
  }
  if (codigo === "") redirect("/hoje?erro=" + encodeURIComponent("Convite inválido."))

  const supabase = await supabaseServer()
  const { error } = await supabase.rpc("aceitar_transferencia", { p_codigo: codigo })
  if (error) {
    erroAceite(
      error.message.includes("expirad") || error.message.includes("inválid")
        ? "Esta transferência não é mais válida — peça um novo link ao proprietário."
        : error.message.includes("e-mail")
          ? "Este convite foi enviado para outro e-mail. Entre com a conta correta e tente de novo."
          : "Não foi possível aceitar a transferência. Tente de novo.",
    )
  }
  revalidatePath("/hoje")
  redirect("/hoje?ok=" + encodeURIComponent("Agora você é o proprietário desta embarcação"))
}

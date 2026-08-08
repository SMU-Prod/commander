"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { supabaseServer } from "@/lib/supabase/server"

// mesmo contato do rodapé da landing (app/page.tsx) e do mailto do push —
// é a equipe Commander, não um endereço inventado pra esta tela.
const EMAIL_EQUIPE = "atendimento.smu@gmail.com"

function volta(msg: string, tipo: "ok" | "erro" = "ok"): never {
  redirect(`/barco/selo?${tipo}=${encodeURIComponent(msg)}`)
}

/**
 * Grava a intenção (um evento no diário — não existe tabela dedicada pra
 * isso) e tenta avisar a equipe por e-mail. Sem RESEND_API_KEY, ou se o
 * envio falhar, a tela NUNCA finge que despachou: mostra o e-mail de contato
 * como alternativa. A avaliação em si é operação humana — este botão só
 * dispara o pedido.
 */
export async function solicitarAvaliacao() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") volta("Só o proprietário solicita a avaliação presencial.", "erro")

  const { data: inserido, error } = await supabase
    .from("eventos")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      tipo: "outro",
      data: hojeISO(),
      descricao: "Selo Ouro — avaliação presencial solicitada",
      criado_por: user.id,
    })
    .select("id")
  // sem o select, uma linha barrada pela RLS voltaria com error null e a
  // tela diria "pedido enviado" sem ter gravado nada
  if (error || !inserido?.length) volta("Não foi possível registrar o pedido. Tente de novo.", "erro")

  const resendKey = process.env.RESEND_API_KEY
  let emailEnviado = false
  if (resendKey) {
    try {
      const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "Commander <onboarding@resend.dev>",
          to: EMAIL_EQUIPE,
          subject: `Avaliação presencial solicitada — ${painel.embarcacao.nome}`,
          text:
            `${user.email ?? "Um proprietário"} pediu a avaliação presencial do Selo Ouro ` +
            `para "${painel.embarcacao.nome}".\n\nEntre em contato para agendar a visita.`,
        }),
      })
      emailEnviado = resposta.ok
    } catch {
      emailEnviado = false // falha de rede não pode travar quem já registrou o pedido
    }
  }

  revalidatePath("/barco/selo")
  revalidatePath("/barco")

  volta(
    emailEnviado
      ? "Pedido enviado! A equipe Commander entra em contato para agendar a avaliação."
      : `Pedido registrado. O aviso automático está indisponível agora — fale direto com a equipe: ${EMAIL_EQUIPE}`,
  )
}

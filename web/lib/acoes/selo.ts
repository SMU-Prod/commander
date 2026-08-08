"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { MARCADOR_SOLICITACAO_SELO } from "@/lib/domain/selo"
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

  // trava contra clique repetido: um pedido em aberto nos ultimos 30 dias ja
  // basta. Sem isso, cada toque grava outra linha e dispara outro e-mail pra
  // equipe — e o dono nao tem como saber que ja pediu.
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: pedidoAberto } = await supabase
    .from("eventos")
    .select("id")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("descricao", MARCADOR_SOLICITACAO_SELO)
    .gte("data", trintaDiasAtras)
    .limit(1)
  if (pedidoAberto?.length) {
    volta("Seu pedido já está registrado — a equipe entra em contato. Precisa falar antes? " + EMAIL_EQUIPE)
  }

  const { data: inserido, error } = await supabase
    .from("eventos")
    .insert({
      embarcacao_id: painel.embarcacao.id,
      tipo: "outro",
      data: hojeISO(),
      descricao: MARCADOR_SOLICITACAO_SELO,
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

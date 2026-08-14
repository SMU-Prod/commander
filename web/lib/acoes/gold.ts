"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { carregarPainel, hojeISO } from "@/lib/consultas"
import { MARCADOR_SOLICITACAO_GOLD } from "@/lib/domain/gold"
import { supabaseServer } from "@/lib/supabase/server"

// mesmo contato do rodapé da landing (app/page.tsx) e do mailto do push —
// é a equipe Commander, não um endereço inventado pra esta tela.
const EMAIL_EQUIPE = "atendimento.smu@gmail.com"

function volta(msg: string, tipo: "ok" | "erro" = "ok"): never {
  redirect(`/barco/selos/gold?${tipo}=${encodeURIComponent(msg)}`)
}

/**
 * Manifestação de interesse no Commander Gold — primeiro passo do fluxo
 * (Correção 02 do PRD de Correções: SOLICITAR → pagamento → agendamento →
 * avaliação presencial → Protocolo Commander → análise → aprovação → Gold).
 * Esta onda constrói só a vitrine + este primeiro passo: grava a intenção
 * (um evento no diário — não existe tabela dedicada pra isso ainda, ver
 * `lib/domain/gold.ts`) e tenta avisar a equipe por e-mail. Sem
 * RESEND_API_KEY, ou se o envio falhar, a tela NUNCA finge que despachou:
 * mostra o e-mail de contato como alternativa. Pagamento, agendamento e
 * avaliação em si são operação humana/comercial que ainda não existe —
 * este botão só dispara o pedido.
 */
export async function solicitarCommanderGold() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const painel = await carregarPainel()
  if (!painel) redirect("/onboarding")
  if (painel.papel !== "PROP") volta("Só o proprietário solicita o Commander Gold.", "erro")

  // trava contra clique repetido: um pedido em aberto nos ultimos 30 dias ja
  // basta. Sem isso, cada toque grava outra linha e dispara outro e-mail pra
  // equipe — e o dono nao tem como saber que ja pediu.
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: pedidoAberto } = await supabase
    .from("eventos")
    .select("id")
    .eq("embarcacao_id", painel.embarcacao.id)
    .eq("descricao", MARCADOR_SOLICITACAO_GOLD)
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
      descricao: MARCADOR_SOLICITACAO_GOLD,
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
          subject: `Commander Gold solicitado — ${painel.embarcacao.nome}`,
          text:
            `${user.email ?? "Um proprietário"} solicitou o Commander Gold ` +
            `para "${painel.embarcacao.nome}".\n\nEntre em contato para explicar o fluxo (pagamento da ` +
            `avaliação, agendamento e avaliação presencial).`,
        }),
      })
      emailEnviado = resposta.ok
    } catch {
      emailEnviado = false // falha de rede não pode travar quem já registrou o pedido
    }
  }

  revalidatePath("/barco/selos/gold")
  revalidatePath("/barco/selos")
  revalidatePath("/barco")

  volta(
    emailEnviado
      ? "Pedido enviado! A equipe Commander entra em contato para explicar os próximos passos."
      : `Pedido registrado. O aviso automático está indisponível agora — fale direto com a equipe: ${EMAIL_EQUIPE}`,
  )
}

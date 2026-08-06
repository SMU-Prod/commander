"use server"
import { revalidatePath } from "next/cache"
import webpush from "web-push"
import { supabaseServer } from "@/lib/supabase/server"

type Resultado = { ok: true } | { ok: false; erro: string }

export async function salvarAssinaturaPush(assinatura: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}): Promise<Resultado> {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const { error } = await supabase.from("push_assinaturas").upsert(
    {
      usuario_id: user.id,
      endpoint: assinatura.endpoint,
      p256dh: assinatura.keys.p256dh,
      auth: assinatura.keys.auth,
    },
    { onConflict: "usuario_id,endpoint" },
  )
  if (error) return { ok: false, erro: "Não foi possível salvar a ativação. Tente de novo." }
  revalidatePath("/notificacoes")
  return { ok: true }
}

export async function removerAssinaturaPush(endpoint: string): Promise<Resultado> {
  const supabase = await supabaseServer()
  const { error } = await supabase.from("push_assinaturas").delete().eq("endpoint", endpoint)
  if (error) return { ok: false, erro: "Não foi possível desativar." }
  revalidatePath("/notificacoes")
  return { ok: true }
}

export async function enviarPushTeste(): Promise<Resultado> {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return { ok: false, erro: "Push não configurado no servidor." }
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, erro: "Sessão expirada — entre de novo." }
  const { data: assinaturas } = await supabase
    .from("push_assinaturas").select("endpoint, p256dh, auth").eq("usuario_id", user.id)
  if (!assinaturas || assinaturas.length === 0) return { ok: false, erro: "Ative os alertas neste aparelho primeiro." }

  webpush.setVapidDetails("mailto:atendimento.smu@gmail.com", publica, privada)
  let enviados = 0
  for (const a of assinaturas) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify({ titulo: "Commander", corpo: "Alertas ativados. Bom vento e mar calmo!", url: "/notificacoes" }),
      )
      enviados++
    } catch {
      await supabase.from("push_assinaturas").delete().eq("endpoint", a.endpoint)
    }
  }
  return enviados > 0
    ? { ok: true }
    : { ok: false, erro: "Nenhum aparelho recebeu — desative e ative os alertas de novo." }
}

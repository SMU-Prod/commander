import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import type { Equipamento, ItemMonitorado, PushAssinatura } from "@/lib/db/types"
import { cicloRef, janelaDoAlerta, textoDoAlerta } from "@/lib/domain/alertas"
import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { hojeISO } from "@/lib/domain/datas"
import { calcularSemaforo } from "@/lib/domain/semaforo"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const segredo = process.env.ALERTAS_SEGREDO
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 })
  }
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivada = process.env.VAPID_PRIVATE_KEY
  if (!chaveServico || !vapidPublica || !vapidPrivada) {
    return NextResponse.json(
      { erro: "configure SUPABASE_SERVICE_ROLE_KEY e as chaves VAPID no ambiente" },
      { status: 500 },
    )
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })
  webpush.setVapidDetails("mailto:atendimento.smu@gmail.com", vapidPublica, vapidPrivada)

  const [itensR, equipamentosR, vinculosR, assinaturasR, enviadosR] = await Promise.all([
    admin.from("itens_monitorados").select("*"),
    admin.from("equipamentos").select("*"),
    admin.from("vinculos").select("usuario_id, embarcacao_id"),
    admin.from("push_assinaturas").select("*"),
    admin.from("alertas_enviados").select("item_monitorado_id, janela, ciclo_ref"),
  ])
  const falha = [itensR, equipamentosR, vinculosR, assinaturasR, enviadosR].find((r) => r.error)
  if (falha) return NextResponse.json({ erro: "falha ao carregar dados" }, { status: 500 })

  const hoje = hojeISO()
  const eqPorId = new Map(((equipamentosR.data ?? []) as Equipamento[]).map((e) => [e.id, e]))
  const jaEnviado = new Set(
    (enviadosR.data ?? []).map((e) => `${e.item_monitorado_id}|${e.janela}|${e.ciclo_ref}`),
  )
  const usuariosPorBarco = new Map<string, string[]>()
  for (const v of vinculosR.data ?? []) {
    usuariosPorBarco.set(v.embarcacao_id, [...(usuariosPorBarco.get(v.embarcacao_id) ?? []), v.usuario_id])
  }
  const assinaturas = (assinaturasR.data ?? []) as PushAssinatura[]

  let alertas = 0
  let pushes = 0
  let emails = 0
  let removidas = 0

  for (const item of (itensR.data ?? []) as ItemMonitorado[]) {
    const eq = item.equipamento_id ? eqPorId.get(item.equipamento_id) : undefined
    const r = calcularSemaforo(itemMonitoradoToItemCalc(item), eq?.horas_atuais ?? null, hoje)
    const janela = janelaDoAlerta(r)
    if (!janela) continue
    const ref = cicloRef(item)
    if (jaEnviado.has(`${item.id}|${janela}|${ref}`)) continue

    const nomeAlvo = eq
      ? `${eq.tipo === "motor" ? "Motor" : eq.tipo === "gerador" ? "Gerador" : eq.tipo === "bateria" ? "Bateria" : "Equipamento"} ${eq.posicao ?? ""}`.trim()
      : null
    const { titulo, corpo } = textoDoAlerta(item.nome, nomeAlvo, janela, r)

    const { error: erroRegistro } = await admin.from("alertas_enviados").insert({
      embarcacao_id: item.embarcacao_id,
      item_monitorado_id: item.id,
      janela,
      ciclo_ref: ref,
      titulo,
    })
    if (erroRegistro) continue // duplicata (unique) — outro disparo chegou primeiro
    alertas++

    const usuarios = usuariosPorBarco.get(item.embarcacao_id) ?? []
    for (const u of usuarios) {
      const doUsuario = assinaturas.filter((s) => s.usuario_id === u)
      const resultados = await Promise.allSettled(
        doUsuario.map((a) =>
          webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            JSON.stringify({ titulo, corpo, url: "/notificacoes" }),
          ),
        ),
      )
      for (let i = 0; i < resultados.length; i++) {
        const r = resultados[i]
        if (r.status === "fulfilled") {
          pushes++
          continue
        }
        // só remove assinatura morta (404/410); erro transitório (429/5xx/rede) mantém
        const codigo = r.reason instanceof webpush.WebPushError ? r.reason.statusCode : null
        if (codigo === 404 || codigo === 410) {
          await admin.from("push_assinaturas").delete().eq("endpoint", doUsuario[i].endpoint)
          removidas++
        }
      }
      if (process.env.RESEND_API_KEY) {
        // best-effort: falha de e-mail em um usuário não pode abortar o lote
        try {
          const { data: dadosUsuario } = await admin.auth.admin.getUserById(u)
          const email = dadosUsuario?.user?.email
          if (email) {
            const resposta = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "Commander <onboarding@resend.dev>",
                to: email,
                subject: titulo,
                text: `${titulo}\n\n${corpo}\n\nAbra o Commander para ver os detalhes.`,
              }),
            })
            if (resposta.ok) emails++
          }
        } catch {
          // segue para o próximo usuário; push é o canal primário
        }
      }
    }
  }

  console.log(`[alertas] ${alertas} alertas · ${pushes} pushes · ${emails} e-mails · ${removidas} assinaturas removidas`)

  return NextResponse.json({ alertas, pushes, emails, removidas })
}

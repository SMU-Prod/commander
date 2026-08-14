import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import type { Embarcacao, Equipamento, ItemMonitorado, PushAssinatura } from "@/lib/db/types"
import { alertaDeMar, cicloRef, janelaDoAlerta, lembreteMotorParado, textoDoAlerta } from "@/lib/domain/alertas"
import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { hojeISO } from "@/lib/domain/datas"
import { boletimDoMar } from "@/lib/mar"
import { calcularSemaforo } from "@/lib/domain/semaforo"
import { emLotes } from "@/lib/lotes"
import { checarLimite, identificarIp } from "@/lib/seguranca/limitador"

// Envio (push + e-mail) por usuário em lotes concorrentes — ver comentário
// no laço de usuários, abaixo.
const TAMANHO_LOTE = 10

// Onda 31 (robustez) — rota cara (varre todo barco, chama API de tempo,
// manda push+e-mail) protegida por Bearer, mas o segredo pode vazar. Rate
// limit POR IP, checado ANTES de validar o Bearer — também mitiga
// força-bruta no segredo, não só custo. Uso normal é 1x/dia via cron; o
// teto generoso (5 no cron) sobra folga pra reexecução manual de teste.
// Mitigação em memória por instância, não muralha — ver
// `lib/seguranca/limitador.ts`.
const JANELA_ALERTAS_MS = 5 * 60_000
const LIMITE_ALERTAS_POR_JANELA = 5

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const limite = checarLimite(`alertas:${identificarIp(req.headers)}`, JANELA_ALERTAS_MS, LIMITE_ALERTAS_POR_JANELA)
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: "muitas tentativas, tente novamente mais tarde" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    )
  }

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

  const [embarcacoesR, itensR, equipamentosR, vinculosR, assinaturasR, enviadosR] = await Promise.all([
    admin.from("embarcacoes").select("id, marina_lat, marina_lon"),
    admin.from("itens_monitorados").select("*"),
    admin.from("equipamentos").select("*"),
    admin.from("vinculos").select("usuario_id, embarcacao_id"),
    admin.from("push_assinaturas").select("*"),
    admin.from("alertas_enviados").select("item_monitorado_id, equipamento_id, embarcacao_id, janela, ciclo_ref"),
  ])
  const falha = [embarcacoesR, itensR, equipamentosR, vinculosR, assinaturasR, enviadosR].find((r) => r.error)
  if (falha) return NextResponse.json({ erro: "falha ao carregar dados" }, { status: 500 })

  const hoje = hojeISO()
  const eqPorId = new Map(((equipamentosR.data ?? []) as Equipamento[]).map((e) => [e.id, e]))
  // dedupe: mesma regra do indice funcional do banco — o primeiro id nao nulo entre
  // item_monitorado_id / equipamento_id / embarcacao_id, mais janela e ciclo_ref.
  const jaEnviado = new Set(
    (enviadosR.data ?? []).map(
      (e) => `${e.item_monitorado_id ?? e.equipamento_id ?? e.embarcacao_id}|${e.janela}|${e.ciclo_ref}`,
    ),
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

  /** Grava o alerta (a unique do banco resolve corrida entre disparos concorrentes) e manda
   *  push + e-mail best-effort pra quem tem vinculo com a embarcacao. Usado tanto pelos alertas
   *  de vencimento (item_monitorado_id) quanto pelos avisos gerais (equipamento_id ou so a
   *  embarcacao) — mesma chave de dedupe do indice funcional criado na migration 023. */
  async function registrarEDisparar(
    embarcacaoId: string,
    alvo: { itemMonitoradoId?: string; equipamentoId?: string },
    janela: string,
    ref: string,
    titulo: string,
    corpo: string,
  ) {
    const chave = alvo.itemMonitoradoId ?? alvo.equipamentoId ?? embarcacaoId
    if (jaEnviado.has(`${chave}|${janela}|${ref}`)) return

    const { error: erroRegistro } = await admin.from("alertas_enviados").insert({
      embarcacao_id: embarcacaoId,
      item_monitorado_id: alvo.itemMonitoradoId ?? null,
      equipamento_id: alvo.equipamentoId ?? null,
      janela,
      ciclo_ref: ref,
      titulo,
    })
    if (erroRegistro) return // duplicata (unique) — outro disparo chegou primeiro
    jaEnviado.add(`${chave}|${janela}|${ref}`)
    alertas++

    const usuarios = usuariosPorBarco.get(embarcacaoId) ?? []
    // Um usuário por vez em série (push + getUserById + fetch pro Resend)
    // era o mesmo padrão que estourava o `relatorio/mensal` — aqui some
    // dentro de `registrarEDisparar`, chamada por item/aviso, então a conta
    // multiplica: itens × usuários. Lotes de `Promise.allSettled` (mesmo
    // estilo que já valia só pro push de um único usuário, agora pro grupo
    // de usuários da embarcação) resolvem os dois sem esperar um de cada vez.
    await emLotes(usuarios, TAMANHO_LOTE, async (u) => {
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
    })
  }

  for (const item of (itensR.data ?? []) as ItemMonitorado[]) {
    const eq = item.equipamento_id ? eqPorId.get(item.equipamento_id) : undefined
    const r = calcularSemaforo(itemMonitoradoToItemCalc(item), eq?.horas_atuais ?? null, hoje)
    const janela = janelaDoAlerta(r)
    if (!janela) continue
    const ref = cicloRef(item)

    const nomeAlvo = eq
      ? `${eq.tipo === "motor" ? "Motor" : eq.tipo === "gerador" ? "Gerador" : eq.tipo === "bateria" ? "Bateria" : "Equipamento"} ${eq.posicao ?? ""}`.trim()
      : null
    const { titulo, corpo } = textoDoAlerta(item.nome, nomeAlvo, janela, r)
    await registrarEDisparar(item.embarcacao_id, { itemMonitoradoId: item.id }, janela, ref, titulo, corpo)
  }

  // Aviso de mar ruim: 1 por embarcacao com marina cadastrada, no maximo 1x/dia (ciclo_ref = hoje).
  type EmbarcacaoMarina = Pick<Embarcacao, "id" | "marina_lat" | "marina_lon">
  const embarcacoesComMarina = ((embarcacoesR.data ?? []) as EmbarcacaoMarina[]).filter(
    (e): e is EmbarcacaoMarina & { marina_lat: number; marina_lon: number } =>
      e.marina_lat != null && e.marina_lon != null,
  )
  const boletins = await Promise.allSettled(
    embarcacoesComMarina.map((e) => boletimDoMar(e.marina_lat, e.marina_lon)),
  )
  for (let i = 0; i < embarcacoesComMarina.length; i++) {
    const resultado = boletins[i]
    if (resultado.status !== "fulfilled" || !resultado.value) continue // falha na API do tempo não derruba o resto
    const aviso = alertaDeMar(resultado.value, hoje)
    if (!aviso) continue
    await registrarEDisparar(embarcacoesComMarina[i].id, {}, aviso.janela, aviso.cicloRef, aviso.titulo, aviso.corpo)
  }

  // Lembrete de motor parado: por motor sem leitura de horas há mais de 30 dias.
  for (const eq of (equipamentosR.data ?? []) as Equipamento[]) {
    if (eq.tipo !== "motor") continue
    const aviso = lembreteMotorParado(eq.ultima_leitura, hoje)
    if (!aviso) continue
    const titulo = `${aviso.titulo} — Motor ${eq.posicao ?? ""}`.trim()
    await registrarEDisparar(eq.embarcacao_id, { equipamentoId: eq.id }, aviso.janela, aviso.cicloRef, titulo, aviso.corpo)
  }

  console.log(`[alertas] ${alertas} alertas · ${pushes} pushes · ${emails} e-mails · ${removidas} assinaturas removidas`)

  return NextResponse.json({ alertas, pushes, emails, removidas })
}

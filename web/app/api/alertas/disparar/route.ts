import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"
import type { Embarcacao, Equipamento, ItemMonitorado, PushAssinatura, Vinculo } from "@/lib/db/types"
import { alertaDeMar, cicloRef, janelaDoAlerta, lembreteMotorParado, textoDoAlerta } from "@/lib/domain/alertas"
import { itemMonitoradoToItemCalc } from "@/lib/domain/conversores"
import { hojeISO } from "@/lib/domain/datas"
import { abaDoEquipamento, abaDoItem } from "@/lib/domain/diario"
import { normalizarPermissoes, podeVer, type Aba, type Permissoes } from "@/lib/domain/permissoes"
import { boletimDoMar } from "@/lib/mar"
import { calcularSemaforo } from "@/lib/domain/semaforo"
import { enviarEmail, remetenteDeEmail } from "@/lib/email"
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

  // O e-mail é canal SECUNDÁRIO aqui (o push é o primário e roda todo dia,
  // medido em `alertas_enviados`), então a ausência das duas variáveis não
  // derruba a rota — ela só desliga o segundo canal, como já acontecia com a
  // chave sozinha. A diferença é que agora as DUAS são exigidas: chave sem
  // remetente próprio manda para uma pessoa só (ver `lib/email.ts`).
  const chaveResend = process.env.RESEND_API_KEY
  const remetente = remetenteDeEmail()
  if (chaveResend && !remetente) {
    console.warn("[alertas] RESEND_API_KEY existe e RESEND_FROM não — nenhum e-mail será enviado (o remetente de sandbox só entrega a uma caixa).")
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })
  webpush.setVapidDetails("mailto:atendimento.smu@gmail.com", vapidPublica, vapidPrivada)

  const [embarcacoesR, itensR, equipamentosR, vinculosR, assinaturasR, enviadosR] = await Promise.all([
    admin.from("embarcacoes").select("id, marina_lat, marina_lon"),
    admin.from("itens_monitorados").select("*"),
    admin.from("equipamentos").select("*"),
    // `papel` e `permissoes` entram na consulta desde a onda 44: sem eles
    // não dá pra respeitar a matriz na hora de decidir QUEM recebe cada
    // aviso (PRD §5.2, "notificações sempre respeitam permissões").
    admin.from("vinculos").select("usuario_id, embarcacao_id, papel, permissoes"),
    admin.from("push_assinaturas").select("*"),
    admin.from("alertas_enviados").select("item_monitorado_id, equipamento_id, embarcacao_id, janela, ciclo_ref"),
  ])
  const falha = [embarcacoesR, itensR, equipamentosR, vinculosR, assinaturasR, enviadosR].find((r) => r.error)
  if (falha) return NextResponse.json({ erro: "falha ao carregar dados" }, { status: 500 })

  const hoje = hojeISO()
  const equipamentos = (equipamentosR.data ?? []) as Equipamento[]
  const eqPorId = new Map(equipamentos.map((e) => [e.id, e]))
  // dedupe: mesma regra do indice funcional do banco — o primeiro id nao nulo entre
  // item_monitorado_id / equipamento_id / embarcacao_id, mais janela e ciclo_ref.
  const jaEnviado = new Set(
    (enviadosR.data ?? []).map(
      (e) => `${e.item_monitorado_id ?? e.equipamento_id ?? e.embarcacao_id}|${e.janela}|${e.ciclo_ref}`,
    ),
  )
  // Quem tem vínculo com cada barco, JÁ COM as permissões normalizadas.
  // PROP guarda `permissoes = null` no banco e enxerga tudo — mesmo
  // contrato de `podeVer` (`lib/domain/permissoes.ts`), reaproveitado aqui
  // em vez de reimplementado, senão a regra da tela e a regra do push
  // divergem no primeiro hub novo.
  const usuariosPorBarco = new Map<string, { id: string; permissoes: Permissoes | null }[]>()
  for (const v of (vinculosR.data ?? []) as Pick<Vinculo, "usuario_id" | "embarcacao_id" | "papel" | "permissoes">[]) {
    const permissoes = v.papel === "PROP" ? null : normalizarPermissoes(v.permissoes)
    usuariosPorBarco.set(v.embarcacao_id, [
      ...(usuariosPorBarco.get(v.embarcacao_id) ?? []),
      { id: v.usuario_id, permissoes },
    ])
  }
  const assinaturas = (assinaturasR.data ?? []) as PushAssinatura[]

  let alertas = 0
  let pushes = 0
  let emails = 0
  let removidas = 0

  /** Grava o alerta (a unique do banco resolve corrida entre disparos concorrentes) e manda
   *  push + e-mail best-effort pra quem tem vinculo com a embarcacao. Usado tanto pelos alertas
   *  de vencimento (item_monitorado_id) quanto pelos avisos gerais (equipamento_id ou so a
   *  embarcacao) — mesma chave de dedupe do indice funcional criado na migration 023.
   *
   *  `aba` é a área do barco a que o aviso pertence, e decide QUEM recebe:
   *  só quem pode VER aquela área (onda 44, PRD §5.2 — "Notificações sempre
   *  respeitam permissões do usuário"). Antes desta onda todo mundo com
   *  vínculo recebia tudo, e o título do push ("Seguro da embarcação —
   *  vencido") vazava conteúdo de hub fechado direto na tela de bloqueio do
   *  celular. `null` = aviso que não pertence a hub nenhum e vai pra todos. */
  async function registrarEDisparar(
    embarcacaoId: string,
    alvo: { itemMonitoradoId?: string; equipamentoId?: string },
    janela: string,
    ref: string,
    titulo: string,
    corpo: string,
    aba: Aba | null,
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

    const usuarios = (usuariosPorBarco.get(embarcacaoId) ?? [])
      .filter((u) => aba == null || podeVer(u.permissoes, aba))
      .map((u) => u.id)
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
      // Achado 3.1 da auditoria de 19/08. Duas correções num bloco só:
      // (a) o `from` era `onboarding@resend.dev`, o remetente de sandbox do
      //     Resend — só entrega para o endereço verificado da própria conta.
      //     Ligar a chave com ele faria o aviso chegar ao dono do Commander e a
      //     mais ninguém, com o log contando isso como sucesso. Agora exige
      //     `RESEND_FROM` (ver `lib/email.ts`);
      // (b) o `catch {}` mudo engolia o motivo da recusa. Push continua sendo o
      //     canal primário e uma falha aqui segue sem abortar o lote — o que
      //     muda é que ela deixa de ser invisível.
      if (chaveResend && remetente) {
        const { data: dadosUsuario } = await admin.auth.admin.getUserById(u)
        const email = dadosUsuario?.user?.email
        if (email) {
          const resultado = await enviarEmail({
            chave: chaveResend,
            remetente,
            para: email,
            assunto: titulo,
            texto: `${titulo}\n\n${corpo}\n\nAbra o Commander para ver os detalhes.`,
          })
          if (resultado.ok) emails++
          else console.error(`[alertas] e-mail recusado para ${u}: ${resultado.motivo}`)
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
    // `abaDoItem` é a MESMA função que a ficha e a Central de Notificações
    // usam pra decidir a que hub um item pertence — e ela espelha o
    // `aba_alvo` da RLS. Um lugar só decide, aqui e na tela.
    await registrarEDisparar(
      item.embarcacao_id, { itemMonitoradoId: item.id }, janela, ref, titulo, corpo,
      abaDoItem(item, equipamentos),
    )
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
    // Mar ruim não é conteúdo de hub nenhum — é sobre sair ou não sair hoje.
    // Todo mundo com vínculo recebe.
    await registrarEDisparar(embarcacoesComMarina[i].id, {}, aviso.janela, aviso.cicloRef, aviso.titulo, aviso.corpo, null)
  }

  // Lembrete de motor parado: por motor sem leitura de horas há mais de 30 dias.
  for (const eq of equipamentos) {
    if (eq.tipo !== "motor") continue
    const aviso = lembreteMotorParado(eq.ultima_leitura, hoje)
    if (!aviso) continue
    const titulo = `${aviso.titulo} — Motor ${eq.posicao ?? ""}`.trim()
    await registrarEDisparar(
      eq.embarcacao_id, { equipamentoId: eq.id }, aviso.janela, aviso.cicloRef, titulo, aviso.corpo,
      abaDoEquipamento(eq.tipo),
    )
  }

  console.log(`[alertas] ${alertas} alertas · ${pushes} pushes · ${emails} e-mails · ${removidas} assinaturas removidas`)

  return NextResponse.json({ alertas, pushes, emails, removidas })
}

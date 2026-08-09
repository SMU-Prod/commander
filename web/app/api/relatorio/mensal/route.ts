import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Embarcacao, Equipamento, Evento, ItemMonitorado } from "@/lib/db/types"
import { hojeISO } from "@/lib/domain/datas"
import { formatarReais } from "@/lib/domain/gastos"
import { mesAnteriorISO, mesSeguinte, resumoDoMes, type ResumoMes } from "@/lib/domain/relatorio"
import { emLotes } from "@/lib/lotes"

export const maxDuration = 60

function mesPorExtenso(mesISO: string): string {
  const [a, m] = mesISO.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)))
}

function diaMes(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

function resumoVazio(r: ResumoMes): boolean {
  return r.horasMotor === 0 && r.totalGastosCentavos === 0 && r.saidas === 0 && r.aVencer.length === 0
}

function corpoDoEmail(nomeEmbarcacao: string, resumo: ResumoMes, mesNome: string, mesSeguinteNome: string): string {
  const linhas = [
    `${nomeEmbarcacao} em ${mesNome}:`,
    "",
    `· ${Math.round(resumo.horasMotor)} h de motor`,
    `· ${formatarReais(resumo.totalGastosCentavos)} em gastos`,
    `· ${resumo.saidas} saídas registradas`,
  ]
  if (resumo.aVencer.length > 0) {
    linhas.push("", `Vence em ${mesSeguinteNome}:`)
    for (const item of resumo.aVencer) linhas.push(`· ${item.nome} — ${diaMes(item.quando)}`)
  }
  linhas.push("", "Abra o Commander para ver o diário completo.")
  return linhas.join("\n")
}

export async function POST(req: NextRequest) {
  const segredo = process.env.ALERTAS_SEGREDO
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 })
  }
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!chaveServico) {
    return NextResponse.json({ erro: "configure SUPABASE_SERVICE_ROLE_KEY no ambiente" }, { status: 500 })
  }
  if (!resendKey) {
    return NextResponse.json(
      { erro: "configure RESEND_API_KEY no ambiente — relatório sem e-mail não existe" },
      { status: 500 },
    )
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })

  const mesISO = mesAnteriorISO(hojeISO())
  const mesNome = mesPorExtenso(mesISO)
  const mesSeguinteNome = mesPorExtenso(mesSeguinte(mesISO))

  const [embarcacoesR, eventosR, itensR, equipamentosR, vinculosR] = await Promise.all([
    admin.from("embarcacoes").select("*"),
    // so o mes do relatorio — evita carregar o diario inteiro de todas as embarcacoes a cada disparo
    admin.from("eventos").select("*").gte("data", `${mesISO}-01`).lt("data", `${mesSeguinte(mesISO)}-01`),
    admin.from("itens_monitorados").select("*"),
    admin.from("equipamentos").select("*"),
    admin.from("vinculos").select("usuario_id, embarcacao_id, papel").eq("papel", "PROP"),
  ])
  const falha = [embarcacoesR, eventosR, itensR, equipamentosR, vinculosR].find((r) => r.error)
  if (falha) return NextResponse.json({ erro: "falha ao carregar dados" }, { status: 500 })

  const propsPorBarco = new Map<string, string[]>()
  for (const v of vinculosR.data ?? []) {
    propsPorBarco.set(v.embarcacao_id, [...(propsPorBarco.get(v.embarcacao_id) ?? []), v.usuario_id])
  }
  const eventos = (eventosR.data ?? []) as Evento[]
  const itens = (itensR.data ?? []) as ItemMonitorado[]
  const equipamentos = (equipamentosR.data ?? []) as Equipamento[]

  let embarcacoesProcessadas = 0
  let enviadas = 0
  let puladas = 0
  let falhas = 0

  // 1º passo (síncrono, sem I/O): decide quem recebe e-mail e monta o corpo.
  // Fica separado do envio pra podermos paralelizar só a parte que tem
  // latência de rede (getUserById + Resend), sem misturar com o cálculo puro.
  type Envio = { usuarioId: string; assunto: string; corpo: string }
  const envios: Envio[] = []

  for (const emb of (embarcacoesR.data ?? []) as Embarcacao[]) {
    embarcacoesProcessadas++
    try {
      // cada embarcacao so enxerga os proprios eventos/itens/equipamentos — sem vazamento entre barcos
      const resumo = resumoDoMes(
        {
          eventos: eventos.filter((e) => e.embarcacao_id === emb.id),
          itens: itens.filter((i) => i.embarcacao_id === emb.id),
          equipamentos: equipamentos.filter((eq) => eq.embarcacao_id === emb.id),
        },
        mesISO,
      )

      if (resumoVazio(resumo)) {
        // relatorio vazio treina o dono a ignorar o e-mail — pula em vez de mandar
        puladas++
        continue
      }

      const corpo = corpoDoEmail(emb.nome, resumo, mesNome, mesSeguinteNome)
      const assunto = `Seu barco em ${mesNome}`
      for (const usuarioId of propsPorBarco.get(emb.id) ?? []) {
        envios.push({ usuarioId, assunto, corpo })
      }
    } catch {
      falhas++
    }
  }

  // 2º passo: envia em lotes concorrentes (Promise.allSettled, mesmo padrão
  // que `alertas/disparar` já usa pros pushes) em vez de um PROP por vez em
  // série. Antes: até ~100 embarcações × ~1,3 PROP × 2 chamadas seriais
  // (getUserById + Resend) ≈ 78 s — acima do maxDuration=60 lá em cima. Em
  // lotes de 10 concorrentes, o tempo vira o número de lotes × a chamada mais
  // lenta do lote, não a soma de todas — poucos segundos pra essa mesma conta.
  const TAMANHO_LOTE = 10
  await emLotes(envios, TAMANHO_LOTE, async (envio) => {
    try {
      const { data: dadosUsuario } = await admin.auth.admin.getUserById(envio.usuarioId)
      const email = dadosUsuario?.user?.email
      if (!email) return
      const resposta = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Commander <onboarding@resend.dev>",
          to: email,
          subject: envio.assunto,
          text: envio.corpo,
        }),
      })
      if (resposta.ok) enviadas++
    } catch {
      // um PROP falhar nao pode travar os demais do lote
    }
  })

  console.log(
    `[relatorio-mensal] ${mesISO} · ${embarcacoesProcessadas} embarcações · ${enviadas} e-mails · ${puladas} puladas · ${falhas} falhas`,
  )

  return NextResponse.json({ embarcacoes: embarcacoesProcessadas, enviadas, puladas, falhas })
}

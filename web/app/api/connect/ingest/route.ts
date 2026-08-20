import { createHash } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checarLimite, identificarIp } from "@/lib/seguranca/limitador"

/**
 * ONDA 140 — A PORTA DE ENTRADA DO COMMANDER CONNECTOR.
 * ===========================================================================
 * O plugin de Signal K a bordo (connector/) POSTa lotes de leituras aqui,
 * autenticado por token de dispositivo (Bearer). Contrato do corpo:
 *
 *   { "leituras": [{ "path": "navigation.position", "valor": ..., "ts": "ISO" }] }
 *
 * Regras do contrato, e por quê:
 * - VALORES NAS UNIDADES SI DO SIGNAL K, sem conversão no plugin — conversão
 *   é responsabilidade de quem exibe (o app), senão cada instalação inventa
 *   uma régua.
 * - Autenticação por HASH do token (o banco nunca viu o token em claro) —
 *   ver lib/acoes/conector.ts.
 * - Escrita com service role e NENHUMA policy de insert pra authenticated:
 *   o caminho de escrita da telemetria é um só e passa por esta validação.
 * - Tetos em tudo (leituras por lote, tamanho de path e de valor, janela de
 *   timestamp): dispositivo comprometido não vira mangueira de lixo no banco.
 */

const MAX_LEITURAS_POR_LOTE = 500
const MAX_VALOR_JSON = 2048
const PATH_VALIDO = /^[A-Za-z0-9]+(\.[A-Za-z0-9-]+){0,11}$/
// Janela de aceitação do ts: fila offline do plugin pode segurar horas de
// dado (7 dias cobre folgado), e relógio adiantado ganha 10 min de tolerância.
const TS_PASSADO_MAX_MS = 7 * 24 * 60 * 60_000
const TS_FUTURO_MAX_MS = 10 * 60_000

// Mesmo desenho do limitador de /api/alertas: mitigação por instância.
const JANELA_MS = 60_000
const LOTES_POR_JANELA = 30

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const limite = checarLimite(`connect:${identificarIp(req.headers)}`, JANELA_MS, LOTES_POR_JANELA)
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: "muitos lotes, aguarde" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    )
  }

  const auth = req.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer cmdr_")) {
    return NextResponse.json({ erro: "token ausente" }, { status: 401 })
  }
  const hash = createHash("sha256").update(auth.slice("Bearer ".length)).digest("hex")

  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chaveServico) {
    return NextResponse.json({ erro: "ingestão indisponível neste ambiente" }, { status: 503 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chaveServico, {
    auth: { persistSession: false },
  })

  const { data: tokens, error: erroToken } = await admin
    .from("conector_tokens")
    .select("id, embarcacao_id, revogado_em")
    .eq("token_hash", hash)
    .limit(1)
  // Tabela ainda não migrada = 503 honesto (o plugin faz backoff e re-tenta),
  // nunca 401 (que faria a pessoa achar que o token está errado).
  if (erroToken) return NextResponse.json({ erro: "ingestão indisponível" }, { status: 503 })
  const tk = tokens?.[0]
  if (!tk || tk.revogado_em) return NextResponse.json({ erro: "token inválido ou revogado" }, { status: 401 })

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo não é JSON" }, { status: 400 })
  }
  const leiturasBrutas = (corpo as { leituras?: unknown })?.leituras
  if (!Array.isArray(leiturasBrutas) || leiturasBrutas.length === 0) {
    return NextResponse.json({ erro: "leituras vazias" }, { status: 400 })
  }
  if (leiturasBrutas.length > MAX_LEITURAS_POR_LOTE) {
    return NextResponse.json({ erro: `no máximo ${MAX_LEITURAS_POR_LOTE} leituras por lote` }, { status: 400 })
  }

  const agora = Date.now()
  const linhas: { embarcacao_id: string; path: string; valor: unknown; ts: string }[] = []
  let recusadas = 0
  for (const bruta of leiturasBrutas) {
    const l = bruta as { path?: unknown; valor?: unknown; ts?: unknown }
    const path = typeof l.path === "string" ? l.path : ""
    const ts = typeof l.ts === "string" ? Date.parse(l.ts) : NaN
    const valorOk =
      l.valor !== undefined && l.valor !== null && JSON.stringify(l.valor).length <= MAX_VALOR_JSON
    const tsOk = Number.isFinite(ts) && agora - ts <= TS_PASSADO_MAX_MS && ts - agora <= TS_FUTURO_MAX_MS
    if (!PATH_VALIDO.test(path) || !valorOk || !tsOk) {
      recusadas++
      continue // leitura torta não derruba o lote — o resto do barco continua entrando
    }
    linhas.push({ embarcacao_id: tk.embarcacao_id, path, valor: l.valor, ts: new Date(ts).toISOString() })
  }
  if (linhas.length === 0) {
    return NextResponse.json({ erro: "nenhuma leitura válida", recusadas }, { status: 400 })
  }

  const { error: erroInsert, data: inseridas } = await admin.from("telemetria").insert(linhas).select("id")
  if (erroInsert || !inseridas?.length) {
    return NextResponse.json({ erro: "falha ao gravar" }, { status: 503 })
  }
  // Melhor esforço: carimbo de último uso do token (diagnóstico na tela de
  // ajustes no futuro). Falhar aqui não falha o lote.
  await admin.from("conector_tokens").update({ ultimo_uso: new Date().toISOString() }).eq("id", tk.id)

  return NextResponse.json({ ok: true, recebidas: inseridas.length, recusadas })
}
